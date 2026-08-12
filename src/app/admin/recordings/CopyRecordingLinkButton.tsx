"use client";
import { useState } from "react";
export function CopyRecordingLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true); window.setTimeout(() => setCopied(false), 2200);
  }
  return <button type="button" onClick={copyLink} className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]" title="Copy a secure link that works for 30 days">{copied ? "Link copied" : "Copy access link"}</button>;
}
