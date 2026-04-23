import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function ParentDashboardPage() {
  return (
    <DashboardShell
      role="Parent"
      title="Parent Dashboard"
      subtitle="Family-facing portal for enrollment management, payment renewals, child progress tracking, and class visibility."
      accentLabel="Family overview"
      metrics={[
        { label: "Children", value: "2", hint: "Switch between each child profile and course stream." },
        { label: "Active courses", value: "4", hint: "Bundle, pair, and single-program enrollments live here." },
        { label: "Attendance rate", value: "96%", hint: "Weekly snapshots for present, absent, and late status." },
        { label: "Upcoming class", value: "Tue", hint: "Next lesson and meeting link will surface here." },
      ]}
      navItems={[
        { label: "Dashboard", href: "/parent", badge: "Live" },
        { label: "Courses", href: "/parent#courses" },
        { label: "Attendance", href: "/parent#attendance" },
        { label: "Schedule", href: "/parent#schedule" },
        { label: "Progress", href: "/parent#progress" },
        { label: "Payments", href: "/parent#payments" },
      ]}
      panels={[
        {
          eyebrow: "Family control",
          title: "Multi-child learning snapshot",
          description: "The parent dashboard will center around child switching, enrolled programmes, upcoming classes, and quick payment visibility.",
          bullets: [
            "Child selector with attendance %, next class, and current programme mix",
            "Renewal reminders, subscription status, and manual payment review state",
            "Journal, quiz, and report summaries per child in one view",
          ],
        },
        {
          eyebrow: "Communication",
          title: "Progress and support hub",
          description: "We will wire this area to teacher feedback, journal review, and downloadable progress reports.",
          bullets: [
            "Teacher comments, practice trends, and grade movement",
            "Attendance breakdown with present, late, absent, and excused counts",
            "Quick links to profile updates and registration history",
          ],
        },
      ]}
      primaryCta={{ label: "Review enrollment", href: "/registration" }}
      secondaryCta={{ label: "Open login", href: "/auth/login" }}
    />
  );
}
