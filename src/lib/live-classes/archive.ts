import "server-only";
import { db } from "@/lib/db";

/** Call only after checking the acting admin or owning teacher. Idempotent: never extend a stopped schedule. */
export async function archiveClassSchedule(scheduleId: string) {
  const now = new Date();
  return db.classSchedule.updateMany({
    where: { id: scheduleId, OR: [{ endsOn: null }, { endsOn: { gt: now } }] },
    data: { endsOn: now },
  });
}
