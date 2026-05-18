export const dynamic = "force-dynamic";

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminLoginModal } from "@/components/admin/AdminLoginModal";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { updateRoomAssignmentNotes } from "@/lib/live-classes/rooms";
import {
  approveTeacherLiveClass,
  cleanLiveClassTitle,
  createLiveClass,
  getLiveClassAudienceLabel,
  PENDING_ZOOM_PROVIDER,
  rejectTeacherLiveClass,
  syncScheduleToZoom,
  WHOLE_GEN_MUMIN_PROGRAM_ID,
} from "@/lib/live-classes/service";
import { isZoomConfigured } from "@/lib/zoom/client";

type PageProps = {
  searchParams?: Promise<{
    notice?: string;
    tone?: string;
  }>;
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const AUDIENCE_OPTIONS = [
  { value: "PK_UK", label: "Pakistan and UK students" },
  { value: "US_CA", label: "USA and Canada students" },
  { value: "AU", label: "Australia students" },
  { value: "ALL", label: "All students" },
];

function noticeHref(message: string, tone: "success" | "error" | "danger" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  return `/admin/classes?${params.toString()}`;
}

function formatTeacherName(teacher: {
  user: { firstName: string; lastName: string | null; email: string };
}) {
  return `${teacher.user.firstName} ${teacher.user.lastName ?? ""}`.trim() || teacher.user.email;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export default async function AdminClassesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  const params = searchParams ? await searchParams : {};

  if (!session || session.user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-[#f3f5f7] py-16">
        <div className="section-container">
          <div className="rounded-[32px] border border-[#e1d8cb] bg-white px-8 py-10 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
              Gen-Mumins Admin
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-[#22304a]">Live classes</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-[#5f6b7a]">
              Sign in to manage Zoom-backed class schedules.
            </p>
          </div>
        </div>
        <AdminLoginModal />
      </div>
    );
  }

  async function createClassAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin/classes");

    try {
      await createLiveClass(
        {
          programId: String(formData.get("programId") || ""),
          teacherIds: formData.getAll("teacherIds").map(String).filter(Boolean),
          title: String(formData.get("title") || ""),
          startDate: String(formData.get("startDate") || ""),
          weekday: Number(formData.get("weekday") || 0),
          startTime: String(formData.get("startTime") || "16:00"),
          endTime: String(formData.get("endTime") || "17:00"),
          timezone: String(formData.get("timezone") || "Europe/London"),
          createZoomMeeting: formData.get("createZoomMeeting") === "on",
          audienceGroup: String(formData.get("audienceGroup") || "ALL") as "ALL" | "PK_UK" | "US_CA" | "AU",
          waitingRoom: formData.get("waitingRoom") === "on",
          joinBeforeHost: formData.get("joinBeforeHost") === "on",
          muteUponEntry: formData.get("muteUponEntry") === "on",
          autoRecording: String(formData.get("autoRecording") || "cloud") as "none" | "local" | "cloud",
          passcode: String(formData.get("passcode") || ""),
          showToStudents: formData.get("showToStudents") === "on",
        },
        currentSession.user.id,
      );

      revalidatePath("/admin/classes");
      revalidatePath("/teacher/schedule");
      revalidatePath("/student/schedule");
      revalidatePath("/parent/schedule");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create live class.";
      redirect(noticeHref(message, "error"));
    }
    redirect(noticeHref("Live class created successfully."));
  }

  async function syncZoomAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin/classes");

    try {
      await syncScheduleToZoom(String(formData.get("scheduleId") || ""));
      revalidatePath("/admin/classes");
      revalidatePath("/teacher/schedule");
      revalidatePath("/student/schedule");
      revalidatePath("/parent/schedule");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sync this class to Zoom.";
      redirect(noticeHref(message, "error"));
    }
    redirect(noticeHref("Zoom meeting created and linked to the class."));
  }

  async function approveRequestAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin/classes");

    try {
      await approveTeacherLiveClass(String(formData.get("scheduleId") || ""), currentSession.user.id);
      revalidatePath("/admin/classes");
      revalidatePath("/teacher/schedule");
      revalidatePath("/student");
      revalidatePath("/student/schedule");
      revalidatePath("/parent");
      revalidatePath("/parent/schedule");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to approve this Zoom request.";
      redirect(noticeHref(message, "error"));
    }
    redirect(noticeHref("Teacher Zoom meeting request approved."));
  }

  async function rejectRequestAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin/classes");

    try {
      await rejectTeacherLiveClass(String(formData.get("scheduleId") || ""));
      revalidatePath("/admin/classes");
      revalidatePath("/teacher/schedule");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to decline this Zoom request.";
      redirect(noticeHref(message, "error"));
    }
    redirect(noticeHref("Teacher Zoom meeting request declined.", "danger"));
  }

  async function deleteClassAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin/classes");

    const scheduleId = String(formData.get("scheduleId") || "");
    if (!scheduleId) redirect(noticeHref("Choose a live class to delete.", "error"));

    try {
      await db.classSchedule.delete({ where: { id: scheduleId } });
      revalidatePath("/admin/classes");
      revalidatePath("/teacher/live-sessions");
      revalidatePath("/teacher/schedule");
      revalidatePath("/student");
      revalidatePath("/student/schedule");
      revalidatePath("/parent");
      revalidatePath("/parent/schedule");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete this live class.";
      redirect(noticeHref(message, "error"));
    }

    redirect(noticeHref("Live class deleted from LMS dashboards.", "danger"));
  }

  async function importRoomAssignmentsAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin/classes");

    const programId = String(formData.get("programId") || "");
    const subject = String(formData.get("subject") || "");
    const roomName = String(formData.get("roomName") || "");
    const teacherName = String(formData.get("teacherName") || "");
    const level = String(formData.get("level") || "");
    const instructions = String(formData.get("instructions") || "");
    const csv = String(formData.get("csv") || "");

    const enrollments = await db.enrollment.findMany({
      where: {
        programId,
        status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] },
      },
      include: {
        student: { include: { user: true } },
      },
    });

    let updated = 0;
    const rows = csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const row of rows) {
      const [serial, , , childName] = parseCsvLine(row);
      if (!serial || !childName || serial.toLowerCase().includes("serial")) continue;

      const targetName = normalizeText(childName);
      const enrollment = enrollments.find((entry) => {
        const names = [
          entry.student.displayName,
          `${entry.student.user.firstName} ${entry.student.user.lastName ?? ""}`,
          entry.student.user.firstName,
        ].map(normalizeText);
        return names.some((name) => name === targetName || name.includes(targetName) || targetName.includes(name));
      });
      if (!enrollment) continue;

      await db.studentProfile.update({
        where: { id: enrollment.studentId },
        data: {
          learningNotes: updateRoomAssignmentNotes(enrollment.student.learningNotes, programId, {
            subject,
            roomName,
            roomCode: serial,
            teacherName,
            level,
            instructions,
          }),
        },
      });
      updated += 1;
    }

    revalidatePath("/admin/classes");
    revalidatePath("/teacher/classes");
    revalidatePath("/parent");
    revalidatePath("/parent/courses");
    revalidatePath("/student");
    revalidatePath("/student/courses");
    redirect(noticeHref(`Imported ${updated} room assignments.`));
  }

  const [programs, teachers, schedules] = await Promise.all([
    db.program.findMany({
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    }),
    db.teacherProfile.findMany({
      where: { isActive: true },
      include: { user: true },
      orderBy: { createdAt: "desc" },
    }),
    db.classSchedule.findMany({
      orderBy: [{ weekday: "asc" }, { startTime: "asc" }],
      include: {
        program: true,
        teacher: { include: { user: true } },
      },
    }),
  ]);
  const pendingSchedules = schedules.filter((schedule) => schedule.meetingProvider === PENDING_ZOOM_PROVIDER);

  return (
    <div className="min-h-screen bg-[#edf2f6] py-6">
      <div className="section-container space-y-5">
        <ActionToast message={params.notice} tone={params.tone} />

        <div className="rounded-[28px] border border-[#dce4ed] bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">
                Admin / Live Classes
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-[#22304a]">Zoom class control</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[#617184]">
                Create weekly LMS schedules, generate recurring Zoom links, and notify enrolled families.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]"
              >
                Admin home
              </Link>
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  isZoomConfigured() ? "bg-[#effaf3] text-[#2f6b4b]" : "bg-[#fff7eb] text-[#8a6326]"
                }`}
              >
                Zoom {isZoomConfigured() ? "configured" : "needs env"}
              </span>
            </div>
          </div>
        </div>

        <section className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f7d8f]">Create class</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">New weekly Zoom class</h2>

          <form action={createClassAction} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 text-sm font-semibold text-[#22304a]">
              Program
              <select name="programId" required className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
                <option value={WHOLE_GEN_MUMIN_PROGRAM_ID}>Whole Gen-Mumin</option>
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.title}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-[#22304a]">
              Teachers
              <select name="teacherIds" required multiple className="min-h-36 w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {formatTeacherName(teacher)}
                  </option>
                ))}
              </select>
              <span className="block text-xs font-normal text-[#617184]">Use Ctrl/Cmd to choose multiple teachers. Whole Gen-Mumin can include all teachers.</span>
            </label>

            <label className="space-y-2 text-sm font-semibold text-[#22304a] xl:col-span-2">
              Class title
              <input
                name="title"
                required
                placeholder="Arabic Beginners - Group A"
                className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm"
              />
            </label>

            <label className="space-y-2 text-sm font-semibold text-[#22304a]">
              Start date
              <input name="startDate" type="date" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
            </label>

            <label className="space-y-2 text-sm font-semibold text-[#22304a]">
              Day
              <select name="weekday" defaultValue="6" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
                {WEEKDAYS.map((weekday, index) => (
                  <option key={weekday} value={index}>
                    {weekday}
                  </option>
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
              <select name="timezone" defaultValue="Europe/London" required className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
                {["Europe/London", "Asia/Karachi", "Asia/Dubai", "Asia/Riyadh", "America/New_York", "America/Toronto", "UTC"].map((timezone) => (
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

            <label className="space-y-2 text-sm font-semibold text-[#22304a]">
              Student audience
              <select name="audienceGroup" defaultValue="PK_UK" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
                {AUDIENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-semibold text-[#22304a] xl:col-span-2">
              Optional passcode
              <input name="passcode" placeholder="Leave blank for Zoom default" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-[#dce4ed] bg-[#fbfdff] px-4 py-3 text-sm font-semibold text-[#22304a] xl:col-span-4">
              <input name="createZoomMeeting" type="checkbox" defaultChecked className="h-4 w-4" />
              Create recurring Zoom meeting immediately
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-[#dce4ed] bg-[#fbfdff] px-4 py-3 text-sm font-semibold text-[#22304a] xl:col-span-4">
              <input name="showToStudents" type="checkbox" defaultChecked className="h-4 w-4" />
              Show this session in student and parent dashboards
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-[#dce4ed] bg-[#fbfdff] px-4 py-3 text-sm font-semibold text-[#22304a]">
              <input name="waitingRoom" type="checkbox" className="h-4 w-4" />
              Waiting room / admit manually
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-[#dce4ed] bg-[#fbfdff] px-4 py-3 text-sm font-semibold text-[#22304a]">
              <input name="muteUponEntry" type="checkbox" defaultChecked className="h-4 w-4" />
              Mute on entry
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-[#dce4ed] bg-[#fbfdff] px-4 py-3 text-sm font-semibold text-[#22304a]">
              <input name="joinBeforeHost" type="checkbox" className="h-4 w-4" />
              Join before host
            </label>

            <button className="rounded-full bg-[#0f4d81] px-5 py-3 text-sm font-semibold text-white xl:col-span-4 xl:justify-self-start">
              Create live class
            </button>
          </form>
        </section>

        <section className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f7d8f]">Student rooms</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Bulk import Zoom room codes</h2>
          <p className="mt-2 text-sm leading-6 text-[#617184]">
            Paste spreadsheet rows as CSV: serial,parent/location,location,child name,age. The serial number becomes the LMS room code shown to the student.
          </p>
          <form action={importRoomAssignmentsAction} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 text-sm font-semibold text-[#22304a]">
              Programme
              <select name="programId" required className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>{program.title}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-semibold text-[#22304a]">
              Subject
              <input name="subject" placeholder="Arabic / Tajweed" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
            </label>
            <label className="space-y-2 text-sm font-semibold text-[#22304a]">
              Room name
              <input name="roomName" required placeholder="Arabic 8:00pm Abubakar" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
            </label>
            <label className="space-y-2 text-sm font-semibold text-[#22304a]">
              Teacher
              <input name="teacherName" placeholder="Abubakar Sadique" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
            </label>
            <label className="space-y-2 text-sm font-semibold text-[#22304a] xl:col-span-2">
              Level/group
              <input name="level" placeholder="Beginner / Age 8-10 / Pakistan-UK group" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
            </label>
            <label className="space-y-2 text-sm font-semibold text-[#22304a] xl:col-span-2">
              Student instructions
              <input name="instructions" placeholder="Join the Zoom link, then enter/request your assigned room code." className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
            </label>
            <label className="space-y-2 text-sm font-semibold text-[#22304a] xl:col-span-4">
              CSV rows
              <textarea
                name="csv"
                rows={8}
                required
                placeholder={'GMB1-001,Nida & Asif,Scotland,Mustafa,12\nGMB1-002,Farah,Pakistan,Yashur Muhammad,10'}
                className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm"
              />
            </label>
            <button className="rounded-full bg-[#0f4d81] px-5 py-3 text-sm font-semibold text-white xl:col-span-4 xl:justify-self-start">
              Import room codes
            </button>
          </form>
        </section>

        {pendingSchedules.length ? (
          <section className="rounded-[28px] border border-[#f0d7aa] bg-[#fffaf1] p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6326]">Teacher requests</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Pending Zoom approvals</h2>
            <div className="mt-5 space-y-4">
              {pendingSchedules.map((schedule) => (
                <div key={schedule.id} className="rounded-[20px] border border-[#efd9b6] bg-white p-5">
                  <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_auto] xl:items-center">
                    <div>
                      <p className="font-semibold text-[#22304a]">{cleanLiveClassTitle(schedule.title)}</p>
                      <p className="mt-1 text-sm text-[#617184]">{schedule.program.title}</p>
                      <p className="mt-1 text-xs font-semibold text-[#2a76aa]">{getLiveClassAudienceLabel(schedule.title)}</p>
                    </div>
                    <div className="text-sm text-[#22304a]">
                      <p>{formatTeacherName(schedule.teacher)}</p>
                      <p className="mt-1 text-[#617184]">{WEEKDAYS[schedule.weekday]} {schedule.startTime}-{schedule.endTime}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 xl:justify-end">
                      <form action={approveRequestAction}>
                        <input type="hidden" name="scheduleId" value={schedule.id} />
                        <button className="rounded-full bg-[#0f4d81] px-4 py-2 text-sm font-semibold text-white">
                          Approve and create Zoom
                        </button>
                      </form>
                      <form action={rejectRequestAction}>
                        <input type="hidden" name="scheduleId" value={schedule.id} />
                        <button className="rounded-full border border-[#efb3b3] bg-white px-4 py-2 text-sm font-semibold text-[#b24646]">
                          Decline
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f7d8f]">Schedule</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Existing live classes</h2>

          <div className="mt-5 space-y-4">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="rounded-[20px] border border-[#dce4ed] bg-[#fbfdff] p-5">
                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr_0.8fr_auto] xl:items-center">
                  <div>
                    <p className="font-semibold text-[#22304a]">{cleanLiveClassTitle(schedule.title)}</p>
                    <p className="mt-1 text-sm text-[#617184]">{schedule.program.title}</p>
                    <p className="mt-1 text-xs font-semibold text-[#2a76aa]">{getLiveClassAudienceLabel(schedule.title)}</p>
                  </div>
                  <div className="text-sm text-[#22304a]">
                    <p>{formatTeacherName(schedule.teacher)}</p>
                    <p className="mt-1 text-[#617184]">{WEEKDAYS[schedule.weekday]} {schedule.startTime}-{schedule.endTime}</p>
                  </div>
                  <div className="text-sm text-[#22304a]">
                    <p>{schedule.meetingProvider ?? "No provider"}</p>
                    <p className="mt-1 text-[#617184]">{schedule.meetingId ? `Meeting ${schedule.meetingId}` : "No Zoom meeting yet"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {schedule.meetingUrl ? (
                      <>
                        <Link
                          href={`/admin/classes/${schedule.id}/start`}
                          target="_blank"
                          className="rounded-full bg-[#0f4d81] px-4 py-2 text-sm font-semibold text-white"
                        >
                          Start as host
                        </Link>
                        <Link
                          href={schedule.meetingUrl}
                          target="_blank"
                          className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]"
                        >
                          Public link
                        </Link>
                      </>
                    ) : null}
                    {!schedule.meetingUrl ? (
                      <form action={syncZoomAction}>
                        <input type="hidden" name="scheduleId" value={schedule.id} />
                        <button className="rounded-full bg-[#0f4d81] px-4 py-2 text-sm font-semibold text-white">
                          Sync Zoom
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteClassAction}>
                      <input type="hidden" name="scheduleId" value={schedule.id} />
                      <button className="rounded-full border border-[#efb3b3] bg-white px-4 py-2 text-sm font-semibold text-[#b24646]">
                        Delete
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ))}
            {!schedules.length ? (
              <p className="rounded-[20px] bg-[#fbf6ef] p-5 text-sm text-[#617184]">
                No live class schedules yet.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
