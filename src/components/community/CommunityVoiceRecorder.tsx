"use client";

import { Mic, Send, Square, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function CommunityVoiceRecorder({ roomId, studentId }: { roomId: string; studentId?: string }) {
  const router = useRouter();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const timeoutRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseAudio(file: File | null, seconds = 0) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAudioFile(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setDuration(seconds);
  }
  function stopRecording() {
    recorderRef.current?.stop();
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }
  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is unavailable in this browser. Use Choose audio instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        const seconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const mimeType = recorder.mimeType || "audio/webm";
        chooseAudio(new File([new Blob(chunks, { type: mimeType })], `voice-message.${mimeType.includes("mp4") ? "m4a" : "webm"}`, { type: mimeType }), seconds);
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
      };
      startedAtRef.current = Date.now();
      recorder.start();
      setRecording(true);
      timeoutRef.current = window.setTimeout(stopRecording, 60_000);
    } catch {
      setError("Microphone access was not granted. You can choose an audio file instead.");
    }
  }
  async function sendVoice() {
    if (!audioFile) return;
    setBusy(true); setError(null);
    const data = new FormData();
    data.set("audio", audioFile); data.set("roomId", roomId); data.set("durationSeconds", String(duration));
    if (studentId) data.set("studentId", studentId);
    try {
      const response = await fetch("/api/community/voice", { method: "POST", body: data });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to send voice message.");
      chooseAudio(null); router.refresh();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send voice message.");
    } finally { setBusy(false); }
  }
  return <div className="rounded-2xl border border-[#d8e3ed] bg-[#f8fbff] p-3 text-[#22304a]">
    <div className="flex flex-wrap items-center gap-2">
      {!recording ? <button type="button" onClick={startRecording} className="inline-flex items-center gap-2 rounded-full bg-[#b4232d] px-4 py-2 text-sm font-bold text-white"><Mic className="h-4 w-4"/>Record voice</button> : <button type="button" onClick={stopRecording} className="inline-flex animate-pulse items-center gap-2 rounded-full bg-[#b4232d] px-4 py-2 text-sm font-bold text-white"><Square className="h-4 w-4"/>Stop recording</button>}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#c9d6e3] bg-white px-4 py-2 text-sm font-semibold"><Upload className="h-4 w-4"/>Choose audio<input type="file" accept="audio/*" capture="user" className="sr-only" onChange={(event)=>chooseAudio(event.target.files?.[0] ?? null)}/></label>
      <span className="text-xs text-[#617184]">Maximum 60 seconds / 5 MB</span>
    </div>
    {previewUrl ? <div className="mt-3 flex flex-wrap items-center gap-3"><audio controls preload="metadata" src={previewUrl} className="h-10 max-w-full"/><button type="button" disabled={busy} onClick={sendVoice} className="inline-flex items-center gap-2 rounded-full bg-[#17345d] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Send className="h-4 w-4"/>{busy ? "Sending..." : "Send voice message"}</button></div> : null}
    {error ? <p role="alert" className="mt-2 text-xs font-semibold text-[#b4232d]">{error}</p> : null}
  </div>;
}