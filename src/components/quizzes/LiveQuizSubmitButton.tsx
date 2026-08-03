"use client";

import { useFormStatus } from "react-dom";

type Props = { disabled?: boolean };

export function LiveQuizSubmitButton({ disabled = false }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="w-full rounded-[28px] bg-[#22304a] px-6 py-5 text-xl font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70">
      {pending ? "Locking answer..." : "Lock in answer"}
    </button>
  );
}
