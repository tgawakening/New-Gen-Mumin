export type CatalogProgram = {
  slug: string;
  title: string;
  shortDescription: string;
  monthlyPriceGbp: number;
  monthlyPricePkr: number;
};

export type CatalogOffer = {
  slug: string;
  title: string;
  kind: "SINGLE" | "PAIR" | "BUNDLE";
  description: string;
  programSlugs: string[];
  basePriceGbp: number;
  basePricePkr: number;
};

export const DEFAULT_PROGRAMS: CatalogProgram[] = [
  {
    slug: "seerah",
    title: "The Prophet's Seerah",
    shortDescription: "Stories, lessons, and love for the Messenger in a child-friendly format.",
    monthlyPriceGbp: 20,
    monthlyPricePkr: 2000,
  },
  {
    slug: "life-lessons",
    title: "Life Lessons & Leadership",
    shortDescription: "Practical Islamic manners, confidence, and leadership training for children.",
    monthlyPriceGbp: 20,
    monthlyPricePkr: 2000,
  },
  {
    slug: "arabic",
    title: "Arabic",
    shortDescription: "Arabic reading and language foundations delivered in a structured live format.",
    monthlyPriceGbp: 25,
    monthlyPricePkr: 3500,
  },
  {
    slug: "tajweed",
    title: "Qur'anic Tajweed",
    shortDescription: "Correct recitation and tajweed habits with guided live support.",
    monthlyPriceGbp: 25,
    monthlyPricePkr: 3500,
  },
];

export const DEFAULT_OFFERS: CatalogOffer[] = [
  {
    slug: "seerah-single",
    title: "The Prophet's Seerah",
    kind: "SINGLE",
    description: "Single-program monthly enrollment for Seerah.",
    programSlugs: ["seerah"],
    basePriceGbp: 20,
    basePricePkr: 2000,
  },
  {
    slug: "life-lessons-single",
    title: "Life Lessons & Leadership",
    kind: "SINGLE",
    description: "Single-program monthly enrollment for Life Lessons & Leadership.",
    programSlugs: ["life-lessons"],
    basePriceGbp: 20,
    basePricePkr: 2000,
  },
  {
    slug: "arabic-tajweed-pair",
    title: "Arabic + Qur'anic Tajweed",
    kind: "PAIR",
    description: "Paired language and recitation track sold together.",
    programSlugs: ["arabic", "tajweed"],
    basePriceGbp: 50,
    basePricePkr: 7000,
  },
  {
    slug: "full-bundle",
    title: "Gen-Mumins Full Bundle",
    kind: "BUNDLE",
    description: "All four programs in one monthly subscription.",
    programSlugs: ["seerah", "life-lessons", "arabic", "tajweed"],
    basePriceGbp: 80,
    basePricePkr: 12000,
  },
];

export const SOUTH_ASIA_COUNTRY_CODES = new Set(["PK", "IN", "BD", "AF"]);

export const REGIONAL_PRICE_OVERRIDES: Record<
  string,
  Partial<Record<(typeof DEFAULT_OFFERS)[number]["slug"], number>>
> = {
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

const PRIORITY_COUNTRY_CODES = ["US", "PK", "GB", "AE", "IN", "BD", "SA"] as const;

export const REGISTRATION_COUNTRIES = [
  { code: "US", name: "United States", currency: "USD" },
  { code: "PK", name: "Pakistan", currency: "PKR" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "BD", name: "Bangladesh", currency: "BDT" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
  { code: "AF", name: "Afghanistan", currency: "AFN" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "NZ", name: "New Zealand", currency: "NZD" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "IT", name: "Italy", currency: "EUR" },
  { code: "ES", name: "Spain", currency: "EUR" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "BE", name: "Belgium", currency: "EUR" },
  { code: "CH", name: "Switzerland", currency: "CHF" },
  { code: "SE", name: "Sweden", currency: "SEK" },
  { code: "NO", name: "Norway", currency: "NOK" },
  { code: "DK", name: "Denmark", currency: "DKK" },
  { code: "TR", name: "Turkey", currency: "TRY" },
  { code: "QA", name: "Qatar", currency: "QAR" },
  { code: "KW", name: "Kuwait", currency: "KWD" },
  { code: "BH", name: "Bahrain", currency: "BHD" },
  { code: "OM", name: "Oman", currency: "OMR" },
  { code: "MY", name: "Malaysia", currency: "MYR" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "JP", name: "Japan", currency: "JPY" },
] as const;

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

export const DISCOUNT_COUPONS = {
  GEN25: { code: "GEN25", discountPercent: 25 },
  GENM25: { code: "GENM25", discountPercent: 25 },
  GEN50: { code: "GEN50", discountPercent: 50 },
  GENM50: { code: "GENM50", discountPercent: 50 },
  GEN75: { code: "GEN75", discountPercent: 75 },
  GENM75: { code: "GENM75", discountPercent: 75 },
  GENMPK5833: { code: "GENMPK5833", discountAmount: 7000, currency: "PKR" },
  Q7N4FULLACCESS: { code: "Q7N4FULLACCESS", discountPercent: 100 },
} as const;

export const FULL_BUNDLE_COUPON_OFFER_SLUG = "full-bundle";

export function getDiscountCoupon(code?: string | null) {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return Object.values(DISCOUNT_COUPONS).find((coupon) => coupon.code === normalized) ?? null;
}

export function orderRegistrationCountries() {
  const priority = PRIORITY_COUNTRY_CODES.map((code) =>
    REGISTRATION_COUNTRIES.find((country) => country.code === code),
  ).filter(
    (
      country,
    ): country is (typeof REGISTRATION_COUNTRIES)[number] => Boolean(country),
  );

  const remaining = REGISTRATION_COUNTRIES.filter(
    (country) => !PRIORITY_COUNTRY_CODES.includes(country.code as (typeof PRIORITY_COUNTRY_CODES)[number]),
  ).sort((left, right) => left.name.localeCompare(right.name));

  return [...priority, ...remaining];
}

export function resolveCurrency(countryCode?: string | null) {
  if (!countryCode) {
    return "GBP";
  }

  const normalizedCountryCode = countryCode.toUpperCase();
  const country = REGISTRATION_COUNTRIES.find((entry) => entry.code === normalizedCountryCode);
  if (country) {
    return country.currency;
  }

  return SOUTH_ASIA_COUNTRY_CODES.has(normalizedCountryCode) ? "PKR" : "GBP";
}

export function resolveOfferAmount(
  offer: { slug: string; basePriceGbp: number; basePricePkr: number | null },
  countryCode?: string | null,
  currency?: string | null,
) {
  const normalizedCountryCode = countryCode?.toUpperCase() ?? "";
  const resolvedCurrency = currency ?? resolveCurrency(normalizedCountryCode);
  const countryOverride = REGIONAL_PRICE_OVERRIDES[normalizedCountryCode]?.[offer.slug];

  if (typeof countryOverride === "number") {
    return countryOverride;
  }

  if (resolvedCurrency === "PKR") {
    return offer.basePricePkr ?? offer.basePriceGbp;
  }

  if (SOUTH_ASIA_COUNTRY_CODES.has(normalizedCountryCode) && offer.basePricePkr) {
    const targetRate = GBP_RATES[resolvedCurrency];
    if (targetRate) {
      const discountFactor = offer.basePricePkr / (offer.basePriceGbp * GBP_RATES.PKR);
      return Math.round(offer.basePriceGbp * targetRate * discountFactor);
    }
  }

  return offer.basePriceGbp;
}
