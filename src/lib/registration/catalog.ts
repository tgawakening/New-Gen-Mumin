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

export const REGISTRATION_COUNTRIES = [
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "PK", name: "Pakistan", currency: "PKR" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "BD", name: "Bangladesh", currency: "BDT" },
  { code: "AF", name: "Afghanistan", currency: "AFN" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
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
};

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
