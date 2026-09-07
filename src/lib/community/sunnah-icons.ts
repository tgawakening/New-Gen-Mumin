export const SUNNAH_TASK_ICONS = [
  { key: "morning-dua", label: "Morning du'a", src: "/sunnah-icons/morning-dua.png", tone: "from-cyan-500/20 to-blue-700/20" },
  { key: "make-bed", label: "Make the bed", src: "/sunnah-icons/make-bed.png", tone: "from-amber-400/25 to-orange-600/20" },
  { key: "exercise", label: "Healthy movement", src: "/sunnah-icons/exercise.png", tone: "from-pink-500/20 to-fuchsia-700/20" },
  { key: "wash-dishes", label: "Help with dishes", src: "/sunnah-icons/wash-dishes.png", tone: "from-emerald-400/25 to-green-700/20" },
  { key: "serve-others", label: "Serve others first", src: "/sunnah-icons/serve-others.png", tone: "from-violet-400/25 to-purple-700/20" },
  { key: "make-smile", label: "Make someone smile", src: "/sunnah-icons/make-smile.png", tone: "from-orange-400/25 to-rose-600/20" },
  { key: "bedtime-reflection", label: "Bedtime reflection", src: "/sunnah-icons/bedtime-reflection.png", tone: "from-sky-400/25 to-indigo-700/20" },
] as const;

export type SunnahTaskIconKey = (typeof SUNNAH_TASK_ICONS)[number]["key"];
export const DEFAULT_SUNNAH_TASKS = [
  { prompt: "After waking up, read the morning du'a", iconKey: "morning-dua" },
  { prompt: "Make your bed after you wake up", iconKey: "make-bed" },
  { prompt: "Complete 30 air squats and care for your body", iconKey: "exercise" },
  { prompt: "Wash your dishes after eating", iconKey: "wash-dishes" },
  { prompt: "Before eating, check everyone is included and serve others first", iconKey: "serve-others" },
  { prompt: "Make someone smile through kindness", iconKey: "make-smile" },
  { prompt: "Reflect with gratitude before going to bed", iconKey: "bedtime-reflection" },
] satisfies Array<{ prompt: string; iconKey: SunnahTaskIconKey }>;

export function sunnahTaskIcon(meta: unknown, prompt = "") {
  const stored = meta && typeof meta === "object" && "iconKey" in meta ? String((meta as { iconKey?: unknown }).iconKey ?? "") : "";
  const exact = SUNNAH_TASK_ICONS.find((icon) => icon.key === stored);
  if (exact) return exact;
  const value = prompt.toLowerCase();
  if (value.includes("bed")) return value.includes("before") || value.includes("reflect") ? SUNNAH_TASK_ICONS[6] : SUNNAH_TASK_ICONS[1];
  if (value.includes("dish") || value.includes("wash")) return SUNNAH_TASK_ICONS[3];
  if (value.includes("squat") || value.includes("exercise") || value.includes("body")) return SUNNAH_TASK_ICONS[2];
  if (value.includes("food") || value.includes("eat") || value.includes("serve")) return SUNNAH_TASK_ICONS[4];
  if (value.includes("smile") || value.includes("kind")) return SUNNAH_TASK_ICONS[5];
  return SUNNAH_TASK_ICONS[0];
}