import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { canAccessAdminFinance } from "@/lib/admin/access";
import { getPaymentsReport } from "@/lib/payments/report";

export const dynamic = "force-dynamic";

function totalLabel(totals: Map<string, number>) {
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => `${currency} ${amount.toFixed(2)}`).join(" / ") || "None recorded";
}
function dateLabel(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Asia/Karachi" }).format(date) : "No dated payment recorded";
}
const card = "min-w-0 rounded-2xl border border-[#dce4ed] bg-white p-5 shadow-sm sm:p-6";
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#c9d7e6] px-4 py-2 text-sm font-semibold text-[#22304a] transition hover:bg-[#f5f8fb]";

export default async function PaymentsReportPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN" || !(await canAccessAdminFinance(session.user.id))) redirect("/admin");
  const { received, expected, pending, failed, upcoming, methods, latest } = await getPaymentsReport();
  const summaries = [
    { title: "Total received", value: totalLabel(received) },
    { title: "Total upcoming / outstanding", value: totalLabel(upcoming) },
    { title: "Latest recorded payment date", value: dateLabel(latest), note: "Asia/Karachi; only dates stored as paid are used." },
  ];
  const breakdown = [
    { title: "Next cycle, active subscriptions", value: totalLabel(expected) },
    { title: "Pending / under review", value: totalLabel(pending) },
    { title: "Failed", value: totalLabel(failed) },
  ];

  return <div className="section-container space-y-6 py-8 text-[#22304a]">
    <header className="rounded-[28px] border border-[#dce4ed] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 xl:max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#c27a2c]">Admin / Finance</p>
          <h1 className="mt-2 text-3xl font-semibold">Payments report</h1>
          <p className="mt-2 text-sm leading-6 text-[#617184]">All-time recorded course payments and a read-only estimate of outstanding and next-cycle amounts.</p>
        </div>
        <nav aria-label="Payments report actions" className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link href="/admin/monthly-payments" className={button}>Monthly payments</Link>
          <Link href="/admin" className={button}>Admin home</Link>
          <a href="/api/admin/payments/report-export" className={`${button} border-[#22304a] bg-[#22304a] text-white hover:bg-[#34445f]`}><Download aria-hidden="true" size={16} />Download Excel</a>
        </nav>
      </div>
    </header>
    <section aria-label="Payment totals" className="grid gap-4 md:grid-cols-3">
      {summaries.map((item) => <article key={item.title} className={card}><h2 className="text-sm font-semibold text-[#617184]">{item.title}</h2><p className="mt-3 break-words text-xl font-semibold leading-8">{item.value}</p>{item.note && <p className="mt-2 text-xs leading-5 text-[#617184]">{item.note}</p>}</article>)}
    </section>
    <section aria-label="Payment breakdowns" className="grid gap-4 lg:grid-cols-2">
      <article className={card}><h2 className="text-lg font-semibold">Received by method</h2><div className="mt-4 divide-y divide-[#edf1f5] text-sm">{[...methods].sort(([a], [b]) => a.localeCompare(b)).map(([method, totals]) => <div key={method} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"><h3 className="font-medium">{method.replaceAll("_", " ")}</h3><p className="break-words font-semibold">{totalLabel(totals)}</p></div>)}{!methods.size && <p className="text-[#617184]">None recorded.</p>}</div></article>
      <article className={card}><h2 className="text-lg font-semibold">Upcoming and outstanding</h2><div className="mt-4 divide-y divide-[#edf1f5] text-sm">{breakdown.map((item) => <div key={item.title} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"><h3 className="font-medium">{item.title}</h3><p className="break-words font-semibold">{item.value}</p></div>)}</div></article>
    </section>
    <details className="rounded-2xl border border-[#dce4ed] bg-white px-5 py-4 text-sm leading-7 text-[#617184]">
      <summary className="cursor-pointer font-semibold text-[#22304a]">Billing dates and report scope</summary>
      <div className="mt-3 space-y-2"><p>There is no single last-payment date. Stripe and PayPal follow each subscription’s provider schedule. Manual renewals generally follow the payment anniversary with a five-day window; from November 2026, Pakistani manual fees are due on the 20th, with named family exceptions due on the 10th (Asia/Karachi).</p><p>Received includes successful checkout transactions and paid or manually confirmed monthly records. Credits for extended billing are excluded. Dates and historical gateway events may be missing from the database; the latest recorded date is not a guaranteed deadline. Currencies are never converted.</p><p>The next-cycle estimate uses the stored order amount for locally active subscriptions, excluding those set to cancel and those with an outstanding monthly record to avoid overlap. Provider status, dates and prices may have changed without syncing. Pending and failed amounts include the latest attempt for each unpaid checkout and recorded monthly obligations; they may include overdue amounts. Manual future renewals without a pending record are not included. Charity payments are excluded.</p></div>
    </details>
  </div>;
}
