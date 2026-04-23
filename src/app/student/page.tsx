import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function StudentDashboardPage() {
  return (
    <DashboardShell
      role="Student"
      title="Student Dashboard"
      subtitle="A focused learning area for classes, quizzes, journals, attendance history, and progress milestones."
      accentLabel="Learning path"
      metrics={[
        { label: "Enrolled courses", value: "3", hint: "Course tiles will link into lessons, quizzes, and journals." },
        { label: "Attendance", value: "94%", hint: "Weekly attendance trends and missed-class alerts." },
        { label: "Quiz average", value: "87%", hint: "Pre- and post-lesson performance view." },
        { label: "Practice log", value: "42 min", hint: "Recent journal and reflection activity." },
      ]}
      navItems={[
        { label: "Dashboard", href: "/student", badge: "Live" },
        { label: "Courses", href: "/student#courses" },
        { label: "Quizzes", href: "/student#quizzes" },
        { label: "Journal", href: "/student#journal" },
        { label: "Schedule", href: "/student#schedule" },
        { label: "Progress", href: "/student#progress" },
      ]}
      panels={[
        {
          eyebrow: "Course flow",
          title: "Lessons, quizzes, and journals in one place",
          description: "The student workspace will become the active learning area for class links, assessments, practice journals, and score history.",
          bullets: [
            "Upcoming classes with meeting links and class countdowns",
            "Quiz attempts, feedback, and grade breakdown by programme",
            "Weekly journal submission with self-rating and practice minutes",
          ],
        },
        {
          eyebrow: "Motivation",
          title: "Progress story over time",
          description: "This section will turn reports, strengths, and next-step guidance into a child-friendly progress experience.",
          bullets: [
            "Programme-by-programme progress cards with teacher notes",
            "Attendance, quiz, and journal streaks",
            "Profile and achievement milestones",
          ],
        },
      ]}
      primaryCta={{ label: "Go to registration", href: "/registration" }}
      secondaryCta={{ label: "Open login", href: "/auth/login" }}
    />
  );
}
