import 'server-only';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import { createReadOnlyRosterResolver } from '@/lib/live-classes/service';
import { ensureStudentHouseMembership } from '@/lib/community/house-points';
import type { SessionUser } from '@/lib/auth/session';
import { QUIZ_AVATARS } from '@/lib/quizzes/avatars';
import { publicQuestion, quizDuration, roundAcceptsAnswer, QUIZ_LEASE_MS, type LiveQuizState, type QuizAnswerView, type QuizLobby } from './protocol';
const activeEnrollments = ['ACTIVE', 'CONFIRMED', 'COMPLETED'] as const;
export class QuizError extends Error { constructor(message: string, public status = 400) { super(message); } }
// Tiny per-process single-flight caches: no account-specific answers or access decisions are cached.
function shortCache<T>(ttl: number, load: (key: string) => Promise<T>) {
 const entries = new Map<string, { until: number; value: Promise<T> }>();
 return { clear(key: string) { entries.delete(key); }, get(key: string) {
  const old = entries.get(key); if (old && old.until > Date.now()) return old.value;
  if (entries.size > 250) for (const [id, value] of entries) if (value.until <= Date.now()) entries.delete(id);
  const entry: { until: number; value: Promise<T> } = { until: Infinity, value: Promise.resolve(null as T) as Promise<T> };
  entry.value = load(key).then(result => { entry.until = Date.now() + ttl; return result; }).catch(error => { if (entries.get(key) === entry) entries.delete(key); throw error; });
  entries.set(key, entry); return entry.value;
 } };
}
const sessionCache = shortCache(700, id => db.quizLiveSession.findUnique({ where: { id } }));
const quizCache = shortCache(15000, id => db.quiz.findUnique({ where: { id }, include: { questions: { orderBy: { sortOrder: 'asc' } } } }));
const activeCache = shortCache(700, async () => db.quizLiveSession.findMany({ where: { status: { in: ['WAITING', 'LIVE'] }, updatedAt: { gte: new Date(Date.now() - QUIZ_LEASE_MS) } }, orderBy: { createdAt: 'desc' } }));
function invalidate(id: string) { sessionCache.clear(id); activeCache.clear('active'); }
export async function ownedQuizLearners(user: SessionUser) {
 if (!['PARENT', 'STUDENT'].includes(user.role)) throw new QuizError('Please sign in as a parent or student.', 403);
 return db.studentProfile.findMany({ where: user.role === 'STUDENT' ? { userId: user.id, user: { status: 'ACTIVE' } } : { parents: { some: { parent: { userId: user.id } } }, user: { status: 'ACTIVE' } }, select: { id: true, displayName: true, user: { select: { firstName: true, lastName: true } } } });
}
export async function quizLobbyList(user: SessionUser): Promise<QuizLobby[]> {
 if (!['PARENT', 'STUDENT'].includes(user.role)) throw new QuizError('Unauthorized', 403);
 const sessions = await activeCache.get('active'); if (!sessions.length) return [];
 const learners = await ownedQuizLearners(user); if (!learners.length) return [];
 const [seats, quizzes, enrollments] = await Promise.all([
  db.quizLiveSeat.findMany({ where: { studentId: { in: learners.map(c => c.id) }, sessionId: { in: sessions.map(s => s.id) } }, select: { studentId: true, sessionId: true } }),
  db.quiz.findMany({ where: { id: { in: sessions.map(s => s.quizId) }, isPublished: true }, select: { id: true, title: true, programId: true } }),
  db.enrollment.findMany({ where: { studentId: { in: learners.map(c => c.id) }, status: { in: [...activeEnrollments] } }, select: { studentId: true, programId: true } }),
 ]);
 return seats.flatMap(seat => {
  const session = sessions.find(s => s.id === seat.sessionId), learner = learners.find(c => c.id === seat.studentId);
  const quiz = quizzes.find(q => q.id === session?.quizId);
  if (!session || !learner || !quiz || !enrollments.some(e => e.studentId === learner.id && e.programId === quiz.programId)) return [];
  return [{ sessionId: session.id, studentId: learner.id, childName: learner.displayName || `${learner.user.firstName} ${learner.user.lastName}`, title: quiz.title, status: session.status }];
 });
}
export async function openQuizLobby(quizId: string, teacherUserId: string) {
 const [teacher, quiz] = await Promise.all([
  db.teacherProfile.findUnique({ where: { userId: teacherUserId }, include: { programAssignments: true } }),
  db.quiz.findUnique({ where: { id: quizId }, include: { questions: { select: { id: true } } } }),
 ]);
 if (!teacher || !quiz || !teacher.programAssignments.some(a => a.programId === quiz.programId)) throw new QuizError('This quiz is not assigned to you.', 403);
 if (!quiz.isPublished) throw new QuizError('Publish this quiz before opening the lobby.');
 if (!quiz.questions.length) throw new QuizError('Add a question before starting.');
 const existing = await db.quizLiveSession.findFirst({ where: { quizId, teacherUserId, status: { in: ['WAITING', 'LIVE'] }, updatedAt: { gte: new Date(Date.now() - QUIZ_LEASE_MS) }, seats: { some: {} } } });
 if (existing) return existing;
 const roster = await createReadOnlyRosterResolver().read.teacher(teacher.id, quiz.programId);
 const enrolled = await db.enrollment.findMany({ where: { studentId: { in: roster }, programId: quiz.programId, status: { in: [...activeEnrollments] } }, select: { studentId: true } });
 if (!enrolled.length) throw new QuizError('No eligible learners are assigned to this programme. Check your roster first.');
 const result = await db.$transaction(async tx => {
  await tx.$queryRaw`SELECT id FROM User WHERE id = ${teacherUserId} FOR UPDATE`;
  const current = await tx.quizLiveSession.findFirst({ where: { quizId, teacherUserId, status: { in: ['WAITING', 'LIVE'] }, updatedAt: { gte: new Date(Date.now() - QUIZ_LEASE_MS) } }, orderBy: { createdAt: 'desc' } });
  const session = current ?? await tx.quizLiveSession.create({ data: { quizId, teacherUserId, status: 'WAITING' } });
  await tx.quizLiveSeat.createMany({ data: enrolled.map(e => ({ sessionId: session.id, studentId: e.studentId })), skipDuplicates: true });
  return session;
 }, { maxWait: 10000, timeout: 20000 });
 quizCache.clear(quizId); invalidate(result.id); return result;
}
async function context(sessionId: string, user: SessionUser, studentId?: string) {
 const session = await sessionCache.get(sessionId);
 if (!session) throw new QuizError('Quiz session not found.', 404);
 const quiz = await quizCache.get(session.quizId);
 if (!quiz) throw new QuizError('Quiz not found.', 404);
 if (user.role === 'TEACHER') {
  if (session.teacherUserId !== user.id) throw new QuizError('This quiz belongs to another teacher.', 403);
  return { session, quiz, seat: null };
 }
 if (!quiz.isPublished || !['PARENT','STUDENT'].includes(user.role)) throw new QuizError('This quiz is not available.', 403);
 const seat = await db.quizLiveSeat.findFirst({ where: { sessionId, ...(studentId ? { studentId } : {}), student: { ...(user.role === 'STUDENT' ? { userId: user.id } : { parents: { some: { parent: { userId: user.id } } } }), user: { status: 'ACTIVE' }, enrollments: { some: { programId: quiz.programId, status: { in: [...activeEnrollments] } } } } }, include: { student: { select: { id: true, displayName: true, user: { select: { firstName: true, avatarUrl: true } } } } } });
 if (!seat) throw new QuizError('This learner is not on the roster for this live quiz.', 403);
 return { session, quiz, seat };
}
function answerView(row: { questionId: string; answer: unknown; isCorrect: boolean | null; housePointsAwarded: number }): QuizAnswerView {
 const answer = row.answer as { value?: string; secondsTaken?: number };
 return { questionId: row.questionId, answer: answer.value || '', correct: row.isCorrect, points: row.housePointsAwarded, seconds: answer.secondsTaken || 0 };
}
export async function quizState(sessionId: string, user: SessionUser, studentId?: string, knownQuestion?: string): Promise<LiveQuizState> {
 const { session, quiz, seat } = await context(sessionId, user, studentId);
 const responses = await db.quizLiveResponse.findMany({ where: { sessionId, ...(seat ? { studentId: seat.studentId } : {}) }, orderBy: { answeredAt: 'asc' } });
 const question = quiz.questions.find(q => q.id === session.currentQuestionId);
 const duration = quizDuration(quiz.meta), round = session.currentQuestionStartedAt?.toISOString() ?? null;
 const own = seat ? responses.map(answerView) : [];
 const base: LiveQuizState = { id: sessionId, title: quiz.title, status: session.status, serverNow: new Date().toISOString(), round, questionId: question?.id ?? null, duration, deadline: round ? new Date(Date.parse(round) + duration * 1000).toISOString() : null, questionCount: quiz.questions.length, questionNumber: question ? quiz.questions.findIndex(q => q.id === question.id) + 1 : 0, ...(question?.id !== knownQuestion ? { question: question ? publicQuestion(question) : null } : {}), response: own.find(r => r.questionId === question?.id) ?? null, responses: own, bonus: 0 };
 if (seat) {
  base.learner = { id: seat.studentId, name: seat.student.displayName || seat.student.user.firstName, avatar: seat.student.user.avatarUrl };
  if (session.status === 'ENDED') {
   base.questions = quiz.questions.map(q => publicQuestion(q, false));
   const bonus = await db.housePointLedger.findFirst({ where: { studentId: seat.studentId, sourceType: 'QUIZ_LIVE_COMPLETE', sourceId: quiz.id }, select: { points: true } }); base.bonus = bonus?.points ?? 0;
  }
 } else {
  const seats = await db.quizLiveSeat.findMany({ where: { sessionId }, include: { student: { select: { displayName: true, user: { select: { firstName: true, avatarUrl: true } }, houseMembership: { select: { qabilaGroup: true, house: { select: { name: true } } } } } } } });
  base.questions = quiz.questions.map(q => publicQuestion(q, false));
  base.roster = seats.map(s => ({ id: s.studentId, name: s.student.displayName || s.student.user.firstName, avatar: s.student.user.avatarUrl, house: s.student.houseMembership?.qabilaGroup || s.student.houseMembership?.house.name || 'No Qabila', joined: Boolean(s.joinedAt), ...(responses.find(r => r.studentId === s.studentId && r.questionId === question?.id) ? { answer: answerView(responses.find(r => r.studentId === s.studentId && r.questionId === question?.id)!) } : {}) }));
  const totals = new Map<string, number>();
  for (const r of responses) { const name = base.roster.find(s => s.id === r.studentId)?.house || 'No Qabila'; totals.set(name, (totals.get(name) ?? 0) + r.housePointsAwarded); }
  base.teams = [...totals].map(([name, points]) => ({ name, points })).sort((a,b) => b.points-a.points);
 }
 base.serverNow = new Date().toISOString();
 return base;
}
export async function joinQuiz(sessionId: string, user: SessionUser, studentId?: string, avatarId?: string) {
 const { session, seat } = await context(sessionId, user, studentId);
 if (!seat) throw new QuizError('Choose a learner account.', 403);
 if (session.status === 'ENDED') return seat.studentId;
 if (avatarId && !QUIZ_AVATARS.some(a => a.id === avatarId)) throw new QuizError('Choose a valid avatar.');
 if (!seat.joinedAt) await ensureStudentHouseMembership(seat.studentId);
 await db.quizLiveSeat.update({ where: { id: seat.id }, data: { joinedAt: seat.joinedAt ?? new Date(), lastSeenAt: new Date() } });
 if (avatarId) await db.studentProfile.update({ where: { id: seat.studentId }, data: { user: { update: { avatarUrl: avatarId } } } });
 return seat.studentId;
}
export async function submitQuizAnswer(sessionId: string, user: SessionUser, input: { studentId?: string; questionId: string; round: string; answer: string }, receivedAt: Date) {
 const { session, quiz, seat } = await context(sessionId, user, input.studentId);
 if (!seat) throw new QuizError('A learner account is required.', 403);
 const key = { sessionId, questionId: input.questionId, studentId: seat.studentId };
 const existing = await db.quizLiveResponse.findUnique({ where: { sessionId_questionId_studentId: key } });
 if (existing) return answerView(existing);
 if (!roundAcceptsAnswer(session, input.questionId, input.round, receivedAt, quizDuration(quiz.meta))) throw new QuizError('This round has closed or changed. Wait for your teacher to reopen it or start the next question.', 409);
 const question = quiz.questions.find(q => q.id === input.questionId);
 if (!question || !input.answer.trim() || input.answer.length > 4000) throw new QuizError('Choose or type an answer.');
 const choices = publicQuestion(question, false).choices;
 if (choices.length && !choices.includes(input.answer)) throw new QuizError('Choose one of the available answers.');
 const correctKey = (question.answerKey as { answer?: unknown } | null)?.answer;
 const objective = ['MCQ','TRUE_FALSE','FILL_IN_BLANK'].includes(question.type);
 const correct = objective && typeof correctKey === 'string' ? input.answer.trim().toLowerCase() === correctKey.trim().toLowerCase() : null;
 const membership = await db.houseMembership.findUnique({ where: { studentId: seat.studentId }, select: { houseId: true } });
 if (!membership) throw new QuizError('Please rejoin the quiz before submitting.');
 const id = randomUUID(), seconds = Math.max(0, Math.floor((receivedAt.getTime() - Date.parse(input.round)) / 1000));
 const answer = JSON.stringify({ value: input.answer.trim(), secondsTaken: seconds, withinWindow: true });
 try {
  return await db.$transaction(async tx => {
   // INSERT...SELECT checks the round at the write itself. A stale request can never answer a newer question.
   const inserted = await tx.$executeRaw`INSERT INTO QuizLiveResponse (id, sessionId, questionId, studentId, answer, isCorrect, earnedPoints, housePointsAwarded, answeredAt)
    SELECT ${id}, id, ${input.questionId}, ${seat.studentId}, ${answer}, ${correct}, ${correct ? question.points : 0}, ${correct ? 1 : 0}, ${receivedAt}
    FROM QuizLiveSession WHERE id = ${sessionId} AND status = 'LIVE' AND currentQuestionId = ${input.questionId} AND currentQuestionStartedAt = ${new Date(input.round)}`;
   if (!inserted) throw new QuizError('Your teacher changed the question. Please answer the current round.', 409);
   if (correct) await tx.housePointLedger.create({ data: { houseId: membership.houseId, studentId: seat.studentId, points: 1, reason: `${quiz.title}: correct live answer (+1 team point)`, sourceType: 'QUIZ_LIVE_ANSWER', sourceId: id } });
   return { questionId: input.questionId, answer: input.answer.trim(), correct, points: correct ? 1 : 0, seconds };
  }, { maxWait: 10000, timeout: 15000 });
 } catch (error) {
  if (typeof error === 'object' && error && 'code' in error && (error.code === 'P2002' || error.code === 'P2010')) {
   const saved = await db.quizLiveResponse.findUnique({ where: { sessionId_questionId_studentId: key } }); if (saved) return answerView(saved);
  }
  throw error;
 }
}
export async function controlQuiz(sessionId: string, user: SessionUser, input: { action: string; questionId?: string; round?: string | null }) {
 if (user.role !== 'TEACHER') throw new QuizError('Teacher access required.', 403);
 const { session, quiz } = await context(sessionId, user);
 if (input.action === 'heartbeat') {
  await db.quizLiveSession.updateMany({ where: { id: sessionId, teacherUserId: user.id, status: { in: ['WAITING','LIVE'] } }, data: { updatedAt: new Date() } }); invalidate(sessionId); return;
 }
 if (input.action === 'open' || input.action === 'reopen') {
  const question = quiz.questions.find(q => q.id === input.questionId);
  if (!question) throw new QuizError('Question not found.');
  if (session.status === 'ENDED') throw new QuizError('This quiz ended. Start a new attempt.', 409);
  if (input.action === 'open' && session.currentQuestionId === question.id) return;
  const changed = await db.quizLiveSession.updateMany({ where: { id: sessionId, teacherUserId: user.id, status: { in: ['WAITING','LIVE'] }, currentQuestionStartedAt: input.round ? new Date(input.round) : null }, data: { status: 'LIVE', currentQuestionId: question.id, currentQuestionStartedAt: new Date(), startedAt: session.startedAt ?? new Date() } });
  if (!changed.count) throw new QuizError('The round already changed. The latest question is loading.', 409);
 } else if (input.action === 'end' || input.action === 'restart') {
  await db.$transaction(async tx => {
   await tx.$queryRaw`SELECT id FROM QuizLiveSession WHERE id = ${sessionId} FOR UPDATE`;
   const current = await tx.quizLiveSession.findUnique({ where: { id: sessionId } });
   if (!current || current.teacherUserId !== user.id) throw new QuizError('Unauthorized', 403);
   if (current.status === 'ENDED') return;
   await tx.quizLiveSession.update({ where: { id: sessionId }, data: { status: 'ENDED', endedAt: new Date(), currentQuestionId: null, currentQuestionStartedAt: null } });
   const correct = await tx.quizLiveResponse.findMany({ where: { sessionId, isCorrect: true }, select: { studentId: true, questionId: true } });
   const perfect = [...new Set(correct.map(r => r.studentId))].filter(id => quiz.questions.length > 0 && quiz.questions.every(q => correct.some(r => r.studentId === id && r.questionId === q.id)));
   if (perfect.length) {
    const [awarded, members] = await Promise.all([
     tx.housePointLedger.findMany({ where: { studentId: { in: perfect }, sourceType: 'QUIZ_LIVE_COMPLETE', sourceId: quiz.id }, select: { studentId: true } }),
     tx.houseMembership.findMany({ where: { studentId: { in: perfect } }, select: { studentId: true, houseId: true } }),
    ]);
    await tx.housePointLedger.createMany({ data: members.filter(m => !awarded.some(a => a.studentId === m.studentId)).map(m => ({ id: `quiz-perfect:${quiz.id}:${m.studentId}`, houseId: m.houseId, studentId: m.studentId, points: 10, reason: `${quiz.title}: perfect quiz bonus`, sourceType: 'QUIZ_LIVE_COMPLETE', sourceId: quiz.id })), skipDuplicates: true });
   }
  }, { maxWait: 10000, timeout: 20000 });
 } else throw new QuizError('Unknown quiz action.');
 invalidate(sessionId);
 if (input.action === 'restart') return (await openQuizLobby(quiz.id, user.id)).id;
}
