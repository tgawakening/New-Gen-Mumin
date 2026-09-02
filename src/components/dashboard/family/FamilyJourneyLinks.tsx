import Link from "next/link";
import { BookOpen, CalendarDays, CheckCircle2, PlayCircle, Sparkles, Trophy } from "lucide-react";

type JourneyLink = { label: string; description: string; href: string; icon: typeof CalendarDays; tone: string };

export function FamilyJourneyLinks({ role, childId }: { role: "student" | "parent"; childId?: string }) {
  const suffix = role === "parent" && childId ? "?child=" + encodeURIComponent(childId) : "";
  const root = role === "parent" ? "/parent" : "/student";
  const links: JourneyLink[] = role === "parent"
    ? [
        { label: "Open child dashboard", description: "Everything about this learner in one place.", href: "/parent/student-view" + suffix, icon: Sparkles, tone: "bg-[#fff0db] text-[#c27a2c]" },
        { label: "Join next class", description: "Schedule and live Zoom access.", href: root + "/schedule" + suffix, icon: CalendarDays, tone: "bg-[#e7f1ff] text-[#2465a5]" },
        { label: "Review attendance", description: "One verified record per class.", href: root + "/attendance" + suffix, icon: CheckCircle2, tone: "bg-[#e9f7ee] text-[#2f6b4b]" },
        { label: "House & rewards", description: "Points, badges and certificates.", href: root + "/rewards" + suffix, icon: Trophy, tone: "bg-[#fff0db] text-[#c27a2c]" },
        { label: "Activities", description: "Quizzes and today’s learning tasks.", href: root + "/quizzes" + suffix, icon: PlayCircle, tone: "bg-[#f0eaff] text-[#7453b8]" },
        { label: "Recordings & learning", description: "Catch up and review course content.", href: root + "/recordings" + suffix, icon: BookOpen, tone: "bg-[#e7f1ff] text-[#2465a5]" },
      ]
    : [
        { label: "Join next class", description: "See what is live and join quickly.", href: root + "/schedule", icon: CalendarDays, tone: "bg-[#e7f1ff] text-[#2465a5]" },
        { label: "Today’s activities", description: "Open quizzes and learning missions.", href: root + "/quizzes", icon: PlayCircle, tone: "bg-[#f0eaff] text-[#7453b8]" },
        { label: "Sunnah tracker", description: "Complete today’s tracker once.", href: root + "/missions?type=sunnah", icon: CheckCircle2, tone: "bg-[#e9f7ee] text-[#2f6b4b]" },
        { label: "House & rewards", description: "See points, badges and certificates.", href: root + "/rewards", icon: Trophy, tone: "bg-[#fff0db] text-[#c27a2c]" },
        { label: "My learning", description: "Courses, lessons and recordings.", href: root + "/courses", icon: BookOpen, tone: "bg-[#e7f1ff] text-[#2465a5]" },
        { label: "My progress", description: "Attendance and learning growth.", href: root + "/progress", icon: Sparkles, tone: "bg-[#fff0db] text-[#c27a2c]" },
      ];
  return (
    <section className="rounded-[26px] border border-[#eadfce] bg-white p-4 shadow-sm sm:p-5">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">Start here</p><h2 className="mt-1 text-xl font-semibold text-[#22304a]">What would you like to do?</h2><p className="mt-1 text-sm text-[#617184]">Choose one clear action. You can always return to Dashboard.</p></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {links.map(({ label, description, href, icon: Icon, tone }) => <Link key={href} href={href} className="group flex min-h-24 items-center gap-3 rounded-[20px] border border-[#e4e9ef] bg-[#fbfcfe] p-3 transition hover:-translate-y-0.5 hover:border-[#c9d7e6] hover:shadow-md"><span className={"flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl " + tone}><Icon className="h-5 w-5"/></span><span><span className="block font-semibold text-[#22304a]">{label}</span><span className="mt-1 block text-xs leading-5 text-[#617184]">{description}</span></span></Link>)}
      </div>
    </section>
  );
}