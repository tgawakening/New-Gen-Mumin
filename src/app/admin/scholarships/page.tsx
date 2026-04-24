export const dynamic = "force-dynamic";

import { db } from "@/lib/db";

function statusClass(status: string) {
  if (status === "APPROVED") return "bg-[#effaf3] text-[#2f6b4b]";
  if (status === "PENDING") return "bg-[#fff7eb] text-[#8a6326]";
  if (status === "REJECTED") return "bg-[#fff4f4] text-[#a23c3c]";
  return "bg-[#eef2f6] text-[#556274]";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function AdminScholarshipsPage() {
  const applications = await db.scholarshipApplication.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      offer: true,
    },
  });

  return (
    <div className="min-h-screen bg-[#f7f4eb] py-10">
      <div className="section-container space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Admin / Scholarships</p>
          <h1 className="mt-2 text-4xl font-semibold text-[#22304a]">Scholarship review</h1>
          <p className="mt-3 max-w-3xl text-base leading-8 text-[#5f6b7a]">
            Review support requests, requested discount levels, and parent context before approval or rejection.
          </p>
        </div>

        <div className="grid gap-4">
          {applications.map((application) => (
            <div key={application.id} className="rounded-[1.6rem] border border-[#eadfce] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#22304a]">{application.parentName}</h2>
                  <p className="mt-1 text-sm text-[#6d7785]">{application.parentEmail} · {application.parentWhatsapp ?? "No WhatsApp"}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(application.status)}`}>
                  {application.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-[#556274] md:grid-cols-4">
                <span>Offer: {application.offer?.title ?? "General support"}</span>
                <span>Requested: {application.requestedPercent}%</span>
                <span>Country: {application.childCountry ?? "Not provided"}</span>
                <span>Applied: {formatDate(application.createdAt)}</span>
              </div>

              {application.reasonForSupport ? (
                <p className="mt-4 text-sm leading-7 text-[#556274]">{application.reasonForSupport}</p>
              ) : null}

              {application.supportingDetails ? (
                <div className="mt-4 rounded-[1.1rem] bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#556274]">
                  {application.supportingDetails}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
