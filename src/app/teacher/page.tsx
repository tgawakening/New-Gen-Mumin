import { DashboardShell } from "@/components/dashboard/DashboardShell";

const TEACHER_ITEMS = [
  "Class schedule, roster, and meeting links",
  "Attendance, quizzes, lesson logs, and journal review",
  "Performance snapshots and grading workflows",
] as const;

export default function TeacherDashboardPage() {
  return (
    <DashboardShell
      role="Teacher"
      title="Teacher Dashboard"
      subtitle="Teaching workspace for running live classes, tracking attendance, grading assessments, and supporting student progress."
      items={TEACHER_ITEMS}
    />
  );
}
