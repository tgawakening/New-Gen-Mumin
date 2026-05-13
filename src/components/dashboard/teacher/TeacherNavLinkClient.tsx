"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

function TeacherNavIcon({ icon }: { icon?: string }) {
  switch (icon) {
    case "classes":
      return <GraduationCap className="h-4 w-4" />;
    case "video":
      return <Video className="h-4 w-4" />;
    case "check":
      return <CheckCircle2 className="h-4 w-4" />;
    case "builder":
      return <PenTool className="h-4 w-4" />;
    case "folder":
      return <FolderOpen className="h-4 w-4" />;
    case "quiz":
      return <ClipboardList className="h-4 w-4" />;
    case "lesson":
      return <BookOpen className="h-4 w-4" />;
    case "journal":
      return <NotebookPen className="h-4 w-4" />;
    case "reports":
      return <PieChart className="h-4 w-4" />;
    case "calendar":
      return <CalendarDays className="h-4 w-4" />;
    case "profile":
      return <UserRound className="h-4 w-4" />;
    case "home":
      return <LayoutDashboard className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

export function TeacherNavLinkClient({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon?: string;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/teacher" && pathname.startsWith(`${href}/`));

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
        <TeacherNavIcon icon={icon} />
      </span>
      <span className="hidden xl:inline">{label}</span>
      <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-40 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-[#22304a] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover/nav:block group-hover/nav:opacity-100 xl:hidden">
        {label}
      </span>
    </Link>
  );
}
