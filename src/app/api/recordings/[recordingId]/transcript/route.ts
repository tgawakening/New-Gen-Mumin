import { getCurrentSession } from '@/lib/auth/session';
import { attachTranscriptJob, clearUncertainSubmission, importCaptions, saveSpeakerNames, startAiTranscript, transcriptView, TranscriptError } from '@/lib/transcripts/service';
export const dynamic='force-dynamic';
type Context={params:Promise<{recordingId:string}>};
const failure=(error:unknown)=>Response.json({error:error instanceof TranscriptError?error.message:'Transcript could not be loaded. Please try again.'},{status:error instanceof TranscriptError?error.status:503,headers:{'Cache-Control':'private, no-store'}});
export async function GET(_request:Request,{params}:Context){
 const session=await getCurrentSession();if(!session||session.user.role!=='ADMIN')return Response.json({error:'Admin access required.'},{status:session?403:401});
 try{return Response.json(await transcriptView((await params).recordingId),{headers:{'Cache-Control':'private, no-store'}});}catch(error){return failure(error);}
}
export async function POST(request:Request,{params}:Context){
 const session=await getCurrentSession();if(!session||session.user.role!=='ADMIN')return Response.json({error:'Admin access required.'},{status:session?403:401});
 try{
  const host=request.headers.get('x-forwarded-host')?.split(',')[0].trim()||request.headers.get('host');
  let originHost='';try{originHost=new URL(request.headers.get('origin')||'').host;}catch{}
  if(originHost!==host)throw new TranscriptError('Submit from your admin portal.',403);
  if(Number(request.headers.get('content-length')||0)>2_100_000)throw new TranscriptError('Transcript request is too large.',413);
  const text=await request.text();if(Buffer.byteLength(text)>2_100_000)throw new TranscriptError('Transcript request is too large.',413);
  let body;try{body=JSON.parse(text);}catch{throw new TranscriptError('Invalid request.');}
  if(!body||typeof body!=='object'||Array.isArray(body))throw new TranscriptError('Invalid request.');
  const id=(await params).recordingId;
  if(body.action==='zoom')await importCaptions(id,session.user.id);
  else if(body.action==='upload'&&typeof body.vtt==='string')await importCaptions(id,session.user.id,body.vtt);
  else if(body.action==='ai')await startAiTranscript(id,session.user.id,String(body.language||'auto'));
  else if(body.action==='clear')await clearUncertainSubmission(id,body.confirmed===true);
  else if(body.action==='names')await saveSpeakerNames(id,body.names);
  else if(body.action==='attach'&&typeof body.jobId==='string'&&body.jobId.length<=150)await attachTranscriptJob(id,body.jobId);
  else throw new TranscriptError('Unknown transcript action.');
  return Response.json(await transcriptView(id),{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return failure(error);}
}
