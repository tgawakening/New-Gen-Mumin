export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { requestTeacherLiveClass } from "@/lib/live-classes/service";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";

type PageProps = {
  searchParams?: Promise<{
    notice?: string;
    tone?: string;
    status?: string;
    programId?: string;
    title?: string;
  }>;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMEZONES = ["Europe/London", "Asia/Karachi", "Asia/Dubai", "Asia/Riyadh", "America/New_York", "America/Toronto", "UTC"];
const AUDIENCE_OPTIONS = [
  { value: "PK_UK", label: "Pakistan and UK students" },
  { value: "US_CA", label: "USA and Canada students" },
  { value: "AU", label: "Australia students" },
  { value: "ALL", label: "All students" },
];

function noticeHref(message: string, tone: "success" | "error" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  return `/teacher/live-sessions?${params.toString()}`;
}

function statusNotice(status?: string) {
  if (status === "zoom-linked") {
    return {
      message: "Zoom live session created successfully. Admin has been notified for monitoring.",
      tone: "success",
    };
  }
  if (status === "zoom-pending") {
    return {
      message: "Zoom session could not be created. Please check the Zoom app scopes and try again.",
      tone: "error",
    };
  }
  if (status === "deleted") {
    return {
      message: "Live session removed successfully.",
      tone: "success",
    };
  }
  return null;
}

export default async function TeacherLiveSessionsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  const params = searchParams ? await searchParams : {};
  const defaultProgramId = params.programId && dashboard.rosters.some((roster) => roster.programId === params.programId)
    ? params.programId
    : dashboard.rosters[0]?.programId;
  const codedNotice = statusNotice(params.status);

  async function requestSessionAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");
    let successStatus = "zoom-linked";

    try {
      const schedule = await requestTeacherLiveClass(
        {
          programId: String(formData.get("programId") || ""),
          title: String(formData.get("title") || ""),
          startDate: String(formData.get("startDate") || ""),
          weekday: Number(formData.get("weekday") || 0),
          startTime: String(formData.get("startTime") || "16:00"),
          endTime: String(formData.get("endTime") || "17:00"),
          timezone: String(formData.get("timezone") || "Europe/London"),
          createZoomMeeting: true,
          audienceGroup: String(formData.get("audienceGroup") || "ALL") as "ALL" | "PK_UK" | "US_CA" | "AU",
          waitingRoom: formData.get("waitingRoom") === "on",
          joinBeforeHost: formData.get("joinBeforeHost") === "on",
          muteUponEntry: formData.get("muteUponEntry") === "on",
          autoRecording: String(formData.get("autoRecording") || "cloud") as "none" | "local" | "cloud",
          passcode: String(formData.get("passcode") || ""),
        },
        currentSession.user.id,
      );

      revalidatePath("/teacher/live-sessions");
      revalidatePath("/admin/classes");
      revalidatePath("/student/schedule");
      revalidatePath("/parent/schedule");
      successStatus = schedule.meetingUrl ? "zoom-linked" : "zoom-pending";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to request this Zoom session.";
      redirect(noticeHref(message, "error"));
    }
    redirect(`/teacher/live-sessions?status=${successStatus}`);
  }

  async function deleteSessionAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

    const teacher = await db.teacherProfile.findUnique({ where: { userId: currentSession.user.id } });
    if (!teacher) redirect("/teacher-registration");

    const schedule = await db.classSchedule.findFirst({
      where: {
        id: String(formData.get("scheduleId") || ""),
        teacherId: teacher.id,
      },
    });

    if (schedule) {
      await db.classSchedule.delete({ where: { id: schedule.id } });
    }

    revalidatePath("/teacher/live-sessions");
    revalidatePath("/teacher/schedule");
    revalidatePath("/admin/classes");
    revalidatePath("/student/schedule");
    revalidatePath("/parent/schedule");
    redirect("/teacher/live-sessions?status=deleted");
  }

  return (
    <TeacherDashboardFrame
      title="Live Sessions"
      subtitle="Create Zoom sessions directly for your assigned programmes. Admin is notified automatically for monitoring."
      navItems={getTeacherNavItems()}
    >
      <ActionToast message={params.notice ?? codedNotice?.message} tone={params.tone ?? codedNotice?.tone} />

      <TeacherMetricGrid
        metrics={[
          { label: "Assigned programs", value: String(dashboard.rosters.length), hint: "Programmes you can request sessions for." },
          { label: "Existing sessions", value: String(dashboard.classes.length), hint: "Live classes created from your dashboard." },
          { label: "Students", value: String(dashboard.metrics.students), hint: "Learners reached by your sessions." },
          { label: "Publishing", value: "Direct", hint: "Admin receives a notification." },
        ]}
      />

      <TeacherSection eyebrow="Zoom session" title="Create a recurring live session">
        <form action={requestSessionAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            Program
            <select name="programId" required defaultValue={defaultProgramId} className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
              {dashboard.rosters.map((roster) => (
                <option key={roster.programId} value={roster.programId}>
                  {roster.title}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#22304a] xl:col-span-3">
            Session title
            <input name="title" required defaultValue={params.title ?? ""} placeholder="Revision circle - Week 3" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
          </label>

          <div className="rounded-2xl border border-[#dce4ed] bg-[#f5fbff] px-4 py-3 text-sm font-semibold text-[#22304a] xl:col-span-4">
            Recurrence: weekly Zoom session. Students and parents will see the same recurring join link in their schedules.
          </div>

          <label className="space-y-2 text-sm font-semibold text-[#22304a] xl:col-span-4">
            Student audience
            <select name="audienceGroup" defaultValue="PK_UK" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
              {AUDIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            Start date
            <input name="startDate" type="date" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            Day
            <select name="weekday" defaultValue="6" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
              {WEEKDAYS.map((weekday, index) => (
                <option key={weekday} value={index}>{weekday}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            Start
            <input name="startTime" type="time" defaultValue="16:00" required className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            End
            <input name="endTime" type="time" defaultValue="17:00" required className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            Timezone
            <select name="timezone" defaultValue="Europe/London" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
              {TIMEZONES.map((timezone) => (
                <option key={timezone} value={timezone}>{timezone}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            Auto recording
            <select name="autoRecording" defaultValue="cloud" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
              <option value="cloud">Cloud recording</option>
              <option value="local">Local recording</option>
              <option value="none">No automatic recording</option>
            </select>
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#22304a] xl:col-span-3">
            Optional passcode
            <input name="passcode" placeholder="Leave blank for Zoom default" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-[#dce4ed] bg-[#fbfdff] px-4 py-3 text-sm font-semibold text-[#22304a]">
            <input name="waitingRoom" type="checkbox" defaultChecked className="h-4 w-4" />
            Waiting room
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[#dce4ed] bg-[#fbfdff] px-4 py-3 text-sm font-semibold text-[#22304a]">
            <input name="muteUponEntry" type="checkbox" defaultChecked className="h-4 w-4" />
            Mute on entry
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-[#dce4ed] bg-[#fbfdff] px-4 py-3 text-sm font-semibold text-[#22304a]">
            <input name="joinBeforeHost" type="checkbox" className="h-4 w-4" />
            Join before host
          </label>

          <FormSubmitButton pendingLabel="Creating Zoom session..." className="rounded-full bg-[#0f4d81] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70 xl:col-span-4 xl:justify-self-start">
            Create Zoom session
          </FormSubmitButton>
        </form>
      </TeacherSection>

      <TeacherSection eyebrow="Session status" title="Your live sessions">
        <div className="space-y-4">
          {dashboard.classes.map((entry) => (
            <div key={entry.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-[#22304a]">{entry.title}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {entry.provider ?? "Live class"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                {WEEKDAYS[entry.weekday]} {entry.startTime}-{entry.endTime} {entry.timezone}
              </p>
              <p className="mt-1 text-sm text-[#5f6b7a]">{entry.audience}</p>
              <p className="mt-2 text-sm text-[#5f6b7a]">
                {entry.meetingUrl ? "Linked to Zoom" : "Zoom link unavailable. Please recreate after Zoom scopes are fixed."}
              </p>
              <form action={deleteSessionAction} className="mt-4">
                <input type="hidden" name="scheduleId" value={entry.id} />
                <FormSubmitButton pendingLabel="Removing..." className="rounded-full border border-[#efb3b3] bg-white px-4 py-2 text-sm font-semibold text-[#b24646] disabled:cursor-wait disabled:opacity-70">
                  Remove session
                </FormSubmitButton>
              </form>
            </div>
          ))}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
