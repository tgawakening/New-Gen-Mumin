"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, Copy, ExternalLink, X } from "lucide-react";

const DISMISS_KEY = "genm-calendar-card-dismissed";
export function ParentCalendarSubscribeCard({ webcalUrl, httpsUrl }: { webcalUrl: string; httpsUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => { const timer = window.setTimeout(() => setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1"), 0); return () => window.clearTimeout(timer); }, []);
  const hide = () => { window.localStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); };
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(httpsUrl)}`;
  async function copyLink() { await navigator.clipboard.writeText(httpsUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2200); }
  if (dismissed) return null;
  return <section className="relative rounded-[22px] border border-[#eadfce] bg-white p-4 shadow-sm">
    <button type="button" onClick={hide} aria-label="Hide calendar connection card permanently" title="Do not show again" className="absolute right-3 top-3 rounded-full border border-[#d8e3ed] p-1.5 text-[#617184] hover:bg-[#f7f9fb]"><X className="h-4 w-4"/></button>
    <div className="flex flex-col gap-4 pr-10 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff0db] text-[#d7892f]"><CalendarDays className="h-5 w-5"/></span><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">Optional family calendar</p><h2 className="mt-1 text-lg font-semibold text-[#22304a]">Add Gen-Mumin dates to your calendar</h2><p className="mt-1 text-sm text-[#5f6b7a]">Connect once, or dismiss this card permanently.</p></div></div>
      <div className="flex flex-wrap gap-2"><a href={googleCalendarUrl} target="_blank" rel="noreferrer" onClick={hide} className="inline-flex items-center gap-2 rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white"><ExternalLink className="h-4 w-4"/>Google</a><a href={webcalUrl} onClick={hide} className="inline-flex items-center gap-2 rounded-full border border-[#d8e3ed] px-4 py-2 text-sm font-semibold text-[#22304a]"><CalendarDays className="h-4 w-4"/>Apple</a><button type="button" onClick={copyLink} className="inline-flex items-center gap-2 rounded-full border border-[#d8e3ed] px-4 py-2 text-sm font-semibold text-[#22304a]">{copied?<Check className="h-4 w-4"/>:<Copy className="h-4 w-4"/>}{copied?"Copied":"Copy link"}</button></div>
    </div>
  </section>;
}