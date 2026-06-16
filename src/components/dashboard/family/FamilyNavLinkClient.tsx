"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChartColumn,
  PenSquare,
  CircleUserRound,
  Sparkles,
  SunMedium,
  Home,
  Video,
} from "lucide-react";

type FamilyNavIcon =
  | "home"
  | "book"
  | "check"
  | "calendar"
  | "video"
  | "sparkles"
  | "chart"
  | "journal"
  | "profile"
  | "pen"
  | "sun";

function resolveIcon(icon?: FamilyNavIcon) {
  switch (icon) {
    case "book":
      return BookOpen;
    case "check":
      return CheckCircle2;
    case "calendar":
      return CalendarDays;
    case "video":
      return Video;
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

export function FamilyNavLinkClient({
  href,
  label,
  icon,
  variant = "sidebar",
}: {
  href: string;
  label: string;
  icon?: FamilyNavIcon;
  variant?: "sidebar" | "mobileTab";
}) {
  const pathname = usePathname();
  const hrefPath = href.split("?")[0];
  const isActive = pathname === hrefPath || (hrefPath !== "/parent" && hrefPath !== "/student" && pathname.startsWith(`${hrefPath}/`));
  const IconComp = resolveIcon(icon);

  if (variant === "mobileTab") {
    return (
      <Link
        href={href}
        title={label}
        aria-current={isActive ? "page" : undefined}
        className={`flex min-w-[9rem] snap-start items-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold shadow-sm transition ${
          isActive
            ? "bg-white text-[#22304a] ring-1 ring-white/40"
            : "bg-white/10 text-white/90 hover:bg-white/16"
        }`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${isActive ? "bg-[#fff0db] text-[#c27a2c]" : "bg-white/12 text-[#ffd79b]"}`}>
          <IconComp className="h-4 w-4" />
        </span>
        <span className="whitespace-nowrap">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      title={label}
      aria-current={isActive ? "page" : undefined}
      className={`group/nav relative flex items-center justify-center gap-3 rounded-2xl px-2 py-3 text-sm font-medium transition xl:justify-start xl:px-4 ${
        isActive
          ? "bg-white text-[#22304a] shadow-[0_10px_30px_rgba(0,0,0,0.18)] ring-1 ring-white/40"
          : "bg-white/8 text-white/90 hover:bg-white/12"
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${isActive ? "bg-[#fff0db] text-[#c27a2c]" : "bg-white/12 text-[#ffd79b]"}`}>
        <IconComp className="h-4 w-4" />
      </span>
      <span className="hidden xl:inline">{label}</span>
      <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-40 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-[#22304a] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover/nav:block group-hover/nav:opacity-100 xl:hidden">
        {label}
      </span>
    </Link>
  );
}
