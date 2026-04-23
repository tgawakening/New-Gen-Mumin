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

export function getPayPalBaseUrl() {
  return process.env.PAYPAL_ENVIRONMENT === "LIVE"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
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
