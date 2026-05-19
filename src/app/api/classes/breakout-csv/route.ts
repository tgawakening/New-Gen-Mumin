import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getStudentRoomAssignment } from "@/lib/live-classes/rooms";

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"] as const;

function csvCell(value: string | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function chooseZoomEmail(enrollment: {
  student: { user: { email: string } };
  parent: { user: { email: string } };
}) {
  const studentEmail = enrollment.student.user.email;
  if (studentEmail && !studentEmail.toLowerCase().endsWith("@genmumin.local")) {
    return studentEmail;
  }
  return enrollment.parent.user.email;
}

function fileSafeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "zoom-breakout-rooms";
}

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const programId = url.searchParams.get("programId") ?? "";
  if (!programId) {
    return NextResponse.json({ error: "Program is required." }, { status: 400 });
  }

  if (session.user.role === "TEACHER") {
    const teacher = await db.teacherProfile.findUnique({
      where: { userId: session.user.id },
      include: { programAssignments: true },
    });
    if (!teacher?.programAssignments.some((assignment) => assignment.programId === programId)) {
      return NextResponse.json({ error: "Program is not assigned to this teacher." }, { status: 403 });
    }
  }

  const program = await db.program.findUnique({
    where: { id: programId },
    select: { title: true },
  });

  const enrollments = await db.enrollment.findMany({
    where: {
      programId,
      status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
    },
    include: {
      parent: { include: { user: true } },
      student: { include: { user: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = [["Pre-assign Room Name", "Email Address"]];
  const seen = new Set<string>();

  for (const enrollment of enrollments) {
    const room = getStudentRoomAssignment(enrollment.student.learningNotes, programId);
    const roomName = room?.roomName || room?.roomCode;
    const zoomEmail = chooseZoomEmail(enrollment);
    if (!roomName || !zoomEmail) continue;

    const key = `${roomName.toLowerCase()}|${zoomEmail.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push([roomName, zoomEmail]);
  }

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const filename = `${fileSafeName(program?.title ?? "program")}-zoom-breakout-rooms.csv`;

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
