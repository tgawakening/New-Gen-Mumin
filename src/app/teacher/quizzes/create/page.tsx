import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { TeacherDashboardFrame, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ success?: string; error?: string; programId?: string; weekLabel?: string; lessonTitle?: string }>;
};

const QUESTION_TYPES = [
  { value: "MCQ", label: "Multiple choice" },
  { value: "TRUE_FALSE", label: "True / false" },
  { value: "SHORT_ANSWER", label: "Short answer" },
  { value: "FILL_IN_BLANK", label: "Fill in blank" },
];

export default async function TeacherQuizCreatePage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const params = searchParams ? await searchParams : {};
  const defaultProgramId = params.programId && dashboard.rosters.some((roster) => roster.programId === params.programId)
    ? params.programId
    : dashboard.rosters[0]?.programId;
  const defaultTitle = params.lessonTitle || (params.weekLabel ? `${params.weekLabel} quiz` : "");

  async function createQuizAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");
    const teacher = await db.teacherProfile.findUnique({
      where: { userId: currentSession.user.id },
      include: { programAssignments: true },
    });
    if (!teacher) redirect("/teacher-registration");

    const programId = String(formData.get("programId") || "");
    if (!teacher.programAssignments.some((assignment) => assignment.programId === programId)) {
      throw new Error("You can only create quizzes for assigned programs.");
    }

    const title = String(formData.get("title") || "").trim();
    if (!title) throw new Error("Quiz title is required.");

    const quiz = await db.quiz.create({
      data: {
        programId,
        title,
        description: String(formData.get("description") || "").trim() || null,
        type: String(formData.get("type") || "PRE_LESSON") as "PRE_LESSON" | "POST_LESSON",
        isPublished: formData.get("isPublished") === "on",
        timeLimitSeconds: Number(formData.get("timeLimitMinutes") || 0) > 0 ? Number(formData.get("timeLimitMinutes")) * 60 : null,
      },
    });

    for (let index = 1; index <= 5; index += 1) {
      const prompt = String(formData.get(`question-${index}`) || "").trim();
      if (!prompt) continue;
      const type = String(formData.get(`type-${index}`) || "MCQ");
      const points = Math.max(1, Number(formData.get(`points-${index}`) || 1));
      const answer = String(formData.get(`answer-${index}`) || "").trim();
      const choices = String(formData.get(`choices-${index}`) || "")
        .split(/\n|,/)
        .map((choice) => choice.trim())
        .filter(Boolean);

      await db.quizQuestion.create({
        data: {
          quizId: quiz.id,
          prompt,
          type: type as "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "FILL_IN_BLANK",
          points,
          sortOrder: index,
          answerKey: answer ? { answer } : undefined,
          meta: choices.length ? { choices } : undefined,
        },
      });
    }

    revalidatePath("/teacher/quizzes");
    revalidatePath("/student/quizzes");
    redirect("/teacher/quizzes/create?success=1");
  }

  return (
    <TeacherDashboardFrame
      title="Create Quiz"
      subtitle="Prepare pre-lesson and post-lesson assessments with objective and written question types."
      navItems={getTeacherNavItems()}
    >
      <ActionToast message={params.success ? "Quiz created successfully." : params.error} tone={params.error ? "error" : "success"} />

      <TeacherSection eyebrow="Quiz builder" title="Create a student quiz">
        <form action={createQuizAction} className="grid gap-4">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Title
              <input name="title" required defaultValue={defaultTitle} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Week 1 Arabic vocabulary check" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Program
              <select name="programId" required defaultValue={defaultProgramId} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                {dashboard.rosters.map((roster) => (
                  <option key={roster.programId} value={roster.programId}>{roster.title}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Quiz type
              <select name="type" defaultValue="PRE_LESSON" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                <option value="PRE_LESSON">Pre lesson</option>
                <option value="POST_LESSON">Post lesson</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px_210px]">
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Description
              <textarea name="description" rows={2} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Short instructions for students." />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Time limit minutes
              <input name="timeLimitMinutes" type="number" min="0" defaultValue="10" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-[#d8e3ed] bg-[#fbfdff] px-4 py-3 text-sm font-semibold text-[#22304a]">
              <input name="isPublished" type="checkbox" defaultChecked />
              Publish to students
            </label>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {[1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="min-w-0 rounded-[22px] bg-[#fbf6ef] p-4">
                <p className="font-semibold text-[#22304a]">Question {index}</p>
                <div className="mt-3 grid gap-3">
                  <input name={`question-${index}`} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Question prompt" />
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_90px] lg:grid-cols-[minmax(0,1fr)_90px] 2xl:grid-cols-[minmax(0,1fr)_90px_minmax(0,1fr)]">
                    <select name={`type-${index}`} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                      {QUESTION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                    <input name={`points-${index}`} type="number" min="1" defaultValue="1" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Points" />
                    <input name={`answer-${index}`} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Correct answer" />
                  </div>
                  <textarea name={`choices-${index}`} rows={2} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Choices for MCQ, separated by comma or new line" />
                </div>
              </div>
            ))}
          </div>

          <button className="w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">Create quiz</button>
        </form>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}
