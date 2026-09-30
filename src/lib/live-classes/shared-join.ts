import "server-only";
import { db } from "@/lib/db";
import { resolveScheduleStudentIds } from "@/lib/live-classes/service";
export async function sharedJoinStudents(scheduleId: string, programId: string, user: { id: string; role: string }) {
  if (!["PARENT", "STUDENT"].includes(user.role)) return [];
  const roster = await resolveScheduleStudentIds(scheduleId);
  return db.studentProfile.findMany({
    where: { id: { in: roster }, user: { status: "ACTIVE" },
      ...(user.role === "STUDENT" ? { userId: user.id } : { parents: { some: { parent: { userId: user.id } } } }),
      enrollments: { some: { programId, status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } } },
    },
    select: { id: true, displayName: true, user: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" },
  });
}
