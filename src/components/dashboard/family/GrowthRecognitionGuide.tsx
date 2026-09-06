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
  return (
    <section className="overflow-hidden rounded-[30px] border border-[#eadfce] bg-white shadow-sm" aria-labelledby="growth-guide-title">
      <div className="bg-gradient-to-r from-[#10294a] via-[#173b64] to-[#22517d] px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#f7c56f]">How growth is recognised</p>
            <h2 id="growth-guide-title" className="mt-1 text-2xl font-bold">Build character. Strengthen your Qabila.</h2>
          </div>
          <div className="max-w-md rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm leading-6 text-white/90">
            Don’t chase points—use every action to build consistency, support teammates, serve the Ummah, and grow together.
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-5 xl:grid-cols-2">
        <div className="rounded-[24px] bg-[#fffaf4] p-4 sm:p-5">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#ffe6be] text-[#b66712]"><Trophy className="h-5 w-5" /></span><div><h3 className="font-bold text-[#22304a]">Qabila points</h3><p className="text-xs text-[#617184]">Verified actions add to personal and shared progress.</p></div></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {pointWays.map(({ icon: Icon, label, points, note, tone }) => <article key={label} className="rounded-2xl border border-[#f0e3d2] bg-white p-3"><div className="flex items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-sm font-bold text-[#22304a]">{label}</p><p className="mt-1 text-xs leading-5 text-[#617184]">{note}</p></div><span className="ml-auto shrink-0 rounded-full bg-[#fff0db] px-2.5 py-1 text-xs font-black text-[#a85c0d]">+{points}</span></div></article>)}
          </div>
          <div className="mt-3 rounded-2xl border border-[#d9e6f2] bg-[#f5faff] p-3"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2465a5]">Teacher-awarded during class</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{teacherWays.map(({ icon: Icon, label, points, note }) => <div key={label} className="rounded-xl bg-white p-3"><Icon className="h-5 w-5 text-[#7453b8]"/><p className="mt-2 text-xs font-bold text-[#22304a]">{label} <span className="text-[#2f6b4b]">+{points}</span></p><p className="mt-1 text-[11px] leading-4 text-[#617184]">{note}</p></div>)}</div><p className="mt-3 text-[11px] leading-5 text-[#617184]">Teachers record a short observation. The same learner cannot receive the same award twice for the same session and day.</p></div>
        </div>

        <div className="rounded-[24px] bg-[#f7f4ff] p-4 sm:p-5">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e7ddff] text-[#7453b8]"><Star className="h-5 w-5" /></span><div><h3 className="font-bold text-[#22304a]">Recognition & character badges</h3><p className="text-xs text-[#617184]">Badges celebrate repeated habits and meaningful character.</p></div></div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[#2f6b4b]">Earned automatically</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">{automaticBadges.map(({ icon: Icon, title, criteria }) => <article key={title} className="rounded-2xl border border-[#dcebdd] bg-white p-3"><Icon className="h-6 w-6 text-[#2f6b4b]"/><p className="mt-2 text-sm font-bold text-[#22304a]">{title}</p><p className="mt-1 text-xs leading-5 text-[#617184]">{criteria}</p></article>)}</div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[#7453b8]">Awarded by a teacher with evidence</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">{teacherBadges.map(({ icon: Icon, title, criteria }) => <article key={title} className="rounded-2xl border border-[#e4dcf4] bg-white p-3"><Icon className="h-6 w-6 text-[#7453b8]"/><p className="mt-2 text-sm font-bold text-[#22304a]">{title}</p><p className="mt-1 text-xs leading-5 text-[#617184]">{criteria}</p></article>)}</div>
          <div className="mt-3 rounded-2xl bg-[#22304a] px-4 py-3 text-xs leading-5 text-white/85"><strong className="text-[#f7c56f]">Healthy competition:</strong> helping a teammate, serving another Qabila, and lifting others matters more than finishing first.</div>
        </div>
      </div>
    </section>
  );
}