import { DashboardShell } from "@/components/dashboard/DashboardShell";

const PARENT_ITEMS = [
  "Multi-child dashboard with attendance and class schedule",
  "Enrollments, renewals, subscriptions, and payment history",
  "Progress reports, journals, and teacher communication",
] as const;

export default function ParentDashboardPage() {
  return (
    <DashboardShell
      role="Parent"
      title="Parent Dashboard"
      subtitle="Family-facing portal for enrollment management, payment renewals, child progress tracking, and class visibility."
      items={PARENT_ITEMS}
    />
  );
}
