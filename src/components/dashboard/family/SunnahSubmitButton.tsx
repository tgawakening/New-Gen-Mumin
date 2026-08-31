"use client";

import { useFormStatus } from "react-dom";

export function SunnahSubmitButton({ disabled = false, submittedToday = false }: { disabled?: boolean; submittedToday?: boolean }) {
  const { pending } = useFormStatus();
  const locked = disabled || submittedToday || pending;
  return (
    <button type="submit" disabled={locked} aria-disabled={locked} className="min-h-11 w-full rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white touch-manipulation disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
      {submittedToday ? "Already submitted today" : pending ? "Submitting safely..." : "Submit Sunnah tracker"}
    </button>
  );
}