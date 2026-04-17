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
