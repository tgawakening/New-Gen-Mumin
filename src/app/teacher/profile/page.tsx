import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { TeacherDashboardFrame, TeacherMetricGrid, TeacherSection, TeacherInfoList } from "@/components/dashboard/teacher/TeacherDashboardFrame";

export default async function TeacherProfilePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  return (
    <TeacherDashboardFrame
      title="Profile"
      subtitle="Review teacher identity, contact details, specialties, and teaching profile setup."
      navItems={getTeacherNavItems()}
    >
      <TeacherMetricGrid
        metrics={[
          { label: "Email", value: dashboard.profile.email, hint: "Primary teacher login email." },
          { label: "Phone", value: dashboard.profile.phone ?? "Pending", hint: "Teacher contact number." },
          { label: "Timezone", value: dashboard.profile.timezone ?? "Europe/London", hint: "Default teaching timezone." },
          { label: "Specialties", value: String(dashboard.profile.specialties.length), hint: "Declared teaching focus areas." },
        ]}
      />

      <TeacherSection eyebrow="Teacher identity" title="Profile details">
        <TeacherInfoList
          items={[
            `Name • ${dashboard.teacherName}`,
            `Email • ${dashboard.profile.email}`,
            `Phone • ${dashboard.profile.phone ?? "Pending"}`,
            `Timezone • ${dashboard.profile.timezone ?? "Europe/London"}`,
            `Specialties • ${dashboard.profile.specialties.length ? dashboard.profile.specialties.join(", ") : "Pending"}`,
            `Bio • ${dashboard.profile.bio ?? "Pending"}`,
          ]}
          emptyLabel="Teacher profile details will appear here."
        />
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
