"use client";
import { useState } from "react";
export function CopyStudentJoinLink({ scheduleId }: { scheduleId: string }) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "manual">("idle");
  const [url, setUrl] = useState("");
  async function copy() {
    setState("copying");
    const link = new URL("/join/" + encodeURIComponent(scheduleId), window.location.origin).href;
    setUrl(link);
    try { await navigator.clipboard.writeText(link); setState("copied"); }
    catch { setState("manual"); }
  }
  return <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={copy} disabled={state === "copying"} className="rounded-full border border-[#cdd9e4] bg-white px-4 py-2 text-sm font-semibold text-[#0f4d81] disabled:opacity-60">{state === "copied" ? "Student link copied" : state === "copying" ? "Copying..." : "Copy student join link"}</button>
    {state === "manual" && <label className="text-xs">Copy this link to your group<input aria-label="Student join link" readOnly value={url} onFocus={e => e.target.select()} className="ml-2 rounded border p-2" /></label>}
    {state === "copied" && <span role="status" className="text-xs text-[#2f6b4b]">Share this link in the class group.</span>}
  </div>;
}
