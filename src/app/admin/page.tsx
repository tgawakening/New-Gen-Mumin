import { DashboardShell } from "@/components/dashboard/DashboardShell";

const ADMIN_ITEMS = [
  "Analytics, reports, and revenue overview",
  "Student, teacher, program, and enrollment management",
  "Payment review, scholarship workflow, and communication inbox",
] as const;

export default function AdminDashboardPage() {
  return (
    <DashboardShell
      role="Admin"
      title="Admin Dashboard"
      subtitle="Central operations hub for enrollments, payments, schedules, scholarship approvals, and platform-wide reporting."
      items={ADMIN_ITEMS}
    />
  );
}
