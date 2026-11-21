export type HomeworkAttachment = { name: string; url: string };

// Keep older single-file submissions readable alongside the new file list.
export function homeworkAttachments(submission?: { attachmentUrl?: string | null; attachmentFiles?: unknown } | null): HomeworkAttachment[] {
  const files: HomeworkAttachment[] = [];
  const add = (name: unknown, url: unknown) => {
    if (typeof url !== "string" || !/^https?:\/\//i.test(url) || files.some(file => file.url === url)) return;
    files.push({ name: typeof name === "string" && name.trim() ? name : "Submitted file", url });
  };
  if (Array.isArray(submission?.attachmentFiles)) {
    for (const file of submission.attachmentFiles) {
      if (file && typeof file === "object" && "url" in file) add("name" in file ? file.name : undefined, file.url);
    }
  }
  if (submission?.attachmentUrl && !files.some(file => file.url === submission.attachmentUrl)) {
    files.unshift({ name: "Previously submitted file", url: submission.attachmentUrl });
  }
  return files.filter(file => /^https?:\/\//i.test(file.url));
}
