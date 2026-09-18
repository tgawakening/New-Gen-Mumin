import "server-only";

import Image from "next/image";
import { Sparkles, TrendingUp, Trophy, Users } from "lucide-react";

import { canonicalQabilaName, QABILA_NAMES, qabilaProfile } from "@/lib/community/qabilas";
import { db } from "@/lib/db";

const weekMs = 7 * 24 * 60 * 60 * 1000;

function contributionLabel(sourceType: string, reason: string) {
  if (sourceType.startsWith("SUNNAH")) return "Sunnah tracker progress";
  if (sourceType.startsWith("FARDH")) return "Daily Salah progress";
  if (sourceType.includes("ATTENDANCE")) return "On-time attendance";
  if (sourceType.includes("HOMEWORK")) return "Learning work completed";
  if (sourceType.includes("QUIZ")) return "Quiz contribution";
  if (sourceType.includes("RECOGNITION") || sourceType.includes("CROSS_HOUSE")) return "Character recognition";
  return reason || "Verified contribution";
}

export async function QabilaLeaderboardOverview({ audience }: { audience: "parent" | "teacher" }) {
  // Server-rendered live leaderboard: this moving seven-day window is intentionally request-time data.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - weekMs);
  const [totals, memberships, recent] = await Promise.all([
    db.housePointLedger.groupBy({ by: ["studentId"], _sum: { points: true } }),
    db.houseMembership.findMany({ where: { qabilaGroup: { not: null } }, select: { studentId: true, qabilaGroup: true } }),
    db.housePointLedger.findMany({ where: { points: { gt: 0 } }, orderBy: { awardedAt: "desc" }, take: 160, select: { studentId: true, points: true, reason: true, sourceType: true, awardedAt: true, student: { select: { displayName: true, user: { select: { firstName: true } }, houseMembership: { select: { qabilaGroup: true } } } } } }),
  ]);
  const qabilaByStudent = new Map(memberships.map((row) => [row.studentId, canonicalQabilaName(row.qabilaGroup)]));
  const scores = new Map(QABILA_NAMES.map((name) => [name, 0]));
  for (const row of totals) { const name = qabilaByStudent.get(row.studentId); if (name) scores.set(name, (scores.get(name) ?? 0) + (row._sum.points ?? 0)); }
  const rows = QABILA_NAMES.map((name) => {
    const activity = recent.filter((item) => canonicalQabilaName(item.student.houseMembership?.qabilaGroup) === name);
    const unique = [...new Map(activity.map((item) => [item.studentId, item])).values()].slice(0, 2);
    return { name, profile: qabilaProfile(name)!, points: scores.get(name) ?? 0, weekly: activity.filter((item) => item.awardedAt >= since).reduce((sum, item) => sum + item.points, 0), members: memberships.filter((item) => canonicalQabilaName(item.qabilaGroup) === name).length, activity: unique };
  }).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const max = Math.max(1, ...rows.map((row) => row.points));
  return <section className="overflow-hidden rounded-[30px] border border-[#d7e1eb] bg-white shadow-[0_18px_50px_rgba(25,48,77,.1)]">
    <header className="bg-[radial-gradient(circle_at_88%_20%,rgba(255,199,101,.23),transparent_28%),linear-gradient(125deg,#10294a,#1e527d)] px-5 py-5 text-white sm:px-6"><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[#ffd073]"><Trophy className="h-4 w-4"/>Healthy Qabila competition</p><h2 className="mt-2 text-2xl font-black">Live Qabila leaderboard</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-white/75">Every verified act of learning, consistency and service strengthens the whole Qabila.</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-xs leading-5 text-white/80">{audience === "teacher" ? "Celebrate progress and encourage every learner fairly." : "Encourage your child to contribute with sincerity—not to chase points alone."}</div></div></header>
    <div className="space-y-3 p-4 sm:p-5">{rows.map((row,index)=><article key={row.name} className={`relative overflow-hidden rounded-[24px] border p-4 transition-shadow hover:shadow-md sm:p-5 ${index===0?"border-[#e0b45f] bg-gradient-to-r from-[#fffaf0] to-[#fbfcfe]":"border-[#dfe6ed] bg-[#fbfcfe]"}`}>
      <div className="grid items-center gap-4 md:grid-cols-[minmax(240px,1.05fr)_minmax(210px,.75fr)_minmax(280px,1.2fr)]">
        <div className="flex min-w-0 items-center gap-4"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl font-black ${index===0?"bg-[#f1b94f] text-[#142b4a]":"bg-[#e7edf3] text-[#53667d]"}`}>#{index+1}</span><Image src={row.profile.image} alt={row.name} width={62} height={62} className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-sm"/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-lg font-black text-[#1c304d]">{row.name}</h3>{index===0?<span className="rounded-full bg-[#fff0c7] px-2.5 py-1 text-[10px] font-black uppercase tracking-[.1em] text-[#94600d]">Leading</span>:null}</div><p className="text-xs text-[#6d7a8b]">{row.profile.mentor}</p><p className="mt-1 flex items-center gap-1 text-xs font-bold text-[#5e6c7e]"><Users className="h-3.5 w-3.5"/>{row.members} learners</p></div></div>
        <div><div className="flex items-end justify-between gap-3"><div><p className="text-3xl font-black tabular-nums text-[#142b4a]">{row.points}</p><p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#7a8797]">total points</p></div><span className="shrink-0 rounded-full bg-[#eaf7ef] px-3 py-1.5 text-xs font-black text-[#2d7650]"><TrendingUp className="mr-1 inline h-3.5 w-3.5"/>+{row.weekly}</span></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e7edf3]"><div className="h-full rounded-full transition-[width] duration-500" style={{width:`${Math.max(4,(row.points/max)*100)}%`,backgroundColor:row.profile.color}}/></div><p className="mt-1 text-right text-[10px] text-[#8490a0]">7-day growth</p></div>
        <div className="rounded-[18px] border border-[#e3e9ef] bg-white/90 p-3"><p className="mb-2 text-[10px] font-black uppercase tracking-[.14em] text-[#a46626]">Recent contributions</p><div className="space-y-2">{row.activity.map((item)=><div key={`${item.studentId}-${item.awardedAt.toISOString()}`} className="flex items-start justify-between gap-3 text-xs"><div className="min-w-0"><p className="truncate font-bold text-[#2c405b]">{item.student.displayName || item.student.user.firstName}</p><p className="truncate text-[#788596]">{contributionLabel(item.sourceType,item.reason)}</p></div><span className="shrink-0 font-black text-[#2d7650]">+{item.points}</span></div>)}{!row.activity.length?<p className="text-xs text-[#8a95a3]">New verified activity will appear here.</p>:null}</div></div>
      </div>
    </article>)}</div>    <footer className="flex items-center justify-center gap-2 border-t border-[#e3e9ef] bg-[#fffaf2] px-5 py-3 text-center text-xs font-bold text-[#6c604f]"><Sparkles className="h-4 w-4 text-[#c37a27]"/>We compete in good deeds, support one another, and grow together.</footer>
  </section>;
}