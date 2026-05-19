import Link from "next/link";
import { ReactNode } from "react";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChartColumn,
  CircleUserRound,
  Gift,
  Home,
  PenSquare,
  Sparkles,
  Star,
  SunMedium,
  Trophy,
} from "lucide-react";
import { BatchCommunityButton } from "@/components/dashboard/family/BatchCommunityButton";
import { FamilyLogoutButton } from "@/components/dashboard/family/FamilyLogoutButton";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import type { FamilyNavIcon } from "@/lib/dashboard/family-nav";

type NavItem = {
  label: string;
  href: string;
  icon?: FamilyNavIcon;
};

function getNavIcon(icon?: FamilyNavIcon) {
  switch (icon) {
    case "book":
      return BookOpen;
    case "check":
      return CheckCircle2;
    case "calendar":
      return CalendarDays;
    case "sparkles":
      return Sparkles;
    case "chart":
      return ChartColumn;
    case "journal":
      return PenSquare;
    case "profile":
      return CircleUserRound;
    case "pen":
      return PenSquare;
    case "sun":
      return SunMedium;
    case "home":
    default:
      return Home;
  }
}

function getMetricIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("child")) return Star;
  if (normalized.includes("course")) return BookOpen;
  if (normalized.includes("attendance")) return CheckCircle2;
  if (normalized.includes("quiz")) return Sparkles;
  if (normalized.includes("assignment")) return PenSquare;
  if (normalized.includes("access")) return SunMedium;
  if (normalized.includes("order")) return CalendarDays;
  if (normalized.includes("selected")) return CircleUserRound;
  if (normalized.includes("journal")) return PenSquare;
  return Home;
}

type DashboardVisualIcon =
  | "book"
  | "calendar"
  | "check"
  | "chart"
  | "profile"
  | "sparkles"
  | "star"
  | "sun"
  | "pen"
  | "gift"
  | "trophy"
  | "home";

function VisualIcon({ icon }: { icon?: DashboardVisualIcon }) {
  switch (icon) {
    case "book":
      return <BookOpen className="h-5 w-5" />;
    case "calendar":
      return <CalendarDays className="h-5 w-5" />;
    case "check":
      return <CheckCircle2 className="h-5 w-5" />;
    case "chart":
      return <ChartColumn className="h-5 w-5" />;
    case "profile":
      return <CircleUserRound className="h-5 w-5" />;
    case "sparkles":
      return <Sparkles className="h-5 w-5" />;
    case "star":
      return <Star className="h-5 w-5" />;
    case "sun":
      return <SunMedium className="h-5 w-5" />;
    case "pen":
      return <PenSquare className="h-5 w-5" />;
    case "gift":
      return <Gift className="h-5 w-5" />;
    case "trophy":
      return <Trophy className="h-5 w-5" />;
    case "home":
    default:
      return <Home className="h-5 w-5" />;
  }
}

export function FamilyDashboardFrame({
  roleLabel,
  title,
  subtitle,
  navItems,
  children,
  pendingReason,
}: {
  roleLabel: string;
  title: string;
  subtitle: string;
  navItems: NavItem[];
  children: ReactNode;
  pendingReason?: string | null;
}) {
  return (
    <div className="min-h-screen bg-[#f7f2ea]">
      <div className="border-b border-[#2e3d57] bg-[#17243a] text-white shadow-[0_14px_40px_rgba(23,36,58,0.18)]">
        <div className="section-container py-5 sm:py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#f2c58f]">
                {roleLabel}
              </p>
              <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/72">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="cursor-pointer rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15"
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
          <div className="relative overflow-visible rounded-[22px] bg-[#22304a] p-2 text-white shadow-[0_20px_50px_rgba(34,48,74,0.18)] xl:overflow-hidden xl:rounded-[28px] xl:p-6">
            <p className="hidden text-xs font-semibold uppercase tracking-[0.2em] text-[#f2c58f] xl:block">
              Dashboard map
            </p>
            <div className="space-y-2 xl:mt-5">
              {navItems.map((item) => (
                (() => {
                  const Icon = getNavIcon(item.icon);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      className="group/nav relative flex items-center justify-center gap-3 rounded-2xl bg-white/8 px-2 py-3 text-sm font-medium text-white/90 transition hover:bg-white/12 xl:justify-start xl:px-4"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-[#ffd79b]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="hidden xl:inline">{item.label}</span>
                      <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-40 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-[#22304a] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover/nav:block group-hover/nav:opacity-100 xl:hidden">
                        {item.label}
                      </span>
                    </Link>
                  );
                })()
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-5 sm:space-y-6">
          {pendingReason ? <PendingAccessNotice message={pendingReason} /> : null}
          {children}
        </div>
      </div>

      <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
        <BatchCommunityButton />
      </div>
    </div>
  );
}

export function PendingAccessNotice({ message }: { message: string }) {
  return (
    <section className="rounded-[26px] border border-[#f0d6b4] bg-[#fff7eb] px-6 py-5">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff1d9] text-[#d7892f]">
          <SunMedium className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b56d1f]">
            Access pending
          </p>
          <p className="mt-2 text-sm leading-7 text-[#6a5b49]">{message}</p>
        </div>
      </div>
    </section>
  );
}

export function MetricGrid({
  metrics,
}: {
  metrics: Array<{ label: string; value: string; hint: string }>;
}) {
  return (
    <section className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      {metrics.map((metric) => (
        (() => {
          const Icon = getMetricIcon(metric.label);
          return (
            <div key={metric.label} className="rounded-[18px] border border-[#eadfce] bg-white p-3 shadow-sm sm:rounded-[22px] sm:p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-[#6d7785] sm:text-sm">{metric.label}</p>
                  <p className="mt-1 truncate text-lg font-semibold text-[#22304a] sm:text-2xl">{metric.value}</p>
                  <p className="mt-1 hidden text-xs leading-5 text-[#8a94a3] sm:line-clamp-1">{metric.hint}</p>
                </div>
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff0db] text-[#d7892f] sm:flex">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          );
        })()
      ))}
    </section>
  );
}

export function SectionCard({
  eyebrow,
  title,
  children,
  action,
  icon = "home",
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  icon?: DashboardVisualIcon;
}) {
  return (
    <section className="min-w-0 rounded-[22px] border border-[#eadfce] bg-white p-4 shadow-sm sm:rounded-[26px] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-4">
          <span className="mt-1 hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff0db] text-[#d7892f] shadow-sm sm:flex">
            <VisualIcon icon={icon} />
          </span>
          <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">{eyebrow}</p>
          <h2 className="mt-1.5 text-lg font-semibold text-[#22304a] sm:text-xl">{title}</h2>
          </div>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function CompactList({
  items,
  emptyLabel,
}: {
  items: Array<{ label: string; meta?: string; icon?: DashboardVisualIcon }>;
  emptyLabel: string;
}) {
  if (!items.length) {
    return <p className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm leading-6 text-[#6b7482]">{emptyLabel}</p>;
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={`${item.label}-${item.meta ?? ""}`} className="flex min-w-0 items-center gap-3 rounded-2xl bg-[#fbf6ef] px-3 py-2.5 text-sm text-[#4d5a6b]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#d7892f]">
            <VisualIcon icon={item.icon ?? "check"} />
          </span>
          <div className="min-w-0">
            <p className="break-words font-semibold leading-5 text-[#22304a]">{item.label}</p>
            {item.meta ? <p className="truncate text-xs text-[#6d7785]">{item.meta}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InfoList({
  items,
  emptyLabel,
}: {
  items: string[];
  emptyLabel: string;
}) {
  if (!items.length) {
    return <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex min-w-0 items-start gap-3 rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
          <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[#d7892f] shadow-sm">
            <Star className="h-3 w-3" />
          </span>
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ChildSelector({
  learners,
  selectedChildId,
  basePath,
}: {
  learners: Array<{ id: string; name: string }>;
  selectedChildId?: string;
  basePath: string;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {learners.map((child) => {
        const active = child.id === selectedChildId;
        return (
          <Link
            key={child.id}
            href={`${basePath}?child=${child.id}`}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-[#22304a] text-white"
                : "border border-[#e1d4c2] bg-[#fff9f2] text-[#4f5d71] hover:bg-[#fbf1e5]"
            }`}
          >
            <span className={`flex h-7 w-7 items-center justify-center rounded-full ${active ? "bg-white/14 text-[#ffd79b]" : "bg-[#fff0db] text-[#d7892f]"}`}>
              <Star className="h-3.5 w-3.5" />
            </span>
            {child.name}
          </Link>
        );
      })}
    </div>
  );
}

export function formatWeekday(weekday: number) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday] ?? "Class day";
}

export function formatGrade(value: string | null) {
  return value ? value.replace(/_/g, " ") : "Pending";
}

export function formatSubmissionStatus(value: string) {
  return value.replace(/_/g, " ");
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
