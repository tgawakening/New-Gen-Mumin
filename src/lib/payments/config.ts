export type ManualPaymentChannel = {
  id: "BANK_TRANSFER" | "JAZZCASH";
  title: string;
  badge: string;
  fields: Array<{
    label: string;
    value: string;
  }>;
};

export type ManualPaymentDetails = {
  whatsapp?: string;
  instructions: string[];
  channels: ManualPaymentChannel[];
};

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export function getAppUrl() {
  return required("APP_URL").replace(/\/$/, "");
}

export function getStripeSecretKey() {
  return required("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret() {
  return required("STRIPE_WEBHOOK_SECRET");
}

export function getPayPalClientId() {
  return required("PAYPAL_CLIENT_ID");
}

export function getPayPalClientSecret() {
  return required("PAYPAL_CLIENT_SECRET");
}

export function getPayPalProductId() {
  return required("PAYPAL_PRODUCT_ID");
}

export function getPayPalBaseUrl() {
  return process.env.PAYPAL_ENVIRONMENT === "LIVE"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

type PayPalPlanLookupInput = {
  offerSlug: string;
  currency: string;
  countryCode: string;
};

export function getPayPalPlanId(input: PayPalPlanLookupInput) {
  const normalizedCurrency = input.currency.toUpperCase();
  const normalizedCountry = input.countryCode.toUpperCase();

  if (normalizedCurrency === "GBP") {
    if (input.offerSlug === "full-bundle") return required("PAYPAL_PLAN_GBP_BUNDLE");
    if (input.offerSlug === "arabic-tajweed-pair") return required("PAYPAL_PLAN_GBP_PAIR");
    if (input.offerSlug === "seerah-leadership-bundle") return required("PAYPAL_PLAN_GBP_SEERAH_LEADERSHIP");
    if (input.offerSlug === "seerah-single") return required("PAYPAL_PLAN_GBP_SEERAH");
    if (input.offerSlug === "life-lessons-single") return required("PAYPAL_PLAN_GBP_LIFE_LESSONS");
  }

  if (normalizedCurrency === "USD" && input.offerSlug === "seerah-leadership-bundle") {
    return required("PAYPAL_PLAN_USD_SEERAH_LEADERSHIP");
  }

  if (normalizedCurrency === "USD" && input.offerSlug === "full-bundle") {
    return required("PAYPAL_PLAN_USD_BUNDLE");
  }

  if (normalizedCurrency === "CAD" && input.offerSlug === "seerah-leadership-bundle") {
    return required("PAYPAL_PLAN_CAD_SEERAH_LEADERSHIP");
  }

  if (normalizedCurrency === "AED" && input.offerSlug === "full-bundle") {
    return required("PAYPAL_PLAN_AED_BUNDLE");
  }

  if (normalizedCurrency === "SAR" && input.offerSlug === "full-bundle") {
    return required("PAYPAL_PLAN_SAR_BUNDLE");
  }

  if (normalizedCurrency === "PKR" || normalizedCountry === "PK" || normalizedCountry === "IN" || normalizedCountry === "BD" || normalizedCountry === "AF") {
    if (input.offerSlug === "full-bundle") return required("PAYPAL_PLAN_PKR_BUNDLE");
    if (input.offerSlug === "arabic-tajweed-pair") return required("PAYPAL_PLAN_PKR_PAIR");
    if (input.offerSlug === "seerah-leadership-bundle") return required("PAYPAL_PLAN_PKR_SEERAH_LEADERSHIP");
    if (input.offerSlug === "seerah-single") return required("PAYPAL_PLAN_PKR_SEERAH");
    if (input.offerSlug === "life-lessons-single") return required("PAYPAL_PLAN_PKR_LIFE_LESSONS");
  }

  throw new Error("No PayPal subscription plan is configured for this programme and country combination.");
}

export function getManualPaymentDetails(): ManualPaymentDetails {
  const supportWhatsapp = process.env.MANUAL_PAYMENT_SUPPORT_WHATSAPP ?? "03181602388";

  return {
    whatsapp: supportWhatsapp,
    instructions: [
      "Use your platform reference in the payment note.",
      `After payment, send your screenshot to WhatsApp support on ${supportWhatsapp} so your payment can be confirmed from the backend.`,
    ],
    channels: [
      {
        id: "BANK_TRANSFER",
        title: "Bank Transfer",
        badge: `[BANK] ${process.env.BANK_TRANSFER_BANK_NAME ?? "Meezan Bank"}`,
        fields: [
          { label: "Account Title", value: process.env.BANK_TRANSFER_ACCOUNT_NAME ?? "AREEJ FATIMA" },
          { label: "Account Number", value: process.env.BANK_TRANSFER_ACCOUNT_NUMBER ?? "98900114432111" },
          { label: "IBAN", value: process.env.BANK_TRANSFER_IBAN ?? "PK96MEZN0098900114432111" },
        ],
      },
      {
        id: "JAZZCASH",
        title: "JazzCash",
        badge: "[JAZZ] JazzCash",
        fields: [
          { label: "Account Name", value: process.env.JAZZCASH_ACCOUNT_NAME ?? "Areej Fatima" },
          { label: "Mobile Number", value: process.env.JAZZCASH_MOBILE_NUMBER ?? "03244517741" },
        ],
      },
    ],
  };
}
