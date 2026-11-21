import { homeworkAttachments } from "@/lib/homework/attachments";

export function HomeworkSubmittedFiles({ submission }: { submission?: { attachmentUrl?: string | null; attachmentFiles?: unknown } | null }) {
  const files = homeworkAttachments(submission);
  if (!files.length) return null;
  return <div className="space-y-2"><p className="font-semibold">Submitted files ({files.length})</p><ul className="grid gap-2">{files.map((file, index) => <li key={file.url}><a href={file.url} target="_blank" rel="noopener noreferrer" className="inline-block break-all py-2 font-semibold underline">{index + 1}. {file.name}</a></li>)}</ul></div>;
}
