import { createHmac, timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session-manager";
import { sendPasswordResetEmail } from "@/lib/email/notifications";
import type {
  ForgotPasswordPayload,
  LoginPayload,
  ResetPasswordPayload,
  SignupPayload,
  TeacherSignupPayload,
} from "@/lib/auth/schema";

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

type PasswordResetTokenPayload = {
  sub: string;
  email: string;
  exp: number;
  pwd: string | null;
};

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getPasswordResetSecret() {
  return (
    process.env.PASSWORD_RESET_SECRET ||
    process.env.AUTH_SESSION_SECRET ||
    "gen-mumins-reset-secret"
  );
}

function getPasswordResetHashMarker(passwordHash: string | null | undefined) {
  return passwordHash ? passwordHash.slice(-24) : null;
}

function signPasswordResetToken(payload: PasswordResetTokenPayload) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", getPasswordResetSecret())
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function verifyPasswordResetToken(token: string) {
  const [encodedPayload, providedSignature] = token.split(".");

  if (!encodedPayload || !providedSignature) {
    throw new Error("This password reset link is invalid or has expired.");
  }

  const expectedSignature = createHmac("sha256", getPasswordResetSecret())
    .update(encodedPayload)
    .digest("base64url");

  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error("This password reset link is invalid or has expired.");
  }

  const payload = JSON.parse(
    fromBase64Url(encodedPayload),
  ) as PasswordResetTokenPayload;

  if (!payload.sub || !payload.email || !payload.exp) {
    throw new Error("This password reset link is invalid or has expired.");
  }

  if (payload.exp < Date.now()) {
    throw new Error("This password reset link is invalid or has expired.");
  }

  return payload;
}

export async function requestPasswordReset(payload: ForgotPasswordPayload) {
  const user = await db.user.findUnique({
    where: { email: payload.email },
  });

  if (!user?.passwordHash || user.role === "ADMIN") {
    return { accepted: true as const };
  }

  const token = signPasswordResetToken({
    sub: user.id,
    email: user.email,
    exp: Date.now() + 1000 * 60 * 60 * 2,
    pwd: getPasswordResetHashMarker(user.passwordHash),
  });

  await sendPasswordResetEmail({
    toEmail: user.email,
    firstName: user.firstName,
    resetUrl: `/auth/reset-password?token=${encodeURIComponent(token)}`,
  });

  return { accepted: true as const };
}

export async function resetPasswordWithToken(payload: ResetPasswordPayload) {
  const tokenPayload = verifyPasswordResetToken(payload.token);

  const user = await db.user.findUnique({
    where: { id: tokenPayload.sub },
  });

  if (
    !user ||
    user.email.toLowerCase() !== tokenPayload.email.toLowerCase() ||
    getPasswordResetHashMarker(user.passwordHash) !== tokenPayload.pwd
  ) {
    throw new Error("This password reset link is invalid or has expired.");
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(payload.password),
      },
    });

    await tx.session.deleteMany({
      where: { userId: user.id },
    });
  });

  return {
    email: user.email,
    role: user.role,
  };
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
