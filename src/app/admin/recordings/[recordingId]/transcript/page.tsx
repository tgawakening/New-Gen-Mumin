import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth/session';
import { recordingForTranscript } from '@/lib/transcripts/service';
import { TranscriptWorkspace } from '@/components/recordings/TranscriptWorkspace';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{recordingId:string}>}){
 const session=await getCurrentSession();if(!session)redirect('/auth/login');if(session.user.role!=='ADMIN')notFound();
 const {recordingId}=await params;const recording=await recordingForTranscript(recordingId).catch(()=>null);if(!recording)notFound();
 return <div className="mx-auto max-w-5xl space-y-5 px-4 py-8"><Link href="/admin/recordings" className="text-sm underline">Back to recordings</Link><header><p className="text-xs font-semibold uppercase tracking-widest text-[#a56724]">Admin / Class transcript</p><h1 className="mt-2 text-2xl font-semibold text-[#22304a]">{recording.schedule.title||recording.topic}</h1><p className="mt-2 text-sm text-slate-600">Create a speaker-labelled document to review and share with your client.</p></header><TranscriptWorkspace recordingId={recordingId}/></div>;
}
