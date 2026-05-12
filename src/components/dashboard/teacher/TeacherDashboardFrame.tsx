import Link from "next/link";
import { ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  NotebookPen,
  PenTool,
  PieChart,
  UserRound,
  Video,
} from "lucide-react";
import { FamilyLogoutButton } from "@/components/dashboard/family/FamilyLogoutButton";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

type NavItem = {
  label: string;
  href: string;
  icon?: string;
};

function getTeacherNavIcon(icon?: string) {
  switch (icon) {
    case "classes":
      return GraduationCap;
    case "video":
      return Video;
    case "check":
      return CheckCircle2;
    case "builder":
      return PenTool;
    case "folder":
      return FolderOpen;
    case "quiz":
      return ClipboardList;
    case "lesson":
      return BookOpen;
    case "journal":
      return NotebookPen;
    case "reports":
      return PieChart;
    case "calendar":
      return CalendarDays;
    case "profile":
      return UserRound;
    case "home":
      return LayoutDashboard;
    default:
      return FileText;
  }
}

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
  const navLinks = navItems.map((item) => {
    const Icon = getTeacherNavIcon(item.icon);
    return { ...item, Icon };
  });

  return (
    <div className="min-h-screen bg-[#f7f2ea]">
      <div className="border-b border-[#e8dccf] bg-[linear-gradient(180deg,#fff7ee_0%,#fffdf9_100%)]">
        <div className="section-container py-5 sm:py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
                Teacher Dashboard
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-[#22304a] sm:text-4xl">{title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f6b7a] sm:text-base sm:leading-8">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="rounded-full border border-[#e1d4c2] bg-white px-4 py-2 text-sm font-semibold text-[#4f5d71] transition hover:bg-[#fbf1e5]"
              >
                Main site
              </Link>
              <NotificationBell />
              <FamilyLogoutButton />
            </div>
          </div>
        </div>
      </div>

      <div className="section-container grid grid-cols-[64px_minmax(0,1fr)] gap-3 py-5 sm:gap-5 sm:py-6 xl:grid-cols-[250px_minmax(0,1fr)] xl:gap-6 xl:py-8">
        <aside className="sticky top-3 self-start xl:static">
          <div className="rounded-[22px] bg-[#22304a] p-2 text-white shadow-[0_20px_50px_rgba(34,48,74,0.18)] xl:rounded-[28px] xl:p-6">
            <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-[#f2c58f] xl:block">
              Teaching suite
            </p>
            <div className="space-y-2 xl:mt-5">
              {navLinks.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className="group/nav relative flex items-center justify-center gap-3 rounded-2xl bg-white/8 px-2 py-3 text-sm font-medium text-white/90 transition hover:bg-white/12 xl:justify-start xl:px-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-[#ffd79b]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="hidden xl:inline">{label}</span>
                  <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-40 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-[#22304a] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover/nav:block group-hover/nav:opacity-100 xl:hidden">
                    {label}
                  </span>
                </Link>
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
