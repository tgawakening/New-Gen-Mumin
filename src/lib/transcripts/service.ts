import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getZoomTranscriptText } from '@/lib/zoom/client';
import { normalizeUtterances, parseVtt, type TranscriptSegment } from './format';
export class TranscriptError extends Error { constructor(message:string,public status=400){super(message);} }
const json=(value:unknown)=>value as Prisma.InputJsonValue;
const pending=['SUBMITTING','QUEUED','PROCESSING','SUBMIT_UNKNOWN'];
export const aiConfigured=()=>Boolean(process.env.ASSEMBLYAI_API_KEY?.trim());
const digest=(token:string)=>createHash('sha256').update(token).digest('hex');
function matchesMediaToken(token:string|null,hash:string|null){if(!token||!hash)return false;try{return timingSafeEqual(Buffer.from(digest(token),'hex'),Buffer.from(hash,'hex'));}catch{return false;}}
export function validMediaToken(token:string|null,hash:string|null,expires:Date|null,status:string){return Boolean(expires&&expires.getTime()>Date.now()&&pending.includes(status)&&matchesMediaToken(token,hash));}
async function provider(path:string,body?:unknown){
 if(!aiConfigured())throw new TranscriptError('AI transcription is not connected. Add ASSEMBLYAI_API_KEY in the server settings.',503);
 const response=await fetch(`https://api.assemblyai.com/v2/transcript${path}`,{method:body?'POST':'GET',headers:{authorization:process.env.ASSEMBLYAI_API_KEY!,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw new TranscriptError(`Transcription service returned ${response.status}. Check your API key and account balance.`,response.status>=500?503:400);
 return response.json();
}
export async function recordingForTranscript(recordingId:string){
 const row=await db.liveClassRecording.findFirst({where:{id:recordingId,deletedAt:null},include:{transcript:true,schedule:{include:{teacher:{include:{user:{select:{firstName:true,lastName:true}}}}}}}});
 if(!row)throw new TranscriptError('Recording not found.',404);return row;
}
export async function transcriptView(recordingId:string){
 const recording=await recordingForTranscript(recordingId);let row=recording.transcript;
 if(row?.providerJobId&&['QUEUED','PROCESSING'].includes(row.status)&&aiConfigured()){
  const claim=await db.recordingTranscript.updateMany({where:{id:row.id,status:{in:['QUEUED','PROCESSING']},OR:[{lastCheckedAt:null},{lastCheckedAt:{lt:new Date(Date.now()-15000)}}]},data:{lastCheckedAt:new Date()}});
  if(claim.count){try{const remote=await provider(`/${encodeURIComponent(row.providerJobId)}`);
   if(remote.status==='completed'){
    const segments=normalizeUtterances(remote.utterances);
    // If diarization yields nothing, retain the text but never invent speaker turns.
    if(!segments.length&&typeof remote.text==='string'&&remote.text.trim())segments.push({start:0,end:Math.max(0,Number(remote.audio_duration)||0)*1000,speaker:'Unlabelled speaker',text:remote.text.trim()});
    await db.recordingTranscript.update({where:{id:row.id},data:{status:segments.length?'READY':'FAILED',segments:json(segments),error:segments.length?null:'No speech was found in this recording.',mediaTokenHash:null,mediaExpiresAt:null}});
   }else if(remote.status==='error')await db.recordingTranscript.update({where:{id:row.id},data:{status:'FAILED',error:'The transcription service could not process this recording. Check the recording audio, then retry.',mediaTokenHash:null,mediaExpiresAt:null}});
   else if(remote.status==='processing')await db.recordingTranscript.update({where:{id:row.id},data:{status:'PROCESSING',error:null}});
  }catch{ await db.recordingTranscript.update({where:{id:row.id},data:{error:'Could not check AI progress. Verify the transcription service connection and refresh; the existing job will not be submitted again.'}}); }}
  row=await db.recordingTranscript.findUnique({where:{recordingId}});
 }
 const stale=row?.status==='SUBMITTING'&&row.updatedAt.getTime()<Date.now()-120000;
 return {title:recording.schedule.title||recording.topic||'Class recording',teacher:`${recording.schedule.teacher.user.firstName} ${recording.schedule.teacher.user.lastName}`,date:recording.recordingStart?.toISOString()??null,aiConfigured:aiConfigured(),status:stale?'SUBMIT_UNKNOWN':row?.status??'EMPTY',provider:row?.provider??'zoom',providerJobId:row?.providerJobId??null,error:stale?'Submission status is uncertain. Check the transcription service dashboard before trying again.':row?.error??null,segments:(row?.segments??[]) as unknown as TranscriptSegment[],names:(row?.speakerNames??{}) as Record<string,string>};
}
async function storeCaptions(recordingId:string,segments:TranscriptSegment[],source:string,userId:string){
 if(!segments.length)throw new TranscriptError('No timestamped speech was found in this caption file.');
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM LiveClassRecording WHERE id = ${recordingId} FOR UPDATE`;
  const old=await tx.recordingTranscript.findUnique({where:{recordingId}});
  if(old&&(pending.includes(old.status)||old.status==='READY'))throw new TranscriptError('This recording already has a transcript or an active transcription job.',409);
  const data={status:'READY',provider:source,segments:json(segments),speakerNames:{},error:null,requestedByUserId:userId,mediaTokenHash:null,mediaExpiresAt:null};
  await tx.recordingTranscript.upsert({where:{recordingId},create:{recordingId,...data},update:data});
 });
}
export async function importCaptions(recordingId:string,userId:string,vtt?:string){
 const recording=await recordingForTranscript(recordingId);
 let text=vtt;
 if(text===undefined){if(!recording.meetingId)throw new TranscriptError('This recording has no Zoom meeting reference. Upload a VTT/SRT transcript or use AI transcription.');
  try{text=(await getZoomTranscriptText({meetingId:recording.meetingId,recordingFileId:recording.recordingFileId,recordingStart:recording.recordingStart}))??undefined;}catch{throw new TranscriptError('Zoom transcript could not be fetched. Check Zoom cloud-recording access or upload a VTT/SRT file.');}
 }
 if(!text)throw new TranscriptError('No Zoom transcript was found for this class. Use AI transcription or upload a VTT/SRT transcript.');
 if(text.length>2_000_000)throw new TranscriptError('Transcript file must be under 2 MB.',413);
 await storeCaptions(recordingId,parseVtt(text),vtt===undefined?'zoom':'uploaded captions',userId);
}
export async function startAiTranscript(recordingId:string,userId:string,language:string){
 if(!aiConfigured())throw new TranscriptError('AI transcription is not configured. Add ASSEMBLYAI_API_KEY to the server settings.',503);
 if(!['auto','en','ur','ar'].includes(language))throw new TranscriptError('Select a supported language.');
 let base:URL;try{base=new URL(process.env.APP_URL||'');if(base.protocol!=='https:')throw Error();}catch{throw new TranscriptError('Configure APP_URL as the public HTTPS address before starting AI transcription.');}
 const recording=await recordingForTranscript(recordingId);
 if(!recording.driveFileId||recording.storageProvider!=='google-drive')throw new TranscriptError('Prepare this recording before transcribing it.');
 const token=randomBytes(32).toString('hex');
 const claimed=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM LiveClassRecording WHERE id = ${recordingId} FOR UPDATE`;
  const old=await tx.recordingTranscript.findUnique({where:{recordingId}});
  if(old&&(old.status==='READY'||pending.includes(old.status)))return false;
  const data={status:'SUBMITTING',provider:'AssemblyAI',providerJobId:null,error:null,mediaTokenHash:digest(token),mediaExpiresAt:new Date(Date.now()+86400000),requestedByUserId:userId};
  await tx.recordingTranscript.upsert({where:{recordingId},create:{recordingId,...data},update:data});return true;
 });
 if(!claimed)return;
 const media=new URL(`/api/recordings/${encodeURIComponent(recordingId)}/transcript/source`,base);media.searchParams.set('token',token);
 try{
  const remote=await provider('',{audio_url:media.toString(),speaker_labels:true,speech_models:['universal-2'],...(language==='auto'?{language_detection:true}:{language_code:language})});
  if(typeof remote.id!=='string'||!remote.id)throw Error('Missing job identifier');
  await db.recordingTranscript.update({where:{recordingId},data:{status:'QUEUED',providerJobId:remote.id,lastCheckedAt:null}});
 }catch(error){
  // Network/5xx failures may occur after acceptance. Do not automatically create another paid job.
  const rejected=error instanceof TranscriptError&&error.status===400;
  await db.recordingTranscript.update({where:{recordingId},data:{status:rejected?'FAILED':'SUBMIT_UNKNOWN',error:rejected?error.message:'Submission status is uncertain. Check the AssemblyAI dashboard and attach its job ID below; do not resubmit blindly.',...(rejected?{mediaTokenHash:null,mediaExpiresAt:null}:{})}});
 }
}
export async function attachTranscriptJob(recordingId:string,jobId:string){
 const recording=await recordingForTranscript(recordingId),row=recording.transcript;
 if(!row||!['SUBMIT_UNKNOWN','SUBMITTING'].includes(row.status))throw new TranscriptError('There is no uncertain submission to recover.');
 const remote=await provider(`/${encodeURIComponent(jobId)}`);let url:URL;try{url=new URL(remote.audio_url);}catch{throw new TranscriptError('This job has no matching source.');}
 if(url.pathname!==`/api/recordings/${encodeURIComponent(recordingId)}/transcript/source`||!matchesMediaToken(url.searchParams.get('token'),row.mediaTokenHash))throw new TranscriptError('This job does not match this recording.');
 await db.recordingTranscript.update({where:{recordingId},data:{providerJobId:jobId,status:'QUEUED',error:null,lastCheckedAt:null}});
}
export async function saveSpeakerNames(recordingId:string,input:unknown){
 const recording=await recordingForTranscript(recordingId),row=recording.transcript;
 if(row?.status!=='READY')throw new TranscriptError('The transcript is not ready.');
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TranscriptError('Invalid speaker names.');
 const speakers=new Set((row.segments as unknown as TranscriptSegment[]).map(s=>s.speaker)),names:Record<string,string>=Object.create(null);
 for(const [key,value] of Object.entries(input)){if(!speakers.has(key)||typeof value!=='string'||value.length>120)throw new TranscriptError('Invalid speaker name.');if(value.trim())names[key]=value.trim();}
 await db.recordingTranscript.update({where:{recordingId},data:{speakerNames:json(names)}});
}

export async function clearUncertainSubmission(recordingId:string,confirmed:boolean){
 if(!confirmed)throw new TranscriptError('Check the provider dashboard and confirm that no job was created first.');
 const recording=await recordingForTranscript(recordingId),row=recording.transcript;
 if(!row||row.providerJobId||!(row.status==='SUBMIT_UNKNOWN'||(row.status==='SUBMITTING'&&row.updatedAt.getTime()<Date.now()-120000)))throw new TranscriptError('This request cannot be cleared.');
 await db.recordingTranscript.updateMany({where:{id:row.id,providerJobId:null,status:{in:['SUBMIT_UNKNOWN','SUBMITTING']}},data:{status:'FAILED',mediaTokenHash:null,mediaExpiresAt:null,error:'Admin confirmed no provider job exists. You can try again.'}});
}
