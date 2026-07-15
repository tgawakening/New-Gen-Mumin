"use client";

import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";

type TeacherOption = {
  id: string;
  name: string;
  programs: Array<{ id: string; title: string }>;
};

type ManualRecordingFormProps = {
  teachers: TeacherOption[];
};

export function ManualRecordingForm({ teachers }: ManualRecordingFormProps) {
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [source, setSource] = useState<"upload" | "drive">("drive");
  const [durationSeconds, setDurationSeconds] = useState("");

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

  if (!teachers.length) {
    return <p className="text-sm text-[#617184]">Add active teachers and programme assignments before adding manual recordings.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <label className="block text-sm font-semibold text-[#22304a]">
          Recording title
          <input name="title" required placeholder="Example: Week 5 parenting session" className="mt-2 w-full rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm outline-none focus:border-[#c27a2c]" />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-[#22304a]">
            Teacher
            <select name="teacherId" required value={teacherId} onChange={(event) => setTeacherId(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm outline-none focus:border-[#c27a2c]">
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold text-[#22304a]">
            Program
            <select name="programId" required className="mt-2 w-full rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm outline-none focus:border-[#c27a2c]">
              {(selectedTeacher?.programs ?? []).map((program) => (
                <option key={program.id} value={program.id}>{program.title}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-semibold text-[#22304a]">
            Session date
            <input name="sessionDate" type="date" className="mt-2 w-full rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm outline-none focus:border-[#c27a2c]" />
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
          <button type="button" onClick={() => setSource("drive")} className={`rounded-full px-4 py-2 text-sm font-semibold ${source === "drive" ? "bg-[#22304a] text-white" : "text-[#617184]"}`}>Drive link</button>
          <button type="button" onClick={() => setSource("upload")} className={`rounded-full px-4 py-2 text-sm font-semibold ${source === "upload" ? "bg-[#22304a] text-white" : "text-[#617184]"}`}>Upload file</button>
        </div>
        <input type="hidden" name="source" value={source} />

        {source === "drive" ? (
          <label className="block text-sm font-semibold text-[#22304a]">
            Google Drive video link or file ID
            <input name="driveUrl" placeholder="https://drive.google.com/file/d/..." className="mt-2 w-full rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm outline-none focus:border-[#c27a2c]" />
            <span className="mt-2 block text-xs leading-5 text-[#617184]">Best for long 45-60 minute recordings already uploaded to the teacher Drive folder.</span>
          </label>
        ) : (
          <label className="block text-sm font-semibold text-[#22304a]">
            Upload recording
            <input name="recordingFile" type="file" accept="video/*,audio/*" onChange={handleFileChange} className="mt-2 w-full rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 text-sm outline-none focus:border-[#c27a2c]" />
            <span className="mt-2 block text-xs leading-5 text-[#617184]">For very large files, upload to Drive first and use Drive link mode.</span>
          </label>
        )}

        <label className="flex items-start gap-3 rounded-2xl bg-white p-3 text-sm text-[#22304a]">
          <input name="notifyUsers" type="checkbox" value="yes" className="mt-1" />
          <span>Notify related parents, students, and teacher that this recording is ready.</span>
        </label>

        <button className="w-full rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">Add recording</button>
      </div>
    </div>
  );
}
