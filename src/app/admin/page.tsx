export const dynamic = "force-dynamic";

import Link from "next/link";

import { getAdminDashboardData } from "@/lib/admin/dashboard";

const ADMIN_MODULES = [
  {
    title: "Registrations",
    href: "/admin/registrations",
    description: "Track incoming enrollment drafts, child selections, pricing, and conversion status.",
  },
  {
    title: "Orders",
    href: "/admin/orders",
    description: "Review gateway state, recurring payment flow, and manual payment follow-ups.",
  },
  {
    title: "Students",
    href: "/admin/students",
    description: "See the current student roster, linked parents, and active programme access.",
  },
  {
    title: "Messages",
    href: "/admin/messages",
    description: "Manage new contact enquiries and the current inbox response queue.",
  },
  {
    title: "Scholarships",
    href: "/admin/scholarships",
    description: "Review support requests, requested discounts, and family context quickly.",
  },
  {
    title: "Programs",
    href: "/admin/programs",
    description: "Monitor live programme pricing, enrollments, schedules, and teaching assets.",
  },
] as const;

function badgeClasses(status: string) {
  switch (status) {
    case "SUCCEEDED":
    case "APPROVED":
    case "PAID":
    case "ACTIVE":
      return "bg-[#effaf3] text-[#2f6b4b]";
    case "PENDING":
    case "PENDING_PAYMENT":
    case "UNDER_REVIEW":
    case "PAYMENT_REVIEW":
    case "NEW":
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

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function AdminDashboardPage() {
  const {
    metrics,
    recentRegistrations,
    recentOrders,
    paymentReviewQueue,
    scholarshipQueue,
    latestStudents,
    contactInbox,
    programsSnapshot,
  } = await getAdminDashboardData();

  return (
    <div className="min-h-screen bg-[#f7f4eb] py-10">
      <div className="section-container space-y-8">
        <div className="rounded-[2rem] bg-[#22304a] px-6 py-8 text-white shadow-[0_24px_60px_rgba(34,48,74,0.22)] sm:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#f2c58f]">
            Gen-Mumins admin
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Operations dashboard
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-white/78">
            A central workspace for registrations, payments, scholarships, inbox activity,
            students, and programme delivery. This keeps the LMS operations flow together
            while we continue expanding the deeper teacher and parent tools.
          </p>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-[1.5rem] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#6d7785]">Total students</p>
            <p className="mt-2 text-3xl font-semibold text-[#22304a]">{metrics.totalStudents}</p>
          </div>
          <div className="rounded-[1.5rem] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#6d7785]">Active enrollments</p>
            <p className="mt-2 text-3xl font-semibold text-[#22304a]">{metrics.activeEnrollments}</p>
          </div>
          <div className="rounded-[1.5rem] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#6d7785]">Pending registrations</p>
            <p className="mt-2 text-3xl font-semibold text-[#22304a]">{metrics.pendingRegistrations}</p>
          </div>
          <div className="rounded-[1.5rem] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#6d7785]">Unread messages</p>
            <p className="mt-2 text-3xl font-semibold text-[#22304a]">{metrics.unreadMessages}</p>
          </div>
          <div className="rounded-[1.5rem] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#6d7785]">Active teachers</p>
            <p className="mt-2 text-3xl font-semibold text-[#22304a]">{metrics.activeTeachers}</p>
          </div>
          <div className="rounded-[1.5rem] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#6d7785]">Revenue</p>
            <p className="mt-2 text-3xl font-semibold text-[#22304a]">{formatMoney(metrics.revenueGbp, "GBP")}</p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ADMIN_MODULES.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="rounded-[1.6rem] border border-[#eadfce] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(34,48,74,0.08)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                Module
              </p>
              <h2 className="mt-3 text-xl font-semibold text-[#22304a]">{module.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#5f6b7a]">{module.description}</p>
              <span className="mt-4 inline-flex text-sm font-semibold text-[#2a76aa]">
                Open module
              </span>
            </Link>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.95fr]">
          <div className="rounded-[1.75rem] bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">
                  Registrations
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">
                  Latest incoming enrollments
                </h2>
              </div>
              <Link href="/admin/registrations" className="text-sm font-semibold text-[#2a76aa]">
                View all
              </Link>
            </div>

            <div className="space-y-4">
              {recentRegistrations.map((registration) => (
                <div key={registration.id} className="rounded-[1.25rem] border border-[#ece7de] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#22304a]">
                        {registration.parentFirstName} {registration.parentLastName}
                      </p>
                      <p className="mt-1 text-sm text-[#6d7785]">
                        {registration.parentEmail} · {registration.selectedCountryName ?? "Country pending"}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(registration.status)}`}>
                      {registration.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-[#5f6b7a]">
                    <span>{registration.students.length} child{registration.students.length === 1 ? "" : "ren"}</span>
                    <span>{registration.items.length} items</span>
                    <span>{registration.selectedCurrency} {registration.totalAmount}</span>
                    <span>{formatDate(registration.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.75rem] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">Payments</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Review queue</h2>
                </div>
                <Link href="/admin/orders" className="text-sm font-semibold text-[#2a76aa]">View all</Link>
              </div>
              <div className="mt-5 space-y-3">
                {paymentReviewQueue.length === 0 ? <p className="text-sm text-[#6d7785]">No payments are waiting for review.</p> : null}
                {paymentReviewQueue.map((payment) => (
                  <div key={payment.id} className="rounded-[1.25rem] border border-[#ece7de] px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[#22304a]">{payment.order?.orderNumber ?? "Order pending"}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(payment.status)}`}>{payment.status.replace(/_/g, " ")}</span>
                    </div>
                    <p className="mt-2 text-sm text-[#6d7785]">{payment.gateway} · {payment.currency} {payment.amount}</p>
                    <p className="mt-1 text-sm text-[#6d7785]">{payment.order?.parent.user.firstName} {payment.order?.parent.user.lastName}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">Scholarships</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Pending applications</h2>
                </div>
                <Link href="/admin/scholarships" className="text-sm font-semibold text-[#2a76aa]">View all</Link>
              </div>
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
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <div className="rounded-[1.75rem] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">Students</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Newest profiles</h2>
              </div>
              <Link href="/admin/students" className="text-sm font-semibold text-[#2a76aa]">View all</Link>
            </div>
            <div className="mt-5 space-y-3">
              {latestStudents.map((student) => (
                <div key={student.id} className="rounded-[1.25rem] border border-[#ece7de] px-4 py-4">
                  <p className="font-semibold text-[#22304a]">{student.displayName || `${student.user.firstName} ${student.user.lastName}`}</p>
                  <p className="mt-1 text-sm text-[#6d7785]">{student.user.email}</p>
                  <p className="mt-2 text-sm text-[#6d7785]">{student.enrollments.length} active program{student.enrollments.length === 1 ? "" : "s"}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">Messages</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Inbox activity</h2>
              </div>
              <Link href="/admin/messages" className="text-sm font-semibold text-[#2a76aa]">View all</Link>
            </div>
            <div className="mt-5 space-y-3">
              {contactInbox.map((message) => (
                <div key={message.id} className="rounded-[1.25rem] border border-[#ece7de] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[#22304a]">{message.name}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(message.status)}`}>{message.status}</span>
                  </div>
                  <p className="mt-1 text-sm text-[#6d7785]">{message.email}</p>
                  <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">{message.subject || "General enquiry"}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">Programs</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Live catalog</h2>
              </div>
              <Link href="/admin/programs" className="text-sm font-semibold text-[#2a76aa]">View all</Link>
            </div>
            <div className="mt-5 space-y-3">
              {programsSnapshot.map((program) => (
                <div key={program.id} className="rounded-[1.25rem] border border-[#ece7de] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[#22304a]">{program.title}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(program.status)}`}>{program.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#6d7785]">Enrollments: {program._count.enrollments} · Schedules: {program._count.schedules}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#c27a2c]">Orders</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Latest successful and pending orders</h2>
            </div>
            <Link href="/admin/orders" className="text-sm font-semibold text-[#2a76aa]">View all</Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {recentOrders.map((order) => (
              <div key={order.id} className="rounded-[1.25rem] border border-[#ece7de] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[#22304a]">{order.orderNumber}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(order.status)}`}>{order.status}</span>
                </div>
                <p className="mt-2 text-sm text-[#6d7785]">{order.parent.user.firstName} {order.parent.user.lastName}</p>
                <p className="mt-1 text-sm text-[#6d7785]">{order.currency} {order.totalAmount}</p>
                <p className="mt-1 text-sm text-[#6d7785]">{formatDate(order.createdAt)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
