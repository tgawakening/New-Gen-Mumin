export const dynamic = "force-dynamic";

import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Eye } from "lucide-react";

import { AdminLoginModal } from "@/components/admin/AdminLoginModal";
import { AdminLogoutButton } from "@/components/admin/AdminLogoutButton";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getAdminDashboardData, type AdminDashboardFilters } from "@/lib/admin/dashboard";
import {
  markOrderCancelled,
  markOrderPaid,
  resendOrderCompletionEmails,
} from "@/lib/payments/fulfillment";

type AdminDashboardData = Awaited<ReturnType<typeof getAdminDashboardData>>;
type RecentRegistration = AdminDashboardData["recentRegistrations"][number];

type PageProps = {
  searchParams?: Promise<{
    tab?: string;
    orderStatus?: string;
    orderPayment?: string;
    orderProgram?: string;
    orderPricing?: string;
    studentPayment?: string;
    studentRegistrationStatus?: string;
    studentProgram?: string;
    studentPricing?: string;
    notice?: string;
    tone?: string;
  }>;
};

const TABS = [
  { key: "home", label: "Home" },
  { key: "orders", label: "Orders" },
  { key: "students", label: "Students" },
  { key: "fee-waivers", label: "Fee Waivers" },
] as const;

function badgeClasses(status: string) {
  switch (status) {
    case "SUCCEEDED":
    case "APPROVED":
    case "PAID":
    case "ACTIVE":
    case "COMPLETED":
      return "bg-[#effaf3] text-[#2f6b4b]";
    case "PENDING":
    case "PENDING_PAYMENT":
    case "UNDER_REVIEW":
    case "PAYMENT_REVIEW":
    case "NEW":
    case "INITIATED":
      return "bg-[#fff7eb] text-[#8a6326]";
    case "REJECTED":
    case "FAILED":
    case "CANCELLED":
      return "bg-[#fff4f4] text-[#a23c3c]";
    default:
      return "bg-[#eef2f6] text-[#556274]";
  }
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPersonName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName === "Parent" ? "" : lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function parseRegistrationNotes(notes?: string | null) {
  if (!notes) return [];

  return notes
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [label, ...rest] = entry.split(":");
      return {
        label: label.trim(),
        value: rest.join(":").trim() || entry,
      };
    });
}

function RegistrationDetailsPopup({ registration }: { registration: RecentRegistration }) {
  const parentName = formatPersonName(registration.parentFirstName, registration.parentLastName) || "Parent pending";
  const notes = parseRegistrationNotes(registration.notes);

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-[#cbd9e8] bg-white px-3 py-2 text-xs font-semibold text-[#22304a] transition hover:bg-[#f5f8fb] [&::-webkit-details-marker]:hidden">
        <Eye className="h-4 w-4" />
        View details
      </summary>
      <summary className="fixed right-6 top-6 z-[60] hidden cursor-pointer rounded-full bg-[#0f4d81] px-4 py-2 text-sm font-semibold text-white shadow-lg group-open:block [&::-webkit-details-marker]:hidden">
        Close
      </summary>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#132238]/55 px-4 py-6">
        <div className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e6edf4] pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f7d8f]">Registration details</p>
              <h3 className="mt-2 text-2xl font-semibold text-[#22304a]">{parentName}</h3>
              <p className="mt-1 text-sm text-[#617184]">{registration.parentEmail}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DetailBlock label="Phone" value={`${registration.phoneCountryCode ?? ""} ${registration.phoneNumber ?? "Pending"}`.trim()} />
            <DetailBlock label="Country" value={registration.selectedCountryName ?? "Pending"} />
            <DetailBlock label="Status" value={registration.status.replace(/_/g, " ")} />
            <DetailBlock label="Total" value={formatMoney(registration.totalAmount, registration.selectedCurrency)} />
          </div>

          <div className="mt-5 rounded-[20px] border border-[#e6edf4] bg-[#fbfdff] p-4">
            <p className="font-semibold text-[#22304a]">Children ({registration.students.length})</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {registration.students.map((child) => (
                <div key={child.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-[#22304a]">
                  <p className="font-semibold">{formatPersonName(child.firstName, child.lastName) || child.displayName || "Unnamed child"}</p>
                  <p className="mt-1 text-[#617184]">Age {child.age ?? "Pending"}{child.gender ? ` - ${child.gender}` : ""}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-[20px] border border-[#e6edf4] bg-[#fbfdff] p-4">
            <p className="font-semibold text-[#22304a]">Programmes</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {registration.items.map((item) => (
                <div key={item.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-[#22304a]">
                  <p className="font-semibold">{item.offer?.title ?? "Offer"}</p>
                  <p className="mt-1 text-[#617184]">
                    {formatMoney(item.finalAmount, item.currency)}
                    {item.discountAmount > 0 ? ` after ${formatMoney(item.discountAmount, item.currency)} discount` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {notes.length ? (
            <div className="mt-5 rounded-[20px] border border-[#e6edf4] bg-[#fbfdff] p-4">
              <p className="font-semibold text-[#22304a]">Form answers</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {notes.map((note) => (
                  <DetailBlock key={`${note.label}-${note.value}`} label={note.label} value={note.value} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e6edf4] bg-white px-4 py-3 text-sm">
      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">{label}</p>
      <p className="mt-1 text-[#22304a]">{value || "Pending"}</p>
    </div>
  );
}

function ChildDetailsList({
  children,
}: {
  children: Array<{
    id: string;
    name: string;
    age: number | null;
    gender: string | null;
    programs: string[];
  }>;
}) {
  if (children.length === 0) {
    return <p className="mt-2 text-sm text-[#617184]">No children linked yet.</p>;
  }

  return (
    <div className="mt-2 space-y-2">
      {children.map((child) => (
        <div key={child.id} className="rounded-2xl border border-[#e6edf4] bg-white px-3 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-semibold text-[#22304a]">{child.name}</p>
              <p className="mt-1 text-xs text-[#617184]">
                Age {child.age ?? "Pending"}{child.gender ? ` - ${child.gender}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              {child.programs.length ? child.programs.map((program) => (
                <span key={program} className="rounded-full bg-[#eef6ff] px-3 py-1 text-[11px] font-semibold text-[#2a76aa]">
                  {program}
                </span>
              )) : (
                <span className="rounded-full bg-[#f2f4f7] px-3 py-1 text-[11px] font-semibold text-[#7a8698]">
                  Program pending
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function canMarkOrderPaid(order: {
  gateway: string;
  status: string;
  paymentStatus: string;
}) {
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

function canCancelOrder(order: {
  status: string;
}) {
  return !["FAILED", "CANCELLED"].includes(order.status);
}

function tabHref(
  tab: string,
  extra: Record<string, string | undefined> = {},
) {
  const params = new URLSearchParams();
  params.set("tab", tab);
  for (const [key, value] of Object.entries(extra)) {
    if (value && value !== "ALL") params.set(key, value);
  }
  return `/admin?${params.toString()}`;
}

function buildReturnHref(
  tab: string,
  extra: Record<string, string | undefined> = {},
) {
  return tabHref(tab, extra);
}

function NoticeBanner({ notice, tone }: { notice?: string; tone?: string }) {
  if (!notice) return null;

  const styles =
    tone === "error"
      ? "border-[#f0cccc] bg-[#fff4f4] text-[#a23c3c]"
      : "border-[#cfe9d8] bg-[#edf8ef] text-[#2f6b4b]";

  return (
    <div className={`rounded-[20px] border px-5 py-4 text-sm font-medium shadow-sm ${styles}`}>
      {notice}
    </div>
  );
}

export default async function AdminDashboardPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();

  if (!session || session.user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-[#f3f5f7] py-16">
        <div className="section-container">
          <div className="rounded-[32px] border border-[#e1d8cb] bg-white px-8 py-10 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
              Gen-Mumins Admin
            </p>
            <h1 className="mt-3 text-4xl font-semibold text-[#22304a]">Admin dashboard</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-[#5f6b7a]">
              A central workspace for registrations, payments, scholarships, inbox activity,
              students, and programme delivery.
            </p>
          </div>
        </div>
        <AdminLoginModal />
      </div>
    );
  }

  async function completeOrder(formData: FormData) {
    "use server";

    const orderId = String(formData.get("orderId") || "");
    const referenceKey = String(formData.get("referenceKey") || "");
    const gateway = String(formData.get("gateway") || "BANK_TRANSFER");
    const returnUrl = String(formData.get("returnUrl") || "/admin?tab=orders");
    if (!orderId) return;

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

      revalidatePath("/admin");
      revalidatePath("/parent");
      revalidatePath("/student");
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Order completed successfully&tone=success`);
    } catch {
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Unable to complete this order right now&tone=error`);
    }
  }

  async function cancelOrder(formData: FormData) {
    "use server";
    const orderId = String(formData.get("orderId") || "");
    const returnUrl = String(formData.get("returnUrl") || "/admin?tab=orders");
    if (!orderId) return;

    try {
      await markOrderCancelled(orderId);
      revalidatePath("/admin");
      revalidatePath("/parent");
      revalidatePath("/student");
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Order cancelled successfully&tone=success`);
    } catch {
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Unable to cancel this order right now&tone=error`);
    }
  }

  async function deleteStudent(formData: FormData) {
    "use server";
    const userId = String(formData.get("userId") || "");
    const returnUrl = String(formData.get("returnUrl") || "/admin?tab=students");
    if (!userId) return;

    try {
      await db.user.delete({ where: { id: userId } });
      revalidatePath("/admin");
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Student deleted successfully&tone=success`);
    } catch {
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Unable to delete this student right now&tone=error`);
    }
  }

  async function resendCompletionEmail(formData: FormData) {
    "use server";

    const orderId = String(formData.get("orderId") || "");
    const returnUrl = String(formData.get("returnUrl") || "/admin?tab=orders");
    if (!orderId) return;

    try {
      await resendOrderCompletionEmails(orderId);
      revalidatePath("/admin");
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Confirmation email sent successfully&tone=success`);
    } catch {
      redirect(`${returnUrl}${returnUrl.includes("?") ? "&" : "?"}notice=Unable to resend the confirmation email right now&tone=error`);
    }
  }

  const params = searchParams ? await searchParams : {};
  const activeTab = TABS.some((tab) => tab.key === params?.tab) ? params?.tab! : "home";

  const filters: AdminDashboardFilters = {
    orderStatus: params?.orderStatus,
    orderPayment: params?.orderPayment,
    orderProgram: params?.orderProgram,
    orderPricing: params?.orderPricing,
    studentPayment: params?.studentPayment,
    studentRegistrationStatus: params?.studentRegistrationStatus,
    studentProgram: params?.studentProgram,
    studentPricing: params?.studentPricing,
  };

  const data = await getAdminDashboardData(filters);
  const currentOrderHref = buildReturnHref("orders", {
    orderStatus: params?.orderStatus,
    orderPayment: params?.orderPayment,
    orderProgram: params?.orderProgram,
    orderPricing: params?.orderPricing,
  });
  const currentStudentHref = buildReturnHref("students", {
    studentPayment: params?.studentPayment,
    studentRegistrationStatus: params?.studentRegistrationStatus,
    studentProgram: params?.studentProgram,
    studentPricing: params?.studentPricing,
  });

  return (
    <div className="min-h-screen bg-[#edf2f6] py-6">
      <div className="section-container space-y-5">
        <NoticeBanner notice={params?.notice} tone={params?.tone} />
        <div className="rounded-[28px] border border-[#dce4ed] bg-white px-4 py-4 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="rounded-2xl bg-[#0f4d81] px-4 py-3 text-white">
                <p className="text-lg font-semibold">GM</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-[#22304a]">Gen-Mumins</p>
                <p className="text-sm text-[#647388]">Admin workspace</p>
              </div>
              <div className="flex flex-wrap gap-2 md:ml-6">
                {TABS.map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <Link
                      key={tab.key}
                      href={tabHref(tab.key)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "bg-[#0f4d81] text-white shadow-sm"
                          : "border border-[#d9e2eb] bg-white text-[#22304a] hover:bg-[#f5f8fb]"
                      }`}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={tabHref(activeTab)}
                className="rounded-full border border-[#d9c7b1] bg-white px-4 py-2 text-sm font-semibold text-[#22304a] transition hover:bg-[#fff7ef]"
              >
                Refresh
              </Link>
              <div className="rounded-full border border-[#d9e2eb] bg-white px-4 py-2 text-sm text-[#22304a]">
                <span className="font-semibold">TGA Admin</span>
                <span className="ml-2 text-[#67778d]">tgawakening786@gmail.com</span>
              </div>
              <AdminLogoutButton />
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6f7d8f]">
            Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#22304a]">
            {activeTab === "home"
              ? "Overview"
              : activeTab === "orders"
                ? "Orders"
                : activeTab === "students"
                  ? "Students"
                  : "Fee Waivers"}
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-7 text-[#617184]">
            A central workspace for registrations, payments, scholarships, inbox activity,
            students, and programme delivery.
          </p>
        </div>

        {activeTab === "home" ? (
          <div className="space-y-5">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard label="Total Students" value={String(data.metrics.totalStudents)} />
              <MetricCard label="Active Enrollments" value={String(data.metrics.activeEnrollments)} />
              <MetricCard label="Pending Registrations" value={String(data.metrics.pendingRegistrations)} />
              <MetricCard label="Unread Messages" value={String(data.metrics.unreadMessages)} />
              <MetricCard label="Revenue" value={formatMoney(data.metrics.revenueGbp, "GBP")} />
            </section>

            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold text-[#22304a]">Recent registrations</h2>
                <div className="mt-5 space-y-3">
                  {data.recentRegistrations.map((registration) => (
                    <div key={registration.id} className="rounded-[20px] border border-[#e6edf4] px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#22304a]">
                            {formatPersonName(registration.parentFirstName, registration.parentLastName) || "Parent pending"}
                          </p>
                          <p className="mt-1 text-sm text-[#6d7785]">
                            {registration.parentEmail} - {registration.selectedCountryName ?? "Country pending"}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <RegistrationDetailsPopup registration={registration} />
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(registration.status)}`}>
                            {registration.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 text-sm text-[#617184] md:grid-cols-[1fr_1fr_auto_auto]">
                        <span>
                          <span className="font-semibold text-[#22304a]">{registration.students.length} children:</span>{" "}
                          {registration.students
                            .map((child) => formatPersonName(child.firstName, child.lastName) || child.displayName || "Unnamed child")
                            .join(", ")}
                        </span>
                        <span>{registration.items.length} items</span>
                        <span>{registration.selectedCurrency} {registration.totalAmount}</span>
                        <span>{formatDate(registration.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold text-[#22304a]">Recent orders</h2>
                <div className="mt-5 space-y-3">
                  {data.orders.slice(0, 8).map((order) => (
                    <div key={order.id} className="rounded-[20px] border border-[#e6edf4] px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#22304a]">{order.orderNumber}</p>
                          <p className="mt-1 text-sm text-[#6d7785]">{order.parentName}</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(order.status)}`}>
                          {order.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-[#617184]">
                        <span>{order.gateway}</span>
                        <span>{formatMoney(order.totalAmount, order.currency)}</span>
                        <span>{order.pricingLabel}</span>
                        {order.couponCode ? (
                          <span className="rounded-full bg-[#edf8ef] px-3 py-1 text-xs font-semibold text-[#2f6b4b]">
                            {order.couponCode}{order.couponDiscountPercent ? ` (${order.couponDiscountPercent}% off)` : ""}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {activeTab === "orders" ? (
          <section className="space-y-5 rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
            <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input type="hidden" name="tab" value="orders" />
              <FilterSelect name="orderStatus" defaultValue={params?.orderStatus ?? "ALL"} options={["ALL", "SUCCEEDED", "PENDING", "UNDER_REVIEW", "FAILED"]} />
              <FilterSelect name="orderPayment" defaultValue={params?.orderPayment ?? "ALL"} options={["ALL", "STRIPE", "PAYPAL", "BANK_TRANSFER"]} />
              <FilterSelect name="orderProgram" defaultValue={params?.orderProgram ?? "ALL"} options={["ALL", ...data.filterOptions.orderPrograms]} />
              <FilterSelect name="orderPricing" defaultValue={params?.orderPricing ?? "ALL"} options={["ALL", "Full", "Discounted"]} />
              <button className="rounded-full bg-[#0f4d81] px-5 py-3 text-sm font-semibold text-white xl:col-span-4 xl:justify-self-start">
                Apply filters
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/api/admin/orders/export"
                className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a] transition hover:bg-[#f5f8fb]"
              >
                Export completed orders CSV
              </Link>
            </div>

            <div className="space-y-4">
              {data.orders.map((order) => (
                <div key={order.id} className="rounded-[20px] border border-[#dce4ed] bg-[#fbfdff] p-5">
                  <div className="grid gap-4 xl:grid-cols-[0.95fr_1.35fr_0.7fr_0.8fr_0.7fr_0.7fr]">
                    <div>
                      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">Parent</p>
                      <p className="mt-2 font-semibold text-[#22304a]">{order.parentName || "Parent pending"}</p>
                      <p className="mt-1 text-sm text-[#617184]">{order.parentEmail}</p>
                      <p className="mt-1 text-sm text-[#617184]">{order.phone}</p>
                      <p className="mt-2 text-sm text-[#22304a]">{order.orderNumber}</p>
                    </div>
                    <div className="text-sm text-[#22304a]">
                      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">Children: {order.childCount || order.childDetails.length}</p>
                      <ChildDetailsList children={order.childDetails} />
                    </div>
                    <div className="text-sm text-[#22304a]">
                      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">Amount</p>
                      <p className="mt-2">{formatMoney(order.totalAmount, order.currency)}</p>
                      <p className="mt-2 text-[#617184]">{order.pricingLabel}</p>
                      {order.discountAmount > 0 ? (
                        <p className="mt-1 text-[#617184]">Saved {formatMoney(order.discountAmount, order.currency)}</p>
                      ) : null}
                      {order.couponCode ? (
                        <p className="mt-1 text-[#2f6b4b]">
                          Coupon {order.couponCode}
                          {order.couponDiscountPercent ? ` - ${order.couponDiscountPercent}% off` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-sm text-[#22304a]">
                      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">Payment</p>
                      <p className="mt-2">{order.gateway}</p>
                      <p className="mt-1 text-[#617184]">{order.paymentStatus.replace(/_/g, " ")}</p>
                      <p className="mt-1 text-[#617184]">{order.finalAmountLabel}</p>
                    </div>
                    <div className="text-sm text-[#22304a]">
                      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">Status</p>
                      <div className="mt-2 flex flex-col gap-2">
                        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(order.status)}`}>
                          {order.status.replace(/_/g, " ")}
                        </span>
                        <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(order.registrationStatus)}`}>
                          Reg: {order.registrationStatus.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">Actions</p>
                      {canMarkOrderPaid(order) ? (
                        <form action={completeOrder}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input
                            type="hidden"
                            name="referenceKey"
                            value={order.manualSubmission?.referenceKey ?? ""}
                          />
                          <input type="hidden" name="gateway" value={order.gateway} />
                          <input type="hidden" name="returnUrl" value={currentOrderHref} />
                          <button className="w-full rounded-full bg-[#0f4d81] px-4 py-2 text-sm font-semibold text-white">
                            {order.status === "SUCCEEDED"
                              ? "Sync payment completed"
                              : order.gateway === "BANK_TRANSFER"
                                ? "Complete"
                                : "Mark paid"}
                          </button>
                        </form>
                        ) : order.paymentStatus === "SUCCEEDED" || order.status === "SUCCEEDED" ? (
                          <div className="space-y-2">
                            <div className="w-full rounded-full bg-[#effaf3] px-4 py-2 text-center text-sm font-semibold text-[#2f6b4b]">
                              Completed
                            </div>
                            <form action={resendCompletionEmail}>
                              <input type="hidden" name="orderId" value={order.id} />
                              <input type="hidden" name="returnUrl" value={currentOrderHref} />
                              <button className="w-full rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">
                                Resend confirmation
                              </button>
                            </form>
                          </div>
                        ) : (
                          <div className="w-full rounded-full bg-[#f2f4f7] px-4 py-2 text-center text-sm font-semibold text-[#7a8698]">
                            Awaiting action
                          </div>
                        )}
                      {canCancelOrder(order) ? (
                        <form action={cancelOrder}>
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="returnUrl" value={currentOrderHref} />
                          <button className="w-full rounded-full border border-[#efb3b3] bg-white px-4 py-2 text-sm font-semibold text-[#b24646]">
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <div className="w-full rounded-full border border-[#e6e9ee] bg-[#f8fafc] px-4 py-2 text-center text-sm font-semibold text-[#8a94a3]">
                          Cancelled
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "students" ? (
          <section className="space-y-5 rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
            <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <input type="hidden" name="tab" value="students" />
              <FilterSelect name="studentPayment" defaultValue={params?.studentPayment ?? "ALL"} options={["ALL", "STRIPE", "PAYPAL", "BANK_TRANSFER", "Pending"]} />
              <FilterSelect name="studentRegistrationStatus" defaultValue={params?.studentRegistrationStatus ?? "ALL"} options={["ALL", "PAID", "PENDING_PAYMENT", "SUBMITTED", "PAYMENT_REVIEW", "Pending"]} />
              <FilterSelect name="studentProgram" defaultValue={params?.studentProgram ?? "ALL"} options={["ALL", ...data.filterOptions.studentPrograms]} />
              <FilterSelect name="studentPricing" defaultValue={params?.studentPricing ?? "ALL"} options={["ALL", "Full", "Discounted"]} />
              <button className="rounded-full bg-[#0f4d81] px-5 py-3 text-sm font-semibold text-white xl:col-span-4 xl:justify-self-start">
                Apply filters
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/registration"
                className="rounded-full bg-[#0f4d81] px-4 py-2 text-sm font-semibold text-white"
              >
                Add student manually
              </Link>
              <Link
                href="/api/admin/orders/export"
                className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a] transition hover:bg-[#f5f8fb]"
              >
                Export completed orders CSV
              </Link>
            </div>

            <div className="space-y-4">
              {data.students.map((student) => (
                <div key={student.id} className="rounded-[20px] border border-[#dce4ed] bg-[#fbfdff] p-5">
                  <div className="grid gap-4 xl:grid-cols-[0.95fr_1.35fr_0.8fr_0.75fr]">
                    <div className="text-sm text-[#22304a]">
                      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">Parent</p>
                      <p className="mt-2">{student.parentName}</p>
                      <p className="mt-1 text-[#617184]">{student.email}</p>
                      <p className="mt-1 text-[#617184]">{student.phone}</p>
                    </div>
                    <div className="text-sm text-[#22304a]">
                      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">Children: {student.childCount}</p>
                      <ChildDetailsList children={student.childDetails} />
                    </div>
                    <div className="text-sm text-[#22304a]">
                      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">Payment</p>
                      <p className="mt-2">{student.paymentGateway}</p>
                      <p className="mt-2 text-[#617184]">{student.pricingLabel}</p>
                      {student.totalAmount && student.currency ? (
                        <p className="mt-1 text-[#617184]">
                          Final {formatMoney(student.totalAmount, student.currency)}
                        </p>
                      ) : null}
                      {student.couponCode ? (
                        <p className="mt-1 text-[#2f6b4b]">
                          Coupon {student.couponCode}
                          {student.couponDiscountPercent ? ` - ${student.couponDiscountPercent}% off` : ""}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">Registration</p>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(student.registrationStatus)}`}>
                        {student.registrationStatus.replace(/_/g, " ")}
                      </span>
                      <p className="pt-2 font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">Actions</p>
                      <form action={deleteStudent}>
                        <input type="hidden" name="userId" value={student.userId} />
                        <input type="hidden" name="returnUrl" value={currentStudentHref} />
                        <button className="w-full rounded-full border border-[#efb3b3] bg-white px-4 py-2 text-sm font-semibold text-[#b24646]">
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === "fee-waivers" ? (
          <section className="space-y-4 rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
            {data.feeWaiverApplications.map((application) => (
              <div key={application.id} className="rounded-[20px] border border-[#dce4ed] bg-[#fbfdff] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#22304a]">{application.parentName}</p>
                    <p className="mt-1 text-sm text-[#617184]">{application.parentEmail}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(application.status)}`}>
                    {application.status}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-[#22304a]">
                  <p>Requested: {application.requestedPercent}%</p>
                  <p>Offer: {application.offer?.title ?? "General support"}</p>
                  <p>WhatsApp: {application.parentWhatsapp ?? "Pending"}</p>
                </div>
                <p className="mt-3 text-sm leading-7 text-[#617184]">
                  {application.reasonForSupport ?? "No fee waiver reason added yet."}
                </p>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-[#dce4ed] bg-white p-5 shadow-sm">
      <p className="text-sm text-[#6d7785]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[#22304a]">{value}</p>
    </div>
  );
}

function FilterSelect({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue: string;
  options: string[];
}) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      className="rounded-2xl border border-[#dce4ed] bg-white px-4 py-3 text-sm text-[#22304a] outline-none"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option === "ALL" ? `All ${name.toLowerCase()}` : option}
        </option>
      ))}
    </select>
  );
}
