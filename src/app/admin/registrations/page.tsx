export const dynamic = "force-dynamic";

import { db } from "@/lib/db";

function statusClass(status: string) {
  if (["PAID", "CONVERTED"].includes(status)) return "bg-[#effaf3] text-[#2f6b4b]";
  if (["PAYMENT_REVIEW", "PENDING_PAYMENT", "SUBMITTED", "DRAFT"].includes(status)) return "bg-[#fff7eb] text-[#8a6326]";
  return "bg-[#eef2f6] text-[#556274]";
}

export default async function AdminRegistrationsPage() {
  const registrations = await db.registration.findMany({
    orderBy: { createdAt: "desc" },
    take: 24,
    include: {
      students: true,
      items: { include: { offer: true } },
    },
  });

  return (
    <div className="min-h-screen bg-[#f7f4eb] py-10">
      <div className="section-container space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Admin / Registrations</p>
          <h1 className="mt-2 text-4xl font-semibold text-[#22304a]">Registration queue</h1>
          <p className="mt-3 max-w-3xl text-base leading-8 text-[#5f6b7a]">Incoming Gen-Mumins registrations, student counts, totals, and progress state.</p>
        </div>

        <div className="grid gap-4">
          {registrations.map((registration) => (
            <div key={registration.id} className="rounded-[1.6rem] border border-[#eadfce] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#22304a]">{registration.parentFirstName} {registration.parentLastName}</h2>
                  <p className="mt-1 text-sm text-[#6d7785]">{registration.parentEmail} · {registration.selectedCountryName ?? "No country"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(registration.status)}`}>{registration.status.replace(/_/g, " ")}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#556274]">
                <span>{registration.students.length} children</span>
                <span>{registration.items.length} items</span>
                <span>{registration.selectedCurrency} {registration.totalAmount}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {registration.items.map((item) => (
                  <span key={item.id} className="rounded-full bg-[#fbf6ef] px-3 py-1 text-xs font-medium text-[#4d5a6b]">
                    {item.offer?.title ?? "Offer"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
