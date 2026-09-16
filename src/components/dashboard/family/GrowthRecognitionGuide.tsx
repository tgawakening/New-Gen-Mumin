"use client";
import { useState } from "react";
import {
  BookOpenCheck,
  Camera,
  CheckCircle2,
  Clock3,
  Crown,
  HandHeart,
  MessageCircleHeart,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Trophy,
  Users,
} from "lucide-react";

import { HOUSE_POINT_RULES } from "@/lib/community/point-awards";

const pointWays = [
  { icon: Clock3, label: "Arrive ready and on time", points: HOUSE_POINT_RULES.ATTENDANCE_ON_TIME.points, note: "Once for each eligible live class", tone: "bg-[#e7f1ff] text-[#2465a5]" },
  { icon: Sun, label: "Submit today’s Sunnah tracker", points: HOUSE_POINT_RULES.SUNNAH_DAILY_SUBMISSION.points, note: "Once per learner each day", tone: "bg-[#fff0db] text-[#c27a2c]" },
  { icon: CheckCircle2, label: "Complete a Sunnah task", points: HOUSE_POINT_RULES.SUNNAH_TASK_COMPLETED.points, note: "For each completed tracker task", tone: "bg-[#e9f7ee] text-[#2f6b4b]" },
  { icon: Sun, label: "Complete Fajr or Isha", points: HOUSE_POINT_RULES.FARDH_FAJR_ISHA.points, note: "For each verified prayer, once per date", tone: "bg-[#e7f1ff] text-[#2465a5]" },
  { icon: CheckCircle2, label: "Complete Dhuhr, Asr or Maghrib", points: HOUSE_POINT_RULES.FARDH_OTHER_PRAYER.points, note: "For each verified prayer, once per date", tone: "bg-[#f0eaff] text-[#7453b8]" },
  { icon: BookOpenCheck, label: "Submit learning work", points: HOUSE_POINT_RULES.HOMEWORK_SUBMITTED.points, note: "For an eligible homework submission", tone: "bg-[#f0eaff] text-[#7453b8]" },
];

const teacherWays = [
  { icon: Camera, label: "Ready to learn", points: HOUSE_POINT_RULES.CAMERA_STUDY_READY.points, note: "Prepared study space, book and pen" },
  { icon: Sparkles, label: "Strong contribution", points: HOUSE_POINT_RULES.LIVE_QUIZ_ANSWER.points, note: "A thoughtful teacher-observed answer" },
  { icon: MessageCircleHeart, label: "Positive participation", points: HOUSE_POINT_RULES.POSITIVE_PARTICIPATION.points, note: "Focused, respectful and helpful in class" },
];

const automaticBadges = [
  { icon: ShieldCheck, title: "The Reliable One", criteria: "Join 4 live classes on time" },
  { icon: Star, title: "The Consistent One", criteria: "Complete 7 daily Sunnah trackers" },
  { icon: BookOpenCheck, title: "The Seeker", criteria: "Submit 3 learning assignments" },
];

const teacherBadges = [
  { icon: HandHeart, title: "Service", criteria: "Help and notice others with sincerity" },
  { icon: Crown, title: "Character & leadership", criteria: "Show courage, truth and help others succeed" },
  { icon: Users, title: "Qabila builder", criteria: "Strengthen teammates and cooperate across Qabilas" },
];

export function GrowthRecognitionGuide() {
  const [open, setOpen] = useState(false);
  return <section className="rounded-[26px] border border-[#d8e3ed] bg-white p-4 shadow-sm">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0db] text-[#b66712]"><Trophy className="h-6 w-6"/></span><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#c27a2c]">Points & recognition</p><h2 className="mt-1 text-xl font-black text-[#22304a]">Build character. Strengthen your Qabila.</h2><p className="mt-1 text-sm text-[#617184]">Verified actions earn points; consistent character earns badges.</p></div></div>
      <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-[#173b64] px-5 py-3 text-center text-sm font-bold text-white">View how points & badges work</button>{open ? <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#0b1730]/70 p-3 backdrop-blur-sm sm:p-8"><div className="mx-auto max-w-6xl rounded-[30px] bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[30px] bg-[#10294a] px-5 py-4 text-white"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#f7c56f]">Full points guide</p><h3 className="mt-1 text-xl font-black">How growth is recognised</h3></div><button type="button" onClick={() => setOpen(false)} className="rounded-full border border-white/20 px-4 py-2 text-sm font-bold">Close ×</button></div><div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-2">
        <div className="rounded-[24px] bg-[#fffaf4] p-4 sm:p-5"><div className="flex items-center gap-3"><Trophy className="h-6 w-6 text-[#b66712]"/><div><h4 className="font-bold text-[#22304a]">Qabila points</h4><p className="text-xs text-[#617184]">Verified actions add to personal and shared progress.</p></div></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{pointWays.map(({icon:Icon,label,points,note,tone})=><article key={label} className="rounded-2xl border border-[#f0e3d2] bg-white p-3"><div className="flex gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5"/></span><div><p className="text-sm font-bold text-[#22304a]">{label}</p><p className="mt-1 text-xs text-[#617184]">{note}</p></div><b className="ml-auto text-xs text-[#a85c0d]">+{points}</b></div></article>)}</div><p className="mt-4 text-xs font-bold uppercase tracking-[.12em] text-[#2465a5]">Teacher-awarded with written evidence</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{teacherWays.map(({icon:Icon,label,points,note})=><div key={label} className="rounded-xl bg-white p-3"><Icon className="h-5 w-5 text-[#7453b8]"/><p className="mt-2 text-xs font-bold">{label} +{points}</p><p className="mt-1 text-[11px] text-[#617184]">{note}</p></div>)}</div></div>
        <div className="rounded-[24px] bg-[#f7f4ff] p-4 sm:p-5"><div className="flex items-center gap-3"><Star className="h-6 w-6 text-[#7453b8]"/><div><h4 className="font-bold text-[#22304a]">Recognition & character badges</h4><p className="text-xs text-[#617184]">Repeated habits and observed character are celebrated.</p></div></div><p className="mt-4 text-xs font-bold uppercase tracking-[.12em] text-[#2f6b4b]">Earned automatically</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{automaticBadges.map(({icon:Icon,title,criteria})=><article key={title} className="rounded-2xl bg-white p-3"><Icon className="h-6 w-6 text-[#2f6b4b]"/><p className="mt-2 text-sm font-bold">{title}</p><p className="mt-1 text-xs text-[#617184]">{criteria}</p></article>)}</div><p className="mt-4 text-xs font-bold uppercase tracking-[.12em] text-[#7453b8]">Awarded by a teacher with evidence</p><div className="mt-2 grid gap-2 sm:grid-cols-3">{teacherBadges.map(({icon:Icon,title,criteria})=><article key={title} className="rounded-2xl bg-white p-3"><Icon className="h-6 w-6 text-[#7453b8]"/><p className="mt-2 text-sm font-bold">{title}</p><p className="mt-1 text-xs text-[#617184]">{criteria}</p></article>)}</div><div className="mt-4 rounded-2xl bg-[#22304a] p-4 text-xs leading-5 text-white/85"><strong className="text-[#f7c56f]">Character is the goal:</strong> help teammates, serve the Ummah, and grow together—do not chase points alone.</div></div>
      </div></div></div> : null}
    </div>
  </section>;
}