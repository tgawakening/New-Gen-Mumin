export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { requestTeacherLiveClass } from "@/lib/live-classes/service";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";

type PageProps = {
  searchParams?: Promise<{
    notice?: string;
    tone?: string;
  }>;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMEZONES = ["Europe/London", "Asia/Karachi", "Asia/Dubai", "Asia/Riyadh", "America/New_York", "America/Toronto", "UTC"];

function NoticeBanner({ notice, tone }: { notice?: string; tone?: string }) {
  if (!notice) return null;

  return (
    <div
      className={`rounded-[20px] border px-5 py-4 text-sm font-medium shadow-sm ${
        tone === "error"
          ? "border-[#f0cccc] bg-[#fff4f4] text-[#a23c3c]"
          : "border-[#cfe9d8] bg-[#edf8ef] text-[#2f6b4b]"
      }`}
    >
      {notice}
    </div>
  );
}

function noticeHref(message: string, tone: "success" | "error" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  return `/teacher/live-sessions?${params.toString()}`;
}

export default async function TeacherLiveSessionsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  const params = searchParams ? await searchParams : {};

  async function requestSessionAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

    try {
      await requestTeacherLiveClass(
        {
          programId: String(formData.get("programId") || ""),
          title: String(formData.get("title") || ""),
          weekday: Number(formData.get("weekday") || 0),
          startTime: String(formData.get("startTime") || "16:00"),
          endTime: String(formData.get("endTime") || "17:00"),
          timezone: String(formData.get("timezone") || "Europe/London"),
          createZoomMeeting: false,
        },
        currentSession.user.id,
      );

      revalidatePath("/teacher/live-sessions");
      revalidatePath("/admin/classes");
      redirect(noticeHref("Zoom session request sent to admin for approval."));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to request this Zoom session.";
      redirect(noticeHref(message, "error"));
    }
  }

  return (
    <TeacherDashboardFrame
      title="Live Sessions"
      subtitle="Request Zoom sessions for your assigned programmes. Admin approval creates the final recurring Zoom meeting and notifies learners."
      navItems={getTeacherNavItems()}
    >
      <NoticeBanner notice={params.notice} tone={params.tone} />

      <TeacherMetricGrid
        metrics={[
          { label: "Assigned programs", value: String(dashboard.rosters.length), hint: "Programmes you can request sessions for." },
          { label: "Existing sessions", value: String(dashboard.classes.length), hint: "Approved or pending live classes." },
          { label: "Students", value: String(dashboard.metrics.students), hint: "Learners reached after approval." },
          { label: "Approval", value: "Admin", hint: "Teacher requests are reviewed before publishing." },
        ]}
      />

      <TeacherSection eyebrow="Zoom request" title="Request a recurring live session">
        <form action={requestSessionAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            Program
            <select name="programId" required className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
              {dashboard.rosters.map((roster) => (
                <option key={roster.programId} value={roster.programId}>
                  {roster.title}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#22304a] xl:col-span-3">
            Session title
            <input name="title" required placeholder="Revision circle - Week 3" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
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

          <button className="rounded-full bg-[#0f4d81] px-5 py-3 text-sm font-semibold text-white xl:col-span-4 xl:justify-self-start">
            Send for admin approval
          </button>
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
              <p className="mt-2 text-sm text-[#5f6b7a]">
                {entry.meetingUrl ? "Approved and linked to Zoom" : "Waiting for admin approval or Zoom sync"}
              </p>
            </div>
          ))}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
