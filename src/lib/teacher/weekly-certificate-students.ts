import "server-only";
import { db } from "@/lib/db";
import { canAwardWeeklyCertificates } from "./recognition-permissions";

const ENROLLED = ["CONFIRMED", "ACTIVE", "COMPLETED"];
const APPROVED = ["PAID", "CONVERTED"];
const normalizeName = (name: string) => name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

// Recognise enrolled learners across the school, not incomplete sign-ups.
// A direct staff-approved enrolment remains valid without a registration record.
export async function getWeeklyCertificateStudents(user: { role: string; email: string; status?: string }) {
  if (!canAwardWeeklyCertificates(user)) throw new Error("You cannot award weekly certificates.");
  const students = await db.studentProfile.findMany({
    where: {
      user: { role: "STUDENT", status: "ACTIVE" },
      enrollments: { some: { status: { in: ["CONFIRMED", "ACTIVE", "COMPLETED"] } } },
      OR: [
        { registrationStudents: { some: { registration: { status: { in: ["PAID", "CONVERTED"] } } } } },
        { registrationStudents: { none: {} } },
      ],
    },
    select: {
      id: true, displayName: true, createdAt: true,
      user: { select: { firstName: true, lastName: true, email: true, role: true, status: true } },
      enrollments: { select: { status: true } },
      registrationStudents: {
        select: { firstName: true, lastName: true, gender: true, registration: { select: { status: true, createdAt: true, parentEmail: true } } },
      },
      parents: { select: { parent: { select: { user: { select: { email: true } } } } } },
      houseMembership: { select: { qabilaGroup: true } },
    },
  });
  const candidates = students.flatMap(student => {
    if (student.user.role !== "STUDENT" || student.user.status !== "ACTIVE" || !student.enrollments.some(enrollment => ENROLLED.includes(enrollment.status))) return [];
    const approved = student.registrationStudents.filter(entry => APPROVED.includes(entry.registration.status))
      .sort((a, b) => b.registration.createdAt.getTime() - a.registration.createdAt.getTime());
    if (student.registrationStudents.length && !approved.length) return [];
    const registration = approved[0];
    const name = student.displayName?.trim() || `${student.user.firstName} ${student.user.lastName ?? ""}`.trim();
    const registeredName = registration ? `${registration.firstName} ${registration.lastName ?? ""}`.trim() : name;
    // Include the family identity so unrelated children with the same name remain selectable.
    const family = registration?.registration.parentEmail || student.parents.map(link => link.parent.user.email.trim().toLowerCase()).sort()[0] || student.user.email;
    return [{
      student, name, registration,
      identity: JSON.stringify([family.trim().toLowerCase(), normalizeName(registeredName) || student.id]),
      approvedAt: registration?.registration.createdAt.getTime() ?? 0,
    }];
  }).sort((a, b) => b.approvedAt - a.approvedAt || b.student.createdAt.getTime() - a.student.createdAt.getTime() || a.student.id.localeCompare(b.student.id));
  const unique = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) if (!unique.has(candidate.identity)) unique.set(candidate.identity, candidate);
  return [...unique.values()].map(({ student, name, registration }) => ({
    id: student.id, name,
    gender: registration?.gender ?? null,
    qabilaGroup: student.houseMembership?.qabilaGroup ?? null,
  })).sort((a, b) => a.name.localeCompare(b.name));
}
