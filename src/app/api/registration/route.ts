import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  sendAdminNewEnrollmentEmail,
  sendEnrollmentConfirmationEmail,
} from "@/lib/email/notifications";
import { createRegistrationDraft } from "@/lib/registration/service";
import { registrationPayloadSchema } from "@/lib/registration/schema";

export async function POST(request: Request) {
  try {
    const payload = registrationPayloadSchema.parse(await request.json());
    const registration = await createRegistrationDraft(payload);

    try {
      await Promise.all([
        sendEnrollmentConfirmationEmail({
          toEmail: registration.parentEmail,
          parentName: `${registration.parentFirstName} ${registration.parentLastName}`.trim(),
          registrationId: registration.id,
          totalAmount: registration.totalAmount,
          currency: registration.selectedCurrency,
          studentCount: registration.students.length,
        }),
        sendAdminNewEnrollmentEmail({
          parentName: `${registration.parentFirstName} ${registration.parentLastName}`.trim(),
          parentEmail: registration.parentEmail,
          registrationId: registration.id,
          totalAmount: registration.totalAmount,
          currency: registration.selectedCurrency,
          studentCount: registration.students.length,
          country: registration.selectedCountryName ?? "Not provided",
        }),
      ]);
    } catch (emailError) {
      console.error("Registration emails failed", emailError);
    }

    return NextResponse.json({
      registrationId: registration.id,
      totalAmount: registration.totalAmount,
      currency: registration.selectedCurrency,
      studentCount: registration.students.length,
      itemCount: registration.items.length,
      status: registration.status,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const phoneIssue = error.issues.find(
        (issue) => issue.path.join(".") === "phoneNumber",
      );

      if (phoneIssue) {
        return NextResponse.json(
          { error: "Phone number must contain at least 6 digits." },
          { status: 400 },
        );
      }

      return NextResponse.json(
        {
          error:
            error.issues[0]?.message ??
            "Please review the registration form and try again.",
        },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : "Unable to create registration.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
