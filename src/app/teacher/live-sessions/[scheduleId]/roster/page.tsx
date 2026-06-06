export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";
import { TeacherDashboardFrame, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { getTeacherProgramRosterStudentIds, syncScheduleRoster } from "@/lib/live-classes/service";

type PageProps = {
  params: { scheduleId: string };
  searchParams?: Promise<{ notice?: string; tone?: string }>;
};

function noticeHref(scheduleId: string, message: string, tone: "success" | "error" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  return `/teacher/live-sessions/${scheduleId}/roster?${params.toString()}`;
}

export default async function TeacherScheduleRosterPage({ params, searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  const schedule = await db.classSchedule.findUnique({
    where: { id: params.scheduleId },
    include: {
      teacher: {
        include: { user: true },
      },
      program: {
        include: {
          enrollments: {
            where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
            include: {
              student: {
                include: {
                  user: true,
                },
              },
            },
          },
        },
      },
      scheduleRosters: {
        select: { studentId: true },
      },
    },
  });

  if (!schedule || schedule.teacher.userId !== session.user.id) {
    redirect("/teacher/live-sessions");
  }

  const scheduleRosterIds = new Set(schedule.scheduleRosters.map((entry) => entry.studentId));
  const defaultProgramRosterIds = await getTeacherProgramRosterStudentIds(schedule.teacherId, schedule.programId);
  const selectedIds = scheduleRosterIds.size ? scheduleRosterIds : new Set(defaultProgramRosterIds);

  async function saveScheduleRosterAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

    const scheduleItem = await db.classSchedule.findUnique({
      where: { id: params.scheduleId },
      include: { teacher: true },
    });
    if (!scheduleItem || scheduleItem.teacher.userId !== currentSession.user.id) {
      redirect("/teacher/live-sessions");
    }

    const selected = formData.getAll("studentIds").filter((value): value is string => typeof value === "string");

    const enrollments = await db.enrollment.findMany({
      where: {
        programId: scheduleItem.programId,
        status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] },
      },
      select: { studentId: true },
    });

    const validStudentIds = new Set(enrollments.map((entry) => entry.studentId));
    const studentIds = selected.filter((id) => validStudentIds.has(id));

    await syncScheduleRoster(scheduleItem.id, studentIds);

    revalidatePath(`/teacher/live-sessions/${scheduleItem.id}/roster`);
    redirect(noticeHref(scheduleItem.id, "Session roster saved successfully.", "success"));
  }

  const paramsObj = searchParams ? await searchParams : {};

  return (
    <TeacherDashboardFrame
      title="Session Roster"
      subtitle={`Adjust student notifications and attendance roster for ${schedule.title}`}
      navItems={getTeacherNavItems()}
    >
      <ActionToast message={paramsObj.notice} tone={paramsObj.tone} />

      <TeacherSection eyebrow="Session roster" title="Choose students for this live session">
        <p className="text-sm leading-6 text-[#617184]">
          Use this page to override the default programme roster for this specific session. If no overrides are saved, the default programme roster will be used.
        </p>
        <form action={saveScheduleRosterAction} className="mt-6 rounded-3xl border border-[#e5e9ef] bg-[#fbfcff] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#22304a]">{schedule.program.title}</h3>
              <p className="mt-1 text-sm text-[#5f6b7a]">Session on {schedule.weekday}, {schedule.startTime}-{schedule.endTime} {schedule.timezone}</p>
            </div>
            <FormSubmitButton className="rounded-full bg-[#0f4d81] px-5 py-3 text-sm font-semibold text-white" pendingLabel="Saving roster...">
              Save session roster
            </FormSubmitButton>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {schedule.program.enrollments.map((enrollment) => {
              const studentName = enrollment.student.displayName || `${enrollment.student.user.firstName} ${enrollment.student.user.lastName}`.trim();
              return (
                <label key={enrollment.student.id} className="flex cursor-pointer flex-col rounded-2xl border border-[#dce4ed] bg-white p-4 text-sm text-[#22304a] transition hover:border-[#9eb2c8]">
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="studentIds"
                      value={enrollment.student.id}
                      defaultChecked={selectedIds.has(enrollment.student.id)}
                      className="h-4 w-4 rounded border-[#cdd9e4] text-[#0f4d81]"
                    />
                    <span className="font-semibold">{studentName}</span>
                  </span>
                  <span className="mt-2 text-xs text-[#5f6b7a]">{enrollment.student.user.email}</span>
                </label>
              );
            })}
          </div>
        </form>
      </TeacherSection>

      <TeacherSection eyebrow="Quick links" title="Other live session tools">
        <div className="space-y-3 text-sm text-[#5f6b7a]">
          <p>Changed your default roster? Save it on the Roster page so future sessions use the right student group.</p>
          <p>You can leave all checkboxes empty to revert to the default programme roster if one exists.</p>
        </div>
      </TeacherSection>

      <div className="mt-4">
        <Link href="/teacher/live-sessions" className="text-sm font-semibold text-[#0f4d81] underline">
          Back to live sessions
        </Link>
      </div>
    </TeacherDashboardFrame>
  );
}
