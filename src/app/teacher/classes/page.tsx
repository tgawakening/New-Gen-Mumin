import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { updateRoomAssignmentNotes } from "@/lib/live-classes/rooms";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import {
  TeacherDashboardFrame,
  TeacherMetricGrid,
  TeacherSection,
  formatWeekday,
} from "@/components/dashboard/teacher/TeacherDashboardFrame";

type PageProps = {
  searchParams?: Promise<{
    notice?: string;
    tone?: string;
  }>;
};

function noticeHref(message: string, tone: "success" | "error" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  return `/teacher/classes?${params.toString()}`;
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

export default async function TeacherClassesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const params = searchParams ? await searchParams : {};

  async function saveRoomAssignmentAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

    const teacher = await db.teacherProfile.findUnique({
      where: { userId: currentSession.user.id },
      include: { programAssignments: true },
    });
    if (!teacher) redirect("/teacher-registration");

    const programId = String(formData.get("programId") || "");
    const studentId = String(formData.get("studentId") || "");
    if (!teacher.programAssignments.some((assignment) => assignment.programId === programId)) {
      throw new Error("You can only update rooms for your assigned programmes.");
    }

    const enrollment = await db.enrollment.findFirst({
      where: {
        programId,
        studentId,
        status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] },
      },
      include: { student: true },
    });
    if (!enrollment) throw new Error("Student enrollment not found.");

    await db.studentProfile.update({
      where: { id: studentId },
      data: {
        learningNotes: updateRoomAssignmentNotes(enrollment.student.learningNotes, programId, {
          subject: String(formData.get("subject") || ""),
          roomName: String(formData.get("roomName") || ""),
          roomCode: String(formData.get("roomCode") || ""),
          teacherName: String(formData.get("teacherName") || ""),
          level: String(formData.get("level") || ""),
          instructions: String(formData.get("instructions") || ""),
        }),
      },
    });

    revalidatePath("/teacher/classes");
    revalidatePath("/parent");
    revalidatePath("/parent/courses");
    revalidatePath("/student");
    revalidatePath("/student/courses");
    redirect("/teacher/classes?updated=room");
  }

  async function importRoomAssignmentsAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

    const teacher = await db.teacherProfile.findUnique({
      where: { userId: currentSession.user.id },
      include: { user: true, programAssignments: true },
    });
    if (!teacher) redirect("/teacher-registration");

    const programId = String(formData.get("programId") || "");
    if (!teacher.programAssignments.some((assignment) => assignment.programId === programId)) {
      redirect(noticeHref("You can only import rooms for your assigned programmes.", "error"));
    }

    const subject = String(formData.get("subject") || "");
    const roomName = String(formData.get("roomName") || "");
    const teacherName = String(formData.get("teacherName") || `${teacher.user.firstName} ${teacher.user.lastName ?? ""}`.trim());
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

    revalidatePath("/teacher/classes");
    revalidatePath("/admin/classes");
    revalidatePath("/parent");
    revalidatePath("/parent/courses");
    revalidatePath("/student");
    revalidatePath("/student/courses");
    redirect(noticeHref(`Imported ${updated} room assignments.`));
  }

  return (
    <TeacherDashboardFrame
      title="Classes"
      subtitle="See assigned programmes, student rosters, and class-specific teaching load."
      navItems={getTeacherNavItems()}
    >
      <ActionToast message={params.notice} tone={params.tone} />

      <TeacherMetricGrid
        metrics={[
          { label: "Classes", value: String(dashboard.classes.length), hint: "Assigned timetable entries." },
          { label: "Programs", value: String(dashboard.rosters.length), hint: "Programmes assigned to you." },
          { label: "Students", value: String(dashboard.metrics.students), hint: "Total learners in your roster." },
          { label: "Upcoming", value: String(dashboard.metrics.upcomingLessons), hint: "Weekly upcoming sessions." },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#5f6b7a]">Manage default programme rosters to control which students receive session and schedule updates.</p>
        <Link
          href="/teacher/roster"
          className="rounded-full border border-[#cdd9e4] bg-white px-4 py-2 text-xs font-semibold text-[#0f4d81]"
        >
          Manage default roster
        </Link>
      </div>

      <TeacherSection eyebrow="Student rooms" title="Bulk import Zoom room codes">
        <p className="text-sm leading-6 text-[#617184]">
          Paste spreadsheet rows as CSV: serial,parent/location,location,child name,age. The serial number becomes the room code shown to students.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {dashboard.rosters.map((roster) => {
            const hasRoomAssignments = roster.students.some((student) => student.roomAssignment?.roomCode || student.roomAssignment?.roomName);
            return hasRoomAssignments ? (
              <Link
                key={roster.programId}
                href={`/api/classes/breakout-csv?programId=${roster.programId}`}
                className="rounded-full border border-[#cdd9e4] bg-white px-4 py-2 text-xs font-semibold text-[#0f4d81]"
              >
                Export Zoom CSV - {roster.title}
              </Link>
            ) : (
              <span
                key={roster.programId}
                title="Assign or import real student room codes before exporting."
                className="cursor-not-allowed rounded-full border border-[#dce4ed] bg-[#f4f7fa] px-4 py-2 text-xs font-semibold text-[#8a96a5]"
              >
                Export locked - {roster.title}
              </span>
            );
          })}
        </div>
        <form action={importRoomAssignmentsAction} className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm font-semibold text-[#22304a]">
            Programme
            <select name="programId" required className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm">
              {dashboard.rosters.map((roster) => (
                <option key={roster.programId} value={roster.programId}>{roster.title}</option>
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
            <input name="teacherName" defaultValue={dashboard.teacherName} placeholder="Teacher name" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-[#22304a] xl:col-span-2">
            Level/group
            <input name="level" placeholder="Beginner / Age 8-10 / Pakistan-UK group" className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-[#22304a] xl:col-span-2">
            Student instructions
            <input name="instructions" placeholder="Join the Zoom link, then use/request your assigned room code." className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm" />
          </label>
          <label className="space-y-2 text-sm font-semibold text-[#22304a] xl:col-span-4">
            CSV rows
            <textarea
              name="csv"
              rows={7}
              required
              placeholder={'GMB1-001,Nida & Asif,Scotland,Mustafa,12\nGMB1-002,Farah,Pakistan,Yashur Muhammad,10'}
              className="w-full rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm"
            />
          </label>
          <button className="rounded-full bg-[#0f4d81] px-5 py-3 text-sm font-semibold text-white xl:col-span-4 xl:justify-self-start">
            Import room codes
          </button>
        </form>
      </TeacherSection>

      <TeacherSection eyebrow="Class list" title="Assigned classes and rosters">
        <div className="space-y-4">
          {dashboard.rosters.map((roster) => {
            const classInfo = dashboard.classes.find((entry) => entry.title === roster.title);
            return (
              <div key={roster.programId} className="rounded-[24px] bg-[#fbf6ef] p-5">
                <h3 className="text-xl font-semibold text-[#22304a]">{roster.title}</h3>
                {classInfo ? (
                  <>
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {formatWeekday(classInfo.weekday)} • {classInfo.startTime}-{classInfo.endTime} • {classInfo.timezone}
                  </p>
                    {classInfo.meetingUrl ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <a
                          href={`/teacher/live-sessions/${classInfo.id}/start`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-[#0f4d81] px-4 py-2 text-sm font-semibold text-white"
                        >
                          Start as host
                        </a>
                        <a
                          href={`/teacher/live-sessions/${classInfo.id}/start?mode=member`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full bg-[#eef6ff] px-4 py-2 text-sm font-semibold text-[#0f4d81]"
                        >
                          Join as member
                        </a>
                        <Link
                          href={classInfo.meetingUrl}
                          target="_blank"
                          className="rounded-full border border-[#cdd9e4] bg-white px-4 py-2 text-sm font-semibold text-[#0f4d81]"
                        >
                          Open Zoom link
                        </Link>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {roster.students.map((student) => (
                    <div key={student.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-[#4d5a6b]">
                      <div className="font-semibold text-[#22304a]">{student.name}</div>
                      <div className="mt-1">{student.email}</div>
                      <div className="mt-1">{student.enrollmentStatus}</div>
                      {student.roomAssignment?.roomName || student.roomAssignment?.roomCode ? (
                        <div className="mt-3 rounded-xl bg-[#eef6ff] px-3 py-2 text-xs leading-5 text-[#2a4f72]">
                          <p className="font-semibold">{student.roomAssignment.roomName ?? "Zoom room"}</p>
                          {student.roomAssignment.roomCode ? <p>Code: {student.roomAssignment.roomCode}</p> : null}
                          {student.roomAssignment.teacherName ? <p>Teacher: {student.roomAssignment.teacherName}</p> : null}
                        </div>
                      ) : null}
                      <details className="mt-3 rounded-xl border border-[#eadfce] bg-[#fffaf5] p-3">
                        <summary className="cursor-pointer text-xs font-semibold text-[#8a6326]">Set Zoom room/group</summary>
                        <form action={saveRoomAssignmentAction} className="mt-3 grid gap-2">
                          <input type="hidden" name="programId" value={roster.programId} />
                          <input type="hidden" name="studentId" value={student.id} />
                          <input name="subject" defaultValue={student.roomAssignment?.subject ?? roster.title} placeholder="Subject e.g. Arabic / Tajweed" className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-xs" />
                          <input name="roomName" defaultValue={student.roomAssignment?.roomName ?? ""} placeholder="Room name e.g. Arabic 8:00pm Abubakar" className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-xs" />
                          <input name="roomCode" defaultValue={student.roomAssignment?.roomCode ?? ""} placeholder="Room code e.g. GMB1-001 or Breakout 1" className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-xs" />
                          <input name="teacherName" defaultValue={student.roomAssignment?.teacherName ?? ""} placeholder="Teacher name" className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-xs" />
                          <input name="level" defaultValue={student.roomAssignment?.level ?? ""} placeholder="Level/group e.g. beginner, age 8-10" className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-xs" />
                          <textarea name="instructions" defaultValue={student.roomAssignment?.instructions ?? ""} placeholder="Instructions for student after joining Zoom" className="rounded-xl border border-[#d8e3ed] px-3 py-2 text-xs" />
                          <button className="w-fit rounded-full bg-[#22304a] px-4 py-2 text-xs font-semibold text-white">Save room</button>
                        </form>
                      </details>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
