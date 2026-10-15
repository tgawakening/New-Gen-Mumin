import 'server-only';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ffmpegPath from 'ffmpeg-static';

export class AudioExportBusy extends Error {}
let running = false;
// A seekable loopback proxy lets FFmpeg read Drive ranges without exposing OAuth credentials,
// downloading the entire video first, or buffering an hour-long recording in memory.
export async function recordingAudioStream(source: (range: string | null, signal: AbortSignal) => Promise<Response>, signal: AbortSignal) {
 if (running) throw new AudioExportBusy('Another audio download is running. Please try again when it finishes.');
 if (!ffmpegPath) throw new Error('Audio converter unavailable.');
 signal.throwIfAborted();
 running = true;
 const key = randomUUID();
 const upstreamAbort = new AbortController();
 const server = createServer(async(req,res)=>{
  if (req.url !== `/${key}` || !['GET','HEAD'].includes(req.method||'')) { res.writeHead(404).end(); return; }
  try {
   const upstream = await source(req.headers.range || null, upstreamAbort.signal);
   res.statusCode = upstream.status;
   for(const header of ['content-type','content-length','content-range','accept-ranges']) { const value=upstream.headers.get(header);if(value)res.setHeader(header,value); }
   if(req.method==='HEAD'){await upstream.body?.cancel();res.end();return;}
   if(!upstream.body)throw Error('Empty recording');
   await pipeline(Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream),res);
  } catch { if(!res.headersSent)res.writeHead(502);res.end(); }
 });
 let cleanup = ()=>{upstreamAbort.abort();server.closeAllConnections();server.close();running=false;};
 try {
  await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const address=server.address();if(!address||typeof address==='string')throw Error('Audio stream unavailable');
  const child=spawn(ffmpegPath,['-hide_banner','-loglevel','error','-nostdin','-threads','1','-protocol_whitelist','http,tcp','-i',`http://127.0.0.1:${address.port}/${key}`,'-map','0:a:0','-vn','-threads','1','-ac','1','-ar','24000','-c:a','libmp3lame','-b:a','64k','-f','mp3','pipe:1'],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stderr.resume(); // Never log recording URLs or media metadata.
  let spawnError:Error|undefined;
  child.on('error',error=>{spawnError=error;child.stdout.destroy(error);});
  const ended=new Promise<number|null>(resolve=>child.once('close',resolve));
  let cleaned=false;
  const cancel=()=>{child.kill();child.stdout.destroy(Error('Audio download cancelled.'));};
  const timeout=setTimeout(cancel,15*60*1000);
  cleanup=()=>{if(cleaned)return;cleaned=true;clearTimeout(timeout);signal.removeEventListener('abort',cancel);child.kill();upstreamAbort.abort();server.closeAllConnections();server.close();running=false;};
  signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
  const iterator=child.stdout[Symbol.asyncIterator]();
  const first=await iterator.next();
  if(first.done){const code=await ended;throw spawnError || Error(`No audio track available (${code}).`);}
  async function* output(){try{yield first.value as Uint8Array;for(;;){const part=await iterator.next();if(part.done)break;yield part.value as Uint8Array;}if(await ended!==0)throw Error('Audio conversion interrupted. Please retry.');}finally{cleanup();}}
  const stream=Readable.from(output());
  stream.once('close',cleanup);
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
 } catch(error){cleanup();throw error;}
}
