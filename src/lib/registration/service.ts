import { db } from "@/lib/db";
import {
  DEFAULT_OFFERS,
  FULL_BUNDLE_COUPON_OFFER_SLUG,
  getCatalogOfferProgramSlugs,
  getDiscountCoupon,
  orderRegistrationCountries,
  PKR_OFFER_PRICE_OVERRIDES,
  REGISTRATION_COUNTRIES,
  resolveCurrency,
  resolveOfferAmount,
  SEERAH_LEADERSHIP_BUNDLE_OFFER_SLUG,
  SEERAH_SINGLE_OFFER_SLUG,
} from "@/lib/registration/catalog";
import type { RegistrationPayload } from "@/lib/registration/schema";

const BACKEND_ONLY_DISCOUNT_COUPONS = {
  PKSTUDENT: { code: "PKSTUDENT", discountAmount: 2000, currency: "PKR" },
  PKBUNDLE3K: { code: "PKBUNDLE3K", discountAmount: 2000, currency: "PKR" },
} as const;
const PAKISTAN_SEERAH_LEADERSHIP_TARGET_AMOUNT_PKR = 3000;

type RegistrationCoupon =
  | ReturnType<typeof getDiscountCoupon>
  | (typeof BACKEND_ONLY_DISCOUNT_COUPONS)[keyof typeof BACKEND_ONLY_DISCOUNT_COUPONS];

type CatalogOfferRecord = {
  id: string;
  slug: string;
  title: string;
  basePriceGbp: number;
  basePricePkr: number | null;
  programSlugs?: string[];
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

function getRegistrationDiscountCoupon(code?: string | null): RegistrationCoupon {
  const publicCoupon = getDiscountCoupon(code);
  if (publicCoupon || !code) {
    return publicCoupon;
  }

  const normalized = code.trim().toUpperCase();
  return (
    Object.values(BACKEND_ONLY_DISCOUNT_COUPONS).find(
      (coupon) => coupon.code === normalized,
    ) ?? null
  );
}

function isRegistrationCouponEligibleForSelection(
  coupon: RegistrationCoupon,
  selectedOfferSlugsByStudent: string[][],
  countryCode?: string | null,
) {
  if (!coupon || selectedOfferSlugsByStudent.length === 0) {
    return false;
  }

  if (coupon.code === BACKEND_ONLY_DISCOUNT_COUPONS.PKSTUDENT.code) {
    return (
      countryCode?.toUpperCase() === "PK" &&
      selectedOfferSlugsByStudent.every(
        (offerSlugs) =>
          offerSlugs.length === 1 &&
          [SEERAH_SINGLE_OFFER_SLUG, SEERAH_LEADERSHIP_BUNDLE_OFFER_SLUG].includes(
            offerSlugs[0],
          ),
      )
    );
  }

  if (coupon.code === BACKEND_ONLY_DISCOUNT_COUPONS.PKBUNDLE3K.code) {
    return (
      countryCode?.toUpperCase() === "PK" &&
      selectedOfferSlugsByStudent.length === 1 &&
      selectedOfferSlugsByStudent[0]?.length === 1 &&
      selectedOfferSlugsByStudent[0][0] === SEERAH_LEADERSHIP_BUNDLE_OFFER_SLUG
    );
  }

  return selectedOfferSlugsByStudent.every(
    (offerSlugs) =>
      offerSlugs.length === 1 && offerSlugs[0] === FULL_BUNDLE_COUPON_OFFER_SLUG,
  );
}

function normalizeStudentIdentity(input: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  age?: number | null;
  countryCode?: string | null;
  countryName?: string | null;
}) {
  const fullName =
    input.displayName?.trim() ||
    [input.firstName, input.lastName].filter(Boolean).join(" ").trim();

  return [
    fullName.toLowerCase().replace(/\s+/g, " "),
    input.age ?? "",
    (input.countryCode || input.countryName || "").toLowerCase(),
  ].join("|");
}

function getProgramSlugsForOffer(offerSlug: string) {
  return getCatalogOfferProgramSlugs(offerSlug);
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

async function hasCompletedFamilyAccess(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  payload: RegistrationPayload,
  requestedOfferRecords: CatalogOfferRecord[],
) {
  const existingUser = await tx.user.findUnique({
    where: { email: payload.parentEmail },
    select: {
      id: true,
      parentProfile: {
        select: {
          students: {
            select: {
              student: {
                select: {
                  id: true,
                  age: true,
                  countryCode: true,
                  countryName: true,
                  displayName: true,
                  enrollments: {
                    where: {
                      status: {
                        in: ["ACTIVE", "CONFIRMED", "COMPLETED"],
                      },
                    },
                    select: {
                      program: {
                        select: {
                          slug: true,
                        },
                      },
                    },
                  },
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
          registrations: {
            where: {
              status: {
                in: ["PAID", "CONVERTED"],
              },
            },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!existingUser?.parentProfile) {
    return false;
  }

  const hasActiveEnrollments = existingUser.parentProfile.students.some(
    ({ student }) => student.enrollments.length > 0,
  );

  const hasCompletedRegistration = existingUser.parentProfile.registrations.length > 0;

  if (!hasActiveEnrollments && !hasCompletedRegistration) {
    return false;
  }

  const requestedOfferLookup = new Map<string, CatalogOfferRecord>(
    requestedOfferRecords.map((offer) => [offer.slug, offer]),
  );
  const existingStudentLookup = new Map<string, Set<string>>(
    existingUser.parentProfile.students.map(({ student }) => {
      const identityKey = normalizeStudentIdentity({
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        displayName: student.displayName,
        age: student.age,
        countryCode: student.countryCode,
        countryName: student.countryName,
      });
      const programSlugs = new Set<string>(
        student.enrollments
          .map((enrollment) => enrollment.program.slug)
          .filter(Boolean),
      );

      return [identityKey, programSlugs];
    }),
  );

  const isIntroducingNewAccess = payload.students.some((student) => {
    const identityKey = normalizeStudentIdentity({
      firstName: student.firstName,
      lastName: student.lastName,
      age: student.age,
      countryCode: payload.selectedCountryCode,
      countryName: payload.selectedCountryName,
    });
    const existingProgramSlugs = existingStudentLookup.get(identityKey);

    if (!existingProgramSlugs) {
      return true;
    }

    return student.selectedOfferSlugs.some((offerSlug) => {
      const offer = requestedOfferLookup.get(offerSlug);

      if (!offer) {
        return false;
      }

      const requestedProgramSlugs = offer.programSlugs?.length
        ? offer.programSlugs
        : getProgramSlugsForOffer(offer.slug);

      if (requestedProgramSlugs.length === 0) {
        return true;
      }

      return requestedProgramSlugs.some(
        (programSlug) => !existingProgramSlugs.has(programSlug),
      );
    });
  });

  return !isIntroducingNewAccess;
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
        programs: {
          orderBy: { sortOrder: "asc" },
          select: {
            program: {
              select: {
                slug: true,
              },
            },
          },
        },
      },
    });

    if (offers.length > 0) {
      return {
        offers: offers.map((offer) => ({
          slug: offer.slug,
          title: offer.title,
          description: offer.description,
          kind: offer.kind,
          basePriceGbp: offer.basePriceGbp,
          basePricePkr: PKR_OFFER_PRICE_OVERRIDES[offer.slug] ?? offer.basePricePkr,
          programSlugs: offer.programs.map((entry) => entry.program.slug),
        })),
        countries,
      };
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
      programs: {
        orderBy: { sortOrder: "asc" },
        select: {
          program: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });

  const offerRecords = offers.map((offer) => ({
    id: offer.id,
    slug: offer.slug,
    title: offer.title,
    basePriceGbp: offer.basePriceGbp,
    basePricePkr: offer.basePricePkr,
    programSlugs: offer.programs.map((entry) => entry.program.slug),
  }));
  const offerLookup = buildOfferLookup(offerRecords);
  const missingOffer = requestedOfferSlugs.find((slug) => !offerLookup.has(slug));
  const normalizedCouponCode = payload.couponCode?.trim().toUpperCase() ?? "";
  const fallbackCoupon = getRegistrationDiscountCoupon(normalizedCouponCode);
  const selectedOfferSlugsByStudent = payload.students.map(
    (student) => student.selectedOfferSlugs,
  );
  const couponEligibleForSelection = isRegistrationCouponEligibleForSelection(
    fallbackCoupon,
    selectedOfferSlugsByStudent,
    payload.selectedCountryCode,
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
    const completedFamilyAccess = await hasCompletedFamilyAccess(tx, payload, offerRecords);

    if (completedFamilyAccess) {
      throw new Error(
        "This email is already registered for the selected Gen-Mumins programme. Kindly log in to continue from your dashboard.",
      );
    }

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
    const privateStudentBundleTargetTotal =
      effectiveFallbackCoupon?.code === BACKEND_ONLY_DISCOUNT_COUPONS.PKBUNDLE3K.code &&
      currency === "PKR" &&
      selectedOfferSlugsByStudent.length === 1 &&
      selectedOfferSlugsByStudent[0]?.length === 1 &&
      selectedOfferSlugsByStudent[0][0] === SEERAH_LEADERSHIP_BUNDLE_OFFER_SLUG
        ? PAKISTAN_SEERAH_LEADERSHIP_TARGET_AMOUNT_PKR
        : null;
    const privateStudentBundleTargetAmount =
      privateStudentBundleTargetTotal === null
        ? 0
        : Math.max(0, subtotalAfterMultiChild - privateStudentBundleTargetTotal);
    const fallbackCouponAmount =
      effectiveFallbackCoupon &&
      "discountAmount" in effectiveFallbackCoupon &&
      effectiveFallbackCoupon.currency === currency
        ? Math.max(effectiveFallbackCoupon.discountAmount, privateStudentBundleTargetAmount)
        : 0;
    const fallbackCouponPercent =
      effectiveFallbackCoupon && "discountPercent" in effectiveFallbackCoupon
        ? effectiveFallbackCoupon.discountPercent
        : 0;
    const couponPercent = coupon?.discountPercent ?? fallbackCouponPercent;
    const persistedCouponAmount =
      coupon?.discountAmount && coupon.currency === currency
        ? coupon.discountAmount
        : 0;
    const fixedCouponAmount = Math.max(persistedCouponAmount, fallbackCouponAmount);
    const rawCouponAmount =
      fixedCouponAmount > 0
        ? fixedCouponAmount
        : couponPercent > 0
          ? Math.round(subtotalAfterMultiChild * (couponPercent / 100))
          : 0;
    const couponAmount =
      privateStudentBundleTargetTotal === null
        ? Math.min(rawCouponAmount, subtotalAfterMultiChild)
        : privateStudentBundleTargetAmount;
    const discountAmount = multiChildDiscountAmount + couponAmount;
    const totalAmount =
      privateStudentBundleTargetTotal === null
        ? subtotalAmount - discountAmount
        : privateStudentBundleTargetTotal;

    const updated = await tx.registration.update({
      where: { id: registration.id },
      data: {
        couponId: couponEligibleForSelection ? coupon?.id ?? null : null,
        subtotalAmount,
        discountAmount,
        totalAmount,
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
  }, {
    maxWait: 10_000,
    timeout: 20_000,
  });
}
