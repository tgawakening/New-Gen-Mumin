import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { ChildSelector, FamilyDashboardFrame, SectionCard } from "@/components/dashboard/family/FamilyDashboardFrame";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";
import { db } from "@/lib/db";
import { homeworkTiming } from "@/lib/homework/timing";
import { markHomeworkReviewed } from "@/lib/homework/parent-review";
import { submitParentHomework } from "@/lib/homework/student-action";
import { HomeworkSubmissionFields } from "@/components/dashboard/family/HomeworkSubmissionFields";
import { ActionToast } from "@/components/dashboard/ActionToast";

export default async function ParentHomeworkPage({ searchParams }: { searchParams?: Promise<{ child?: string; task?: string; program?: string; page?: string; submitted?: string; error?: string }> }) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));
  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard?.children.length) redirect("/registration");
  const params = searchParams ? await searchParams : {};
  const child = dashboard.children.find(item => item.id === params.child) || (params.task ? dashboard.children.find(item => item.assignments.some(task => task.id === params.task)) : null) || dashboard.children[0];
  const alerts = await db.notification.findMany({ where: { userId: session.user.id, readAt: null, href: { startsWith: `/parent/homework?child=${encodeURIComponent(child.id)}&` } }, select: { id: true, href: true } });
  const visible = child.accessLocked ? [] : child.assignments;
  const [records, submissions] = await Promise.all([
    visible.length ? db.assignment.findMany({ where: { id: { in: visible.map(task => task.id) } }, select: { id: true }, orderBy: { createdAt: "desc" } }) : [],
    visible.length ? db.assignmentSubmission.findMany({ where: { studentId: child.id, assignmentId: { in: visible.map(task => task.id) } }, orderBy: { createdAt: "asc" } }) : [],
  ]);
  const ordered = records.flatMap(record => {
    const task = visible.find(item => item.id === record.id);
    if (!task) return [];
    const submission = submissions.find(item => item.assignmentId === task.id);
    return [{ ...task, ...(submission ? { submissionText: submission.submissionText, attachmentUrl: submission.attachmentUrl, submittedAt: submission.submittedAt, feedback: submission.feedback, score: submission.score, submissionTiming: homeworkTiming(submission.submittedAt, task.dueDate) } : {}) }];
  });
  const programmes = [...new Set(ordered.map(task => task.programTitle))];
  const selectedProgram = ordered.find(task => task.id === params.task)?.programTitle || (programmes.includes(params.program || "") ? params.program : undefined);
  const assignments = selectedProgram ? ordered.filter(task => task.programTitle === selectedProgram) : ordered;
  const pages = Math.max(1, Math.ceil(assignments.length / 10));
  const selectedIndex = params.task ? assignments.findIndex(task => task.id === params.task) : -1;
  const page = selectedIndex >= 0 ? Math.floor(selectedIndex / 10) + 1 : Math.min(pages, Math.max(1, Number.parseInt(params.page || "1", 10) || 1));
  const safeLink = (url: string | null) => url && /^https?:\/\//i.test(url) ? url : null;
  return <FamilyDashboardFrame roleLabel="Parent Dashboard" title="Homework & Tasks" subtitle="Review your child's live assignments, resources, deadlines and teacher feedback." navItems={getParentNavItems(child.id)} pendingReason={dashboard.pendingReason}>
    <ActionToast message={params.submitted ? "Homework submitted for your child. Their teacher has been queued for notification and the submission points are awarded once." : params.error === "empty" ? "Write an answer or upload your child's completed work." : params.error === "upload" ? "The file could not be uploaded. Please try again; the existing submission is unchanged." : params.error ? "This homework is unavailable for this learner." : undefined} tone={params.error ? "error" : "success"} />
    <SectionCard eyebrow="Your family" title="Choose a learner"><ChildSelector learners={dashboard.children.map(item => ({ id: item.id, name: item.name }))} selectedChildId={child.id} basePath="/parent/homework" /></SectionCard>
    <SectionCard eyebrow="Programmes" title="Find homework"><nav aria-label="Homework programmes" className="flex flex-wrap gap-2"><Link href={`/parent/homework?child=${encodeURIComponent(child.id)}`} className="rounded-full border px-4 py-3 text-sm font-bold">All programmes</Link>{programmes.map(program => <Link key={program} href={`/parent/homework?child=${encodeURIComponent(child.id)}&program=${encodeURIComponent(program)}`} className={`rounded-full border px-4 py-3 text-sm font-bold ${selectedProgram === program ? "bg-[#22304a] text-white" : "bg-white"}`}>{program}</Link>)}</nav></SectionCard>
    <SectionCard eyebrow="Assigned learning" title={`${child.name}'s homework`}>
      <p className="mb-4 text-sm text-[#617184]">Open a task to read the instructions, download resources and submit your child&apos;s completed work here. Marking a task reviewed only clears its red notification; use Submit homework to hand in the work.</p>
      {child.accessLocked ? <p className="rounded-2xl bg-amber-50 p-4 text-sm">Homework is available once this learner&apos;s portal access is active.</p> : null}
      <div className="grid gap-4">{assignments.slice((page - 1) * 10, page * 10).map(task => {
        const ids = alerts.filter(alert => new URLSearchParams(alert.href?.split("?")[1]).get("task") === task.id).map(alert => alert.id);
        return <details key={task.id} id={`homework-${task.id}`} open={params.task === task.id} className={`scroll-mt-24 rounded-2xl border p-4 sm:p-5 ${ids.length ? "border-red-200 bg-red-50/40" : "border-[#eadfce] bg-white"}`}>
          <summary className="cursor-pointer"><span className="font-bold text-[#22304a]">{task.title}</span>{ids.length ? <span className="ml-2 rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">New</span> : null}<span className="mt-2 block text-sm text-[#617184]">{task.programTitle}{task.weekLabel ? ` · ${task.weekLabel}` : ""} · Due {task.dueDateLabel}</span><span className="mt-1 block text-xs font-semibold text-[#617184]">{task.submissionTiming}{task.teacherName ? ` · ${task.teacherName}` : ""}</span></summary>
          <div className="mt-4 space-y-4 text-sm text-[#526176]">
            <p className="whitespace-pre-wrap leading-7">{task.instructions}</p>
            {task.familyNote ? <p className="rounded-xl bg-[#fff8e8] p-3">For parents: {task.familyNote}</p> : null}
            <div className="flex flex-wrap gap-2">{task.attachments.map(file => file && safeLink(file.url) ? <a key={file.id} href={safeLink(file.url)!} target="_blank" rel="noopener noreferrer" className="rounded-xl border px-4 py-3 font-semibold underline">{file.name}</a> : null)}{task.resourceLinks.map((url, index) => safeLink(url) ? <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="rounded-xl border px-4 py-3 font-semibold underline">Resource {index + 1}</a> : null)}</div>
            {task.feedback ? <p className="rounded-xl bg-green-50 p-3"><strong>Teacher feedback:</strong> {task.feedback}</p> : null}
            {task.score !== null ? <p>Teacher score: {task.score}</p> : null}
            {safeLink(task.attachmentUrl) ? <a href={safeLink(task.attachmentUrl)!} target="_blank" rel="noopener noreferrer" className="inline-block py-2 font-semibold underline">View submitted file</a> : null}
            <form action={submitParentHomework} className="grid gap-4 rounded-2xl border bg-[#fbf6ef] p-4"><input type="hidden" name="assignmentId" value={task.id} /><input type="hidden" name="childId" value={child.id} /><input type="hidden" name="submissionType" value="homework" /><p className="font-bold text-[#22304a]">Submit work for {child.name}</p><HomeworkSubmissionFields answer={task.submissionText || ""} hasAttachment={Boolean(task.attachmentUrl)} /><FormSubmitButton pendingLabel="Uploading and submitting..." className="min-h-12 w-fit rounded-full bg-[#22304a] px-6 py-3 font-bold text-white">{task.submittedAt ? "Update submission" : "Submit homework"}</FormSubmitButton><p className="text-xs text-[#617184]">The first submission earns 10 points for your child&apos;s Qabila. Submitting again keeps the original submission date and does not repeat those points.</p></form>
            {ids.length ? <form action={markHomeworkReviewed} className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3"><input type="hidden" name="notificationIds" value={JSON.stringify(ids)} /><span className="flex-1 font-semibold text-red-800">New homework to review</span><FormSubmitButton pendingLabel="Saving..." className="rounded-full bg-[#22304a] px-4 py-3 font-bold text-white">Mark reviewed</FormSubmitButton></form> : null}
          </div>
        </details>;
      })}</div>
      {!assignments.length && !child.accessLocked ? <p className="rounded-2xl bg-[#f8fafc] p-5 text-sm text-[#617184]">No live homework yet. Assignments will appear here when your child&apos;s teacher releases them.</p> : null}
      {pages > 1 ? <nav aria-label="Homework pages" className="mt-5 flex items-center justify-between gap-3 text-sm">{page > 1 ? <Link className="min-h-11 content-center underline" href={`/parent/homework?child=${encodeURIComponent(child.id)}&program=${encodeURIComponent(selectedProgram || "")}&page=${page - 1}`}>Previous</Link> : <span />}<span>Page {page} of {pages}</span>{page < pages ? <Link className="min-h-11 content-center underline" href={`/parent/homework?child=${encodeURIComponent(child.id)}&program=${encodeURIComponent(selectedProgram || "")}&page=${page + 1}`}>Next</Link> : <span />}</nav> : null}
    </SectionCard>
  </FamilyDashboardFrame>;
}
