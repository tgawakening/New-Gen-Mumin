"use client";

import Image from "next/image";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DEFAULT_SUNNAH_TASKS, SUNNAH_TASK_ICONS } from "@/lib/community/sunnah-icons";

type Task = { id?: string; prompt: string; iconKey: string };
export function SunnahTrackerTaskBuilder({ initialTasks }: { initialTasks?: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks?.length ? initialTasks : [...DEFAULT_SUNNAH_TASKS]);
  const update = (index: number, values: Partial<Task>) => setTasks((current) => current.map((task, taskIndex) => taskIndex === index ? { ...task, ...values } : task));
  return <div className="grid gap-4">
    <div><p className="text-sm font-bold text-[#22304a]">Sunnah tasks and activity artwork</p><p className="mt-1 text-xs text-[#617184]">Write each task, then choose the picture children will see.</p></div>
    {tasks.map((task, index) => <div key={task.id ?? index} className="rounded-[22px] border border-[#d8e3ed] bg-[#f8fbff] p-3 sm:p-4">
      <input type="hidden" name="taskId" value={task.id ?? ""}/><input type="hidden" name="taskIcon" value={task.iconKey}/>
      <div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#102544] text-sm font-black text-[#ffc96c]">{index + 1}</span><input name="taskPrompt" value={task.prompt} onChange={(event) => update(index, { prompt: event.target.value })} required placeholder="Write a Sunnah task" className="min-w-0 flex-1 rounded-xl border border-[#cfdbe7] bg-white px-3 py-2 text-sm"/>{!task.id ? <button type="button" onClick={() => setTasks((current) => current.filter((_, taskIndex) => taskIndex !== index))} className="rounded-xl px-2 text-[#b24646]" aria-label="Remove task"><Trash2 className="h-4 w-4"/></button> : null}</div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">{SUNNAH_TASK_ICONS.map((icon) => <button key={icon.key} type="button" onClick={() => update(index, { iconKey: icon.key })} title={icon.label} aria-label={`Use ${icon.label} artwork`} className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 transition hover:-translate-y-1 ${task.iconKey === icon.key ? "border-[#f0a53b] ring-2 ring-[#ffd58b]" : "border-transparent opacity-65 hover:opacity-100"}`}><Image src={icon.src} alt="" fill sizes="64px" className="object-cover"/></button>)}</div>
    </div>)}
    <button type="button" onClick={() => setTasks((current) => [...current, { prompt: "", iconKey: SUNNAH_TASK_ICONS[current.length % SUNNAH_TASK_ICONS.length].key }])} className="inline-flex w-fit items-center gap-2 rounded-full border border-[#c7d7e6] bg-white px-4 py-2 text-sm font-bold text-[#22304a]"><Plus className="h-4 w-4"/>Add another task</button>
  </div>;
}