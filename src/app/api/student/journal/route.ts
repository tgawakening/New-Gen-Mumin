import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

const journalPayloadSchema = z.object({
  enrollmentId: z.string().min(1),
  weekLabel: z.string().min(1).max(80),
  theme: z.string().min(1).max(120),
  traitFocus: z.string().min(1).max(80),
  traitPractice: z.string().min(1).max(1200),
  traitMoment: z.string().min(1).max(1200),
  traitChallenge: z.string().min(1).max(1200),
  lifeSkillFocus: z.string().min(1).max(120),
  lifeSkillDemonstration: z.string().min(1).max(1200),
  evidenceOption: z.string().min(1).max(120),
  arabicPhrase: z.string().min(1).max(120),
  arabicUsage: z.string().min(1).max(1200),
  tajweedFocus: z.string().min(1).max(120),
  leadershipRole: z.string().min(1).max(120),
  leadershipExample: z.string().min(1).max(1200),
  practiceMinutes: z.number().int().min(0).max(600),
  traitRating: z.number().int().min(1).max(5),
  skillRating: z.number().int().min(1).max(5),
  pronunciationRating: z.number().int().min(1).max(5),
  fluencyRating: z.number().int().min(1).max(5),
  confidenceRating: z.number().int().min(1).max(5),
  initiativeRating: z.number().int().min(1).max(5),
  responsibilityRating: z.number().int().min(1).max(5),
  teamContributionRating: z.number().int().min(1).max(5),
  growthStrength: z.string().min(1).max(800),
  growthImprove: z.string().min(1).max(800),
  growthNextFocus: z.string().min(1).max(800),
  encouragement: z.string().min(1).max(800),
});

const JOURNAL_PREFIX = "__GENM_JOURNAL__:";

function toGradeLevel(score: number) {
  if (score >= 5) return "EXCELLENT" as const;
  if (score >= 4) return "GOOD" as const;
  if (score >= 3) return "SATISFACTORY" as const;
  return "NEEDS_IMPROVEMENT" as const;
}

export async function POST(request: Request) {
  try {
    const user = await requireRole("STUDENT");
    const payload = journalPayloadSchema.parse(await request.json());

    const student = await db.studentProfile.findUnique({
      where: { userId: user.id },
      include: {
        enrollments: true,
      },
    });

    if (!student) {
      throw new Error("Student profile not found.");
    }

    const enrollment = student.enrollments.find((entry) => entry.id === payload.enrollmentId);

    if (!enrollment) {
      throw new Error("Selected program could not be matched to this student.");
    }

    const averageRating = Math.round(
      [
        payload.traitRating,
        payload.skillRating,
        payload.pronunciationRating,
        payload.fluencyRating,
        payload.confidenceRating,
        payload.initiativeRating,
        payload.responsibilityRating,
        payload.teamContributionRating,
      ].reduce((sum, value) => sum + value, 0) / 8,
    );

    const reflectionPayload = {
      weekLabel: payload.weekLabel,
      theme: payload.theme,
      traitFocus: payload.traitFocus,
      traitPractice: payload.traitPractice,
      traitMoment: payload.traitMoment,
      traitChallenge: payload.traitChallenge,
      lifeSkillFocus: payload.lifeSkillFocus,
      lifeSkillDemonstration: payload.lifeSkillDemonstration,
      evidenceOption: payload.evidenceOption,
      arabicPhrase: payload.arabicPhrase,
      arabicUsage: payload.arabicUsage,
      tajweedFocus: payload.tajweedFocus,
      leadershipRole: payload.leadershipRole,
      leadershipExample: payload.leadershipExample,
      growthStrength: payload.growthStrength,
      growthImprove: payload.growthImprove,
      growthNextFocus: payload.growthNextFocus,
      encouragement: payload.encouragement,
      traitRating: payload.traitRating,
      skillRating: payload.skillRating,
      pronunciationRating: payload.pronunciationRating,
      fluencyRating: payload.fluencyRating,
      confidenceRating: payload.confidenceRating,
      initiativeRating: payload.initiativeRating,
      responsibilityRating: payload.responsibilityRating,
      teamContributionRating: payload.teamContributionRating,
    };

    const journal = await db.journalEntry.create({
      data: {
        enrollmentId: enrollment.id,
        studentId: student.id,
        title: `${payload.weekLabel} - ${payload.theme}`,
        reflection: `${JOURNAL_PREFIX}${JSON.stringify(reflectionPayload)}`,
        practiceMinutes: payload.practiceMinutes,
        selfRating: toGradeLevel(averageRating),
      },
    });

    return NextResponse.json({
      journalId: journal.id,
      status: journal.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save weekly journal.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
