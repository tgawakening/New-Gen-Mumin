export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { markOrderPaid, recordManualPaidAmount, resendOrderCompletionEmails } from "@/lib/payments/fulfillment";
import { extendStripeSubscriptionBillingDateForOrderItem } from "@/lib/payments/monthly-ledger";

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

function formatAdminDate(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(value) : "Not set";
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

  async function extendStripeOrderBilling(formData: FormData) {
    "use server";

    const session = await getCurrentSession();
    if (!session || session.user.role !== "ADMIN") redirect("/admin");

    const orderItemId = String(formData.get("orderItemId") || "");
    const returnUrl = String(formData.get("returnUrl") || "/admin/orders");
    const months = Number(formData.get("months") || "1");
    const note = String(formData.get("extensionNote") || "");

    try {
      const result = await extendStripeSubscriptionBillingDateForOrderItem({
        orderItemId,
        months,
        adminUserId: session.user.id,
        note,
      });
      revalidatePath("/admin/orders");
      revalidatePath("/admin/monthly-payments");
      revalidatePath("/parent/profile");
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Stripe next charge moved by ${result.months} month${result.months === 1 ? "" : "s"} to ${formatAdminDate(result.nextBillingDate)}. ${result.creditedRows} credit row${result.creditedRows === 1 ? "" : "s"} added.&tone=success`);
    } catch (error) {
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=${encodeURIComponent(error instanceof Error ? error.message : "Unable to extend Stripe subscription.")}&tone=error`);
    }
  }
  async function extendStripeOrderBillingFromOrder(formData: FormData) {
    "use server";

    const session = await getCurrentSession();
    if (!session || session.user.role !== "ADMIN") redirect("/admin");

    const orderId = String(formData.get("orderId") || "");
    const returnUrl = String(formData.get("returnUrl") || "/admin/orders");
    const months = Number(formData.get("months") || "1");
    const note = String(formData.get("extensionNote") || "");

    try {
      const orderItem = await db.orderItem.findFirst({
        where: {
          orderId,
          order: { gateway: "STRIPE" },
          subscription: { is: { providerSubscriptionId: { not: null } } },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (!orderItem) {
        throw new Error("No active Stripe subscription is linked with this order yet.");
      }
      const result = await extendStripeSubscriptionBillingDateForOrderItem({
        orderItemId: orderItem.id,
        months,
        adminUserId: session.user.id,
        note,
      });
      revalidatePath("/admin/orders");
      revalidatePath("/admin/monthly-payments");
      revalidatePath("/parent/profile");
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Stripe next charge moved by ${result.months} month${result.months === 1 ? "" : "s"} to ${formatAdminDate(result.nextBillingDate)}. ${result.creditedRows} credit row${result.creditedRows === 1 ? "" : "s"} added.&tone=success`);
    } catch (error) {
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=${encodeURIComponent(error instanceof Error ? error.message : "Unable to extend Stripe subscription.")}&tone=error`);
    }
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
    take: 100,
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
      items: {
        include: {
          subscription: true,
          enrollment: {
            include: {
              student: { include: { user: true } },
              program: true,
            },
          },
        },
      },
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

        <div className="overflow-hidden rounded-[1.35rem] border border-[#d9e2ec] bg-white shadow-sm">
          <div className="hidden grid-cols-[1.25fr_1.35fr_0.8fr_0.75fr_0.75fr_1.2fr] gap-4 border-b border-[#e4ecf4] bg-[#f8fbff] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7888] lg:grid">
            <span>Parent</span>
            <span>Children / programme</span>
            <span>Amount</span>
            <span>Payment</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-[#e5edf5]">
            {orders.map((order) => {
              const latestPayment = order.payments[0] ?? null;
              const manualSubmission = latestPayment?.manualSubmission ?? null;
              const city = extractNoteValue(order.registration?.notes, "City");
              const sourceLabel = registrationSourceLabel(order.registration?.notes);
              const manualPaidAmountAdjustment = extractManualPaidAmountAdjustment(order.metadata);
              const stripeSubscriptionItems = order.items.filter((item) => item.subscription?.providerSubscriptionId);
              const isStripeOrder = order.gateway === "STRIPE" || latestPayment?.gateway === "STRIPE";
              const canApproveManual = canMarkOrderPaid({
                gateway: order.gateway,
                status: order.status,
                paymentStatus: latestPayment?.status ?? order.status,
              });
              const pricingSnapshot = order.registration?.pricingSnapshot;
              const couponCode =
                typeof pricingSnapshot === "object" &&
                pricingSnapshot &&
                "couponCode" in pricingSnapshot &&
                typeof (pricingSnapshot as Record<string, unknown>).couponCode === "string"
                  ? ((pricingSnapshot as Record<string, unknown>).couponCode as string)
                  : null;
              const couponDiscount =
                typeof pricingSnapshot === "object" && pricingSnapshot
                  ? (pricingSnapshot as Record<string, unknown>).couponDiscountPercent
                  : null;
              const children = order.items
                .map((item) => {
                  const student = item.enrollment?.student;
                  const name = student?.displayName || `${student?.user.firstName ?? "Student"} ${student?.user.lastName ?? ""}`.trim();
                  return {
                    id: item.id,
                    name,
                    program: item.enrollment?.program.title ?? item.description,
                    subscriptionEnd: item.subscription?.currentPeriodEnd,
                  };
                })
                .filter((item, index, list) => item.name || index < list.length);

              return (
                <div key={order.id} className="grid gap-4 px-4 py-4 text-sm text-[#22304a] lg:grid-cols-[1.25fr_1.35fr_0.8fr_0.75fr_0.75fr_1.2fr] lg:items-start">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9aa8b8] lg:hidden">Parent</p>
                    <p className="font-semibold text-[#17233b]">{order.parent.user.firstName} {order.parent.user.lastName}</p>
                    <p className="mt-1 truncate text-xs text-[#617184]">{order.parent.user.email}</p>
                    <p className="mt-1 text-xs text-[#617184]">City: {city ?? "Pending"}</p>
                    <p className="mt-2 inline-flex rounded-full bg-[#eef6ff] px-2.5 py-1 text-[11px] font-semibold text-[#0f4d81]">{sourceLabel}</p>
                    <p className="mt-2 text-[11px] text-[#8a97a7]">{order.orderNumber}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9aa8b8] lg:hidden">Children / programme</p>
                    <div className="space-y-2">
                      {children.length ? children.map((child) => (
                        <div key={child.id} className="rounded-2xl bg-[#f8fbff] px-3 py-2">
                          <p className="font-semibold text-[#22304a]">{child.name}</p>
                          <p className="mt-1 text-xs text-[#617184]">{child.program}</p>
                          {child.subscriptionEnd ? <p className="mt-1 text-[11px] text-[#7a8797]">Next Stripe date: {formatAdminDate(child.subscriptionEnd)}</p> : null}
                        </div>
                      )) : (
                        <p className="rounded-2xl bg-[#f8fbff] px-3 py-2 text-xs text-[#617184]">No child details attached.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9aa8b8] lg:hidden">Amount</p>
                    <p className="font-semibold">{order.currency} {order.totalAmount}</p>
                    {order.discountAmount > 0 ? <p className="mt-1 text-xs text-[#2f6b4b]">Saved {order.currency} {order.discountAmount}</p> : null}
                    {couponCode ? (
                      <p className="mt-2 inline-flex rounded-full bg-[#edf8ef] px-2.5 py-1 text-[11px] font-semibold text-[#2f6b4b]">
                        {couponCode}{typeof couponDiscount === "number" ? ` - ${couponDiscount}% off` : ""}
                      </p>
                    ) : null}
                    {manualPaidAmountAdjustment ? (
                      <p className="mt-2 text-[11px] leading-4 text-[#617184]">
                        Recorded: {manualPaidAmountAdjustment.currency ?? order.currency} {manualPaidAmountAdjustment.amount ?? order.totalAmount}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9aa8b8] lg:hidden">Payment</p>
                    <p className="font-semibold">{order.gateway}</p>
                    <p className="mt-1 text-xs text-[#617184]">{latestPayment?.status ?? order.status}</p>
                    <p className="mt-1 text-[11px] text-[#8a97a7]">{order.payments.length} record{order.payments.length === 1 ? "" : "s"}</p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9aa8b8] lg:hidden">Status</p>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClass(order.status)}`}>
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9aa8b8] lg:hidden">Actions</p>
                    {canApproveManual ? (
                      <form action={approveManualPayment}>
                        <input type="hidden" name="orderId" value={order.id} />
                        <input type="hidden" name="referenceKey" value={manualSubmission?.referenceKey ?? ""} />
                        <input type="hidden" name="gateway" value={order.gateway} />
                        <input type="hidden" name="returnUrl" value="/admin/orders" />
                        <button type="submit" className="w-full rounded-full bg-[#22304a] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#182236]">
                          {order.gateway === "BANK_TRANSFER" ? "Mark completed" : "Sync paid"}
                        </button>
                      </form>
                    ) : order.status === "SUCCEEDED" || latestPayment?.status === "SUCCEEDED" ? (
                      <div className="rounded-full bg-[#effaf3] px-4 py-2 text-center text-xs font-semibold text-[#2f6b4b]">Completed</div>
                    ) : null}

                    {isStripeOrder ? (
                      <details className="rounded-2xl border border-[#b9d4ef] bg-[#f4f9ff] p-3">
                        <summary className="cursor-pointer text-xs font-semibold text-[#0f4d81]">Extend Stripe date</summary>
                        <form action={extendStripeOrderBillingFromOrder} className="mt-3 grid gap-2">
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="returnUrl" value="/admin/orders" />
                          <input name="months" type="number" min="1" max="12" defaultValue="1" className="rounded-xl border border-[#dce4ed] px-3 py-2 text-xs" aria-label="Months to extend" />
                          <input name="extensionNote" placeholder="Reason" className="rounded-xl border border-[#dce4ed] px-3 py-2 text-xs" />
                          <button className="rounded-full bg-[#0f4d81] px-4 py-2 text-xs font-semibold text-white">Apply extension</button>
                        </form>
                      </details>
                    ) : null}

                    <form action={resendCompletionEmail}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="returnUrl" value="/admin/orders" />
                      <button type="submit" className="w-full rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-xs font-semibold text-[#22304a] transition hover:bg-[#f6f8fb]">Resend email</button>
                    </form>

                    {["BANK_TRANSFER", "STRIPE", "PAYPAL"].includes(order.gateway) ? (
                      <details className="rounded-2xl border border-[#eadfce] bg-[#fffaf4] p-3">
                        <summary className="cursor-pointer text-xs font-semibold text-[#7a4d1a]">Adjust paid amount</summary>
                        <form action={adjustManualPaidAmount} className="mt-3 grid gap-2">
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="returnUrl" value="/admin/orders" />
                          <input name="manualPaidAmount" type="number" min="0" step="1" defaultValue={order.totalAmount} className="rounded-xl border border-[#d8c8b5] px-3 py-2 text-xs" aria-label="Recorded paid amount" />
                          <input name="manualPaidNote" defaultValue={manualPaidAmountAdjustment?.note ?? ""} placeholder="Note" className="rounded-xl border border-[#d8c8b5] px-3 py-2 text-xs" />
                          <button className="rounded-full bg-[#22304a] px-4 py-2 text-xs font-semibold text-white">Save record</button>
                        </form>
                      </details>
                    ) : null}

                    {manualSubmission ? (
                      <details className="rounded-2xl border border-[#e4ecf4] bg-white p-3">
                        <summary className="cursor-pointer text-xs font-semibold text-[#556274]">Manual proof</summary>
                        <div className="mt-3 space-y-1 text-[11px] leading-4 text-[#617184]">
                          <p><strong>Sender:</strong> {manualSubmission.senderName}</p>
                          <p><strong>Number:</strong> {manualSubmission.senderNumber}</p>
                          <p><strong>Reference:</strong> {manualSubmission.referenceKey}</p>
                          <p><strong>Notes:</strong> {manualSubmission.notes ?? "No notes"}</p>
                        </div>
                      </details>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}




