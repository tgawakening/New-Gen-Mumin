import { db } from "@/lib/db";
import {
  DEFAULT_OFFERS,
  REGISTRATION_COUNTRIES,
  resolveCurrency,
} from "@/lib/registration/catalog";
import type { RegistrationPayload } from "@/lib/registration/schema";

type CatalogOfferRecord = {
  id: string;
  slug: string;
  title: string;
  basePriceGbp: number;
  basePricePkr: number | null;
};

function buildOfferLookup(offers: CatalogOfferRecord[]) {
  return new Map(offers.map((offer) => [offer.slug, offer]));
}

function calculateDiscount(studentIndex: number, amount: number) {
  if (studentIndex === 0) {
    return 0;
  }

  return Math.round(amount * 0.5);
}

export async function getRegistrationOptions() {
  const countries = REGISTRATION_COUNTRIES;

  try {
    const offers = await db.offer.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: {
        slug: true,
        title: true,
        description: true,
        kind: true,
        basePriceGbp: true,
        basePricePkr: true,
      },
    });

    if (offers.length > 0) {
      return { offers, countries };
    }
  } catch {
    // Fallback to static catalog when the database is not seeded yet.
  }

  return { offers: DEFAULT_OFFERS, countries };
}

export async function createRegistrationDraft(payload: RegistrationPayload) {
  const country = REGISTRATION_COUNTRIES.find(
    (entry) => entry.code === payload.selectedCountryCode,
  );
  const currency = country?.currency ?? resolveCurrency(payload.selectedCountryCode);

  const requestedOfferSlugs = [
    ...new Set(payload.students.flatMap((student) => student.selectedOfferSlugs)),
  ];

  const offers = await db.offer.findMany({
    where: { slug: { in: requestedOfferSlugs } },
    select: {
      id: true,
      slug: true,
      title: true,
      basePriceGbp: true,
      basePricePkr: true,
    },
  });

  const offerLookup = buildOfferLookup(offers);
  const missingOffer = requestedOfferSlugs.find((slug) => !offerLookup.has(slug));

  if (missingOffer) {
    throw new Error(
      `Offer \"${missingOffer}\" is not available yet. Seed the registration catalog first.`,
    );
  }

  return db.$transaction(async (tx) => {
    let subtotalAmount = 0;
    let discountAmount = 0;

    const registration = await tx.registration.create({
      data: {
        status: "DRAFT",
        parentEmail: payload.parentEmail,
        parentFirstName: payload.parentFirstName,
        parentLastName: payload.parentLastName,
        phoneCountryCode: payload.phoneCountryCode,
        phoneNumber: payload.phoneNumber,
        whatsappNumber: payload.whatsappNumber || null,
        selectedCountryCode: payload.selectedCountryCode,
        selectedCountryName: payload.selectedCountryName,
        selectedCurrency: currency,
        notes: payload.notes || null,
      },
    });

    for (const [studentIndex, student] of payload.students.entries()) {
      const registrationStudent = await tx.registrationStudent.create({
        data: {
          registrationId: registration.id,
          firstName: student.firstName,
          lastName: student.lastName,
          age: student.age,
          gender: student.gender || null,
          countryCode: payload.selectedCountryCode,
          countryName: payload.selectedCountryName,
          notes: student.notes || null,
        },
      });

      for (const offerSlug of student.selectedOfferSlugs) {
        const offer = offerLookup.get(offerSlug);

        if (!offer) {
          continue;
        }

        const baseAmount =
          currency === "PKR" ? offer.basePricePkr ?? offer.basePriceGbp : offer.basePriceGbp;
        const itemDiscount = calculateDiscount(studentIndex, baseAmount);
        const finalAmount = baseAmount - itemDiscount;

        subtotalAmount += baseAmount;
        discountAmount += itemDiscount;

        await tx.registrationItem.create({
          data: {
            registrationId: registration.id,
            registrationStudentId: registrationStudent.id,
            offerId: offer.id,
            baseAmount,
            discountAmount: itemDiscount,
            finalAmount,
            currency,
            pricingSnapshot: {
              offerSlug: offer.slug,
              offerTitle: offer.title,
              currency,
              appliedMultiChildDiscount: itemDiscount,
            },
          },
        });
      }
    }

    const updated = await tx.registration.update({
      where: { id: registration.id },
      data: {
        subtotalAmount,
        discountAmount,
        totalAmount: subtotalAmount - discountAmount,
        pricingSnapshot: {
          currency,
          multiChildDiscountRule: "50% off for second child onwards",
          country: payload.selectedCountryName,
        },
      },
      include: {
        students: true,
        items: {
          include: {
            offer: {
              select: {
                slug: true,
                title: true,
              },
            },
          },
        },
      },
    });

    return updated;
  });
}
