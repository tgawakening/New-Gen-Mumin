import Link from "next/link";
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
  metrics: QuestMetric[];
  badges: QuestBadge[];
  actions: QuestAction[];
  nextClassLabel: string;
  circleLabel: string;
  avatarVariant?: "boy" | "girl" | "neutral";
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "GM";
}

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
  const isGirl = variant === "girl";
  const isBoy = variant === "boy";
  const scarf = isGirl ? "bg-[#d8c7aa]" : isBoy ? "bg-[#3d5d4b]" : "bg-[#5d7da3]";
  const robe = isGirl ? "bg-[#17243a]" : isBoy ? "bg-[#263f34]" : "bg-[#245d85]";

  return (
    <div className="relative mx-auto h-[190px] w-[170px] sm:h-[220px] sm:w-[190px]" aria-hidden="true">
      <div className="absolute bottom-0 left-1/2 h-28 w-28 -translate-x-1/2 rounded-[38px_38px_28px_28px] bg-[#22304a]/10 blur-xl" />
      <div
        className={`absolute bottom-3 left-1/2 -translate-x-1/2 ${robe} shadow-[0_18px_30px_rgba(34,48,74,0.24)] ${
          isGirl ? "h-32 w-28 rounded-[46px_46px_18px_18px]" : "h-28 w-24 rounded-[34px_34px_24px_24px]"
        }`}
      />
      <div
        className={`absolute left-1/2 -translate-x-1/2 ${scarf} shadow-sm ${
          isGirl
            ? "bottom-[80px] h-28 w-28 rounded-[54px_54px_26px_26px]"
            : "bottom-[86px] h-16 w-24 rounded-[40px_40px_22px_22px]"
        }`}
      />
      {isGirl ? (
        <div className="absolute bottom-[75px] left-1/2 h-12 w-24 -translate-x-1/2 rounded-b-[42px] bg-[#d8c7aa]" />
      ) : (
        <div className="absolute bottom-[151px] left-1/2 h-9 w-24 -translate-x-1/2 rounded-[30px_30px_12px_12px] bg-[#2c2527]" />
      )}
      {isBoy ? (
        <div className="absolute bottom-[150px] left-[52px] h-8 w-20 -rotate-12 rounded-full border-y-4 border-[#e9eef4] bg-[#26334d]" />
      ) : null}
      <div className={`absolute left-1/2 h-20 w-20 -translate-x-1/2 rounded-full bg-[#f2c79e] shadow-[inset_0_-8px_0_rgba(165,94,58,0.12)] ${isGirl ? "bottom-[92px]" : "bottom-[88px]"}`} />
      <div className="absolute bottom-[119px] left-[59px] h-3 w-3 rounded-full bg-[#26334d]" />
      <div className="absolute bottom-[119px] right-[59px] h-3 w-3 rounded-full bg-[#26334d]" />
      <div className="absolute bottom-[103px] left-1/2 h-2 w-8 -translate-x-1/2 rounded-full border-b-2 border-[#9b5b43]" />
      <div className={`absolute h-12 w-6 rounded-full bg-[#f2c79e] ${isGirl ? "bottom-[49px] left-8 rotate-[-10deg]" : "bottom-[42px] left-7 rotate-[-18deg]"}`} />
      <div className={`absolute h-12 w-6 rounded-full bg-[#f2c79e] ${isGirl ? "bottom-[49px] right-8 rotate-[10deg]" : "bottom-[42px] right-7 rotate-[18deg]"}`} />
      <div className={`absolute left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-2xl border border-white/70 bg-white text-lg font-bold text-[#22304a] shadow-lg ${isGirl ? "bottom-7" : "bottom-9"}`}>
        {initials(name)}
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
  metrics,
  badges,
  actions,
  nextClassLabel,
  circleLabel,
  avatarVariant,
}: StudentQuestHubProps) {
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
            <span className="rounded-full bg-[#eef7ff] px-3 py-1 text-xs font-semibold text-[#245d85]">
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
