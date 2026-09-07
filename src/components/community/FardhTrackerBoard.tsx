import Link from "next/link";
import { Check, LockKeyhole, MoonStar, Sparkles } from "lucide-react";

import { FARDH_PRAYERS, prettyDay, shiftDay, type FardhPrayerKey } from "@/lib/community/fardh-tracker";

type RecordShape = { dayKey: string; fajr: boolean; dhuhr: boolean; asr: boolean; maghrib: boolean; isha: boolean };

type Props = {
  days: string[];
  today: string;
  start: string;
  records: Map<string, RecordShape>;
  action: (formData: FormData) => void | Promise<void>;
  locked?: boolean;
  queryPrefix?: string;
};

export function FardhTrackerBoard({ days, today, start, records, action, locked = false, queryPrefix = "" }: Props) {
  const colors: Record<FardhPrayerKey, string> = {
    fajr: "from-cyan-500 to-blue-700",
    dhuhr: "from-amber-400 to-orange-600",
    asr: "from-fuchsia-500 to-pink-700",
    maghrib: "from-emerald-400 to-green-700",
    isha: "from-violet-500 to-indigo-800",
  };

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_top,#274d78_0%,#13233d_48%,#081426_100%)] p-5 text-white shadow-xl sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-amber-300"><MoonStar className="h-6 w-6"/><span className="text-xs font-bold uppercase tracking-[0.24em]">My weekly Fardh tracker</span></div>
          <h2 className="mt-3 text-3xl font-black sm:text-4xl">Five prayers. A stronger you.</h2>
          <p className="mt-3 leading-7 text-slate-200">&ldquo;The first deed for which a person will be brought to account on the Day of Resurrection will be his prayer.&rdquo; <span className="text-amber-300">Jami at-Tirmidhi 413</span></p>
        </div>
        <div className="rounded-3xl border border-amber-300/30 bg-white/10 p-4 text-sm leading-6"><p className="font-bold text-amber-300">Chase your ajr - not points.</p><p className="text-slate-200">Points celebrate sincerity and consistency; salah brings us closer to Allah.</p></div>
      </div>
    </section>

    <div className="flex items-center justify-between gap-3">
      <Link className="rounded-full border border-[#d8e3ed] bg-white px-4 py-2 text-sm font-bold text-[#22304a]" href={`?${queryPrefix}week=${shiftDay(start,-7)}`}>Previous</Link>
      <p className="text-center text-sm font-bold text-[#22304a]">Week of {prettyDay(start)}</p>
      <Link className="rounded-full border border-[#d8e3ed] bg-white px-4 py-2 text-sm font-bold text-[#22304a]" href={`?${queryPrefix}week=${shiftDay(start,7)}`}>Next</Link>
    </div>

    <div className="grid gap-4 lg:grid-cols-7">
      {days.map((day) => {
        const record = records.get(day);
        const future = day > today;
        const completed = FARDH_PRAYERS.filter((prayer) => record?.[prayer.key]).length;
        return <form action={action} key={day} className={`rounded-[26px] border p-3 shadow-sm ${day === today ? "border-amber-400 bg-amber-50" : "border-[#eadfce] bg-white"} ${future ? "opacity-60" : ""}`}>
          <input type="hidden" name="dayKey" value={day}/>
          <div className="mb-3 flex items-center justify-between"><div><p className="font-black text-[#17243a]">{prettyDay(day)}</p><p className="text-xs text-[#68758a]">{day === today ? "Today - tap prayers below" : future ? "Not open yet" : `${completed}/5 complete`}</p></div>{future ? <LockKeyhole className="h-4 w-4 text-slate-500"/> : <Sparkles className="h-4 w-4 text-amber-500"/>}</div>
          <div className="space-y-2">
            {FARDH_PRAYERS.map((prayer) => {
              const done = Boolean(record?.[prayer.key]);
              const disabled = future || locked || done;
              return <label key={prayer.key} className={`relative flex items-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r p-3 text-white ${colors[prayer.key]} ${disabled && !done ? "cursor-not-allowed" : "cursor-pointer"} ${done ? "ring-2 ring-emerald-300" : "shadow-sm"}`}>
                <input aria-label={`Mark ${prayer.label} complete for ${prettyDay(day)}`} name="prayer" value={prayer.key} type="checkbox" defaultChecked={done} disabled={disabled} className="peer sr-only"/>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20">{prayer.icon}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-black">{prayer.label}</span><span className="block text-[10px] text-white/85">+{prayer.points} points - {done ? "Completed" : future ? "Locked" : "Tap to mark"}</span></span>
                <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-white bg-white/10 text-emerald-700 transition peer-checked:bg-white peer-checked:[&>svg]:opacity-100"><Check className="h-5 w-5 opacity-0 transition"/></span>
              </label>;
            })}
          </div>
          <button disabled={future || locked || completed === 5} className="mt-3 w-full rounded-2xl bg-[#17243a] px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{completed === 5 ? "Day complete" : future ? "Available on this day" : "Save selected prayers"}</button>
        </form>;
      })}
    </div>

    <section className="grid gap-3 sm:grid-cols-5">{FARDH_PRAYERS.map((prayer) => <div key={prayer.key} className={`rounded-2xl bg-gradient-to-br ${colors[prayer.key]} p-4 text-white shadow-sm`}><p className="text-2xl">{prayer.icon}</p><p className="mt-2 font-black">{prayer.label}</p><p className="text-sm text-white/85">{prayer.points} points</p></div>)}</section>
  </div>;
}