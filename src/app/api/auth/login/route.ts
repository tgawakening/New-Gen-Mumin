import { NextResponse } from "next/server";

import { loginPayloadSchema } from "@/lib/auth/schema";
import { loginParentAccount } from "@/lib/auth/service";

export async function POST(request: Request) {
  try {
    const payload = loginPayloadSchema.parse(await request.json());
    const user = await loginParentAccount(payload);

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log in.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
