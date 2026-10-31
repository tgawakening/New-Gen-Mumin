"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function HomeworkModalFrame({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  return <dialog ref={dialog} aria-labelledby="edit-homework-title" onCancel={(event) => { event.preventDefault(); router.push("/teacher/homework"); }} className="m-auto max-h-[calc(100dvh_-_3rem)] w-[calc(100%_-_1.5rem)] max-w-3xl overflow-y-auto rounded-3xl border-0 bg-white p-0 text-[#22304a] shadow-xl backdrop:bg-[#12213a]/60">{children}</dialog>;
}
