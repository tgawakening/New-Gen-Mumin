import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { FamilyDashboardFrame, SectionCard } from "@/components/dashboard/family/FamilyDashboardFrame";
import { HomeworkSubmissionFields } from "@/components/dashboard/family/HomeworkSubmissionFields";
import { HomeworkStatus } from "@/components/dashboard/HomeworkStatus";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { submitStudentHomework } from "@/lib/homework/student-action";
import { homeworkTiming } from "@/lib/homework/timing";
import { db } from "@/lib/db";

export default async function StudentHomeworkPage({ searchParams }: { searchParams?: Promise<{ task?: string; program?: string; submitted?: string; error?: string; page?: string }> }) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));
  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");
  const child = dashboard.child;
  const params = searchParams ? await searchParams : {};
  const visible = child.accessLocked ? [] : child.assignments;
  const [records, submissions] = await Promise.all([
    visible.length ? db.assignment.findMany({ where: { id: { in: visible.map(task => task.id) } }, select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" } }) : [],
    visible.length ? db.assignmentSubmission.findMany({ where: { studentId: child.id, assignmentId: { in: visible.map(task => task.id) } }, orderBy: { createdAt: "asc" } }) : [],
  ]);
  const ordered = records.flatMap(record => { const task = visible.find(item => item.id === record.id); return task ? [task] : []; });
  const programmes = [...new Set(ordered.map(task => task.programTitle))];
  const linkedTask = ordered.find(task => task.id === params.task);
  const selectedProgram = linkedTask?.programTitle || (programmes.includes(params.program || "") ? params.program : undefined);
  const assignments = selectedProgram ? ordered.filter(task => task.programTitle === selectedProgram) : ordered;
  const pages = Math.max(1, Math.ceil(assignments.length / 10));
  const index = linkedTask ? assignments.findIndex(task => task.id === linkedTask.id) : -1;
  const page = index >= 0 ? Math.floor(index / 10) + 1 : Math.min(pages, Math.max(1, Number.parseInt(params.page || "1", 10) || 1));
  const href = (number: number) => `/student/homework?${new URLSearchParams({ ...(selectedProgram ? { program: selectedProgram } : {}), page: String(number) })}`;
  const safe = (url: string | null) => typeof url === "string" && /^https?:\/\//i.test(url);
  return <FamilyDashboardFrame roleLabel="Student Dashboard" title="Homework & Tasks" subtitle="Choose your programme, open a task and submit your work here." navItems={getStudentNavItems()} pendingReason={dashboard.pendingReason}>
    <ActionToast message={params.submitted ? "Homework submitted! Your teacher will receive a notification and email. Submission points are awarded once." : params.error === "empty" ? "Write an answer or attach your work before submitting." : params.error === "upload" ? "Your file could not be uploaded. Check your connection and try again; your previous submission is unchanged." : params.error ? "This task is not available yet or is no longer shared with you." : undefined} tone={params.error ? "error" : "success"} />
    <SectionCard eyebrow="Your programmes" title="Find your homework"><nav aria-label="Homework programmes" className="flex flex-wrap gap-2"><Link href="/student/homework" className={`rounded-full border px-4 py-3 text-sm font-bold ${!selectedProgram ? "bg-[#22304a] text-white" : "bg-white"}`}>All programmes</Link>{programmes.map(program => <Link key={program} href={`/student/homework?program=${encodeURIComponent(program)}`} className={`rounded-full border px-4 py-3 text-sm font-bold ${selectedProgram === program ? "bg-[#22304a] text-white" : "bg-white"}`}>{program}</Link>)}</nav><p className="mt-4 text-sm text-[#617184]">Newest tasks appear first. Open a task, read the instructions, then type your answer, upload a file, or both.</p></SectionCard>
    <SectionCard eyebrow="Assigned learning" title={selectedProgram || "Latest homework"}>
      {child.accessLocked ? <p className="rounded-2xl bg-amber-50 p-4 text-sm">Homework becomes available when your portal access is active.</p> : null}
      <div className="grid gap-4">{assignments.slice((page - 1) * 10, page * 10).map(task => {
        const submission = submissions.find(item => item.assignmentId === task.id);
        return <details key={task.id} id={`homework-${task.id}`} open={params.task === task.id} className="scroll-mt-24 rounded-2xl border border-[#eadfce] bg-white p-4 sm:p-5"><summary className="cursor-pointer"><span className="text-lg font-bold text-[#22304a]">{task.title}</span><span className="mt-2 block text-sm text-[#617184]">{task.programTitle}{task.weekLabel ? ` - ${task.weekLabel}` : ""} - Due {task.dueDateLabel}</span><span className="mt-2 block"><HomeworkStatus status={homeworkTiming(submission?.submittedAt || null, task.dueDate)} /></span><span className="mt-2 block text-xs font-bold text-[#24466e]">{submission?.submittedAt ? "View or update your submission" : "Open task and submit your work"}</span></summary>
          <div className="mt-4 space-y-4 text-sm text-[#526176]"><p className="whitespace-pre-wrap leading-7">{task.instructions}</p><div className="flex flex-wrap gap-2">{task.attachments.map(file => file && safe(file.url) ? <a key={file.id} href={file.url!} target="_blank" rel="noopener noreferrer" className="rounded-xl border px-4 py-3 font-semibold underline">{file.name}</a> : null)}{task.resourceLinks.map((url, i) => safe(url) ? <a key={`${url}-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="rounded-xl border px-4 py-3 font-semibold underline">Resource {i + 1}</a> : null)}</div>
            {submission?.feedback ? <p className="rounded-xl bg-green-50 p-3"><strong>Teacher feedback:</strong> {submission.feedback}</p> : null}
            {submission?.score !== null && submission?.score !== undefined ? <p>Teacher score: {submission.score}</p> : null}
            {safe(submission?.attachmentUrl || null) ? <a className="inline-block py-2 font-semibold underline" href={submission!.attachmentUrl!} target="_blank" rel="noopener noreferrer">View your submitted file</a> : null}
            <form action={submitStudentHomework} className="grid gap-4 rounded-2xl border bg-[#fbf6ef] p-4"><input type="hidden" name="assignmentId" value={task.id} /><input type="hidden" name="submissionType" value="homework" /><HomeworkSubmissionFields answer={submission?.submissionText || ""} hasAttachment={Boolean(submission?.attachmentUrl)} /><FormSubmitButton pendingLabel="Uploading and submitting..." className="min-h-12 w-fit rounded-full bg-[#22304a] px-6 py-3 font-bold text-white">{submission?.submittedAt ? "Update submission" : "Submit homework"}</FormSubmitButton><p className="text-xs text-[#617184]">Your first submission earns 10 Qabila points. Your teacher may award separate performance points with feedback.</p></form>
          </div>
        </details>;
      })}</div>
      {!assignments.length && !child.accessLocked ? <p className="rounded-2xl bg-[#f8fafc] p-5 text-sm">No live homework yet. Your teacher&apos;s tasks will appear here when they launch.</p> : null}
      {pages > 1 ? <nav aria-label="Homework pages" className="mt-5 flex items-center justify-between text-sm">{page > 1 ? <Link href={href(page - 1)} className="min-h-11 content-center underline">Previous</Link> : <span />}<span>Page {page} of {pages}</span>{page < pages ? <Link href={href(page + 1)} className="min-h-11 content-center underline">Next</Link> : <span />}</nav> : null}
    </SectionCard>
  </FamilyDashboardFrame>;
}
