"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { FamilyNavLinkClient } from "@/components/dashboard/family/FamilyNavLinkClient";
import type { FamilyNavIcon } from "@/lib/dashboard/family-nav";

type NavItem = {
  label: string;
  href: string;
  icon?: FamilyNavIcon;
};

export function MobileFamilyNavRailClient({ navItems }: { navItems: NavItem[] }) {
  const railRef = useRef<HTMLElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const rail = railRef.current;
    if (!rail) return;
    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    setCanScrollLeft(rail.scrollLeft > 4);
    setCanScrollRight(rail.scrollLeft < maxScrollLeft - 4);
  }

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    updateScrollState();
    rail.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      rail.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [navItems.length]);

  function scrollByTabs(direction: -1 | 1) {
    railRef.current?.scrollBy({ left: direction * 260, behavior: "smooth" });
  }

  return (
    <div className="relative mt-5 xl:hidden">
      {canScrollLeft ? (
        <button
          type="button"
          aria-label="Previous dashboard tabs"
          onClick={() => scrollByTabs(-1)}
          className="absolute left-1 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#d8e3ed] bg-white text-[#22304a] shadow-md"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      ) : null}
      {canScrollRight ? (
        <button
          type="button"
          aria-label="Next dashboard tabs"
          onClick={() => scrollByTabs(1)}
          className="absolute right-1 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#d8e3ed] bg-white text-[#22304a] shadow-md"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : null}
      <nav
        ref={railRef}
        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Dashboard sections"
      >
        {navItems.map((item) => (
          <FamilyNavLinkClient
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
