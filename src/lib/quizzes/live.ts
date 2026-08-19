import "server-only";

import { db } from "@/lib/db";
import { getTeacherProgramRosterStudentIds } from "@/lib/live-classes/service";
import { QUIZ_AVATARS, normalizedQuizGender } from "@/lib/quizzes/avatars";
import {
  CANONICAL_HOUSES,
  QUIZ_CORRECT_MESSAGE,
  QUIZ_INCORRECT_MESSAGE,
  QUIZ_PARTICIPATION_MESSAGE,
  ensureStudentHouseMembership,
  getHouseLeaderboard,
  normalizeHouseDisplay,
} from "@/lib/community/house-points";

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"] as const;
const LIVE_QUIZ_TEACHER_STALE_MS = 45 * 1000;
const LIVE_QUIZ_FINAL_QUESTION_GRACE_MS = 15 * 1000;
let lastLiveQuizCleanupAt = 0;


type QuizMeta = {
  responseWindowSeconds?: number;
  participationPoints?: number;
  streakBonusPoints?: number;
};

function quizSettings(meta: unknown) {
  const value = meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as QuizMeta) : {};
  return {
    responseWindowSeconds: Math.max(60, Number(value.responseWindowSeconds ?? 60)),
    participationPoints: Math.max(0, Number(value.participationPoints ?? 0)),
    streakBonusPoints: Math.max(0, Number(value.streakBonusPoints ?? 5)),
  };
}

async function getLiveSessionHouseLeaderboard(sessionId: string) {
  const responses = await db.quizLiveResponse.findMany({
    where: { sessionId, housePointsAwarded: { gt: 0 } },
    select: { studentId: true, housePointsAwarded: true },
  });
  const memberships = responses.length
    ? await db.houseMembership.findMany({
        where: { studentId: { in: [...new Set(responses.map((response) => response.studentId))] } },
        include: { house: true },
      })
    : [];
  const houseByStudent = new Map(memberships.map((membership) => [membership.studentId, normalizeHouseDisplay(membership.house)]));
  const leaderboard = CANONICAL_HOUSES.map((house) => ({ ...house, id: house.slug, points: 0, entries: 0, houseIds: [] as string[] }));
  const bySlug = new Map(leaderboard.map((house) => [house.slug, house]));
  for (const response of responses) {
    const house = houseByStudent.get(response.studentId);
    if (!house) continue;
    const row = bySlug.get(house.slug);
    if (!row) continue;
    row.points += response.housePointsAwarded;
    row.entries += 1;
  }
  return leaderboard.sort((left, right) => right.points - left.points || left.sortOrder - right.sortOrder);
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
  await closeExpiredLiveQuizSessions();
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

export async function heartbeatLiveQuizSession(input: { sessionId: string; teacherUserId: string }) {
  const result = await db.quizLiveSession.updateMany({
    where: {
      id: input.sessionId,
      teacherUserId: input.teacherUserId,
      status: { in: ["WAITING", "LIVE"] },
    },
    data: { updatedAt: new Date() },
  });
  return result.count > 0;
}

export async function closeExpiredLiveQuizSessions() {
  const cleanupStartedAt = Date.now();
  if (cleanupStartedAt - lastLiveQuizCleanupAt < 5_000) return;
  lastLiveQuizCleanupAt = cleanupStartedAt;
  const now = new Date(cleanupStartedAt);
  await db.quizLiveSession.updateMany({
    where: {
      status: { in: ["WAITING", "LIVE"] },
      updatedAt: { lt: new Date(now.getTime() - LIVE_QUIZ_TEACHER_STALE_MS) },
    },
    data: { status: "ENDED", endedAt: now, currentQuestionId: null, currentQuestionStartedAt: null },
  });

  const sessions = await db.quizLiveSession.findMany({
    where: { status: "LIVE", currentQuestionId: { not: null }, currentQuestionStartedAt: { not: null } },
    select: { id: true, quizId: true, currentQuestionId: true, currentQuestionStartedAt: true },
  });
  if (!sessions.length) return;
  const quizzes = await db.quiz.findMany({
    where: { id: { in: [...new Set(sessions.map((session) => session.quizId))] } },
    select: { id: true, meta: true, questions: { orderBy: { sortOrder: "asc" }, select: { id: true } } },
  });
  const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  const completedSessionIds = sessions.filter((session) => {
    const quiz = quizById.get(session.quizId);
    const finalQuestion = quiz?.questions.at(-1);
    if (!quiz || !finalQuestion || finalQuestion.id !== session.currentQuestionId || !session.currentQuestionStartedAt) return false;
    const closesAt = session.currentQuestionStartedAt.getTime()
      + quizSettings(quiz.meta).responseWindowSeconds * 1000
      + LIVE_QUIZ_FINAL_QUESTION_GRACE_MS;
    return closesAt <= now.getTime();
  }).map((session) => session.id);
  if (completedSessionIds.length) {
    await db.quizLiveSession.updateMany({
      where: { id: { in: completedSessionIds }, status: "LIVE" },
      data: { status: "ENDED", endedAt: now, currentQuestionId: null, currentQuestionStartedAt: null },
    });
  }
}
export async function getTeacherLiveQuizSession(sessionId: string, teacherUserId: string) {
  await closeExpiredLiveQuizSessions();
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

  const teacher = await db.teacherProfile.findUnique({
    where: { userId: teacherUserId },
    select: { id: true },
  });
  if (!teacher) return null;
  const effectiveRosterStudentIds = await getTeacherProgramRosterStudentIds(teacher.id, quiz.programId);

  const rosterStudents = await db.studentProfile.findMany({
    where: {
      id: { in: effectiveRosterStudentIds },
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

  function displayHouse(student: (typeof students)[number] | undefined) {
    return student?.houseMembership?.house ? normalizeHouseDisplay(student.houseMembership.house) : null;
  }

  return {
    session,
    quiz,
    settings: quizSettings(quiz.meta),
    leaderboard: await getLiveSessionHouseLeaderboard(session.id),
    roster: students.map((student) => ({
      id: student.id,
      name: student.displayName || `${student.user.firstName} ${student.user.lastName}`.trim(),
      gender: student.registrationStudents[0]?.gender ?? null,
      houseName: displayHouse(student)?.name ?? "No house",
      houseColor: displayHouse(student)?.color ?? null,
      avatarId: student.user.avatarUrl,
    })),
    responses: session.responses.map((response) => {
      const student = studentById.get(response.studentId);
      return {
        ...response,
        studentName: student?.displayName || `${student?.user.firstName ?? "Student"} ${student?.user.lastName ?? ""}`.trim(),
        studentGender: student?.registrationStudents[0]?.gender ?? null,
        houseName: displayHouse(student)?.name ?? "No house",
        houseColor: displayHouse(student)?.color ?? null,
        avatarId: student?.user.avatarUrl ?? null,
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

  const questionIds = new Set(live.quiz.questions.map((question) => question.id));
  const correctByStudent = new Map<string, Set<string>>();
  for (const response of live.session.responses) {
    if (!response.isCorrect || !questionIds.has(response.questionId)) continue;
    const correct = correctByStudent.get(response.studentId) ?? new Set<string>();
    correct.add(response.questionId);
    correctByStudent.set(response.studentId, correct);
  }
  for (const [studentId, correctQuestions] of correctByStudent) {
    if (!questionIds.size || correctQuestions.size !== questionIds.size) continue;
    const membership = await ensureStudentHouseMembership(studentId);
    const existing = await db.housePointLedger.findFirst({
      where: { studentId, sourceType: "QUIZ_LIVE_COMPLETE", sourceId: live.quiz.id },
      select: { id: true },
    });
    if (!existing) await db.housePointLedger.create({
      data: { houseId: membership.houseId, studentId, points: 10, reason: `${live.quiz.title}: perfect quiz bonus`, sourceType: "QUIZ_LIVE_COMPLETE", sourceId: live.quiz.id },
    });
  }

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
  await closeExpiredLiveQuizSessions();
  const student = await db.studentProfile.findUnique({
    where: { id: studentId },
    include: { user: true, registrationStudents: { select: { gender: true }, orderBy: { createdAt: "desc" }, take: 1 } },
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

  const teacher = await db.teacherProfile.findUnique({
    where: { userId: session.teacherUserId },
    select: { id: true },
  });
  if (!teacher) return null;
  const effectiveRosterStudentIds = await getTeacherProgramRosterStudentIds(teacher.id, quiz.programId);
  if (!effectiveRosterStudentIds.includes(student.id)) return null;

  const enrollment = await db.enrollment.findUnique({
    where: { studentId_programId: { studentId: student.id, programId: quiz.programId } },
  });
  if (!enrollment || !ACTIVE_ENROLLMENT_STATUSES.includes(enrollment.status as (typeof ACTIVE_ENROLLMENT_STATUSES)[number])) {
    return null;
  }

  const houseMembership = await ensureStudentHouseMembership(student.id);
  return {
    student: { ...student, gender: student.registrationStudents[0]?.gender ?? null },
    houseMembership,
    session,
    quiz,
    settings: quizSettings(quiz.meta),
    leaderboard: await getLiveSessionHouseLeaderboard(session.id),
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
  await closeExpiredLiveQuizSessions();
  const [rosterRows, enrollments] = await Promise.all([
    db.teacherStudentRoster.findMany({
      where: { studentId },
      select: { teacherId: true, programId: true, teacher: { select: { userId: true } } },
    }),
    db.enrollment.findMany({
      where: { studentId, status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } },
      select: { programId: true },
    }),
  ]);
  const enrolledProgramIds = [...new Set(enrollments.map((entry) => entry.programId))];
  const assignedTeachers = enrolledProgramIds.length
    ? await db.teacherProgram.findMany({
        where: { programId: { in: enrolledProgramIds } },
        select: { teacherId: true, programId: true, teacher: { select: { userId: true } } },
      })
    : [];
  const candidatePairs = new Map(
    [...rosterRows, ...assignedTeachers].map((row) => [row.teacherId + ":" + row.programId, row]),
  );
  const allowedPairRows = (
    await Promise.all(
      [...candidatePairs.values()].map(async (row) => ({
        row,
        studentIds: await getTeacherProgramRosterStudentIds(row.teacherId, row.programId),
      })),
    )
  ).filter(({ studentIds }) => studentIds.includes(studentId));
  if (!allowedPairRows.length) return [];

  const allowedPairs = new Set(allowedPairRows.map(({ row }) => row.teacher.userId + ":" + row.programId));
  const programIds = [...new Set(allowedPairRows.map(({ row }) => row.programId))];
  const quizzes = await db.quiz.findMany({
    where: { isPublished: true, programId: { in: programIds } },
    include: { program: true },
  });
  if (!quizzes.length) return [];
  const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));

  const sessions = await db.quizLiveSession.findMany({
    where: {
      status: "LIVE",
      currentQuestionId: { not: null },
      quizId: { in: quizzes.map((quiz) => quiz.id) },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
  });
  const eligibleSessions = sessions.filter((session) => {
    const quiz = quizById.get(session.quizId);
    return quiz && allowedPairs.has(session.teacherUserId + ":" + quiz.programId);
  });
  if (!eligibleSessions.length) return [];

  const latestSessionByQuizId = new Map<string, (typeof sessions)[number]>();
  for (const session of eligibleSessions) {
    if (!latestSessionByQuizId.has(session.quizId)) latestSessionByQuizId.set(session.quizId, session);
  }

  return [...latestSessionByQuizId.values()]
    .map((session) => ({ ...session, quiz: quizById.get(session.quizId) }))
    .filter((session) => session.quiz);
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
  if (live.currentResponse) {
    throw new Error("You have already submitted an answer for this question.");
  }

  const objective = isObjectiveQuestion(live.currentQuestion.type);
  const correctAnswer = answerKeyValue(live.currentQuestion.answerKey);
  const isCorrect = objective && correctAnswer ? normalizeAnswer(input.answer) === correctAnswer : null;
  const answeredAt = new Date();
  const secondsTaken = Math.max(0, Math.round((answeredAt.getTime() - live.session.currentQuestionStartedAt.getTime()) / 1000));
  const withinWindow = secondsTaken <= live.settings.responseWindowSeconds + 3;
  if (!withinWindow) throw new Error("This question has closed. Wait for the next round.");
  const earnedPoints = isCorrect ? live.currentQuestion.points : 0;
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
  // Live team score is separate from the child's permanent house points.
  const housePointsAwarded = isCorrect ? 1 : 0;

  try {
    return await db.$transaction(async (tx) => {
      const response = await tx.quizLiveResponse.create({
        data: {
          sessionId: live.session.id,
          questionId: live.currentQuestion!.id,
          studentId: live.student.id,
          answer: { value: input.answer, secondsTaken, withinWindow, streakBonusPoints, participationPoints },
          isCorrect,
          earnedPoints,
          housePointsAwarded,
          answeredAt,
        },
      });

      if (housePointsAwarded > 0) {
        await tx.housePointLedger.create({
          data: {
            houseId: live.houseMembership.houseId,
            studentId: live.student.id,
            points: 1,
            reason: `${live.quiz.title}: correct live answer (+1 team point)`,
            sourceType: "QUIZ_LIVE_ANSWER",
            sourceId: response.id,
          },
        });
      }
      return response;
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      const existing = await db.quizLiveResponse.findUnique({
        where: {
          sessionId_questionId_studentId: {
            sessionId: live.session.id,
            questionId: live.currentQuestion.id,
            studentId: live.student.id,
          },
        },
      });
      if (existing) return existing;
    }
    throw error;
  }
}

export async function submitLiveQuizAnswer(input: { sessionId: string; studentUserId: string; answer: string }) {
  const student = await db.studentProfile.findUnique({
    where: { userId: input.studentUserId },
    select: { id: true },
  });
  if (!student) throw new Error("Live quiz is not available.");

  return submitLiveQuizAnswerByStudentId({ sessionId: input.sessionId, studentId: student.id, answer: input.answer });
}

export async function selectStudentQuizAvatar(input: { studentId: string; avatarId: string }) {
  const avatar = QUIZ_AVATARS.find((item) => item.id === input.avatarId);
  if (!avatar) throw new Error("Choose a valid Gen-Mumin character.");
  const student = await db.studentProfile.findUnique({
    where: { id: input.studentId },
    include: { registrationStudents: { select: { gender: true }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!student) throw new Error("Student profile not found.");
  if (avatar.gender !== normalizedQuizGender(student.registrationStudents[0]?.gender)) {
    throw new Error("Choose a character from your child avatar collection.");
  }
  const claimed = await db.user.findFirst({
    where: { avatarUrl: avatar.id, studentProfile: { isNot: { id: student.id } } },
    select: { id: true },
  });
  if (claimed) throw new Error("That character is already chosen. Pick another exclusive avatar.");
  await db.user.update({ where: { id: student.userId }, data: { avatarUrl: avatar.id } });
  return avatar;
}

export async function selectStudentQuizAvatarByUserId(input: { studentUserId: string; avatarId: string }) {
  const student = await db.studentProfile.findUnique({ where: { userId: input.studentUserId }, select: { id: true } });
  if (!student) throw new Error("Student profile not found.");
  return selectStudentQuizAvatar({ studentId: student.id, avatarId: input.avatarId });
}
export function liveQuizMessage(response: { isCorrect: boolean | null }) {
  if (response.isCorrect) return QUIZ_CORRECT_MESSAGE;
  if (response.isCorrect === false) return QUIZ_INCORRECT_MESSAGE;
  return QUIZ_PARTICIPATION_MESSAGE;
}
