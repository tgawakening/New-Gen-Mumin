"use client";

import { Volume2 } from "lucide-react";

type LiveQuizCelebrationClientProps = {
  tone?: "success" | "effort" | "ready";
  label?: string;
};

function playNotes(tone: LiveQuizCelebrationClientProps["tone"]) {
  const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const audio = new AudioContextClass();
  const notes = tone === "effort" ? [392, 440, 392] : tone === "ready" ? [330, 392, 523] : [523, 659, 784, 1046];

  notes.forEach((frequency, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(audio.destination);
    const start = audio.currentTime + index * 0.12;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    oscillator.start(start);
    oscillator.stop(start + 0.18);
  });
}

export function LiveQuizCelebrationClient({ tone = "success", label = "Play quiz sound" }: LiveQuizCelebrationClientProps) {
  return (
    <button
      type="button"
      onClick={() => playNotes(tone)}
      className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/90 px-4 py-2 text-sm font-semibold text-[#22304a] shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
    >
      <Volume2 className="h-4 w-4" />
      {label}
    </button>
  );
}
