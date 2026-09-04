import Link from "next/link";
import Image from "next/image";
import { BookOpen, CalendarDays, CheckCircle2, Flame, ShieldCheck, Sparkles, Star, Trophy, UsersRound } from "lucide-react";

type QuestMetric = {
  label: string;
  value: string;
  hint: string;
};

type QuestBadge = {
  label: string;
  meta: string;
  tone?: "coral" | "blue" | "mint" | "violet";
};

type QuestAction = {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
};

type HousePointsSummary = {
  total: number;
  quiz: number;
  sunnah: number;
  other: number;
  awards: number;
  recent: Array<{ id: string; points: number; reason: string; sourceType: string }>;
};

type StudentQuestHubProps = {
  studentName: string;
  roleLabel: string;
  mission: {
    title: string;
    label: string;
    detail: string;
    progress: number;
  };
  houseName: string;
  houseVirtue: string;
  houseColor?: string | null;
  metrics: QuestMetric[];
  badges: QuestBadge[];
  actions: QuestAction[];
  nextClassLabel: string;
  circleLabel: string;
  avatarVariant?: "boy" | "girl" | "neutral";
  points: HousePointsSummary;
};


function metricIcon(label: string) {
  const normalized = label.toLowerCase();
  if (normalized.includes("streak")) return Flame;
  if (normalized.includes("level")) return ShieldCheck;
  if (normalized.includes("point")) return Star;
  if (normalized.includes("attendance")) return CheckCircle2;
  if (normalized.includes("mission")) return Sparkles;
  if (normalized.includes("course")) return BookOpen;
  return Trophy;
}

function badgeTone(tone: QuestBadge["tone"]) {
  switch (tone) {
    case "blue":
      return "border-[#c7dff0] bg-[#eef7ff] text-[#235b83]";
    case "mint":
      return "border-[#c9e4d4] bg-[#f0fbf4] text-[#2f6b4b]";
    case "violet":
      return "border-[#d9d0ef] bg-[#f5f1ff] text-[#655199]";
    case "coral":
    default:
      return "border-[#f1d1bd] bg-[#fff1e8] text-[#b85d37]";
  }
}

function AvatarCharacter({
  name,
  variant = "neutral",
}: {
  name: string;
  variant?: StudentQuestHubProps["avatarVariant"];
}) {
  const src = variant === "girl" ? "/gen-mumin-chars/rania-superhero.png" : "/gen-mumin-chars/ali-superhero.png";
  const alt = variant === "girl" ? "Rania Gen-Mumin character" : "Ali Gen-Mumin character";

  return (
    <div className="relative mx-auto flex h-[270px] w-full min-w-0 flex-col overflow-hidden rounded-[28px] bg-gradient-to-b from-white to-[#fff3df] sm:h-[310px]" aria-label={`${name} Gen-Mumin character`}>
      <div className="relative z-20 mx-3 mt-3 shrink-0 rounded-[20px] border border-[#f1c878] bg-white px-3 py-2 text-center text-xs font-bold leading-4 text-[#22304a] shadow-lg">
        Amazing, {name}! Keep strengthening your Qabila.
      </div>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-x-5 bottom-1 h-12 rounded-full bg-[#22304a]/10 blur-xl" />
        <Image src={src} alt={alt} fill sizes="(min-width: 1280px) 300px, 220px" priority className="z-10 object-cover object-[50%_18%] transition-transform duration-300 hover:scale-[1.03]" />
      </div>
    </div>
  );
}

export function StudentQuestHub({
  studentName,
  roleLabel,
  mission,
  houseName,
  houseVirtue,
  houseColor,
  metrics,
  badges,
  actions,
  nextClassLabel,
  circleLabel,
  avatarVariant,
  points,
}: StudentQuestHubProps) {
  const nextMilestone = Math.max(25, Math.ceil((points.total + 1) / 25) * 25);
  const progress = Math.min(100, (points.total / nextMilestone) * 100);
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[#eadfce] bg-[#fff8ef] shadow-[0_22px_70px_rgba(34,48,74,0.11)]">
      <div className="absolute left-6 top-5 h-20 w-20 rounded-full border border-[#f2d5b3] bg-[#fff1dc]" />
      <div className="absolute right-10 top-8 h-12 w-12 rounded-full border border-[#d7e6f1] bg-[#eef7ff]" />
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-white/55" />
      <div className="relative grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#c27a2c] shadow-sm">
              {roleLabel}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a] shadow-sm">
              <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: houseColor ?? "#245d85" }} />
              {houseName}
            </span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
            <div>
              <h2 className="text-3xl font-semibold text-[#182540] sm:text-4xl">Gen Mu&apos;min Hub</h2>
              <p className="mt-2 text-sm font-medium text-[#5f6b7a]">
                Assalamu alaikum, {studentName}. Build your {houseVirtue.toLowerCase()} path with missions, circles, projects, and badges.
              </p>

              <div className="mt-5 rounded-[26px] border border-[#ecdcc8] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Today&apos;s mission</p>
                    <h3 className="mt-2 text-xl font-semibold text-[#22304a]">{mission.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#5f6b7a]">
                      {mission.label} - {mission.detail}
                    </p>
                  </div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0db] text-[#d7892f]">
                    <Sparkles className="h-6 w-6" />
                  </span>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#eef1f5]">
                  <div className="h-full rounded-full bg-[#f39f5f]" style={{ width: `${mission.progress}%` }} />
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {actions.map((action) => (
                    <Link
                      key={`${action.href}-${action.label}`}
                      href={action.href}
                      className={
                        action.variant === "secondary"
                          ? "rounded-full border border-[#d8e3ed] bg-white px-5 py-2.5 text-sm font-semibold text-[#22304a] transition hover:bg-[#f7fbff]"
                          : "rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17243a]"
                      }
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-[#ecdcc8] bg-white/76 p-4 shadow-sm">
              <AvatarCharacter name={studentName} variant={avatarVariant} />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metricIcon(metric.label);
              return (
                <div key={metric.label} className="rounded-[22px] border border-[#eadfce] bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-[#6d7785]">{metric.label}</p>
                      <p className="mt-1 truncate text-xl font-semibold text-[#22304a]">{metric.value}</p>
                    </div>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff0db] text-[#d7892f]">
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-1 text-xs text-[#8a94a3]">{metric.hint}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 overflow-hidden rounded-[26px] border border-[#dfd8c9] bg-[#14233d] text-white shadow-sm">
            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
              <div>
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f7c56f]">My house points journey</p>
                    <p className="mt-2 text-4xl font-bold tabular-nums">{points.total}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white/75">{points.awards} awards</span>
                </div>
                <p className="mt-2 text-sm text-white/70">
                  {points.total > 0 ? (
                    <>Wonderful effort, {studentName}. Every completed challenge helps {houseName}.</>
                  ) : (
                    <>Your first house points are ready to be earned, {studentName}.</>
                  )}
                </p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[#f5a33b] transition-[width] duration-700" style={{ width: String(progress) + "%" }} />
                </div>
                <div className="mt-2 flex justify-between text-xs font-semibold text-white/60">
                  <span>{points.total} earned</span>
                  <span>{nextMilestone} next milestone</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Quiz answers", value: points.quiz, icon: Trophy },
                  { label: "Sunnah tracker", value: points.sunnah, icon: Star },
                  { label: "Other growth", value: points.other, icon: Sparkles },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-[20px] bg-white/10 p-3 text-center">
                    <Icon className="mx-auto h-5 w-5 text-[#f7c56f]" />
                    <p className="mt-2 text-xl font-bold tabular-nums">{value}</p>
                    <p className="mt-1 text-[11px] font-semibold leading-4 text-white/65">{label}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#f7c56f]"
                        style={{ width: String(points.total ? Math.min(100, (value / points.total) * 100) : 0) + "%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {points.recent.length ? (
              <div className="border-t border-white/10 bg-white/[0.04] px-4 py-3 sm:px-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Latest points</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {points.recent.slice(0, 3).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-2 rounded-2xl bg-white/8 px-3 py-2">
                      <p className="line-clamp-1 text-xs text-white/75">{entry.reason}</p>
                      <span className="shrink-0 text-sm font-bold text-[#f7c56f]">+{entry.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="relative border-t border-[#eadfce] bg-white/70 p-5 sm:p-7 xl:border-l xl:border-t-0">
          <div className="grid gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Recent badges</p>
              <div className="mt-3 grid gap-3">
                {badges.slice(0, 4).map((badge, index) => (
                  <div key={`${badge.label}-${badge.meta}`} className={`flex items-center gap-3 rounded-[20px] border px-3 py-3 ${badgeTone(badge.tone)}`}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                      {index % 3 === 0 ? <ShieldCheck className="h-5 w-5" /> : index % 3 === 1 ? <Star className="h-5 w-5" /> : <Trophy className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{badge.label}</p>
                      <p className="truncate text-xs opacity-75">{badge.meta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[22px] border border-[#d7e6f1] bg-[#eef7ff] p-4 text-[#245d85]">
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-5 w-5" />
                  <p className="text-sm font-semibold">Next circle</p>
                </div>
                <p className="mt-2 text-sm leading-6">{nextClassLabel}</p>
              </div>
              <div className="rounded-[22px] border border-[#d8eadf] bg-[#f0fbf4] p-4 text-[#2f6b4b]">
                <div className="flex items-center gap-3">
                  <UsersRound className="h-5 w-5" />
                  <p className="text-sm font-semibold">Safe room</p>
                </div>
                <p className="mt-2 text-sm leading-6">{circleLabel}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
