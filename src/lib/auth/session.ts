import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { db } from "@/lib/db";
import { DASHBOARD_HOME, type UserRole } from "@/lib/auth/roles";

export const SESSION_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME || "gen_mumins_session";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
};

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"] as const;
const PENDING_REGISTRATION_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_PAYMENT",
  "PAYMENT_REVIEW",
  "EXPIRED",
] as const;
const COMPLETED_REGISTRATION_STATUSES = ["PAID", "CONVERTED"] as const;

export const getCurrentSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({
    where: { sessionToken: token },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      role: session.user.role,
    } satisfies SessionUser,
  };
});

export async function requireUser() {
  const session = await getCurrentSession();

  if (!session) {
    throw new Error("Unauthenticated");
  }

  return session.user;
}

export async function requireRole(role: UserRole) {
  const user = await requireUser();

  if (user.role !== role) {
    throw new Error("Unauthorized");
  }

  return user;
}

export function getDashboardHome(role: UserRole) {
  return DASHBOARD_HOME[role];
}

export async function getParentAccessSnapshot(userId: string) {
  const parentProfile = await db.parentProfile.findUnique({
    where: { userId },
    include: {
      students: {
        include: {
          student: {
            include: {
              enrollments: {
                select: {
                  status: true,
                },
              },
            },
          },
        },
      },
      registrations: {
        where: {
          status: {
            in: [...PENDING_REGISTRATION_STATUSES, ...COMPLETED_REGISTRATION_STATUSES],
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          createdAt: true,
        },
      },
      orders: {
        where: {
          status: "SUCCEEDED",
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  if (!parentProfile) {
    return {
      hasDashboardAccess: false,
      pendingRegistrationId: null as string | null,
    };
  }

  const hasActiveEnrollment = parentProfile.students.some(({ student }) =>
    student.enrollments.some((enrollment) =>
      ACTIVE_ENROLLMENT_STATUSES.includes(
        enrollment.status as (typeof ACTIVE_ENROLLMENT_STATUSES)[number],
      ),
    ),
  );
  const hasCompletedRegistration = parentProfile.registrations.some((registration) =>
    COMPLETED_REGISTRATION_STATUSES.includes(
      registration.status as (typeof COMPLETED_REGISTRATION_STATUSES)[number],
    ),
  );
  const hasSuccessfulOrder = parentProfile.orders.length > 0;

  const pendingRegistration = parentProfile.registrations.find((registration) =>
    PENDING_REGISTRATION_STATUSES.includes(
      registration.status as (typeof PENDING_REGISTRATION_STATUSES)[number],
    ),
  );

  return {
    hasDashboardAccess:
      hasActiveEnrollment || hasCompletedRegistration || hasSuccessfulOrder,
    pendingRegistrationId:
      hasActiveEnrollment || hasCompletedRegistration || hasSuccessfulOrder
        ? null
        : pendingRegistration?.id ?? null,
  };
}

export async function resolvePostLoginDestination(user: SessionUser) {
  if (user.role !== "PARENT") {
    return getDashboardHome(user.role);
  }

  const parentAccess = await getParentAccessSnapshot(user.id);

  if (parentAccess.hasDashboardAccess) {
    return "/parent";
  }

  if (parentAccess.pendingRegistrationId) {
    return `/registration/pending/${parentAccess.pendingRegistrationId}`;
  }

  return "/registration";
}

export async function resolveDashboardLinkForSession(user: SessionUser) {
  if (user.role !== "PARENT") {
    return getDashboardHome(user.role);
  }

  const parentAccess = await getParentAccessSnapshot(user.id);
  return parentAccess.hasDashboardAccess ? "/parent" : null;
}
