import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

export default async function TeacherClassesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

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

  return (
    <TeacherDashboardFrame
      title="Classes"
      subtitle="See assigned programmes, student rosters, and class-specific teaching load."
      navItems={getTeacherNavItems()}
    >
      <TeacherMetricGrid
        metrics={[
          { label: "Classes", value: String(dashboard.classes.length), hint: "Assigned timetable entries." },
          { label: "Programs", value: String(dashboard.rosters.length), hint: "Programmes assigned to you." },
          { label: "Students", value: String(dashboard.metrics.students), hint: "Total learners in your roster." },
          { label: "Upcoming", value: String(dashboard.metrics.upcomingLessons), hint: "Weekly upcoming sessions." },
        ]}
      />

      <TeacherSection eyebrow="Class list" title="Assigned classes and rosters">
        <div className="space-y-4">
          {dashboard.rosters.map((roster) => {
            const classInfo = dashboard.classes.find((entry) => entry.title === roster.title);
            return (
              <div key={roster.programId} className="rounded-[24px] bg-[#fbf6ef] p-5">
                <h3 className="text-xl font-semibold text-[#22304a]">{roster.title}</h3>
                {classInfo ? (
                  <p className="mt-2 text-sm text-[#5f6b7a]">
                    {formatWeekday(classInfo.weekday)} • {classInfo.startTime}-{classInfo.endTime} • {classInfo.timezone}
                  </p>
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
