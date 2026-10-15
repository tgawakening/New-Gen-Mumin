/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the real converter against a tiny local video. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),{execFileSync}=require('node:child_process');
const ffmpeg=require('ffmpeg-static');
const filename=path.resolve('src/lib/live-classes/recording-audio.ts'),mod=new Module(filename);
mod.require=id=>id==='server-only'?{}:require(id);
mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const {recordingAudioStream,AudioExportBusy}=mod.exports;
test('converts actual video to MP3 with range seeking and bounded concurrency',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'genm-audio-test-'));
 try{
  const video=path.join(dir,'sample.mp4');
  execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=160x90:r=10','-f','lavfi','-i','sine=frequency=440:sample_rate=24000','-t','2','-c:v','mpeg4','-c:a','aac',video],{windowsHide:true});
  const data=fs.readFileSync(video),ranges=[];
  const source=async range=>{ranges.push(range);const match=range?.match(/bytes=(\d+)-(\d*)/);const start=match?Number(match[1]):0,end=match?.[2]?Math.min(Number(match[2]),data.length-1):data.length-1;return new Response(data.subarray(start,end+1),{status:match?206:200,headers:{'content-type':'video/mp4','content-length':String(end-start+1),'accept-ranges':'bytes',...(match?{'content-range':`bytes ${start}-${end}/${data.length}`}:{})}});};
  const stream=await recordingAudioStream(source,new AbortController().signal);
  await assert.rejects(recordingAudioStream(source,new AbortController().signal),AudioExportBusy);
  const mp3=Buffer.from(await new Response(stream).arrayBuffer());assert.ok(mp3.length>1000);assert.ok(ranges.some(Boolean));
  const output=path.join(dir,'audio.mp3');fs.writeFileSync(output,mp3);
  execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-i',output,'-f','null','-'],{windowsHide:true});
  const again=await recordingAudioStream(source,new AbortController().signal);await new Response(again).arrayBuffer();
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('already-cancelled requests do not take a conversion slot',async()=>{const c=new AbortController();c.abort();await assert.rejects(recordingAudioStream(async()=>new Response(),c.signal));});
