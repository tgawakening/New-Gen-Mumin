import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import "server-only";
import { db } from "@/lib/db";
import { zoomAttendanceCode } from "./zoom-presence-policy";
import { buildZoomPresenceSummary, presenceMonthBounds, validPresenceMonth } from "./zoom-presence-summary";
import { zoomPresenceEnabled } from "./zoom-attendance-work";

/** Same authorization boundary for the portal and the CSV; never trust a child query parameter. */
export async function getZoomPresenceReport(user: { id: string; role: string }, studentId: string, month: string) {
  if (!zoomPresenceEnabled()) throw new Error("Zoom duration reporting is awaiting administrator activation.");
  if (!validPresenceMonth(month)) throw new Error("Choose a valid current or past month.");
  const student = await db.studentProfile.findUnique({ where: { id: studentId }, include: { user: true, parents: { include: { parent: { include: { user: true } } } }, enrollments: { include: { program: true } } } });
  if (!student) throw new Error("Learner not found.");
  let allowed = user.role === "ADMIN" || (user.role === "STUDENT" && student.userId === user.id);
  if (user.role === "PARENT") allowed = student.parents.some(link => link.parent.userId === user.id);
  if (user.role === "TEACHER") {
    const dashboard = await getTeacherDashboardData(user.id);
    allowed = Boolean(dashboard?.rosters.some(roster => roster.students.some(learner => learner.id === studentId)));
  }
  if (!allowed) throw new Error("You do not have access to this learner's attendance.");
  const bounds = presenceMonthBounds(month);
  const parentIds = user.role === "PARENT" ? student.parents.filter(link => link.parent.userId === user.id).map(link => link.parent.id) : (user.role === "ADMIN" || user.role === "TEACHER") ? student.parents.map(link => link.parent.id) : [];
  const intervals = await db.zoomAttendanceInterval.findMany({
    where: { OR: [{ studentId }, ...(parentIds.length ? [{ parentId: { in: parentIds } }] : [])], joinedAt: { lt: bounds.end }, AND: [{ OR: [{ leftAt: { gt: bounds.start } }, { leftAt: null, joinedAt: { gte: bounds.start } }] }] },
    include: { schedule: { select: { title: true, program: { select: { title: true, slug: true } } } } }, orderBy: { joinedAt: "desc" },
  });
  const enrolled = student.enrollments.filter(enrollment => ["ACTIVE", "CONFIRMED", "COMPLETED"].includes(enrollment.status) || (enrollment.startedAt && enrollment.startedAt < bounds.end && (!enrollment.completedAt || enrollment.completedAt >= bounds.start))).map(enrollment => ({ slug: enrollment.program.slug, title: enrollment.program.title, startedAt: enrollment.startedAt ?? enrollment.createdAt }));
  if (parentIds.length) enrolled.push({ slug: "parental", title: "Parental Sessions", startedAt: new Date(Math.min(...student.parents.filter(link => parentIds.includes(link.parent.id)).map(link => link.parent.createdAt.getTime()))) });
  const summary = buildZoomPresenceSummary(month, intervals, enrolled);
  const name = student.displayName || [student.user.firstName, student.user.lastName].filter(Boolean).join(" ");
  return { studentId, name, month, studentZoomName: `${zoomAttendanceCode("student", student.id)} - ${name}`, parentZoomNames: student.parents.filter(link => parentIds.includes(link.parent.id)).map(link => ({ name: [link.parent.user.firstName, link.parent.user.lastName].filter(Boolean).join(" "), zoomName: `${zoomAttendanceCode("parent", link.parent.id)} - ${[link.parent.user.firstName, link.parent.user.lastName].filter(Boolean).join(" ")}` })), summary, intervals };
}
