import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/auth/session";
import { recoveryInput, saveAdminAttendance } from "@/lib/live-classes/admin-attendance";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host') || new URL(request.url).host;
  let sameOrigin = false;
  try { sameOrigin = Boolean(origin && new URL(origin).host === host); } catch { /* Reject malformed origins. */ }
  if (!sameOrigin) return NextResponse.json({ error: 'Please save from the Gen-Mumin admin page.' }, { status: 403, headers });
  try {
    const session = await getCurrentSession();
    if (session?.user.role !== 'ADMIN') return NextResponse.json({ error: 'Your admin session expired. Sign in again before saving.' }, { status: 401, headers });
    const parsed = recoveryInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Check the learner, date range and missed-class details before saving.' }, { status: 400, headers });
    const data = await saveAdminAttendance(session.user.id, parsed.data);
    // Saving has committed. A refresh failure must not misreport it as an unsaved update.
    try { for (const path of ['/parent','/student','/admin/attendance','/admin/rewards']) revalidatePath(path,'layout'); }
    catch (error) { console.error('Attendance saved; cache refresh failed',error); }
    return NextResponse.json({ data, error: '' }, { headers });
  } catch (error) {
    console.error('Admin attendance save failed',error);
    return NextResponse.json({ error: error instanceof Error && !('code' in error) && !/prisma|database|connection/i.test(error.message) ? error.message : 'Attendance could not be saved. Please retry; duplicate points are prevented.' }, { status: 400, headers });
  }
}
