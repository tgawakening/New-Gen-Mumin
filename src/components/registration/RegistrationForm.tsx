"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Offer = {
  slug: string;
  title: string;
  description: string | null;
  kind: "SINGLE" | "PAIR" | "BUNDLE";
  basePriceGbp: number;
  basePricePkr: number | null;
};

type Props = {
  offers: Offer[];
  countries: readonly { code: string; name: string; currency: string }[];
  autoOpen?: boolean;
};

type ChildForm = {
  fullName: string;
  age: string;
  gender: string;
  selectedOfferSlugs: string[];
};

type DraftResponse = {
  registrationId: string;
  totalAmount: number;
  currency: string;
  studentCount: number;
  itemCount: number;
  status: string;
};

type ManualInstructions = {
  accountName: string;
  bankName: string;
  accountNumber: string;
  iban?: string;
  swiftCode?: string;
  sortCode?: string;
  branchAddress?: string;
  whatsapp?: string;
  instructions: string[];
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
  providerReference?: string | null;
  manualInstructions?: ManualInstructions | null;
};

type PaymentValue = "STRIPE" | "PAYPAL" | "BANK_TRANSFER" | "NAYAPAY";

type PhoneCountry = {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
  currency: string;
  gbpRate: number;
};

type PriceBreakdown = {
  displayCurrency: string;
  displayAmount: number;
  convertedAmount: number;
  discountPercent: number;
  discountedGbp: number;
  usesRegionalPricing: boolean;
};

const PAYMENT_METHODS: Array<{ value: PaymentValue; label: string; description: string }> = [
  { value: "STRIPE", label: "Card / Pay by link", description: "Stripe subscription checkout for cards and hosted payment links." },
  { value: "PAYPAL", label: "PayPal", description: "PayPal monthly subscription approval for wallet-based recurring payments." },
  { value: "BANK_TRANSFER", label: "Manual bank transfer", description: "Transfer manually and then submit proof for admin review." },
  { value: "NAYAPAY", label: "NayaPay", description: "Will stay in review mode until NayaPay credentials are provided." },
];

const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", dialCode: "+44", currency: "GBP", gbpRate: 1 },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", dialCode: "+92", currency: "PKR", gbpRate: 350 },
  { code: "IN", name: "India", flag: "🇮🇳", dialCode: "+91", currency: "INR", gbpRate: 104 },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", dialCode: "+880", currency: "BDT", gbpRate: 149 },
  { code: "AF", name: "Afghanistan", flag: "🇦🇫", dialCode: "+93", currency: "AFN", gbpRate: 97 },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪", dialCode: "+971", currency: "AED", gbpRate: 4.68 },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", dialCode: "+966", currency: "SAR", gbpRate: 4.77 },
  { code: "US", name: "United States", flag: "🇺🇸", dialCode: "+1", currency: "USD", gbpRate: 1.27 },
  { code: "CA", name: "Canada", flag: "🇨🇦", dialCode: "+1", currency: "CAD", gbpRate: 1.72 },
  { code: "AU", name: "Australia", flag: "🇦🇺", dialCode: "+61", currency: "AUD", gbpRate: 1.96 },
];

const emptyChild = (): ChildForm => ({ fullName: "", age: "", gender: "", selectedOfferSlugs: [] });

function splitName(fullName: string) {
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  const [firstName, ...rest] = cleaned.split(" ");
  return { firstName: firstName || cleaned, lastName: rest.join(" ") || "Parent" };
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function getRegionalPrice(offer: Offer, phoneCountry: PhoneCountry): PriceBreakdown {
  const convertedAmount = Math.round(offer.basePriceGbp * phoneCountry.gbpRate);
  const southAsia = new Set(["PK", "IN", "BD", "AF"]);
  if (!southAsia.has(phoneCountry.code) || !offer.basePricePkr) {
    return { displayCurrency: phoneCountry.currency, displayAmount: convertedAmount, convertedAmount, discountPercent: 0, discountedGbp: offer.basePriceGbp, usesRegionalPricing: false };
  }
  const discountFactor = offer.basePricePkr / (offer.basePriceGbp * 350);
  const displayAmount = phoneCountry.code === "PK" ? offer.basePricePkr : Math.round(offer.basePriceGbp * phoneCountry.gbpRate * discountFactor);
  const discountPercent = Math.max(0, Math.round((1 - displayAmount / convertedAmount) * 100));
  return { displayCurrency: phoneCountry.currency, displayAmount, convertedAmount, discountPercent, discountedGbp: Number((displayAmount / phoneCountry.gbpRate).toFixed(1)), usesRegionalPricing: true };
}

function originalPriceGbp(offer: Offer) {
  if (offer.kind === "BUNDLE") return 150;
  return null;
}

function offerSummary(offer: Offer) {
  if (offer.kind === "BUNDLE") return "Includes all 4 programmes";
  return null;
}

function offerLabel(offer: Offer) {
  if (offer.kind === "BUNDLE") return `${offer.title} - includes all 4 programmes`;
  return offer.title;
}

function sectionCard(children: React.ReactNode, extraClassName = "") {
  return (
    <section className={`rounded-[22px] border border-[#f0deca] bg-[#fffdf9] p-5 shadow-[0_10px_30px_rgba(194,122,44,0.08)] ${extraClassName}`.trim()}>
      {children}
    </section>
  );
}

export function RegistrationForm({ offers, autoOpen = false }: Props) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [guardianFullName, setGuardianFullName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("GB");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [children, setChildren] = useState<ChildForm[]>([emptyChild()]);
  const [selectedGateway, setSelectedGateway] = useState<PaymentValue>("STRIPE");
  const [senderName, setSenderName] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [referenceKey, setReferenceKey] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualProofMessage, setManualProofMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [success, setSuccess] = useState<CheckoutResponse | null>(null);

  const selectedPhoneCountry = PHONE_COUNTRIES.find((country) => country.code === selectedCountryCode) ?? PHONE_COUNTRIES[0];
  const offerMap = useMemo(() => new Map(offers.map((offer) => [offer.slug, offer])), [offers]);
  const orderedOffers = useMemo(() => {
    const kindRank = { BUNDLE: 0, PAIR: 1, SINGLE: 2 };
    return [...offers].sort((left, right) => {
      const rankDifference = kindRank[left.kind] - kindRank[right.kind];
      if (rankDifference !== 0) return rankDifference;
      return left.basePriceGbp - right.basePriceGbp || left.title.localeCompare(right.title);
    });
  }, [offers]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (autoOpen) setIsOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    const bundleOffer = orderedOffers.find((offer) => offer.kind === "BUNDLE");
    if (!bundleOffer) return;
    setChildren((current) =>
      current.map((child) =>
        child.selectedOfferSlugs.length === 0 ? { ...child, selectedOfferSlugs: [bundleOffer.slug] } : child,
      ),
    );
  }, [orderedOffers]);

  useEffect(() => {
    if (!isOpen) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (success?.checkoutUrl && (success.gateway === "STRIPE" || success.gateway === "PAYPAL")) {
      window.location.assign(success.checkoutUrl);
    }
  }, [success]);

  const isFormReadyForPayment = useMemo(() => {
    if (!guardianFullName.trim() || !parentEmail.trim() || !phoneNumber.trim() || password.length < 8 || confirmPassword.length < 8) return false;
    if (password !== confirmPassword) return false;
    return children.every((child) => child.fullName.trim() && child.age.trim() && child.gender.trim() && child.selectedOfferSlugs.length > 0);
  }, [children, confirmPassword, guardianFullName, parentEmail, password, phoneNumber]);

  const summary = useMemo(() => {
    const lines: Array<{ childLabel: string; offerTitle: string; price: PriceBreakdown; multiChildDiscount: number }> = [];
    let subtotal = 0;
    let discount = 0;
    children.forEach((child, childIndex) => {
      child.selectedOfferSlugs.forEach((slug) => {
        const offer = offerMap.get(slug);
        if (!offer) return;
        const price = getRegionalPrice(offer, selectedPhoneCountry);
        const multiChildDiscount = childIndex === 0 ? 0 : Math.round(price.displayAmount * 0.5);
        subtotal += price.displayAmount;
        discount += multiChildDiscount;
        lines.push({ childLabel: child.fullName || `Child ${childIndex + 1}`, offerTitle: offer.title, price, multiChildDiscount });
      });
    });
    return { currency: selectedPhoneCountry.currency, subtotal, discount, total: subtotal - discount, lines };
  }, [children, offerMap, selectedPhoneCountry]);

  function updateChild(index: number, patch: Partial<ChildForm>) {
    setChildren((current) => current.map((child, currentIndex) => (currentIndex === index ? { ...child, ...patch } : child)));
  }

  function addChild() {
    setChildren((current) => [...current, emptyChild()]);
  }

  function removeChild(index: number) {
    setChildren((current) => (current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index)));
  }

  function selectOffer(index: number, offerSlug: string) {
    setChildren((current) =>
      current.map((child, currentIndex) => {
        if (currentIndex !== index) return child;
        return { ...child, selectedOfferSlugs: offerSlug ? [offerSlug] : [] };
      }),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setManualProofMessage(null);
    setIsSubmitting(true);

    if (password !== confirmPassword) {
      setError("Password and confirm password must match.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { firstName, lastName } = splitName(guardianFullName);
      const signupResponse = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email: parentEmail,
          password,
          phoneCountryCode: selectedPhoneCountry.dialCode,
          phoneNumber,
          billingCountryCode: selectedPhoneCountry.code,
          billingCountryName: selectedPhoneCountry.name,
        }),
      });

      if (!signupResponse.ok) {
        const signupPayload = (await signupResponse.json()) as { error?: string };
        const message = signupPayload.error ?? "Unable to create account.";
        if (!message.toLowerCase().includes("already") && !message.toLowerCase().includes("exist")) throw new Error(message);
      }

      const registrationResponse = await fetch("/api/registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentFirstName: firstName,
          parentLastName: lastName,
          parentEmail,
          phoneCountryCode: selectedPhoneCountry.dialCode,
          phoneNumber,
          whatsappNumber: "",
          selectedCountryCode: selectedPhoneCountry.code,
          selectedCountryName: selectedPhoneCountry.name,
          notes: "",
          students: children.map((child) => {
            const childName = splitName(child.fullName);
            return {
              firstName: childName.firstName,
              lastName: childName.lastName,
              age: Number(child.age),
              gender: child.gender,
              selectedOfferSlugs: child.selectedOfferSlugs,
              notes: "",
            };
          }),
        }),
      });

      const registrationPayload = (await registrationResponse.json()) as DraftResponse & { error?: string };
      if (!registrationResponse.ok) throw new Error(registrationPayload.error ?? "Unable to create registration draft.");
      setDraft(registrationPayload);

      const checkoutResponse = await fetch(`/api/registration/${registrationPayload.registrationId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway: selectedGateway }),
      });

      const checkoutPayload = (await checkoutResponse.json()) as CheckoutResponse & { error?: string };
      if (!checkoutResponse.ok) throw new Error(checkoutPayload.error ?? "Unable to create checkout draft.");
      setSuccess(checkoutPayload);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to complete registration.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleManualProofSubmit() {
    if (!success?.paymentId) return;
    setError(null);
    setManualProofMessage(null);
    setIsSubmittingProof(true);

    try {
      const response = await fetch(`/api/payments/manual/${success.paymentId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderName, senderNumber, referenceKey, screenshotUrl, notes: manualNotes }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to submit manual payment proof.");
      setManualProofMessage("Payment proof submitted successfully. The admin team can now review and confirm your transfer.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit manual proof.");
    } finally {
      setIsSubmittingProof(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#f39f5f] px-7 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(243,159,95,0.28)] transition hover:bg-[#e87115]"
      >
        Enroll now
      </button>

      {mounted && isOpen
        ? createPortal(
        <div className="fixed inset-0 z-[400] overflow-hidden bg-[rgba(28,38,55,0.42)] px-4 py-6 backdrop-blur-[4px] sm:px-6 sm:py-10">
          <div className="mx-auto flex h-full w-full max-w-[1140px] items-center justify-center">
            <div className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[26px] border border-[#ead9c5] bg-[#fffaf5] shadow-[0_32px_90px_rgba(16,28,43,0.28)]">
              <div className="flex items-center justify-between gap-5 border-b border-[#efdfcd] bg-[linear-gradient(135deg,#fff1df_0%,#fff7ee_55%,#fff3e4_100%)] px-5 py-4 sm:px-6">
                <div className="inline-flex rounded-full bg-[#f39f5f] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(243,159,95,0.22)]">
                  Gen-Mumins registration
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-[#d9c4aa] bg-white text-xl leading-none text-[#8b5a2b] transition hover:bg-[#fff0dd]"
                  aria-label="Close registration modal"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.95fr)_320px] lg:items-start">
                  <div className="space-y-5">
                    {sectionCard(
                      <>
                        <h3 className="text-left text-lg font-semibold text-[#22304a]">Parent / Guardian information</h3>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Full name*</label>
                            <input value={guardianFullName} onChange={(event) => setGuardianFullName(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Enter full name" required />
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Email address*</label>
                            <input type="email" value={parentEmail} onChange={(event) => setParentEmail(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Enter email address" required />
                          </div>
                          <div>
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Create password*</label>
                            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Minimum 8 characters" required />
                          </div>
                          <div>
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Confirm password*</label>
                            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Re-enter password" required />
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Phone / WhatsApp number*</label>
                            <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
                              <select value={selectedCountryCode} onChange={(event) => setSelectedCountryCode(event.target.value)} className="rounded-2xl border border-[#d8c3ac] bg-white px-3 py-3 text-sm outline-none focus:border-[#f39f5f]">
                                {PHONE_COUNTRIES.map((country) => (
                                  <option key={country.code} value={country.code}>{country.flag} {country.name} ({country.dialCode})</option>
                                ))}
                              </select>
                              <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Phone number" required />
                            </div>
                          </div>
                        </div>
                      </>,
                    )}

                    <section className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-left text-lg font-semibold text-[#22304a]">Child information</h3>
                          <p className="mt-1 text-sm text-[#657284]">Select one programme path for each child. 50% auto-discount applies from the second child onward.</p>
                        </div>
                        <button type="button" onClick={addChild} className="cursor-pointer rounded-full bg-[#fff0dd] px-4 py-2 text-sm font-semibold text-[#b1692a] transition hover:bg-[#ffe2bf]">Add child</button>
                      </div>

                      {children.map((child, index) => (
                        <div key={index} className="rounded-[22px] border border-[#f0deca] bg-[#fffdf9] p-5 shadow-[0_10px_30px_rgba(194,122,44,0.08)]">
                          <div className="flex items-center justify-between gap-4">
                            <h4 className="text-base font-semibold text-[#22304a]">Child {index + 1}</h4>
                            {children.length > 1 ? <button type="button" onClick={() => removeChild(index)} className="cursor-pointer text-sm font-semibold text-[#c45555]">Remove</button> : null}
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.4fr)_120px_150px]">
                            <div>
                              <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Child full name</label>
                              <input value={child.fullName} onChange={(event) => updateChild(index, { fullName: event.target.value })} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Enter child full name" required />
                            </div>
                            <div>
                              <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Age</label>
                              <input type="number" min="4" max="18" value={child.age} onChange={(event) => updateChild(index, { age: event.target.value })} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" required />
                            </div>
                            <div>
                              <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Gender</label>
                              <select value={child.gender} onChange={(event) => updateChild(index, { gender: event.target.value })} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" required>
                                <option value="">Select</option>
                                <option value="Boy">Boy</option>
                                <option value="Girl">Girl</option>
                              </select>
                            </div>
                          </div>

                          <div className="mt-5 space-y-3">
                            <label className="block text-left text-sm font-medium text-[#38506a]">Programme selection</label>
                            <select
                              value={child.selectedOfferSlugs[0] ?? ""}
                              onChange={(event) => selectOffer(index, event.target.value)}
                              className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]"
                              required
                            >
                              {orderedOffers.map((offer) => (
                                <option key={offer.slug} value={offer.slug}>
                                  {offerLabel(offer)}
                                </option>
                              ))}
                            </select>
                            {(() => {
                              const selectedOffer = offerMap.get(child.selectedOfferSlugs[0] ?? "");
                              if (!selectedOffer) return null;
                              const price = getRegionalPrice(selectedOffer, selectedPhoneCountry);
                              const originalGbp = originalPriceGbp(selectedOffer);
                              return (
                                <div className="rounded-[22px] border border-[#ebdccb] bg-white px-4 py-4">
                                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="max-w-[70%]">
                                      <p className="text-lg font-semibold text-[#22304a]">{selectedOffer.title}</p>
                                      {offerSummary(selectedOffer) ? <p className="mt-1 text-sm text-[#657284]">{offerSummary(selectedOffer)}</p> : null}
                                    </div>
                                    <div className="rounded-[20px] bg-[#fffaf4] px-4 py-3 text-right md:min-w-[170px]">
                                      {originalGbp ? <p className="text-sm font-medium text-[#9a8b7d] line-through">{formatMoney(originalGbp, "GBP")}</p> : null}
                                      <p className="mt-1 text-2xl font-semibold text-[#22304a]">{formatMoney(price.displayAmount, price.displayCurrency)}</p>
                                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8f7c69]">/per month</p>
                                      {price.usesRegionalPricing ? <p className="mt-2 text-xs font-medium text-[#c27a2c]">{price.discountPercent}% off ({formatMoney(price.discountedGbp, "GBP")})</p> : null}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      ))}
                    </section>
                  </div>

                  <aside className="space-y-5">
                    {sectionCard(
                      <>
                        <div className="flex items-center justify-between gap-3 border-b border-[#f0e2d2] pb-3">
                          <h3 className="text-lg font-semibold text-[#22304a]">Order summary</h3>
                          <span className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">{formatMoney(summary.total, summary.currency)}</span>
                        </div>
                        <div className="mt-4 space-y-3">
                          {summary.lines.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[#ebdccb] bg-white px-4 py-4 text-sm text-[#6d7785]">Choose programmes on the left to unlock the full summary and payment options.</div>
                          ) : (
                            <>
                              {children.length > 1 ? (
                                <div className="rounded-2xl border border-[#f6d8b3] bg-[#fff7ea] px-4 py-3 text-sm text-[#9b6328]">
                                  50% auto-discount is applied from the second child onward.
                                </div>
                              ) : null}
                              {summary.lines.map((line, index) => (
                                <div key={`${line.offerTitle}-${index}`} className="rounded-2xl border border-[#efe2d2] bg-white px-4 py-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-[#22304a]">{line.offerTitle}</p>
                                      <p className="mt-1 text-sm text-[#6d7785]">{line.childLabel}</p>
                                      {line.multiChildDiscount > 0 ? <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#c27a2c]">Second child 50% auto-discount</p> : null}
                                    </div>
                                    <div className="text-right text-sm">
                                      <p className="font-semibold text-[#22304a]">{formatMoney(line.price.displayAmount, line.price.displayCurrency)}</p>
                                      {line.multiChildDiscount > 0 ? <p className="mt-1 font-medium text-[#c27a2c]">- {formatMoney(line.multiChildDiscount, line.price.displayCurrency)}</p> : null}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                        <div className="mt-4 rounded-[22px] bg-[#22304a] px-4 py-4 text-white">
                          <div className="flex items-center justify-between text-sm text-white/80"><span>Subtotal</span><span>{formatMoney(summary.subtotal, summary.currency)}</span></div>
                          <div className="mt-2 flex items-center justify-between text-sm text-[#f8d39f]"><span>Discounts</span><span>- {formatMoney(summary.discount, summary.currency)}</span></div>
                          <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold"><span>Total</span><span>{formatMoney(summary.total, summary.currency)}</span></div>
                        </div>
                      </>,
                    )}

                    {sectionCard(
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-lg font-semibold text-[#22304a]">Payment method</h3>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isFormReadyForPayment ? "bg-[#ecf8f0] text-[#2f6b4b]" : "bg-[#f2f4f7] text-[#7a8698]"}`}>{isFormReadyForPayment ? "Active" : "Complete form first"}</span>
                        </div>
                        <div className="mt-4 space-y-3">
                          {PAYMENT_METHODS.map((method) => (
                            <label key={method.value} className={`block cursor-pointer rounded-2xl border px-4 py-3 transition ${selectedGateway === method.value ? "border-[#f3a25d] bg-[#fff1df]" : "border-[#ebdccb] bg-white"} ${isFormReadyForPayment ? "opacity-100" : "opacity-55"}`}>
                              <div className="flex items-start gap-3">
                                <input type="radio" name="gateway" checked={selectedGateway === method.value} onChange={() => setSelectedGateway(method.value)} disabled={!isFormReadyForPayment} className="mt-1" />
                                <div>
                                  <p className="font-semibold text-[#22304a]">{method.label}</p>
                                  <p className="mt-1 text-sm leading-6 text-[#6d7785]">{method.description}</p>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </>,
                    )}

                    {draft ? <div className="rounded-2xl border border-[#ead8c3] bg-[#fffaf4] px-4 py-3 text-sm text-[#5f6b7a]"><p className="font-semibold text-[#22304a]">Draft saved</p><p className="mt-1">Registration ID: {draft.registrationId}</p></div> : null}
                    {success ? <div className="rounded-2xl border border-[#d7efdf] bg-[#effaf3] px-4 py-3 text-sm leading-7 text-[#2f6b4b]"><p className="font-semibold">Order {success.orderNumber} is ready.</p><p className="mt-1">{success.nextStep}</p>{success.checkoutUrl ? <p className="mt-2 text-xs">If redirect does not start automatically, click the submit button again.</p> : null}</div> : null}
                    {error ? <div className="rounded-2xl border border-[#f0cccc] bg-[#fff4f4] px-4 py-3 text-sm text-[#a23c3c]">{error}</div> : null}

                    {selectedGateway === "BANK_TRANSFER" && success?.manualInstructions ? (
                      sectionCard(
                        <>
                          <h3 className="text-lg font-semibold text-[#22304a]">Manual bank transfer</h3>
                          <div className="mt-3 space-y-2 text-sm text-[#6c5a39]">
                            <p><span className="font-semibold">Bank:</span> {success.manualInstructions.bankName}</p>
                            <p><span className="font-semibold">Account name:</span> {success.manualInstructions.accountName}</p>
                            <p><span className="font-semibold">Account number:</span> {success.manualInstructions.accountNumber}</p>
                            {success.manualInstructions.sortCode ? <p><span className="font-semibold">Sort code:</span> {success.manualInstructions.sortCode}</p> : null}
                            {success.manualInstructions.iban ? <p><span className="font-semibold">IBAN:</span> {success.manualInstructions.iban}</p> : null}
                            {success.manualInstructions.swiftCode ? <p><span className="font-semibold">SWIFT:</span> {success.manualInstructions.swiftCode}</p> : null}
                            {success.manualInstructions.branchAddress ? <p><span className="font-semibold">Branch:</span> {success.manualInstructions.branchAddress}</p> : null}
                            {success.manualInstructions.whatsapp ? <p><span className="font-semibold">Support WhatsApp:</span> {success.manualInstructions.whatsapp}</p> : null}
                          </div>
                          <div className="mt-3 space-y-2 text-sm text-[#6c5a39]">
                            {success.manualInstructions.instructions.map((instruction, index) => <p key={index}>{index + 1}. {instruction}</p>)}
                          </div>
                          <div className="mt-4 space-y-3 rounded-2xl bg-white p-4">
                            <p className="text-sm font-semibold text-[#22304a]">Submit payment proof</p>
                            <input value={senderName} onChange={(event) => setSenderName(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Sender name" />
                            <input value={senderNumber} onChange={(event) => setSenderNumber(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Sender number / account" />
                            <input value={referenceKey} onChange={(event) => setReferenceKey(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Bank transfer reference" />
                            <input value={screenshotUrl} onChange={(event) => setScreenshotUrl(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Proof screenshot URL" />
                            <textarea value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} className="min-h-24 w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Optional notes for admin review" />
                            {manualProofMessage ? <div className="rounded-2xl bg-[#effaf3] px-4 py-3 text-sm text-[#2f6b4b]">{manualProofMessage}</div> : null}
                            <button type="button" onClick={handleManualProofSubmit} disabled={isSubmittingProof} className="w-full cursor-pointer rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{isSubmittingProof ? "Submitting proof..." : "Submit transfer proof"}</button>
                          </div>
                        </>,
                      )
                    ) : null}

                    <button type="submit" disabled={isSubmitting} className="w-full cursor-pointer rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#182235] disabled:cursor-not-allowed disabled:opacity-60">
                      {isSubmitting ? "Submitting..." : success?.checkoutUrl ? "Retry payment handoff" : "Complete enrollment"}
                    </button>
                  </aside>
                </div>
              </form>
            </div>
          </div>
        </div>
          ,
          document.body,
        )
        : null}
    </>
  );
}
