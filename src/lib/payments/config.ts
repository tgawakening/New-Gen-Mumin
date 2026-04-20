export type ManualBankDetails = {
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

export function getManualBankDetails(): ManualBankDetails {
  return {
    accountName: process.env.BANK_TRANSFER_ACCOUNT_NAME ?? "Gen-Mumins",
    bankName: process.env.BANK_TRANSFER_BANK_NAME ?? "Bank details pending",
    accountNumber: process.env.BANK_TRANSFER_ACCOUNT_NUMBER ?? "To be provided",
    iban: process.env.BANK_TRANSFER_IBAN || undefined,
    swiftCode: process.env.BANK_TRANSFER_SWIFT || undefined,
    sortCode: process.env.BANK_TRANSFER_SORT_CODE || undefined,
    branchAddress: process.env.BANK_TRANSFER_BRANCH_ADDRESS || undefined,
    whatsapp: process.env.BANK_TRANSFER_WHATSAPP || undefined,
    instructions: [
      "Transfer the full amount using your order number as the payment reference.",
      "After sending the transfer, submit the sender name, sender number, transfer reference, and proof screenshot.",
      "Our team will manually verify the payment before confirming the enrollment.",
      process.env.BANK_TRANSFER_CUSTOM_INSTRUCTION || "If you need help, contact our admissions team before sending the transfer.",
    ],
  };
}

