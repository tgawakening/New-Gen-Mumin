import "server-only";
import { db } from "@/lib/db";
import { canAwardWeeklyCertificates } from "./recognition-permissions";

// Weekly certificate teachers recognise the whole school, regardless of class,
// payment status or whether a learner has logged in yet.
export async function getWeeklyCertificateStudents(user: { role: string; email: string }) {
  if (!canAwardWeeklyCertificates(user)) throw new Error("You cannot award weekly certificates.");
  const students = await db.studentProfile.findMany({
    select: {
      id: true, displayName: true,
      user: { select: { firstName: true, lastName: true } },
      registrationStudents: { orderBy: { createdAt: "desc" }, take: 1, select: { gender: true } },
      houseMembership: { select: { qabilaGroup: true } },
    },
  });
  return students.map(student => ({
    id: student.id,
    name: student.displayName || `${student.user.firstName} ${student.user.lastName ?? ""}`.trim(),
    gender: student.registrationStudents[0]?.gender ?? null,
    qabilaGroup: student.houseMembership?.qabilaGroup ?? null,
  })).sort((a, b) => a.name.localeCompare(b.name));
}
