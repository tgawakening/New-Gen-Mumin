"use client";
import { useState } from "react";

export function HomeworkSubmissionFields({ answer = "", hasAttachment = false }: { answer?: string; hasAttachment?: boolean }) {
  const [text, setText] = useState(answer);
  const [file, setFile] = useState(false);
  return <>
    <label className="grid gap-2 text-sm font-semibold text-[#22304a]">Your answer / notes
      <textarea name="submissionText" rows={3} value={text} onChange={(event) => setText(event.target.value)} required={!file && !hasAttachment} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Write your answer or upload your completed homework below." />
    </label>
    <label className="grid gap-2 text-sm font-semibold text-[#22304a]">Upload homework
      <input name="submissionFile" type="file" onChange={(event) => setFile(Boolean(event.target.files?.length))} required={!text.trim() && !hasAttachment} accept="image/*,video/*,.pdf,.ppt,.pptx,.doc,.docx" className="min-w-0 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#22304a] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
      <span className="text-xs font-normal text-[#617184]">Add an answer, a file, or both.{hasAttachment ? " Your existing file stays attached unless you upload a replacement." : ""}</span>
    </label>
  </>;
}
