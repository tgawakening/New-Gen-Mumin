import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";

export default async function TeacherHomeworkPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));
  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  return <TeacherDashboardFrame title="Homework & Assignments" subtitle="Set learning tasks and follow your students’ submissions." navItems={getTeacherNavItems()}>
    <div className="flex flex-wrap gap-3"><Link href="/teacher/course-builder?tab=task&taskComposer=1" className="rounded-full bg-[#22304a] px-5 py-3 text-sm font-bold text-white">Create homework</Link><Link href="/teacher/course-builder?tab=task" className="rounded-full border border-[#d8c9ae] bg-white px-5 py-3 text-sm font-bold text-[#22304a]">Review submissions</Link></div>
    <TeacherSection eyebrow="Assigned learning" title="Recent homework">
      <div className="grid gap-3">{dashboard.assignments.map(task => <article key={task.id} className="rounded-2xl border border-[#eadfce] bg-[#fffbf5] p-4">
        <p className="text-xs font-semibold text-[#aa6822]">{task.programTitle}</p><h3 className="mt-1 font-bold text-[#22304a]">{task.title}</h3>
        {task.instructions ? <p className="mt-2 whitespace-pre-wrap text-sm text-[#617184]">{task.instructions}</p> : null}
        <p className="mt-3 text-sm text-[#617184]">{task.submissions} submissions{task.dueDate ? ` · Due ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: dashboard.profile.timezone || "UTC" }).format(task.dueDate)}` : " · No deadline"}</p>
        <Link href="/teacher/course-builder?tab=task" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-[#24466e]">Open homework workspace →</Link>
      </article>)}{!dashboard.assignments.length ? <p className="text-sm text-[#617184]">No homework yet. Create your first task in the curriculum builder.</p> : null}</div>
    </TeacherSection>
  </TeacherDashboardFrame>;
}
