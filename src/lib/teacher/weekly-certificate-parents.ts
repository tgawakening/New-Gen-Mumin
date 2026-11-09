import "server-only";
import { db } from "@/lib/db";
import { getWeeklyCertificateStudents } from "./weekly-certificate-students";

// Older converted registrations can have an enrolment owner but no ParentStudent
// row. Resolve actual ownership records; never match a family by display name.
export async function getWeeklyCertificateParents(user: { role: string; email: string; status?: string }) {
  const students = await getWeeklyCertificateStudents(user);
  if (!students.length) return [];
  const ids = students.map(student => student.id);
  const parents = await db.parentProfile.findMany({
    where: { OR: [
      { students: { some: { studentId: { in: ids } } } },
      { enrollments: { some: { studentId: { in: ids }, status: { in: ["CONFIRMED", "ACTIVE", "COMPLETED"] } } } },
      { registrations: { some: { status: { in: ["PAID", "CONVERTED"] }, students: { some: { studentProfileId: { in: ids } } } } } },
    ] },
    select: {
      id: true, user: { select: { firstName: true, lastName: true, email: true } },
      students: { where: { studentId: { in: ids } }, select: { studentId: true } },
      enrollments: { where: { studentId: { in: ids }, status: { in: ["CONFIRMED", "ACTIVE", "COMPLETED"] } }, select: { studentId: true, status: true } },
      registrations: { where: { status: { in: ["PAID", "CONVERTED"] } }, select: { status: true, students: { where: { studentProfileId: { in: ids } }, select: { studentProfileId: true } } } },
    },
  });
  const byId = new Map(students.map(student => [student.id, student]));
  return parents.flatMap(parent => {
    const childIds = new Set([
      ...parent.students.map(link => link.studentId),
      ...parent.enrollments.filter(enrollment => ["CONFIRMED", "ACTIVE", "COMPLETED"].includes(enrollment.status)).map(enrollment => enrollment.studentId),
      ...parent.registrations.filter(registration => ["PAID", "CONVERTED"].includes(registration.status)).flatMap(registration => registration.students.map(child => child.studentProfileId)),
    ]);
    const children = [...childIds].flatMap(id => id && byId.has(id) ? [byId.get(id)!] : []);
    return children.length ? [{
      id: parent.id,
      name: `${parent.user.firstName} ${parent.user.lastName ?? ""}`.trim() || parent.user.email,
      email: parent.user.email, children,
    }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
}
