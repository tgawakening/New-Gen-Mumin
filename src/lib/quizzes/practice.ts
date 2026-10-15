import 'server-only';
import type { Prisma, QuizPracticeAttempt } from '@prisma/client';
import { db } from '@/lib/db';
import type { SessionUser } from '@/lib/auth/session';
import { ownedQuizLearners, QuizError } from './runtime';
import { publicQuestion, quizDuration, QUIZ_LEASE_MS } from './protocol';
import { scorePracticeAnswer, type PracticeQuestion, type PracticeAnswer, type PracticeView } from './practice-protocol';
import { createReadOnlyRosterResolver } from '@/lib/live-classes/service';
const json = (value: unknown) => value as Prisma.InputJsonValue;
async function owned(user: SessionUser, studentId: string) {
 const children = await ownedQuizLearners(user);
 if (!children.some(child => child.id === studentId)) throw new QuizError('This learner is not linked to your account.', 403);
}
export async function practiceLibrary(user: SessionUser, studentId: string) {
 await owned(user, studentId);
 const enrollments = await db.enrollment.findMany({ where: { studentId, status: { in: ['ACTIVE','CONFIRMED','COMPLETED'] } }, select: { programId: true } });
 const quizzes = await db.quiz.findMany({ where: { isPublished: true, programId: { in: enrollments.map(e => e.programId) } }, select: { id: true, title: true, programId: true } });
 const sessions = await db.quizLiveSession.findMany({ where: { quizId: { in: quizzes.map(q => q.id) }, status: 'ENDED', startedAt: { not: null } }, select: { id: true, quizId: true, teacherUserId: true, seats: { select: { studentId: true } }, responses: { where: { studentId }, select: { id: true }, take: 1 } } });
 const active = await db.quizLiveSession.findMany({ where: { quizId: { in: quizzes.map(q => q.id) }, status: { in: ['WAITING','LIVE'] }, updatedAt: { gte: new Date(Date.now()-QUIZ_LEASE_MS) } }, select: { quizId: true } });
 const allowed = new Set<string>();
 const roster = createReadOnlyRosterResolver();
 for (const live of sessions) {
  if (active.some(a => a.quizId === live.quizId)) continue;
  if (live.seats.some(s => s.studentId === studentId) || live.responses.length) { allowed.add(live.quizId); continue; }
  // Older sessions predate roster snapshots: use the teacher's current programme roster only for those.
  if (!live.seats.length) {
   const teacher = await db.teacherProfile.findUnique({ where: { userId: live.teacherUserId }, select: { id: true } });
   const quiz = quizzes.find(q => q.id === live.quizId);
   if (teacher && quiz && (await roster.read.teacher(teacher.id, quiz.programId)).includes(studentId)) allowed.add(quiz.id);
  }
 }
 const attempts = await db.quizPracticeAttempt.findMany({ where: { studentId, quizId: { in: [...allowed] } }, orderBy: { startedAt: 'desc' }, select: { id: true, quizId: true, score: true, correctCount: true, questionCount: true, finishedAt: true, startedAt: true } });
 return quizzes.filter(q => allowed.has(q.id)).map(quiz => ({ ...quiz, attempts: attempts.filter(a => a.quizId === quiz.id).map(a => ({ ...a, startedAt: a.startedAt.toISOString(), finishedAt: a.finishedAt?.toISOString() ?? null })) }));
}
function view(row: QuizPracticeAttempt): PracticeView {
 const questions = row.snapshot as unknown as PracticeQuestion[];
 const answers = row.answers as unknown as PracticeAnswer[];
 const current = questions[row.questionIndex];
 const response = answers.find(a => a.questionId === current?.id) ?? null;
 // Never send unseen answer keys to the browser.
 const question = current && !row.finishedAt ? { id: current.id, prompt: current.prompt, type: current.type, points: current.points, choices: current.choices, image: current.image } : null;
 return { id: row.id, title: row.title, questionNumber: row.questionIndex+1, questionCount: row.questionCount, score: row.score, correctCount: row.correctCount, finished: !!row.finishedAt, serverNow: Date.now(), deadline: row.questionStartedAt.getTime()+row.durationSeconds*1000, question, response, answers };
}
export async function startPractice(user: SessionUser, studentId: string, quizId: string) {
 if (!(await practiceLibrary(user, studentId)).some(q => q.id === quizId)) throw new QuizError('Practice opens after your teacher finishes the live quiz.',403);
 const quiz = await db.quiz.findUnique({ where: { id: quizId }, include: { questions: { orderBy: { sortOrder:'asc' } } } });
 if (!quiz) throw new QuizError('Quiz unavailable.',404);
 const questions: PracticeQuestion[] = quiz.questions.flatMap(q => {
  const key = q.answerKey as { answer?: unknown } | null;
  return ['MCQ','TRUE_FALSE','FILL_IN_BLANK'].includes(q.type) && typeof key?.answer === 'string' && key.answer.trim() ? [{ ...publicQuestion(q), correctAnswer: key.answer }] : [];
 });
 if (!questions.length) throw new QuizError('This quiz has no automatically marked questions available for practice.');
 return db.$transaction(async tx => {
  await tx.$queryRaw`SELECT id FROM StudentProfile WHERE id = ${studentId} FOR UPDATE`;
  const existing = await tx.quizPracticeAttempt.findFirst({ where: { studentId, quizId, finishedAt: null }, orderBy: { startedAt:'desc' } });
  if (existing) return view(existing);
  return view(await tx.quizPracticeAttempt.create({ data: { studentId, quizId, title: quiz.title, snapshot: json(questions), answers: [], durationSeconds: quizDuration(quiz.meta), questionCount: questions.length } }));
 });
}
export async function readPractice(user: SessionUser, studentId: string, id: string) {
 await owned(user,studentId);
 const row = await db.quizPracticeAttempt.findFirst({ where: { id, studentId } });
 if (!row) throw new QuizError('Practice result not found.',404);
 return view(row);
}
export async function advancePractice(user: SessionUser, studentId: string, id: string, input: { action: string; questionId: string; answer: string }) {
 await owned(user,studentId);
 return db.$transaction(async tx => {
  await tx.$queryRaw`SELECT id FROM QuizPracticeAttempt WHERE id = ${id} AND studentId = ${studentId} FOR UPDATE`;
  const row = await tx.quizPracticeAttempt.findFirst({ where: { id, studentId } });
  if (!row) throw new QuizError('Practice not found.',404);
  if (row.finishedAt) return view(row);
  const questions = row.snapshot as unknown as PracticeQuestion[], answers = row.answers as unknown as PracticeAnswer[];
  const current = questions[row.questionIndex];
  if (input.questionId !== current.id) return view(row); // Retried/stale requests never answer or skip a second question.
  const answered = answers.some(a => a.questionId === current.id);
  if (input.action === 'answer') {
   if (answered) return view(row);
   const answer = scorePracticeAnswer(current,input.answer,Date.now()>row.questionStartedAt.getTime()+row.durationSeconds*1000);
   return view(await tx.quizPracticeAttempt.update({ where: { id }, data: { answers: json([...answers,answer]), score: row.score+answer.points, correctCount: row.correctCount+Number(answer.correct) } }));
  }
  if (input.action !== 'next' || !answered) throw new QuizError('Answer this question first.');
  return view(await tx.quizPracticeAttempt.update({ where: { id }, data: row.questionIndex+1 === questions.length ? { finishedAt: new Date() } : { questionIndex: row.questionIndex+1, questionStartedAt: new Date() } }));
 });
}
