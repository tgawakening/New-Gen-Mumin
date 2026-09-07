import { NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { postCommunityVoiceMessage } from "@/lib/community/rooms";

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Sign in to share a file." }, { status: 401 });
  try {
    const data = await request.formData();
    const file = data.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file first." }, { status: 400 });
    const message = await postCommunityVoiceMessage({
      actorUserId: session.user.id,
      roomId: String(data.get("roomId") || ""),
      studentId: String(data.get("studentId") || "") || null,
      file,
      attachment: true,
    });
    return NextResponse.json({ id: message.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to share this file." }, { status: 400 });
  }
}
