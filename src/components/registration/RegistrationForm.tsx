
"use client";

import { useEffect, useMemo, useState } from "react";

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
  { value: "BANK_TRANSFER", label: "Manual bank transfer", description: "Create the order, show bank details, and submit proof for manual verification." },
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

function offerCopy(offer: Offer) {
  if (offer.kind === "BUNDLE") return "Includes Seerah, Life Lessons & Leadership, Arabic, and Quranic Tajweed.";
  if (offer.kind === "PAIR") return "Arabic language and Quranic Tajweed taught together as one paired pathway.";
  return offer.description ?? "Monthly live programme enrolment.";
}

export function RegistrationForm({ offers, autoOpen = false }: Props) {
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

  useEffect(() => {
    if (autoOpen) {
      setIsOpen(true);
    }
  }, [autoOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
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

  function isOfferDisabled(child: ChildForm, offer: Offer) {
    const isSelected = child.selectedOfferSlugs.includes(offer.slug);
    if (isSelected) return false;
    const selectedOffers = child.selectedOfferSlugs.map((slug) => offerMap.get(slug)).filter(Boolean) as Offer[];
    const hasBundle = selectedOffers.some((entry) => entry.kind === "BUNDLE");
    const nonBundleCount = selectedOffers.filter((entry) => entry.kind !== "BUNDLE").length;
    if (offer.kind === "BUNDLE") return nonBundleCount > 0;
    if (hasBundle) return true;
    return nonBundleCount >= 2;
  }

  function toggleOffer(index: number, offer: Offer) {
    setChildren((current) => current.map((child, currentIndex) => {
      if (currentIndex !== index) return child;
      const isSelected = child.selectedOfferSlugs.includes(offer.slug);
      if (isSelected) return { ...child, selectedOfferSlugs: child.selectedOfferSlugs.filter((slug) => slug !== offer.slug) };
      if (offer.kind === "BUNDLE") return { ...child, selectedOfferSlugs: [offer.slug] };
      const selectedOffers = child.selectedOfferSlugs.map((slug) => offerMap.get(slug)).filter(Boolean) as Offer[];
      const hasBundle = selectedOffers.some((entry) => entry.kind === "BUNDLE");
      const nonBundleCount = selectedOffers.filter((entry) => entry.kind !== "BUNDLE").length;
      if (hasBundle || nonBundleCount >= 2) return child;
      return { ...child, selectedOfferSlugs: [...child.selectedOfferSlugs, offer.slug] };
    }));
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
        if (!message.toLowerCase().includes("already") && !message.toLowerCase().includes("exist")) {
          throw new Error(message);
        }
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
      if (!registrationResponse.ok) {
        throw new Error(registrationPayload.error ?? "Unable to create registration draft.");
      }
      setDraft(registrationPayload);

      const checkoutResponse = await fetch(`/api/registration/${registrationPayload.registrationId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway: selectedGateway }),
      });

      const checkoutPayload = (await checkoutResponse.json()) as CheckoutResponse & { error?: string };
      if (!checkoutResponse.ok) {
        throw new Error(checkoutPayload.error ?? "Unable to create checkout draft.");
      }

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
        body: JSON.stringify({
          senderName,
          senderNumber,
          referenceKey,
          screenshotUrl,
          notes: manualNotes,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit manual payment proof.");
      }

      setManualProofMessage("Payment proof submitted successfully. The admin team can now review and confirm your transfer.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit manual proof.");
    } finally {
      setIsSubmittingProof(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="inline-flex rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#182235]">
        Enroll now
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#142033]/55 px-3 py-6 backdrop-blur-sm sm:px-6">
          <div className="relative my-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_28px_110px_rgba(20,32,51,0.28)]">
            <div className="flex items-start justify-between border-b border-[#efe7d8] px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Gen-Mumins</p>
                <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Complete your registration</h2>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="rounded-full border border-[#e7dcc9] px-3 py-2 text-sm font-semibold text-[#5f6b7a] transition hover:bg-[#f8f2e7]">
                Close
              </button>
            </div>

            <form className="grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_380px]" onSubmit={handleSubmit}>
              <div className="px-5 py-5 sm:px-7 sm:py-6">
                <div className="space-y-7">
                  <section className="space-y-4 rounded-[1.5rem] border border-[#efe7d8] bg-[#fffdf9] p-4 sm:p-5">
                    <h3 className="text-lg font-semibold text-[#22304a]">Parent / Guardian information</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label className="mb-2 block text-sm font-medium text-[#405166]">Parent / Guardian full name</label>
                        <input value={guardianFullName} onChange={(event) => setGuardianFullName(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm outline-none transition focus:border-[#3a7a5e]" placeholder="Enter full name" required />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[#405166]">Email address</label>
                        <input type="email" value={parentEmail} onChange={(event) => setParentEmail(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm outline-none transition focus:border-[#3a7a5e]" placeholder="Enter email address" required />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[#405166]">Phone number</label>
                        <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-3">
                          <select value={selectedCountryCode} onChange={(event) => setSelectedCountryCode(event.target.value)} className="rounded-2xl border border-[#d9deea] px-3 py-3 text-sm outline-none transition focus:border-[#3a7a5e]">
                            {PHONE_COUNTRIES.map((country) => (
                              <option key={country.code} value={country.code}>{country.flag} {country.dialCode}</option>
                            ))}
                          </select>
                          <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm outline-none transition focus:border-[#3a7a5e]" placeholder="Phone number" required />
                        </div>
                        <p className="mt-2 text-xs text-[#6d7785]">{selectedPhoneCountry.flag} {selectedPhoneCountry.name} {selectedPhoneCountry.dialCode}</p>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[#405166]">Password</label>
                        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm outline-none transition focus:border-[#3a7a5e]" placeholder="Minimum 8 characters" required />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-[#405166]">Confirm password</label>
                        <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm outline-none transition focus:border-[#3a7a5e]" placeholder="Re-enter password" required />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold text-[#22304a]">Child information</h3>
                      <button type="button" onClick={addChild} className="rounded-full border border-[#22304a] px-4 py-2 text-sm font-semibold text-[#22304a] transition hover:bg-[#22304a] hover:text-white">
                        Add child
                      </button>
                    </div>

                    {children.map((child, index) => (
                      <div key={index} className="space-y-4 rounded-[1.5rem] border border-[#efe7d8] bg-white p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-4">
                          <h4 className="text-base font-semibold text-[#22304a]">Child {index + 1}</h4>
                          {children.length > 1 ? <button type="button" onClick={() => removeChild(index)} className="text-sm font-semibold text-[#b65656]">Remove</button> : null}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.45fr)_120px_140px]">
                          <div className="sm:col-span-2 xl:col-span-1">
                            <label className="mb-2 block text-sm font-medium text-[#405166]">Child full name</label>
                            <input value={child.fullName} onChange={(event) => updateChild(index, { fullName: event.target.value })} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm outline-none transition focus:border-[#3a7a5e]" placeholder="Enter child full name" required />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-[#405166]">Age</label>
                            <input type="number" min="4" max="18" value={child.age} onChange={(event) => updateChild(index, { age: event.target.value })} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm outline-none transition focus:border-[#3a7a5e]" required />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-[#405166]">Gender</label>
                            <select value={child.gender} onChange={(event) => updateChild(index, { gender: event.target.value })} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm outline-none transition focus:border-[#3a7a5e]" required>
                              <option value="">Select</option>
                              <option value="Boy">Boy</option>
                              <option value="Girl">Girl</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-[#405166]">Programme selection</label>
                          <div className="grid gap-3 md:grid-cols-2">
                            {offers.map((offer) => {
                              const selected = child.selectedOfferSlugs.includes(offer.slug);
                              const disabled = isOfferDisabled(child, offer);
                              const price = getRegionalPrice(offer, selectedPhoneCountry);
                              return (
                                <button key={offer.slug} type="button" disabled={disabled} onClick={() => toggleOffer(index, offer)} className={`rounded-[1.4rem] border px-4 py-4 text-left transition ${selected ? "border-[#3a7a5e] bg-[#eff8f2]" : disabled ? "border-[#ece7de] bg-[#f5f2ed] opacity-55" : "border-[#e4ded2] bg-[#fffdf9] hover:border-[#c8d9cf]"}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-base font-semibold text-[#22304a]">{offer.title}</p>
                                      <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">{offerCopy(offer)}</p>
                                    </div>
                                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a] shadow-sm">{selected ? "Selected" : "Select"}</span>
                                  </div>
                                  <div className="mt-4 rounded-2xl bg-white/80 px-3 py-3">
                                    <p className="text-sm font-semibold text-[#22304a]">{formatMoney(price.displayAmount, price.displayCurrency)}{price.usesRegionalPricing ? <span className="ml-2 text-xs font-medium text-[#5f6b7a]">({formatMoney(price.discountedGbp, "GBP")})</span> : null}</p>
                                    {price.usesRegionalPricing ? <p className="mt-1 text-xs font-semibold text-[#3a7a5e]">{price.discountPercent}% regional discount applied</p> : null}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </section>
                </div>
              </div>
              <aside className="border-t border-[#efe7d8] bg-[#fbfaf7] px-5 py-5 lg:border-l lg:border-t-0 lg:px-6 lg:py-6">
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Order summary</p>
                    <h3 className="mt-2 text-xl font-semibold text-[#22304a]">Live total</h3>
                  </div>

                  <div className="space-y-3">
                    {summary.lines.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#d8d3c8] bg-white px-4 py-4 text-sm text-[#6d7785]">Choose a programme to start the summary.</div>
                    ) : (
                      summary.lines.map((line, index) => (
                        <div key={`${line.offerTitle}-${index}`} className="rounded-2xl border border-[#ece7de] bg-white px-4 py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[#22304a]">{line.offerTitle}</p>
                              <p className="mt-1 text-sm text-[#6d7785]">{line.childLabel}</p>
                            </div>
                            <div className="text-right text-sm">
                              <p className="font-semibold text-[#22304a]">{formatMoney(line.price.displayAmount, line.price.displayCurrency)}</p>
                              {line.multiChildDiscount > 0 ? <p className="mt-1 font-medium text-[#3a7a5e]">- {formatMoney(line.multiChildDiscount, line.price.displayCurrency)}</p> : null}
                            </div>
                          </div>
                          {line.price.usesRegionalPricing ? <p className="mt-3 text-xs font-medium text-[#6d7785]">Compared with {formatMoney(line.price.convertedAmount, line.price.displayCurrency)}, this child is receiving a {line.price.discountPercent}% regional saving.</p> : null}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rounded-[1.5rem] bg-[#22304a] px-4 py-4 text-white">
                    <div className="flex items-center justify-between text-sm text-white/80"><span>Subtotal</span><span>{formatMoney(summary.subtotal, summary.currency)}</span></div>
                    <div className="mt-2 flex items-center justify-between text-sm text-[#96dfb7]"><span>Discounts</span><span>- {formatMoney(summary.discount, summary.currency)}</span></div>
                    <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-base font-semibold"><span>Total</span><span>{formatMoney(summary.total, summary.currency)}</span></div>
                  </div>

                  <div className={`space-y-3 rounded-[1.5rem] border px-4 py-4 ${isFormReadyForPayment ? "border-[#dce8e2] bg-white" : "border-[#ece7de] bg-[#f4f1ea]"}`}>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Payment method</p>
                      <h4 className="mt-2 text-base font-semibold text-[#22304a]">Choose how you want to pay</h4>
                    </div>
                    <div className="space-y-2">
                      {PAYMENT_METHODS.map((method) => (
                        <label key={method.value} className={`block rounded-2xl border px-3 py-3 transition ${selectedGateway === method.value ? "border-[#3a7a5e] bg-[#eff8f2]" : "border-[#ece7de] bg-white"} ${isFormReadyForPayment ? "opacity-100" : "opacity-55"}`}>
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
                  </div>

                  {draft ? <div className="rounded-2xl border border-[#ece7de] bg-white px-4 py-4 text-sm text-[#5f6b7a]"><p className="font-semibold text-[#22304a]">Draft saved</p><p className="mt-1">Registration ID: {draft.registrationId}</p></div> : null}
                  {success ? <div className="rounded-2xl border border-[#d7efdf] bg-[#effaf3] px-4 py-4 text-sm leading-7 text-[#2f6b4b]"><p className="font-semibold">Order {success.orderNumber} is ready.</p><p className="mt-1">{success.nextStep}</p>{success.checkoutUrl ? <p className="mt-2 text-xs">If redirect does not start automatically, use the payment button again.</p> : null}</div> : null}
                  {error ? <div className="rounded-2xl border border-[#f0cccc] bg-[#fff4f4] px-4 py-4 text-sm text-[#a23c3c]">{error}</div> : null}

                  {selectedGateway === "BANK_TRANSFER" && success?.manualInstructions ? (
                    <div className="space-y-4 rounded-[1.5rem] border border-[#f2dcc0] bg-[#fff7eb] px-4 py-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#b07b2d]">Manual bank transfer</p>
                        <h4 className="mt-2 text-base font-semibold text-[#22304a]">Transfer details</h4>
                      </div>
                      <div className="space-y-2 text-sm text-[#6c5a39]">
                        <p><span className="font-semibold">Bank:</span> {success.manualInstructions.bankName}</p>
                        <p><span className="font-semibold">Account name:</span> {success.manualInstructions.accountName}</p>
                        <p><span className="font-semibold">Account number:</span> {success.manualInstructions.accountNumber}</p>
                        {success.manualInstructions.sortCode ? <p><span className="font-semibold">Sort code:</span> {success.manualInstructions.sortCode}</p> : null}
                        {success.manualInstructions.iban ? <p><span className="font-semibold">IBAN:</span> {success.manualInstructions.iban}</p> : null}
                        {success.manualInstructions.swiftCode ? <p><span className="font-semibold">SWIFT:</span> {success.manualInstructions.swiftCode}</p> : null}
                        {success.manualInstructions.branchAddress ? <p><span className="font-semibold">Branch:</span> {success.manualInstructions.branchAddress}</p> : null}
                        {success.manualInstructions.whatsapp ? <p><span className="font-semibold">Support WhatsApp:</span> {success.manualInstructions.whatsapp}</p> : null}
                      </div>
                      <div className="space-y-2 text-sm text-[#6c5a39]">
                        {success.manualInstructions.instructions.map((instruction, index) => <p key={index}>{index + 1}. {instruction}</p>)}
                      </div>
                      <div className="space-y-3 rounded-2xl bg-white px-4 py-4">
                        <p className="text-sm font-semibold text-[#22304a]">Submit payment proof</p>
                        <input value={senderName} onChange={(event) => setSenderName(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" placeholder="Sender name" />
                        <input value={senderNumber} onChange={(event) => setSenderNumber(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" placeholder="Sender number / account" />
                        <input value={referenceKey} onChange={(event) => setReferenceKey(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" placeholder="Bank transfer reference" />
                        <input value={screenshotUrl} onChange={(event) => setScreenshotUrl(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" placeholder="Proof screenshot URL" />
                        <textarea value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} className="min-h-24 w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" placeholder="Optional notes for admin review" />
                        {manualProofMessage ? <div className="rounded-2xl bg-[#effaf3] px-4 py-3 text-sm text-[#2f6b4b]">{manualProofMessage}</div> : null}
                        <button type="button" onClick={handleManualProofSubmit} disabled={isSubmittingProof} className="w-full rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{isSubmittingProof ? "Submitting proof..." : "Submit transfer proof"}</button>
                      </div>
                    </div>
                  ) : null}

                  <button type="submit" disabled={isSubmitting} className="w-full rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#182235] disabled:cursor-not-allowed disabled:opacity-60">
                    {isSubmitting ? "Submitting..." : success?.checkoutUrl ? "Retry payment handoff" : "Complete enrollment"}
                  </button>
                </div>
              </aside>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}






