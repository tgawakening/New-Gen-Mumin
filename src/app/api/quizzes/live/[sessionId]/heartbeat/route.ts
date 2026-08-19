import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { heartbeatLiveQuizSession } from "@/lib/quizzes/live";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;
  const active = await heartbeatLiveQuizSession({ sessionId, teacherUserId: session.user.id });
  return NextResponse.json({ ok: active }, { status: active ? 200 : 404 });
}
