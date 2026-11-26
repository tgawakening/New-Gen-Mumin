import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronDown, Download, WalletCards } from "lucide-react";
import { getCurrentSession } from "@/lib/auth/session";
import { canAccessAdminFinance } from "@/lib/admin/access";
import { getPaymentsReport } from "@/lib/payments/report";
import { CurrencyCalculator } from "@/components/admin/PaymentsCurrencyCalculator";

export const dynamic = "force-dynamic";

const card = "min-w-0 rounded-[28px] border border-[#dce4ed] bg-white p-5 shadow-sm sm:p-6";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a] transition hover:bg-[#f5f8fb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22304a]";
const numberFormat = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function CurrencyList({ totals }: { totals: Map<string, number> }) {
  const entries = [...totals].sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return <p className="py-2 text-sm text-[#617184]">None recorded</p>;
  return <dl className="divide-y divide-[#edf1f5]">{entries.map(([currency, amount]) => <div key={currency} className="flex items-baseline justify-between gap-4 py-2.5"><dt className="text-sm font-semibold text-[#617184]">{currency}</dt><dd className="min-w-0 break-all text-right text-lg font-semibold tabular-nums text-[#22304a]">{numberFormat.format(amount)}</dd></div>)}</dl>;
}
function dateLabel(date: Date | null) {
  return date ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Asia/Karachi" }).format(date) : "No dated payment recorded";
}

export default async function PaymentsReportPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN" || !(await canAccessAdminFinance(session.user.id))) redirect("/admin");
  const { received, expected, pending, failed, upcoming, methods, latest } = await getPaymentsReport();
  const breakdown = [
    { title: "Next cycle", description: "Expected from active subscriptions", value: expected },
    { title: "Pending or under review", description: "Awaiting payment or confirmation", value: pending },
    { title: "Failed", description: "Payments that did not go through", value: failed },
  ];
  const currencies = [...new Set([...received.keys(), ...upcoming.keys(), ...expected.keys(), ...pending.keys(), ...failed.keys(), ...[...methods.values()].flatMap((totals) => [...totals.keys()])])].sort();

  return <div className="section-container space-y-6 py-7 text-[#22304a] sm:space-y-7 sm:py-9">
    <header className={`${card} relative overflow-hidden sm:p-8`}>
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-[#f39f5f]" />
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-2xl min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Admin / Finance</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Payments report</h1>
          <p className="mt-3 text-sm leading-7 text-[#617184] sm:text-base">See what has been received and what is still expected, with every currency kept separate.</p>
        </div>
        <nav aria-label="Payments report actions" className="flex flex-wrap gap-2 sm:gap-3">
          <Link href="/admin/monthly-payments" className={secondaryButton}>Monthly payments</Link>
          <Link href="/admin" className={secondaryButton}>Admin home</Link>
          <a href="/api/admin/payments/report-export" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#22304a] bg-[#22304a] px-5 py-2 text-sm font-semibold text-white transition-colors hover:border-[#34445f] hover:bg-[#34445f] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22304a] focus-visible:text-white active:border-[#162238] active:bg-[#162238] active:text-white"><Download aria-hidden="true" size={16} />Download Excel</a>
        </nav>
      </div>
    </header>

    <section aria-label="Payment overview" className="grid gap-4 lg:grid-cols-3">
      <article className={card}><div className="flex items-center gap-3"><span className="rounded-2xl bg-[#effaf3] p-2.5 text-[#2f6b4b]"><ArrowDownLeft size={20} aria-hidden="true" /></span><div><h2 className="font-semibold">Total received</h2><p className="text-xs text-[#617184]">Payments recorded as received</p></div></div><div className="mt-4"><CurrencyList totals={received} /></div></article>
      <article className={card}><div className="flex items-center gap-3"><span className="rounded-2xl bg-[#fff7eb] p-2.5 text-[#a66828]"><ArrowUpRight size={20} aria-hidden="true" /></span><div><h2 className="font-semibold">Total upcoming and outstanding</h2><p className="text-xs text-[#617184]">Expected, pending and failed</p></div></div><div className="mt-4"><CurrencyList totals={upcoming} /></div></article>
      <article className={card}><div className="flex items-center gap-3"><span className="rounded-2xl bg-[#eef4fa] p-2.5 text-[#355b7d]"><CalendarDays size={20} aria-hidden="true" /></span><div><h2 className="font-semibold">Latest recorded payment</h2><p className="text-xs text-[#617184]">Most recent recorded payment date</p></div></div><p className="mt-6 text-xl font-semibold leading-8">{dateLabel(latest)}</p><p className="mt-2 text-xs leading-5 text-[#617184]">Dates use Asia/Karachi time. Only recorded payment dates are included.</p></article>
    </section>

    <section aria-label="Payment breakdowns" className="grid gap-4 lg:grid-cols-2">
      <article className={card}><div className="flex items-center gap-3"><span className="rounded-2xl bg-[#fff7eb] p-2.5 text-[#a66828]"><WalletCards size={20} aria-hidden="true" /></span><div><h2 className="text-lg font-semibold">Received by payment method</h2><p className="text-sm text-[#617184]">A closer look at payments received</p></div></div><div className="mt-5 space-y-3">{[...methods].sort(([a], [b]) => a.localeCompare(b)).map(([method, totals]) => <div key={method} className="rounded-2xl bg-[#f6f8fa] px-4 py-3"><h3 className="text-sm font-semibold text-[#22304a]">{method.replaceAll("_", " ")}</h3><CurrencyList totals={totals} /></div>)}{!methods.size && <p className="text-sm text-[#617184]">None recorded.</p>}</div></article>
      <article className={card}><h2 className="text-lg font-semibold">What is still expected</h2><p className="mt-1 text-sm text-[#617184]">A breakdown of upcoming and outstanding payments</p><div className="mt-5 space-y-3">{breakdown.map((item) => <div key={item.title} className="rounded-2xl bg-[#f6f8fa] px-4 py-3"><h3 className="text-sm font-semibold">{item.title}</h3><p className="mt-0.5 text-xs text-[#617184]">{item.description}</p><CurrencyList totals={item.value} /></div>)}</div></article>
    </section>

    <CurrencyCalculator currencies={currencies} received={[...received]} upcoming={[...upcoming]} />

    <details className="group rounded-[24px] border border-[#dce4ed] bg-white px-5 py-4 text-sm leading-7 text-[#617184] shadow-sm sm:px-6">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-[#22304a]">Billing dates and report scope <ChevronDown aria-hidden="true" size={18} className="shrink-0 transition-transform group-open:rotate-180" /></summary>
      <div className="mt-3 space-y-2"><p>There is no single last-payment date. Stripe and PayPal follow each subscription’s provider schedule. Manual renewals generally follow the payment anniversary with a five-day window; from November 2026, Pakistani manual fees are due on the 20th, with named family exceptions due on the 10th (Asia/Karachi).</p><p>Received includes successful checkout transactions and paid or manually confirmed monthly records. Credits for extended billing are excluded. Dates and historical gateway events may be missing from the database; the latest recorded date is not a guaranteed deadline. The original report amounts remain in their recorded currencies; optional estimates use your manually entered rates.</p><p>The next-cycle estimate uses the stored order amount for locally active subscriptions, excluding those set to cancel and those with an outstanding monthly record to avoid overlap. Provider status, dates and prices may have changed without syncing. Pending and failed amounts include the latest attempt for each unpaid checkout and recorded monthly obligations; they may include overdue amounts. Manual future renewals without a pending record are not included. Charity payments are excluded.</p></div>
    </details>
  </div>;
}
