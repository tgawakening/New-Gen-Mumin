import { db } from "@/lib/db";
import {
  DEFAULT_OFFERS,
  FULL_BUNDLE_COUPON_OFFER_SLUG,
  getDiscountCoupon,
  orderRegistrationCountries,
  REGISTRATION_COUNTRIES,
  resolveCurrency,
  resolveOfferAmount,
} from "@/lib/registration/catalog";
import type { RegistrationPayload } from "@/lib/registration/schema";

type CatalogOfferRecord = {
  id: string;
  slug: string;
  title: string;
  basePriceGbp: number;
  basePricePkr: number | null;
};

function trimForColumn(value: string | null | undefined, maxLength = 240) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function buildOfferLookup(offers: CatalogOfferRecord[]) {
  return new Map(offers.map((offer) => [offer.slug, offer]));
}

function calculateDiscount(studentIndex: number, amount: number) {
  if (studentIndex === 0) {
    return 0;
  }

  return Math.round(amount * 0.5);
}

async function ensureParentProfile(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  payload: RegistrationPayload,
) {
  const existingUser = await tx.user.findUnique({
    where: { email: payload.parentEmail },
    include: { parentProfile: true },
  });

  if (existingUser?.parentProfile) {
    return existingUser.parentProfile;
  }

  if (existingUser) {
    return tx.parentProfile.create({
      data: {
        userId: existingUser.id,
        billingCountryCode: payload.selectedCountryCode,
        billingCountryName: payload.selectedCountryName,
        preferredCurrency: resolveCurrency(payload.selectedCountryCode),
      },
    });
  }

  const createdUser = await tx.user.create({
    data: {
      email: payload.parentEmail,
      role: "PARENT",
      status: "ACTIVE",
      firstName: payload.parentFirstName,
      lastName: payload.parentLastName,
      phoneCountryCode: payload.phoneCountryCode,
      phoneNumber: payload.phoneNumber,
      parentProfile: {
        create: {
          billingCountryCode: payload.selectedCountryCode,
          billingCountryName: payload.selectedCountryName,
          preferredCurrency: resolveCurrency(payload.selectedCountryCode),
        },
      },
    },
    include: {
      parentProfile: true,
    },
  });

  if (!createdUser.parentProfile) {
    throw new Error("Unable to create the parent profile for this registration.");
  }

  return createdUser.parentProfile;
}

export async function getRegistrationOptions() {
  const countries = orderRegistrationCountries();

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
  const normalizedCouponCode = payload.couponCode?.trim().toUpperCase() ?? "";
  const fallbackCoupon = getDiscountCoupon(normalizedCouponCode);
  const couponEligibleForSelection =
    payload.students.length > 0 &&
    payload.students.every(
      (student) =>
        student.selectedOfferSlugs.length === 1 &&
        student.selectedOfferSlugs[0] === FULL_BUNDLE_COUPON_OFFER_SLUG,
    );
  const coupon = fallbackCoupon && couponEligibleForSelection
    ? await db.coupon.findFirst({
        where: {
          code: fallbackCoupon.code,
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          discountPercent: true,
          discountAmount: true,
          currency: true,
        },
      })
    : null;

  if (missingOffer) {
    throw new Error(
      `Offer \"${missingOffer}\" is not available yet. Seed the registration catalog first.`,
    );
  }

  return db.$transaction(async (tx) => {
    let subtotalAmount = 0;
    let multiChildDiscountAmount = 0;
    const parentProfile = await ensureParentProfile(tx, payload);

    const registration = await tx.registration.create({
      data: {
        parentProfileId: parentProfile.id,
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
        notes: trimForColumn(payload.notes),
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
          notes: trimForColumn(student.notes),
        },
      });

      for (const offerSlug of student.selectedOfferSlugs) {
        const offer = offerLookup.get(offerSlug);

        if (!offer) {
          continue;
        }

        const baseAmount = resolveOfferAmount(
          offer,
          payload.selectedCountryCode,
          currency,
        );
        const itemDiscount = calculateDiscount(studentIndex, baseAmount);
        const finalAmount = baseAmount - itemDiscount;

        subtotalAmount += baseAmount;
        multiChildDiscountAmount += itemDiscount;

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

    const subtotalAfterMultiChild = subtotalAmount - multiChildDiscountAmount;
    const effectiveFallbackCoupon = couponEligibleForSelection ? fallbackCoupon : null;
    const couponPercent = coupon?.discountPercent ?? effectiveFallbackCoupon?.discountPercent ?? 0;
    const couponAmount =
      coupon?.discountAmount && coupon.currency === currency
        ? coupon.discountAmount
        : couponPercent > 0
          ? Math.round(subtotalAfterMultiChild * (couponPercent / 100))
          : 0;
    const discountAmount = multiChildDiscountAmount + couponAmount;

    const updated = await tx.registration.update({
      where: { id: registration.id },
      data: {
        couponId: couponEligibleForSelection ? coupon?.id ?? null : null,
        subtotalAmount,
        discountAmount,
        totalAmount: subtotalAmount - discountAmount,
        pricingSnapshot: {
          currency,
          multiChildDiscountRule: "50% off for second child onwards",
          country: payload.selectedCountryName,
          couponCode: coupon?.code ?? effectiveFallbackCoupon?.code ?? null,
          couponDiscountPercent: couponPercent || null,
          couponDiscountAmount: couponAmount || null,
          couponEligibility: couponEligibleForSelection ? "bundle" : "bundle-only",
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
