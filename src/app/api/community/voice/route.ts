import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { postCommunityVoiceMessage } from "@/lib/community/rooms";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sign in to send a voice message." }, { status: 401 });
  try {
    const data = await request.formData();
    const file = data.get("audio");
    if (!(file instanceof File)) return NextResponse.json({ error: "Record or choose a voice message first." }, { status: 400 });
    const message = await postCommunityVoiceMessage({
      actorUserId: session.user.id,
      roomId: String(data.get("roomId") || ""),
      studentId: String(data.get("studentId") || "") || null,
      file,
      durationSeconds: Number(data.get("durationSeconds") || 0) || null,
    });
    return NextResponse.json({ id: message.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send voice message." }, { status: 400 });
  }
}