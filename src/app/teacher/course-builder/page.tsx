import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { TeacherDashboardFrame, TeacherInfoList, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";

type PageProps = {
  searchParams?: Promise<{ success?: string }>;
};

function cleanOptional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

export default async function TeacherCourseBuilderPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));
  const teacherUserId = session.user.id;

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");

  const params = searchParams ? await searchParams : undefined;

  async function publishLessonContent(formData: FormData) {
    "use server";

    const scheduleId = String(formData.get("scheduleId") || "");
    const lessonDateRaw = String(formData.get("lessonDate") || "");
    const topic = String(formData.get("topic") || "").trim();
    const summary = String(formData.get("summary") || "").trim();
    const homework = cleanOptional(formData.get("homework"));
    const resourceLinks = cleanOptional(formData.get("resourceLinks"));

    if (!scheduleId || !lessonDateRaw || !topic || !summary) {
      throw new Error("Please complete class, lesson date, topic, and summary before publishing.");
    }

    const finalHomework = [homework, resourceLinks ? `Resources: ${resourceLinks}` : null]
      .filter(Boolean)
      .join("\n\n") || null;

    await db.lessonLog.create({
      data: {
        scheduleId,
        teacherUserId,
        lessonDate: new Date(lessonDateRaw),
        topic,
        summary,
        homework: finalHomework,
      },
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/course-builder");
    revalidatePath("/parent");
    revalidatePath("/student");
    redirect("/teacher/course-builder?success=lesson");
  }

  async function publishStudentTask(formData: FormData) {
    "use server";

    const programId = String(formData.get("programId") || "");
    const title = String(formData.get("title") || "").trim();
    const dueDateRaw = cleanOptional(formData.get("dueDate"));
    const instructions = String(formData.get("instructions") || "").trim();
    const resourceLinks = cleanOptional(formData.get("taskLinks"));

    if (!programId || !title || !instructions) {
      throw new Error("Please complete programme, task title, and instructions before publishing.");
    }

    const finalInstructions = [
      instructions,
      resourceLinks ? `Resources: ${resourceLinks}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    await db.assignment.create({
      data: {
        programId,
        title,
        instructions: finalInstructions,
        dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      },
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/course-builder");
    revalidatePath("/parent");
    revalidatePath("/student");
    redirect("/teacher/course-builder?success=task");
  }

  return (
    <TeacherDashboardFrame
      title="Course Builder"
      subtitle="Publish weekly lesson content, attach drive links or worksheets, and assign tasks so both students and parents can track what is happening."
      navItems={getTeacherNavItems()}
    >
      {params?.success ? (
        <div className="rounded-[24px] border border-[#d9e7f2] bg-[#eff7ff] px-5 py-4 text-sm text-[#2a5d84]">
          {params.success === "lesson"
            ? "Lesson content published. Parent and student dashboards will now surface the update."
            : "Student task published. It should now appear in the parent and student work areas."}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <TeacherSection eyebrow="Weekly content" title="Publish a lesson update">
            <form action={publishLessonContent} className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                Class schedule
                <select
                  name="scheduleId"
                  className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  required
                >
                  <option value="">Select a class</option>
                  {dashboard.classes.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title} • {entry.startTime}-{entry.endTime}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Lesson date
                  <input
                    type="date"
                    name="lessonDate"
                    className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Topic
                  <input
                    name="topic"
                    className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                    placeholder="Week focus or lesson title"
                    required
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                Teacher summary
                <textarea
                  name="summary"
                  rows={4}
                  className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  placeholder="What was covered today, what should parents know, and what should students focus on?"
                  required
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                Homework / follow-up
                <textarea
                  name="homework"
                  rows={3}
                  className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  placeholder="Homework notes, practice guidance, or parent reminders"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                Resource links
                <input
                  name="resourceLinks"
                  className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  placeholder="Paste Google Drive, PDF, video, or worksheet links"
                />
              </label>

              <button
                type="submit"
                className="inline-flex w-fit rounded-full bg-[#2a76aa] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245f88]"
              >
                Publish lesson update
              </button>
            </form>
          </TeacherSection>

          <TeacherSection eyebrow="Student work" title="Assign a task or homework">
            <form action={publishStudentTask} className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                Programme
                <select
                  name="programId"
                  className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  required
                >
                  <option value="">Select a programme</option>
                  {dashboard.rosters.map((roster) => (
                    <option key={roster.programId} value={roster.programId}>
                      {roster.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Task title
                  <input
                    name="title"
                    className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                    placeholder="Weekly worksheet, reading, or practice task"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Due date
                  <input
                    type="date"
                    name="dueDate"
                    className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                Task instructions
                <textarea
                  name="instructions"
                  rows={4}
                  className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  placeholder="Explain the task clearly so both parent and student understand what needs to be completed."
                  required
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                Drive or worksheet links
                <input
                  name="taskLinks"
                  className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  placeholder="Paste Google Drive, worksheet, or reference links"
                />
              </label>

              <button
                type="submit"
                className="inline-flex w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2740]"
              >
                Publish student task
              </button>
            </form>
          </TeacherSection>
        </div>

        <div className="space-y-6">
          <TeacherSection eyebrow="Recent publishing" title="Latest lesson updates">
            <TeacherInfoList
              items={dashboard.lessonLogs.slice(0, 6).map(
                (entry) =>
                  `${entry.title} • ${entry.topic} • ${entry.lessonDate.toLocaleDateString("en-GB")}`,
              )}
              emptyLabel="Published lesson updates will appear here."
            />
          </TeacherSection>

          <TeacherSection eyebrow="Tasks" title="Recent assignments">
            <TeacherInfoList
              items={dashboard.assignments.slice(0, 6).map((task) => {
                const due = task.dueDate ? task.dueDate.toLocaleDateString("en-GB") : "No due date";
                return `${task.programTitle} • ${task.title} • ${task.submissions} submissions • ${due}`;
              })}
              emptyLabel="Published tasks will appear here."
            />
          </TeacherSection>

          <TeacherSection eyebrow="Teacher upload flow" title="What this enables">
            <TeacherInfoList
              items={[
                "Teachers can post weekly lesson summaries directly from their dashboard.",
                "Parents can monitor what was taught and what tasks were assigned.",
                "Students can see new tasks, teacher notes, and recognition progress from one place.",
              ]}
              emptyLabel="Publishing guidance will appear here."
            />
          </TeacherSection>
        </div>
      </div>
    </TeacherDashboardFrame>
  );
}
