import Image from "next/image";
import Link from "next/link";
import {
  Award,
  BookOpen,
  Check,
  Crown,
  Download,
  HandHeart,
  LockKeyhole,
  Medal,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Users,
} from "lucide-react";

import type { getRecognitionDashboard } from "@/lib/community/recognition";
import { qabilaProfile } from "@/lib/community/qabilas";

type Data = Awaited<ReturnType<typeof getRecognitionDashboard>>;

const badgeLooks = [
  "from-[#ffcf66] to-[#db7a15] text-white",
  "from-[#7bd2aa] to-[#287b55] text-white",
  "from-[#8ab8ff] to-[#365fc1] text-white",
  "from-[#c69cff] to-[#6f46ba] text-white",
];

function studentName(data: Data) {
  return data.student?.displayName
    || [data.student?.user.firstName, data.student?.user.lastName].filter(Boolean).join(" ")
    || "Student";
}

function Character({ data, className = "" }: { data: Data; className?: string }) {
  const gender = data.resolvedGender?.toLowerCase() ?? "";
  const isGirl = gender.includes("girl") || gender.includes("female");
  return (
    <Image
      src={isGirl ? "/gen-mumin-chars/rania-superhero.png" : "/gen-mumin-chars/ali-superhero.png"}
      alt={isGirl ? "Gen-Mumin girl character" : "Gen-Mumin boy character"}
      width={620}
      height={820}
      priority
      className={`object-cover object-[50%_12%] ${className}`}
    />
  );
}

function BadgeMedallion({ index, earned }: { index: number; earned: boolean }) {
  const Icon = [Star, HandHeart, Shield, Crown][index % 4];
  return (
    <span className={`relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px] border-4 border-white bg-gradient-to-br shadow-[0_10px_25px_rgba(34,48,74,0.2)] ${earned ? badgeLooks[index % badgeLooks.length] : "from-[#e8edf3] to-[#b9c4d1] text-white"}`}>
      <Icon className="h-10 w-10" strokeWidth={2.2} />
      {earned ? <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#2f8b59] text-white ring-4 ring-white"><Check className="h-4 w-4" /></span> : <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#52647a] text-white ring-4 ring-white"><LockKeyhole className="h-3.5 w-3.5" /></span>}
    </span>
  );
}

export function InteractiveRewardsDashboard({ data, parentView = false }: { data: Data; parentView?: boolean }) {
  const name = studentName(data);
  const featured = data.awards.find((award) => award.featuredWeek) ?? data.awards[0] ?? null;
  const earnedByKey = new Map(data.awards.map((award) => [award.badgeKey, award]));
  const nextPoints = data.nextUnlock ? Math.max(0, data.nextUnlock.milestone - data.collective) : 0;
  const unlockTarget = data.nextUnlock?.milestone ?? Math.max(100, data.collective);
  const unlockProgress = data.nextUnlock ? Math.min(100, (data.collective / data.nextUnlock.milestone) * 100) : 100;
  const houseLabel = data.membership.qabilaGroup || data.membership.house.name;
  const qabila = qabilaProfile(data.membership.qabilaGroup);
  const roleLabel = data.membership.role === "MEMBER" ? "" : ` ? ${data.membership.role.replaceAll("_", " ")}`;
  const spotlightTitle = featured ? featured.title : "Your next character badge";
  const spotlightEvidence = featured?.evidence ?? "Keep showing kindness, consistency, courage, and service. Your teacher can recognise your growth here.";

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[32px] border border-[#eadfce] bg-[radial-gradient(circle_at_85%_20%,#fff1cf_0,transparent_30%),linear-gradient(135deg,#fff_0%,#fffaf3_62%,#fff0d9_100%)] p-5 shadow-[0_22px_60px_rgba(34,48,74,0.12)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(#efaa4b_1px,transparent_1px)] [background-size:26px_26px]" />
        <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_270px]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.24em] text-[#c66d1f]">Student home</span>
              {qabila ? <Image src={qabila.image} alt={`${qabila.name} profile`} width={46} height={46} className="h-11 w-11 rounded-full object-cover shadow-md" /> : null}
              <span className="rounded-full border bg-white/90 px-3 py-1 text-xs font-bold text-[#22304a]" style={{ borderColor: qabila ? `${qabila.color}66` : "#e4d8c7" }}>{houseLabel}{roleLabel}</span>
            </div>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#12213b] sm:text-4xl">My House & Rewards</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#5d6b7d]">Every good action strengthens your character and your House, {name}.</p>

            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { icon: Star, value: data.total, label: "My points", tone: "text-[#db7a15] bg-[#fff0d9]" },
                { icon: Trophy, value: data.level.title, label: "My rank", tone: "text-[#287b55] bg-[#e8f7ed]" },
                { icon: Medal, value: data.awards.length, label: "Badges earned", tone: "text-[#704bc0] bg-[#f1eafe]" },
                { icon: Users, value: data.collective, label: "House points", tone: "text-[#226da0] bg-[#e8f5ff]" },
              ].map(({ icon: Icon, value, label, tone }) => (
                <div key={label} className="group rounded-[22px] border border-[#e9dfd0] bg-white/95 p-4 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone}`}><Icon className="h-6 w-6" /></span>
                  <p className="mt-3 break-words text-xl font-black text-[#152440]">{value}</p>
                  <p className="mt-1 text-xs font-semibold text-[#697789]">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 overflow-hidden rounded-[28px] bg-[#102544] p-5 text-white shadow-[0_18px_35px_rgba(16,37,68,0.25)]">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffc96c]">My House points journey</p>
                  <p className="mt-2 text-4xl font-black tabular-nums">{data.collective}<span className="text-lg font-semibold text-white/55"> / {unlockTarget}</span></p>
                  <p className="mt-1 text-sm text-white/70">{data.nextUnlock ? `${nextPoints} points to unlock ${data.nextUnlock.title}` : "Every published House reward is unlocked!"}</p>
                </div>
                <div className="flex h-20 w-24 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#ffd16c] to-[#df7f18] text-[#102544] shadow-[0_0_28px_rgba(255,190,73,0.38)]">
                  {data.nextUnlock ? <LockKeyhole className="h-10 w-10" /> : <Trophy className="h-10 w-10" />}
                </div>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-[#ffb33f] to-[#ffe08a] transition-[width] duration-700" style={{ width: `${unlockProgress}%` }} /></div>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Object.entries(data.pointBreakdown).filter(([, points]) => points > 0).slice(0, 4).map(([category, points]) => (
                  <div key={category} className="rounded-2xl bg-white/10 px-3 py-3 text-center">
                    <p className="text-xl font-black">{points}</p>
                    <p className="mt-1 text-[11px] font-semibold capitalize text-white/65">{category}</p>
                  </div>
                ))}
                {!Object.values(data.pointBreakdown).some((points) => points > 0) ? <p className="col-span-full rounded-2xl bg-white/10 p-4 text-center text-sm text-white/70">Complete learning activities to begin your points journey.</p> : null}
              </div>
            </div>
          </div>

          <aside className="relative min-h-72 overflow-hidden rounded-[30px] border border-[#f0d6a9] bg-white/75 xl:min-h-0">
            <div className="absolute left-1/2 top-4 z-20 w-[84%] -translate-x-1/2 rounded-[22px] border border-[#f0bf66] bg-white px-4 py-3 text-center text-sm font-black leading-5 text-[#14233e] shadow-lg">
              {data.nextUnlock ? <>Amazing! Only <span className="text-[#d67519]">{nextPoints} points</span> to our next House unlock!</> : <>Amazing! Your House unlocked every reward!</>}
            </div>
            <Character data={data} className="absolute inset-x-0 bottom-0 h-[86%] w-full transition-transform duration-500 hover:scale-[1.035]" />
          </aside>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1.08fr]">
        <div className="relative overflow-hidden rounded-[30px] border border-[#eadfce] bg-white p-6 shadow-sm">
          <div className="relative z-10 max-w-[62%]">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d2691e]">Recognition spotlight</p>
            <h3 className="mt-4 text-2xl font-black text-[#132342]">{featured ? "Mumin of the Week" : "Keep growing, Mumin!"}</h3>
            <p className="mt-2 text-3xl font-black text-[#132342]">{name}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#e9f7ee] px-3 py-2 text-xs font-bold text-[#27734b]"><HandHeart className="h-4 w-4" />{featured?.category ?? "Character growth"}</div>
            <div className="mt-5 rounded-[20px] bg-[#fff7ed] p-4 text-sm font-medium leading-6 text-[#536174]">{spotlightEvidence}</div>
            <p className="mt-4 text-xs font-semibold text-[#7c8795]">{featured ? "Teacher nominated ? not selected by points alone." : "Your earned recognition will appear here."}</p>
          </div>
          <Character data={data} className="absolute -bottom-14 right-0 h-[105%] w-[45%]" />
        </div>

        <div className="rounded-[30px] border border-[#dca142] bg-[#11294a] p-3 shadow-[0_18px_45px_rgba(17,41,74,0.2)]">
          <div className="relative flex min-h-[330px] flex-col items-center justify-center overflow-hidden rounded-[22px] border-2 border-[#e5b85f] bg-[#fffaf1] p-6 text-center">
            <div className="absolute inset-3 rounded-[16px] border border-[#e5b85f]/60" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#ffcf66] to-[#d87515] text-white shadow-lg"><Award className="h-9 w-9" /></span>
            <p className="relative mt-4 font-serif text-sm font-bold uppercase tracking-[0.18em] text-[#7c5a28]">Certificate of Character</p>
            <p className="relative mt-4 text-sm text-[#6d7785]">Presented to</p>
            <h3 className="relative mt-1 text-3xl font-black text-[#14233e]">{name}</h3>
            <p className="relative mt-2 font-serif text-xl font-bold uppercase tracking-[0.12em] text-[#bd6e1d]">{spotlightTitle}</p>
            <p className="relative mt-3 max-w-md text-sm leading-6 text-[#596779]">{spotlightEvidence}</p>
            {featured ? <Link href={`/certificates/${featured.certificateCode}`} className="relative mt-5 inline-flex items-center gap-2 rounded-full bg-[#11294a] px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5"><Download className="h-4 w-4" />View certificate</Link> : <span className="relative mt-5 rounded-full border border-[#d7c5aa] px-5 py-3 text-sm font-bold text-[#7c6a50]">Earn a badge to unlock</span>}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[30px] border border-[#eadfce] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d2691e]">Collectible character badges</p><h3 className="mt-2 text-2xl font-black text-[#14233e]">What {name} is becoming</h3></div><span className="rounded-full bg-[#fff2de] px-3 py-2 text-xs font-bold text-[#b9651e]">{data.awards.length} earned</span></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {data.badgeDefinitions.map((badge, index) => {
              const award = earnedByKey.get(badge.key);
              return (
                <article key={badge.key} className={`group flex gap-4 rounded-[24px] border p-4 transition duration-300 hover:-translate-y-1 hover:shadow-lg ${award ? "border-[#efd09b] bg-[#fff9ed]" : "border-[#e1e6ed] bg-[#f7f9fb]"}`}>
                  <BadgeMedallion index={index} earned={Boolean(award)} />
                  <div className="min-w-0">
                    <h4 className="font-black text-[#182743]">{badge.title}</h4>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#c16d24]">{award ? "Earned" : "Locked"}</p>
                    <p className="mt-2 text-sm leading-5 text-[#647184]">{award?.evidence ?? badge.description}</p>
                    {award ? <Link href={`/certificates/${award.certificateCode}`} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#1d5f92]">View award <Sparkles className="h-3.5 w-3.5" /></Link> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-[30px] border border-[#eadfce] bg-white p-5 shadow-sm sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#d2691e]">Recognition ladder</p>
            <div className="mt-5 space-y-3">
              {data.recognitionLevels.map((level, index) => {
                const reached = data.total >= level.min;
                return <div key={level.key} className={`flex items-center gap-3 rounded-[20px] border p-3 ${reached ? "border-[#b9dfc7] bg-[#ecf9f0]" : "border-[#e3e8ee] bg-[#f6f8fa]"}`}><span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${reached ? badgeLooks[index % badgeLooks.length] + " bg-gradient-to-br" : "bg-[#dfe5eb] text-[#748295]"}`}>{reached ? <Check className="h-5 w-5" /> : <LockKeyhole className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="font-black text-[#182743]">{level.title}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dce3e9]"><div className="h-full rounded-full bg-[#55a976]" style={{ width: reached ? "100%" : `${Math.min(100, (data.total / Math.max(1, level.min)) * 100)}%` }} /></div></div><span className="text-xs font-bold text-[#657286]">{level.min}+ pts</span></div>;
              })}
            </div>
          </section>

          <section className="rounded-[30px] bg-[#102544] p-5 text-white shadow-lg sm:p-6">
            <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ffc96c]">House activity feed</p><h3 className="mt-2 text-xl font-black">Our House is growing</h3></div><Users className="h-9 w-9 text-[#ffc96c]" /></div>
            <div className="mt-5 space-y-3">
              {data.activity.slice(0, 6).map((event) => <div key={event.id} className="flex items-start gap-3 rounded-[18px] bg-white/10 p-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ffc96c] font-black text-[#102544]">{event.studentName.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><p className="font-bold">{event.studentName}</p><p className="mt-1 text-xs leading-5 text-white/65">{event.reason}</p>{event.occurrenceCount > 1 ? <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#ffc96c]">{event.occurrenceCount} verified entries grouped</p> : null}</div><span className="shrink-0 font-black text-[#ffc96c]">+{event.points}</span></div>)}
              {!data.activity.length ? <div className="rounded-[20px] bg-white/10 p-5 text-center"><BookOpen className="mx-auto h-8 w-8 text-[#ffc96c]" /><p className="mt-3 text-sm text-white/70">House contributions will celebrate here as soon as activities are verified.</p></div> : null}
            </div>
          </section>
        </div>
      </section>

      <section className="flex flex-col items-center justify-center gap-3 rounded-[26px] border border-[#efd4a8] bg-gradient-to-r from-[#fff9ef] via-white to-[#fff5e6] px-5 py-5 text-center sm:flex-row">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#102544] text-[#ffc96c]"><Shield className="h-6 w-6" /></span>
        <p className="text-base font-black text-[#172742]">Our Houses compete. Our people <span className="text-[#db731b]">cooperate.</span>{parentView ? " From my child to our children." : ""}</p>
      </section>
    </div>
  );
}

