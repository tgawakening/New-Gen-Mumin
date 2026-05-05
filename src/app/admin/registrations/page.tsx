export const dynamic = "force-dynamic";

import { Eye } from "lucide-react";
import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

type RegistrationRow = Prisma.RegistrationGetPayload<{
  include: {
    students: true;
    items: { include: { offer: true } };
  };
}>;

function statusClass(status: string) {
  if (["PAID", "CONVERTED"].includes(status)) return "bg-[#effaf3] text-[#2f6b4b]";
  if (["PAYMENT_REVIEW", "PENDING_PAYMENT", "SUBMITTED", "DRAFT"].includes(status)) return "bg-[#fff7eb] text-[#8a6326]";
  return "bg-[#eef2f6] text-[#556274]";
}

function formatPersonName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName === "Parent" ? "" : lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
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

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#eadfce] bg-white px-4 py-3 text-sm">
      <p className="font-semibold uppercase tracking-[0.12em] text-[#8a7a68]">{label}</p>
      <p className="mt-1 text-[#22304a]">{value || "Pending"}</p>
    </div>
  );
}

function RegistrationDetailsPopup({ registration }: { registration: RegistrationRow }) {
  const parentName = formatPersonName(registration.parentFirstName, registration.parentLastName) || "Parent pending";
  const notes = parseRegistrationNotes(registration.notes);

  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-[#d8c8b5] bg-white px-3 py-2 text-xs font-semibold text-[#22304a] transition hover:bg-[#fff8ef] [&::-webkit-details-marker]:hidden">
        <Eye className="h-4 w-4" />
        View details
      </summary>
      <summary className="fixed right-6 top-6 z-[60] hidden cursor-pointer rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white shadow-lg group-open:block [&::-webkit-details-marker]:hidden">
        Close
      </summary>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#132238]/55 px-4 py-6">
        <div className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-[28px] border border-[#eadfce] bg-white p-6 shadow-2xl">
          <div className="border-b border-[#eadfce] pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a7a68]">Registration details</p>
            <h3 className="mt-2 text-2xl font-semibold text-[#22304a]">{parentName}</h3>
            <p className="mt-1 text-sm text-[#617184]">{registration.parentEmail}</p>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <DetailBlock label="Phone" value={`${registration.phoneCountryCode ?? ""} ${registration.phoneNumber ?? "Pending"}`.trim()} />
            <DetailBlock label="Country" value={registration.selectedCountryName ?? "Pending"} />
            <DetailBlock label="Status" value={registration.status.replace(/_/g, " ")} />
            <DetailBlock label="Total" value={formatMoney(registration.totalAmount, registration.selectedCurrency)} />
          </div>

          <div className="mt-5 rounded-[20px] border border-[#eadfce] bg-[#fffdf9] p-4">
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

          <div className="mt-5 rounded-[20px] border border-[#eadfce] bg-[#fffdf9] p-4">
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
            <div className="mt-5 rounded-[20px] border border-[#eadfce] bg-[#fffdf9] p-4">
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
                  <h2 className="text-xl font-semibold text-[#22304a]">
                    {formatPersonName(registration.parentFirstName, registration.parentLastName) || "Parent pending"}
                  </h2>
                  <p className="mt-1 text-sm text-[#6d7785]">
                    {registration.parentEmail} - {registration.selectedCountryName ?? "No country"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <RegistrationDetailsPopup registration={registration} />
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(registration.status)}`}>{registration.status.replace(/_/g, " ")}</span>
                </div>
              </div>
              <div className="mt-4 grid gap-3 text-sm text-[#556274] md:grid-cols-[1fr_1fr_auto]">
                <span>
                  <span className="font-semibold text-[#22304a]">{registration.students.length} children:</span>{" "}
                  {registration.students
                    .map((child) => formatPersonName(child.firstName, child.lastName) || child.displayName || "Unnamed child")
                    .join(", ")}
                </span>
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
