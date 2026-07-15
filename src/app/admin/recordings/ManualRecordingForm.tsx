"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

type TeacherOption = {
  id: string;
  name: string;
  programs: Array<{ id: string; title: string }>;
};

type ManualRecordingFormProps = {
  teachers: TeacherOption[];
};

export function ManualRecordingForm({ teachers }: ManualRecordingFormProps) {
  const router = useRouter();
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [source, setSource] = useState<"upload" | "drive">("drive");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "processing" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const busy = uploadState === "uploading" || uploadState === "processing";

  const selectedTeacher = useMemo(
    () => teachers.find((teacher) => teacher.id === teacherId) ?? teachers[0],
    [teacherId, teachers],
  );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      setDurationSeconds("");
      return;
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      if (Number.isFinite(video.duration) && video.duration > 0) {
        setDurationSeconds(String(Math.round(video.duration)));
      }
    };
    video.src = URL.createObjectURL(file);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    setUploadState(source === "upload" ? "uploading" : "processing");
    setProgress(source === "upload" ? 0 : 100);
    setMessage(source === "upload" ? "Uploading recording..." : "Connecting Drive recording...");

    const request = new XMLHttpRequest();
    request.open("POST", "/api/admin/recordings/manual");
    request.upload.onprogress = (progressEvent) => {
      if (!progressEvent.lengthComputable) return;
      const percent = Math.max(1, Math.min(95, Math.round((progressEvent.loaded / progressEvent.total) * 100)));
      setProgress(percent);
      setMessage(`Uploading recording... ${percent}%`);
    };
    request.onreadystatechange = () => {
      if (request.readyState === XMLHttpRequest.HEADERS_RECEIVED && request.status < 400) {
        setUploadState("processing");
        setProgress(100);
        setMessage("Upload received. Saving recording to Google Drive...");
      }
    };
    request.onload = () => {
      let payload: { ok?: boolean; message?: string } = {};
      try {
        payload = JSON.parse(request.responseText || "{}");
      } catch {
        payload = {};
      }

      if (request.status >= 200 && request.status < 300 && payload.ok) {
        setUploadState("success");
        setProgress(100);
        setMessage(payload.message || "Recording uploaded successfully.");
        form.reset();
        setDurationSeconds("");
        router.refresh();
        return;
      }

      setUploadState("error");
      setProgress(0);
      setMessage(payload.message || "Recording upload failed. Please try again or use Drive link mode for large videos.");
    };
    request.onerror = () => {
      setUploadState("error");
      setProgress(0);
      setMessage("Recording upload failed due to a network/server error. Large files are safer through Drive link mode.");
    };
    request.send(formData);
  }

  if (!teachers.length) {
    return <p className="text-sm text-[#617184]">Add active teachers and programme assignments before adding manual recordings.</p>;
  }

  return (
    <form onSubmit={handleSubmit} encType="multipart/form-data" className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <label className="block text-sm font-semibold text-[#22304a]">
          Recording title
          <input name="title" required disabled={busy} placeholder="Example: Week 5 parenting session" className="mt-2 w-full rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm outline-none focus:border-[#c27a2c] disabled:bg-[#f3f6f8]" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-[#22304a]">
            Teacher
            <select name="teacherId" required disabled={busy} value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm outline-none focus:border-[#c27a2c] disabled:bg-[#f3f6f8]">
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-[#22304a]">
            Program
            <select name="programId" required disabled={busy} className="mt-2 w-full rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm outline-none focus:border-[#c27a2c] disabled:bg-[#f3f6f8]">
              {(selectedTeacher?.programs ?? []).map((program) => (
                <option key={program.id} value={program.id}>{program.title}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-[#22304a]">
            Session date
            <input name="sessionDate" type="date" disabled={busy} className="mt-2 w-full rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm outline-none focus:border-[#c27a2c] disabled:bg-[#f3f6f8]" />
          </label>

          <label className="block text-sm font-semibold text-[#22304a]">
            Length
            <input name="durationLabel" value={durationSeconds ? `${Math.round(Number(durationSeconds) / 60)} minutes` : "Auto from video when available"} readOnly className="mt-2 w-full rounded-2xl border border-[#d8e3ed] bg-[#fbf6ef] px-4 py-3 text-sm text-[#617184]" />
            <input type="hidden" name="durationSeconds" value={durationSeconds} />
          </label>
        </div>
      </div>

      <div className="space-y-4 rounded-[24px] bg-[#fbf6ef] p-4">
        <div className="grid grid-cols-2 gap-2 rounded-full bg-white p-1">
          <button type="button" disabled={busy} onClick={() => setSource("drive")} className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${source === "drive" ? "bg-[#22304a] text-white" : "text-[#617184]"}`}>Drive link</button>
          <button type="button" disabled={busy} onClick={() => setSource("upload")} className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${source === "upload" ? "bg-[#22304a] text-white" : "text-[#617184]"}`}>Upload file</button>
        </div>
        <input type="hidden" name="source" value={source} />

        {source === "drive" ? (
          <label className="block text-sm font-semibold text-[#22304a]">
            Google Drive video link or file ID
            <input name="driveUrl" disabled={busy} placeholder="https://drive.google.com/file/d/..." className="mt-2 w-full rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm outline-none focus:border-[#c27a2c] disabled:bg-[#f3f6f8]" />
            <span className="mt-2 block text-xs leading-5 text-[#617184]">Best for long 45-60 minute recordings already uploaded to the teacher Drive folder.</span>
          </label>
        ) : (
          <label className="block text-sm font-semibold text-[#22304a]">
            Upload recording
            <input name="recordingFile" type="file" accept="video/*,audio/*" disabled={busy} onChange={handleFileChange} className="mt-2 w-full rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 text-sm outline-none focus:border-[#c27a2c] disabled:bg-[#f3f6f8]" />
            <span className="mt-2 block text-xs leading-5 text-[#617184]">For very large files, upload to Drive first and use Drive link mode.</span>
          </label>
        )}

        <label className="flex items-start gap-3 rounded-2xl bg-white p-3 text-sm text-[#22304a]">
          <input name="notifyUsers" type="checkbox" value="yes" disabled={busy} className="mt-1" />
          <span>Notify related parents, students, and teacher that this recording is ready.</span>
        </label>

        {uploadState !== "idle" ? (
          <div className={`rounded-2xl border p-3 text-sm ${uploadState === "success" ? "border-[#bfe4ca] bg-[#effaf3] text-[#2f6b4b]" : uploadState === "error" ? "border-[#efb3b3] bg-[#fff4f4] text-[#a23c3c]" : "border-[#d8e3ed] bg-white text-[#22304a]"}`}>
            <div className="flex items-center justify-between gap-3 font-semibold">
              <span>{message}</span>
              {busy ? <span>{progress}%</span> : null}
            </div>
            {busy ? (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e6edf4]">
                <div className="h-full rounded-full bg-[#22304a] transition-all" style={{ width: `${progress}%` }} />
              </div>
            ) : null}
          </div>
        ) : null}

        <button disabled={busy} className="w-full rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? "Recording being processed..." : uploadState === "success" ? "Add another recording" : "Add recording"}
        </button>
      </div>
    </form>
  );
}
