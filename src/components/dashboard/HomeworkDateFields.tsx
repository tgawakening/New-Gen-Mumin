"use client";
import { useState } from "react";
import { homeworkWeekDeadline } from "@/lib/homework/timing";

export function HomeworkDateFields({ timezone, defaults, editing = false }: { timezone: string; defaults: { launch: string; due: string }; editing?: boolean }) {
  const [launch, setLaunch] = useState(defaults.launch);
  const [due, setDue] = useState(defaults.due);
  const [customDeadline, setCustomDeadline] = useState(editing);
  return <fieldset className="col-span-full grid min-w-0 gap-3 sm:grid-cols-2">
    <legend className="mb-2 text-sm font-semibold text-[#22304a]">Homework dates</legend>
    <label className="grid min-w-0 gap-2 text-sm text-[#22304a]">Launch date & time<input type="datetime-local" name="launchDate" required={!editing} value={launch} onChange={(event) => { setLaunch(event.target.value); if (!customDeadline) setDue(homeworkWeekDeadline(event.target.value)); }} className="min-w-0 rounded-2xl border border-[#d8e3ed] bg-white px-3 py-3" /></label>
    <label className="grid min-w-0 gap-2 text-sm text-[#22304a]">Deadline date & time<input type="datetime-local" name="dueDate" required={!editing} value={due} min={launch || undefined} onChange={(event) => { setDue(event.target.value); setCustomDeadline(true); }} className="min-w-0 rounded-2xl border border-[#d8e3ed] bg-white px-3 py-3" /></label>
    <p className="text-xs leading-5 text-[#617184] sm:col-span-2">Times use {timezone}. {editing ? "Existing dates are prefilled. Blank launch means available now; blank deadline means no deadline." : "Launch defaults to now; the deadline defaults to one week later. You can change either."} Submissions after the exact deadline are marked late.</p>
    <button type="button" onClick={() => { setDue(homeworkWeekDeadline(launch)); setCustomDeadline(false); }} className="min-h-11 w-fit text-xs font-semibold text-[#24466e] underline sm:col-span-2">Use one-week deadline</button>
  </fieldset>;
}
