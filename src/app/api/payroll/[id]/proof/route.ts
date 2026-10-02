import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { canAccessAdminFinance } from "@/lib/admin/access";
import { db } from "@/lib/db";
import { driveDownloadResponse } from "@/lib/google-drive/client";
import type { PayrollSnapshot } from "@/lib/payroll/calculation";
export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
 const session=await getCurrentSession();
 if(!session)return new NextResponse("Sign in to view payment evidence.",{status:401});
 const admin=session.user.role==="ADMIN" && await canAccessAdminFinance(session.user.id);
 if(!admin && session.user.role!=="TEACHER")return new NextResponse("Not found",{status:404});
 const {id}=await params;
 const slip=await db.teacherPayslip.findFirst({where:{id,...(!admin?{teacher:{userId:session.user.id,user:{status:"ACTIVE"}},publishedAt:{not:null}}:{})}});
 if(!slip)return new NextResponse("Not found",{status:404});
 const snapshot=(admin&&request.nextUrl.searchParams.get("draft")==="1"?slip.draftData:slip.publishedData) as unknown as PayrollSnapshot|null;
 if(!snapshot?.proof)return new NextResponse("No payment evidence attached.",{status:404});
 try {
  const media=await driveDownloadResponse(snapshot.proof.fileId);
  const disposition=request.nextUrl.searchParams.get("download")==="1"?"attachment":"inline";
  return new NextResponse(media.body,{headers:{"Content-Type":snapshot.proof.mimeType,"Content-Disposition":disposition+"; filename*=UTF-8''"+encodeURIComponent(snapshot.proof.name),"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox"}});
 }catch{ return new NextResponse("Payment evidence is temporarily unavailable. Please try again.",{status:503}); }
}
