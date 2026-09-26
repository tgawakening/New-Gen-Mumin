import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { previewAdminAttendance } from "@/lib/live-classes/admin-attendance";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const session = await getCurrentSession();
    if (session?.user.role !== "ADMIN") return NextResponse.json({ error: "Your admin session expired. Sign in again, then retry Preview." }, { status: 401, headers });
    const params = new URL(request.url).searchParams;
    const studentId = params.get("studentId"), from = params.get("from"), to = params.get("to");
    if (!studentId || !from || !to) return NextResponse.json({ error: "Select a learner and both dates." }, { status: 400, headers });
    return NextResponse.json({ data: await previewAdminAttendance(session.user.id, studentId, from, to), error: "" }, { headers });
  } catch (error) {
    console.error("Admin attendance preview failed", error);
    const infrastructure = !(error instanceof Error) || 'code' in error || (error instanceof Error && /prisma|connection|timeout|database/i.test(error.message));
    return NextResponse.json({ error: infrastructure ? "Attendance could not be loaded from the server. Please retry shortly." : (error as Error).message }, { status: infrastructure ? 503 : 400, headers });
  }
}
