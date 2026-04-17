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

export const REGISTRATION_COUNTRIES = [
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "PK", name: "Pakistan", currency: "PKR" },
  { code: "IN", name: "India", currency: "PKR" },
  { code: "BD", name: "Bangladesh", currency: "PKR" },
  { code: "AF", name: "Afghanistan", currency: "PKR" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
] as const;

export function resolveCurrency(countryCode?: string | null) {
  if (!countryCode) {
    return "GBP";
  }

  return SOUTH_ASIA_COUNTRY_CODES.has(countryCode.toUpperCase()) ? "PKR" : "GBP";
}
