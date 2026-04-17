import { DashboardShell } from "@/components/dashboard/DashboardShell";

const STUDENT_ITEMS = [
  "Course view, weekly schedule, and class links",
  "Quizzes, journal submissions, and assignment activity",
  "Progress reports, scores, and attendance rate",
] as const;

export default function StudentDashboardPage() {
  return (
    <DashboardShell
      role="Student"
      title="Student Dashboard"
      subtitle="A focused learning area for classes, quizzes, journals, attendance history, and progress milestones."
      items={STUDENT_ITEMS}
    />
  );
}
