"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type EnrollmentOption = {
  id: string;
  title: string;
};

const LEADERSHIP_ROLES = [
  "Timekeeper",
  "Encouragement Captain",
  "Discussion Leader",
  "Team Coordinator",
  "Initiative Role",
];

const EVIDENCE_OPTIONS = [
  "Photo upload later",
  "Short video",
  "Live demonstration on Zoom",
  "Verbal explanation",
];

const TRAIT_OPTIONS = ["Sabr", "Amanah", "Shukr", "Teamwork", "Respect", "Responsibility"];
const SKILL_OPTIONS = [
  "First aid response",
  "Budget planning",
  "Healthy meal",
  "Navigation",
  "Weekly task completion",
  "Home responsibility",
];

export function StudentJournalSubmitForm({
  enrollments,
}: {
  enrollments: EnrollmentOption[];
}) {
  const router = useRouter();
  const [enrollmentId, setEnrollmentId] = useState(enrollments[0]?.id ?? "");
  const [weekLabel, setWeekLabel] = useState("");
  const [theme, setTheme] = useState("");
  const [traitFocus, setTraitFocus] = useState(TRAIT_OPTIONS[0]);
  const [traitPractice, setTraitPractice] = useState("");
  const [traitMoment, setTraitMoment] = useState("");
  const [traitChallenge, setTraitChallenge] = useState("");
  const [lifeSkillFocus, setLifeSkillFocus] = useState(SKILL_OPTIONS[0]);
  const [lifeSkillDemonstration, setLifeSkillDemonstration] = useState("");
  const [evidenceOption, setEvidenceOption] = useState(EVIDENCE_OPTIONS[3]);
  const [arabicPhrase, setArabicPhrase] = useState("");
  const [arabicUsage, setArabicUsage] = useState("");
  const [tajweedFocus, setTajweedFocus] = useState("");
  const [leadershipRole, setLeadershipRole] = useState(LEADERSHIP_ROLES[0]);
  const [leadershipExample, setLeadershipExample] = useState("");
  const [practiceMinutes, setPracticeMinutes] = useState("20");
  const [traitRating, setTraitRating] = useState("3");
  const [skillRating, setSkillRating] = useState("3");
  const [pronunciationRating, setPronunciationRating] = useState("3");
  const [fluencyRating, setFluencyRating] = useState("3");
  const [confidenceRating, setConfidenceRating] = useState("3");
  const [initiativeRating, setInitiativeRating] = useState("3");
  const [responsibilityRating, setResponsibilityRating] = useState("3");
  const [teamContributionRating, setTeamContributionRating] = useState("3");
  const [growthStrength, setGrowthStrength] = useState("");
  const [growthImprove, setGrowthImprove] = useState("");
  const [growthNextFocus, setGrowthNextFocus] = useState("");
  const [encouragement, setEncouragement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/student/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId,
          weekLabel,
          theme,
          traitFocus,
          traitPractice,
          traitMoment,
          traitChallenge,
          lifeSkillFocus,
          lifeSkillDemonstration,
          evidenceOption,
          arabicPhrase,
          arabicUsage,
          tajweedFocus,
          leadershipRole,
          leadershipExample,
          practiceMinutes: Number(practiceMinutes),
          traitRating: Number(traitRating),
          skillRating: Number(skillRating),
          pronunciationRating: Number(pronunciationRating),
          fluencyRating: Number(fluencyRating),
          confidenceRating: Number(confidenceRating),
          initiativeRating: Number(initiativeRating),
          responsibilityRating: Number(responsibilityRating),
          teamContributionRating: Number(teamContributionRating),
          growthStrength,
          growthImprove,
          growthNextFocus,
          encouragement,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save journal.");
      }

      setMessage("Journal saved. Your dashboard is refreshing...");
      router.push("/student/journal");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save journal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClassName =
    "mt-2 w-full rounded-2xl border border-[#e4d8c8] bg-white px-4 py-3 text-sm text-[#22304a] outline-none transition focus:border-[#f39f5f] focus:ring-2 focus:ring-[#f8d9b6]";

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-[#4d5a6b]">
          Programme
          <select value={enrollmentId} onChange={(event) => setEnrollmentId(event.target.value)} className={inputClassName}>
            {enrollments.map((enrollment) => (
              <option key={enrollment.id} value={enrollment.id}>
                {enrollment.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-[#4d5a6b]">
          Week label
          <input value={weekLabel} onChange={(event) => setWeekLabel(event.target.value)} placeholder="Week 4" className={inputClassName} required />
        </label>
      </div>

      <label className="block text-sm font-medium text-[#4d5a6b]">
        Theme
        <input value={theme} onChange={(event) => setTheme(event.target.value)} placeholder="Sabr and responsibility" className={inputClassName} required />
      </label>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="text-sm font-medium text-[#4d5a6b]">
          Islamic trait improved
          <select value={traitFocus} onChange={(event) => setTraitFocus(event.target.value)} className={inputClassName}>
            {TRAIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-[#4d5a6b]">
          Life skill learned
          <select value={lifeSkillFocus} onChange={(event) => setLifeSkillFocus(event.target.value)} className={inputClassName}>
            {SKILL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-[#4d5a6b]">
          Evidence option
          <select value={evidenceOption} onChange={(event) => setEvidenceOption(event.target.value)} className={inputClassName}>
            {EVIDENCE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="text-sm font-medium text-[#4d5a6b]">
          What did you practice?
          <textarea value={traitPractice} onChange={(event) => setTraitPractice(event.target.value)} className={`${inputClassName} min-h-28`} required />
        </label>
        <label className="text-sm font-medium text-[#4d5a6b]">
          When did you show this trait?
          <textarea value={traitMoment} onChange={(event) => setTraitMoment(event.target.value)} className={`${inputClassName} min-h-28`} required />
        </label>
        <label className="text-sm font-medium text-[#4d5a6b]">
          What was difficult?
          <textarea value={traitChallenge} onChange={(event) => setTraitChallenge(event.target.value)} className={`${inputClassName} min-h-28`} required />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-medium text-[#4d5a6b]">
          How did you demonstrate the life skill?
          <textarea value={lifeSkillDemonstration} onChange={(event) => setLifeSkillDemonstration(event.target.value)} className={`${inputClassName} min-h-28`} required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-[#4d5a6b]">
            Arabic phrase mastered
            <input value={arabicPhrase} onChange={(event) => setArabicPhrase(event.target.value)} className={inputClassName} required />
          </label>
          <label className="text-sm font-medium text-[#4d5a6b]">
            Tajweed focus
            <input value={tajweedFocus} onChange={(event) => setTajweedFocus(event.target.value)} className={inputClassName} required />
          </label>
          <label className="text-sm font-medium text-[#4d5a6b] sm:col-span-2">
            Arabic usage check
            <textarea value={arabicUsage} onChange={(event) => setArabicUsage(event.target.value)} className={`${inputClassName} min-h-28`} required />
          </label>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-medium text-[#4d5a6b]">
          Leadership role this week
          <select value={leadershipRole} onChange={(event) => setLeadershipRole(event.target.value)} className={inputClassName}>
            {LEADERSHIP_ROLES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-[#4d5a6b]">
          Leadership action shown
          <textarea value={leadershipExample} onChange={(event) => setLeadershipExample(event.target.value)} className={`${inputClassName} min-h-28`} required />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        {[
          { label: "Trait", value: traitRating, setter: setTraitRating },
          { label: "Skill", value: skillRating, setter: setSkillRating },
          { label: "Pronunciation", value: pronunciationRating, setter: setPronunciationRating },
          { label: "Fluency", value: fluencyRating, setter: setFluencyRating },
          { label: "Confidence", value: confidenceRating, setter: setConfidenceRating },
          { label: "Initiative", value: initiativeRating, setter: setInitiativeRating },
          { label: "Responsibility", value: responsibilityRating, setter: setResponsibilityRating },
          { label: "Team contribution", value: teamContributionRating, setter: setTeamContributionRating },
        ].map(({ label, value, setter }) => (
          <label key={label} className="text-sm font-medium text-[#4d5a6b]">
            {label} rating
            <select value={value} onChange={(event) => setter(event.target.value)} className={inputClassName}>
              {[1, 2, 3, 4, 5].map((option) => (
                <option key={option} value={String(option)}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-medium text-[#4d5a6b]">
          Strength this week
          <textarea value={growthStrength} onChange={(event) => setGrowthStrength(event.target.value)} className={`${inputClassName} min-h-24`} required />
        </label>
        <label className="text-sm font-medium text-[#4d5a6b]">
          Area to improve
          <textarea value={growthImprove} onChange={(event) => setGrowthImprove(event.target.value)} className={`${inputClassName} min-h-24`} required />
        </label>
        <label className="text-sm font-medium text-[#4d5a6b]">
          Next week focus
          <textarea value={growthNextFocus} onChange={(event) => setGrowthNextFocus(event.target.value)} className={`${inputClassName} min-h-24`} required />
        </label>
        <label className="text-sm font-medium text-[#4d5a6b]">
          Encouragement note
          <textarea value={encouragement} onChange={(event) => setEncouragement(event.target.value)} className={`${inputClassName} min-h-24`} required />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <label className="text-sm font-medium text-[#4d5a6b]">
          Practice minutes
          <input type="number" min="0" value={practiceMinutes} onChange={(event) => setPracticeMinutes(event.target.value)} className={inputClassName} required />
        </label>
        <div className="rounded-[24px] bg-[#fbf6ef] px-5 py-4 text-sm leading-7 text-[#5f6b7a]">
          Families will see this as a weekly growth journal with badges, Arabic fluency trend, leadership score, and teacher encouragement.
        </div>
      </div>

      {error ? <p className="rounded-2xl bg-[#fff0f0] px-4 py-3 text-sm text-[#b43b3b]">{error}</p> : null}
      {message ? <p className="rounded-2xl bg-[#edf8ef] px-4 py-3 text-sm text-[#2f6b4b]">{message}</p> : null}

      <button type="submit" disabled={isSubmitting} className="cursor-pointer rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {isSubmitting ? "Saving journal..." : "Save weekly journal"}
      </button>
    </form>
  );
}
