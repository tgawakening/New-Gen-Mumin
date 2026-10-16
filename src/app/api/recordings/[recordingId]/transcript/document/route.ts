import { getCurrentSession } from '@/lib/auth/session';
import { recordingForTranscript } from '@/lib/transcripts/service';
import { transcriptDocx, transcriptText } from '@/lib/transcripts/document';
import type { TranscriptSegment } from '@/lib/transcripts/format';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{recordingId:string}>}){
 const session=await getCurrentSession();if(!session||session.user.role!=='ADMIN')return Response.json({error:'Admin access required.'},{status:session?403:401});
 try{
  const recording=await recordingForTranscript((await params).recordingId),row=recording.transcript;
  if(row?.status!=='READY')return Response.json({error:'Transcript is not ready.'},{status:409});
  const input={title:recording.schedule.title||recording.topic||'Class recording',teacher:`${recording.schedule.teacher.user.firstName} ${recording.schedule.teacher.user.lastName}`,date:recording.recordingStart?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Karachi'}).format(recording.recordingStart)+' PKT':'Not recorded',provider:row.provider,segments:row.segments as unknown as TranscriptSegment[],names:(row.speakerNames??{}) as Record<string,string>};
  const plain=new URL(request.url).searchParams.get('format')==='txt';
  const label=input.title.replace(/[^a-zA-Z0-9 _-]/g,' ').trim().replace(/\s+/g,'-').slice(0,80)||'Class';
  const filename=`Gen-Mumin-${label}-${recording.id.replace(/[^a-zA-Z0-9_-]/g,'').slice(-12)}-transcript.${plain?'txt':'docx'}`;
  return new Response(plain?transcriptText(input):new Uint8Array(transcriptDocx(input)),{headers:{'Content-Type':plain?'text/plain; charset=utf-8':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch{return Response.json({error:'Transcript document is unavailable.'},{status:404});}
}
