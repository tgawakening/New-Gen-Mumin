import Image from "next/image";
import Link from "next/link";
import { Award, Download, LockKeyhole, ShieldCheck, Sparkles, Star, Trophy, Users } from "lucide-react";

import type { getRecognitionDashboard } from "@/lib/community/recognition";
import { QuizAnimalAvatar } from "@/components/quizzes/QuizAnimalAvatar";

type Data = Awaited<ReturnType<typeof getRecognitionDashboard>>;

export function RewardsDashboard({ data, parentView = false }: { data: Data; parentView?: boolean }) {
  const name = data.student?.displayName || [data.student?.user.firstName, data.student?.user.lastName].filter(Boolean).join(" ") || "Student";
  const featured = data.awards.find((award) => award.featuredWeek);
  const gender = data.student?.registrationStudents[0]?.gender?.toLowerCase() ?? "";
  const characterSrc = gender.includes("girl") || gender.includes("female") ? "/gen-mumin-chars/rania-superhero.png" : "/gen-mumin-chars/ali-superhero.png";
  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[28px] border border-[#eadfce] bg-gradient-to-br from-white via-white to-[#fff2dc] p-5 shadow-sm lg:min-h-64 lg:pr-64">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">Character & community journey</p><h2 className="mt-2 text-2xl font-semibold text-[#22304a]">{name}&apos;s House & Rewards</h2><p className="mt-2 text-sm text-[#617184]">Every verified action strengthens character and the whole House.</p></div>
        <span className="rounded-full border border-[#d8e3ed] bg-[#fbf6ef] px-4 py-2 text-sm font-semibold text-[#22304a]">{data.membership.qabilaGroup || data.membership.house.name}{data.membership.role !== "MEMBER" ? ` — ${data.membership.role.replace("_", " ")}` : ""}</span>
      </div>
      <div className="absolute right-8 top-5 z-20 hidden max-w-44 rounded-[22px] border border-[#f1c878] bg-white px-4 py-3 text-center text-sm font-bold text-[#22304a] shadow-lg lg:block">{data.nextUnlock ? `Only ${Math.max(0, data.nextUnlock.milestone - data.collective)} points to the next House unlock!` : "Your House unlocked every published reward!"}</div>
      <div className="absolute bottom-0 right-3 hidden h-52 w-52 overflow-hidden rounded-t-[34px] lg:block"><Image src={characterSrc} alt="Gen-M character celebrating House progress" fill className="object-cover object-[50%_14%]" /></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[{label:"My points",value:data.total,icon:Star},{label:"Recognition level",value:data.level.title,icon:Trophy},{label:"Badges earned",value:data.awards.length,icon:Award},{label:"House points",value:data.collective,icon:Users}].map(({label,value,icon:Icon})=><div key={label} className="rounded-[20px] border border-[#eadfce] bg-[#fffaf4] p-4"><Icon className="h-5 w-5 text-[#c27a2c]"/><p className="mt-3 text-2xl font-semibold text-[#22304a]">{value}</p><p className="text-xs text-[#617184]">{label}</p></div>)}
      </div>
    </section>

    <section className="rounded-[26px] bg-[#172842] p-5 text-white shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f4bd72]">My House points journey</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><p className="text-4xl font-semibold">{data.collective}</p><p className="mt-1 text-sm text-[#cfdaea]">Collective verified points</p></div>{data.nextUnlock?<div className="rounded-2xl bg-white/10 px-4 py-3 text-sm"><strong>{Math.max(0,data.nextUnlock.milestone-data.collective)} points</strong> to {data.nextUnlock.title}</div>:<div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">All published milestones unlocked</div>}</div>
      {data.nextUnlock?<div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#f5a95f]" style={{width:`${Math.min(100,(data.collective/data.nextUnlock.milestone)*100)}%`}}/></div>:null}
      <p className="mt-4 text-sm text-[#cfdaea]">When I become stronger, my House becomes stronger.</p>
    </section>

    <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[26px] border border-[#eadfce] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">How my points were earned</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(data.pointBreakdown).map(([category, points]) => <div key={category} className="rounded-2xl bg-[#fbf6ef] p-4"><p className="text-2xl font-semibold text-[#22304a]">{points}</p><p className="text-xs capitalize text-[#617184]">{category}</p></div>)}</div></div>
      <div className="rounded-[26px] border border-[#eadfce] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">Recognition ladder</p><div className="mt-4 space-y-2">{data.recognitionLevels.map((level) => <div key={level.key} className={"flex items-center justify-between rounded-2xl px-4 py-3 "+(data.total >= level.min ? "bg-[#edf8f0] text-[#2f6b4b]" : "bg-[#f5f7fa] text-[#7a8797]")}><span className="font-semibold">{level.title}</span><span className="text-xs">{level.min}+ pts</span></div>)}</div></div>
    </section>
    {data.unlocks.length ? <section className="rounded-[26px] border border-[#eadfce] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">House rewards unlocked</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.unlocks.map((unlock) => <div key={unlock.id} className="rounded-2xl bg-[#fff7eb] p-4"><p className="font-semibold text-[#22304a]">{unlock.title}</p><p className="mt-1 text-sm text-[#617184]">{unlock.description}</p><p className={"mt-2 text-xs font-semibold "+(unlock.claimedAt ? "text-[#2f6b4b]" : "text-[#c27a2c]")}>{unlock.claimedAt ? "Reward delivered" : "Unlocked · awaiting delivery"}</p></div>)}</div></section> : null}
    {featured?<section className="rounded-[26px] border border-[#f0d3aa] bg-[#fff7eb] p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">Weekly recognition</p><div className="mt-3 flex items-start gap-4"><Trophy className="h-10 w-10 text-[#c27a2c]"/><div><h3 className="text-xl font-semibold text-[#22304a]">Mumin of the Week</h3><p className="mt-1 font-semibold text-[#2f6b4b]">{featured.title}</p><p className="mt-2 text-sm leading-6 text-[#617184]">{featured.evidence}</p><p className="mt-2 text-xs text-[#7a8797]">Teacher nominated — not selected by points alone.</p></div></div></section>:null}

    <section className="rounded-[24px] border border-[#eadfce] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">My quiz avatar</p><p className="mt-1 text-sm text-[#617184]">Your selected animal friend celebrates your progress.</p></div><div className="flex gap-3"><QuizAnimalAvatar avatarId="giggle-lion" animated/><QuizAnimalAvatar avatarId="clever-fox"/><QuizAnimalAvatar avatarId="happy-panda"/><QuizAnimalAvatar avatarId="bouncy-bunny"/></div></div>
    </section>
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-[26px] border border-[#eadfce] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">What {name} is becoming</p><div className="mt-4 grid gap-3 sm:grid-cols-2">{data.badgeDefinitions.map((badge)=>{const award=data.awards.find((item)=>item.badgeKey===badge.key); return <div key={badge.key} className={`rounded-2xl border p-4 ${award?"border-[#b9ddc7] bg-[#f0faf3]":"border-[#e1e6ed] bg-[#f8fafc]"}`}><div className="flex items-center gap-3">{award?<ShieldCheck className="h-6 w-6 text-[#2f6b4b]"/>:<LockKeyhole className="h-6 w-6 text-[#8793a3]"/>}<div><p className="font-semibold text-[#22304a]">{badge.title}</p><p className="text-xs text-[#617184]">{award?"Earned":"Not yet earned"}</p></div></div><p className="mt-3 text-sm leading-6 text-[#617184]">{award?.evidence||badge.description}</p>{award?<Link href={`/certificates/${award.certificateCode}`} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#0f4d81]"><Download className="h-4 w-4"/>View certificate</Link>:null}</div>})}</div></section>
      <section className="space-y-4 rounded-[26px] border border-[#eadfce] bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">House activity</p>{data.activity.map((event)=><div key={event.id} className="rounded-2xl bg-[#fbf6ef] p-4"><div className="flex justify-between gap-3"><p className="font-semibold text-[#22304a]">{event.studentName}</p><span className="font-semibold text-[#2f6b4b]">+{event.points}</span></div><p className="mt-1 text-sm text-[#617184]">{event.reason}</p></div>)}{!data.activity.length?<p className="text-sm text-[#617184]">Verified contributions will appear here.</p>:null}</section>
    </div>
    <section className="rounded-[22px] border border-[#eadfce] bg-[#fffaf4] p-4 text-center text-sm font-semibold text-[#22304a]"><Sparkles className="mr-2 inline h-5 w-5 text-[#c27a2c]"/>Points are the game. Character is the goal. Community is the outcome.{parentView?" From my child to our children.":""}</section>
  </div>;
}