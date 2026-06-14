import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FeedbackAudience } from "@prisma/client";
import type { ReactNode } from "react";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { getStudentFeedbackSummary, submitWeeklyFeedback } from "@/lib/community/feedback";
import { sendAdminFeedbackSubmittedEmail } from "@/lib/email/notifications";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { MultiStepFeedbackForm } from "@/components/dashboard/feedback/MultiStepFeedbackForm";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string; submitted?: string; error?: string }>;
};

function noticeHref(childId: string | undefined, message: string, tone: "success" | "error" = "success") {
  const params = new URLSearchParams();
  if (childId) params.set("child", childId);
  if (tone === "success") {
    params.set("submitted", "1");
  } else {
    params.set("error", message);
  }
  const query = params.toString();
  return `/parent/feedback${query ? `?${query}` : ""}`;
}

export default async function ParentFeedbackPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");

  const params = searchParams ? await searchParams : {};
  const selectedChild = dashboard.children.find((child) => child.id === params.child) ?? dashboard.children[0];
  const feedback = selectedChild ? await getStudentFeedbackSummary(selectedChild.id) : [];

  async function submitParentFeedback(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "PARENT") redirect("/auth/login");
    const currentDashboard = await getParentDashboardData(currentSession.user.id);
    if (!currentDashboard) redirect("/registration");

    const childId = String(formData.get("childId") || "");
    try {
      const child = currentDashboard.children.find((entry) => entry.id === childId);
      if (!child) throw new Error("Child is not available for this parent.");

      const selectedProgrammes = formData.getAll("programmes").map(String);

      await submitWeeklyFeedback({
        audience: FeedbackAudience.PARENT,
        submittedById: currentSession.user.id,
        studentId: child.id,
        weekLabel: String(formData.get("weekLabel") || `Week of ${new Date().toLocaleDateString("en-GB")}`),
        moodRating: Number(formData.get("satisfaction") || 0) || null,
        confidence: Number(formData.get("confidence") || 0) || null,
        workload: null,
        wins: String(formData.get("goingWell") || ""),
        concerns: String(formData.get("concern") || ""),
        supportNeeded: String(formData.get("improvement") || ""),
        rawPayload: {
          parentName: String(formData.get("parentName") || ""),
          childName: String(formData.get("childName") || ""),
          childAgeGroup: String(formData.get("childAgeGroup") || ""),
          programmes: selectedProgrammes,
          enjoying: String(formData.get("enjoying") || ""),
          understanding: String(formData.get("understanding") || ""),
          homePractice: String(formData.get("homePractice") || ""),
          confidence: String(formData.get("confidence") || ""),
          goingWell: String(formData.get("goingWell") || ""),
          improvement: String(formData.get("improvement") || ""),
          concern: String(formData.get("concern") || ""),
          contactRequest: String(formData.get("contactRequest") || ""),
          satisfaction: String(formData.get("satisfaction") || ""),
        },
      });

      const teachers = await db.teacherProgram.findMany({
        where: { program: { title: { in: selectedProgrammes } } },
        select: { teacher: { select: { userId: true } } },
      });
      await db.notification.createMany({
        data: [
          {
            userId: currentSession.user.id,
            title: "Weekly feedback submitted",
            body: `Your feedback for ${child.name} has been saved.`,
            href: `/parent/feedback?child=${child.id}`,
          },
          ...teachers.map((teacher) => ({
            userId: teacher.teacher.userId,
            title: "Parent feedback received",
            body: `${child.name}'s parent submitted weekly feedback.`,
            href: "/teacher/feedback",
          })),
        ],
        skipDuplicates: true,
      });

      try {
        await sendAdminFeedbackSubmittedEmail({
          audience: "PARENT",
          submittedByName: currentDashboard.parentName,
          submittedByEmail: currentDashboard.parentProfile.email,
          studentName: child.name,
          programmes: selectedProgrammes,
          weekLabel: String(formData.get("weekLabel") || `Week of ${new Date().toLocaleDateString("en-GB")}`),
          summary: String(formData.get("goingWell") || formData.get("improvement") || formData.get("concern") || ""),
        });
      } catch (emailError) {
        console.error("Admin parent feedback email failed", emailError);
      }

      revalidatePath("/parent/feedback");
      redirect(noticeHref(child.id, "Parent feedback submitted."));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to submit parent feedback.";
      redirect(noticeHref(childId || undefined, errorMessage, "error"));
    }
  }

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Weekly Feedback"
      subtitle="Submit family observations and review student feedback trends in one place."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <ActionToast message={params.error ? params.error : params.submitted ? "Parent feedback submitted." : undefined} tone={params.error ? "error" : undefined} />

      <MetricGrid
        metrics={[
          { label: "Children", value: String(dashboard.children.length), hint: "Linked learners." },
          { label: "Responses", value: String(feedback.length), hint: "Recent feedback entries." },
          { label: "Confidence", value: feedback[0]?.confidence ? `${feedback[0].confidence}/5` : "Pending", hint: "Latest confidence check." },
          { label: "Workload", value: feedback[0]?.workload ? `${feedback[0].workload}/5` : "Pending", hint: "Latest workload feeling." },
        ]}
      />

      <SectionCard eyebrow="Child selector" title="Choose learner" icon="star">
        <ChildSelector
          learners={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/feedback"
        />
      </SectionCard>

      {selectedChild ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <SectionCard eyebrow="Parent pulse" title={`Submit for ${selectedChild.name}`} icon="journal">
            <MultiStepFeedbackForm
              action={submitParentFeedback}
              hiddenFields={[
                { name: "childId", value: selectedChild.id },
                { name: "weekLabel", value: `Week of ${new Date().toLocaleDateString("en-GB")}` },
              ]}
              submitLabel="Submit parent feedback"
              steps={[
                {
                  title: "Gen Mu'min Parent Pulse Feedback",
                  description: "A short check-in about your child, class, and programme.",
                  content: (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Parent Name">
                        <input name="parentName" required defaultValue={dashboard.parentName} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                      </Field>
                      <Field label="Child Name">
                        <input name="childName" required defaultValue={selectedChild.name} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                      </Field>
                      <Field label="Child Age Group">
                        <select name="childAgeGroup" required defaultValue={selectedChild.profile.age && selectedChild.profile.age <= 8 ? "6-8" : selectedChild.profile.age && selectedChild.profile.age <= 12 ? "9-12" : selectedChild.profile.age ? "13-17" : "Mixed / Not sure"} className="max-w-xs rounded-2xl border border-[#d8e3ed] px-4 py-2.5 text-sm">
                          {["6-8", "9-12", "13-17", "Mixed / Not sure"].map((option) => <option key={option}>{option}</option>)}
                        </select>
                      </Field>
                      <Field label="Program / Class">
                        <div className="grid gap-2 rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 text-sm">
                          {selectedChild.courses.map((course) => (
                            <label key={course.id} className="flex items-center gap-2">
                              <input name="programmes" type="checkbox" value={course.title} defaultChecked />
                              {course.title}
                            </label>
                          ))}
                          {selectedChild.courses.length > 1 ? (
                            <label className="flex items-center gap-2">
                              <input name="programmes" type="checkbox" value="Full Gen Mu'min Program" />
                              Full Gen Mu&apos;min Program
                            </label>
                          ) : null}
                        </div>
                      </Field>
                    </div>
                  ),
                },
                {
                  title: "Child Learning Experience",
                  description: "A quick check-in about how your child is experiencing the classes.",
                  content: (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Choice name="enjoying" label="Is your child enjoying the classes?" options={["Yes", "Somewhat", "No", "Not sure yet"]} />
                      <Choice name="understanding" label="Is your child understanding the lessons?" options={["Yes", "Somewhat", "No", "Not sure yet"]} />
                      <Choice name="homePractice" label="Is your child practicing or discussing anything at home?" options={["Often", "Sometimes", "Rarely", "Not yet"]} />
                      <RatingField name="confidence" label="How confident does your child feel?" low="Not confident" high="Very confident" defaultValue="3" />
                    </div>
                  ),
                },
                {
                  title: "Feedback & Support",
                  description: "Share anything that can help us support your child better.",
                  content: (
                    <>
                      <Field label="What is going well?">
                        <textarea name="goingWell" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                      </Field>
                      <Field label="What can be improved?">
                        <textarea name="improvement" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                      </Field>
                      <Field label="Any concern you want us to know?">
                        <textarea name="concern" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                      </Field>
                      <div className="grid gap-4 md:grid-cols-2">
                        <Choice name="contactRequest" label="Would you like management to contact you?" options={["No", "Yes", "Only if needed"]} />
                        <RatingField name="satisfaction" label="Overall satisfaction" low="Needs improvement" high="Very satisfied" defaultValue="4" />
                      </div>
                    </>
                  ),
                },
              ]}
            />
          </SectionCard>

          <SectionCard eyebrow="Shared history" title="Recent feedback" icon="chart">
            <div className="space-y-3">
              {feedback.map((entry) => (
                <div key={entry.id} className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm text-[#4d5a6b]">
                  <p className="font-semibold text-[#22304a]">{entry.weekLabel}</p>
                  <p className="mt-1">{entry.submittedBy.role} - Mood {entry.moodRating ?? "-"} - Confidence {entry.confidence ?? "-"}</p>
                  <p className="mt-1 text-xs text-[#6d7785]">{formatDate(entry.submittedAt)}</p>
                </div>
              ))}
              {!feedback.length ? (
                <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
                  Feedback history will appear here after submissions.
                </p>
              ) : null}
            </div>
          </SectionCard>
        </div>
      ) : null}
    </FamilyDashboardFrame>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid gap-2 text-sm font-semibold text-[#22304a]">{label}{children}</label>;
}

function RatingField({ name, label, low, high, defaultValue }: { name: string; label: string; low: string; high: string; defaultValue: string }) {
  return (
    <Field label={label}>
      <div className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3">
        <div className="flex justify-between text-xs font-semibold text-[#6d7785]">
          {[1, 2, 3, 4, 5].map((value) => <span key={value}>{value}</span>)}
        </div>
        <input name={name} type="range" min="1" max="5" defaultValue={defaultValue} className="mt-2 w-full accent-[#f39f5f]" />
        <div className="mt-1 flex justify-between text-xs text-[#8a94a3]">
          <span>{low}</span>
          <span>{high}</span>
        </div>
      </div>
    </Field>
  );
}

function Choice({ name, label, options }: { name: string; label: string; options: string[] }) {
  return (
    <Field label={label}>
      <div className="grid gap-2 rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 text-sm font-medium text-[#4d5a6b]">
        {options.map((option, index) => (
          <label key={option} className="flex items-center gap-2">
            <input name={name} type="radio" value={option} required={index === 0} />
            {option}
          </label>
        ))}
      </div>
    </Field>
  );
}
