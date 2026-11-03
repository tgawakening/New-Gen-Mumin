"use client";
import { useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { monthLabel, pounds } from "@/lib/payroll/calculation";
import { PayslipCard } from "./PayslipCard";
import { PayrollHistory, type PublishedSlip } from "./PayrollHistory";
const eventName = "genm-payroll-preference";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback); window.addEventListener(eventName, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(eventName, callback); };
}
export function PayrollOverview({ userId, slips, initiallyOpen }: { userId: string; slips: PublishedSlip[]; initiallyOpen: boolean }) {
  const latest = slips[0];
  const key = latest ? `genm:payroll:${userId}:${latest.id}:${latest.publishedAt}` : "genm:payroll:none";
  const open = useSyncExternalStore(subscribe, () => {
    try { const saved = localStorage.getItem(key); return saved === "closed" ? false : saved === "open" ? true : initiallyOpen; } catch { return initiallyOpen; }
  }, () => initiallyOpen);
  if (!latest) return null;
  return <section className="space-y-3"><details open={open} onToggle={event => {
    const next = event.currentTarget.open;
    if (next === open) return;
    try { localStorage.setItem(key, next ? "open" : "closed"); window.dispatchEvent(new Event(eventName)); } catch { /* Browser storage can be disabled. Native details still works. */ }
  }} className="group rounded-2xl border border-[#eadfce] bg-white shadow-sm">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-4 sm:px-5 [&::-webkit-details-marker]:hidden"><div><p className="font-semibold text-[#22304a]">{monthLabel(latest.month)} payslip</p><p className="mt-1 text-xs text-[#617184]">{open ? "Collapse payment overview" : "Open payment overview"}</p></div><span className="flex items-center gap-3"><strong className="text-emerald-800">{pounds(latest.snapshot.totals.totalPence)} paid</strong><ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180"/></span></summary>
    <div className="border-t border-[#eadfce] p-3 sm:p-4"><PayslipCard id={latest.id} snapshot={latest.snapshot}/></div>
  </details><PayrollHistory slips={slips}/></section>;
}
