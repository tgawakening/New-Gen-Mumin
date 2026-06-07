export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { db } from "@/lib/db";
import { markOrderPaid, recordManualPaidAmount, resendOrderCompletionEmails } from "@/lib/payments/fulfillment";

function statusClass(status: string) {
  if (status === "SUCCEEDED") return "bg-[#effaf3] text-[#2f6b4b]";
  if (["PENDING", "UNDER_REVIEW", "REQUIRES_ACTION", "INITIATED"].includes(status))
    return "bg-[#fff7eb] text-[#8a6326]";
  return "bg-[#eef2f6] text-[#556274]";
}

function canMarkOrderPaid(order: { gateway: string; status: string; paymentStatus: string }) {
  const paymentStillPending = ["INITIATED", "PENDING", "UNDER_REVIEW", "REQUIRES_ACTION"].includes(
    order.paymentStatus,
  );
  const orderNeedsSync = ["UNDER_REVIEW", "PENDING", "INITIATED", "SUCCEEDED"].includes(order.status);

  return (
    ["BANK_TRANSFER", "STRIPE", "PAYPAL", "NAYAPAY"].includes(order.gateway) &&
    orderNeedsSync &&
    paymentStillPending
  );
}

function extractNoteValue(notes: string | null | undefined, label: string) {
  if (!notes) return null;
  const entry = notes
    .split(/\s*\|\s*|\r?\n/)
    .find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return entry ? entry.split(":").slice(1).join(":").trim() : null;
}

function extractManualPaidAmountAdjustment(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const adjustment = (metadata as Record<string, unknown>).manualPaidAmountAdjustment;
  if (!adjustment || typeof adjustment !== "object" || Array.isArray(adjustment)) return null;
  const record = adjustment as Record<string, unknown>;
  return {
    amount: typeof record.amount === "number" ? record.amount : null,
    currency: typeof record.currency === "string" ? record.currency : null,
    note: typeof record.note === "string" ? record.note : null,
  };
}

function registrationSourceLabel(notes: string | null | undefined) {
  if (notes?.includes("parent-dashboard-add-program")) return "Program enrollment";
  if (notes?.includes("parent-dashboard-add-child")) return "Additional child";
  return "New registration";
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string; tone?: string }>;
}) {
  async function approveManualPayment(formData: FormData) {
    "use server";

    const orderId = String(formData.get("orderId") || "");
    const referenceKey = String(formData.get("referenceKey") || "");
    const gateway = String(formData.get("gateway") || "BANK_TRANSFER");
    const returnUrl = String(formData.get("returnUrl") || "/admin/orders");

    if (!orderId) {
      return;
    }

    try {
      await markOrderPaid(orderId, {
        gateway:
          gateway === "STRIPE" || gateway === "PAYPAL" || gateway === "NAYAPAY" || gateway === "BANK_TRANSFER"
            ? gateway
            : "BANK_TRANSFER",
        providerReference: referenceKey || null,
        rawPayload: {
          approvedByAdmin: true,
          approvedGateway: gateway,
          approvedAt: new Date().toISOString(),
        },
      });

      revalidatePath("/admin/orders");
      revalidatePath("/parent");
      revalidatePath("/student");
    } catch {
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Unable to complete this order right now&tone=error`);
    }
    redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Order completed successfully&tone=success`);
  }

  async function resendCompletionEmail(formData: FormData) {
    "use server";

    const orderId = String(formData.get("orderId") || "");
    const returnUrl = String(formData.get("returnUrl") || "/admin/orders");
    if (!orderId) {
      return;
    }

    try {
      await resendOrderCompletionEmails(orderId);
      revalidatePath("/admin/orders");
      revalidatePath("/admin");
    } catch {
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Unable to resend the confirmation email right now&tone=error`);
    }
    redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Confirmation email sent successfully&tone=success`);
  }

  async function adjustManualPaidAmount(formData: FormData) {
    "use server";

    const orderId = String(formData.get("orderId") || "");
    const returnUrl = String(formData.get("returnUrl") || "/admin/orders");
    const amount = Number(formData.get("manualPaidAmount"));
    const note = String(formData.get("manualPaidNote") || "");
    if (!orderId || !Number.isFinite(amount) || amount < 0) {
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Enter a valid paid amount&tone=error`);
    }

    try {
      await recordManualPaidAmount(orderId, { amount, note });
      revalidatePath("/admin/orders");
      revalidatePath("/admin");
      revalidatePath("/admin/registrations");
    } catch {
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Unable to update the paid amount right now&tone=error`);
    }
    redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Paid amount record updated&tone=success`);
  }

  const params = searchParams ? await searchParams : undefined;

  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 24,
    include: {
      parent: {
        include: {
          user: true,
        },
      },
      payments: {
        include: {
          manualSubmission: true,
        },
      },
      registration: true,
    },
  });

  return (
    <div className="min-h-screen bg-[#f7f4eb] py-10">
      <div className="section-container space-y-6">
        <ActionToast message={params?.notice} tone={params?.tone} />
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
            Admin / Orders
          </p>
          <h1 className="mt-2 text-4xl font-semibold text-[#22304a]">
            Orders and payments
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-8 text-[#5f6b7a]">
            Review gateway state, approve manual payments, and unlock learner dashboards
            after payment confirmation.
          </p>
        </div>

        <div className="grid gap-4">
            {orders.map((order) => {
              const latestPayment = order.payments[0] ?? null;
              const manualSubmission = latestPayment?.manualSubmission ?? null;
              const city = extractNoteValue(order.registration?.notes, "City");
              const sourceLabel = registrationSourceLabel(order.registration?.notes);
              const manualPaidAmountAdjustment = extractManualPaidAmountAdjustment(order.metadata);
              const canApproveManual = canMarkOrderPaid({
                gateway: order.gateway,
                status: order.status,
                paymentStatus: latestPayment?.status ?? order.status,
              });

            return (
              <div
                key={order.id}
                className="rounded-[1.6rem] border border-[#eadfce] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-[#22304a]">
                      {order.orderNumber}
                    </h2>
                    <p className="mt-1 text-sm text-[#6d7785]">
                      {order.parent.user.firstName} {order.parent.user.lastName} •{" "}
                      {order.parent.user.email}
                    </p>
                    <p className="mt-2 w-fit rounded-full bg-[#eef6ff] px-3 py-1 text-xs font-semibold text-[#0f4d81]">{sourceLabel}</p>
                    <p className="mt-1 text-sm text-[#6d7785]">City: {city ?? "Pending"}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(order.status)}`}
                  >
                    {order.status.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#556274]">
                  <span>{order.gateway}</span>
                  <span>
                    {order.currency} {order.totalAmount}
                  </span>
                  {order.discountAmount > 0 ? (
                    <span>Saved {order.currency} {order.discountAmount}</span>
                  ) : null}
                  {manualPaidAmountAdjustment ? (
                    <span>
                      Payment record: {manualPaidAmountAdjustment.currency ?? order.currency} {manualPaidAmountAdjustment.amount ?? order.totalAmount}
                      {manualPaidAmountAdjustment.note ? ` - ${manualPaidAmountAdjustment.note}` : ""}
                    </span>
                  ) : null}
                  <span>{order.payments.length} payment records</span>
                  {typeof order.registration?.pricingSnapshot === "object" &&
                  order.registration?.pricingSnapshot &&
                  "couponCode" in (order.registration.pricingSnapshot as object) &&
                  typeof (order.registration.pricingSnapshot as Record<string, unknown>).couponCode === "string" ? (
                    <span className="rounded-full bg-[#edf8ef] px-3 py-1 text-xs font-semibold text-[#2f6b4b]">
                      {(order.registration.pricingSnapshot as Record<string, unknown>).couponCode as string}
                      {typeof (order.registration.pricingSnapshot as Record<string, unknown>).couponDiscountPercent === "number"
                        ? ` (${(order.registration.pricingSnapshot as Record<string, unknown>).couponDiscountPercent}% off)`
                        : ""}
                    </span>
                  ) : null}
                </div>

                {manualSubmission ? (
                  <div className="mt-4 grid gap-3 rounded-[22px] bg-[#fbf6ef] p-4 text-sm text-[#4d5a6b] md:grid-cols-2">
                    <div>
                      <strong className="text-[#22304a]">Sender</strong>:{" "}
                      {manualSubmission.senderName}
                    </div>
                    <div>
                      <strong className="text-[#22304a]">Number</strong>:{" "}
                      {manualSubmission.senderNumber}
                    </div>
                    <div>
                      <strong className="text-[#22304a]">Reference</strong>:{" "}
                      {manualSubmission.referenceKey}
                    </div>
                    <div>
                      <strong className="text-[#22304a]">Notes</strong>:{" "}
                      {manualSubmission.notes ?? "No notes"}
                    </div>
                  </div>
                ) : null}

                {canApproveManual ? (
                  <form action={approveManualPayment} className="mt-4">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input
                      type="hidden"
                      name="referenceKey"
                      value={manualSubmission?.referenceKey ?? ""}
                    />
                    <input type="hidden" name="gateway" value={order.gateway} />
                    <input type="hidden" name="returnUrl" value="/admin/orders" />
                    <button
                      type="submit"
                      className="rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#182236]"
                    >
                      {order.status === "SUCCEEDED"
                        ? "Sync payment completed"
                        : order.gateway === "BANK_TRANSFER"
                          ? sourceLabel === "Program enrollment"
                            ? "Mark payment completed and unlock programme"
                            : "Approve and unlock dashboard"
                          : "Mark paid and unlock dashboard"}
                    </button>
                  </form>
                ) : order.status === "SUCCEEDED" || latestPayment?.status === "SUCCEEDED" ? (
                  <div className="mt-4 space-y-2">
                    <div className="rounded-full bg-[#effaf3] px-5 py-3 text-center text-sm font-semibold text-[#2f6b4b]">
                      Completed
                    </div>
                    <form action={resendCompletionEmail}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="returnUrl" value="/admin/orders" />
                      <button
                        type="submit"
                        className="w-full rounded-full border border-[#c9d7e6] bg-white px-5 py-3 text-sm font-semibold text-[#22304a] transition hover:bg-[#f6f8fb]"
                      >
                        Resend confirmation
                      </button>
                    </form>
                  </div>
                ) : null}
                {["BANK_TRANSFER", "STRIPE", "PAYPAL"].includes(order.gateway) ? (
                  <form action={adjustManualPaidAmount} className="mt-4 grid gap-3 rounded-[22px] border border-[#eadfce] bg-[#fbfdff] p-4 text-sm md:grid-cols-[180px_1fr_auto]">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="returnUrl" value="/admin/orders" />
                    <input
                      name="manualPaidAmount"
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={order.totalAmount}
                      className="rounded-xl border border-[#d8c8b5] px-3 py-2"
                      aria-label="Recorded paid amount"
                    />
                    <input
                      name="manualPaidNote"
                      defaultValue={manualPaidAmountAdjustment?.note ?? ""}
                      placeholder="Note, e.g. manual refund or corrected gateway amount"
                      className="rounded-xl border border-[#d8c8b5] px-3 py-2"
                    />
                    <button className="rounded-full bg-[#22304a] px-5 py-2 font-semibold text-white">
                      Save record
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
