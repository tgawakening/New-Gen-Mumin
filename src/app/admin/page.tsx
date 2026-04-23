export const dynamic = "force-dynamic";

import { getAdminDashboardData } from "@/lib/admin/dashboard";

const ADMIN_SECTIONS = [
  "Analytics Dashboard",
  "Reports",
  "Students",
  "Teachers",
  "Programs",
  "Schedule",
  "Terms",
  "Enrollments",
  "Registrations",
  "Attendance",
  "Lesson Log",
  "Planner",
  "Messages",
  "Orders",
  "Settings",
  "Demo",
] as const;

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

function sectionDescription(section: string) {
  switch (section) {
    case "Registrations":
      return "Incoming inquiries, status progression, contact info, and conversion into paid enrollments will live here.";
    case "Orders":
      return "Transactions, gateway status, manual review states, and subscription visibility will live here.";
    case "Students":
      return "Search, parent association, enrollment history, attendance trends, and student progression will live here.";
    case "Teachers":
      return "Teacher directory, assignments, workload, and classroom availability management will live here.";
    case "Programs":
      return "Programme CRUD, pricing rules, bundles, and active/inactive configuration will live here.";
    case "Schedule":
      return "Class scheduling, Zoom/Meet linkage, and recurring weekly timetable control will live here.";
    case "Terms":
      return "Academic terms, active calendars, and term switching will live here.";
    case "Attendance":
      return "Programme-based attendance monitoring and follow-up actions will live here.";
    case "Lesson Log":
      return "Post-lesson summaries, teaching notes, and topic tracking will live here.";
    case "Planner":
      return "Upcoming classes, resource coordination, and weekly delivery planning will live here.";
    case "Messages":
      return "Contact form submissions, responses, and inbox status management will live here.";
    case "Reports":
      return "Revenue analytics, programme performance, and engagement reporting will live here.";
    case "Settings":
      return "System, email, payment, and operational configuration will live here.";
    case "Demo":
      return "Preview states, safe testing flows, and QA toggles will live here.";
    case "Enrollments":
      return "Pending, confirmed, active, completed, and cancelled enrollments will live here.";
    case "Analytics Dashboard":
      return "Headline KPIs, revenue, student growth, and registration health will live here.";
    default:
      return "This module will be expanded as the operations suite grows.";
  }
}

export default async function AdminDashboardPage() {
  const { metrics, recentRegistrations, paymentReviewQueue, scholarshipQueue } =
    await getAdminDashboardData();

  return (
    <div className="min-h-screen bg-[#f7f4eb] py-10">
      <div className="section-container grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div className="rounded-[28px] bg-[#22304a] p-6 text-white shadow-[0_22px_58px_rgba(34,48,74,0.24)]">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#f2c58f]">
              Admin control centre
            </p>
            <h2 className="mt-3 text-2xl font-semibold">Gen-Mumins ops</h2>
            <div className="mt-5 space-y-2">
              {ADMIN_SECTIONS.map((section) => (
                <a
                  key={section}
                  href={`#${section.toLowerCase().replace(/\s+/g, "-")}`}
                  className="block rounded-2xl bg-white/8 px-4 py-3 text-sm text-white/90 transition hover:bg-white/12"
                >
                  {section}
                </a>
              ))}
            </div>
          </div>
        </aside>

        <div className="space-y-8">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
              Admin Dashboard
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-[#22304a]">
              Registration, payment, and scholarship review
            </h1>
            <p className="max-w-3xl text-base leading-8 text-[#5f6b7a]">
              This dashboard is being shaped into the full Gen-Mumins operations suite,
              covering registrations, payments, students, scheduling, teacher management,
              and reporting in one theme-consistent workspace.
            </p>
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-[1.5rem] bg-white p-5 shadow-sm"><p className="text-sm text-[#6d7785]">Total students</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{metrics.totalStudents}</p></div>
            <div className="rounded-[1.5rem] bg-white p-5 shadow-sm"><p className="text-sm text-[#6d7785]">Active enrollments</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{metrics.activeEnrollments}</p></div>
            <div className="rounded-[1.5rem] bg-white p-5 shadow-sm"><p className="text-sm text-[#6d7785]">Pending registrations</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{metrics.pendingRegistrations}</p></div>
            <div className="rounded-[1.5rem] bg-white p-5 shadow-sm"><p className="text-sm text-[#6d7785]">Unread messages</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">{metrics.unreadMessages}</p></div>
            <div className="rounded-[1.5rem] bg-white p-5 shadow-sm"><p className="text-sm text-[#6d7785]">Revenue (GBP)</p><p className="mt-2 text-3xl font-semibold text-[#22304a]">£{metrics.revenueGbp}</p></div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {ADMIN_SECTIONS.map((section) => (
              <div
                key={section}
                id={section.toLowerCase().replace(/\s+/g, "-")}
                className="rounded-[1.6rem] border border-[#eadfce] bg-white p-5 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                  Section
                </p>
                <h2 className="mt-3 text-xl font-semibold text-[#22304a]">{section}</h2>
                <p className="mt-3 text-sm leading-7 text-[#5f6b7a]">
                  {sectionDescription(section)}
                </p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.3fr_0.95fr]">
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
    </div>
  );
}
