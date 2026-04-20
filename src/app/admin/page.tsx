export const dynamic = "force-dynamic";

import { getAdminDashboardData } from "@/lib/admin/dashboard";

function badgeClasses(status: string) {
  switch (status) {
    case "SUCCEEDED":
    case "APPROVED":
    case "PAID":
      return "bg-[#effaf3] text-[#2f6b4b]";
    case "PENDING":
    case "PENDING_PAYMENT":
    case "UNDER_REVIEW":
    case "PAYMENT_REVIEW":
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
  }).format(value);
}

export default async function AdminDashboardPage() {
  const { metrics, recentRegistrations, paymentReviewQueue, scholarshipQueue } = await getAdminDashboardData();

  return (
    <div className="bg-[#f7f4eb] py-10">
      <div className="section-container space-y-8">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Admin Dashboard</p>
          <h1 className="text-4xl font-semibold tracking-tight text-[#22304a]">Registration, payment, and scholarship review</h1>
          <p className="max-w-3xl text-base leading-8 text-[#5f6b7a]">
            This dashboard gives the team one place to monitor incoming registrations, manual payment review, and pending scholarship decisions.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[1.5rem] bg-white p-5 shadow-sm"><p className="text-sm text-[#6d7785]">Total students</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{metrics.totalStudents}</p></div>
          <div className="rounded-[1.5rem] bg-white p-5 shadow-sm"><p className="text-sm text-[#6d7785]">Active enrollments</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{metrics.activeEnrollments}</p></div>
          <div className="rounded-[1.5rem] bg-white p-5 shadow-sm"><p className="text-sm text-[#6d7785]">Pending registrations</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{metrics.pendingRegistrations}</p></div>
          <div className="rounded-[1.5rem] bg-white p-5 shadow-sm"><p className="text-sm text-[#6d7785]">Unread messages</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{metrics.unreadMessages}</p></div>
          <div className="rounded-[1.5rem] bg-white p-5 shadow-sm"><p className="text-sm text-[#6d7785]">Revenue (GBP)</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">£{metrics.revenueGbp}</p></div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.95fr]">
          <div className="rounded-[1.75rem] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">Registrations</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Latest incoming enrollments</h2>
              </div>
            </div>

            <div className="space-y-4">
              {recentRegistrations.map((registration) => (
                <div key={registration.id} className="rounded-[1.25rem] border border-[#ece7de] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#22304a]">{registration.parentFirstName} {registration.parentLastName}</p>
                      <p className="mt-1 text-sm text-[#6d7785]">{registration.parentEmail} · {registration.selectedCountryName ?? "Country pending"}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(registration.status)}`}>{registration.status.replace(/_/g, " ")}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-[#5f6b7a]">
                    <span>{registration.students.length} child{registration.students.length === 1 ? "" : "ren"}</span>
                    <span>{registration.items.length} items</span>
                    <span>{registration.selectedCurrency} {registration.totalAmount}</span>
                    <span>{formatDate(registration.createdAt)}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {registration.items.map((item) => (
                      <span key={item.id} className="rounded-full bg-[#f5f2ed] px-3 py-1 text-xs font-medium text-[#556274]">
                        {item.offer?.title ?? "Offer"}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.75rem] bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">Payments</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Review queue</h2>
              <div className="mt-5 space-y-3">
                {paymentReviewQueue.length === 0 ? <p className="text-sm text-[#6d7785]">No payments are waiting for review.</p> : null}
                {paymentReviewQueue.map((payment) => (
                  <div key={payment.id} className="rounded-[1.25rem] border border-[#ece7de] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[#22304a]">{payment.order?.orderNumber ?? "Order pending"}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(payment.status)}`}>{payment.status.replace(/_/g, " ")}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#6d7785]">{payment.gateway} · {payment.currency} {payment.amount}</p>
                    <p className="mt-1 text-sm text-[#6d7785]">{payment.order?.parent.user.firstName} {payment.order?.parent.user.lastName} · {payment.order?.parent.user.email}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">Scholarships</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Pending applications</h2>
              <div className="mt-5 space-y-3">
                {scholarshipQueue.length === 0 ? <p className="text-sm text-[#6d7785]">No scholarship applications are waiting right now.</p> : null}
                {scholarshipQueue.map((application) => (
                  <div key={application.id} className="rounded-[1.25rem] border border-[#ece7de] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[#22304a]">{application.parentName}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(application.status)}`}>{application.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#6d7785]">{application.parentEmail} · {application.parentWhatsapp ?? "No WhatsApp"}</p>
                    <p className="mt-1 text-sm text-[#6d7785]">Requested {application.requestedPercent}% · {application.offer?.title ?? "General support"}</p>
                    <p className="mt-3 text-sm leading-6 text-[#556274]">{application.reasonForSupport ?? "No reason submitted."}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


