import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { awardHousePointsOnce, MANUAL_HOUSE_POINT_REASONS, pointDayKey, type ManualHousePointReason } from "@/lib/community/point-awards";
import { db } from "@/lib/db";
import { getProgramEligibleRosterStudents, getScheduleRosterStudentIds } from "@/lib/live-classes/service";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";

type PageProps = { searchParams?: Promise<{ awarded?: string; duplicate?: string; error?: string }> };

export default async function TeacherHousePointsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const params = searchParams ? await searchParams : {};

  const students = Array.from(
    new Map(dashboard.rosters.flatMap((roster) => roster.students).map((student) => [student.id, student])).values(),
  ).sort((left, right) => left.name.localeCompare(right.name));

  async function awardPoints(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "TEACHER") redirect("/auth/login");

    const teacher = await db.teacherProfile.findUnique({ where: { userId: current.user.id }, select: { id: true } });
    if (!teacher) redirect("/teacher-registration");

    const scheduleId = String(formData.get("scheduleId") || "");
    const studentId = String(formData.get("studentId") || "");
    const reasonValue = String(formData.get("reason") || "") as ManualHousePointReason;
    const note = String(formData.get("note") || "").trim().slice(0, 180);
    const reasonRule = MANUAL_HOUSE_POINT_REASONS.find((reason) => reason.value === reasonValue);
    if (!reasonRule) throw new Error("Choose an approved house-point reason.");

    const schedule = await db.classSchedule.findFirst({
      where: { id: scheduleId, teacherId: teacher.id },
      select: { id: true, programId: true, title: true },
    });
    if (!schedule) throw new Error("Choose one of your live sessions.");

    const [eligibleStudents, scheduleRosterIds] = await Promise.all([
      getProgramEligibleRosterStudents(schedule.programId),
      getScheduleRosterStudentIds(schedule.id),
    ]);
    const eligibleIds = new Set(eligibleStudents.map((student) => student.id));
    if (!eligibleIds.has(studentId) || (scheduleRosterIds.length > 0 && !scheduleRosterIds.includes(studentId))) {
      throw new Error("This student is not in the selected session roster.");
    }

    const result = await awardHousePointsOnce({
      studentId,
      points: reasonRule.points,
      reason: reasonRule.label + (note ? " — " + note : ""),
      sourceType: "TEACHER_" + reasonRule.value,
      sourceId: teacher.id + ":" + schedule.id + ":" + reasonRule.value + ":" + pointDayKey(),
      notificationHref: "/student/community",
    });

    revalidatePath("/teacher/house-points");
    revalidatePath("/student/community");
    revalidatePath("/parent/community");
    revalidatePath("/student/missions");
    redirect(result.awarded ? "/teacher/house-points?awarded=1" : "/teacher/house-points?duplicate=1");
  }

  return (
    <TeacherDashboardFrame
      title="Live House Points"
      subtitle="Award fixed, auditable points during a live class. Each student/reason/session can be awarded only once per day."
      navItems={getTeacherNavItems()}
    >
      <ActionToast
        message={params.awarded ? "House points awarded and the family was notified." : params.duplicate ? "These points were already awarded for this student, session, reason, and day." : params.error}
        tone={params.error || params.duplicate ? "error" : "success"}
      />
      <TeacherMetricGrid metrics={[
        { label: "Students", value: String(students.length), hint: "Eligible learners across your programme rosters." },
        { label: "Live sessions", value: String(dashboard.classes.length), hint: "Choose the class where the behaviour was observed." },
        { label: "Approved reasons", value: String(MANUAL_HOUSE_POINT_REASONS.length), hint: "Point values are fixed and cannot be inflated." },
        { label: "Duplicate guard", value: "Strict", hint: "One award per student/reason/session/day." },
      ]} />

      <TeacherSection eyebrow="Live award" title="Recognise a student contribution">
        <form action={awardPoints} className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
            Live session
            <select name="scheduleId" required className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3">
              <option value="">Choose session</option>
              {dashboard.classes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
            Student
            <select name="studentId" required className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3">
              <option value="">Choose student</option>
              {students.map((student) => <option key={student.id} value={student.id}>{student.name}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-[#22304a] lg:col-span-2">
            Reason and fixed points
            <select name="reason" required className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3">
              <option value="">Choose observed behaviour</option>
              {MANUAL_HOUSE_POINT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>{reason.label} — {reason.points} points</option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 lg:col-span-2 md:grid-cols-3">
            {MANUAL_HOUSE_POINT_REASONS.map((reason) => (
              <div key={reason.value} className="rounded-2xl bg-[#fbf6ef] p-4 text-sm text-[#5f6b7a]">
                <p className="font-semibold text-[#22304a]">{reason.points} points — {reason.label}</p>
                <p className="mt-2 leading-6">{reason.evidenceHint}</p>
              </div>
            ))}
          </div>
          <label className="grid gap-2 text-sm font-semibold text-[#22304a] lg:col-span-2">
            Short observation note
            <input name="note" maxLength={180} required placeholder="What did you observe during this class?" className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3" />
          </label>
          <button className="w-fit rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white">Award house points</button>
        </form>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}