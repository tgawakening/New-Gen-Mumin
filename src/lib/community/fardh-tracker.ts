import "server-only";

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ensureStudentHouseMembership } from "@/lib/community/house-points";

export const FARDH_PRAYERS = [
  { key: "fajr", label: "Fajr", points: 25, icon: "🌅", message: "Begin with Allah" },
  { key: "dhuhr", label: "Dhuhr", points: 15, icon: "☀️", message: "Pause and remember" },
  { key: "asr", label: "Asr", points: 15, icon: "🌤️", message: "Stay connected" },
  { key: "maghrib", label: "Maghrib", points: 15, icon: "🌇", message: "Give thanks" },
  { key: "isha", label: "Isha", points: 25, icon: "🌙", message: "End with remembrance" },
] as const;
export type FardhPrayerKey = (typeof FARDH_PRAYERS)[number]["key"];

export function localDateKey(value: Date, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  }
}

export function localHour(value: Date, timezone: string) {
  try { return Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).format(value)); }
  catch { return 0; }
}

function keyDate(key: string) { return new Date(`${key}T12:00:00.000Z`); }
export function shiftDay(key: string, amount: number) {
  const date = keyDate(key); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10);
}
export function mondayFor(key: string) {
  const day = keyDate(key).getUTCDay(); return shiftDay(key, -(day === 0 ? 6 : day - 1));
}
export function weekKeys(start: string) { return Array.from({ length: 7 }, (_, index) => shiftDay(start, index)); }
export function prettyDay(key: string) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(keyDate(key));
}

export async function getFardhWeek(studentId: string, requestedStart: string | undefined, timezone: string) {
  const today = localDateKey(new Date(), timezone);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(requestedStart || "") ? mondayFor(requestedStart!) : mondayFor(today);
  const days = weekKeys(start);
  const records = await db.fardhPrayerDay.findMany({ where: { studentId, dayKey: { in: days } } });
  return { today, start, days, records: new Map(records.map((record) => [record.dayKey, record])) };
}

export async function saveFardhDay(input: { studentId: string; dayKey: string; timezone: string; prayers: FardhPrayerKey[] }) {
  const today = localDateKey(new Date(), input.timezone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dayKey) || input.dayKey > today) throw new Error("Future prayers cannot be marked complete.");
  if (!Number.isFinite(keyDate(input.dayKey).getTime()) || keyDate(input.dayKey).toISOString().slice(0, 10) !== input.dayKey) throw new Error("Invalid prayer date.");
  if (input.prayers.some(key => !FARDH_PRAYERS.some(p => p.key === key))) throw new Error("Invalid prayer selection.");
  const selected = new Set(input.prayers);
  const data = Object.fromEntries(FARDH_PRAYERS.map(p => [p.key, selected.has(p.key)]));
  const membership = await ensureStudentHouseMembership(input.studentId);
  let points = 0;
  for (let attempt = 0; ; attempt++) {
    try {
      points = await db.$transaction(async tx => {
        const sourceIds = FARDH_PRAYERS.map(p => input.dayKey + ":" + p.key);
        const previous = await tx.housePointLedger.findMany({ where: { studentId: input.studentId, sourceType: "FARDH_PRAYER", sourceId: { in: sourceIds } } });
        await tx.fardhPrayerDay.upsert({
          where: { studentId_dayKey: { studentId: input.studentId, dayKey: input.dayKey } },
          create: { studentId: input.studentId, dayKey: input.dayKey, timezone: input.timezone, ...data },
          update: { timezone: input.timezone, ...data },
        });
        for (const prayer of FARDH_PRAYERS) {
          const sourceId = input.dayKey + ":" + prayer.key;
          if (!selected.has(prayer.key)) {
            await tx.housePointLedger.deleteMany({ where: { studentId: input.studentId, sourceType: "FARDH_PRAYER", sourceId } });
          } else {
            await tx.housePointLedger.upsert({
              where: { studentId_sourceType_sourceId: { studentId: input.studentId, sourceType: "FARDH_PRAYER", sourceId } },
              create: { studentId: input.studentId, houseId: membership.houseId, sourceType: "FARDH_PRAYER", sourceId, points: prayer.points, reason: prayer.label + " prayer completed (" + input.dayKey + ")" },
              update: { points: prayer.points },
            });
          }
        }
        return FARDH_PRAYERS.reduce((sum, p) => sum + (selected.has(p.key) ? p.points : 0), 0) - previous.reduce((sum, entry) => sum + entry.points, 0);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      break;
    } catch (error) {
      if (attempt >= 3 || !(error instanceof Prisma.PrismaClientKnownRequestError) || !["P2034", "P2002"].includes(error.code)) throw error;
    }
  }
  if (points) {
    const student = await db.studentProfile.findUnique({ where: { id: input.studentId }, include: { user: true, parents: { include: { parent: true } }, enrollments: { select: { programId: true } } } });
    if (student) {
      const teacherLinks = await db.teacherProgram.findMany({ where: { programId: { in: student.enrollments.map((e) => e.programId) } }, include: { teacher: { include: { user: true } } } });
      const admins = await db.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
      const familyIds = [student.userId, ...student.parents.map((p) => p.parent.userId)];
      const adminIds = admins.map((admin) => admin.id);
      const staffIds = [...teacherLinks.map((link) => link.teacher.userId), ...adminIds];
      const name = student.displayName || student.user.firstName;
      await db.notification.createMany({ data: Array.from(new Set([...familyIds, ...staffIds])).map((userId) => ({ userId, title: "Fardh tracker updated", body: `${name} recorded salah for ${input.dayKey} with a points adjustment of ${points > 0 ? "+" : ""}${points}.`, href: familyIds.includes(userId) ? (userId === student.userId ? "/student/fardh-tracker" : `/parent/fardh-tracker?child=${student.id}`) : adminIds.includes(userId) ? "/admin/fardh-tracker" : "/teacher/fardh-tracker" })) });
    }
  }
  return { points };
}

export async function ensureFardhReminder(userId: string, href: string, timezone: string) {
  const now = new Date(); const today = localDateKey(now, timezone); const target = localHour(now, timezone) >= 20 ? today : shiftDay(today, -1);
  const title = `Complete the Fardh tracker • ${target}`;
  const exists = await db.notification.findFirst({ where: { userId, title } });
  if (!exists) await db.notification.create({ data: { userId, title, body: "Record today's five prayers. Seek Allah's reward first; the points simply celebrate consistency.", href } });
}
export async function ensureFardhLaunchEmail(input: { toEmail: string; recipientName: string; trackerPath: string }) {
  const exists = await db.emailLog.findFirst({ where: { toEmail: input.toEmail, template: "fardhTrackerLive" }, select: { id: true } });
  if (exists) return;
  const { sendFardhTrackerLiveEmail } = await import("@/lib/email/notifications");
  await sendFardhTrackerLiveEmail(input);
}