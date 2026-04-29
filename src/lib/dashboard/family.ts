import "server-only";

import { PaymentStatus, SubmissionStatus, UserRole } from "@prisma/client";

import { db } from "@/lib/db";
import {
  genMCoreOutcomes,
  genMPolicies,
  genMProgrammeSchedule,
  genMTerms,
  getGenMProgrammeByTitle,
  getGenMTeachersForProgramme,
} from "@/lib/genm/curriculum";
import { parseLessonPayload, parseTaskPayload } from "@/lib/genm/published-content";

type ChildCourseSummary = {
  id: string;
  title: string;
  status: string;
  startedAt: Date | null;
  meetingCount: number;
  strapline: string | null;
  description: string | null;
  outcomes: string[];
  uploadIdeas: string[];
  keyMaterials: string[];
  weeklyFlow: string[];
  focusTerms: string[];
  weeklySchedule: string[];
  wholePlanOutcomes: string[];
  policies: string[];
  termPlans: Array<{
    id: string;
    title: string;
    window: string;
    level: string;
    highlights: string[];
  }>;
  teachers: Array<{
    name: string;
    title: string;
    credential: string;
    bio: string;
    dummyEmail: string;
    specialties: string[];
  }>;
  recentLessonTopics: string[];
  currentTaskTitles: string[];
};

type ChildScheduleSummary = {
  id: string;
  title: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
  meetingUrl: string | null;
  teacherName: string | null;
  provider: string | null;
};

type ChildQuizSummary = {
  id: string;
  title: string;
  type: string;
  questionCount: number;
  totalPoints: number;
  timeLimitSeconds: number | null;
  bestScore: number | null;
  latestScore: number | null;
  latestSubmittedAt: Date | null;
  attempts: Array<{
    id: string;
    attemptNumber: number;
    score: number | null;
    submittedAt: Date | null;
    feedback: string | null;
  }>;
};

type ChildAssignmentSummary = {
  id: string;
  programTitle: string;
  title: string;
  instructions: string | null;
  resourceLinks: string[];
  evidenceMode: string | null;
  weekLabel: string | null;
  termId: string | null;
  familyNote: string | null;
  dueDate: Date | null;
  status: SubmissionStatus | "NOT_STARTED";
  grade: string | null;
  score: number | null;
  feedback: string | null;
  submittedAt: Date | null;
};

type ChildLessonUpdateSummary = {
  id: string;
  programTitle: string;
  scheduleTitle: string;
  lessonDate: Date;
  topic: string;
  summary: string;
  homework: string | null;
  teacherName: string | null;
  resourceLinks: string[];
  parentPrompt: string | null;
  weekLabel: string | null;
  termId: string | null;
  contentType: string | null;
  materials: string | null;
};

type ChildBadgeSummary = {
  id: string;
  title: string;
  status: "earned" | "progress";
  description: string;
};

type ChildProgressSummary = {
  id: string;
  programTitle: string;
  reportPeriod: string;
  attendancePct: number | null;
  grade: string | null;
  strengths: string | null;
  nextSteps: string | null;
};

type JournalRatingSummary = {
  trait: number;
  skill: number;
  pronunciation: number;
  fluency: number;
  confidence: number;
  initiative: number;
  responsibility: number;
  teamContribution: number;
};

type JournalTemplateSummary = {
  weekLabel: string;
  theme: string;
  traitFocus: string;
  traitPractice: string;
  traitMoment: string;
  traitChallenge: string;
  lifeSkillFocus: string;
  lifeSkillDemonstration: string;
  evidenceOption: string;
  arabicPhrase: string;
  arabicUsage: string;
  tajweedFocus: string;
  leadershipRole: string;
  leadershipExample: string;
  growthStrength: string;
  growthImprove: string;
  growthNextFocus: string;
  encouragement: string;
  teacherObservation: string | null;
  ratingSummary: JournalRatingSummary;
};

type ChildJournalSummary = {
  id: string;
  title: string;
  reflection: string;
  practiceMinutes: number;
  selfRating: string | null;
  teacherFeedback: string | null;
  status: SubmissionStatus;
  submittedAt: Date;
  template: JournalTemplateSummary;
};

type ChildJournalMonthlySummary = {
  mostConsistentTrait: string;
  strongestSkillArea: string;
  arabicFluencyTrend: string;
  leadershipDevelopmentScore: number;
  teacherSummary: string;
};

type ChildSummary = {
  id: string;
  name: string;
  statusLabel: string;
  accessLocked: boolean;
  attendanceRate: number;
  attendanceBreakdown: Array<{ label: string; value: number }>;
  courses: ChildCourseSummary[];
  schedule: ChildScheduleSummary[];
  nextClass: ChildScheduleSummary | null;
  quizzes: ChildQuizSummary[];
  assignments: ChildAssignmentSummary[];
  lessonUpdates: ChildLessonUpdateSummary[];
  badges: ChildBadgeSummary[];
  progress: ChildProgressSummary[];
  journals: ChildJournalSummary[];
  journalMonthlySummary: ChildJournalMonthlySummary;
  profile: {
    displayName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    timezone: string | null;
    countryName: string | null;
    age: number | null;
    currentGrade: string | null;
  };
};

export type ParentDashboardData = {
  parentName: string;
  parentProfile: {
    email: string;
    phone: string | null;
    phoneCountryCode: string | null;
    phoneNumber: string | null;
    billingCountryCode: string | null;
    billingCountryName: string | null;
    preferredCurrency: string | null;
  };
  accessLocked: boolean;
  accessStateLabel: string;
  pendingReason: string | null;
  latestOrder: {
    orderNumber: string;
    status: PaymentStatus;
    totalAmount: number;
    currency: string;
    gateway: string;
  } | null;
  children: ChildSummary[];
};

export type StudentDashboardData = {
  studentName: string;
  accessLocked: boolean;
  accessStateLabel: string;
  pendingReason: string | null;
  child: ChildSummary;
};

function formatAccessState(accessLocked: boolean) {
  return accessLocked ? "Pending activation" : "Learning unlocked";
}

function resolvePendingReason(orderStatus?: PaymentStatus | null, gateway?: string | null) {
  if (!orderStatus) {
    return "Complete enrollment and payment to unlock the learning workspace.";
  }

  if (gateway === "BANK_TRANSFER" && orderStatus === "UNDER_REVIEW") {
    return "Your manual payment proof is under review. Courses will unlock after admin confirmation.";
  }

  if (orderStatus === "PENDING" || orderStatus === "INITIATED") {
    return "Finish the subscription checkout to unlock classes, quizzes, assignments, and schedule access.";
  }

  if (orderStatus === "REQUIRES_ACTION") {
    return "Your payment needs one more action before the dashboard can unlock.";
  }

  return "Your enrollment is being prepared. Please check back shortly.";
}

const JOURNAL_PREFIX = "__GENM_JOURNAL__:";

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function clampRating(value: unknown, fallback = 3) {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(5, Math.max(1, Math.round(numeric)));
}

function averageRating(values: number[]) {
  if (!values.length) {
    return 3;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function toGradeLevel(score: number) {
  if (score >= 5) return "EXCELLENT";
  if (score >= 4) return "GOOD";
  if (score >= 3) return "SATISFACTORY";
  return "NEEDS_IMPROVEMENT";
}

function buildFallbackTemplate(entry: {
  title: string;
  reflection: string;
  practiceMinutes: number;
  selfRating: string | null;
  teacherFeedback: string | null;
}): JournalTemplateSummary {
  const baseRating =
    entry.selfRating === "EXCELLENT"
      ? 5
      : entry.selfRating === "GOOD"
        ? 4
        : entry.selfRating === "SATISFACTORY"
          ? 3
          : 2;

  return {
    weekLabel: entry.title || "Weekly journal",
    theme: "Weekly reflection",
    traitFocus: "Islamic character",
    traitPractice: entry.reflection,
    traitMoment: "Shared in the weekly reflection.",
    traitChallenge: "Continue building consistency through regular journaling.",
    lifeSkillFocus: "Weekly task completion",
    lifeSkillDemonstration: `Practice time logged: ${entry.practiceMinutes} minutes.`,
    evidenceOption: "Verbal explanation",
    arabicPhrase: "Arabic phrase work in progress",
    arabicUsage: "The learner can continue building this through weekly practice.",
    tajweedFocus: "Teacher-led recitation focus",
    leadershipRole: "Initiative role",
    leadershipExample: "Leadership examples will grow as more weekly journals are submitted.",
    growthStrength: entry.selfRating ? `Current self-rating: ${entry.selfRating.replace(/_/g, " ")}` : "Steady weekly reflection habits.",
    growthImprove: "Keep adding specific examples from class and home.",
    growthNextFocus: "Build confidence through consistent task completion and journaling.",
    encouragement: entry.teacherFeedback ?? "Keep showing up each week. Small wins build strong habits.",
    teacherObservation: entry.teacherFeedback,
    ratingSummary: {
      trait: baseRating,
      skill: baseRating,
      pronunciation: baseRating,
      fluency: baseRating,
      confidence: baseRating,
      initiative: baseRating,
      responsibility: baseRating,
      teamContribution: baseRating,
    },
  };
}

function parseJournalTemplate(entry: {
  title: string;
  reflection: string;
  practiceMinutes: number;
  selfRating: string | null;
  teacherFeedback: string | null;
}) {
  if (!entry.reflection.startsWith(JOURNAL_PREFIX)) {
    return buildFallbackTemplate(entry);
  }

  const payload = parseJson<Record<string, unknown>>(entry.reflection.slice(JOURNAL_PREFIX.length));

  if (!payload) {
    return buildFallbackTemplate(entry);
  }

  return {
    weekLabel: String(payload.weekLabel ?? entry.title ?? "Weekly journal"),
    theme: String(payload.theme ?? "Weekly growth"),
    traitFocus: String(payload.traitFocus ?? "Islamic character"),
    traitPractice: String(payload.traitPractice ?? ""),
    traitMoment: String(payload.traitMoment ?? ""),
    traitChallenge: String(payload.traitChallenge ?? ""),
    lifeSkillFocus: String(payload.lifeSkillFocus ?? "Weekly task"),
    lifeSkillDemonstration: String(payload.lifeSkillDemonstration ?? ""),
    evidenceOption: String(payload.evidenceOption ?? "Verbal explanation"),
    arabicPhrase: String(payload.arabicPhrase ?? "Arabic phrase work"),
    arabicUsage: String(payload.arabicUsage ?? ""),
    tajweedFocus: String(payload.tajweedFocus ?? "Teacher recitation focus"),
    leadershipRole: String(payload.leadershipRole ?? "Initiative role"),
    leadershipExample: String(payload.leadershipExample ?? ""),
    growthStrength: String(payload.growthStrength ?? "Steady weekly reflection habits."),
    growthImprove: String(payload.growthImprove ?? "Continue building consistency."),
    growthNextFocus: String(payload.growthNextFocus ?? "Carry this week's learning into next week."),
    encouragement: String(
      payload.encouragement ??
        entry.teacherFeedback ??
        "Keep growing with steady effort and weekly reflection.",
    ),
    teacherObservation:
      typeof payload.teacherObservation === "string"
        ? payload.teacherObservation
        : entry.teacherFeedback,
    ratingSummary: {
      trait: clampRating(payload.traitRating),
      skill: clampRating(payload.skillRating),
      pronunciation: clampRating(payload.pronunciationRating),
      fluency: clampRating(payload.fluencyRating),
      confidence: clampRating(payload.confidenceRating),
      initiative: clampRating(payload.initiativeRating),
      responsibility: clampRating(payload.responsibilityRating),
      teamContribution: clampRating(payload.teamContributionRating),
    },
  } satisfies JournalTemplateSummary;
}

function buildJournalMonthlySummary(journals: ChildJournalSummary[]): ChildJournalMonthlySummary {
  if (!journals.length) {
    return {
      mostConsistentTrait: "Weekly journals will surface the strongest trait here.",
      strongestSkillArea: "Life skills and task completion will build over time.",
      arabicFluencyTrend: "Arabic fluency trend will appear after journal activity begins.",
      leadershipDevelopmentScore: 0,
      teacherSummary: "Teacher weekly encouragement will appear here after the first journal cycle.",
    };
  }

  const recent = journals.slice(0, 4);
  const traitCounts = new Map<string, number>();
  const skillCounts = new Map<string, number>();

  for (const journal of recent) {
    traitCounts.set(
      journal.template.traitFocus,
      (traitCounts.get(journal.template.traitFocus) ?? 0) + 1,
    );
    skillCounts.set(
      journal.template.lifeSkillFocus,
      (skillCounts.get(journal.template.lifeSkillFocus) ?? 0) + 1,
    );
  }

  const [mostConsistentTrait] =
    [...traitCounts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];
  const [strongestSkillArea] =
    [...skillCounts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];

  const averageFluency = averageRating(recent.map((journal) => journal.template.ratingSummary.fluency));
  const leadershipDevelopmentScore = averageRating(
    recent.flatMap((journal) => [
      journal.template.ratingSummary.initiative,
      journal.template.ratingSummary.responsibility,
      journal.template.ratingSummary.teamContribution,
    ]),
  );

  const lastTeacherVoice =
    recent.find((journal) => journal.teacherFeedback || journal.template.encouragement)?.teacherFeedback ??
    recent[0]?.template.encouragement ??
    "Keep building weekly habits with sincerity and consistency.";

  return {
    mostConsistentTrait: mostConsistentTrait ?? "Character growth is still being mapped.",
    strongestSkillArea: strongestSkillArea ?? "Life skill growth is still being mapped.",
    arabicFluencyTrend:
      averageFluency >= 4
        ? "Arabic fluency is trending strongly this month."
        : averageFluency >= 3
          ? "Arabic fluency is developing steadily this month."
          : "Arabic fluency needs a little more weekly repetition this month.",
    leadershipDevelopmentScore,
    teacherSummary: lastTeacherVoice,
  };
}

function computeAttendanceBreakdown(attendances: Array<{ status: string }>, totalEnrollments: number) {
  const breakdown = {
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0,
    EXCUSED: 0,
  };

  for (const attendance of attendances) {
    if (attendance.status in breakdown) {
      breakdown[attendance.status as keyof typeof breakdown] += 1;
    }
  }

  const totalRecords = attendances.length || totalEnrollments || 1;
  const attendanceRate = Math.round((breakdown.PRESENT / totalRecords) * 100);

  return {
    attendanceRate,
    attendanceBreakdown: [
      { label: "Present", value: breakdown.PRESENT },
      { label: "Late", value: breakdown.LATE },
      { label: "Absent", value: breakdown.ABSENT },
      { label: "Excused", value: breakdown.EXCUSED },
    ],
  };
}

function buildTeacherName(
  teacher?: { user?: { firstName: string; lastName: string } | null } | null,
) {
  if (!teacher?.user) {
    return null;
  }

  return `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
}

function normalizeChildIdentity(input: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  age?: number | null;
  countryName?: string | null;
}) {
  const baseName =
    input.displayName?.trim() ||
    [input.firstName, input.lastName].filter(Boolean).join(" ").trim();

  return [
    baseName.toLowerCase().replace(/\s+/g, " "),
    input.age ?? "",
    (input.countryName ?? "").toLowerCase(),
  ].join("|");
}

function childPriorityScore(student: any) {
  return (
    (student.enrollments?.length ?? 0) * 20 +
    (student.progressReports?.length ?? 0) * 6 +
    (student.journalEntries?.length ?? 0) * 5 +
    (student.quizAttempts?.length ?? 0) * 3 +
    (student.attendances?.length ?? 0) * 2
  );
}

function dedupeParentStudents(relations: Array<{ student: any }>) {
  const grouped = new Map<string, any>();

  for (const relation of relations) {
    const student = relation.student;
    const key = normalizeChildIdentity({
      displayName: student.displayName,
      firstName: student.user?.firstName,
      lastName: student.user?.lastName,
      age: student.age,
      countryName: student.countryName,
    });
    const existing = grouped.get(key);

    if (!existing || childPriorityScore(student) > childPriorityScore(existing)) {
      grouped.set(key, student);
    }
  }

  return [...grouped.values()];
}

function mapScheduleEntries(enrollments: any[]): ChildScheduleSummary[] {
  return enrollments
    .flatMap((enrollment) =>
      enrollment.program.schedules.map((schedule: any) => ({
        id: schedule.id,
        title: enrollment.program.title,
        weekday: schedule.weekday,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        timezone: schedule.timezone,
        meetingUrl: schedule.meetingUrl,
        teacherName: buildTeacherName(schedule.teacher),
        provider: schedule.meetingProvider,
      })),
    )
    .sort((left, right) => {
      if (left.weekday !== right.weekday) {
        return left.weekday - right.weekday;
      }

      return left.startTime.localeCompare(right.startTime);
    });
}

function mapQuizSummaries(quizzes: any[], quizAttempts: any[]) {
  return quizzes.map((quiz) => {
    const attempts = quizAttempts
      .filter((attempt) => attempt.quizId === quiz.id)
      .sort((left, right) => right.attemptNumber - left.attemptNumber);

    const scores = attempts
      .map((attempt) => attempt.manualScore ?? attempt.autoScore)
      .filter((score): score is number => score !== null && score !== undefined);

    return {
      id: quiz.id,
      title: quiz.title,
      type: quiz.type.replace(/_/g, " "),
      questionCount: quiz.questions.length,
      totalPoints: quiz.questions.reduce((total: number, question: any) => total + question.points, 0),
      timeLimitSeconds: quiz.timeLimitSeconds,
      bestScore: scores.length ? Math.max(...scores) : null,
      latestScore: attempts[0] ? attempts[0].manualScore ?? attempts[0].autoScore ?? null : null,
      latestSubmittedAt: attempts[0]?.submittedAt ?? null,
      attempts: attempts.slice(0, 5).map((attempt) => ({
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        score: attempt.manualScore ?? attempt.autoScore ?? null,
        submittedAt: attempt.submittedAt,
        feedback: attempt.feedback,
      })),
    } satisfies ChildQuizSummary;
  });
}

function mapAssignmentSummaries(enrollments: any[], submissions: any[]) {
  const assignments = enrollments.flatMap((enrollment) =>
    enrollment.program.assignments.map((assignment: any) => {
      const submission = submissions.find((entry) => entry.assignmentId === assignment.id) ?? null;
      const parsedInstructions = parseTaskPayload(assignment.instructions ?? null);

      return {
        id: assignment.id,
        programTitle: enrollment.program.title,
        title: assignment.title,
        instructions: parsedInstructions.instructions,
        resourceLinks: parsedInstructions.resourceLinks,
        evidenceMode: parsedInstructions.evidenceMode,
        weekLabel: parsedInstructions.weekLabel,
        termId: parsedInstructions.termId,
        familyNote: parsedInstructions.familyNote,
        dueDate: assignment.dueDate,
        status: submission?.status ?? "NOT_STARTED",
        grade: submission?.grade ?? null,
        score: submission?.score ?? null,
        feedback: submission?.feedback ?? null,
        submittedAt: submission?.submittedAt ?? null,
      } satisfies ChildAssignmentSummary;
    }),
  );

  return assignments.sort((left, right) => {
    if (left.dueDate && right.dueDate) {
      return left.dueDate.getTime() - right.dueDate.getTime();
    }

    if (left.dueDate) return -1;
    if (right.dueDate) return 1;
    return left.title.localeCompare(right.title);
  });
}

function mapLessonUpdates(enrollments: any[]) {
  return enrollments
    .flatMap((enrollment) =>
      enrollment.program.schedules.flatMap((schedule: any) =>
        (schedule.lessonLogs ?? []).map((log: any) => {
          const parsedSummary = parseLessonPayload(log.summary, log.homework ?? null);

          return {
            id: log.id,
            programTitle: enrollment.program.title,
            scheduleTitle: schedule.title,
            lessonDate: log.lessonDate,
            topic: parsedSummary.topic || log.topic,
            summary: parsedSummary.summary,
            homework: parsedSummary.homework,
            teacherName: buildTeacherName(schedule.teacher),
            resourceLinks: parsedSummary.resourceLinks,
            parentPrompt: parsedSummary.parentPrompt,
            weekLabel: parsedSummary.weekLabel,
            termId: parsedSummary.termId,
            contentType: parsedSummary.contentType,
            materials: parsedSummary.materials,
          };
        }),
      ),
    )
    .sort((left, right) => right.lessonDate.getTime() - left.lessonDate.getTime())
    .slice(0, 8) satisfies ChildLessonUpdateSummary[];
}

function buildChildBadges({
  attendanceRate,
  quizCount,
  submittedAssignments,
  journals,
}: {
  attendanceRate: number;
  quizCount: number;
  submittedAssignments: number;
  journals: ChildJournalSummary[];
}) {
  const badges: ChildBadgeSummary[] = [];
  const averageLeadership = averageRating(
    journals.flatMap((journal) => [
      journal.template.ratingSummary.initiative,
      journal.template.ratingSummary.responsibility,
      journal.template.ratingSummary.teamContribution,
    ]),
  );
  const averagePronunciation = averageRating(
    journals.flatMap((journal) => [
      journal.template.ratingSummary.pronunciation,
      journal.template.ratingSummary.fluency,
      journal.template.ratingSummary.confidence,
    ]),
  );
  const averageTrait = averageRating(journals.map((journal) => journal.template.ratingSummary.trait));
  const strongestSkill =
    journals[0]?.template.lifeSkillFocus &&
    journals[0].template.lifeSkillFocus !== "Weekly task"
      ? journals[0].template.lifeSkillFocus
      : "Weekly task growth";

  badges.push({
    id: "attendance",
    title: attendanceRate >= 90 ? "Attendance Star" : "Attendance Journey",
    status: attendanceRate >= 90 ? "earned" : "progress",
    description:
      attendanceRate >= 90
        ? "Excellent consistency in joining lessons on time."
        : `Current attendance is ${attendanceRate}%. Keep showing up and this badge can unlock soon.`,
  });

  badges.push({
    id: "tasks",
    title: submittedAssignments >= 3 ? "Task Champion" : "Task Builder",
    status: submittedAssignments >= 3 ? "earned" : "progress",
    description:
      submittedAssignments >= 3
        ? "Weekly tasks are being completed consistently."
        : `${submittedAssignments} task submissions recorded so far. More regular submissions will unlock this badge.`,
  });

  badges.push({
    id: "reflection",
    title: journals.length >= 2 && averageTrait >= 4 ? "Patience Badge" : "Reflection Gem",
    status: journals.length >= 2 ? "earned" : "progress",
    description:
      journals.length >= 2
        ? "Weekly reflections are creating visible character growth."
        : "Journal entries and self-reflection will turn into visible recognition here.",
  });

  badges.push({
    id: "assessment",
    title: quizCount >= 2 ? "Quiz Explorer" : "Quiz Warm-up",
    status: quizCount >= 2 ? "earned" : "progress",
    description:
      quizCount >= 2
        ? "Assessment activity is active and developing nicely."
        : "As quizzes and lesson checks are completed, assessment badges will appear here.",
  });

  badges.push({
    id: "tajweed",
    title: averagePronunciation >= 4 ? "Tajweed Star" : "Arabic Voice Builder",
    status: journals.length > 0 && averagePronunciation >= 4 ? "earned" : "progress",
    description:
      journals.length > 0
        ? "Arabic phrase confidence and recitation quality are being tracked through the weekly journal."
        : "Arabic phrase and tajweed badges will appear once weekly journal entries begin.",
  });

  badges.push({
    id: "leadership",
    title: averageLeadership >= 4 ? "Leadership Chain Badge" : "Leadership Path",
    status: journals.length > 0 && averageLeadership >= 4 ? "earned" : "progress",
    description:
      journals.length > 0
        ? "Leadership roles, initiative, and team contribution are now visible to families."
        : "Leadership recognition will unlock as weekly journals capture class participation.",
  });

  badges.push({
    id: "skill",
    title: strongestSkill.toLowerCase().includes("first aid") ? "First Aid Badge" : "Skill Builder Badge",
    status: journals.length > 0 ? "earned" : "progress",
    description: `Current skill focus: ${strongestSkill}.`,
  });

  return badges;
}

function mapChildSummary(child: any, accessLocked: boolean): ChildSummary {
  const { attendanceRate, attendanceBreakdown } = computeAttendanceBreakdown(
    child.attendances,
    child.enrollments.length,
  );

  const schedule = mapScheduleEntries(child.enrollments);
  const programQuizzes = child.enrollments.flatMap((enrollment: any) => enrollment.program.quizzes);
  const quizzes = mapQuizSummaries(programQuizzes, child.quizAttempts);
  const assignments = mapAssignmentSummaries(child.enrollments, child.assignments);
  const lessonUpdates = mapLessonUpdates(child.enrollments);
  const journals = child.journalEntries.map((entry: any) => ({
    id: entry.id,
    title: entry.title,
    reflection: entry.reflection,
    practiceMinutes: entry.practiceMinutes,
    selfRating: entry.selfRating,
    teacherFeedback: entry.teacherFeedback,
    status: entry.status,
    submittedAt: entry.submittedAt,
    template: parseJournalTemplate(entry),
  })) satisfies ChildJournalSummary[];
  const journalMonthlySummary = buildJournalMonthlySummary(journals);
  const submittedAssignments = assignments.filter((assignment) =>
    assignment.status === "SUBMITTED" || assignment.status === "REVIEWED",
  ).length;
  const badges = buildChildBadges({
    attendanceRate,
    quizCount: quizzes.filter((quiz) => quiz.attempts.length > 0).length,
    submittedAssignments,
    journals,
  });

  return {
    id: child.id,
    name:
      child.displayName ||
      `${child.user.firstName} ${child.user.lastName}`.trim() ||
      child.user.firstName,
    statusLabel: accessLocked
      ? "Pending payment confirmation"
      : child.enrollments.some((enrollment: any) => enrollment.status === "ACTIVE")
        ? "Active learner"
        : "Ready",
    accessLocked,
    attendanceRate,
    attendanceBreakdown,
    courses: child.enrollments.map((enrollment: any) => ({
      id: enrollment.id,
      title: enrollment.program.title,
      status: enrollment.status.replace(/_/g, " "),
      startedAt: enrollment.startedAt,
      meetingCount: enrollment.program.schedules.length,
      strapline: getGenMProgrammeByTitle(enrollment.program.title)?.strapline ?? null,
      description: getGenMProgrammeByTitle(enrollment.program.title)?.description ?? null,
      outcomes: getGenMProgrammeByTitle(enrollment.program.title)?.outcomes ?? [],
      uploadIdeas: getGenMProgrammeByTitle(enrollment.program.title)?.uploadIdeas ?? [],
      keyMaterials: getGenMProgrammeByTitle(enrollment.program.title)?.keyMaterials ?? [],
      weeklyFlow: getGenMProgrammeByTitle(enrollment.program.title)?.weeklyFlow ?? [],
      focusTerms: getGenMProgrammeByTitle(enrollment.program.title)?.focusTerms ?? [],
      weeklySchedule: genMProgrammeSchedule,
      wholePlanOutcomes: genMCoreOutcomes,
      policies: genMPolicies,
      termPlans: genMTerms.map((term) => ({
        id: term.id,
        title: term.title,
        window: term.window,
        level: term.level,
        highlights: term.highlights,
      })),
      teachers: getGenMTeachersForProgramme(enrollment.program.title).map((teacher) => ({
        name: teacher.name,
        title: teacher.title,
        credential: teacher.credential,
        bio: teacher.bio,
        dummyEmail: teacher.dummyEmail,
        specialties: teacher.specialties,
      })),
      recentLessonTopics: lessonUpdates
        .filter((update) => update.programTitle === enrollment.program.title)
        .slice(0, 4)
        .map((update) => update.topic),
      currentTaskTitles: assignments
        .filter((assignment) => assignment.programTitle === enrollment.program.title)
        .slice(0, 4)
        .map((assignment) => assignment.title),
    })),
    schedule,
    nextClass: schedule[0] ?? null,
    quizzes,
    assignments,
    lessonUpdates,
    badges,
    progress: child.progressReports.map((report: any) => ({
      id: report.id,
      programTitle: report.program.title,
      reportPeriod: report.reportPeriod,
      attendancePct: report.attendancePct,
      grade: report.grade,
      strengths: report.strengths,
      nextSteps: report.nextSteps,
    })),
    journals,
    journalMonthlySummary,
    profile: {
      displayName:
        child.displayName ||
        `${child.user.firstName} ${child.user.lastName}`.trim() ||
        child.user.firstName,
      firstName: child.user.firstName,
      lastName: child.user.lastName,
      email: child.user.email,
      phone:
        child.user.phoneCountryCode && child.user.phoneNumber
          ? `${child.user.phoneCountryCode} ${child.user.phoneNumber}`
          : child.user.phoneNumber ?? null,
      timezone: child.user.timezone,
      countryName: child.countryName,
      age: child.age,
      currentGrade: child.currentGrade,
    },
  };
}

async function getParentProfile(userId: string) {
  return db.parentProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          payments: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      students: {
        include: {
          student: {
            include: {
              user: true,
              enrollments: {
                orderBy: { createdAt: "desc" },
                include: {
                  program: {
                    include: {
                      schedules: {
                        orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
                        include: {
                          teacher: {
                            include: {
                              user: true,
                            },
                          },
                          lessonLogs: {
                            orderBy: { lessonDate: "desc" },
                            take: 6,
                          },
                        },
                      },
                      quizzes: {
                        where: { isPublished: true },
                        include: {
                          questions: {
                            orderBy: { sortOrder: "asc" },
                          },
                        },
                      },
                      assignments: {
                        orderBy: { dueDate: "asc" },
                      },
                    },
                  },
                },
              },
              attendances: {
                orderBy: { lessonDate: "desc" },
                take: 18,
              },
              quizAttempts: {
                orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
                take: 20,
                include: {
                  quiz: true,
                },
              },
              assignments: {
                orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
                take: 20,
              },
              journalEntries: {
                orderBy: { submittedAt: "desc" },
                take: 8,
              },
              progressReports: {
                orderBy: { updatedAt: "desc" },
                take: 8,
                include: {
                  program: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function getParentDashboardData(userId: string) {
  const parentProfile = await getParentProfile(userId);

  if (!parentProfile) {
    return null;
  }

  const latestOrder = parentProfile.orders[0] ?? null;
  const hasUnlockedAccess = parentProfile.students.some(({ student }) =>
    student.enrollments.some((enrollment) =>
      ["ACTIVE", "COMPLETED", "CONFIRMED"].includes(enrollment.status),
    ),
  );

  const accessLocked = !hasUnlockedAccess && (!!latestOrder || parentProfile.students.length > 0);
  const pendingReason = accessLocked
    ? resolvePendingReason(latestOrder?.status, latestOrder?.gateway ?? null)
    : null;

  return {
    parentName: `${parentProfile.user.firstName} ${parentProfile.user.lastName}`.trim(),
    parentProfile: {
      email: parentProfile.user.email,
      phone:
        parentProfile.user.phoneCountryCode && parentProfile.user.phoneNumber
          ? `${parentProfile.user.phoneCountryCode} ${parentProfile.user.phoneNumber}`
          : parentProfile.user.phoneNumber ?? null,
      phoneCountryCode: parentProfile.user.phoneCountryCode,
      phoneNumber: parentProfile.user.phoneNumber,
      billingCountryCode: parentProfile.billingCountryCode,
      billingCountryName: parentProfile.billingCountryName,
      preferredCurrency: parentProfile.preferredCurrency,
    },
    accessLocked,
    accessStateLabel: formatAccessState(accessLocked),
    pendingReason,
    latestOrder: latestOrder
      ? {
          orderNumber: latestOrder.orderNumber,
          status: latestOrder.status,
          totalAmount: latestOrder.totalAmount,
          currency: latestOrder.currency,
          gateway: latestOrder.gateway,
        }
      : null,
    children: dedupeParentStudents(parentProfile.students).map((student) =>
      mapChildSummary(student, accessLocked),
    ),
  } satisfies ParentDashboardData;
}

export async function getStudentDashboardData(userId: string) {
  const studentProfile = await db.studentProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      parents: {
        include: {
          parent: {
            include: {
              orders: {
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          },
        },
      },
      enrollments: {
        orderBy: { createdAt: "desc" },
        include: {
          program: {
            include: {
              schedules: {
                orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
                include: {
                  teacher: {
                    include: {
                      user: true,
                    },
                  },
                  lessonLogs: {
                    orderBy: { lessonDate: "desc" },
                    take: 6,
                  },
                },
              },
              quizzes: {
                where: { isPublished: true },
                include: {
                  questions: {
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
              assignments: {
                orderBy: { dueDate: "asc" },
              },
            },
          },
        },
      },
      attendances: {
        orderBy: { lessonDate: "desc" },
        take: 18,
      },
      quizAttempts: {
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take: 20,
        include: { quiz: true },
      },
      assignments: {
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take: 20,
      },
      journalEntries: {
        orderBy: { submittedAt: "desc" },
        take: 8,
      },
      progressReports: {
        orderBy: { updatedAt: "desc" },
        take: 8,
        include: { program: true },
      },
    },
  });

  if (!studentProfile) {
    return null;
  }

  const latestOrder = studentProfile.parents[0]?.parent.orders[0] ?? null;
  const accessLocked = !studentProfile.enrollments.some((enrollment) =>
    ["ACTIVE", "COMPLETED", "CONFIRMED"].includes(enrollment.status),
  );

  return {
    studentName:
      studentProfile.displayName ||
      `${studentProfile.user.firstName} ${studentProfile.user.lastName}`.trim() ||
      studentProfile.user.firstName,
    accessLocked,
    accessStateLabel: formatAccessState(accessLocked),
    pendingReason: accessLocked
      ? resolvePendingReason(latestOrder?.status, latestOrder?.gateway ?? null)
      : null,
    child: mapChildSummary(studentProfile, accessLocked),
  } satisfies StudentDashboardData;
}

export function getDashboardHomeForRole(role: UserRole) {
  switch (role) {
    case "PARENT":
      return "/parent";
    case "STUDENT":
      return "/student";
    case "TEACHER":
      return "/teacher";
    case "ADMIN":
      return "/admin";
    default:
      return "/auth/login";
  }
}
