import Link from "next/link";
import { parseTaskPayload } from "@/lib/genm/published-content";
import { homeworkDateDefaults } from "@/lib/homework/timing";
import { HomeworkDateFields } from "@/components/dashboard/HomeworkDateFields";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";
import { HomeworkModalFrame } from "./HomeworkModalFrame";

export function HomeworkEditDialog({ task, timezone, action, error }: { task: { id: string; title: string; instructions: string | null; dueDate: Date | null }; timezone: string; action: (data: FormData) => Promise<void>; error?: string }) {
  const content = parseTaskPayload(task.instructions);
  const zone = content.timezone || timezone;
  const dates = { launch: content.launchAt ? homeworkDateDefaults(zone, new Date(content.launchAt)).launch : "", due: task.dueDate ? homeworkDateDefaults(zone, task.dueDate).launch : "" };
  return <HomeworkModalFrame><div className="p-5 sm:p-6">
    <div className="mb-5 flex items-start justify-between gap-3"><div><h2 id="edit-homework-title" className="text-xl font-bold text-[#22304a]">Edit homework</h2><p className="mt-2 text-sm text-[#617184]">Update this task without removing student submissions, feedback or earned points.</p></div><Link href="/teacher/homework" aria-label="Close homework editor" className="min-h-11 content-center rounded-full border px-4 text-sm">Close</Link></div>
    {error ? <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    <form action={action} className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="taskId" value={task.id} />
      <label className="grid gap-2 text-sm font-semibold text-[#22304a] sm:col-span-2">Title<input autoFocus name="title" defaultValue={task.title} required maxLength={191} className="rounded-2xl border border-[#d8e3ed] p-3" /></label>
      <label className="grid gap-2 text-sm font-semibold text-[#22304a] sm:col-span-2">Instructions<textarea name="instructions" defaultValue={content.instructions || ""} required rows={4} className="rounded-2xl border border-[#d8e3ed] p-3 font-normal" /></label>
      <HomeworkDateFields timezone={zone} defaults={dates} editing />
      {content.attachments.length ? <fieldset className="rounded-2xl bg-[#f8fafc] p-4 sm:col-span-2"><legend className="text-sm font-semibold text-[#22304a]">Current attachments</legend><p className="mb-2 text-xs text-[#617184]">Uncheck a file to remove it from this homework.</p>{content.attachments.map((file, index) => file && <label key={`${file.id}:${index}`} className="flex min-h-11 items-center gap-3 break-all text-sm"><input type="checkbox" name="keepAttachment" value={file.id} defaultChecked className="h-4 w-4 shrink-0" />{file.name}</label>)}</fieldset> : null}
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#22304a] sm:col-span-2">Add files<input type="file" name="files" multiple className="min-w-0 text-sm font-normal" /></label>
      <label className="grid gap-2 text-sm font-semibold text-[#22304a] sm:col-span-2">Resource links<textarea name="resourceLinks" defaultValue={content.resourceLinks.join("\n")} rows={2} placeholder="One link per line" className="rounded-2xl border border-[#d8e3ed] p-3 font-normal" /></label>
      <label className="grid gap-2 text-sm font-semibold text-[#22304a] sm:col-span-2">Note for families<textarea name="familyNote" defaultValue={content.familyNote || ""} rows={2} className="rounded-2xl border border-[#d8e3ed] p-3 font-normal" /></label>
      <div className="flex flex-wrap gap-3 sm:col-span-2"><FormSubmitButton pendingLabel="Saving changes..." className="min-h-11 rounded-full bg-[#22304a] px-5 py-3 text-sm font-bold text-white">Save changes</FormSubmitButton><Link href="/teacher/homework" className="min-h-11 content-center rounded-full border px-5 py-3 text-sm">Cancel</Link></div>
    </form>
  </div></HomeworkModalFrame>;
}
