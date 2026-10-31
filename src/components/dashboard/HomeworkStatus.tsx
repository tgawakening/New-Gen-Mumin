export function HomeworkStatus({ status }: { status: string }) {
  const tone = status === "Submitted late" ? "bg-amber-100 text-amber-900" : status === "Submitted on time" ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>{status}</span>;
}
