import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FeedbackAudience } from "@prisma/client";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { getTeacherFeedbackSummary, getTeacherParentFeedbackInbox, submitWeeklyFeedback } from "@/lib/community/feedback";
import { ActionToast } from "@/components/dashboard/ActionToast";
import {
  TeacherDashboardFrame,
  TeacherMetricGrid,
  TeacherSection,
  formatDate,
} from "@/components/dashboard/teacher/TeacherDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ submitted?: string }>;
};

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

  const params = searchParams ? await searchParams : {};

  async function submitTeacherFeedback(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");

    const classId = String(formData.get("classId") || "");
    const classInfo = dashboard?.classes.find((entry) => entry.id === classId);
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
        classSubject: String(formData.get("classSubject") || classInfo?.title || ""),
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
        body: `${dashboard?.teacherName ?? "A teacher"} submitted class feedback.`,
        href: "/admin/feedback",
      })),
      skipDuplicates: true,
    });

    revalidatePath("/teacher/feedback");
    redirect("/teacher/feedback?submitted=1");
  }

  return (
    <TeacherDashboardFrame
      title="Weekly Feedback"
      subtitle="Submit teaching reflections, workload signals, student support needs, and operational blockers."
      navItems={getTeacherNavItems()}
    >
      <ActionToast message={params.submitted ? "Teacher feedback submitted." : undefined} />

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
          <form action={submitTeacherFeedback} className="grid gap-4">
            <input type="hidden" name="weekLabel" value={`Class handover - ${new Date().toLocaleDateString("en-GB")}`} />
            <div className="rounded-[22px] border border-[#f0d4bb] bg-[#fff8f0] p-4">
              <span className="rounded-lg bg-[#f39f5f] px-3 py-1 text-xs font-semibold text-white">Section 1 of 3</span>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
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
            </div>
            <div className="rounded-[22px] border border-[#f0d4bb] bg-[#fff8f0] p-4">
              <span className="rounded-lg bg-[#f39f5f] px-3 py-1 text-xs font-semibold text-white">Section 2 of 3</span>
              <div className="mt-4 grid gap-4">
                <Field label="What was taught today?"><textarea name="taughtToday" rows={3} required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Choice name="classStatus" label="Class Status" options={["Completed smoothly", "Partially completed", "Needs revision", "Needs management attention"]} />
                  <Choice name="studentEngagement" label="Student Engagement" options={["High", "Medium", "Low"]} />
                </div>
                <Choice name="missedTopic" label="Was any topic missed or left incomplete?" options={["No", "Yes", "Not sure"]} />
                <Field label="If yes, what was missed?"><textarea name="missedDetails" rows={2} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></Field>
                <Field label="Notes for the next teacher"><textarea name="nextTeacherNotes" rows={3} required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></Field>
              </div>
            </div>
            <div className="rounded-[22px] border border-[#f0d4bb] bg-[#fff8f0] p-4">
              <span className="rounded-lg bg-[#f39f5f] px-3 py-1 text-xs font-semibold text-white">Section 3 of 3</span>
              <div className="mt-4 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Choice name="studentConcern" label="Any student concern?" options={["No concern", "Minor concern", "Needs follow-up", "Urgent concern"]} />
                  <Choice name="managementSupport" label="Do you need management support?" options={["No", "Yes", "Not Sure"]} />
                </div>
                <Field label="If there is a concern, explain briefly"><textarea name="concernExplanation" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></Field>
                <Field label="Any final note?"><textarea name="finalNote" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" /></Field>
              </div>
            </div>
            <button className="w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">
              Submit teacher feedback
            </button>
          </form>
        </TeacherSection>

        <TeacherSection eyebrow="History" title="Recent entries">
          <div className="space-y-3">
            {feedback.map((entry) => (
              <div key={entry.id} className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm text-[#4d5a6b]">
                <p className="font-semibold text-[#22304a]">{entry.weekLabel}</p>
                <p className="mt-1">Confidence {entry.confidence ?? "-"} - Workload {entry.workload ?? "-"}</p>
                <p className="mt-1 text-xs text-[#6d7785]">{formatDate(entry.submittedAt)}</p>
              </div>
            ))}
            {!feedback.length ? (
              <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
                Your teacher feedback history will appear here.
              </p>
            ) : null}
          </div>
        </TeacherSection>
      </div>

      <TeacherSection eyebrow="Parent pulse inbox" title="Parent feedback for your programmes">
        <div className="grid gap-3">
          {parentInbox.responses.slice(0, 30).map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-[#dce4ed] bg-white p-4 text-sm">
              <p className="font-semibold text-[#22304a]">{entry.student?.displayName || `${entry.student?.user.firstName ?? ""} ${entry.student?.user.lastName ?? ""}`.trim()}</p>
              <p className="mt-1 text-[#617184]">{entry.weekLabel} - {formatDate(entry.submittedAt)}</p>
              <p className="mt-2 line-clamp-2 text-[#4d5a6b]">{entry.wins || entry.concerns || "No written note"}</p>
            </div>
          ))}
          {!parentInbox.responses.length ? <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm text-[#6b7482]">Parent feedback will appear here.</p> : null}
        </div>
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
