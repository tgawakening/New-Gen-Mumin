import { NextResponse } from "next/server";

import { signupPayloadSchema } from "@/lib/auth/schema";
import { registerParentAccount } from "@/lib/auth/service";
import { sendAccountCreationConfirmationEmail } from "@/lib/email/notifications";

export async function POST(request: Request) {
  try {
    const payload = signupPayloadSchema.parse(await request.json());
    const user = await registerParentAccount(payload);

    try {
      await sendAccountCreationConfirmationEmail({
        toEmail: user.email,
        firstName: user.firstName,
        loginUrl: "/auth/login",
      });
    } catch (emailError) {
      console.error("Account creation email failed", emailError);
    }

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
