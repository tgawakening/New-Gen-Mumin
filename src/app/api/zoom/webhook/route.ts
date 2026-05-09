import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

function webhookSecret() {
  return env.success ? env.data.ZOOM_WEBHOOK_SECRET_TOKEN : undefined;
}

function hashWithSecret(value: string) {
  const secret = webhookSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(value).digest("hex");
}

function verifyZoomSignature(request: NextRequest, rawBody: string) {
  const secret = webhookSecret();
  if (!secret) return false;

  const timestamp = request.headers.get("x-zm-request-timestamp");
  const signature = request.headers.get("x-zm-signature");
  if (!timestamp || !signature) return false;

  const expected = `v0=${hashWithSecret(`v0:${timestamp}:${rawBody}`)}`;
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const payload = JSON.parse(rawBody) as {
    event?: string;
    payload?: {
      plainToken?: string;
      object?: {
        id?: string | number;
        topic?: string;
        join_url?: string;
        host_email?: string;
        recording_files?: Array<{ play_url?: string }>;
      };
    };
  };

  if (payload.event === "endpoint.url_validation" && payload.payload?.plainToken) {
    return NextResponse.json({
      plainToken: payload.payload.plainToken,
      encryptedToken: hashWithSecret(payload.payload.plainToken),
    });
  }

  if (!verifyZoomSignature(request, rawBody)) {
    return NextResponse.json({ error: "Invalid Zoom webhook signature." }, { status: 401 });
  }

  const meetingId = payload.payload?.object?.id ? String(payload.payload.object.id) : null;
  if (!meetingId) {
    return NextResponse.json({ received: true });
  }

  const schedule = await db.classSchedule.findFirst({
    where: {
      OR: [{ meetingId }, { recurringSeriesId: meetingId }],
    },
    include: {
      teacher: { include: { user: true } },
      program: {
        include: {
          enrollments: {
            where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
            include: {
              parent: { include: { user: true } },
              student: { include: { user: true } },
            },
          },
        },
      },
    },
  });

  if (!schedule) {
    return NextResponse.json({ received: true });
  }

  if (payload.event === "meeting.started") {
    const users = new Map<string, "teacher" | "student" | "parent">();
    users.set(schedule.teacher.user.id, "teacher");
    for (const enrollment of schedule.program.enrollments) {
      users.set(enrollment.student.user.id, "student");
      users.set(enrollment.parent.user.id, "parent");
    }

    await db.notification.createMany({
      data: [...users.entries()].map(([userId, role]) => ({
        userId,
        title: "Live class is now open",
        body: `${schedule.title} has started on Zoom. Open your schedule to join.`,
        href: role === "teacher" ? "/teacher/schedule" : role === "parent" ? "/parent/schedule" : "/student/schedule",
      })),
    });
  }

  if (payload.event === "recording.completed") {
    await db.notification.create({
      data: {
        userId: schedule.teacher.user.id,
        title: "Zoom recording ready",
        body: `${schedule.title} has a new Zoom recording available in Zoom cloud recordings.`,
        href: "/teacher/schedule",
      },
    });
  }

  return NextResponse.json({ received: true });
}
