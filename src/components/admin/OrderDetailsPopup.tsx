"use client";

import { Eye, X } from "lucide-react";
import { useState } from "react";

type DetailItem = {
  label: string;
  value: string | null;
};

type ManualSubmission = {
  method: string;
  senderName: string;
  senderNumber: string;
  referenceKey: string;
  screenshotUrl: string | null;
  notes: string | null;
  submittedAt: Date | string;
} | null;

type OrderDetailsPopupProps = {
  orderNumber: string;
  parentName: string;
  parentEmail: string;
  city?: string | null;
  phone: string;
  gateway: string;
  status: string;
  paymentStatus: string;
  amountLabel: string;
  pricingLabel: string;
  couponLabel?: string | null;
  manualPaidAmountAdjustment?: {
    amount: number | null;
    currency: string | null;
    note: string | null;
    adjustedAt: string | null;
  } | null;
  programmes: string[];
  childDetails: Array<{
    id: string;
    name: string;
    age: number | null;
    gender: string | null;
    programs: string[];
  }>;
  manualSubmission: ManualSubmission;
};

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function DetailBlock({ label, value }: DetailItem) {
  return (
    <div className="rounded-2xl border border-[#e6edf4] bg-white px-4 py-3 text-sm">
      <p className="font-semibold uppercase tracking-[0.12em] text-[#6f7d8f]">{label}</p>
      <p className="mt-1 text-[#22304a]">{value || "Pending"}</p>
    </div>
  );
}

export function OrderDetailsPopup({
  orderNumber,
  parentName,
  parentEmail,
  city,
  phone,
  gateway,
  status,
  paymentStatus,
  amountLabel,
  pricingLabel,
  couponLabel,
  manualPaidAmountAdjustment,
  programmes,
  childDetails,
  manualSubmission,
}: OrderDetailsPopupProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-[#cbd9e8] bg-white px-3 py-2 text-xs font-semibold text-[#22304a] transition hover:bg-[#f5f8fb]"
      >
        <Eye className="h-4 w-4" />
        View details
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#132238]/55 px-4 py-6"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setOpen(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e6edf4] pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f7d8f]">Order details</p>
                <h3 className="mt-2 text-2xl font-semibold text-[#22304a]">{orderNumber}</h3>
                <p className="mt-1 text-sm text-[#617184]">{parentName} - {parentEmail}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0f4d81] text-white"
                aria-label="Close order details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <DetailBlock label="Parent phone" value={phone} />
              <DetailBlock label="City" value={city ?? null} />
              <DetailBlock label="Gateway" value={gateway} />
              <DetailBlock label="Order status" value={status.replace(/_/g, " ")} />
              <DetailBlock label="Payment status" value={paymentStatus.replace(/_/g, " ")} />
              <DetailBlock label="Amount" value={amountLabel} />
              <DetailBlock label="Pricing" value={pricingLabel} />
              {manualPaidAmountAdjustment ? (
                <DetailBlock
                  label="Manual revenue note"
                  value={[
                    manualPaidAmountAdjustment.amount !== null && manualPaidAmountAdjustment.currency
                      ? `${manualPaidAmountAdjustment.currency} ${manualPaidAmountAdjustment.amount}`
                      : null,
                    manualPaidAmountAdjustment.note,
                  ].filter(Boolean).join(" - ")}
                />
              ) : null}
              {couponLabel ? <DetailBlock label="Coupon" value={couponLabel} /> : null}
            </div>

            <div className="mt-5 rounded-[20px] border border-[#e6edf4] bg-[#fbfdff] p-4">
              <p className="font-semibold text-[#22304a]">Children ({childDetails.length})</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {childDetails.map((child) => (
                  <div key={child.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-[#22304a]">
                    <p className="font-semibold">{child.name}</p>
                    <p className="mt-1 text-[#617184]">Age {child.age ?? "Pending"}{child.gender ? ` - ${child.gender}` : ""}</p>
                    <p className="mt-1 text-[#617184]">{child.programs.join(", ") || "Program pending"}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-[20px] border border-[#e6edf4] bg-[#fbfdff] p-4">
              <p className="font-semibold text-[#22304a]">Programmes</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {programmes.map((program) => (
                  <span key={program} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#22304a]">
                    {program}
                  </span>
                ))}
                {!programmes.length ? <span className="text-sm text-[#617184]">Program pending</span> : null}
              </div>
            </div>

            {manualSubmission ? (
              <div className="mt-5 rounded-[20px] border border-[#f0d7aa] bg-[#fffaf1] p-4">
                <p className="font-semibold text-[#22304a]">Manual payment proof</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <DetailBlock label="Method" value={manualSubmission.method.replace(/_/g, " ")} />
                  <DetailBlock label="Sender name" value={manualSubmission.senderName} />
                  <DetailBlock label="Sender contact" value={manualSubmission.senderNumber} />
                  <DetailBlock label="Reference number" value={manualSubmission.referenceKey} />
                  <DetailBlock label="Submitted at" value={formatDate(manualSubmission.submittedAt)} />
                  <DetailBlock label="Notes" value={manualSubmission.notes || "No notes"} />
                </div>
                {manualSubmission.screenshotUrl ? (
                  <a
                    href={manualSubmission.screenshotUrl}
                    target="_blank"
                    className="mt-4 inline-flex rounded-full bg-[#0f4d81] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Open screenshot
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 rounded-[20px] border border-[#e6edf4] bg-[#fbfdff] p-4 text-sm text-[#617184]">
                No manual payment proof submitted for this order.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
