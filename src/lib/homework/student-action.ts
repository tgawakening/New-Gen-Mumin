"use server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getStudentDashboardData, getParentDashboardData } from "@/lib/dashboard/family";
import { db } from "@/lib/db";
import { uploadStudentSubmissionFile } from "@/lib/google-drive/materials";
import { saveHomeworkSubmission } from "@/lib/homework/submission";
import { awardHousePointsOnce, HOUSE_POINT_RULES } from "@/lib/community/point-awards";
import { deliverHomeworkNotifications } from "@/lib/homework/notifications";

export async function submitStudentHomework(form: FormData) { return submitHomework(form, "STUDENT"); }
export async function submitParentHomework(form: FormData) { return submitHomework(form, "PARENT"); }

async function submitHomework(form: FormData, role: "PARENT" | "STUDENT") {
  const session = await getCurrentSession();
  if (!session || session.user.role !== role) redirect("/auth/login");
  const studentDashboard = role === "STUDENT" ? await getStudentDashboardData(session.user.id) : null;
  const parentDashboard = role === "PARENT" ? await getParentDashboardData(session.user.id) : null;
  const child = role === "STUDENT" ? studentDashboard?.child : parentDashboard?.children.find(item => item.id === String(form.get("childId") || ""));
  if (!child || child.accessLocked) throw new Error("Homework access is not active for this learner.");
  const id = String(form.get("assignmentId") || "");
  const base = role === "PARENT" ? "/parent/homework" : "/student/homework";
  const destination = base + "?" + new URLSearchParams({ ...(role === "PARENT" ? { child: child.id } : {}), task: id });
  if (!child.assignments.some(task => task.id === id)) redirect(destination + "&error=unavailable");
  const assignment = await db.assignment.findUnique({ where: { id }, include: { program: true } });
  if (!assignment) redirect(destination + "&error=unavailable");
  const student = await db.studentProfile.findUnique({ where: role === "PARENT" ? { id: child.id } : { userId: session.user.id }, include: { user: true } });
  if (!student || (role === "PARENT" && student.id !== child.id)) throw new Error("Learner not available.");
  const enrollment = await db.enrollment.findFirst({ where: { studentId: student.id, status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] }, OR: [{ programId: assignment.programId }, { program: { slug: "full-bundle" } }] } });
  if (!enrollment) throw new Error("You are not enrolled in this programme.");
  const text = String(form.get("submissionText") || "").trim();
  const file = form.get("submissionFile");
  const rawType = String(form.get("submissionType") || "homework");
  const submissionType = rawType === "assignment" || rawType === "task" ? rawType : "homework";
  let attachmentUrl: string | null = null;
  if (file instanceof File && file.size) {
    const uploaded = await uploadStudentSubmissionFile({ studentId: student.id, studentName: student.displayName || student.user.firstName, programId: assignment.programId, programTitle: assignment.program.title, assignmentId: assignment.id, assignmentTitle: assignment.title, submissionType, file }).catch(() => redirect(destination + "&error=upload"));
    attachmentUrl = uploaded.webViewLink;
  }
  const submission = await saveHomeworkSubmission({ assignmentId: assignment.id, studentId: student.id, enrollmentId: enrollment.id, submissionText: text, attachmentUrl }).catch(error => {
    if (error instanceof Error && error.message === "Add an answer or upload a file before submitting.") redirect(destination + "&error=empty");
    throw error;
  });
  await awardHousePointsOnce({ studentId: student.id, points: HOUSE_POINT_RULES.HOMEWORK_SUBMITTED.points, reason: `${HOUSE_POINT_RULES.HOMEWORK_SUBMITTED.label}: ${assignment.title}`, sourceType: "HOMEWORK_SUBMITTED", sourceId: assignment.id, notificationHref: `/student/homework?task=${encodeURIComponent(id)}` });
  if (role === "PARENT") await db.notification.updateMany({ where: { userId: session.user.id, readAt: null, href: `/parent/homework?child=${encodeURIComponent(child.id)}&task=${encodeURIComponent(id)}` }, data: { readAt: new Date() } });
  after(() => deliverHomeworkNotifications(1, submission.id));
  for (const path of ["/student/homework", "/student/courses", "/parent", "/teacher/homework", "/teacher/course-builder"]) revalidatePath(path, "layout");
  redirect(destination + "&submitted=1");
}
