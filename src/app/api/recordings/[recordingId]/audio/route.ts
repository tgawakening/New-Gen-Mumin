import { getCurrentSession } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { driveMediaRequest } from '@/lib/google-drive/client';
import { AudioExportBusy, recordingAudioStream } from '@/lib/live-classes/recording-audio';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{recordingId:string}>}){
 const session=await getCurrentSession();
 if(!session||session.user.role!=='ADMIN')return Response.json({error:'Admin access required.'},{status:session?403:401});
 const {recordingId}=await params;
 const recording=await db.liveClassRecording.findFirst({where:{id:recordingId,deletedAt:null},select:{driveFileId:true,storageProvider:true,topic:true,recordingStart:true,schedule:{select:{title:true}}}});
 if(!recording)return Response.json({error:'Recording not found.'},{status:404});
 if(!recording.driveFileId||recording.storageProvider!=='google-drive')return Response.json({error:'Prepare this recording before downloading audio.'},{status:409});
 try{
  const body=await recordingAudioStream((range,signal)=>driveMediaRequest(recording.driveFileId!,range,signal),request.signal);
  const title=(recording.schedule?.title||recording.topic||'Recording').replace(/[^a-zA-Z0-9 _-]/g,' ').trim().replace(/\s+/g,'-').slice(0,100)||'Recording';
  const filename=`${recording.recordingStart?.toISOString().slice(0,10)||'Recording'}-${title}-${recordingId.replace(/[^a-zA-Z0-9_-]/g,'').slice(-12)}.mp3`;
  return new Response(body,{headers:{'Content-Type':'audio/mpeg','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no'}});
 }catch(error){return Response.json({error:error instanceof AudioExportBusy?error.message:'Audio could not be prepared. This recording may not have an audio track. You can retry or download the original video.'},{status:error instanceof AudioExportBusy?429:503,headers:{'Cache-Control':'no-store','Retry-After':'30'}});}
}
