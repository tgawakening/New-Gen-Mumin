import Image from "next/image";

import { sunnahTaskIcon, sunnahTaskLabel } from "@/lib/community/sunnah-icons";

export function SunnahTaskChecklistItem({ question }: { question: { id: string; prompt: string; meta: unknown } }) {
  const icon = sunnahTaskIcon(question.meta, question.prompt);
  return (
    <label className="group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-[22px] border border-[#d7e4f3] bg-gradient-to-br from-white to-[#f4f8ff] p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md">
      <input type="checkbox" name={`answer-${question.id}`} value="true" className="peer sr-only" />
      <span className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${icon.tone}`} />
      <span className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#071b3f]">
        <Image src={icon.src} alt="" width={92} height={92} className="h-full w-full object-contain" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold leading-6 text-[#172744]">{sunnahTaskLabel(question.prompt)}</span>
        <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.13em] text-[#617087]">Tap when completed</span>
      </span>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-[#b9c8da] bg-white text-transparent transition peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-checked:text-white">✓</span>
    </label>
  );
}
