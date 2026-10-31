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
import { revalidatePath } from "next/cache";
import { updateTeacherHomework, deleteTeacherHomework, teacherHomeworkForManagement } from "@/lib/homework/manage";
import { HomeworkEditDialog } from "@/components/dashboard/teacher/HomeworkEditDialog";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";
import { ActionToast } from "@/components/dashboard/ActionToast";

export default async function TeacherHomeworkPage({ searchParams }: { searchParams?: Promise<{ edit?: string; saved?: string; deleted?: string; error?: string; page?: string }> } = {}) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));
  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const params = searchParams ? await searchParams : {};
  const pages = Math.max(1, Math.ceil(dashboard.assignments.length / 12));
  const page = Math.min(pages, Math.max(1, Number.parseInt(params.page || "1", 10) || 1));
  const editing = params.edit ? await teacherHomeworkForManagement(session.user.id, params.edit).catch(() => null) : null;
  async function saveHomework(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "TEACHER") redirect("/auth/login");
    try { await updateTeacherHomework(current.user.id, formData); }
    catch { redirect(`/teacher/homework?edit=${encodeURIComponent(String(formData.get("taskId") || ""))}&error=edit`); }
    refreshHomework();
    redirect("/teacher/homework?saved=1");
  }
  async function removeHomework(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "TEACHER") redirect("/auth/login");
    if (formData.get("confirmDelete") !== "on") redirect("/teacher/homework?error=confirm");
    try { await deleteTeacherHomework(current.user.id, String(formData.get("taskId") || "")); }
    catch { redirect("/teacher/homework?error=delete"); }
    refreshHomework();
    redirect("/teacher/homework?deleted=1");
  }
  const workspace = (title: string) => {
    const programme = getGenMProgrammeByTitle(title);
    return programme ? `/teacher/course-builder/${isArabicTajweedSlug(programme.slug) ? "arabic" : programme.slug}` : "/teacher/course-builder";
  };
  const date = (value: Date | string | null, timezone?: string | null) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: timezone || dashboard.profile.timezone || "Europe/London" }).format(new Date(value)) : null;
  const createHref = `${dashboard.rosters[0] ? workspace(dashboard.rosters[0].title) : "/teacher/course-builder"}?tab=task&taskComposer=1`;
  return <TeacherDashboardFrame title="Homework & Assignments" subtitle="Share a clear task, attach learning files, and review your students' work." navItems={getTeacherNavItems()}>
    <ActionToast message={params.saved ? "Homework changes saved. Existing submissions and points were preserved." : params.deleted ? "Homework deleted. Previously earned Qabila points were preserved." : params.error ? "The change could not be completed. Check your inputs and try again." : undefined} tone={params.error ? "error" : "success"} />
    {editing ? <HomeworkEditDialog task={editing.task} timezone={editing.timezone} action={saveHomework} error={params.error === "edit" ? "Check the title, instructions, dates and resource links, then try saving again." : undefined} /> : params.edit ? <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">This homework is not available for you to edit.</p> : null}
    <section className="rounded-3xl border border-[#eadfce] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5"><div className="max-w-2xl"><UploadCloud className="h-8 w-8 text-[#a16b24]" aria-hidden="true" /><h2 className="mt-3 text-xl font-bold text-[#22304a]">Set homework in a few simple steps</h2><p className="mt-2 text-sm leading-6 text-[#617184]">Choose the programme and module, write instructions, attach your files, and set launch and due dates.</p></div><Link href={createHref} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#22304a] px-5 py-3 text-sm font-bold text-white"><Plus className="h-4 w-4" />Create homework</Link></div>
      <ol className="mt-5 grid gap-3 text-sm sm:grid-cols-3">{["Write the task and instructions", "Attach files and choose dates", "Review work, feedback and points"].map((step, index) => <li key={step} className="flex items-center gap-3 rounded-2xl bg-[#fbf6ef] p-3 text-[#4d5a6b]"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white font-bold text-[#946219]">{index + 1}</span>{step}</li>)}</ol>
      {dashboard.rosters.length > 1 ? <div className="mt-4 flex flex-wrap gap-2"><span className="content-center text-xs font-semibold text-[#617184]">Create for:</span>{dashboard.rosters.map((roster) => <Link key={roster.programId} href={`${workspace(roster.title)}?tab=task&taskComposer=1`} className="min-h-11 content-center rounded-full border border-[#dce4ed] px-4 py-2 text-xs font-semibold text-[#24466e]">{roster.title}</Link>)}</div> : null}
      <p className="mt-4 text-xs leading-5 text-[#617184]">Students earn {HOUSE_POINT_RULES.HOMEWORK_SUBMITTED.points} automatic Qabila points once when submitting. You can add separate performance points with feedback.</p>
    </section>
    <TeacherSection eyebrow="Assigned learning" title="Recent homework">
      <div className="grid gap-4">{dashboard.assignments.slice((page - 1) * 12, page * 12).map((task) => {
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
          <div className="mt-3 flex flex-wrap items-start gap-3"><Link href={`/teacher/homework?edit=${encodeURIComponent(task.id)}`} className="min-h-11 content-center rounded-full border border-[#cbd7e3] px-5 py-2 text-sm font-semibold text-[#24466e]">Edit homework</Link><details className="max-w-full"><summary className="min-h-11 cursor-pointer content-center rounded-full border border-red-200 px-5 py-2 text-sm font-semibold text-red-800">Delete homework</summary><form action={removeHomework} className="mt-3 max-w-sm rounded-2xl border border-red-200 bg-red-50 p-4"><input type="hidden" name="taskId" value={task.id} /><p className="text-sm leading-6 text-red-900">Delete this homework and its student submissions? This cannot be undone. Already earned Qabila points will stay.</p><label className="mt-3 flex items-start gap-2 text-sm text-red-900"><input type="checkbox" name="confirmDelete" required className="mt-1 h-4 w-4 shrink-0" />I understand and want to delete this homework.</label><FormSubmitButton pendingLabel="Deleting..." className="mt-3 min-h-11 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white">Yes, delete homework</FormSubmitButton></form></details></div>
        </article>;
      })}</div>
      {pages > 1 ? <nav aria-label="Homework pages" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">{page > 1 ? <Link href={`/teacher/homework?page=${page - 1}`} className="min-h-11 content-center underline">Previous</Link> : <span />}<span>Page {page} of {pages}</span>{page < pages ? <Link href={`/teacher/homework?page=${page + 1}`} className="min-h-11 content-center underline">Next</Link> : <span />}</nav> : null}
      {!dashboard.assignments.length ? <div className="rounded-3xl border border-dashed border-[#d8c9ae] bg-[#fffbf5] p-6 text-center"><ClipboardList className="mx-auto h-8 w-8 text-[#aa6822]" aria-hidden="true" /><h3 className="mt-3 font-bold text-[#22304a]">Your first homework starts here</h3><p className="mt-2 text-sm text-[#617184]">Add clear instructions and a file if needed. Submissions will appear once students send their work.</p><Link href={createHref} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#22304a] px-5 py-2 text-sm font-semibold text-white">Create homework</Link></div> : null}
    </TeacherSection>
  </TeacherDashboardFrame>;
}

function refreshHomework() {
  for (const path of ["/teacher/homework", "/teacher/course-builder", "/teacher", "/student/courses", "/parent/courses", "/parent/curriculum"]) revalidatePath(path, "layout");
}

function safeResource(value: unknown) {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
