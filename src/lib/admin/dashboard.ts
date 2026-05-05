import { db } from "@/lib/db";
import { convertAmountToGbp } from "@/lib/registration/catalog";

function extractNoteValue(notes: string | null | undefined, label: string) {
  if (!notes) return null;
  const line = notes
    .split("\n")
    .find((entry) => entry.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return line ? line.split(":").slice(1).join(":").trim() : null;
}

function extractPricingSnapshotValue(
  pricingSnapshot: unknown,
  key: string,
) {
  if (!pricingSnapshot || typeof pricingSnapshot !== "object" || Array.isArray(pricingSnapshot)) {
    return null;
  }

  const value = (pricingSnapshot as Record<string, unknown>)[key];
  if (value === undefined || value === null) {
    return null;
  }

  return value;
}

export type AdminDashboardFilters = {
  orderStatus?: string;
  orderPayment?: string;
  orderProgram?: string;
  orderPricing?: string;
  studentPayment?: string;
  studentRegistrationStatus?: string;
  studentProgram?: string;
  studentPricing?: string;
};

function hasDiscount(totalDiscount: number) {
  return totalDiscount > 0;
}

function formatPersonName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName === "Parent" ? "" : lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function formatProgramTitle(title?: string | null, slug?: string | null) {
  if (slug === "full-bundle" || title === "Gen-Mumins Full Bundle") {
    return "Gen-Mumin Bundle";
  }

  return title || "Program pending";
}

function buildRegistrationChildren(
  registration?: {
    students: Array<{
      id: string;
      firstName: string;
      lastName: string | null;
      displayName: string | null;
      age: number | null;
      gender: string | null;
    }>;
    items: Array<{
      registrationStudentId: string;
      offer: { title: string; slug: string } | null;
    }>;
  } | null,
) {
  if (!registration) return [];

  return registration.students.map((child) => {
    const programs = registration.items
      .filter((item) => item.registrationStudentId === child.id)
      .map((item) => formatProgramTitle(item.offer?.title, item.offer?.slug));

    return {
      id: child.id,
      name: formatPersonName(child.firstName, child.lastName) || child.displayName || "Unnamed child",
      age: child.age,
      gender: child.gender,
      programs: Array.from(new Set(programs)),
    };
  });
}

export async function getAdminDashboardData(filters: AdminDashboardFilters = {}) {
  const [
    totalStudents,
    activeEnrollments,
    pendingRegistrations,
    unreadMessages,
    paidOrders,
    recentRegistrations,
    orders,
    students,
    feeWaiverApplications,
  ] = await Promise.all([
    db.studentProfile.count(),
    db.enrollment.count({ where: { status: "ACTIVE" } }),
    db.registration.count({
      where: {
        status: { in: ["DRAFT", "SUBMITTED", "PENDING_PAYMENT", "PAYMENT_REVIEW"] },
      },
    }),
    db.contactMessage.count({ where: { status: "NEW" } }),
    db.order.findMany({
      where: { status: "SUCCEEDED" },
      select: {
        totalAmount: true,
        currency: true,
      },
    }),
    db.registration.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        students: true,
        items: { include: { offer: true } },
        order: true,
      },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        parent: {
          include: {
            user: true,
          },
        },
        registration: {
          include: {
            students: true,
            items: {
              include: {
                offer: true,
                registrationStudent: true,
              },
            },
          },
        },
        payments: {
          include: {
            manualSubmission: true,
          },
        },
        items: {
          include: {
            offer: true,
            enrollment: {
              include: {
                program: true,
              },
            },
          },
        },
      },
    }),
    db.studentProfile.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        user: true,
        parents: {
          include: {
            parent: {
              include: {
                user: true,
                orders: {
                  orderBy: { createdAt: "desc" },
                  take: 3,
                },
              },
            },
          },
        },
        enrollments: {
          include: {
            program: true,
          },
        },
        registrationStudents: {
          include: {
            registration: {
              include: {
                students: true,
                items: {
                  include: {
                    offer: true,
                  },
                },
              },
            },
            items: {
              include: {
                offer: true,
              },
            },
          },
        },
      },
    }),
    db.scholarshipApplication.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        offer: true,
      },
    }),
  ]);

  const ordersView = orders.map((order) => {
    const latestPayment = order.payments[0] ?? null;
    const childDetails = buildRegistrationChildren(order.registration);
    const programTitles = Array.from(
      new Set(
        order.items.flatMap((item) => {
          if (item.enrollment?.program?.title) return [item.enrollment.program.title];
          if (item.offer?.title) return [formatProgramTitle(item.offer.title, item.offer.slug)];
          return [];
        }),
      ),
    );

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      parentName:
        order.registration
          ? formatPersonName(order.registration.parentFirstName, order.registration.parentLastName)
          : formatPersonName(order.parent.user.firstName, order.parent.user.lastName),
      parentEmail: order.parent.user.email,
      phone: order.parent.user.phoneNumber
        ? `${order.parent.user.phoneCountryCode ?? ""} ${order.parent.user.phoneNumber}`.trim()
        : "Pending",
      gateway: order.gateway,
      status: order.status,
      currency: order.currency,
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      pricingLabel: hasDiscount(order.discountAmount) ? "Discounted" : "Full",
      couponCode:
        typeof extractPricingSnapshotValue(order.registration?.pricingSnapshot, "couponCode") === "string"
          ? String(extractPricingSnapshotValue(order.registration?.pricingSnapshot, "couponCode"))
          : null,
      couponDiscountPercent:
        typeof extractPricingSnapshotValue(order.registration?.pricingSnapshot, "couponDiscountPercent") === "number"
          ? Number(extractPricingSnapshotValue(order.registration?.pricingSnapshot, "couponDiscountPercent"))
          : null,
      finalAmountLabel:
        hasDiscount(order.discountAmount)
          ? `${order.currency} ${order.totalAmount} after ${order.discountAmount} discount`
          : `${order.currency} ${order.totalAmount}`,
      registrationStatus: order.registration?.status ?? "Pending",
      enrollmentStates: order.items
        .map((item) => item.enrollment?.status)
        .filter(
          (value): value is NonNullable<typeof value> => Boolean(value),
        ),
      programTitles,
      childCount: childDetails.length,
      childDetails,
      createdAt: order.createdAt,
      manualSubmission: latestPayment?.manualSubmission ?? null,
      paymentStatus: latestPayment?.status ?? order.status,
    };
  });

  const filteredOrders = ordersView.filter((order) => {
    if (filters.orderStatus && filters.orderStatus !== "ALL" && order.status !== filters.orderStatus) {
      return false;
    }
    if (filters.orderPayment && filters.orderPayment !== "ALL" && order.gateway !== filters.orderPayment) {
      return false;
    }
    if (
      filters.orderProgram &&
      filters.orderProgram !== "ALL" &&
      !order.programTitles.some((title) => title === filters.orderProgram)
    ) {
      return false;
    }
    if (filters.orderPricing && filters.orderPricing !== "ALL" && order.pricingLabel !== filters.orderPricing) {
      return false;
    }
    return true;
  });

  const studentsView = students.map((student) => {
    const latestOrder = student.parents[0]?.parent.orders[0] ?? null;
    const latestRegistration = student.registrationStudents[0]?.registration ?? null;
    const registrationParentName = latestRegistration
      ? formatPersonName(latestRegistration.parentFirstName, latestRegistration.parentLastName)
      : "";
    const linkedParentNames = student.parents
      .map((entry) => formatPersonName(entry.parent.user.firstName, entry.parent.user.lastName))
      .filter(Boolean);
    const childDetails = buildRegistrationChildren(latestRegistration);
    const childNames = childDetails.map((child) => child.name);
    const pricingLabel = student.registrationStudents.some((entry) =>
      entry.items.some((item) => item.discountAmount > 0),
    )
      ? "Discounted"
      : "Full";

    return {
      id: student.id,
      userId: student.user.id,
      name:
        student.displayName || `${student.user.firstName} ${student.user.lastName}`.trim(),
      email: student.user.email,
      phone: student.user.phoneNumber
        ? `${student.user.phoneCountryCode ?? ""} ${student.user.phoneNumber}`.trim()
        : "Pending",
      enrollments: student.enrollments.map((enrollment) => ({
        id: enrollment.id,
        programTitle: enrollment.program.title,
        status: enrollment.status,
      })),
      paymentGateway: latestOrder?.gateway ?? "Pending",
      registrationStatus: latestRegistration?.status ?? "Pending",
      pricingLabel,
      couponCode:
        typeof extractPricingSnapshotValue(latestRegistration?.pricingSnapshot, "couponCode") === "string"
          ? String(extractPricingSnapshotValue(latestRegistration?.pricingSnapshot, "couponCode"))
          : null,
      couponDiscountPercent:
        typeof extractPricingSnapshotValue(latestRegistration?.pricingSnapshot, "couponDiscountPercent") === "number"
          ? Number(extractPricingSnapshotValue(latestRegistration?.pricingSnapshot, "couponDiscountPercent"))
          : null,
      totalAmount: latestRegistration?.totalAmount ?? null,
      currency: latestRegistration?.selectedCurrency ?? null,
      parentName: registrationParentName || linkedParentNames.join(", ") || "No parent linked",
      childCount: childNames.length || 1,
      childDetails: childDetails.length ? childDetails : [
        {
          id: student.id,
          name: student.displayName || formatPersonName(student.user.firstName, student.user.lastName) || "Unnamed child",
          age: student.age,
          gender: null,
          programs: student.enrollments.map((enrollment) => enrollment.program.title),
        },
      ],
      childNames: childNames.length ? childNames : [
        student.displayName || formatPersonName(student.user.firstName, student.user.lastName) || "Unnamed child",
      ],
      createdAt: student.createdAt,
      age: student.age,
      countryName: student.countryName,
    };
  });

  const filteredStudents = studentsView.filter((student) => {
    if (
      filters.studentPayment &&
      filters.studentPayment !== "ALL" &&
      student.paymentGateway !== filters.studentPayment
    ) {
      return false;
    }
    if (
      filters.studentRegistrationStatus &&
      filters.studentRegistrationStatus !== "ALL" &&
      student.registrationStatus !== filters.studentRegistrationStatus
    ) {
      return false;
    }
    if (
      filters.studentProgram &&
      filters.studentProgram !== "ALL" &&
      !student.enrollments.some((enrollment) => enrollment.programTitle === filters.studentProgram)
    ) {
      return false;
    }
    if (
      filters.studentPricing &&
      filters.studentPricing !== "ALL" &&
      student.pricingLabel !== filters.studentPricing
    ) {
      return false;
    }
    return true;
  });

  const uniqueOrderPrograms = Array.from(
    new Set(ordersView.flatMap((order) => order.programTitles)),
  ).sort((a, b) => a.localeCompare(b));
  const uniqueStudentPrograms = Array.from(
    new Set(studentsView.flatMap((student) => student.enrollments.map((entry) => entry.programTitle))),
  ).sort((a, b) => a.localeCompare(b));

  const revenueGbp = paidOrders.reduce((sum, order) => {
    return sum + convertAmountToGbp(order.totalAmount, order.currency);
  }, 0);

  return {
    metrics: {
      totalStudents,
      activeEnrollments,
      pendingRegistrations,
      unreadMessages,
      revenueGbp: Math.round(revenueGbp * 100) / 100,
    },
    recentRegistrations,
    orders: filteredOrders,
    students: filteredStudents,
    feeWaiverApplications,
    filterOptions: {
      orderPrograms: uniqueOrderPrograms,
      studentPrograms: uniqueStudentPrograms,
    },
  };
}

export async function getExternalAdminOverview() {
  const data = await getAdminDashboardData();

  return {
    metrics: data.metrics,
    recentRegistrations: data.recentRegistrations.map((registration) => ({
      id: registration.id,
      parentName: `${registration.parentFirstName} ${registration.parentLastName}`.trim(),
      parentEmail: registration.parentEmail,
      status: registration.status,
      currency: registration.selectedCurrency,
      totalAmount: registration.totalAmount,
      studentCount: registration.students.length,
      createdAt: registration.createdAt,
      country: registration.selectedCountryName,
      source: extractNoteValue(registration.notes, "Source"),
      referrer: extractNoteValue(registration.notes, "Referrer"),
    })),
  };
}
