export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminLoginModal } from "@/components/admin/AdminLoginModal";
import { TeacherDashboardFrame, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { TeacherHomeDashboard } from "@/components/dashboard/teacher/TeacherHomeDashboard";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";

type PageProps = {
  searchParams?: Promise<{ teacher?: string }>;
};

function adminTeacherNav(teacherId: string) {
  return [
    { label: "Admin Home", href: "/admin", icon: "home" },
    { label: "Dashboard", href: `/admin/teachers?teacher=${teacherId}`, icon: "home" },
    { label: "Roster", href: `/admin/teachers/${teacherId}/roster`, icon: "check" },
    { label: "Live Sessions", href: "/admin/classes", icon: "video" },
    { label: "Classes", href: "/admin/classes", icon: "classes" },
    { label: "Hours Log", href: `/admin/hours-log?teacherId=${teacherId}`, icon: "reports" },
    { label: "Recordings", href: `/admin/recordings?teacher=${teacherId}`, icon: "video" },
    { label: "Materials", href: "/admin/materials", icon: "folder" },
    { label: "Feedback", href: "/admin/feedback", icon: "journal" },
  ];
}

function teacherName(teacher: {
  id: string;
  user: { firstName: string; lastName: string | null; email: string };
}) {
  return `${teacher.user.firstName} ${teacher.user.lastName ?? ""}`.trim() || teacher.user.email;
}

export default async function AdminTeacherDashboardsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();

  if (!session || session.user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-[#f3f5f7] py-16">
        <div className="section-container">
          <div className="rounded-[32px] border border-[#e1d8cb] bg-white px-8 py-10 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Gen-Mumins Admin</p>
            <h1 className="mt-3 text-4xl font-semibold text-[#22304a]">Teacher dashboards</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-[#5f6b7a]">
              Sign in as admin to preview teacher workspaces.
            </p>
          </div>
        </div>
        <AdminLoginModal />
      </div>
    );
  }

  const teachers = await db.teacherProfile.findMany({
    where: { isActive: true },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  if (!teachers.length) {
    return (
      <TeacherDashboardFrame
        title="Teacher dashboards"
        subtitle="No active teachers are available yet."
        navItems={[{ label: "Admin Home", href: "/admin" }]}
      >
        <TeacherSection eyebrow="Admin preview" title="No teachers found">
          <p className="text-sm leading-7 text-[#5f6b7a]">Create teacher accounts to preview their dashboards here.</p>
        </TeacherSection>
      </TeacherDashboardFrame>
    );
  }

  const params = searchParams ? await searchParams : {};
  const selectedTeacher = teachers.find((teacher) => teacher.id === params.teacher) ?? teachers[0];
  const dashboard = await getTeacherDashboardData(selectedTeacher.userId);
  if (!dashboard) redirect("/admin");

  return (
    <TeacherDashboardFrame
      title={dashboard.teacherName}
      subtitle="Admin preview of the selected teacher dashboard. Use the profile switcher to monitor each teacher without separate logins."
      navItems={adminTeacherNav(selectedTeacher.id)}
    >
      <TeacherSection eyebrow="Admin profile switcher" title="View teacher dashboard">
        <div className="flex flex-wrap gap-2">
          {teachers.map((teacher) => {
            const active = teacher.id === selectedTeacher.id;
            return (
              <Link
                key={teacher.id}
                href={`/admin/teachers?teacher=${teacher.id}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  active
                    ? "bg-[#0f4d81] text-white"
                    : "border border-[#c9d7e6] bg-white text-[#22304a] hover:bg-[#f5f8fb]"
                }`}
              >
                {teacherName(teacher)}
              </Link>
            );
          })}
        </div>
      </TeacherSection>

      <TeacherHomeDashboard dashboard={dashboard} adminPreview />
    </TeacherDashboardFrame>
  );
}
