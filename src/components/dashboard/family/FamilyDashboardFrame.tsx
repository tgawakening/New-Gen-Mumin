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
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { TopBar } from "@/components/TopBar";
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
      return BookOpen;
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
  const hideSiteHeader = roleLabel === "Student Dashboard";

  return (
    <div className="min-h-screen bg-[#f7f2ea]">
      {!hideSiteHeader ? (
        <>
          <TopBar />
          <Header />
        </>
      ) : null}

      <div className="relative overflow-hidden border-b border-[#e8dccf] bg-[linear-gradient(180deg,#fff7ee_0%,#fffdf9_100%)]">
        <div className="pointer-events-none absolute left-[-40px] top-8 h-36 w-36 rounded-full bg-[#ffd7a8]/40 blur-3xl" />
        <div className="pointer-events-none absolute right-12 top-10 h-28 w-28 rounded-full bg-[#b9d8f7]/35 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#f5b5d1]/25 blur-2xl" />
        <div className="section-container py-5 sm:py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
                {roleLabel}
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-[#22304a] sm:text-4xl">{title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f6b7a] sm:text-base sm:leading-8">{subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {!hideSiteHeader ? (
                <Link
                  href="/"
                  className="cursor-pointer rounded-full border border-[#e1d4c2] bg-white px-4 py-2 text-sm font-semibold text-[#4f5d71] transition hover:bg-[#fbf1e5]"
                >
                  Main site
                </Link>
              ) : null}
              <NotificationBell />
              <FamilyLogoutButton />
            </div>
          </div>
        </div>
      </div>

      <div className="section-container grid grid-cols-[64px_minmax(0,1fr)] gap-3 py-5 sm:gap-5 sm:py-6 xl:grid-cols-[250px_minmax(0,1fr)] xl:gap-6 xl:py-8">
        <aside className="sticky top-3 self-start xl:static">
          <div className="relative overflow-visible rounded-[22px] bg-[#22304a] p-2 text-white shadow-[0_20px_50px_rgba(34,48,74,0.18)] xl:overflow-hidden xl:rounded-[28px] xl:p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute bottom-6 right-6 h-12 w-12 rounded-full bg-[#f39f5f]/20 blur-xl" />
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

      {!hideSiteHeader ? <Footer /> : null}
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
            <div key={metric.label} className="relative overflow-hidden rounded-[18px] border border-[#eadfce] bg-white p-3 shadow-sm sm:rounded-[24px] sm:p-5">
              <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-full bg-[#fff3df]" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-[#6d7785] sm:text-sm">{metric.label}</p>
                  <p className="mt-1 text-xl font-semibold text-[#22304a] sm:mt-2 sm:text-3xl">{metric.value}</p>
                  <p className="mt-2 hidden text-sm leading-6 text-[#8a94a3] sm:block">{metric.hint}</p>
                </div>
                <span className="relative z-10 hidden h-11 w-11 items-center justify-center rounded-2xl bg-[#fff0db] text-[#d7892f] sm:flex">
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
    <section className="relative overflow-hidden rounded-[22px] border border-[#eadfce] bg-white p-4 shadow-sm sm:rounded-[30px] sm:p-6">
      <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full bg-[#fff4e4]" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-4">
          <span className="relative z-10 mt-1 hidden h-11 w-11 items-center justify-center rounded-2xl bg-[#fff0db] text-[#d7892f] shadow-sm sm:flex">
            <VisualIcon icon={icon} />
          </span>
          <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c27a2c]">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-semibold text-[#22304a] sm:text-2xl">{title}</h2>
          </div>
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
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
        <li key={item} className="flex items-start gap-3 rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#4d5a6b]">
          <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[#d7892f] shadow-sm">
            <Star className="h-3 w-3" />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function ChildSelector({
  children,
  selectedChildId,
  basePath,
}: {
  children: Array<{ id: string; name: string }>;
  selectedChildId?: string;
  basePath: string;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {children.map((child) => {
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
