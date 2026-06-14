import Link from "next/link";
import { ReactNode } from "react";
import { FamilyLogoutButton } from "@/components/dashboard/family/FamilyLogoutButton";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { TeacherNavLinkClient } from "@/components/dashboard/teacher/TeacherNavLinkClient";

type NavItem = {
  label: string;
  href: string;
  icon?: string;
};

export function TeacherDashboardFrame({
  title,
  subtitle,
  navItems,
  children,
}: {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f2ea]">
      <div className="border-b border-[#1c2b45] bg-[linear-gradient(135deg,#14243d_0%,#22304a_55%,#36536f_100%)] text-white shadow-[0_18px_50px_rgba(20,36,61,0.22)]">
        <div className="section-container py-5 sm:py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#f2c58f]">
                Teacher Dashboard
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#d8e2ee] sm:text-base sm:leading-8">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/18"
              >
                Main site
              </Link>
              <NotificationBell />
              <FamilyLogoutButton />
            </div>
          </div>
        </div>
      </div>

      <div className="section-container grid grid-cols-[64px_minmax(0,1fr)] gap-3 py-5 sm:gap-5 sm:py-6 xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-5 xl:py-8">
        <aside className="sticky top-3 self-start">
          <div className="max-h-[calc(100vh-1.5rem)] overflow-visible rounded-[22px] bg-[#22304a] p-2 text-white shadow-[0_20px_50px_rgba(34,48,74,0.18)] xl:overflow-y-auto xl:rounded-[24px] xl:p-4">
            <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-[#f2c58f] xl:block">
              Teaching suite
            </p>
            <div className="space-y-2 xl:mt-4">
              {navItems.map((item) => (
                <TeacherNavLinkClient
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                />
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-5 sm:space-y-6">{children}</div>
      </div>
    </div>
  );
}

export function TeacherMetricGrid({
  metrics,
}: {
  metrics: Array<{ label: string; value: string; hint: string }>;
}) {
  return (
    <section className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-[18px] border border-[#eadfce] bg-white p-3 shadow-sm sm:rounded-[24px] sm:p-5">
          <p className="text-xs text-[#6d7785] sm:text-sm">{metric.label}</p>
          <p className="mt-1 text-xl font-semibold text-[#22304a] sm:mt-2 sm:text-3xl">{metric.value}</p>
          <p className="mt-2 hidden text-sm leading-6 text-[#8a94a3] sm:block">{metric.hint}</p>
        </div>
      ))}
    </section>
  );
}

export function TeacherSection({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function TeacherInfoList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (!items.length) {
    return <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function formatWeekday(weekday: number) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday] ?? "Class day";
}

export function formatGrade(value: string | null) {
  return value ? value.replace(/_/g, " ") : "Pending";
}

export function formatDate(value: Date | null) {
  if (!value) {
    return "Not scheduled yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}
