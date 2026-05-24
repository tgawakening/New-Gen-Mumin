"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

export function FamilyNavLinkClient({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  const hrefPath = href.split("?")[0];
  const isActive = pathname === hrefPath || (hrefPath !== "/parent" && hrefPath !== "/student" && pathname.startsWith(`${hrefPath}/`));

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
        <Icon className="h-4 w-4" />
      </span>
      <span className="hidden xl:inline">{label}</span>
      <span className="pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-40 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-[#22304a] px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-xl transition group-hover/nav:block group-hover/nav:opacity-100 xl:hidden">
        {label}
      </span>
    </Link>
  );
}
