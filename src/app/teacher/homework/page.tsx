import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, FileText, Plus, UploadCloud } from "lucide-react";
import { parseTaskPayload } from "@/lib/genm/published-content";
import { getGenMProgrammeByTitle, isArabicTajweedSlug } from "@/lib/genm/curriculum";
import { HOUSE_POINT_RULES } from "@/lib/community/point-rules";
import { moduleIsShared } from "@/lib/curriculum/handover";
import { homeworkIsOpen } from "@/lib/homework/timing";
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
  const workspace = (title: string) => {
    const programme = getGenMProgrammeByTitle(title);
    return programme ? `/teacher/course-builder/${isArabicTajweedSlug(programme.slug) ? "arabic" : programme.slug}` : "/teacher/course-builder";
  };
  const date = (value: Date | string | null, timezone?: string | null) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: timezone || dashboard.profile.timezone || "Europe/London" }).format(new Date(value)) : null;
  const createHref = `${dashboard.rosters[0] ? workspace(dashboard.rosters[0].title) : "/teacher/course-builder"}?tab=task&taskComposer=1`;
  return <TeacherDashboardFrame title="Homework & Assignments" subtitle="Share a clear task, attach learning files, and review your students' work." navItems={getTeacherNavItems()}>
    <section className="rounded-3xl border border-[#eadfce] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-2xl"><UploadCloud className="h-8 w-8 text-[#a16b24]" aria-hidden="true" /><h2 className="mt-3 text-xl font-bold text-[#22304a]">Set homework in a few simple steps</h2><p className="mt-2 text-sm leading-6 text-[#617184]">Choose the programme and module, write instructions, attach your files, and set launch and due dates.</p></div><Link href={createHref} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#22304a] px-5 py-3 text-sm font-bold text-white"><Plus className="h-4 w-4" />Create homework</Link></div>
      <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-3">{["Write the task and instructions", "Attach files and choose dates", "Review work, feedback and points"].map((step, index) => <li key={step} className="flex items-center gap-3 rounded-2xl bg-[#fbf6ef] p-3 text-[#4d5a6b]"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white font-bold text-[#946219]">{index + 1}</span>{step}</li>)}</ol>
      {dashboard.rosters.length > 1 ? <div className="mt-4 flex flex-wrap gap-2"><span className="content-center text-xs font-semibold text-[#617184]">Create for:</span>{dashboard.rosters.map((roster) => <Link key={roster.programId} href={`${workspace(roster.title)}?tab=task&taskComposer=1`} className="min-h-11 content-center rounded-full border border-[#dce4ed] px-4 py-2 text-xs font-semibold text-[#24466e]">{roster.title}</Link>)}</div> : null}
      <p className="mt-4 text-xs leading-5 text-[#617184]">Students earn {HOUSE_POINT_RULES.HOMEWORK_SUBMITTED.points} automatic Qabila points once when submitting. You can add separate performance points with feedback.</p>
    </section>
    <TeacherSection eyebrow="Assigned learning" title="Recent homework">
      <div className="grid gap-4">{dashboard.assignments.map((task) => {
        const content = parseTaskPayload(task.instructions);
        const scheduled = !homeworkIsOpen(content.launchAt);
        const shared = moduleIsShared(dashboard.moduleSharing ?? {}, task.programId, content.termId, content.weekLabel);
        const received = task.submissionDetails.filter((submission) => submission.canReview).length;
        const missing = task.submissionDetails.filter((submission) => !submission.canReview).length;
        const late = task.submissionDetails.filter((submission) => submission.submissionTiming === "Submitted late").length;
        const files = content.attachments.filter((file) => file && typeof file.name === "string" && safeResource(file.url));
        const links = content.resourceLinks.map(safeResource).filter((href): href is string => Boolean(href));
        return <article key={task.id} className="min-w-0 rounded-3xl border border-[#eadfce] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[#aa6822]">{task.programTitle}{content.weekLabel ? ` / ${content.weekLabel}` : ""}</p><h3 className="mt-1 text-lg font-bold text-[#22304a]">{task.title}</h3></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${scheduled ? "bg-blue-50 text-blue-800" : "bg-emerald-50 text-emerald-800"}`}>{!shared ? "Hidden from families" : scheduled ? "Scheduled" : "Available to students"}</span></div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#526175]">{typeof content.instructions === "string" && !content.instructions.startsWith("__GENM_TASK__:") ? content.instructions : "Open the homework workspace to check or update the instructions."}</p>
          <dl className="mt-4 grid gap-3 rounded-2xl bg-[#fbf6ef] p-4 text-sm sm:grid-cols-3"><div><dt className="text-xs text-[#617184]">Launch</dt><dd className="mt-1 font-semibold text-[#22304a]">{date(content.launchAt, content.timezone) || "Available now"}</dd></div><div><dt className="text-xs text-[#617184]">Due date</dt><dd className="mt-1 font-semibold text-[#22304a]">{date(task.dueDate, content.timezone) || "No deadline"}</dd></div><div><dt className="text-xs text-[#617184]">Roster submissions</dt><dd className="mt-1 font-semibold text-[#22304a]">{received} received · {missing} not submitted{late ? ` · ${late} late` : ""}</dd></div></dl>
          {files.length || links.length ? <div className="mt-4"><p className="text-xs font-bold uppercase tracking-wide text-[#617184]">Files & resources</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{files.map((file, index) => <a key={`${file.id}:${index}`} href={safeResource(file.url)!} target="_blank" rel="noopener noreferrer" className="flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-[#e0e7ed] bg-[#f8fafc] p-3 text-sm font-semibold text-[#24466e]"><FileText className="h-5 w-5 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{file.name}</span></a>)}{links.map((href, index) => <a key={`${href}:${index}`} href={href} target="_blank" rel="noopener noreferrer" className="min-h-12 content-center rounded-2xl border border-[#e0e7ed] p-3 text-sm font-semibold text-[#24466e]">Open learning resource {index + 1}</a>)}</div></div> : null}
          {content.familyNote ? <p className="mt-3 rounded-xl bg-[#fff8e8] p-3 text-sm leading-6 text-[#775d35]">Family note: {content.familyNote}</p> : null}
          <Link href={`${workspace(task.programTitle)}?tab=task#homework-${task.id}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#22304a] px-5 py-2 text-sm font-semibold text-white"><ClipboardList className="h-4 w-4" />Review submissions & points</Link>
        </article>;
      })}</div>
      {!dashboard.assignments.length ? <div className="rounded-3xl border border-dashed border-[#d8c9ae] bg-[#fffbf5] p-6 text-center"><ClipboardList className="mx-auto h-8 w-8 text-[#aa6822]" aria-hidden="true" /><h3 className="mt-3 font-bold text-[#22304a]">Your first homework starts here</h3><p className="mt-2 text-sm text-[#617184]">Add clear instructions and a file if needed. Submissions will appear once students send their work.</p><Link href={createHref} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#22304a] px-5 py-2 text-sm font-semibold text-white">Create homework</Link></div> : null}
    </TeacherSection>
  </TeacherDashboardFrame>;
}

function safeResource(value: unknown) {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
