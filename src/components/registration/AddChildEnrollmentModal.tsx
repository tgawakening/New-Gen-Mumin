"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type Offer = {
  slug: string;
  title: string;
  description: string | null;
  kind: "SINGLE" | "PAIR" | "BUNDLE";
  basePriceGbp: number;
  basePricePkr: number | null;
};

type Country = {
  code: string;
  name: string;
  currency: string;
};

type ParentContext = {
  parentName: string;
  parentEmail: string;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  billingCountryCode: string | null;
  billingCountryName: string | null;
};

type DraftResponse = {
  registrationId: string;
  totalAmount: number;
  currency: string;
};

type ManualInstructions = {
  whatsapp?: string;
  instructions: string[];
  channels: Array<{
    id: "BANK_TRANSFER" | "JAZZCASH";
    title: string;
    badge: string;
    fields: Array<{
      label: string;
      value: string;
    }>;
  }>;
};

type CheckoutResponse = {
  orderId: string;
  paymentId: string;
  orderNumber: string;
  gateway: string;
  amount: number;
  currency: string;
  status: string;
  nextStep: string;
  checkoutUrl?: string | null;
  manualInstructions?: ManualInstructions | null;
};

type PaymentValue = "STRIPE" | "PAYPAL" | "BANK_TRANSFER";

const PAYMENT_METHODS: Array<{ value: PaymentValue; label: string; description: string }> = [
  { value: "STRIPE", label: "Card / Pay by link", description: "Stripe subscription checkout for cards and hosted payment links." },
  { value: "PAYPAL", label: "PayPal", description: "PayPal monthly subscription approval for supported subscription plans." },
  { value: "BANK_TRANSFER", label: "Manual payment", description: "Use Bank Transfer or JazzCash and then submit proof for review." },
];

const MANUAL_PAYMENT_PREVIEW: ManualInstructions = {
  whatsapp: "03181602388",
  instructions: [
    "Use your child enrollment reference in the payment note.",
    "After payment, send your screenshot to WhatsApp support on 03181602388 so your payment can be confirmed from the backend.",
  ],
  channels: [
    {
      id: "BANK_TRANSFER",
      title: "Bank Transfer",
      badge: "[BANK] Meezan Bank",
      fields: [
        { label: "Account Title", value: "AREEJ FATIMA" },
        { label: "Account Number", value: "98900114432111" },
        { label: "IBAN", value: "PK96MEZN0098900114432111" },
      ],
    },
    {
      id: "JAZZCASH",
      title: "JazzCash",
      badge: "[JAZZ] JazzCash",
      fields: [
        { label: "Account Name", value: "Areej Fatima" },
        { label: "Mobile Number", value: "03244517741" },
      ],
    },
  ],
};

const GBP_RATES: Record<string, number> = {
  GBP: 1,
  PKR: 350,
  INR: 104,
  BDT: 149,
  AFN: 97,
  AED: 4.68,
  SAR: 4.77,
  USD: 1.27,
  CAD: 1.72,
  AUD: 1.96,
  NZD: 2.1,
  EUR: 1.17,
  TRY: 51,
  ZAR: 24,
  QAR: 4.63,
  KWD: 0.39,
  BHD: 0.48,
  OMR: 0.49,
  MYR: 5.98,
  SGD: 1.72,
  CHF: 1.1,
  NOK: 13.6,
  SEK: 13.2,
  DKK: 8.8,
  JPY: 191,
};

const REGIONAL_PRICE_OVERRIDES: Record<string, Partial<Record<string, number>>> = {
  US: { "seerah-leadership-bundle": 40, "full-bundle": 80 },
  CA: { "seerah-leadership-bundle": 40 },
  AE: { "full-bundle": 200 },
  SA: { "full-bundle": 200 },
};

function splitName(fullName: string) {
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  const [firstName, ...rest] = cleaned.split(" ");
  return { firstName: firstName || cleaned, lastName: rest.join(" ") || "Student" };
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function originalPriceGbp(offer: Offer) {
  return offer.kind === "BUNDLE" ? 150 : null;
}

function getRegionalPrice(offer: Offer, country: Country) {
  const explicitOverride = REGIONAL_PRICE_OVERRIDES[country.code]?.[offer.slug];
  const convertedAmount = Math.round(offer.basePriceGbp * (GBP_RATES[country.currency] ?? 1));

  if (typeof explicitOverride === "number") {
    return {
      displayCurrency: country.currency,
      displayAmount: explicitOverride,
      discountPercent: Math.max(0, Math.round((1 - explicitOverride / convertedAmount) * 100)),
    };
  }

  if (country.currency === "PKR" && offer.basePricePkr) {
    return { displayCurrency: "PKR", displayAmount: offer.basePricePkr, discountPercent: 0 };
  }

  return {
    displayCurrency: country.currency,
    displayAmount: convertedAmount,
    discountPercent: 0,
  };
}

async function copyToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  await navigator.clipboard.writeText(value);
}

export function AddChildEnrollmentModal({
  parent,
  offers,
  countries,
}: {
  parent: ParentContext;
  offers: Offer[];
  countries: readonly Country[];
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [childFullName, setChildFullName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [childGender, setChildGender] = useState("");
  const [selectedOfferSlug, setSelectedOfferSlug] = useState(
    offers.find((offer) => offer.kind === "BUNDLE")?.slug ?? offers[0]?.slug ?? "",
  );
  const [selectedGateway, setSelectedGateway] = useState<PaymentValue>("STRIPE");
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [success, setSuccess] = useState<CheckoutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [manualMethod, setManualMethod] = useState<"BANK_TRANSFER" | "JAZZCASH">("BANK_TRANSFER");
  const [senderName, setSenderName] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [referenceKey, setReferenceKey] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualProofMessage, setManualProofMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  useEffect(() => {
    if (success?.checkoutUrl && (success.gateway === "STRIPE" || success.gateway === "PAYPAL")) {
      window.location.assign(success.checkoutUrl);
    }
  }, [success]);

  const selectedCountry =
    countries.find((country) => country.code === parent.billingCountryCode) ??
    countries.find((country) => country.name === parent.billingCountryName) ??
    countries[0];

  const selectedOffer = offers.find((offer) => offer.slug === selectedOfferSlug) ?? offers[0];
  const pricing = selectedOffer ? getRegionalPrice(selectedOffer, selectedCountry) : null;
  const isPakistan = selectedCountry.code === "PK";
  const availablePaymentMethods = PAYMENT_METHODS.filter((method) =>
    method.value === "BANK_TRANSFER" ? isPakistan : true,
  );

  useEffect(() => {
    if (!availablePaymentMethods.some((method) => method.value === selectedGateway)) {
      setSelectedGateway(availablePaymentMethods[0]?.value ?? "STRIPE");
    }
  }, [availablePaymentMethods, selectedGateway]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setManualProofMessage(null);
    setIsSubmitting(true);

    if (!parent.phoneNumber) {
      setError("Parent phone details are missing. Please update the parent profile first.");
      setIsSubmitting(false);
      return;
    }

    try {
      const childName = splitName(childFullName);

      const registrationResponse = await fetch("/api/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentFirstName: splitName(parent.parentName).firstName,
          parentLastName: splitName(parent.parentName).lastName,
          parentEmail: parent.parentEmail,
          phoneCountryCode: parent.phoneCountryCode || "",
          phoneNumber: parent.phoneNumber,
          whatsappNumber: "",
          selectedCountryCode: selectedCountry.code,
          selectedCountryName: selectedCountry.name,
          notes: "Source: parent-dashboard-add-child",
          students: [
            {
              firstName: childName.firstName,
              lastName: childName.lastName,
              age: Number(childAge),
              gender: childGender,
              selectedOfferSlugs: [selectedOfferSlug],
              notes: "",
            },
          ],
        }),
      });

      const registrationPayload = (await registrationResponse.json()) as DraftResponse & {
        error?: string;
      };
      if (!registrationResponse.ok) {
        throw new Error(registrationPayload.error ?? "Unable to create child enrollment draft.");
      }

      setDraft(registrationPayload);

      const checkoutResponse = await fetch(
        `/api/registration/${registrationPayload.registrationId}/checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gateway: selectedGateway,
          }),
        },
      );

      const checkoutPayload = (await checkoutResponse.json()) as CheckoutResponse & {
        error?: string;
      };
      if (!checkoutResponse.ok) {
        throw new Error(checkoutPayload.error ?? "Unable to prepare payment.");
      }

      setSuccess(checkoutPayload);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to continue with child enrollment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleManualProofSubmit() {
    if (!success?.paymentId) return;
    setManualProofMessage(null);
    setError(null);
    setIsSubmittingProof(true);

    try {
      const response = await fetch(`/api/payments/manual/${success.paymentId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName,
          senderNumber,
          referenceKey,
          manualMethod,
          notes: manualNotes,
        }),
      });

      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit payment proof.");
      }

      setManualProofMessage(payload.message ?? "Payment proof submitted successfully.");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to submit payment proof.",
      );
    } finally {
      setIsSubmittingProof(false);
    }
  }

  function closeModal() {
    router.push("/parent");
  }

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-[#22304a]/45 px-4 py-6">
      <div className="absolute inset-0" onClick={closeModal} />
      <div className="relative z-[161] max-h-[92vh] w-full max-w-[1040px] overflow-hidden rounded-[34px] border border-[#eadfce] bg-[#fffaf5] shadow-[0_32px_80px_rgba(34,48,74,0.22)]">
        <div className="flex items-center justify-between border-b border-[#efe1d2] px-6 py-5">
          <div>
            <p className="inline-flex rounded-full bg-[#f39f5f] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
              Add another child
            </p>
            <p className="mt-3 text-sm text-[#657284]">
              Keep your parent details and continue with only the new child and payment flow.
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full border border-[#d9c6b0] px-4 py-2 text-sm font-semibold text-[#22304a]"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto px-6 py-6">
          <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_360px]">
            <div className="space-y-6">
              <section className="rounded-[24px] border border-[#ebdccb] bg-white px-5 py-5">
                <h3 className="text-lg font-semibold text-[#22304a]">Parent details</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <SummaryField label="Parent name" value={parent.parentName} />
                  <SummaryField label="Email" value={parent.parentEmail} />
                  <SummaryField
                    label="Phone"
                    value={
                      parent.phoneCountryCode && parent.phoneNumber
                        ? `${parent.phoneCountryCode} ${parent.phoneNumber}`
                        : parent.phoneNumber ?? "Pending"
                    }
                  />
                  <SummaryField
                    label="Billing country"
                    value={selectedCountry ? selectedCountry.name : "Pending"}
                  />
                </div>
              </section>

              <section className="rounded-[24px] border border-[#ebdccb] bg-white px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-[#22304a]">Child details</h3>
                  <span className="rounded-full bg-[#fff7ea] px-3 py-1 text-xs font-semibold text-[#9b6328]">
                    50% multi-child discount already applies from second child onward
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_120px_140px]">
                  <FormField label="Child full name" value={childFullName} onChange={setChildFullName} />
                  <FormField label="Age" value={childAge} onChange={setChildAge} type="number" />
                  <div>
                    <label className="mb-2 block text-sm font-medium text-[#38506a]">Gender</label>
                    <select
                      value={childGender}
                      onChange={(event) => setChildGender(event.target.value)}
                      className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]"
                      required
                    >
                      <option value="">Select</option>
                      <option value="Boy">Boy</option>
                      <option value="Girl">Girl</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <label className="block text-sm font-medium text-[#38506a]">Programme selection</label>
                  <select
                    value={selectedOfferSlug}
                    onChange={(event) => setSelectedOfferSlug(event.target.value)}
                    className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]"
                    required
                  >
                    {offers.map((offer) => (
                      <option key={offer.slug} value={offer.slug}>
                        {offer.kind === "BUNDLE"
                          ? `${offer.title} - includes all 4 programmes`
                          : offer.title}
                      </option>
                    ))}
                  </select>

                  {selectedOffer && pricing ? (
                    <div className="rounded-[22px] border border-[#ebdccb] bg-[#fffaf4] px-4 py-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="max-w-[70%]">
                          <p className="text-lg font-semibold text-[#22304a]">{selectedOffer.title}</p>
                          {selectedOffer.kind === "BUNDLE" ? (
                            <p className="mt-1 text-sm text-[#657284]">Includes all 4 programmes</p>
                          ) : null}
                        </div>
                        <div className="rounded-[20px] bg-white px-4 py-3 text-right md:min-w-[170px]">
                          {originalPriceGbp(selectedOffer) ? (
                            <p className="text-sm font-medium text-[#9a8b7d] line-through">
                              {formatMoney(originalPriceGbp(selectedOffer)!, "GBP")}
                            </p>
                          ) : null}
                          <p className="mt-1 text-2xl font-semibold text-[#22304a]">
                            {formatMoney(pricing.displayAmount, pricing.displayCurrency)}
                          </p>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8f7c69]">
                            /per month
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            <aside className="space-y-5">
              <section className="rounded-[24px] border border-[#ebdccb] bg-white px-5 py-5">
                <div className="flex items-center justify-between gap-3 border-b border-[#f0e2d2] pb-3">
                  <h3 className="text-lg font-semibold text-[#22304a]">Order summary</h3>
                  <span className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                    {pricing ? formatMoney(pricing.displayAmount / 2, pricing.displayCurrency) : "—"}
                  </span>
                </div>
                {selectedOffer && pricing ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-[#efe2d2] bg-[#fffaf4] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#22304a]">{selectedOffer.title}</p>
                          <p className="mt-1 text-sm text-[#6d7785]">{childFullName || "New child"}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#c27a2c]">
                            50% multi-child auto-discount
                          </p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-semibold text-[#22304a]">
                            {formatMoney(pricing.displayAmount, pricing.displayCurrency)}
                          </p>
                          <p className="mt-1 font-medium text-[#c27a2c]">
                            - {formatMoney(Math.round(pricing.displayAmount * 0.5), pricing.displayCurrency)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[22px] bg-[#22304a] px-4 py-4 text-white">
                      <div className="flex items-center justify-between text-sm text-white/80">
                        <span>Subtotal</span>
                        <span>{formatMoney(pricing.displayAmount, pricing.displayCurrency)}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm text-[#f8d39f]">
                        <span>Discount</span>
                        <span>- {formatMoney(Math.round(pricing.displayAmount * 0.5), pricing.displayCurrency)}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold">
                        <span>Total</span>
                        <span>{formatMoney(Math.round(pricing.displayAmount * 0.5), pricing.displayCurrency)}</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-[24px] border border-[#ebdccb] bg-white px-5 py-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-[#22304a]">Payment method</h3>
                  <span className="rounded-full bg-[#ecf8f0] px-3 py-1 text-xs font-semibold text-[#2f6b4b]">
                    Active
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {availablePaymentMethods.map((method) => (
                    <label
                      key={method.value}
                      className={`block cursor-pointer rounded-2xl border px-4 py-3 transition ${
                        selectedGateway === method.value
                          ? "border-[#f3a25d] bg-[#fff1df]"
                          : "border-[#ebdccb] bg-white"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="gateway"
                          checked={selectedGateway === method.value}
                          onChange={() => setSelectedGateway(method.value)}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-semibold text-[#22304a]">{method.label}</p>
                          <p className="mt-1 text-sm leading-6 text-[#6d7785]">{method.description}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              {draft ? (
                <div className="rounded-2xl border border-[#ead8c3] bg-[#fffaf4] px-4 py-3 text-sm text-[#5f6b7a]">
                  <p className="font-semibold text-[#22304a]">Draft saved</p>
                  <p className="mt-1">Registration ID: {draft.registrationId}</p>
                </div>
              ) : null}
              {success ? (
                <div className="rounded-2xl border border-[#d7efdf] bg-[#effaf3] px-4 py-3 text-sm leading-7 text-[#2f6b4b]">
                  <p className="font-semibold">Order {success.orderNumber} is ready.</p>
                  <p className="mt-1">{success.nextStep}</p>
                </div>
              ) : null}
              {error ? (
                <div className="rounded-2xl border border-[#f0cccc] bg-[#fff4f4] px-4 py-3 text-sm text-[#a23c3c]">
                  {error}
                </div>
              ) : null}

              {selectedGateway === "BANK_TRANSFER" ? (
                <section className="rounded-[24px] border border-[#ebdccb] bg-white px-5 py-5">
                  <h3 className="text-lg font-semibold text-[#22304a]">Manual payment</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(success?.manualInstructions ?? MANUAL_PAYMENT_PREVIEW).channels.map((channel) => (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => setManualMethod(channel.id)}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          manualMethod === channel.id
                            ? "border-[#2a76aa] bg-[#eaf5ff] text-[#22304a]"
                            : "border-[#d7e5f2] bg-white text-[#38506a]"
                        }`}
                      >
                        {channel.title}
                      </button>
                    ))}
                  </div>

                  {(() => {
                    const instructions = success?.manualInstructions ?? MANUAL_PAYMENT_PREVIEW;
                    const activeChannel =
                      instructions.channels.find((channel) => channel.id === manualMethod) ??
                      instructions.channels[0];

                    return (
                      <>
                        <div className="mt-3 rounded-2xl border border-[#cfe1f5] bg-[#eef6ff] px-4 py-3 text-sm leading-6 text-[#38506a]">
                          {instructions.instructions.map((instruction, index) => (
                            <p key={index}>{instruction}</p>
                          ))}
                        </div>
                        <div className="mt-3 rounded-2xl border border-[#d7e5f2] bg-white px-4 py-4">
                          <p className="text-sm font-semibold text-[#22304a]">{activeChannel.badge}</p>
                          <div className="mt-3 space-y-3 text-sm text-[#38506a]">
                            {activeChannel.fields.map((field) => (
                              <div key={field.label} className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#66758a]">
                                    {field.label}
                                  </p>
                                  <p className="mt-1 font-medium text-[#22304a]">{field.value}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(field.value)}
                                  className="rounded-lg border border-[#cfe1f5] bg-[#f5fbff] px-3 py-2 text-xs font-semibold text-[#2a76aa]"
                                >
                                  Copy
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  <div className="mt-4 space-y-3 rounded-2xl bg-[#fffaf4] p-4">
                    <p className="text-sm font-semibold text-[#22304a]">Submit payment proof</p>
                    <input
                      value={senderName}
                      onChange={(event) => setSenderName(event.target.value)}
                      className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]"
                      placeholder="Sender name"
                    />
                    <input
                      value={senderNumber}
                      onChange={(event) => setSenderNumber(event.target.value)}
                      className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]"
                      placeholder="Sender number / account"
                    />
                    <input
                      value={referenceKey}
                      onChange={(event) => setReferenceKey(event.target.value)}
                      className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]"
                      placeholder="Transaction / reference ID"
                    />
                    <textarea
                      value={manualNotes}
                      onChange={(event) => setManualNotes(event.target.value)}
                      className="min-h-24 w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]"
                      placeholder="Optional notes for admin review"
                    />
                    {manualProofMessage ? (
                      <div className="rounded-2xl bg-[#effaf3] px-4 py-3 text-sm text-[#2f6b4b]">
                        {manualProofMessage}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleManualProofSubmit}
                      disabled={isSubmittingProof || !success?.paymentId}
                      className="w-full rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isSubmittingProof
                        ? "Submitting proof..."
                        : success?.paymentId
                          ? "Submit transfer proof"
                          : "Create the order first to submit proof"}
                    </button>
                  </div>
                </section>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#182235] disabled:opacity-60"
              >
                {isSubmitting ? "Submitting..." : "Continue with child enrollment"}
              </button>
            </aside>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#fbf6ef] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8b7a68]">{label}</p>
      <p className="mt-2 break-words text-sm leading-6 text-[#22304a]">{value}</p>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-[#38506a]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]"
        required
      />
    </div>
  );
}
