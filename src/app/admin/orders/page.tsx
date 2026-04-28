export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { markOrderPaid, resendOrderCompletionEmails } from "@/lib/payments/fulfillment";

function statusClass(status: string) {
  if (status === "SUCCEEDED") return "bg-[#effaf3] text-[#2f6b4b]";
  if (["PENDING", "UNDER_REVIEW", "REQUIRES_ACTION", "INITIATED"].includes(status))
    return "bg-[#fff7eb] text-[#8a6326]";
  return "bg-[#eef2f6] text-[#556274]";
}

function canApproveOrder(order: { gateway: string; status: string; paymentStatus: string }) {
  return (
    order.gateway === "BANK_TRANSFER" &&
    ["UNDER_REVIEW", "PENDING", "INITIATED"].includes(order.status) &&
    order.paymentStatus !== "SUCCEEDED"
  );
}

export default async function AdminOrdersPage() {
  async function approveManualPayment(formData: FormData) {
    "use server";

    const orderId = String(formData.get("orderId") || "");
    const referenceKey = String(formData.get("referenceKey") || "");

    if (!orderId) {
      return;
    }

    await markOrderPaid(orderId, {
      gateway: "BANK_TRANSFER",
      providerReference: referenceKey || null,
      rawPayload: {
        approvedByAdmin: true,
        approvedAt: new Date().toISOString(),
      },
    });

    revalidatePath("/admin/orders");
    revalidatePath("/parent");
    revalidatePath("/student");
  }

  async function resendCompletionEmail(formData: FormData) {
    "use server";

    const orderId = String(formData.get("orderId") || "");
    if (!orderId) {
      return;
    }

    await resendOrderCompletionEmails(orderId);
    revalidatePath("/admin/orders");
    revalidatePath("/admin");
  }

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
              const canApproveManual = canApproveOrder({
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
                    <button
                      type="submit"
                      className="rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#182236]"
                    >
                      Approve and unlock dashboard
                    </button>
                  </form>
                ) : order.status === "SUCCEEDED" || latestPayment?.status === "SUCCEEDED" ? (
                  <div className="mt-4 space-y-2">
                    <div className="rounded-full bg-[#effaf3] px-5 py-3 text-center text-sm font-semibold text-[#2f6b4b]">
                      Completed
                    </div>
                    <form action={resendCompletionEmail}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <button
                        type="submit"
                        className="w-full rounded-full border border-[#c9d7e6] bg-white px-5 py-3 text-sm font-semibold text-[#22304a] transition hover:bg-[#f6f8fb]"
                      >
                        Resend confirmation
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
