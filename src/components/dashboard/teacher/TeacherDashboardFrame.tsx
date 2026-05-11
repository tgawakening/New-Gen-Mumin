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
  return (
    <div className="min-h-screen bg-[#f7f2ea]">
      <div className="border-b border-[#e8dccf] bg-[linear-gradient(180deg,#fff7ee_0%,#fffdf9_100%)]">
        <div className="section-container py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
                Teacher Dashboard
              </p>
              <h1 className="mt-3 text-4xl font-semibold text-[#22304a]">{title}</h1>
              <p className="mt-3 max-w-3xl text-base leading-8 text-[#5f6b7a]">{subtitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="rounded-full border border-[#e1d4c2] bg-white px-4 py-2 text-sm font-semibold text-[#4f5d71] transition hover:bg-[#fbf1e5]"
              >
                Main site
              </Link>
              <NotificationBell />
            </div>
          </div>
        </div>
      </div>

      <div className="section-container grid gap-6 py-8 xl:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div className="rounded-[28px] bg-[#22304a] p-6 text-white shadow-[0_20px_50px_rgba(34,48,74,0.18)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2c58f]">
              Teaching suite
            </p>
            <div className="mt-5 space-y-2">
              {navItems.map((item) => (
                (() => {
                  const Icon = getTeacherNavIcon(item.icon);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className="flex items-center gap-3 rounded-2xl bg-white/8 px-4 py-3 text-sm font-medium text-white/90 transition hover:bg-white/12"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-[#ffd79b]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })()
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-6">{children}</div>
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
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="rounded-[24px] border border-[#eadfce] bg-white p-5 shadow-sm">
          <p className="text-sm text-[#6d7785]">{metric.label}</p>
          <p className="mt-2 text-3xl font-semibold text-[#22304a]">{metric.value}</p>
          <p className="mt-2 text-sm leading-6 text-[#8a94a3]">{metric.hint}</p>
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
