"use client";

import { useEffect, useState } from "react";

type ManualInstructions = {
  whatsapp?: string;
  instructions: string[];
  channels: Array<{
    id: "BANK_TRANSFER" | "JAZZCASH";
    title: string;
    badge: string;
    fields: Array<{ label: string; value: string }>;
  }>;
};

type CheckoutResponse = {
  paymentId: string;
  orderNumber: string;
  gateway: string;
  nextStep: string;
  checkoutUrl?: string | null;
  manualInstructions?: ManualInstructions | null;
};

type Props = {
  registrationId: string;
  currency: string;
  totalAmount: number;
  studentCount: number;
  itemCount: number;
  allowManual: boolean;
  allowPayPal: boolean;
};

type Gateway = "STRIPE" | "PAYPAL" | "BANK_TRANSFER";

function copyValue(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(value).catch(() => undefined);
  }
}

export function PendingPaymentCard({
  registrationId,
  currency,
  totalAmount,
  studentCount,
  itemCount,
  allowManual,
  allowPayPal,
}: Props) {
  const [selectedGateway, setSelectedGateway] = useState<Gateway>("STRIPE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CheckoutResponse | null>(null);

  async function handleContinue() {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/registration/${registrationId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway: selectedGateway }),
      });

      const payload = (await response.json()) as CheckoutResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to continue payment.");
      }

      setSuccess(payload);

      if (payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to continue payment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const paymentOptions: Array<{ value: Gateway; label: string; description: string }> = [
    {
      value: "STRIPE",
      label: "Card / Pay by link",
      description: "Continue with Stripe recurring checkout.",
    },
    ...(allowPayPal
      ? [
          {
            value: "PAYPAL" as const,
            label: "PayPal",
            description: "Use the saved PayPal subscription plan for this enrollment.",
          },
        ]
      : []),
    ...(allowManual
      ? [
          {
            value: "BANK_TRANSFER" as const,
            label: "Manual payment",
            description: "Use Bank Transfer or JazzCash and submit proof for review.",
          },
        ]
      : []),
  ];

  useEffect(() => {
    if (!paymentOptions.some((option) => option.value === selectedGateway)) {
      setSelectedGateway(paymentOptions[0]?.value ?? "STRIPE");
    }
  }, [paymentOptions, selectedGateway]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
      <section className="rounded-[2rem] border border-[#eadfcd] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
          Pending payment
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[#22304a]">
          Complete your enrollment payment
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[#5f6b7a]">
          Your registration draft is saved. Choose a payment method below to finish the checkout and confirm enrollment.
        </p>

        <div className="mt-8 space-y-3">
          {paymentOptions.map((option) => (
            <label
              key={option.value}
              className={`block cursor-pointer rounded-2xl border px-4 py-4 transition ${
                selectedGateway === option.value
                  ? "border-[#f3a25d] bg-[#fff1df]"
                  : "border-[#ebdccb] bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="gateway"
                  checked={selectedGateway === option.value}
                  onChange={() => setSelectedGateway(option.value)}
                  className="mt-1"
                />
                <div>
                  <p className="font-semibold text-[#22304a]">{option.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[#6d7785]">{option.description}</p>
                </div>
              </div>
            </label>
          ))}
        </div>

        {selectedGateway === "BANK_TRANSFER" && success?.manualInstructions ? (
          <div className="mt-6 rounded-[1.6rem] border border-[#eadfcd] bg-[#fffaf4] p-4">
            <p className="text-sm font-semibold text-[#22304a]">Manual payment details</p>
            <div className="mt-3 space-y-3">
              {success.manualInstructions.channels.map((channel) => (
                <div key={channel.id} className="rounded-2xl border border-[#e6d8c4] bg-white p-4">
                  <p className="text-sm font-semibold text-[#22304a]">{channel.title}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#b1772f]">
                    {channel.badge}
                  </p>
                  <div className="mt-3 space-y-3 text-sm text-[#38506a]">
                    {channel.fields.map((field) => (
                      <div key={field.label} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#66758a]">
                            {field.label}
                          </p>
                          <p className="mt-1 font-medium text-[#22304a]">{field.value}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyValue(field.value)}
                          className="rounded-lg border border-[#cfe1f5] bg-[#f5fbff] px-3 py-2 text-xs font-semibold text-[#2a76aa]"
                        >
                          Copy
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {success.manualInstructions.whatsapp ? (
              <p className="mt-4 text-sm text-[#8d5b22]">
                After payment, share your proof on WhatsApp: {success.manualInstructions.whatsapp}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-[#f0cccc] bg-[#fff4f4] px-4 py-3 text-sm text-[#a23c3c]">
            {error}
          </div>
        ) : null}

        {success && !success.checkoutUrl ? (
          <div className="mt-6 rounded-2xl border border-[#d7efdf] bg-[#effaf3] px-4 py-3 text-sm text-[#2f6b4b]">
            {success.nextStep}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleContinue}
          disabled={isSubmitting}
          className="mt-6 w-full rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#182235] disabled:opacity-60"
        >
          {isSubmitting ? "Preparing payment..." : "Continue payment"}
        </button>
      </section>

      <aside className="rounded-[2rem] border border-[#eadfcd] bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">
          Enrollment summary
        </p>
        <div className="mt-5 rounded-[1.6rem] bg-[#22304a] p-5 text-white">
          <div className="flex items-center justify-between text-sm text-white/80">
            <span>Students</span>
            <span>{studentCount}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm text-white/80">
            <span>Items</span>
            <span>{itemCount}</span>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-lg font-semibold">
            <span>Total</span>
            <span>
              {currency} {totalAmount}
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
