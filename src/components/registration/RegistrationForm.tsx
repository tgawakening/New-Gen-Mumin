"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { FULL_BUNDLE_COUPON_OFFER_SLUG, getDiscountCoupon } from "@/lib/registration/catalog";

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
  providerReference?: string | null;
  manualInstructions?: ManualInstructions | null;
};

type PaymentValue = "STRIPE" | "PAYPAL" | "BANK_TRANSFER";

type PhoneCountry = {
  code: string;
  name: string;
  flag: string;
  flagImageUrl: string;
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
  { value: "BANK_TRANSFER", label: "Manual payment", description: "Use Bank Transfer or JazzCash and then submit proof for review." },
];

const MANUAL_PAYMENT_PREVIEW: ManualInstructions = {
  whatsapp: "03181602388",
  instructions: [
    "Use your platform reference in the payment note.",
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

const DIAL_CODES: Record<string, string> = {
  GB: "+44",
  PK: "+92",
  IN: "+91",
  BD: "+880",
  AF: "+93",
  AE: "+971",
  SA: "+966",
  US: "+1",
  CA: "+1",
  AU: "+61",
  NZ: "+64",
  ZA: "+27",
  JP: "+81",
  IE: "+353",
  FR: "+33",
  DE: "+49",
  IT: "+39",
  ES: "+34",
  NL: "+31",
  BE: "+32",
  SE: "+46",
  NO: "+47",
  DK: "+45",
  CH: "+41",
  AT: "+43",
  TR: "+90",
  QA: "+974",
  KW: "+965",
  BH: "+973",
  OM: "+968",
  MY: "+60",
  SG: "+65",
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
  EUR: 1.17,
  TRY: 51,
  ZAR: 24,
  QAR: 4.63,
  KWD: 0.39,
  BHD: 0.48,
  OMR: 0.49,
  MYR: 5.98,
  SGD: 1.72,
  NZD: 2.1,
  CHF: 1.1,
  NOK: 13.6,
  SEK: 13.2,
  DKK: 8.8,
};

const REGIONAL_PRICE_OVERRIDES: Record<string, Partial<Record<string, number>>> = {
  US: {
    "full-bundle": 80,
  },
  AE: {
    "full-bundle": 200,
  },
  SA: {
    "full-bundle": 200,
  },
};

const emptyChild = (defaultOfferSlug?: string): ChildForm => ({
  fullName: "",
  age: "",
  gender: "",
  selectedOfferSlugs: defaultOfferSlug ? [defaultOfferSlug] : [],
});

function splitName(fullName: string) {
  const cleaned = fullName.trim().replace(/\s+/g, " ");
  const [firstName, ...rest] = cleaned.split(" ");
  return { firstName: firstName || cleaned, lastName: rest.join(" ") || "Parent" };
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function flagFromCountryCode(code: string) {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function flagImageUrl(code: string) {
  return `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;
}

function getRegionalPrice(offer: Offer, phoneCountry: PhoneCountry): PriceBreakdown {
  const explicitOverride = REGIONAL_PRICE_OVERRIDES[phoneCountry.code]?.[offer.slug];
  if (typeof explicitOverride === "number") {
    const convertedAmount = Math.round(offer.basePriceGbp * phoneCountry.gbpRate);
    const discountPercent = Math.max(0, Math.round((1 - explicitOverride / convertedAmount) * 100));
    return {
      displayCurrency: phoneCountry.currency,
      displayAmount: explicitOverride,
      convertedAmount,
      discountPercent,
      discountedGbp: Number((explicitOverride / phoneCountry.gbpRate).toFixed(1)),
      usesRegionalPricing: explicitOverride !== convertedAmount,
    };
  }

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

function getPasswordStrength(password: string) {
  if (!password) {
    return {
      tone: "text-[#657284]",
      message: "Use at least 8 characters. A mix of letters, numbers, and symbols makes it stronger.",
    };
  }

  if (password.length < 8) {
    return {
      tone: "text-[#b24c4c]",
      message: "Password must contain at least 8 characters.",
    };
  }

  const checks = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (checks >= 3) {
    return {
      tone: "text-[#2f6b4b]",
      message: "Strong password. Keep using a mix of letters, numbers, and symbols.",
    };
  }

  return {
    tone: "text-[#8a6326]",
    message: "Password is valid, but adding numbers, capitals, or symbols will make it stronger.",
  };
}

function generateStrongPassword() {
  const lowers = "abcdefghjkmnpqrstuvwxyz";
  const uppers = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const symbols = "!@#$%&*?";
  const all = `${lowers}${uppers}${numbers}${symbols}`;

  const required = [
    lowers[Math.floor(Math.random() * lowers.length)],
    uppers[Math.floor(Math.random() * uppers.length)],
    numbers[Math.floor(Math.random() * numbers.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  while (required.length < 12) {
    required.push(all[Math.floor(Math.random() * all.length)]);
  }

  return required.sort(() => Math.random() - 0.5).join("");
}

async function copyToClipboard(value: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) return;
  await navigator.clipboard.writeText(value);
}

export function RegistrationForm({ offers, countries, autoOpen = false }: Props) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [guardianFullName, setGuardianFullName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentCity, setParentCity] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("GB");
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [priorArabicKnowledge, setPriorArabicKnowledge] = useState("NONE");
  const [heardAboutGenM, setHeardAboutGenM] = useState("");
  const [hopesFromProgram, setHopesFromProgram] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [sourceTag, setSourceTag] = useState("");
  const [referrerUrl, setReferrerUrl] = useState("");
  const [children, setChildren] = useState<ChildForm[]>([emptyChild()]);
  const [selectedGateway, setSelectedGateway] = useState<PaymentValue>("STRIPE");
  const [manualMethod, setManualMethod] = useState<"BANK_TRANSFER" | "JAZZCASH">("BANK_TRANSFER");
  const [senderName, setSenderName] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [referenceKey, setReferenceKey] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualProofMessage, setManualProofMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [success, setSuccess] = useState<CheckoutResponse | null>(null);

  const phoneCountries = useMemo<PhoneCountry[]>(
    () =>
      countries.map((country) => ({
        code: country.code,
        name: country.name,
        flag: flagFromCountryCode(country.code),
        flagImageUrl: flagImageUrl(country.code),
        dialCode: DIAL_CODES[country.code] ?? "",
        currency: country.currency,
        gbpRate: GBP_RATES[country.currency] ?? 1,
      })),
    [countries],
  );

  const selectedPhoneCountry = phoneCountries.find((country) => country.code === selectedCountryCode) ?? phoneCountries[0];
  const passwordStrength = getPasswordStrength(password);
  const offerMap = useMemo(() => new Map(offers.map((offer) => [offer.slug, offer])), [offers]);
  const orderedOffers = useMemo(() => {
    const kindRank = { BUNDLE: 0, PAIR: 1, SINGLE: 2 };
    return [...offers].sort((left, right) => {
      const rankDifference = kindRank[left.kind] - kindRank[right.kind];
      if (rankDifference !== 0) return rankDifference;
      return left.basePriceGbp - right.basePriceGbp || left.title.localeCompare(right.title);
    });
  }, [offers]);
  const defaultOfferSlug = orderedOffers.find((offer) => offer.kind === "BUNDLE")?.slug
    ?? orderedOffers[0]?.slug
    ?? "";
  const bundleOfferSlug = defaultOfferSlug || FULL_BUNDLE_COUPON_OFFER_SLUG;
  const appliedCoupon = useMemo(() => getDiscountCoupon(couponCode), [couponCode]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (autoOpen) setIsOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    const coupon = params.get("coupon");
    const referrer = document.referrer;

    if (source) setSourceTag(source);
    if (coupon) setCouponCode(coupon.toUpperCase());
    if (referrer) setReferrerUrl(referrer);
    if (!source && referrer.includes("tga-awakening.com")) {
      setSourceTag("tga-projects-gen-mumin");
    }
  }, []);

  useEffect(() => {
    setChildren((current) =>
      current.map((child) =>
        child.selectedOfferSlugs.length === 0 && defaultOfferSlug
          ? { ...child, selectedOfferSlugs: [defaultOfferSlug] }
          : child,
      ),
    );
  }, [defaultOfferSlug]);

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
    if (!guardianFullName.trim() || !parentEmail.trim() || !parentCity.trim() || !phoneNumber.trim() || password.length < 8 || confirmPassword.length < 8) return false;
    if (password !== confirmPassword) return false;
    if (!heardAboutGenM.trim()) return false;
    if (hopesFromProgram.trim().split(/\s+/).filter(Boolean).length > 50) return false;
    return children.every((child) => child.fullName.trim() && child.age.trim() && child.gender.trim() && child.selectedOfferSlugs.length > 0);
  }, [children, confirmPassword, guardianFullName, heardAboutGenM, hopesFromProgram, parentCity, parentEmail, password, phoneNumber]);

  const couponEligibleForBundle = useMemo(
    () =>
      children.length > 0 &&
      children.every(
        (child) =>
          child.selectedOfferSlugs.length === 1 && child.selectedOfferSlugs[0] === bundleOfferSlug,
      ),
    [bundleOfferSlug, children],
  );

  const effectiveCoupon = couponEligibleForBundle ? appliedCoupon : null;

  const summary = useMemo(() => {
    const lines: Array<{ childLabel: string; offerTitle: string; price: PriceBreakdown; multiChildDiscount: number }> = [];
    let subtotal = 0;
    let multiChildDiscount = 0;
    children.forEach((child, childIndex) => {
      child.selectedOfferSlugs.forEach((slug) => {
        const offer = offerMap.get(slug);
        if (!offer) return;
        const price = getRegionalPrice(offer, selectedPhoneCountry);
        const lineMultiChildDiscount = childIndex === 0 ? 0 : Math.round(price.displayAmount * 0.5);
        subtotal += price.displayAmount;
        multiChildDiscount += lineMultiChildDiscount;
        lines.push({ childLabel: child.fullName || `Child ${childIndex + 1}`, offerTitle: offer.title, price, multiChildDiscount: lineMultiChildDiscount });
      });
    });
    const couponDiscount =
      effectiveCoupon ? Math.round((subtotal - multiChildDiscount) * (effectiveCoupon.discountPercent / 100)) : 0;
    return {
      currency: selectedPhoneCountry.currency,
      subtotal,
      multiChildDiscount,
      couponDiscount,
      discount: multiChildDiscount + couponDiscount,
      total: subtotal - multiChildDiscount - couponDiscount,
      couponCode: effectiveCoupon?.code ?? null,
      couponDiscountPercent: effectiveCoupon?.discountPercent ?? 0,
      lines,
    };
  }, [children, effectiveCoupon, offerMap, selectedPhoneCountry]);

  const couponFeedback = useMemo(() => {
    if (!couponCode.trim()) {
      return null;
    }

    if (!appliedCoupon) {
      return {
        tone: "error" as const,
        message: "This coupon code is not recognised.",
      };
    }

    if (!couponEligibleForBundle) {
      return {
        tone: "info" as const,
        message: "Coupon discounts apply only when every child is enrolled in the Gen-Mumins Full Bundle.",
      };
    }

    return {
      tone: "success" as const,
      message: `${appliedCoupon.discountPercent}% discount applied to this checkout.`,
    };
  }, [appliedCoupon, couponCode, couponEligibleForBundle]);

  const isPakistan = selectedPhoneCountry.code === "PK";
  const paypalEligible = summary.lines.length === 1 && summary.discount === 0;
  const availablePaymentMethods = PAYMENT_METHODS.filter((method) => {
    if (method.value === "BANK_TRANSFER") return isPakistan;
    if (method.value === "PAYPAL") return paypalEligible;
    return true;
  });

  useEffect(() => {
    if (!availablePaymentMethods.some((method) => method.value === selectedGateway)) {
      setSelectedGateway(availablePaymentMethods[0]?.value ?? "STRIPE");
    }
  }, [availablePaymentMethods, selectedGateway]);

  function updateChild(index: number, patch: Partial<ChildForm>) {
    setChildren((current) => current.map((child, currentIndex) => (currentIndex === index ? { ...child, ...patch } : child)));
  }

  function addChild() {
    setChildren((current) => [...current, emptyChild(defaultOfferSlug)]);
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

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      setIsSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and confirm password must match.");
      setIsSubmitting(false);
      return;
    }

    if (hopesFromProgram.trim().split(/\s+/).filter(Boolean).length > 50) {
      setError("What they hope to get from Gen-M must stay within 50 words.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { firstName, lastName } = splitName(guardianFullName);
      const compactGoal = hopesFromProgram.trim().replace(/\s+/g, " ").slice(0, 120);
      const registrationNotes = [
        `City:${parentCity}`,
        `Arabic:${priorArabicKnowledge}`,
        `Heard:${heardAboutGenM}`,
        compactGoal ? `Goal:${compactGoal}` : "",
        sourceTag ? `Source:${sourceTag}` : "",
      ]
        .filter(Boolean)
        .join(" | ")
        .slice(0, 240);
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
          couponCode: effectiveCoupon?.code ?? "",
          notes: registrationNotes,
          students: children.map((child) => {
            const childName = splitName(child.fullName);
            return {
              firstName: childName.firstName,
              lastName: childName.lastName,
              age: Number(child.age),
              gender: child.gender,
              selectedOfferSlugs: child.selectedOfferSlugs.length
                ? child.selectedOfferSlugs
                : (defaultOfferSlug ? [defaultOfferSlug] : []),
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
        body: JSON.stringify({ senderName, senderNumber, referenceKey, manualMethod, notes: manualNotes }),
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
        <div className="fixed inset-0 z-[400] overflow-hidden bg-[rgba(15,23,42,0.62)] px-4 py-6 backdrop-blur-[5px] sm:px-6 sm:py-10">
          <div className="mx-auto flex h-full w-full max-w-[1020px] items-center justify-center">
            <div className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-[24px] border border-[#ead9c5] bg-[#fffaf5] shadow-[0_34px_94px_rgba(8,15,30,0.34)]">
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

              <form onSubmit={handleSubmit} autoComplete="on" className="overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1.38fr)_360px] lg:items-start">
                  <div className="space-y-5">
                    {sectionCard(
                      <>
                        <h3 className="text-left text-lg font-semibold text-[#22304a]">Parent / Guardian information</h3>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Full name*</label>
                            <input name="name" autoComplete="name" value={guardianFullName} onChange={(event) => setGuardianFullName(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Enter full name" required />
                          </div>
                          <div>
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Email address*</label>
                            <input name="email" autoComplete="email" type="email" value={parentEmail} onChange={(event) => setParentEmail(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Enter email address" required />
                          </div>
                          <div>
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Create password*</label>
                            <div className="relative">
                              <input
                                name="new-password"
                                autoComplete="new-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 pr-12 text-sm outline-none focus:border-[#f39f5f]"
                                placeholder="Minimum 8 characters"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword((current) => !current)}
                                className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-[#6f7f92]"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            <p className={`mt-2 text-xs font-medium ${passwordStrength.tone}`}>
                              {passwordStrength.message}
                            </p>
                          </div>
                          <div>
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Confirm password*</label>
                            <div className="relative">
                              <input
                                name="confirm-password"
                                autoComplete="new-password"
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 pr-12 text-sm outline-none focus:border-[#f39f5f]"
                                placeholder="Re-enter password"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword((current) => !current)}
                                className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-[#6f7f92]"
                                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                              >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            {confirmPassword ? (
                              <p className={`mt-2 text-xs font-medium ${password === confirmPassword && password.length >= 8 ? "text-[#2f6b4b]" : "text-[#b24c4c]"}`}>
                                {password === confirmPassword
                                  ? password.length >= 8
                                    ? "Passwords match."
                                    : "Password still needs at least 8 characters."
                                  : "Passwords do not match."}
                              </p>
                            ) : null}
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">City*</label>
                            <input name="address-level2" autoComplete="address-level2" value={parentCity} onChange={(event) => setParentCity(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="City you are in" required />
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Phone / WhatsApp number*</label>
                            <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,220px)]">
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setIsCountryMenuOpen((current) => !current)}
                                  className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-[#d8c3ac] bg-white px-3 py-3 text-left text-sm outline-none transition focus:border-[#f39f5f]"
                                >
                                  <span className="flex min-w-0 items-center gap-3">
                                    <img src={selectedPhoneCountry.flagImageUrl} alt={`${selectedPhoneCountry.name} flag`} className="h-[18px] w-6 rounded-[3px] object-cover shadow-sm" />
                                    <span className="truncate text-[#22304a]">{selectedPhoneCountry.name}</span>
                                    <span className="shrink-0 text-[#6d7785]">{selectedPhoneCountry.dialCode}</span>
                                  </span>
                                  <span className="text-[#8b5a2b]">{isCountryMenuOpen ? "▲" : "▼"}</span>
                                </button>
                                {isCountryMenuOpen ? (
                                  <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-[#ead8c3] bg-white p-2 shadow-[0_18px_40px_rgba(34,48,74,0.16)]">
                                    {phoneCountries.map((country) => (
                                      <button
                                        key={country.code}
                                        type="button"
                                        onClick={() => {
                                          setSelectedCountryCode(country.code);
                                          setIsCountryMenuOpen(false);
                                        }}
                                        className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-[#22304a] transition hover:bg-[#fff4e7]"
                                      >
                                        <img src={country.flagImageUrl} alt={`${country.name} flag`} className="h-[18px] w-6 rounded-[3px] object-cover shadow-sm" />
                                        <span className="flex-1 truncate">{country.name}</span>
                                        <span className="text-[#6d7785]">{country.dialCode}</span>
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
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

                          <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,0.95fr)_100px_130px]">
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

                    {sectionCard(
                      <>
                        <h3 className="text-left text-lg font-semibold text-[#22304a]">A little more about your family</h3>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">Prior knowledge of Arabic</label>
                            <select value={priorArabicKnowledge} onChange={(event) => setPriorArabicKnowledge(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]">
                              <option value="NONE">None</option>
                              <option value="BEGINNER">Beginner</option>
                              <option value="INTERMEDIATE">Intermediate</option>
                              <option value="ADVANCED">Advanced</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">How they heard about Gen M*</label>
                            <select value={heardAboutGenM} onChange={(event) => setHeardAboutGenM(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" required>
                              <option value="">Select an option</option>
                              <option value="Friends and family">Friends and family</option>
                              <option value="Introductory session">Introductory session</option>
                              <option value="Youthlink">Youthlink</option>
                              <option value="School of Islam">School of Islam</option>
                              <option value="TGA community">TGA community</option>
                            </select>
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-2 block text-left text-sm font-medium text-[#38506a]">What they hope to get from it</label>
                            <textarea value={hopesFromProgram} onChange={(event) => setHopesFromProgram(event.target.value)} maxLength={400} className="min-h-24 w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Maximum 50 words" />
                            <p className={`mt-2 text-xs ${hopesFromProgram.trim().split(/\s+/).filter(Boolean).length <= 50 ? "text-[#657284]" : "text-[#b24c4c]"}`}>
                              {hopesFromProgram.trim() ? `${hopesFromProgram.trim().split(/\s+/).filter(Boolean).length}/50 words` : "Maximum 50 words"}
                            </p>
                          </div>
                        </div>
                      </>,
                    )}
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
                        <div className="mt-4">
                          <label className="block text-sm font-semibold text-[#22304a]">Coupon code</label>
                          <input
                            value={couponCode}
                            onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                            placeholder="Enter coupon code"
                            className="mt-2 w-full rounded-2xl border border-[#d9c7b0] bg-white px-4 py-3 text-sm text-[#22304a] outline-none transition placeholder:text-[#9ba6b5] focus:border-[#f3a25d] focus:ring-2 focus:ring-[#f8d9b6]"
                          />
                          {couponFeedback ? (
                            <p
                              className={`mt-2 rounded-2xl px-4 py-3 text-sm ${
                                couponFeedback.tone === "success"
                                  ? "bg-[#edf8ef] text-[#2f6b4b]"
                                  : couponFeedback.tone === "error"
                                    ? "bg-[#fff1f1] text-[#b43b3b]"
                                    : "bg-[#fff7eb] text-[#9b6328]"
                              }`}
                            >
                              {couponFeedback.message}
                            </p>
                          ) : null}
                          <div className="mt-3 rounded-2xl border border-[#f6d8b3] bg-[#fff7ea] px-4 py-3 text-sm leading-6 text-[#9b6328]">
                            Early bird offer for 3 days: use code <span className="font-semibold">GEN25</span> and get 25% off the Gen-Mumins Full Bundle.
                          </div>
                          {!couponEligibleForBundle ? (
                            <p className="mt-2 text-sm leading-6 text-[#6d7785]">
                              Discount codes work only for the Gen-Mumins Full Bundle selection for children.
                            </p>
                          ) : null}
                        </div>
                        <div className="mt-4 rounded-[22px] bg-[#22304a] px-4 py-4 text-white">
                          <div className="flex items-center justify-between text-sm text-white/80"><span>Subtotal</span><span>{formatMoney(summary.subtotal, summary.currency)}</span></div>
                          <div className="mt-2 flex items-center justify-between text-sm text-[#f8d39f]"><span>Multi-child discounts</span><span>- {formatMoney(summary.multiChildDiscount, summary.currency)}</span></div>
                          {summary.couponDiscount > 0 ? (
                            <div className="mt-2 flex items-center justify-between gap-3 text-sm text-[#f8d39f]">
                              <span className="flex items-center gap-2">
                                <span>Coupon discount</span>
                                <span className="rounded-full bg-[#2f6b4b] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                                  {summary.couponDiscountPercent}% applied
                                </span>
                              </span>
                              <span>- {formatMoney(summary.couponDiscount, summary.currency)}</span>
                            </div>
                          ) : null}
                          <div className="mt-2 flex items-center justify-between text-sm text-[#f8d39f]"><span>Total discounts</span><span>- {formatMoney(summary.discount, summary.currency)}</span></div>
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
                          {availablePaymentMethods.map((method) => (
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
                          {!paypalEligible ? (
                            <div className="rounded-2xl border border-[#f6d8b3] bg-[#fff7ea] px-4 py-3 text-sm text-[#9b6328]">
                              PayPal subscriptions are available for one programme selection at a time. For multi-child or discounted combinations, please use Stripe.
                            </div>
                          ) : null}
                          {!isPakistan ? (
                            <div className="rounded-2xl border border-[#e4ebf3] bg-[#f8fbff] px-4 py-3 text-sm text-[#5d6c81]">
                              Manual Bank Transfer and JazzCash are available only when Pakistan is selected as the country.
                            </div>
                          ) : null}
                        </div>
                      </>,
                    )}

                    {draft ? <div className="rounded-2xl border border-[#ead8c3] bg-[#fffaf4] px-4 py-3 text-sm text-[#5f6b7a]"><p className="font-semibold text-[#22304a]">Draft saved</p><p className="mt-1">Registration ID: {draft.registrationId}</p></div> : null}
                    {success ? <div className="rounded-2xl border border-[#d7efdf] bg-[#effaf3] px-4 py-3 text-sm leading-7 text-[#2f6b4b]"><p className="font-semibold">Order {success.orderNumber} is ready.</p><p className="mt-1">{success.nextStep}</p><p className="mt-2 text-xs">Your browser can save this password for future logins after account creation.</p>{success.checkoutUrl ? <p className="mt-2 text-xs">If redirect does not start automatically, click the submit button again.</p> : null}</div> : null}
                    {error ? <div className="rounded-2xl border border-[#f0cccc] bg-[#fff4f4] px-4 py-3 text-sm text-[#a23c3c]">{error}</div> : null}

                    {selectedGateway === "BANK_TRANSFER" ? (
                      sectionCard(
                        <>
                          <h3 className="text-lg font-semibold text-[#22304a]">Manual payment</h3>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(success?.manualInstructions ?? MANUAL_PAYMENT_PREVIEW).channels.map((channel) => (
                              <button
                                key={channel.id}
                                type="button"
                                onClick={() => setManualMethod(channel.id)}
                                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${manualMethod === channel.id ? "border-[#2a76aa] bg-[#eaf5ff] text-[#22304a]" : "border-[#d7e5f2] bg-white text-[#38506a]"}`}
                              >
                                {channel.title}
                              </button>
                            ))}
                          </div>
                          {(() => {
                            const instructions = success?.manualInstructions ?? MANUAL_PAYMENT_PREVIEW;
                            const activeChannel = instructions.channels.find((channel) => channel.id === manualMethod) ?? instructions.channels[0];
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
                                          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#66758a]">{field.label}</p>
                                          <p className="mt-1 font-medium text-[#22304a]">{field.value}</p>
                                        </div>
                                        <button type="button" onClick={() => copyToClipboard(field.value)} className="rounded-lg border border-[#cfe1f5] bg-[#f5fbff] px-3 py-2 text-xs font-semibold text-[#2a76aa]">
                                          Copy
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                          {(success?.manualInstructions ?? MANUAL_PAYMENT_PREVIEW).whatsapp ? (
                            <div className="mt-3 rounded-2xl border border-[#f0d8b0] bg-[#fff5e4] px-4 py-3 text-sm text-[#8d5b22]">
                              Got stuck in payment? Contact our support team on {(success?.manualInstructions ?? MANUAL_PAYMENT_PREVIEW).whatsapp}.
                            </div>
                          ) : null}
                          <div className="mt-4 space-y-3 rounded-2xl bg-white p-4">
                            <p className="text-sm font-semibold text-[#22304a]">Submit payment proof</p>
                            <input value={senderName} onChange={(event) => setSenderName(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Sender name" />
                            <input value={senderNumber} onChange={(event) => setSenderNumber(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Sender number / account" />
                            <input value={referenceKey} onChange={(event) => setReferenceKey(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Transaction / reference ID" />
                            <textarea value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} className="min-h-24 w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Optional notes for admin review" />
                            {manualProofMessage ? <div className="rounded-2xl bg-[#effaf3] px-4 py-3 text-sm text-[#2f6b4b]">{manualProofMessage}</div> : null}
                            <button type="button" onClick={handleManualProofSubmit} disabled={isSubmittingProof || !success?.paymentId} className="w-full cursor-pointer rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{isSubmittingProof ? "Submitting proof..." : success?.paymentId ? "Submit transfer proof" : "Create the order first to submit proof"}</button>
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
