export function QuizQuestionImage({ meta, className = "mt-5 max-h-[420px] w-full rounded-[24px] bg-white object-contain" }: { meta: unknown; className?: string }) {
  const value = meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as { imageDataUrl?: unknown }).imageDataUrl : null;
  return typeof value === "string" && value.startsWith("data:image/") ? <img src={value} alt="Question illustration" className={className} /> : null;
}
