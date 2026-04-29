import { NextResponse } from "next/server";

import { forgotPasswordPayloadSchema } from "@/lib/auth/schema";
import { requestPasswordReset } from "@/lib/auth/service";

export async function POST(request: Request) {
  try {
    const payload = forgotPasswordPayloadSchema.parse(await request.json());
    await requestPasswordReset(payload);

    return NextResponse.json({
      ok: true,
      message:
        "If this email is registered, a password reset link has been sent.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to start password reset.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
