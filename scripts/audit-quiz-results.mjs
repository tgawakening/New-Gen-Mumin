import { PrismaClient } from '@prisma/client';

// Read-only. Run in the deployed app console; never paste database credentials.
const value = flag => { const index = process.argv.indexOf(flag); return index >= 0 ? process.argv[index + 1] || '' : ''; };
const name = value('--name'), quizTitle = value('--quiz');
const raw = process.env.APP_DATABASE_URL || process.env.GEN_MUMIN_DATABASE_URL || process.env.DATABASE_URL;
if (!raw) throw new Error('Run this read-only audit in the App Platform console with the application database environment.');
const url = raw.trim().replace(/^["']|["']$/g, '').replace(/ssl-mode=REQUIRED/gi, 'sslaccept=accept_invalid_certs');
const db = new PrismaClient({ datasources: { db: { url } } });
try {
  const quizzes = await db.quiz.findMany({ where: quizTitle ? { title: { contains: quizTitle } } : {}, select: { id: true, title: true, program: { select: { title: true } }, _count: { select: { questions: true } } } });
  const quizIds = quizzes.map(quiz => quiz.id);
  const [sessions, attempts, practice] = quizIds.length ? await Promise.all([
    db.quizLiveSession.findMany({ where: { quizId: { in: quizIds } }, include: { seats: { select: { studentId: true, joinedAt: true } }, responses: { select: { id: true, studentId: true, earnedPoints: true, housePointsAwarded: true, isCorrect: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }),
    db.quizAttempt.findMany({ where: { quizId: { in: quizIds } }, include: { answers: { select: { isCorrect: true, answer: true } } }, orderBy: { createdAt: 'desc' }, take: 5000 }),
    db.quizPracticeAttempt.findMany({ where: { quizId: { in: quizIds } }, select: { id: true, quizId: true, studentId: true, score: true, correctCount: true, questionCount: true, finishedAt: true }, orderBy: { startedAt: 'desc' }, take: 5000 }),
  ]) : [[], [], []];
  const candidates = [...new Set([...sessions.flatMap(session => [...session.seats.map(seat => seat.studentId), ...session.responses.map(response => response.studentId)]), ...attempts.map(attempt => attempt.studentId), ...practice.map(attempt => attempt.studentId)])];
  const students = await db.studentProfile.findMany({ where: name ? { OR: [{ displayName: { contains: name } }, { user: { firstName: { contains: name } } }, { user: { lastName: { contains: name } } }] } : { id: { in: candidates } }, select: { id: true, displayName: true, user: { select: { firstName: true, lastName: true } }, houseMembership: { select: { qabilaGroup: true } } }, take: 1000 });
  const sourceIds = [...sessions.flatMap(session => session.responses.map(response => response.id)), ...attempts.map(attempt => attempt.id)];
  const credits = sourceIds.length && students.length ? await db.housePointLedger.findMany({ where: { studentId: { in: students.map(student => student.id) }, sourceType: { in: ['QUIZ_LIVE_ANSWER', 'QUIZ'] }, sourceId: { in: sourceIds } }, select: { studentId: true, sourceId: true, sourceType: true, points: true } }) : [];
  const quiz = id => quizzes.find(item => item.id === id);
  const credit = (studentId, sourceId, sourceType) => credits.find(item => item.studentId === studentId && item.sourceId === sourceId && item.sourceType === sourceType)?.points ?? 0;
  const report = students.map(student => ({
    studentId: student.id, name: student.displayName || `${student.user.firstName} ${student.user.lastName || ''}`.trim(), qabila: student.houseMembership?.qabilaGroup || 'Unassigned',
    live: sessions.filter(session => session.seats.some(seat => seat.studentId === student.id) || session.responses.some(response => response.studentId === student.id)).map(session => {
      const responses = session.responses.filter(response => response.studentId === student.id);
      const earned = responses.reduce((sum, response) => sum + response.earnedPoints, 0);
      const recorded = responses.reduce((sum, response) => sum + credit(student.id, response.id, 'QUIZ_LIVE_ANSWER'), 0);
      return { sessionId: session.id, quiz: quiz(session.quizId)?.title, programme: quiz(session.quizId)?.program.title, status: session.status, joinedAt: session.seats.find(seat => seat.studentId === student.id)?.joinedAt || null, answered: responses.length, correct: responses.filter(response => response.isCorrect).length, earnedScore: responses.length ? earned : null, recordedQabilaCredit: recorded, creditMismatch: earned !== recorded, manualCreditConflicts: responses.filter(response => { const points = credit(student.id, response.id, 'QUIZ_LIVE_ANSWER'); return points !== 0 && points !== response.housePointsAwarded && points !== response.earnedPoints; }).length };
    }),
    ordinary: attempts.filter(attempt => attempt.studentId === student.id).map(attempt => ({ attemptId: attempt.id, quiz: quiz(attempt.quizId)?.title, programme: quiz(attempt.quizId)?.program.title, submittedAt: attempt.submittedAt, autoScore: attempt.autoScore, manualScore: attempt.manualScore, savedAnswers: attempt.answers.length, correct: attempt.answers.filter(answer => answer.isCorrect).length, recordedQabilaCredit: credit(student.id, attempt.id, 'QUIZ') })),
    practice: practice.filter(attempt => attempt.studentId === student.id).map(attempt => ({ attemptId: attempt.id, quiz: quiz(attempt.quizId)?.title, score: attempt.score, correct: `${attempt.correctCount}/${attempt.questionCount}`, finishedAt: attempt.finishedAt, note: 'Practice-only score; repeat practice does not award Qabila points.' })),
  }));
  const summary = { learners: report.length, unassignedLearners: report.filter(student => student.qabila === 'Unassigned').length, liveResultsWithCreditMismatch: report.flatMap(student => student.live).filter(result => result.creditMismatch).length, liveManualCreditConflicts: report.flatMap(student => student.live).reduce((sum, result) => sum + result.manualCreditConflicts, 0), joinedWithoutSavedAnswers: report.flatMap(student => student.live).filter(result => result.joinedAt && !result.answered).length, ordinaryResultsWithMissingPositiveCredit: report.flatMap(student => student.ordinary).filter(result => result.submittedAt && result.autoScore > 0 && !result.recordedQabilaCredit).length };
  console.log(JSON.stringify({ mode: 'read-only', filters: { name, quizTitle }, summary, limits: '200 most recent live sessions, 5000 ordinary/practice attempts and 1000 learners; narrow with --quiz or --name if needed.', matchingQuizzes: quizzes.map(item => ({ id: item.id, title: item.title, programme: item.program.title, currentQuestionCount: item._count.questions })), students: report }, null, 2));
} catch {
  console.error('Audit could not complete. Check the deployed database connection and migrations; no data was changed.');
  process.exitCode = 1;
} finally { await db.$disconnect(); }
