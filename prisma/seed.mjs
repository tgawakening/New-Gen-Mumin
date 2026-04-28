import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const programs = [
  {
    slug: "seerah",
    title: "The Prophet's Seerah",
    shortDescription: "Stories, lessons, and love for the Messenger in a child-friendly format.",
    description: "Weekly live Seerah learning for children aged 6 to 12.",
    monthlyPriceGbp: 20,
    monthlyPricePkr: 2000,
    sortOrder: 1,
  },
  {
    slug: "life-lessons",
    title: "Life Lessons & Leadership",
    shortDescription: "Practical Islamic manners, confidence, and leadership training for children.",
    description: "Live sessions focused on akhlaq, self-management, and leadership.",
    monthlyPriceGbp: 20,
    monthlyPricePkr: 2000,
    sortOrder: 2,
  },
  {
    slug: "arabic",
    title: "Arabic",
    shortDescription: "Arabic reading and language foundations delivered in a structured live format.",
    description: "Step-by-step Arabic track designed for young learners.",
    monthlyPriceGbp: 25,
    monthlyPricePkr: 3500,
    sortOrder: 3,
  },
  {
    slug: "tajweed",
    title: "Qur'anic Tajweed",
    shortDescription: "Correct recitation and tajweed habits with guided live support.",
    description: "Weekly recitation practice with tajweed-focused teaching.",
    monthlyPriceGbp: 25,
    monthlyPricePkr: 3500,
    sortOrder: 4,
  },
];

const offers = [
  {
    slug: "seerah-single",
    title: "The Prophet's Seerah",
    description: "Single-program monthly enrollment for Seerah.",
    kind: "SINGLE",
    basePriceGbp: 20,
    basePricePkr: 2000,
    sortOrder: 1,
    programSlugs: ["seerah"],
  },
  {
    slug: "life-lessons-single",
    title: "Life Lessons & Leadership",
    description: "Single-program monthly enrollment for Life Lessons & Leadership.",
    kind: "SINGLE",
    basePriceGbp: 20,
    basePricePkr: 2000,
    sortOrder: 2,
    programSlugs: ["life-lessons"],
  },
  {
    slug: "arabic-tajweed-pair",
    title: "Arabic + Qur'anic Tajweed",
    description: "Paired language and recitation track sold together.",
    kind: "PAIR",
    basePriceGbp: 50,
    basePricePkr: 7000,
    sortOrder: 3,
    programSlugs: ["arabic", "tajweed"],
  },
  {
    slug: "full-bundle",
    title: "Gen-Mumins Full Bundle",
    description: "All four programs in one monthly subscription.",
    kind: "BUNDLE",
    basePriceGbp: 80,
    basePricePkr: 12000,
    sortOrder: 4,
    programSlugs: ["seerah", "life-lessons", "arabic", "tajweed"],
  },
];

const coupons = [
  { code: "GEN25", discountPercent: 25 },
  { code: "GENM25", discountPercent: 25 },
  { code: "GEN50", discountPercent: 50 },
  { code: "GENM50", discountPercent: 50 },
  { code: "GEN75", discountPercent: 75 },
  { code: "GENM75", discountPercent: 75 },
  { code: "Q7N4FULLACCESS", discountPercent: 100 },
];

async function main() {
  for (const program of programs) {
    await prisma.program.upsert({
      where: { slug: program.slug },
      update: program,
      create: {
        ...program,
        status: "PUBLISHED",
      },
    });
  }

  const programMap = new Map(
    (await prisma.program.findMany({ select: { id: true, slug: true } })).map((program) => [program.slug, program.id]),
  );

  for (const offer of offers) {
    const upsertedOffer = await prisma.offer.upsert({
      where: { slug: offer.slug },
      update: {
        title: offer.title,
        description: offer.description,
        kind: offer.kind,
        basePriceGbp: offer.basePriceGbp,
        basePricePkr: offer.basePricePkr,
        sortOrder: offer.sortOrder,
        isActive: true,
      },
      create: {
        slug: offer.slug,
        title: offer.title,
        description: offer.description,
        kind: offer.kind,
        basePriceGbp: offer.basePriceGbp,
        basePricePkr: offer.basePricePkr,
        sortOrder: offer.sortOrder,
      },
    });

    await prisma.offerProgram.deleteMany({ where: { offerId: upsertedOffer.id } });

    for (const [index, programSlug] of offer.programSlugs.entries()) {
      const programId = programMap.get(programSlug);
      if (!programId) continue;

      await prisma.offerProgram.create({
        data: {
          offerId: upsertedOffer.id,
          programId,
          sortOrder: index,
        },
      });
    }

    await prisma.pricingRule.upsert({
      where: { id: `${offer.slug}-gbp-default` },
      update: {
        currency: "GBP",
        amount: offer.basePriceGbp,
        isDefault: true,
      },
      create: {
        id: `${offer.slug}-gbp-default`,
        offerId: upsertedOffer.id,
        currency: "GBP",
        amount: offer.basePriceGbp,
        isDefault: true,
      },
    });

    await prisma.pricingRule.upsert({
      where: { id: `${offer.slug}-pkr-southasia` },
      update: {
        currency: "PKR",
        amount: offer.basePricePkr ?? offer.basePriceGbp,
        isSouthAsiaPrice: true,
      },
      create: {
        id: `${offer.slug}-pkr-southasia`,
        offerId: upsertedOffer.id,
        currency: "PKR",
        amount: offer.basePricePkr ?? offer.basePriceGbp,
        isSouthAsiaPrice: true,
      },
    });
  }

  for (const coupon of coupons) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {
        discountPercent: coupon.discountPercent,
        isActive: true,
      },
      create: {
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        isActive: true,
      },
    });
  }

  console.log("Seeded programs, offers, pricing rules, and discount coupons.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
