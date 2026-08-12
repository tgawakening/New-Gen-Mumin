export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";
import { TeacherDashboardFrame, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { displayProgramTitle } from "@/lib/genm/curriculum";
import { getProgramEligibleRosterStudents, getTeacherProgramRosterEntries, syncTeacherProgramRoster } from "@/lib/live-classes/service";

type Props = { params: Promise<{ teacherId: string }> };

function adminTeacherNav(teacherId: string) {
  return [
    { label: "Dashboard", href: `/admin/teachers?teacher=${teacherId}`, icon: "home" },
    { label: "Roster", href: `/admin/teachers/${teacherId}/roster`, icon: "check" },
    { label: "Live Sessions", href: "/admin/classes", icon: "video" },
    { label: "Classes", href: "/admin/classes", icon: "classes" },
    { label: "Hours Log", href: `/admin/hours-log?teacherId=${teacherId}`, icon: "reports" },
    { label: "Recordings", href: `/admin/recordings?teacher=${teacherId}`, icon: "video" },
    { label: "Materials", href: "/admin/materials", icon: "folder" },
    { label: "Feedback", href: "/admin/feedback", icon: "journal" },
    { label: "Reports", href: `/admin/hours-log?teacherId=${teacherId}`, icon: "reports" },
    { label: "Admin Home", href: "/admin", icon: "profile" },
  ];
}

export default async function AdminTeacherRosterPage({ params }: Props) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const { teacherId } = await params;
  const teacher = await db.teacherProfile.findUnique({
    where: { id: teacherId },
    include: { user: true, programAssignments: { include: { program: true } } },
  });
  if (!teacher) redirect("/admin/teachers");

  const entries = await getTeacherProgramRosterEntries(teacher.id);
  const selectedByProgram = new Map<string, Set<string>>();
  for (const entry of entries) {
    const selected = selectedByProgram.get(entry.programId) ?? new Set<string>();
    selected.add(entry.studentId);
    selectedByProgram.set(entry.programId, selected);
  }
  const eligibleByProgram = new Map(await Promise.all(teacher.programAssignments.map(async (assignment) => [assignment.programId, await getProgramEligibleRosterStudents(assignment.programId)] as const)));

  async function saveRoster(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "ADMIN") redirect("/admin");
    const requestedTeacherId = String(formData.get("teacherId") || "");
    const programId = String(formData.get("programId") || "");
    const target = await db.teacherProfile.findFirst({ where: { id: requestedTeacherId, programAssignments: { some: { programId } } }, select: { id: true } });
    if (!target) redirect("/admin/teachers");
    const eligible = await getProgramEligibleRosterStudents(programId);
    const allowed = new Set(eligible.map((student) => student.id));
    const studentIds = formData.getAll("studentIds").map(String).filter((id) => allowed.has(id));
    await syncTeacherProgramRoster(target.id, programId, studentIds);
    revalidatePath(`/admin/teachers/${target.id}/roster`);
    revalidatePath("/teacher/roster");
    revalidatePath("/teacher/live-sessions");
    redirect(`/admin/teachers/${target.id}/roster?saved=1`);
  }

  const name = `${teacher.user.firstName} ${teacher.user.lastName ?? ""}`.trim();
  return (
    <TeacherDashboardFrame title={`${name} - roster`} subtitle="Admin roster management. Changes appear in the teacher's own dashboard without changing their login or active sessions." navItems={adminTeacherNav(teacher.id)}>
      <TeacherSection eyebrow="Admin teacher access" title="Programme rosters" action={<Link href={`/admin/teachers?teacher=${teacher.id}`} className="rounded-full border px-4 py-2 text-sm font-semibold text-[#22304a]">Back to dashboard</Link>}>
        <div className="space-y-7">
          {teacher.programAssignments.map((assignment) => {
            const students = eligibleByProgram.get(assignment.programId) ?? [];
            const selected = selectedByProgram.get(assignment.programId) ?? new Set<string>();
            return (
              <form key={assignment.programId} action={saveRoster} className="rounded-3xl border border-[#e1e7ee] bg-[#f9fbfd] p-5 sm:p-6">
                <input type="hidden" name="teacherId" value={teacher.id} />
                <input type="hidden" name="programId" value={assignment.programId} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><h3 className="text-lg font-semibold text-[#22304a]">{displayProgramTitle(assignment.program.title)}</h3><p className="mt-1 text-sm text-[#617184]">Choose learners assigned to {name}.</p></div>
                  <FormSubmitButton className="rounded-full bg-[#0f4d81] px-5 py-3 text-sm font-semibold text-white" pendingLabel="Saving...">Save roster</FormSubmitButton>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {students.map((student) => {
                    const studentName = student.displayName || `${student.user.firstName} ${student.user.lastName ?? ""}`.trim();
                    return <label key={student.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 text-sm text-[#22304a]"><input type="checkbox" name="studentIds" value={student.id} defaultChecked={selected.has(student.id)} className="mt-1 h-4 w-4" /><span><strong className="block">{studentName}</strong><span className="mt-1 block text-xs text-[#6d7785]">{student.user.email}</span></span></label>;
                  })}
                  {!students.length ? <p className="text-sm text-[#617184]">No eligible active learners are available for this programme.</p> : null}
                </div>
              </form>
            );
          })}
          {!teacher.programAssignments.length ? <p className="rounded-2xl bg-[#fbf6ef] p-5 text-sm text-[#617184]">Assign a programme to this teacher before creating a roster.</p> : null}
        </div>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
