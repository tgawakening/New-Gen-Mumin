"use client";
import { useState } from "react";

export function HomeworkDateFields({ timezone }: { timezone: string }) {
  const [launch, setLaunch] = useState("");
  return <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2">
    <legend className="mb-2 text-sm font-semibold text-[#22304a]">Homework dates</legend>
    <label className="grid min-w-0 gap-2 text-sm text-[#22304a]">Launch date<input type="date" name="launchDate" value={launch} onChange={(event) => setLaunch(event.target.value)} className="min-w-0 rounded-2xl border border-[#d8e3ed] bg-white px-3 py-3" /></label>
    <label className="grid min-w-0 gap-2 text-sm text-[#22304a]">Due date<input type="date" name="dueDate" min={launch || undefined} className="min-w-0 rounded-2xl border border-[#d8e3ed] bg-white px-3 py-3" /></label>
    <p className="text-xs leading-5 text-[#617184] sm:col-span-2">Blank launch date means available now. Dates use {timezone}; the due date includes the whole day. Blank due date means no deadline.</p>
  </fieldset>;
}
