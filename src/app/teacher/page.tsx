import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function TeacherDashboardPage() {
  return (
    <DashboardShell
      role="Teacher"
      title="Teacher Dashboard"
      subtitle="Teaching workspace for running live classes, tracking attendance, grading assessments, and supporting student progress."
      accentLabel="Teaching suite"
      metrics={[
        { label: "Assigned classes", value: "6", hint: "Roster and programme-based teaching load." },
        { label: "Upcoming lessons", value: "3", hint: "Next classes, meeting rooms, and planner items." },
        { label: "Quizzes to grade", value: "8", hint: "Pending review and manual-marking queue." },
        { label: "Journal reviews", value: "12", hint: "Practice logs and reflection feedback waiting." },
      ]}
      navItems={[
        { label: "Dashboard", href: "/teacher", badge: "Live" },
        { label: "Classes", href: "/teacher#classes" },
        { label: "Attendance", href: "/teacher#attendance" },
        { label: "Course Builder", href: "/teacher#course-builder", badge: "Start" },
        { label: "Quizzes", href: "/teacher#quizzes" },
        { label: "Reports", href: "/teacher#reports" },
      ]}
      panels={[
        {
          eyebrow: "Teaching flow",
          title: "Classroom operations panel",
          description: "The teacher workspace will handle schedules, attendance, lesson logs, grading, and feedback in one consistent interface.",
          bullets: [
            "Assigned classes, student roster, and upcoming meeting links",
            "Attendance marking with history and late/excused options",
            "Quiz, journal, and assignment review queues",
          ],
        },
        {
          eyebrow: "Course builder",
          title: "Lesson content upload foundation",
          description: "This is where we will grow the teacher content builder so lessons, worksheets, slides, and learning notes can be uploaded by programme.",
          bullets: [
            "Create lesson modules by programme and week",
            "Attach video links, PDFs, worksheets, and homework guidance",
            "Publish content to student course view with teacher notes",
          ],
        },
      ]}
      primaryCta={{ label: "Open login", href: "/auth/login" }}
      secondaryCta={{ label: "View registration", href: "/registration" }}
    />
  );
}
