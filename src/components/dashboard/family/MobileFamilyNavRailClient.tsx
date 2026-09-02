"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, LayoutGrid } from "lucide-react";

import { FamilyNavLinkClient } from "@/components/dashboard/family/FamilyNavLinkClient";
import type { FamilyNavIcon } from "@/lib/dashboard/family-nav";

type NavItem = { label: string; href: string; icon?: FamilyNavIcon };

const PRIMARY_LABELS = new Set(["Dashboard", "Live Sessions", "Attendance", "House & Rewards", "Progress"]);

export function MobileFamilyNavRailClient({ navItems }: { navItems: NavItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const primary = navItems.filter((item) => PRIMARY_LABELS.has(item.label));
  const more = navItems.filter((item) => !PRIMARY_LABELS.has(item.label));

  return (
    <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.06] p-3">
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f2c58f]">Quick navigation</p><p className="mt-1 text-xs text-white/65">Your most-used sections are always visible.</p></div>
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
          <LayoutGrid className="h-4 w-4" /> {expanded ? "Show less" : "All sections"} {expanded ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
        </button>
      </div>
      <nav className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" aria-label="Main dashboard sections">
        {primary.map((item) => <FamilyNavLinkClient key={item.href} href={item.href} label={item.label} icon={item.icon} variant="mobileTab"/>)}
      </nav>
      {expanded ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="mb-2 px-1 text-xs font-semibold text-white/70">Everything else</p>
          <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="All dashboard sections">
            {more.map((item) => <FamilyNavLinkClient key={item.href} href={item.href} label={item.label} icon={item.icon} variant="mobileTab"/>)}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
