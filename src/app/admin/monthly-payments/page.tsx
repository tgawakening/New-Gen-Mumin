export const dynamic = "force-dynamic";

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MonthlyPaymentStatus } from "@prisma/client";

import { getCurrentSession } from "@/lib/auth/session";
import {
  extendStripeSubscriptionBillingDate,
  getAdminMonthlyPaymentRecords,
  markMonthlyPaymentsActive,
  monthKey,
  monthLabel,
  monthlyPaymentDisplay,
} from "@/lib/payments/monthly-ledger";

type PageProps = {
  searchParams?: Promise<{ status?: string; month?: string; notice?: string; tone?: string }>;
};

function badge(status: string) {
  switch (status) {
    case "PAID":
    case "ACTIVE":
    case "ADMIN_ACTIVATED":
      return "bg-[#effaf3] text-[#2f6b4b]";
    case "PENDING":
      return "bg-[#fff7eb] text-[#8a6326]";
    case "FAILED":
      return "bg-[#fff4f4] text-[#a23c3c]";
    default:
      return "bg-[#eef2f6] text-[#556274]";
  }
}

function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(value) : "Pending";
}

function noticeHref(message: string, tone: "success" | "error" = "success", month?: string, status?: string) {
  const params = new URLSearchParams({ notice: message, tone });
  if (month) params.set("month", month);
  if (status) params.set("status", status);
  return `/admin/monthly-payments?${params.toString()}`;
}

export default async function AdminMonthlyPaymentsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") redirect("/admin");

  const params = searchParams ? await searchParams : {};
  const selectedMonth = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : monthKey(new Date());
  const selectedStatus = params.status || "PENDING";
  const records = await getAdminMonthlyPaymentRecords(selectedStatus, selectedMonth);

  async function activateSelected(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin");
    const recordIds = formData.getAll("recordId").map(String).filter(Boolean);
    const month = String(formData.get("month") || "");
    const status = String(formData.get("status") || "");
    try {
      const result = await markMonthlyPaymentsActive(recordIds, currentSession.user.id, String(formData.get("note") || ""));
      revalidatePath("/admin/monthly-payments");
      revalidatePath("/parent/profile");
      redirect(noticeHref(`Activated ${result.updated} monthly payment row${result.updated === 1 ? "" : "s"}.`, "success", month, status));
    } catch (error) {
      redirect(noticeHref(error instanceof Error ? error.message : "Unable to activate selected records.", "error", month, status));
    }
  }

  async function extendStripeBilling(formData: FormData) {
    "use server";
    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin");
    const recordId = String(formData.get("extendRecordId") || formData.get("recordId") || "");
    const month = String(formData.get("month") || "");
    const status = String(formData.get("status") || "");
    const months = Number(formData.get(`months-${recordId}`) || formData.get("months") || "1");
    const note = String(formData.get(`note-${recordId}`) || formData.get("note") || "");

    try {
      const result = await extendStripeSubscriptionBillingDate({
        recordId,
        months,
        adminUserId: currentSession.user.id,
        note,
      });
      revalidatePath("/admin/monthly-payments");
      revalidatePath("/parent/profile");
      redirect(noticeHref(`Stripe next billing moved by ${result.months} month${result.months === 1 ? "" : "s"} to ${formatDate(result.nextBillingDate)}. ${result.creditedRows} credit row${result.creditedRows === 1 ? "" : "s"} added.`, "success", month, status));
    } catch (error) {
      redirect(noticeHref(error instanceof Error ? error.message : "Unable to extend Stripe billing date.", "error", month, status));
    }
  }

  const totals = records.reduce((sum, record) => sum + record.amount, 0);
  const currency = records[0]?.currency ?? "GBP";

  return (
    <div className="min-h-screen bg-[#edf2f6] py-8">
      <div className="section-container space-y-6">
        <div className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Admin / Subscriptions</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#22304a]">Monthly payment status</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[#617184]">Filter pending manual/auto subscriptions, review monthly charges, and activate records after manual payment proof is received.</p>
            </div>
            <Link href="/admin" className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">Admin home</Link>
          </div>
        </div>

        {params.notice ? <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${params.tone === "error" ? "border-[#efb3b3] bg-[#fff4f4] text-[#a23c3c]" : "border-[#bfe4ca] bg-[#effaf3] text-[#2f6b4b]"}`}>{params.notice}</div> : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-[#dce4ed] bg-white p-5"><p className="text-sm text-[#617184]">Rows</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{records.length}</p></div>
          <div className="rounded-[22px] border border-[#dce4ed] bg-white p-5"><p className="text-sm text-[#617184]">Month</p><p className="mt-2 text-2xl font-semibold text-[#22304a]">{monthLabel(selectedMonth)}</p></div>
          <div className="rounded-[22px] border border-[#dce4ed] bg-white p-5"><p className="text-sm text-[#617184]">Filtered total</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(totals)}</p></div>
        </section>

        <section className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <form className="flex flex-wrap items-end gap-3">
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">Month<input name="month" type="month" defaultValue={selectedMonth} className="rounded-2xl border border-[#dce4ed] px-4 py-3" /></label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">Status<select name="status" defaultValue={selectedStatus} className="rounded-2xl border border-[#dce4ed] px-4 py-3">
              <option value="ALL">All</option>
              {Object.values(MonthlyPaymentStatus).map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}
            </select></label>
            <button className="rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">Filter</button>
          </form>
        </section>

        <form action={activateSelected} className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <input type="hidden" name="month" value={selectedMonth} />
          <input type="hidden" name="status" value={selectedStatus} />
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <label className="grid min-w-[260px] flex-1 gap-2 text-sm font-semibold text-[#22304a]">Admin note<input name="note" placeholder="Payment proof received / manual bank transfer" className="rounded-2xl border border-[#dce4ed] px-4 py-3 text-sm" /></label>
            <button className="rounded-full bg-[#2f6b4b] px-5 py-3 text-sm font-semibold text-white">Mark selected active</button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[#e6edf4]">
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead className="bg-[#fbfdff] text-xs uppercase tracking-[0.14em] text-[#6f7d8f]"><tr><th className="px-4 py-3">Select</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Parent</th><th className="px-4 py-3">Child</th><th className="px-4 py-3">Programme</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Paid/Activated</th><th className="px-4 py-3">Stripe extension</th></tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-t border-[#e6edf4] align-top">
                    <td className="px-4 py-3"><input type="checkbox" name="recordId" value={record.id} disabled={["PAID", "ADMIN_ACTIVATED", "ACTIVE"].includes(record.status)} /></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge(record.status)}`}>{record.status.replace(/_/g, " ")}</span></td>
                    <td className="px-4 py-3"><p className="font-semibold text-[#22304a]">{record.parent.user.firstName} {record.parent.user.lastName}</p><p className="text-xs text-[#617184]">{record.parent.user.email}</p></td>
                    <td className="px-4 py-3">{record.childName}</td>
                    <td className="px-4 py-3">{record.programmeTitle}</td>
                    <td className="px-4 py-3">{record.method} {record.gateway ? `- ${record.gateway}` : ""}</td>
                    <td className="px-4 py-3 font-semibold text-[#22304a]">{monthlyPaymentDisplay(record)}</td>
                    <td className="px-4 py-3">{formatDate(record.dueDate)}</td>
                    <td className="px-4 py-3">{formatDate(record.paidAt ?? record.activatedAt)}</td>
                    <td className="px-4 py-3">
                      {record.gateway === "STRIPE" && record.providerSubscriptionId ? (
                        <div className="grid min-w-[260px] gap-2 rounded-2xl bg-[#fbf6ef] p-3">
                          <label className="grid gap-1 text-xs font-semibold text-[#22304a]">Extend by months<input name={`months-${record.id}`} type="number" min="1" max="12" defaultValue="1" className="rounded-xl border border-[#dce4ed] px-3 py-2" /></label>
                          <input name={`note-${record.id}`} placeholder="Reason, e.g. duplicate payment credit" className="rounded-xl border border-[#dce4ed] px-3 py-2 text-xs" />
                          <button name="extendRecordId" value={record.id} formAction={extendStripeBilling} className="rounded-full bg-[#22304a] px-3 py-2 text-xs font-semibold text-white">Move Stripe next charge</button>
                          <p className="text-[11px] leading-4 text-[#6d7785]">Applies to the full Stripe subscription/order linked to this row.</p>
                        </div>
                      ) : (
                        <span className="text-xs text-[#8a94a3]">Not Stripe auto billing</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!records.length ? <tr><td colSpan={10} className="px-4 py-8 text-center text-[#617184]">No monthly payment records match this filter yet.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </form>
      </div>
    </div>
  );
}