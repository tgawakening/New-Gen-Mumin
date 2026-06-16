"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { TeacherNavLinkClient } from "@/components/dashboard/teacher/TeacherNavLinkClient";

type NavItem = {
  label: string;
  href: string;
  icon?: string;
};

export function MobileTeacherNavRailClient({ navItems }: { navItems: NavItem[] }) {
  const railRef = useRef<HTMLElement | null>(null);

  function scrollByTabs(direction: -1 | 1) {
    railRef.current?.scrollBy({ left: direction * 260, behavior: "smooth" });
  }

  return (
    <div className="relative mt-5 xl:hidden">
      <button
        type="button"
        aria-label="Previous teacher dashboard tabs"
        onClick={() => scrollByTabs(-1)}
        className="absolute left-0 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white text-[#22304a] shadow-lg"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Next teacher dashboard tabs"
        onClick={() => scrollByTabs(1)}
        className="absolute right-0 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white text-[#22304a] shadow-lg"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-[#14243d] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#22304a] to-transparent" />
      <nav
        ref={railRef}
        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-12 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Teaching suite sections"
      >
        {navItems.map((item) => (
          <TeacherNavLinkClient
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            variant="mobileTab"
          />
        ))}
      </nav>
    </div>
  );
}
