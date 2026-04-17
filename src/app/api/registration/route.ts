import { NextResponse } from "next/server";

import { createRegistrationDraft } from "@/lib/registration/service";
import { registrationPayloadSchema } from "@/lib/registration/schema";

export async function POST(request: Request) {
  try {
    const payload = registrationPayloadSchema.parse(await request.json());
    const registration = await createRegistrationDraft(payload);

    return NextResponse.json({
      registrationId: registration.id,
      totalAmount: registration.totalAmount,
      currency: registration.selectedCurrency,
      studentCount: registration.students.length,
      itemCount: registration.items.length,
      status: registration.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create registration.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
