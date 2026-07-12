"use client";

import { useState } from "react";
import { CalendarDays, Check, Copy, ExternalLink } from "lucide-react";

export function ParentCalendarSubscribeCard({
  webcalUrl,
  httpsUrl,
}: {
  webcalUrl: string;
  httpsUrl: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(httpsUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  return (
    <section className="rounded-[26px] border border-[#eadfce] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fff0db] text-[#d7892f]">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">
              Family calendar
            </p>
            <h2 className="mt-1.5 text-lg font-semibold text-[#22304a] sm:text-xl">
              Add Gen-Mumin to your phone calendar
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f6b7a]">
              Subscribe once to see live sessions, deadlines, missions, parent reminders, and future announcements in your calendar app.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={webcalUrl}
            className="inline-flex items-center gap-2 rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#17243a]"
          >
            <ExternalLink className="h-4 w-4" />
            Add calendar
          </a>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-2 rounded-full border border-[#d8e3ed] bg-white px-4 py-2 text-sm font-semibold text-[#22304a] transition hover:bg-[#f7fbff]"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </section>
  );
}
