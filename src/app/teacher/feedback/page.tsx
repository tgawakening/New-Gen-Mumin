import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FeedbackAudience } from "@prisma/client";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { displayProgramTitle } from "@/lib/genm/curriculum";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { getTeacherFeedbackSummary, getTeacherParentFeedbackInbox, submitWeeklyFeedback } from "@/lib/community/feedback";
import { sendAdminFeedbackSubmittedEmail } from "@/lib/email/notifications";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { FeedbackReviewConsole, type FeedbackReviewEntry } from "@/components/dashboard/feedback/FeedbackReviewConsole";
import { MultiStepFeedbackForm } from "@/components/dashboard/feedback/MultiStepFeedbackForm";
import {
  TeacherDashboardFrame,
  TeacherMetricGrid,
  TeacherSection,
  formatDate,
} from "@/components/dashboard/teacher/TeacherDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ submitted?: string; error?: string }>;
};

function noticeHref(message: string, tone: "success" | "error" | "danger" = "success") {
  const params = new URLSearchParams();
  if (tone === "success") {
    params.set("submitted", "1");
  } else {
    params.set("error", message);
  }
  const query = params.toString();
  return `/teacher/feedback${query ? `?${query}` : ""}`;
}

function payloadEntries(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  return Object.entries(payload).map(([key, value]) => ({
    label: key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
    value: Array.isArray(value) ? value.join(", ") : String(value || "No entry"),
  }));
}

export default async function TeacherFeedbackPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const [dashboard, feedback] = await Promise.all([
    getTeacherDashboardData(session.user.id),
    getTeacherFeedbackSummary(session.user.id),
  ]);
  if (!dashboard) redirect("/teacher-registration");
  const parentInbox = await getTeacherParentFeedbackInbox(session.user.id);
  const parentReviewEntries: FeedbackReviewEntry[] = parentInbox.responses.map((entry) => {
    const studentName = entry.student?.displayName || `${entry.student?.user.firstName ?? ""} ${entry.student?.user.lastName ?? ""}`.trim() || null;
    const programmes = Array.from(new Set(entry.student?.enrollments.map((enrollment) => displayProgramTitle(enrollment.program.title)) ?? []));
    const summary = [
      { label: "What is going well", value: entry.wins || "No entry" },
      { label: "Concern", value: entry.concerns || "No entry" },
      { label: "Improvement", value: entry.supportNeeded || "No entry" },
    ];

    return {
      id: entry.id,
      audience: "PARENT",
      title: entry.weekLabel,
      submittedBy: `${entry.submittedBy.firstName} ${entry.submittedBy.lastName}`.trim(),
      studentName,
      programmes,
      submittedAt: formatDate(entry.submittedAt),
      metrics: [
        { label: "Satisfaction", value: entry.moodRating ? `${entry.moodRating}/5` : "-" },
        { label: "Confidence", value: entry.confidence ? `${entry.confidence}/5` : "-" },
      ],
      summary,
      details: [...payloadEntries(entry.rawPayload), ...summary],
    };
  });
  const teacherReviewEntries: FeedbackReviewEntry[] = feedback.map((entry) => ({
    id: entry.id,
    audience: "TEACHER",
    title: entry.weekLabel,
    submittedBy: dashboard.teacherName,
    studentName: null,
    programmes: [],
    submittedAt: formatDate(entry.submittedAt),
    metrics: [
      { label: "Engagement", value: entry.confidence ? `${entry.confidence}/5` : "-" },
    ],
    summary: [
      { label: "Taught", value: entry.wins || "No entry" },
      { label: "Concern", value: entry.concerns || "No entry" },
      { label: "Next teacher notes", value: entry.supportNeeded || "No entry" },
    ],
    details: [
      ...payloadEntries(entry.rawPayload),
      { label: "Taught", value: entry.wins || "No entry" },
      { label: "Concern", value: entry.concerns || "No entry" },
      { label: "Next teacher notes", value: entry.supportNeeded || "No entry" },
    ],
  }));

  const params = searchParams ? await searchParams : {};

  async function submitTeacherFeedback(formData: FormData) {
    "use server";

    let successHref = "";
    try {
      const currentSession = await getCurrentSession();
      if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

      const currentDashboard = await getTeacherDashboardData(currentSession.user.id);
      if (!currentDashboard) redirect("/teacher-registration");

      const classId = String(formData.get("classId") || "");
      const classInfo = currentDashboard.classes.find((entry) => entry.id === classId);
      if (!classInfo) throw new Error("Selected class is not available for this teacher.");

      await submitWeeklyFeedback({
        audience: FeedbackAudience.TEACHER,
        submittedById: currentSession.user.id,
        teacherUserId: currentSession.user.id,
        weekLabel: String(formData.get("weekLabel") || `Class handover - ${new Date().toLocaleDateString("en-GB")}`),
        moodRating: null,
        confidence: String(formData.get("studentEngagement") || "") === "High" ? 5 : String(formData.get("studentEngagement") || "") === "Medium" ? 3 : 1,
        workload: null,
        wins: String(formData.get("taughtToday") || ""),
        concerns: String(formData.get("concernExplanation") || ""),
        supportNeeded: String(formData.get("nextTeacherNotes") || ""),
        rawPayload: {
          teacherName: String(formData.get("teacherName") || ""),
          classSubject: String(formData.get("classSubject") || classInfo.title || ""),
          ageGroup: String(formData.get("ageGroup") || ""),
          classDate: String(formData.get("classDate") || ""),
          classTime: String(formData.get("classTime") || ""),
          taughtToday: String(formData.get("taughtToday") || ""),
          classStatus: String(formData.get("classStatus") || ""),
          studentEngagement: String(formData.get("studentEngagement") || ""),
          missedTopic: String(formData.get("missedTopic") || ""),
          missedDetails: String(formData.get("missedDetails") || ""),
          nextTeacherNotes: String(formData.get("nextTeacherNotes") || ""),
          studentConcern: String(formData.get("studentConcern") || ""),
          concernExplanation: String(formData.get("concernExplanation") || ""),
          managementSupport: String(formData.get("managementSupport") || ""),
          finalNote: String(formData.get("finalNote") || ""),
        },
      });

      const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await db.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          title: "Teacher handover submitted",
          body: `${currentDashboard.teacherName ?? "A teacher"} submitted class feedback.`,
          href: "/admin/feedback",
        })),
        skipDuplicates: true,
      });

      try {
        await sendAdminFeedbackSubmittedEmail({
          audience: "TEACHER",
          submittedByName: currentDashboard.teacherName,
          submittedByEmail: currentDashboard.profile.email,
          studentName: null,
          programmes: [String(formData.get("classSubject") || classInfo.title || "General")],
          weekLabel: String(formData.get("weekLabel") || `Class handover - ${new Date().toLocaleDateString("en-GB")}`),
          summary: String(formData.get("taughtToday") || formData.get("nextTeacherNotes") || formData.get("concernExplanation") || ""),
        });
      } catch (emailError) {
        console.error("Admin teacher feedback email failed", emailError);
      }

      revalidatePath("/teacher/feedback");
      successHref = noticeHref("Teacher feedback submitted.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to submit teacher feedback.";
      redirect(noticeHref(errorMessage, "error"));
    }
    redirect(successHref);
  }

  return (
    <TeacherDashboardFrame
      title="Weekly Feedback"
      subtitle="Submit teaching reflections, workload signals, student support needs, and operational blockers."
      navItems={getTeacherNavItems()}
    >
      <ActionToast message={params.error ? params.error : params.submitted ? "Teacher feedback submitted." : undefined} tone={params.error ? "error" : undefined} />

      <TeacherMetricGrid
        metrics={[
          { label: "Responses", value: String(feedback.length), hint: "Your recent teacher feedback entries." },
          { label: "Confidence", value: feedback[0]?.confidence ? `${feedback[0].confidence}/5` : "Pending", hint: "Latest delivery confidence." },
          { label: "Workload", value: feedback[0]?.workload ? `${feedback[0].workload}/5` : "Pending", hint: "Latest workload signal." },
          { label: "Classes", value: String(dashboard.classes.length), hint: "Assigned teaching sessions." },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <TeacherSection eyebrow="Class handover" title="Submit after class">
          <MultiStepFeedbackForm
            action={submitTeacherFeedback}
            hiddenFields={[{ name: "weekLabel", value: `Class handover - ${new Date().toLocaleDateString("en-GB")}` }]}
            submitLabel="Submit teacher feedback"
            steps={[
              {
                title: "Gen Mu'min Class Handover",
                description: "A quick update after class so the next teacher and management stay aligned.",
                content: (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Teacher Name"><input name="teacherName" defaultValue={dashboard.teacherName} required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></Field>
                    <Field label="Class / Subject">
                      <select name="classId" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                        {dashboard.classes.map((classInfo) => <option key={classInfo.id} value={classInfo.id}>{classInfo.title}</option>)}
                      </select>
                    </Field>
                    <Field label="Program">
                      <select name="classSubject" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                        {dashboard.rosters.map((program) => <option key={program.programId}>{program.title}</option>)}
                        <option>Full Gen Mu&apos;min Program</option>
                      </select>
                    </Field>
                    <Field label="Age Group">
                      <select name="ageGroup" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                        {["6-8", "9-12", "13-17", "Mixed age group"].map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </Field>
                    <Field label="Class Date"><input name="classDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></Field>
                    <Field label="Class Time"><input name="classTime" type="time" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></Field>
                  </div>
                ),
              },
              {
                title: "Class Summary",
                description: "A short summary of what happened in today's class.",
                content: (
                  <>
                    <Field label="What was taught today?"><textarea name="taughtToday" rows={3} required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></Field>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Choice name="classStatus" label="Class Status" options={["Completed smoothly", "Partially completed", "Needs revision", "Needs management attention"]} />
                      <Choice name="studentEngagement" label="Student Engagement" options={["High", "Medium", "Low"]} />
                    </div>
                    <Choice name="missedTopic" label="Was any topic missed or left incomplete?" options={["No", "Yes", "Not sure"]} />
                    <Field label="If yes, what was missed?"><textarea name="missedDetails" rows={2} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></Field>
                    <Field label="Notes for the next teacher"><textarea name="nextTeacherNotes" rows={3} required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></Field>
                  </>
                ),
              },
              {
                title: "Student Concerns & Support",
                description: "Only mention important concerns or support needed.",
                content: (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Choice name="studentConcern" label="Any student concern?" options={["No concern", "Minor concern", "Needs follow-up", "Urgent concern"]} />
                      <Choice name="managementSupport" label="Do you need management support?" options={["No", "Yes", "Not Sure"]} />
                    </div>
                    <Field label="If there is a concern, explain briefly"><textarea name="concernExplanation" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></Field>
                    <Field label="Any final note?"><textarea name="finalNote" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></Field>
                  </>
                ),
              },
            ]}
          />
        </TeacherSection>

        <TeacherSection eyebrow="History" title="Recent entries">
          <FeedbackReviewConsole
            entries={teacherReviewEntries}
            defaultAudience="TEACHER"
            showAudienceTabs={false}
            showProgrammeTabs={false}
            emptyLabel="Your teacher feedback history will appear here."
          />
        </TeacherSection>
      </div>

      <TeacherSection eyebrow="Parent pulse inbox" title="Parent feedback for your programmes">
        <FeedbackReviewConsole
          entries={parentReviewEntries}
          defaultAudience="PARENT"
          showAudienceTabs={false}
          showProgrammeTabs
          emptyLabel="Parent feedback will appear here."
        />
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm font-semibold text-[#22304a]">{label}{children}</label>;
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
