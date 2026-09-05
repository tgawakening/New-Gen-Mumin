import { BookOpen, CalendarDays, CheckCircle2, MessageCircle, PlayCircle, Sparkles, Star, Trophy } from "lucide-react";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ActivityShortcutLink } from "@/components/dashboard/family/ActivityShortcutLink";

type Role = "student" | "parent" | "teacher" | "admin";
type Item = { key: string; label: string; description: string; href: string; icon: typeof CalendarDays; tone: string };

function category(notification: { title: string; body: string; href: string | null }) {
  const value = `${notification.title} ${notification.body} ${notification.href ?? ""}`.toLowerCase();
  if (value.includes("sunnah") || value.includes("mission")) return "sunnah";
  if (value.includes("quiz")) return "quizzes";
  if (value.includes("house point") || value.includes("recognition") || value.includes("badge") || value.includes("award")) return "rewards";
  if (value.includes("qabila") || value.includes("community") || value.includes("message")) return "community";
  if (value.includes("class") || value.includes("zoom") || value.includes("schedule") || value.includes("attendance")) return "classes";
  if (value.includes("submission") || value.includes("homework") || value.includes("journal") || value.includes("task")) return "reviews";
  return "updates";
}

function roleItems(role: Role, childId?: string): Item[] {
  const suffix = role === "parent" && childId ? `?child=${encodeURIComponent(childId)}` : "";
  if (role === "teacher") return [
    { key: "classes", label: "Live sessions", description: "Start or manage today’s classes.", href: "/teacher/live-sessions", icon: CalendarDays, tone: "bg-[#e7f1ff] text-[#2465a5]" },
    { key: "rewards", label: "Live House Points", description: "Award points while teaching.", href: "/teacher/house-points", icon: Star, tone: "bg-[#fff0db] text-[#c27a2c]" },
    { key: "quizzes", label: "Quizzes", description: "Run live quizzes and review answers.", href: "/teacher/quizzes", icon: PlayCircle, tone: "bg-[#f0eaff] text-[#7453b8]" },
    { key: "sunnah", label: "Sunnah Tracker", description: "Publish and review daily trackers.", href: "/teacher/missions", icon: CheckCircle2, tone: "bg-[#e9f7ee] text-[#2f6b4b]" },
    { key: "community", label: "Qabila Community", description: "Read and guide team discussions.", href: "/teacher/community", icon: MessageCircle, tone: "bg-[#e7f1ff] text-[#2465a5]" },
    { key: "reviews", label: "Student reviews", description: "Check submitted learning work.", href: "/teacher/quizzes", icon: BookOpen, tone: "bg-[#fff0db] text-[#c27a2c]" },
  ];
  if (role === "admin") return [
    { key: "classes", label: "Live Classes", description: "Monitor current and upcoming classes.", href: "/admin/classes", icon: CalendarDays, tone: "bg-[#e7f1ff] text-[#2465a5]" },
    { key: "community", label: "Community", description: "Monitor Qabilas and flagged messages.", href: "/admin/community", icon: MessageCircle, tone: "bg-[#f0eaff] text-[#7453b8]" },
    { key: "rewards", label: "Rewards", description: "Review points, badges and recognition.", href: "/admin/rewards", icon: Trophy, tone: "bg-[#fff0db] text-[#c27a2c]" },
    { key: "reviews", label: "Teacher dashboards", description: "Review teaching and student activity.", href: "/admin/teachers", icon: BookOpen, tone: "bg-[#e9f7ee] text-[#2f6b4b]" },
  ];
  if (role === "parent") return [
    { key: "classes", label: "Join next class", description: "Schedule and live Zoom access.", href: `/parent/schedule${suffix}`, icon: CalendarDays, tone: "bg-[#e7f1ff] text-[#2465a5]" },
    { key: "quizzes", label: "Activities", description: "Live quizzes and learning tasks.", href: `/parent/quizzes${suffix}`, icon: PlayCircle, tone: "bg-[#f0eaff] text-[#7453b8]" },
    { key: "sunnah", label: "Sunnah Tracker", description: "Review today’s tracker.", href: `/parent/sunnah-tracker${suffix}`, icon: CheckCircle2, tone: "bg-[#e9f7ee] text-[#2f6b4b]" },
    { key: "community", label: "Qabila Chat", description: "Supervise your child’s community.", href: `/parent/community${suffix}`, icon: MessageCircle, tone: "bg-[#e7f1ff] text-[#2465a5]" },
    { key: "rewards", label: "House & rewards", description: "Points, badges and recognition.", href: `/parent/rewards${suffix}`, icon: Trophy, tone: "bg-[#fff0db] text-[#c27a2c]" },
    { key: "updates", label: "Child dashboard", description: "Open the complete learner view.", href: `/parent/student-view${suffix}`, icon: Sparkles, tone: "bg-[#f0eaff] text-[#7453b8]" },
  ];
  return [
    { key: "classes", label: "Join next class", description: "See what is live and join quickly.", href: "/student/schedule", icon: CalendarDays, tone: "bg-[#e7f1ff] text-[#2465a5]" },
    { key: "quizzes", label: "Today’s activities", description: "Open live quizzes and tasks.", href: "/student/quizzes", icon: PlayCircle, tone: "bg-[#f0eaff] text-[#7453b8]" },
    { key: "sunnah", label: "Sunnah Tracker", description: "Complete today’s tracker once.", href: "/student/missions?type=sunnah", icon: CheckCircle2, tone: "bg-[#e9f7ee] text-[#2f6b4b]" },
    { key: "community", label: "Qabila Chat", description: "Talk with your supervised team.", href: "/student/community", icon: MessageCircle, tone: "bg-[#e7f1ff] text-[#2465a5]" },
    { key: "rewards", label: "House & rewards", description: "See points, badges and progress.", href: "/student/rewards", icon: Trophy, tone: "bg-[#fff0db] text-[#c27a2c]" },
    { key: "updates", label: "My learning", description: "Courses, lessons and recordings.", href: "/student/courses", icon: BookOpen, tone: "bg-[#fff0db] text-[#c27a2c]" },
  ];
}

export async function FamilyJourneyLinks({ role, childId }: { role: Role; childId?: string }) {
  const session = await getCurrentSession();
  type NotificationSummary = { id: string; title: string; body: string; href: string | null };
  let notifications: NotificationSummary[] = [];
  try {
    notifications = session
      ? await db.notification.findMany({
          where: { userId: session.user.id, readAt: null },
          orderBy: { createdAt: "desc" },
          take: 100,
          select: { id: true, title: true, body: true, href: true },
        })
      : [];
  } catch (error) {
    console.error("Dashboard activity notifications unavailable", error);
  }
  const grouped = new Map<string, NotificationSummary[]>();
  for (const notification of notifications) grouped.set(category(notification), [...(grouped.get(category(notification)) ?? []), notification]);

  let liveClassTitle: string | null = null;
  let liveQuiz: { id: string } | null = null;
  if (session?.user.role === "TEACHER" && role === "teacher") {
    try {
      const [occurrence, quiz] = await Promise.all([
        db.liveClassSessionOccurrence.findFirst({ where: { teacherUserId: session.user.id, endedAt: null, startedAt: { gte: new Date(Date.now() - 12 * 60 * 60 * 1000) } }, orderBy: { startedAt: "desc" }, select: { schedule: { select: { title: true } } } }),
        db.quizLiveSession.findFirst({ where: { teacherUserId: session.user.id, status: { in: ["WAITING", "LIVE"] }, updatedAt: { gte: new Date(Date.now() - 45 * 1000) } }, orderBy: { updatedAt: "desc" }, select: { id: true } }),
      ]);
      liveClassTitle = occurrence?.schedule.title ?? null;
      liveQuiz = quiz;
    } catch (error) {
      console.error("Teacher live dashboard alerts unavailable", error);
    }
  }

  const items = roleItems(role, childId).map((item) => {
    if (role === "teacher" && item.key === "rewards" && liveClassTitle) return { ...item, description: `Live now: ${liveClassTitle}`, syntheticAlert: true };
    if (role === "teacher" && item.key === "quizzes" && liveQuiz) return { ...item, href: `/teacher/quizzes/live/${liveQuiz.id}`, description: "A live quiz is currently open.", syntheticAlert: true };
    return { ...item, syntheticAlert: false };
  });

  return <section className="rounded-[26px] border border-[#eadfce] bg-white p-4 shadow-sm sm:p-5">
    <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">Quick actions</p><h2 className="mt-1 text-xl font-semibold text-[#22304a]">Open what needs your attention</h2><p className="mt-1 text-sm text-[#617184]">Red numbers show new activity. Open a card to mark those updates as seen.</p></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(({ key, label, description, href, icon: Icon, tone, syntheticAlert }) => {
        const updates = grouped.get(key) ?? [];
        const ids = updates.map((entry) => entry.id);
        const alertText = syntheticAlert ? description : updates[0]?.body ?? null;
        const shownIds = syntheticAlert && !ids.length ? ["live"] : ids;
        return <ActivityShortcutLink key={`${key}-${href}`} href={href} notificationIds={shownIds} alertText={alertText} className="group relative flex min-h-24 items-center gap-3 rounded-[20px] border border-[#e4e9ef] bg-[#fbfcfe] p-3 transition hover:-translate-y-0.5 hover:border-[#c9d7e6] hover:shadow-md">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-5 w-5"/></span><span><span className="block font-semibold text-[#22304a]">{label}</span><span className="mt-1 block text-xs leading-5 text-[#617184]">{description}</span></span>
        </ActivityShortcutLink>;
      })}
    </div>
  </section>;
}
