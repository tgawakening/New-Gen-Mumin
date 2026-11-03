"use client";
import { useRef, useState } from "react";
import { monthLabel, pounds, type PayrollSnapshot } from "@/lib/payroll/calculation";
import { PayslipCard } from "./PayslipCard";
export type PublishedSlip = { id: string; month: string; publishedAt: string; snapshot: PayrollSnapshot };
export function PayrollHistory({ slips }: { slips: PublishedSlip[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(slips[0]?.id || "");
  const slip = slips.find(slip => slip.id === selected);
  return <><button type="button" onClick={() => dialog.current?.showModal()} className="rounded-full border bg-white px-4 py-2 text-sm font-semibold">Payroll slip history</button>
    <dialog ref={dialog} aria-label="Payroll slip history" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_1rem)] max-w-4xl overflow-y-auto rounded-3xl border bg-[#f7f4eb] p-4 text-[#22304a] shadow-2xl backdrop:bg-slate-900/60 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-bold">Payroll slip history</h2><form method="dialog"><button className="rounded-full border bg-white px-4 py-2 text-sm">Close</button></form></div>
      <div className="mb-4 flex max-h-40 flex-wrap gap-2 overflow-y-auto">{slips.map(item => <button key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)} className={`rounded-xl border px-4 py-3 text-left text-sm ${selected === item.id ? "bg-[#22304a] text-white" : "bg-white"}`}>{monthLabel(item.month)}<span className="mt-1 block text-xs">{pounds(item.snapshot.totals.totalPence)}</span></button>)}</div>
      {slip ? <PayslipCard id={slip.id} snapshot={slip.snapshot}/> : <p>No published payslips yet.</p>}
    </dialog></>;
}
