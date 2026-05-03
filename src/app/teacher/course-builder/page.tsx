import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { TeacherDashboardFrame, TeacherInfoList, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { genMProgrammes, genMTerms, getGenMProgrammeByTitle, getGenMTeachersForProgramme } from "@/lib/genm/curriculum";
import { buildLessonPayload, buildTaskPayload, parseLessonPayload, parseTaskPayload } from "@/lib/genm/published-content";
import { getTeacherDashboardData } from "@/lib/teacher/dashboard";
import { getTeacherNavItems } from "@/lib/teacher/nav";

type PageProps = {
  searchParams?: Promise<{ success?: string }>;
};

function cleanOptional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function splitLinks(value: string | null) {
  if (!value) return [];
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function TeacherCourseBuilderPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));
  const teacherUserId = session.user.id;

  const dashboard = await getTeacherDashboardData(session.user.id);
  if (!dashboard) redirect("/teacher-registration");
  const teacherDashboard = dashboard;

  const params = searchParams ? await searchParams : undefined;

  async function publishLessonContent(formData: FormData) {
    "use server";

    const scheduleId = String(formData.get("scheduleId") || "");
    const lessonDateRaw = String(formData.get("lessonDate") || "");
    const topic = String(formData.get("topic") || "").trim();
    const summary = String(formData.get("summary") || "").trim();
    const homework = cleanOptional(formData.get("homework"));
    const resourceLinks = cleanOptional(formData.get("resourceLinks"));
    const parentPrompt = cleanOptional(formData.get("parentPrompt"));
    const weekLabel = cleanOptional(formData.get("weekLabel"));
    const termId = cleanOptional(formData.get("termId"));
    const contentType = cleanOptional(formData.get("contentType"));
    const materials = cleanOptional(formData.get("materials"));
    const programmeFocus = cleanOptional(formData.get("programmeFocus"));
    const lessonObjective = cleanOptional(formData.get("lessonObjective"));

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
        summary: buildLessonPayload({
          topic,
          summary,
          instructorName: teacherDashboard.teacherName,
          programmeFocus,
          lessonObjective,
          homework,
          resourceLinks: splitLinks(resourceLinks),
          parentPrompt,
          weekLabel,
          termId,
          contentType,
          materials,
        }),
        homework: finalHomework,
      },
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/course-builder");
    revalidatePath("/parent");
    revalidatePath("/parent/courses");
    revalidatePath("/student");
    revalidatePath("/student/courses");
    redirect("/teacher/course-builder?success=lesson");
  }

  async function publishStudentTask(formData: FormData) {
    "use server";

    const programId = String(formData.get("programId") || "");
    const title = String(formData.get("title") || "").trim();
    const dueDateRaw = cleanOptional(formData.get("dueDate"));
    const instructions = String(formData.get("instructions") || "").trim();
    const resourceLinks = cleanOptional(formData.get("taskLinks"));
    const evidenceMode = cleanOptional(formData.get("evidenceMode"));
    const weekLabel = cleanOptional(formData.get("taskWeekLabel"));
    const termId = cleanOptional(formData.get("taskTermId"));
    const familyNote = cleanOptional(formData.get("familyNote"));
    const programmeFocus = cleanOptional(formData.get("taskProgrammeFocus"));
    const taskCategory = cleanOptional(formData.get("taskCategory"));

    if (!programId || !title || !instructions) {
      throw new Error("Please complete programme, task title, and instructions before publishing.");
    }

    await db.assignment.create({
      data: {
        programId,
        title,
        instructions: buildTaskPayload({
          title,
          instructions,
          instructorName: teacherDashboard.teacherName,
          programmeFocus,
          taskCategory,
          resourceLinks: splitLinks(resourceLinks),
          evidenceMode,
          weekLabel,
          termId,
          familyNote,
        }),
        dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
      },
    });

    revalidatePath("/teacher");
    revalidatePath("/teacher/course-builder");
    revalidatePath("/parent");
    revalidatePath("/parent/courses");
    revalidatePath("/student");
    revalidatePath("/student/courses");
    redirect("/teacher/course-builder?success=task");
  }

  return (
    <TeacherDashboardFrame
      title="Course Builder"
      subtitle="Publish structured weekly lesson content, attach materials and drive links, and push tasks into the student and parent LMS exactly where each programme needs them."
      navItems={getTeacherNavItems()}
    >
      {params?.success ? (
        <div className="rounded-[24px] border border-[#d9e7f2] bg-[#eff7ff] px-5 py-4 text-sm text-[#2a5d84]">
          {params.success === "lesson"
            ? "Lesson content published. Parent and student dashboards will now surface the update."
            : "Student task published. It should now appear in the family LMS and coursework views."}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <TeacherSection eyebrow="Programme map" title="Your current teaching streams">
            <div className="grid gap-4 lg:grid-cols-2">
              {teacherDashboard.rosters.map((roster) => {
                const programme = getGenMProgrammeByTitle(roster.title);
                const teachers = getGenMTeachersForProgramme(roster.title);

                return (
                  <div key={roster.programId} className="rounded-[24px] bg-[#fbf6ef] p-5">
                    <h3 className="text-xl font-semibold text-[#22304a]">{roster.title}</h3>
                    {programme?.strapline ? (
                      <p className="mt-2 text-sm font-medium text-[#c27a2c]">{programme.strapline}</p>
                    ) : null}
                    {programme?.description ? (
                      <p className="mt-3 text-sm leading-7 text-[#5f6b7a]">{programme.description}</p>
                    ) : null}
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-[18px] bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                          Teacher team
                        </p>
                        <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                          {teachers.map((teacher) => (
                            <li key={teacher.slug}>• {teacher.name} — {teacher.title}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-[18px] bg-white p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                          Upload focus
                        </p>
                        <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                          {(programme?.uploadIdeas ?? []).map((idea) => (
                            <li key={idea}>• {idea}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </TeacherSection>

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
                  {teacherDashboard.classes.map((entry) => (
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

              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Term
                  <select
                    name="termId"
                    className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  >
                    <option value="">Select term</option>
                    {genMTerms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.title} - {term.level}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Week label
                  <input
                    name="weekLabel"
                    className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                    placeholder="Week 5 - Cave Hira"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Content type
                  <input
                    name="contentType"
                    className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                    placeholder="Story, worksheet, listening task"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Programme focus
                  <input
                    name="programmeFocus"
                    className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                    placeholder="Makharij, Hijrah, dialogue practice"
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
                Lesson objective
                <input
                  name="lessonObjective"
                  className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  placeholder="What should learners understand or practise by the end of this lesson?"
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

              <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                Materials or kit needed
                <input
                  name="materials"
                  className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  placeholder="Flashcards, Ka'bah craft, plant tray, Tajweed poster"
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                Parent prompt
                <textarea
                  name="parentPrompt"
                  rows={3}
                  className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  placeholder="How should parents follow up with this lesson at home?"
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
                  {teacherDashboard.rosters.map((roster) => (
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

              <div className="grid gap-4 md:grid-cols-3">
                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Term
                  <select
                    name="taskTermId"
                    className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  >
                    <option value="">Select term</option>
                    {genMTerms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.title} - {term.level}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Week label
                  <input
                    name="taskWeekLabel"
                    className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                    placeholder="Week 5 practice task"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Evidence mode
                  <select
                    name="evidenceMode"
                    className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  >
                    <option value="">Select evidence</option>
                    <option value="photo">Photo upload later</option>
                    <option value="video">Short video</option>
                    <option value="zoom">Live demonstration on Zoom</option>
                    <option value="verbal">Verbal explanation</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Task category
                  <input
                    name="taskCategory"
                    className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                    placeholder="Worksheet, memorisation, recitation, project"
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                Programme focus
                <input
                  name="taskProgrammeFocus"
                  className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  placeholder="Noon saakin, Seerah reflection, first-aid drill"
                />
              </label>

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

              <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                Parent guidance note
                <textarea
                  name="familyNote"
                  rows={3}
                  className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  placeholder="How should families support this task at home this week?"
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
              items={teacherDashboard.lessonLogs.slice(0, 6).map((entry) => {
                const parsed = parseLessonPayload(entry.summary, entry.homework);
                const label = parsed.weekLabel ? `${parsed.weekLabel} • ` : "";
                return `${entry.title} • ${label}${parsed.topic || entry.topic} • ${entry.lessonDate.toLocaleDateString("en-GB")}`;
              })}
              emptyLabel="Published lesson updates will appear here."
            />
          </TeacherSection>

          <TeacherSection eyebrow="Tasks" title="Recent assignments">
            <TeacherInfoList
              items={teacherDashboard.assignments.slice(0, 6).map((task) => {
                const parsed = parseTaskPayload(task.instructions);
                const due = task.dueDate ? task.dueDate.toLocaleDateString("en-GB") : "No due date";
                const label = parsed.weekLabel ? `${parsed.weekLabel} • ` : "";
                return `${task.programTitle} • ${label}${task.title} • ${task.submissions} submissions • ${due}`;
              })}
              emptyLabel="Published tasks will appear here."
            />
          </TeacherSection>

          <TeacherSection eyebrow="Teacher upload flow" title="What this enables">
            <TeacherInfoList
              items={[
                "Teachers can post structured weekly lesson summaries directly from their dashboard.",
                "Parents can monitor what was taught, what materials are needed, and what follow-up is expected at home.",
                "Students can see new tasks, resource links, evidence expectations, and recognition progress from one place.",
              ]}
              emptyLabel="Publishing guidance will appear here."
            />
          </TeacherSection>

          <TeacherSection eyebrow="Curriculum support" title="Gen-Mumins term plan reference">
            <TeacherInfoList
              items={genMProgrammes.map(
                (programme) => `${programme.title} • ${programme.focusTerms.join(" • ")}`,
              )}
              emptyLabel="Programme guidance will appear here."
            />
          </TeacherSection>
        </div>
      </div>
    </TeacherDashboardFrame>
  );
}
