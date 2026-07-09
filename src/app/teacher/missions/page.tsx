import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MissionKind, MissionQuestionType, MissionStatus } from "@prisma/client";

import { ActionToast } from "@/components/dashboard/ActionToast";
import {
  TeacherDashboardFrame,
  TeacherMetricGrid,
  TeacherSection,
  formatDate,
} from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { buildSunnahTrackerDescription, isSunnahTrackerMission, parseSunnahTrackerDescription } from "@/lib/community/quest";
import { db } from "@/lib/db";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";

type PageProps = {
  searchParams?: Promise<{ created?: string; deleted?: string }>;
};

export default async function TeacherMissionsPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  const programIds = dashboard.rosters.map((roster) => roster.programId);
  const missions = await db.mission.findMany({
    where: { programId: { in: programIds.length ? programIds : ["__none__"] } },
    orderBy: { createdAt: "desc" },
    include: {
      program: true,
      questions: true,
      attempts: true,
    },
  });
  const params = searchParams ? await searchParams : {};

  async function getTeacherAssignedProgramIds(userId: string) {
    "use server";
    const teacher = await db.teacherProfile.findUnique({
      where: { userId },
      include: { programAssignments: true },
    });
    if (!teacher) redirect("/teacher-registration");
    return teacher.programAssignments.map((assignment) => assignment.programId);
  }

  async function createMission(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");
    const assignedProgramIds = await getTeacherAssignedProgramIds(currentSession.user.id);

    const programId = String(formData.get("programId") || "");
    if (!assignedProgramIds.includes(programId)) throw new Error("You can only create missions for assigned programs.");

    const title = String(formData.get("title") || "").trim();
    const prompt = String(formData.get("prompt") || "").trim();
    const answer = String(formData.get("answer") || "").trim();
    if (!title || !prompt) throw new Error("Mission title and question are required.");

    const choices = String(formData.get("choices") || "")
      .split(/\n|,/)
      .map((choice) => choice.trim())
      .filter(Boolean);
    const questionType = String(formData.get("questionType") || "MCQ") as keyof typeof MissionQuestionType;
    const basePoints = Math.max(5, Number(formData.get("basePoints") || 25));

    await db.mission.create({
      data: {
        programId,
        title,
        description: String(formData.get("description") || "").trim() || null,
        kind: String(formData.get("kind") || MissionKind.DAILY) as MissionKind,
        status: formData.get("isPublished") === "on" ? MissionStatus.PUBLISHED : MissionStatus.DRAFT,
        basePoints,
        questions: {
          create: {
            prompt,
            type: MissionQuestionType[questionType] ?? MissionQuestionType.MCQ,
            points: Math.max(1, Number(formData.get("points") || 5)),
            sortOrder: 1,
            answerKey: answer ? { answer } : undefined,
            meta: choices.length ? { choices } : undefined,
          },
        },
      },
    });

    revalidatePath("/teacher/missions");
    revalidatePath("/student/missions");
    redirect("/teacher/missions?created=1");
  }

  async function createSunnahTracker(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");
    const assignedProgramIds = await getTeacherAssignedProgramIds(currentSession.user.id);

    const programId = String(formData.get("programId") || "");
    if (!assignedProgramIds.includes(programId)) throw new Error("You can only create Sunnah trackers for assigned programs.");

    const title = String(formData.get("title") || "").trim() || "Daily Sunnah Tracker";
    const description = String(formData.get("description") || "").trim();
    const taskLines = String(formData.get("tasks") || "")
      .split(/\r?\n/)
      .map((task) => task.trim())
      .filter(Boolean);
    if (!taskLines.length) throw new Error("Add at least one Sunnah task.");
    const taskPoints = Math.max(1, Number(formData.get("taskPoints") || 5));
    const basePoints = Math.max(0, Number(formData.get("basePoints") || 5));

    await db.mission.create({
      data: {
        programId,
        title,
        description: buildSunnahTrackerDescription(description),
        kind: MissionKind.DAILY,
        status: formData.get("isPublished") === "on" ? MissionStatus.PUBLISHED : MissionStatus.DRAFT,
        basePoints,
        questions: {
          create: taskLines.map((task, index) => ({
            prompt: task,
            type: MissionQuestionType.TRUE_FALSE,
            points: taskPoints,
            sortOrder: index + 1,
            answerKey: { answer: "true" },
            meta: { sunnahTask: true },
          })),
        },
      },
    });

    revalidatePath("/teacher/missions");
    revalidatePath("/student/missions");
    revalidatePath("/parent/sunnah-tracker");
    redirect("/teacher/missions?created=1");
  }

  async function deleteMission(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "TEACHER") redirect("/auth/login");
    const assignedProgramIds = await getTeacherAssignedProgramIds(currentSession.user.id);

    const missionId = String(formData.get("missionId") || "");
    const mission = await db.mission.findUnique({ where: { id: missionId } });
    if (!mission || !mission.programId || !assignedProgramIds.includes(mission.programId)) {
      throw new Error("Mission is not available for this teacher.");
    }

    await db.mission.delete({ where: { id: mission.id } });
    revalidatePath("/teacher/missions");
    revalidatePath("/student/missions");
    revalidatePath("/parent/sunnah-tracker");
    redirect("/teacher/missions?deleted=1");
  }

  return (
    <TeacherDashboardFrame
      title="Missions & Sunnah"
      subtitle="Create daily missions, reflection challenges, and checkbox-based Sunnah trackers for house points."
      navItems={getTeacherNavItems()}
    >
      <ActionToast message={params.created ? "Mission created." : params.deleted ? "Mission deleted." : undefined} />

      <TeacherMetricGrid
        metrics={[
          { label: "Activities", value: String(missions.length), hint: "Created for your programmes." },
          { label: "Sunnah trackers", value: String(missions.filter(isSunnahTrackerMission).length), hint: "Daily checklist templates." },
          { label: "Published", value: String(missions.filter((mission) => mission.status === "PUBLISHED").length), hint: "Visible to families." },
          { label: "Submissions", value: String(missions.reduce((sum, mission) => sum + mission.attempts.length, 0)), hint: "Student/parent records." },
        ]}
      />

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <TeacherSection eyebrow="Create" title="New mission">
          <form action={createMission} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Programme
                <select name="programId" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                  {dashboard.rosters.map((roster) => (
                    <option key={roster.programId} value={roster.programId}>{roster.title}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Mission type
                <select name="kind" defaultValue={MissionKind.DAILY} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                  <option value={MissionKind.DAILY}>Daily</option>
                  <option value={MissionKind.WEEKLY}>Weekly</option>
                  <option value={MissionKind.REFLECTION}>Reflection</option>
                  <option value={MissionKind.TEAM_BATTLE}>Team battle</option>
                </select>
              </label>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Title
              <input name="title" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Description
              <textarea name="description" rows={2} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_140px]">
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Question
                <input name="prompt" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Question type
                <select name="questionType" defaultValue="MCQ" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                  <option value="MCQ">MCQ</option>
                  <option value="TRUE_FALSE">True/false</option>
                  <option value="FILL_IN_BLANK">Fill blank</option>
                  <option value="SHORT_REFLECTION">Reflection</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Points
                <input name="points" type="number" min="1" defaultValue="5" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Choices
              <textarea name="choices" rows={2} placeholder="Comma or line separated for MCQ" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_160px_160px]">
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Correct answer
                <input name="answer" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Base points
                <input name="basePoints" type="number" min="5" defaultValue="25" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-[#d8e3ed] bg-[#fbfdff] px-4 py-3 text-sm font-semibold text-[#22304a]">
                <input name="isPublished" type="checkbox" defaultChecked />
                Publish now
              </label>
            </div>
            <button className="w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">Create mission</button>
          </form>
        </TeacherSection>

        <TeacherSection eyebrow="Sunnah tracker" title="Daily checkbox template">
          <form action={createSunnahTracker} className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Programme
                <select name="programId" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                  {dashboard.rosters.map((roster) => (
                    <option key={roster.programId} value={roster.programId}>{roster.title}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Tracker title
                <input name="title" defaultValue="Daily Sunnah Tracker" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Short note for parents
              <textarea name="description" rows={2} placeholder="Tick the tasks completed today. Add a note if needed." className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
              Sunnah tasks, one per line
              <textarea
                name="tasks"
                required
                rows={9}
                defaultValue={`After waking up, read the morning du'a\nMake your bed after you wake up\nWash your own dishes after eating\nHelp your mother organize or clean the house\nRead the daily du'a\nMake or give something to someone\nBefore eating, check everyone is included`}
                className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-[140px_140px_1fr]">
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Task points
                <input name="taskPoints" type="number" min="1" defaultValue="5" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                Base points
                <input name="basePoints" type="number" min="0" defaultValue="5" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-[#d8e3ed] bg-[#fbfdff] px-4 py-3 text-sm font-semibold text-[#22304a]">
                <input name="isPublished" type="checkbox" defaultChecked />
                Publish for parents/students
              </label>
            </div>
            <button className="w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white">Create Sunnah tracker</button>
          </form>
        </TeacherSection>

        <TeacherSection eyebrow="Library" title="Mission activity">
          <div className="space-y-4">
            {missions.map((mission) => {
              const sunnahTracker = isSunnahTrackerMission(mission);
              const sunnahDetails = parseSunnahTrackerDescription(mission.description);
              return (
                <div key={mission.id} className="rounded-[20px] border border-[#eadfce] bg-[#fbf6ef] p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#22304a]">{mission.title}</p>
                      <p className="mt-1 text-[#5f6b7a]">{mission.program?.title ?? "Global"} - {mission.status}</p>
                      {sunnahTracker ? <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#2f6b4b]">Sunnah tracker template</p> : null}
                      {sunnahDetails?.description ? <p className="mt-1 text-xs leading-5 text-[#6d7785]">{sunnahDetails.description}</p> : null}
                      <p className="mt-1 text-xs text-[#6d7785]">
                        {mission.questions.length} item(s) - {mission.attempts.length} submission(s) - {formatDate(mission.createdAt)}
                      </p>
                    </div>
                    <form action={deleteMission}>
                      <input type="hidden" name="missionId" value={mission.id} />
                      <button className="rounded-full border border-[#efb3b3] bg-white px-3 py-1.5 text-xs font-semibold text-[#b24646]">Delete</button>
                    </form>
                  </div>
                </div>
              );
            })}
            {!missions.length ? (
              <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">Created missions will appear here.</p>
            ) : null}
          </div>
        </TeacherSection>
      </div>
    </TeacherDashboardFrame>
  );
}
