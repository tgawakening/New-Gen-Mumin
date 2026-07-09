import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { TeacherDashboardFrame, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";
import { QuizQuestionBuilderClient } from "@/components/dashboard/teacher/QuizQuestionBuilderClient";

type PageProps = {
  searchParams?: Promise<{ success?: string; error?: string; programId?: string; weekLabel?: string; lessonTitle?: string; editId?: string }>;
};

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
  const assignedProgramIds = dashboard.rosters.map((roster) => roster.programId);
  const editingQuiz = params.editId
    ? await db.quiz.findFirst({
        where: { id: params.editId, programId: { in: assignedProgramIds } },
        include: { questions: { orderBy: { sortOrder: "asc" } } },
      })
    : null;
  const defaultTitle = editingQuiz?.title || params.lessonTitle || (params.weekLabel ? `${params.weekLabel} quiz` : "");

  async function saveQuizAction(formData: FormData) {
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
    const quizId = String(formData.get("quizId") || "");
    if (quizId) {
      const existing = await db.quiz.findUnique({ where: { id: quizId } });
      if (!existing || !teacher.programAssignments.some((assignment) => assignment.programId === existing.programId)) {
        throw new Error("Quiz is not available for this teacher.");
      }
    }
    const quizPayload = {
      programId,
      title,
      description: String(formData.get("description") || "").trim() || null,
      type: String(formData.get("type") || "PRE_LESSON") as "PRE_LESSON" | "POST_LESSON",
      isPublished: formData.get("isPublished") === "on",
      timeLimitSeconds: Number(formData.get("timeLimitMinutes") || 0) > 0 ? Number(formData.get("timeLimitMinutes")) * 60 : null,
      meta: {
        kahootStyle: true,
        fairScoring: true,
        responseWindowSeconds: Math.max(1, Number(formData.get("responseWindowSeconds") || 10)),
        participationPoints: Math.max(0, Number(formData.get("participationPoints") || 1)),
        streakBonusPoints: Math.max(0, Number(formData.get("streakBonusPoints") || 5)),
      },
    };

    const quiz = quizId
      ? await db.quiz.update({ where: { id: quizId }, data: quizPayload })
      : await db.quiz.create({ data: quizPayload });

    if (quizId) {
      await db.quizQuestion.deleteMany({ where: { quizId: quiz.id } });
    }

    for (let index = 1; index <= 10; index += 1) {
      const prompt = String(formData.get(`question-${index}`) || "").trim();
      if (!prompt) continue;
      const type = String(formData.get(`type-${index}`) || "MCQ");
      const points = Math.max(1, Number(formData.get(`points-${index}`) || 1));
      const optionChoices = [1, 2, 3, 4]
        .map((choiceIndex) => String(formData.get(`choice-${index}-${choiceIndex}`) || "").trim())
        .filter(Boolean);
      const legacyChoices = String(formData.get(`choices-${index}`) || "")
        .split(/\n|,/)
        .map((choice) => choice.trim())
        .filter(Boolean);
      const choices = optionChoices.length ? optionChoices : legacyChoices;
      const correctChoiceIndex = Number(formData.get(`correct-${index}`) || 0);
      const answer = choices[correctChoiceIndex - 1] || String(formData.get(`answer-${index}`) || "").trim();

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
    revalidatePath("/parent/quizzes");
    redirect(`/teacher/quizzes?${quizId ? "updated=1" : "created=1"}`);
  }

  return (
    <TeacherDashboardFrame
      title="Create Quiz"
      subtitle="Prepare pre-lesson and post-lesson assessments with objective and written question types."
      navItems={getTeacherNavItems()}
    >
      <ActionToast message={params.success ? "Quiz saved successfully." : params.error} tone={params.error ? "error" : "success"} />

      <TeacherSection eyebrow="Quiz builder" title={editingQuiz ? "Edit student quiz" : "Create a student quiz"}>
        <form action={saveQuizAction} className="grid gap-4">
          <input type="hidden" name="quizId" value={editingQuiz?.id ?? ""} />
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Title
              <input name="title" required defaultValue={defaultTitle} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Week 1 Arabic vocabulary check" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Program
              <select name="programId" required defaultValue={editingQuiz?.programId ?? defaultProgramId} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                {dashboard.rosters.map((roster) => (
                  <option key={roster.programId} value={roster.programId}>{roster.title}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Quiz type
              <select name="type" defaultValue={editingQuiz?.type ?? "PRE_LESSON"} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                <option value="PRE_LESSON">Pre lesson</option>
                <option value="POST_LESSON">Post lesson</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_210px_210px]">
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Description
              <textarea name="description" rows={2} defaultValue={editingQuiz?.description ?? ""} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Short instructions for students." />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Time limit minutes
              <input name="timeLimitMinutes" type="number" min="0" defaultValue={editingQuiz?.timeLimitSeconds ? Math.round(editingQuiz.timeLimitSeconds / 60) : 10} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-[#d8e3ed] bg-[#fbfdff] px-4 py-3 text-sm font-semibold text-[#22304a]">
              <input name="isPublished" type="checkbox" defaultChecked={editingQuiz?.isPublished ?? true} />
              Publish to students
            </label>
          </div>

          <div className="grid gap-4 rounded-[22px] border border-[#eadfce] bg-[#fbf6ef] p-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Full-point answer window
              <input name="responseWindowSeconds" type="number" min="1" defaultValue={10} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              <span className="text-xs font-normal text-[#617184]">Anyone correct inside this window gets full points. No fastest-wins scoring.</span>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Participation points
              <input name="participationPoints" type="number" min="0" defaultValue={1} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              <span className="text-xs font-normal text-[#617184]">Optional points for taking part.</span>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Perfect quiz bonus
              <input name="streakBonusPoints" type="number" min="0" defaultValue={5} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              <span className="text-xs font-normal text-[#617184]">Bonus when every objective answer is correct.</span>
            </label>
          </div>
          <QuizQuestionBuilderClient
            initialQuestions={editingQuiz?.questions.map((question) => {
              const answerKey = question.answerKey as { answer?: string } | null;
              const meta = question.meta as { choices?: string[] } | null;
              return {
                prompt: question.prompt,
                type: question.type,
                answer: answerKey?.answer ?? "",
                choices: Array.isArray(meta?.choices) ? meta.choices.join(", ") : "",
                points: question.points || 10,
              };
            })}
          />

          <FormSubmitButton pendingLabel={editingQuiz ? "Updating quiz..." : "Creating quiz..."} className="w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white disabled:opacity-70">
            {editingQuiz ? "Update quiz" : "Create quiz"}
          </FormSubmitButton>
        </form>
      </TeacherSection>
    </TeacherDashboardFrame>
  );
}

