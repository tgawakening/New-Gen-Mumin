import "server-only";

import { db } from "@/lib/db";
import {
  QUIZ_CORRECT_MESSAGE,
  QUIZ_INCORRECT_MESSAGE,
  QUIZ_PARTICIPATION_MESSAGE,
  ensureStudentHouseMembership,
  getHouseLeaderboard,
} from "@/lib/community/house-points";

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"] as const;

type QuizMeta = {
  responseWindowSeconds?: number;
  participationPoints?: number;
  streakBonusPoints?: number;
};

function quizSettings(meta: unknown) {
  const value = meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as QuizMeta) : {};
  return {
    responseWindowSeconds: Math.max(1, Number(value.responseWindowSeconds ?? 10)),
    participationPoints: Math.max(0, Number(value.participationPoints ?? 0)),
    streakBonusPoints: Math.max(0, Number(value.streakBonusPoints ?? 5)),
  };
}

function answerKeyValue(answerKey: unknown) {
  if (!answerKey || typeof answerKey !== "object" || Array.isArray(answerKey)) return "";
  const value = (answerKey as { answer?: unknown }).answer;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeAnswer(value: string) {
  return value.trim().toLowerCase();
}

function isObjectiveQuestion(type: string) {
  return ["MCQ", "TRUE_FALSE", "FILL_IN_BLANK"].includes(type);
}

export async function createLiveQuizSession(input: { quizId: string; teacherUserId: string }) {
  const teacher = await db.teacherProfile.findUnique({
    where: { userId: input.teacherUserId },
    include: { programAssignments: true },
  });
  if (!teacher) throw new Error("Teacher profile not found.");

  const quiz = await db.quiz.findUnique({
    where: { id: input.quizId },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quiz || !teacher.programAssignments.some((assignment) => assignment.programId === quiz.programId)) {
    throw new Error("Quiz is not available for this teacher.");
  }
  if (!quiz.questions.length) throw new Error("Add at least one question before starting live quiz.");

  const existingSession = await db.quizLiveSession.findFirst({
    where: {
      quizId: quiz.id,
      teacherUserId: input.teacherUserId,
      status: { in: ["WAITING", "LIVE"] },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (existingSession) return existingSession;

  return db.quizLiveSession.create({
    data: {
      quizId: quiz.id,
      teacherUserId: input.teacherUserId,
      status: "WAITING",
    },
  });
}

export async function getTeacherLiveQuizSession(sessionId: string, teacherUserId: string) {
  const session = await db.quizLiveSession.findFirst({
    where: { id: sessionId, teacherUserId },
    include: {
      responses: true,
    },
  });
  if (!session) return null;

  const quiz = await db.quiz.findUnique({
    where: { id: session.quizId },
    include: {
      program: true,
      questions: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quiz) return null;

  const rosterStudents = await db.studentProfile.findMany({
    where: {
      enrollments: {
        some: {
          programId: quiz.programId,
          status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
        },
      },
    },
    include: {
      user: true,
      houseMembership: { include: { house: true } },
      registrationStudents: { select: { gender: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
  });
  const responseStudentIds = session.responses.map((response) => response.studentId);
  const missingResponseStudents = responseStudentIds.filter((studentId) => !rosterStudents.some((student) => student.id === studentId));
  const extraStudents = missingResponseStudents.length
    ? await db.studentProfile.findMany({
        where: { id: { in: missingResponseStudents } },
        include: {
          user: true,
          houseMembership: { include: { house: true } },
          registrationStudents: { select: { gender: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      })
    : [];
  const students = [...rosterStudents, ...extraStudents];
  const studentById = new Map(students.map((student) => [student.id, student]));

  return {
    session,
    quiz,
    settings: quizSettings(quiz.meta),
    leaderboard: await getHouseLeaderboard(),
    roster: students.map((student) => ({
      id: student.id,
      name: student.displayName || `${student.user.firstName} ${student.user.lastName}`.trim(),
      gender: student.registrationStudents[0]?.gender ?? null,
      houseName: student.houseMembership?.house.name ?? "No house",
    })),
    responses: session.responses.map((response) => {
      const student = studentById.get(response.studentId);
      return {
        ...response,
        studentName: student?.displayName || `${student?.user.firstName ?? "Student"} ${student?.user.lastName ?? ""}`.trim(),
        studentGender: student?.registrationStudents[0]?.gender ?? null,
        houseName: student?.houseMembership?.house.name ?? "No house",
      };
    }),
  };
}

export async function setLiveQuizQuestion(input: { sessionId: string; teacherUserId: string; questionId: string }) {
  const live = await getTeacherLiveQuizSession(input.sessionId, input.teacherUserId);
  if (!live) throw new Error("Live quiz session not found.");
  if (!live.quiz.questions.some((question) => question.id === input.questionId)) {
    throw new Error("Question is not part of this quiz.");
  }

  return db.quizLiveSession.update({
    where: { id: input.sessionId },
    data: {
      status: "LIVE",
      startedAt: live.session.startedAt ?? new Date(),
      currentQuestionId: input.questionId,
      currentQuestionStartedAt: new Date(),
    },
  });
}

export async function endLiveQuizSession(input: { sessionId: string; teacherUserId: string }) {
  const live = await getTeacherLiveQuizSession(input.sessionId, input.teacherUserId);
  if (!live) throw new Error("Live quiz session not found.");
  return db.quizLiveSession.update({
    where: { id: input.sessionId },
    data: {
      status: "ENDED",
      endedAt: new Date(),
      currentQuestionId: null,
      currentQuestionStartedAt: null,
    },
  });
}

export async function getStudentLiveQuizSessionByStudentId(sessionId: string, studentId: string) {
  const student = await db.studentProfile.findUnique({
    where: { id: studentId },
    include: { user: true },
  });
  if (!student) return null;

  const session = await db.quizLiveSession.findUnique({
    where: { id: sessionId },
    include: { responses: { where: { studentId: student.id } } },
  });
  if (!session) return null;

  const quiz = await db.quiz.findUnique({
    where: { id: session.quizId },
    include: {
      program: true,
      questions: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!quiz || !quiz.isPublished) return null;

  const enrollment = await db.enrollment.findUnique({
    where: { studentId_programId: { studentId: student.id, programId: quiz.programId } },
  });
  if (!enrollment || !ACTIVE_ENROLLMENT_STATUSES.includes(enrollment.status as (typeof ACTIVE_ENROLLMENT_STATUSES)[number])) {
    return null;
  }

  const houseMembership = await ensureStudentHouseMembership(student.id);
  return {
    student,
    houseMembership,
    session,
    quiz,
    settings: quizSettings(quiz.meta),
    leaderboard: await getHouseLeaderboard(),
    currentQuestion: quiz.questions.find((question) => question.id === session.currentQuestionId) ?? null,
    currentResponse: session.responses.find((response) => response.questionId === session.currentQuestionId) ?? null,
  };
}

export async function getStudentLiveQuizSession(sessionId: string, studentUserId: string) {
  const student = await db.studentProfile.findUnique({
    where: { userId: studentUserId },
    select: { id: true },
  });
  if (!student) return null;

  return getStudentLiveQuizSessionByStudentId(sessionId, student.id);
}

export async function listStudentActiveLiveQuizzesByStudentId(studentId: string) {
  const enrollments = await db.enrollment.findMany({
    where: { studentId, status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } },
    select: { programId: true },
  });
  const programIds = enrollments.map((enrollment) => enrollment.programId);
  if (!programIds.length) return [];

  const quizIds = (
    await db.quiz.findMany({
      where: { isPublished: true, programId: { in: programIds } },
      select: { id: true },
    })
  ).map((quiz) => quiz.id);
  if (!quizIds.length) return [];

  const sessions = await db.quizLiveSession.findMany({
    where: {
      status: "LIVE",
      currentQuestionId: { not: null },
      quizId: { in: quizIds },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
  if (!sessions.length) return [];

  const latestSessionByQuizId = new Map<string, (typeof sessions)[number]>();
  for (const session of sessions) {
    if (!latestSessionByQuizId.has(session.quizId)) {
      latestSessionByQuizId.set(session.quizId, session);
    }
  }
  const uniqueSessions = [...latestSessionByQuizId.values()];

  const quizzes = await db.quiz.findMany({
    where: { id: { in: uniqueSessions.map((session) => session.quizId) } },
    include: { program: true },
  });
  const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));

  return uniqueSessions.map((session) => ({
    ...session,
    quiz: quizById.get(session.quizId),
  })).filter((session) => session.quiz);
}

export async function listStudentActiveLiveQuizzes(studentUserId: string) {
  const student = await db.studentProfile.findUnique({
    where: { userId: studentUserId },
    select: { id: true },
  });
  if (!student) return [];

  return listStudentActiveLiveQuizzesByStudentId(student.id);
}

export async function submitLiveQuizAnswerByStudentId(input: { sessionId: string; studentId: string; answer: string }) {
  const live = await getStudentLiveQuizSessionByStudentId(input.sessionId, input.studentId);
  if (!live) throw new Error("Live quiz is not available.");
  if (live.session.status !== "LIVE" || !live.currentQuestion || !live.session.currentQuestionStartedAt) {
    throw new Error("No live question is open right now.");
  }
  if (live.currentResponse) return live.currentResponse;

  const objective = isObjectiveQuestion(live.currentQuestion.type);
  const correctAnswer = answerKeyValue(live.currentQuestion.answerKey);
  const isCorrect = objective && correctAnswer ? normalizeAnswer(input.answer) === correctAnswer : null;
  const answeredAt = new Date();
  const secondsTaken = Math.max(0, Math.round((answeredAt.getTime() - live.session.currentQuestionStartedAt.getTime()) / 1000));
  const withinWindow = secondsTaken <= live.settings.responseWindowSeconds;
  const earnedPoints = isCorrect && withinWindow ? live.currentQuestion.points : 0;
  const currentQuestionIndex = live.quiz.questions.findIndex((question) => question.id === live.currentQuestion?.id);
  const responseByQuestionId = new Map(live.session.responses.map((response) => [response.questionId, response]));
  let consecutiveCorrectBefore = 0;
  for (let index = currentQuestionIndex - 1; index >= 0; index -= 1) {
    const previousResponse = responseByQuestionId.get(live.quiz.questions[index]?.id);
    if (!previousResponse?.isCorrect) break;
    consecutiveCorrectBefore += 1;
  }
  const streakBonusPoints = isCorrect && withinWindow && consecutiveCorrectBefore > 0 ? live.settings.streakBonusPoints : 0;
  const participationPoints = live.settings.participationPoints;
  const housePointsAwarded = earnedPoints + participationPoints + streakBonusPoints;

  const response = await db.quizLiveResponse.create({
    data: {
      sessionId: live.session.id,
      questionId: live.currentQuestion.id,
      studentId: live.student.id,
      answer: { value: input.answer, secondsTaken, withinWindow, streakBonusPoints, participationPoints },
      isCorrect,
      earnedPoints,
      housePointsAwarded,
      answeredAt,
    },
  });

  if (housePointsAwarded > 0) {
    await db.housePointLedger.create({
      data: {
        houseId: live.houseMembership.houseId,
        studentId: live.student.id,
        points: housePointsAwarded,
        reason: `${live.quiz.title}: live answer`,
        sourceType: "QUIZ_LIVE",
        sourceId: response.id,
      },
    });
  }

  return response;
}

export async function submitLiveQuizAnswer(input: { sessionId: string; studentUserId: string; answer: string }) {
  const student = await db.studentProfile.findUnique({
    where: { userId: input.studentUserId },
    select: { id: true },
  });
  if (!student) throw new Error("Live quiz is not available.");

  return submitLiveQuizAnswerByStudentId({ sessionId: input.sessionId, studentId: student.id, answer: input.answer });
}

export function liveQuizMessage(response: { isCorrect: boolean | null }) {
  if (response.isCorrect) return QUIZ_CORRECT_MESSAGE;
  if (response.isCorrect === false) return QUIZ_INCORRECT_MESSAGE;
  return QUIZ_PARTICIPATION_MESSAGE;
}
