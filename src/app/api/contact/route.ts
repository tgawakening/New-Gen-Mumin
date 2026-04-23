import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  sendAdminContactNotificationEmail,
  sendContactAcknowledgementEmail,
} from "@/lib/email/notifications";
import { contactPayloadSchema } from "@/lib/contact/schema";

export async function POST(request: Request) {
  try {
    const payload = contactPayloadSchema.parse(await request.json());

    const message = await db.contactMessage.create({
      data: {
        name: payload.name,
        email: payload.email,
        subject: payload.subject,
        message: payload.message,
      },
    });

    await Promise.all([
      sendContactAcknowledgementEmail({
        toEmail: payload.email,
        name: payload.name,
        subject: payload.subject,
      }),
      sendAdminContactNotificationEmail({
        name: payload.name,
        email: payload.email,
        subject: payload.subject,
        message: payload.message,
      }),
    ]);

    return NextResponse.json({
      messageId: message.id,
      status: message.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit contact form.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
