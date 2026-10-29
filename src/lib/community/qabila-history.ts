import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { qabilaProfile, type QabilaName } from "./qabilas";

export type ContributionEvent = {
  id: string; studentId: string; name: string; points: number; label: string; occurredAt: string;
  score: { correct: number; total: number; historicalTotal: boolean } | null; quizEarnedPoints: number | null;
};
export type ContributionMember = { id: string; name: string; points: number };
export type QabilaHistory = {
  qabila: QabilaName; page: number; pageSize: number; totalPages: number; totalEvents: number;
  totalPoints: number; members: ContributionMember[]; events: ContributionEvent[]; asOf: string;
};
type RawEvent = { id: string; studentId: string; points: number | bigint; reason: string; sourceType: string; occurredAt: Date; correctCount: number | bigint | null; questionCount: number | bigint | null; quizEarnedPoints: number | bigint | null; snapshotCount: number | bigint | null };

export function activityLabel(source: string, reason: string) {
  if (source === "QUIZ_LIVE_ANSWER") return "Live quiz credit (older record)";
  if (source === "TEACHER_CAMERA_STUDY_READY") return "Ready to learn: camera, books and study space";
  if (source === "TEACHER_POSITIVE_PARTICIPATION") return "Positive class participation";
  if (source === "TEACHER_LIVE_QUIZ_ANSWER") return "Teacher-observed quiz answer";
  if (source === "TEACHER_MANUAL_REVERSAL") return "Teacher award removed: points adjustment";
  if (source === "QUIZ_LIVE_SESSION" || source === "QUIZ" || source === "QUIZ_LIVE_COMPLETE") return reason;
  if (source.startsWith("SUNNAH")) return source === "SUNNAH_DAILY" ? "Daily Sunnah tracker submitted" : "Sunnah activity completed";
  if (source.startsWith("FARDH")) return reason;
  if (source.includes("ATTENDANCE")) return source === "ATTENDANCE_PARENT" ? "Attendance confirmed by parent" : "Live class attendance";
  if (source.includes("HOMEWORK")) return "Homework completed";
  if (source === "RECOGNITION_MUMIN_OF_WEEK") return "Mumin of the Week certificate";
  if (source === "PARENT_RECOGNITION_MUM_OF_WEEK") return "Mum of the Week certificate";
  if (source.includes("RECOGNITION") || source.includes("CROSS_HOUSE")) return "Character badge or recognition";
  return "Class activity or points adjustment";
}

/** Parameterised union: one row per quiz/learner, including zero-score participation.
 * Ledger credits, not response scores, remain the authoritative Qabila total. */
function eventQuery(ids: string[], asOf: Date) {
  const learners = Prisma.join(ids);
  return Prisma.sql`
    SELECT MIN(l.id) AS id, l.studentId, SUM(l.points) AS points,
      CASE WHEN l.sourceType = 'FARDH_PRAYER' THEN CONCAT('Daily Salah: ', COUNT(*), '/5 prayers (', LEFT(MAX(l.sourceId), 10), ')') ELSE MAX(l.reason) END AS reason,
      l.sourceType, MAX(l.awardedAt) AS occurredAt, NULL AS correctCount, NULL AS questionCount, NULL AS quizEarnedPoints, NULL AS snapshotCount
    FROM HousePointLedger l
    WHERE l.studentId IN (${learners}) AND l.awardedAt <= ${asOf} AND l.sourceType <> 'QUIZ_LIVE_ANSWER'
    GROUP BY l.studentId, l.sourceType,
      CASE WHEN l.sourceType = 'FARDH_PRAYER' THEN CONCAT('prayer:', l.studentId, ':', LEFT(l.sourceId, 10)) ELSE l.id END
    UNION ALL
    SELECT CONCAT('quiz:', r.sessionId, ':', r.studentId) AS id, r.studentId,
      COALESCE(SUM(l.points), 0) AS points, COALESCE(MAX(q.title), 'Live quiz') AS reason,
      'QUIZ_LIVE_SESSION' AS sourceType, MAX(r.answeredAt) AS occurredAt,
      SUM(CASE WHEN r.isCorrect = 1 THEN 1 ELSE 0 END) AS correctCount,
      COALESCE(MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(r.answer, '$.questionCount')) AS UNSIGNED)), (SELECT COUNT(*) FROM QuizQuestion qq WHERE qq.quizId = s.quizId)) AS questionCount,
      SUM(r.earnedPoints) AS quizEarnedPoints,
      MAX(CAST(JSON_UNQUOTE(JSON_EXTRACT(r.answer, '$.questionCount')) AS UNSIGNED)) AS snapshotCount
    FROM QuizLiveResponse r
    JOIN QuizLiveSession s ON s.id = r.sessionId
    LEFT JOIN Quiz q ON q.id = s.quizId
    LEFT JOIN HousePointLedger l ON l.studentId = r.studentId AND l.sourceType = 'QUIZ_LIVE_ANSWER' AND l.sourceId = r.id AND l.awardedAt <= ${asOf}
    WHERE r.studentId IN (${learners}) AND r.answeredAt <= ${asOf}
    GROUP BY r.studentId, r.sessionId, s.quizId
    UNION ALL
    SELECT l.id, l.studentId, l.points, l.reason, l.sourceType, l.awardedAt, NULL, NULL, NULL, NULL
    FROM HousePointLedger l
    WHERE l.studentId IN (${learners}) AND l.awardedAt <= ${asOf} AND l.sourceType = 'QUIZ_LIVE_ANSWER'
      AND NOT EXISTS (SELECT 1 FROM QuizLiveResponse r WHERE r.id = l.sourceId AND r.studentId = l.studentId)
  `;
}

export async function readContributionEvents(members: Array<{ id: string; name: string }>, asOf: Date, take = 10, skip = 0) {
  if (!members.length) return [];
  const rows = await db.$queryRaw<RawEvent[]>(Prisma.sql`SELECT * FROM (${eventQuery(members.map(m => m.id), asOf)}) events ORDER BY occurredAt DESC, id DESC LIMIT ${take} OFFSET ${skip}`);
  const names = new Map(members.map(m => [m.id, m.name]));
  return rows.map(row => ({
    id: row.id, studentId: row.studentId, name: names.get(row.studentId) || "Learner",
    points: Number(row.points), label: activityLabel(row.sourceType, row.reason), occurredAt: new Date(row.occurredAt).toISOString(),
    score: row.sourceType === "QUIZ_LIVE_SESSION" && Number(row.questionCount) > 0 ? { correct: Number(row.correctCount), total: Number(row.questionCount), historicalTotal: !Number(row.snapshotCount) } : null,
    quizEarnedPoints: row.quizEarnedPoints === null ? null : Number(row.quizEarnedPoints),
  }));
}

export async function getQabilaHistory(input: { qabila: QabilaName; page: number; studentId?: string; asOf: Date }): Promise<QabilaHistory> {
  const profile = qabilaProfile(input.qabila)!;
  const membership = await db.houseMembership.findMany({
    where: { qabilaGroup: { in: [profile.name, ...profile.legacyNames] } },
    select: { studentId: true, student: { select: { displayName: true, user: { select: { firstName: true, lastName: true } } } } },
  });
  if (input.studentId && !membership.some(m => m.studentId === input.studentId)) throw new Error("Learner is not in this Qabila.");
  const ids = membership.map(m => m.studentId);
  const sums = ids.length ? await db.housePointLedger.groupBy({ by: ["studentId"], where: { studentId: { in: ids }, awardedAt: { lte: input.asOf } }, _sum: { points: true } }) : [];
  const points = new Map(sums.map(row => [row.studentId, row._sum.points ?? 0]));
  const members = membership.map(m => ({ id: m.studentId, name: m.student.displayName || `${m.student.user.firstName} ${m.student.user.lastName ?? ""}`.trim(), points: points.get(m.studentId) ?? 0 })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const selected = input.studentId ? members.filter(m => m.id === input.studentId) : members;
  const counts = selected.length ? await db.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM (${eventQuery(selected.map(m => m.id), input.asOf)}) events`) : [];
  const totalEvents = Number(counts[0]?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalEvents / 10));
  const page = Math.min(input.page, totalPages);
  const events = await readContributionEvents(selected, input.asOf, 10, (page - 1) * 10);
  return { qabila: input.qabila, page, pageSize: 10, totalPages, totalEvents, totalPoints: members.reduce((sum, m) => sum + m.points, 0), members, events, asOf: input.asOf.toISOString() };
}
