import { db } from '@/lib/db';
import { driveMediaRequest } from '@/lib/google-drive/client';
import { validMediaToken } from '@/lib/transcripts/service';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{recordingId:string}>}){
 const id=(await params).recordingId;
 const row=await db.recordingTranscript.findUnique({where:{recordingId:id},include:{recording:{select:{deletedAt:true,driveFileId:true,storageProvider:true}}}});
 if(!row||row.recording.deletedAt||row.recording.storageProvider!=='google-drive'||!row.recording.driveFileId||!validMediaToken(new URL(request.url).searchParams.get('token'),row.mediaTokenHash,row.mediaExpiresAt,row.status))return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 try{const upstream=await driveMediaRequest(row.recording.driveFileId,request.headers.get('range'),request.signal);const headers=new Headers({'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});for(const key of ['content-type','content-length','content-range','accept-ranges']){const value=upstream.headers.get(key);if(value)headers.set(key,value);}return new Response(upstream.body,{status:upstream.status,headers});}catch{return new Response('Temporarily unavailable',{status:503});}
}
