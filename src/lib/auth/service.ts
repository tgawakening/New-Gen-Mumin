import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session-manager";
import type { LoginPayload, SignupPayload, TeacherSignupPayload } from "@/lib/auth/schema";

export async function registerParentAccount(payload: SignupPayload) {
  const existing = await db.user.findUnique({ where: { email: payload.email } });

  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const user = await db.user.create({
    data: {
      email: payload.email,
      passwordHash: hashPassword(payload.password),
      role: "PARENT",
      status: "ACTIVE",
      firstName: payload.firstName,
      lastName: payload.lastName,
      phoneCountryCode: payload.phoneCountryCode,
      phoneNumber: payload.phoneNumber,
      parentProfile: {
        create: {
          billingCountryCode: payload.billingCountryCode || null,
          billingCountryName: payload.billingCountryName || null,
        },
      },
    },
  });

  await createSession(user.id);

  return user;
}

export async function loginParentAccount(payload: LoginPayload) {
  const user = await db.user.findUnique({ where: { email: payload.email } });

  if (!user || !user.passwordHash) {
    throw new Error("Invalid email or password.");
  }

  if (!verifyPassword(payload.password, user.passwordHash)) {
    throw new Error("Invalid email or password.");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("This account is not active right now.");
  }

  await createSession(user.id);

  return user;
}

export async function registerTeacherAccount(payload: TeacherSignupPayload) {
  const existing = await db.user.findUnique({ where: { email: payload.email } });

  if (existing) {
    throw new Error("An account with this email already exists.");
  }

  const user = await db.user.create({
    data: {
      email: payload.email,
      passwordHash: hashPassword(payload.password),
      role: "TEACHER",
      status: "ACTIVE",
      firstName: payload.firstName,
      lastName: payload.lastName,
      phoneCountryCode: payload.phoneCountryCode,
      phoneNumber: payload.phoneNumber,
      timezone: payload.timezone,
      teacherProfile: {
        create: {
          bio: payload.bio || null,
          specialties: payload.specialties.length ? payload.specialties : undefined,
          isActive: true,
        },
      },
    },
  });

  await createSession(user.id);

  return user;
}

function getAdminDashboardCredentials() {
  return {
    email: process.env.ADMIN_DASHBOARD_EMAIL || "tgawakening786@gmail.com",
    password: process.env.ADMIN_DASHBOARD_PASSWORD || "Raahil1985",
  };
}

export async function loginAdminDashboardAccount(payload: LoginPayload) {
  const adminCredentials = getAdminDashboardCredentials();

  if (
    payload.email.trim().toLowerCase() !== adminCredentials.email.trim().toLowerCase() ||
    payload.password !== adminCredentials.password
  ) {
    throw new Error("Invalid admin email or password.");
  }

  let user = await db.user.findUnique({
    where: { email: adminCredentials.email },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        email: adminCredentials.email,
        passwordHash: hashPassword(adminCredentials.password),
        role: "ADMIN",
        status: "ACTIVE",
        firstName: "TGA",
        lastName: "Admin",
        adminProfile: {
          create: {
            title: "Gen-Mumins Admin",
          },
        },
      },
    });
  } else if (user.role !== "ADMIN") {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
  }

  await createSession(user.id);

  return user;
}
