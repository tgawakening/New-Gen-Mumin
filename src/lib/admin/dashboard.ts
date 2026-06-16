import { db } from "@/lib/db";
import { displayProgramTitle } from "@/lib/genm/curriculum";
import { completedOrderWhere } from "@/lib/payments/completed-orders";
import { convertAmountToGbp } from "@/lib/registration/catalog";

const COMPLETED_ENROLLMENT_STATUSES = new Set(["ACTIVE", "CONFIRMED", "COMPLETED"]);
const COMPLETED_ENROLLMENT_STATUS_LIST = ["ACTIVE", "CONFIRMED", "COMPLETED"] as const;

function extractNoteValue(notes: string | null | undefined, label: string) {
  if (!notes) return null;
  const entry = notes
    .split(/\s*\|\s*|\r?\n/)
    .find((entry) => entry.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return entry ? entry.split(":").slice(1).join(":").trim() : null;
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

function extractManualPaidAmountAdjustment(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const adjustment = (metadata as Record<string, unknown>).manualPaidAmountAdjustment;
  if (!adjustment || typeof adjustment !== "object" || Array.isArray(adjustment)) {
    return null;
  }

  const record = adjustment as Record<string, unknown>;
  return {
    amount: typeof record.amount === "number" ? record.amount : null,
    currency: typeof record.currency === "string" ? record.currency : null,
    note: typeof record.note === "string" ? record.note : null,
    adjustedAt: typeof record.adjustedAt === "string" ? record.adjustedAt : null,
  };
}

function extractSubscriptionAmountAdjustment(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const adjustment = (metadata as Record<string, unknown>).subscriptionAmountAdjustment;
  if (!adjustment || typeof adjustment !== "object" || Array.isArray(adjustment)) {
    return null;
  }

  const record = adjustment as Record<string, unknown>;
  return {
    amount: typeof record.amount === "number" ? record.amount : null,
    currency: typeof record.currency === "string" ? record.currency : null,
    note: typeof record.note === "string" ? record.note : null,
    adjustedAt: typeof record.adjustedAt === "string" ? record.adjustedAt : null,
    providerSubscriptionId: typeof record.providerSubscriptionId === "string" ? record.providerSubscriptionId : null,
  };
}

function formatPhone(
  phoneCountryCode?: string | null,
  phoneNumber?: string | null,
) {
  return phoneNumber
    ? `${phoneCountryCode ?? ""} ${phoneNumber}`.trim()
    : "Pending";
}

function registrationSourceLabel(notes: string | null | undefined) {
  if (notes?.includes("parent-dashboard-add-program")) {
    return "Program enrollment";
  }
  if (notes?.includes("parent-dashboard-add-child")) {
    return "Additional child";
  }
  return "New registration";
}

export type AdminDashboardFilters = {
  orderStatus?: string;
  orderPayment?: string;
  orderProgram?: string;
  orderPricing?: string;
  studentSearch?: string;
  studentPayment?: string;
  studentRegistrationStatus?: string;
  studentProgram?: string;
  studentPricing?: string;
  studentPage?: string;
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
  const studentSearch = filters.studentSearch?.trim();
  const studentPageSize = 25;
  const parsedStudentPage = Number(filters.studentPage ?? 1);
  const currentStudentPage = Number.isFinite(parsedStudentPage) && parsedStudentPage > 0
    ? Math.floor(parsedStudentPage)
    : 1;
  const studentSearchWhere = studentSearch
    ? {
        OR: [
          { displayName: { contains: studentSearch } },
          { user: { firstName: { contains: studentSearch } } },
          { user: { lastName: { contains: studentSearch } } },
          { user: { email: { contains: studentSearch } } },
          { parents: { some: { parent: { user: { firstName: { contains: studentSearch } } } } } },
          { parents: { some: { parent: { user: { lastName: { contains: studentSearch } } } } } },
          { parents: { some: { parent: { user: { email: { contains: studentSearch } } } } } },
          { registrationStudents: { some: { firstName: { contains: studentSearch } } } },
          { registrationStudents: { some: { lastName: { contains: studentSearch } } } },
          { registrationStudents: { some: { registration: { parentFirstName: { contains: studentSearch } } } } },
          { registrationStudents: { some: { registration: { parentLastName: { contains: studentSearch } } } } },
          { registrationStudents: { some: { registration: { parentEmail: { contains: studentSearch } } } } },
        ],
      }
    : null;
  const [
    activeEnrollments,
    pendingRegistrations,
    unreadMessages,
    paidOrders,
    recentRegistrations,
    orders,
    students,
    feeWaiverApplications,
  ] = await Promise.all([
    db.enrollment.count({ where: { status: { in: [...COMPLETED_ENROLLMENT_STATUS_LIST] } } }),
    db.registration.count({
      where: {
        status: { in: ["DRAFT", "SUBMITTED", "PENDING_PAYMENT", "PAYMENT_REVIEW"] },
      },
    }),
    db.contactMessage.count({ where: { status: "NEW" } }),
    db.order.findMany({
      where: completedOrderWhere,
      select: {
        gateway: true,
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
            subscription: true,
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
      where: studentSearchWhere ?? {
        enrollments: {
          some: {
            status: { in: [...COMPLETED_ENROLLMENT_STATUS_LIST] },
          },
        },
      },
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
          orderBy: { createdAt: "desc" },
        },
        registrationStudents: {
          orderBy: { createdAt: "desc" },
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
    const city = extractNoteValue(order.registration?.notes, "City");
    const sourceLabel = registrationSourceLabel(order.registration?.notes);
    const manualPaidAmountAdjustment = extractManualPaidAmountAdjustment(order.metadata);
    const subscriptionAmountAdjustment = extractSubscriptionAmountAdjustment(order.metadata);
    const stripeSubscriptionId =
      order.items.find((item) => item.subscription?.providerSubscriptionId)?.subscription?.providerSubscriptionId ??
      (typeof order.metadata === "object" &&
      order.metadata &&
      !Array.isArray(order.metadata) &&
      typeof (order.metadata as Record<string, unknown>).subscriptionId === "string"
        ? String((order.metadata as Record<string, unknown>).subscriptionId)
        : null);
    const programTitles = Array.from(
      new Set(
        order.items.flatMap((item) => {
          if (item.enrollment?.program?.title) return [displayProgramTitle(item.enrollment.program.title)];
          if (item.offer?.title) return [displayProgramTitle(formatProgramTitle(item.offer.title, item.offer.slug))];
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
      sourceLabel,
      city,
      phone: order.registration?.phoneNumber
        ? formatPhone(order.registration.phoneCountryCode, order.registration.phoneNumber)
        : formatPhone(order.parent.user.phoneCountryCode, order.parent.user.phoneNumber),
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
      manualPaidAmountAdjustment,
      subscriptionAmountAdjustment,
      stripeSubscriptionId,
      registrationStatus: order.registration?.status ?? "Pending",
      enrollmentStates: order.items
        .map((item) => item.enrollment?.status)
        .filter(
          (value): value is NonNullable<typeof value> => Boolean(value),
        ),
      programTitles,
      childCount: childDetails.length,
      childDetails,
      programmeSummary: childDetails
        .map((child) => `${child.name}: ${child.programs.join(", ") || "Programme pending"}`)
        .join("; "),
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

  const studentsViewRaw = students.map((student) => {
    const latestOrder = student.parents[0]?.parent.orders[0] ?? null;
    const latestRegistration = student.registrationStudents[0]?.registration ?? null;
    const enrollmentDetails = student.enrollments.map((enrollment) => ({
      id: enrollment.id,
      programTitle: displayProgramTitle(enrollment.program.title),
      status: enrollment.status,
      startedAt: enrollment.startedAt,
      createdAt: enrollment.createdAt,
      completedAt: enrollment.completedAt,
    }));
    const city = extractNoteValue(latestRegistration?.notes, "City");
    const manualPaidAmountAdjustment = extractManualPaidAmountAdjustment(latestOrder?.metadata);
    const registrationParentName = latestRegistration
      ? formatPersonName(latestRegistration.parentFirstName, latestRegistration.parentLastName)
      : "";
    const linkedParentNames = student.parents
      .map((entry) => formatPersonName(entry.parent.user.firstName, entry.parent.user.lastName))
      .filter(Boolean);
    const parentPhone =
      latestRegistration?.phoneNumber
        ? formatPhone(latestRegistration.phoneCountryCode, latestRegistration.phoneNumber)
        : student.parents
            .map((entry) => formatPhone(entry.parent.user.phoneCountryCode, entry.parent.user.phoneNumber))
            .find((phone) => phone !== "Pending") ?? "Pending";
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
      city,
      phone: parentPhone,
      enrollments: student.enrollments.map((enrollment) => ({
        id: enrollment.id,
        programTitle: displayProgramTitle(enrollment.program.title),
        status: enrollment.status,
      })),
      enrollmentDetails,
      paymentGateway: latestOrder?.gateway ?? "Pending",
      registrationStatus: latestRegistration?.status ?? "Pending",
      orderNumber: latestOrder?.orderNumber ?? null,
      orderCreatedAt: latestOrder?.createdAt ?? null,
      orderPaidAt: latestOrder?.paidAt ?? null,
      registrationCreatedAt: latestRegistration?.createdAt ?? null,
      registrationSubmittedAt: latestRegistration?.submittedAt ?? null,
      registrationConvertedAt: latestRegistration?.convertedAt ?? null,
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
      manualPaidAmountAdjustment,
      parentName: registrationParentName || linkedParentNames.join(", ") || "No parent linked",
      childCount: childNames.length || 1,
      childDetails: childDetails.length ? childDetails : [
        {
          id: student.id,
          name: student.displayName || formatPersonName(student.user.firstName, student.user.lastName) || "Unnamed child",
          age: student.age,
          gender: null,
          programs: Array.from(new Set(student.enrollments.map((enrollment) => displayProgramTitle(enrollment.program.title)))),
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
  const studentsView = Array.from(
    new Map(
      studentsViewRaw
        .filter((student) => studentSearch || student.enrollments.some((enrollment) => COMPLETED_ENROLLMENT_STATUSES.has(enrollment.status)))
        .map((student) => {
          const primaryEnrollment = student.enrollments[0];
          const dedupeKey = [
            student.name.trim().toLowerCase(),
            student.age ?? "",
            student.parentName.trim().toLowerCase(),
            primaryEnrollment?.programTitle.trim().toLowerCase() ?? "",
          ].join("|");
          return [dedupeKey, student] as const;
        }),
    ).values(),
  );

  const filteredStudents = studentsView.filter((student) => {
    if (studentSearch) {
      const haystack = [
        student.name,
        student.email,
        student.parentName,
        ...student.childNames,
        ...student.enrollments.map((enrollment) => `${enrollment.programTitle} ${enrollment.status}`),
      ].join(" ").toLowerCase();
      if (!haystack.includes(studentSearch.toLowerCase())) {
        return false;
      }
    }
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
  const studentTotalPages = Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));
  const safeStudentPage = Math.min(currentStudentPage, studentTotalPages);
  const paginatedStudents = filteredStudents.slice(
    (safeStudentPage - 1) * studentPageSize,
    safeStudentPage * studentPageSize,
  );

  const uniqueOrderPrograms = Array.from(
    new Set(ordersView.flatMap((order) => order.programTitles)),
  ).sort((a, b) => a.localeCompare(b));
  const uniqueStudentPrograms = Array.from(
    new Set(studentsView.flatMap((student) => student.enrollments.map((entry) => entry.programTitle))),
  ).sort((a, b) => a.localeCompare(b));

  const revenueGbp = paidOrders.reduce((sum, order) => {
    return sum + convertAmountToGbp(order.totalAmount, order.currency);
  }, 0);
  const revenueByGateway = ["STRIPE", "PAYPAL", "BANK_TRANSFER"].map((gateway) => {
    const totalGbp = paidOrders
      .filter((order) => order.gateway === gateway)
      .reduce((sum, order) => sum + convertAmountToGbp(order.totalAmount, order.currency), 0);

    return {
      gateway,
      totalGbp: Math.round(totalGbp * 100) / 100,
      orderCount: paidOrders.filter((order) => order.gateway === gateway).length,
    };
  });

  return {
    metrics: {
      totalStudents: studentsView.length,
      activeEnrollments,
      pendingRegistrations,
      unreadMessages,
      revenueGbp: Math.round(revenueGbp * 100) / 100,
    },
    revenueByGateway,
    recentRegistrations,
    orders: filteredOrders,
    students: paginatedStudents,
    studentsPagination: {
      page: safeStudentPage,
      pageSize: studentPageSize,
      totalItems: filteredStudents.length,
      totalPages: studentTotalPages,
      hasPreviousPage: safeStudentPage > 1,
      hasNextPage: safeStudentPage < studentTotalPages,
    },
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
