export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";
import { TeacherDashboardFrame, TeacherInfoList, TeacherMetricGrid, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { syncTeacherProgramRoster } from "@/lib/live-classes/service";

type PageProps = {
  searchParams?: Promise<{ notice?: string; tone?: string }>;
};

function noticeHref(message: string, tone: "success" | "error" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  return `/teacher/roster?${params.toString()}`;
}

export default async function TeacherRosterPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  const params = searchParams ? await searchParams : {};

  const teacher = await db.teacherProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      user: true,
      programAssignments: {
        include: {
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
        },
      },
      programRosters: {
        include: {
          student: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  if (!teacher) redirect("/teacher-registration");

  const selectedStudentIdsByProgram = new Map<string, Set<string>>();
  for (const rosterEntry of teacher.programRosters) {
    const selected = selectedStudentIdsByProgram.get(rosterEntry.programId) ?? new Set<string>();
    selected.add(rosterEntry.studentId);
    selectedStudentIdsByProgram.set(rosterEntry.programId, selected);
  }

  async function saveProgramRosterAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

    const teacherProfile = await db.teacherProfile.findUnique({
      where: { userId: currentSession.user.id },
      include: { programAssignments: true },
    });
    if (!teacherProfile) redirect("/teacher-registration");

    const programId = String(formData.get("programId") || "");
    if (!teacherProfile.programAssignments.some((assignment) => assignment.programId === programId)) {
      redirect(noticeHref("You can only update rosters for your assigned programmes.", "error"));
    }

    const selectedIds = formData.getAll("studentIds").filter((value): value is string => typeof value === "string");

    const enrollments = await db.enrollment.findMany({
      where: {
        programId,
        status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] },
      },
      select: { studentId: true },
    });

    const validStudentIds = new Set(enrollments.map((entry) => entry.studentId));
    const studentIds = selectedIds.filter((id) => validStudentIds.has(id));

    await syncTeacherProgramRoster(teacherProfile.id, programId, studentIds);

    revalidatePath("/teacher/roster");
    revalidatePath("/teacher/classes");
    revalidatePath("/teacher/live-sessions");
    redirect(noticeHref("Roster saved successfully.", "success"));
  }

  return (
    <TeacherDashboardFrame
      title="Student Roster"
      subtitle="Create and reuse default programme rosters for live session notifications and student group assignments."
      navItems={getTeacherNavItems()}
    >
      <ActionToast message={params.notice} tone={params.tone} />

      <TeacherMetricGrid
        metrics={[
          { label: "Programs", value: String(dashboard.rosters.length), hint: "Programmes assigned to you." },
          { label: "Sessions", value: String(dashboard.classes.length), hint: "Live sessions available to your roster." },
          { label: "Students", value: String(dashboard.metrics.students), hint: "Learners reachable by your default roster." },
          { label: "Default roster", value: "Saved", hint: "Updates will apply to new session notifications." },
        ]}
      />

      <TeacherSection eyebrow="Default roster" title="Choose students for each programme">
        <p className="text-sm leading-6 text-[#617184]">
          Your selected roster becomes the default audience for future session notifications and reduces noise for teachers with split groups.
        </p>
        <div className="mt-6 space-y-10">
          {teacher.programAssignments.map((assignment) => {
            const selectedIds = selectedStudentIdsByProgram.get(assignment.programId) ?? new Set<string>();
            return (
              <form key={assignment.programId} action={saveProgramRosterAction} className="rounded-3xl border border-[#e5e9ef] bg-[#fbfcff] p-6">
                <input type="hidden" name="programId" value={assignment.programId} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#22304a]">{assignment.program.title}</h3>
                    <p className="mt-1 text-sm text-[#5f6b7a]">Select the students who should receive live session notifications by default.</p>
                  </div>
                  <FormSubmitButton className="rounded-full bg-[#0f4d81] px-5 py-3 text-sm font-semibold text-white" pendingLabel="Saving roster...">
                    Save roster
                  </FormSubmitButton>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {assignment.program.enrollments.map((enrollment) => {
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
                        <span className="mt-1 text-xs text-[#8a94a3]">{enrollment.status.replace(/_/g, " ")}</span>
                      </label>
                    );
                  })}
                </div>
              </form>
            );
          })}
        </div>
      </TeacherSection>

      <TeacherSection eyebrow="Helpful links" title="Related settings">
        <TeacherInfoList
          items={[
            "Use default rosters to make live session notifications more relevant for split programme groups.",
            "You can override the roster for an individual session from the Live Sessions page.",
          ]}
          emptyLabel="No roster information is available yet."
        />
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
