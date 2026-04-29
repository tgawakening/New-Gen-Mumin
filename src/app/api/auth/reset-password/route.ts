import { NextResponse } from "next/server";

import { resetPasswordPayloadSchema } from "@/lib/auth/schema";
import { resetPasswordWithToken } from "@/lib/auth/service";

export async function POST(request: Request) {
  try {
    const payload = resetPasswordPayloadSchema.parse(await request.json());
    await resetPasswordWithToken(payload);

    return NextResponse.json({
      ok: true,
      message: "Your password has been updated. You can now log in.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to reset password.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
