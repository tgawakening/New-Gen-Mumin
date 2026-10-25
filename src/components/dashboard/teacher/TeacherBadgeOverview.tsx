import Link from "next/link";
import { Award, ArrowRight } from "lucide-react";
import { CHARACTER_BADGES } from "@/lib/community/recognition";

const automatic = new Set(["RELIABLE", "CONSISTENT", "SEEKER"]);

export function TeacherBadgeOverview() {
  return <section aria-labelledby="teacher-badge-guide" className="rounded-3xl border border-[#eadfce] bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-widest text-[#aa6822]">Celebrate character</p><h2 id="teacher-badge-guide" className="mt-2 text-2xl font-bold text-[#22304a]">Badges: what to look for</h2><p className="mt-2 text-sm text-[#617184]">Recognise a specific action you saw. Choose a badge below to open the award form.</p></div>
      <Link href="/teacher/recognition#award-badge" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#22304a] px-5 py-3 text-sm font-bold text-white">Award a badge <ArrowRight className="h-4 w-4" /></Link>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {CHARACTER_BADGES.map(badge => <article key={badge.key} className="flex flex-col rounded-2xl border border-[#eadfce] bg-[#fffaf2] p-4">
        <Award aria-hidden="true" className="mb-2 h-7 w-7 text-[#b87324]" />
        <h3 className="font-bold text-[#22304a]">{badge.title}</h3>
        <p className="mt-2 flex-1 text-sm leading-6 text-[#617184]">{badge.description}</p>
        {automatic.has(badge.key) ? <p className="mt-3 text-xs font-semibold text-[#617184]">Earned automatically through recorded progress</p> : <Link href={badge.key === "MUMIN_OF_WEEK" ? "/teacher/recognition?tab=certificate" : `/teacher/recognition?badge=${badge.key}#award-badge`} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#24466e]">{badge.key === "MUMIN_OF_WEEK" ? "Award weekly certificate" : "Award this badge"}<ArrowRight className="h-4 w-4" /></Link>}
      </article>)}
    </div>
  </section>;
}
