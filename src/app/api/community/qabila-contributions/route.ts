import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { canonicalQabilaName } from "@/lib/community/qabilas";
import { getQabilaHistory } from "@/lib/community/qabila-history";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401, headers });
  if (!["PARENT", "TEACHER", "ADMIN"].includes(session.user.role)) return NextResponse.json({ error: "Parent or teacher access required." }, { status: 403, headers });
  const query = new URL(request.url).searchParams;
  const qabila = canonicalQabilaName(query.get("qabila"));
  const page = Number(query.get("page") || 1);
  const now = new Date();
  const asOf = query.get("asOf") ? new Date(query.get("asOf")!) : now;
  if (!qabila || !Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isFinite(asOf.getTime()) || asOf > now) return NextResponse.json({ error: "Choose a valid Qabila and page." }, { status: 400, headers });
  try {
    const history = await getQabilaHistory({ qabila, page, studentId: query.get("studentId") || undefined, asOf });
    return NextResponse.json(history, { headers });
  } catch (error) {
    if (error instanceof Error && error.message === "Learner is not in this Qabila.") return NextResponse.json({ error: error.message }, { status: 400, headers });
    console.error("Qabila contribution history unavailable", error);
    return NextResponse.json({ error: "Contribution history could not load. Please try again." }, { status: 503, headers });
  }
}
