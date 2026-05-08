import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  TeacherInfoList,
  TeacherSection,
} from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { db } from "@/lib/db";
import {
  genMTerms,
  getGenMProgrammeByTitle,
  getGenMTeachersForProgramme,
  type GenMProgramSlug,
} from "@/lib/genm/curriculum";
import {
  buildLessonPayload,
  buildTaskPayload,
  parseLessonPayload,
  parseTaskPayload,
} from "@/lib/genm/published-content";
import type { TeacherDashboardData } from "@/lib/teacher/dashboard";

type CourseBuilderWorkspaceProps = {
  dashboard: TeacherDashboardData;
  teacherUserId: string;
  success?: string;
  selectedProgrammeSlug?: GenMProgramSlug | null;
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

export function CourseBuilderWorkspace({
  dashboard,
  teacherUserId,
  success,
  selectedProgrammeSlug = null,
}: CourseBuilderWorkspaceProps) {
  const selectedRoster = selectedProgrammeSlug
    ? dashboard.rosters.find((roster) => getGenMProgrammeByTitle(roster.title)?.slug === selectedProgrammeSlug) ?? null
    : null;

  const visibleRosters = selectedRoster ? [selectedRoster] : dashboard.rosters;
  const visibleProgramIds = new Set(visibleRosters.map((roster) => roster.programId));
  const visibleClasses = dashboard.classes.filter((entry) => visibleProgramIds.has(entry.programId));
  const visibleAssignments = dashboard.assignments.filter((entry) => visibleProgramIds.has(entry.programId));
  const visibleLessons = dashboard.lessonLogs.filter((entry) =>
    visibleClasses.some((course) => course.id === entry.id || course.title === entry.title),
  );

  const selectedProgramme = selectedRoster ? getGenMProgrammeByTitle(selectedRoster.title) : null;
  const successRedirectPath = selectedProgrammeSlug
    ? `/teacher/course-builder/${selectedProgrammeSlug}`
    : "/teacher/course-builder";

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

    const finalHomework =
      [homework, resourceLinks ? `Resources: ${resourceLinks}` : null].filter(Boolean).join("\n\n") || null;

    await db.lessonLog.create({
      data: {
        scheduleId,
        teacherUserId,
        lessonDate: new Date(lessonDateRaw),
        topic,
        summary: buildLessonPayload({
          topic,
          summary,
          instructorName: dashboard.teacherName,
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
    if (selectedProgrammeSlug) {
      revalidatePath(`/teacher/course-builder/${selectedProgrammeSlug}`);
    }
    revalidatePath("/parent");
    revalidatePath("/parent/courses");
    revalidatePath("/student");
    revalidatePath("/student/courses");
    redirect(`${successRedirectPath}?success=lesson`);
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
          instructorName: dashboard.teacherName,
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
    if (selectedProgrammeSlug) {
      revalidatePath(`/teacher/course-builder/${selectedProgrammeSlug}`);
    }
    revalidatePath("/parent");
    revalidatePath("/parent/courses");
    revalidatePath("/student");
    revalidatePath("/student/courses");
    redirect(`${successRedirectPath}?success=task`);
  }

  return (
    <div className="space-y-6">
        {success ? (
          <div className="rounded-[24px] border border-[#d9e7f2] bg-[#eff7ff] px-5 py-4 text-sm text-[#2a5d84]">
            {success === "lesson"
              ? "Lesson content published. Parent and student dashboards will now surface the update."
              : "Student task published. It should now appear in the family LMS and coursework views."}
          </div>
        ) : null}

        <TeacherSection eyebrow="Programme map" title={selectedProgramme ? `${selectedProgramme.title} builder` : "Your current teaching streams"}>
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleRosters.map((roster) => {
              const programme = getGenMProgrammeByTitle(roster.title);
              const teachers = getGenMTeachersForProgramme(roster.title);

              return (
                <div key={roster.programId} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-[#22304a]">{roster.title}</h3>
                      {programme?.strapline ? (
                        <p className="mt-2 text-sm font-medium text-[#c27a2c]">{programme.strapline}</p>
                      ) : null}
                    </div>
                    {!selectedProgrammeSlug ? (
                      <Link
                        href={`/teacher/course-builder/${programme?.slug ?? ""}`}
                        className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#2a76aa]"
                      >
                        Open workspace
                      </Link>
                    ) : null}
                  </div>
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
                          <li key={teacher.slug}>- {teacher.name} - {teacher.title}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[18px] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                        Upload focus
                      </p>
                      <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                        {(programme?.uploadIdeas ?? []).map((idea) => (
                          <li key={idea}>- {idea}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </TeacherSection>

        <TeacherSection
          eyebrow="Programme builders"
          title={selectedProgramme ? `${selectedProgramme.title} publishing plan` : "Structured builder lanes by programme"}
        >
          <div className="space-y-5">
            {visibleRosters.map((roster) => {
              const programme = getGenMProgrammeByTitle(roster.title);
              const teachers = getGenMTeachersForProgramme(roster.title);
              const relatedAssignments = visibleAssignments.filter((assignment) => assignment.programId === roster.programId);

              if (!programme) {
                return null;
              }

              return (
                <div key={`${roster.programId}-builder`} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-semibold text-[#22304a]">{programme.title}</h3>
                      <p className="mt-2 text-sm font-medium text-[#c27a2c]">{programme.strapline}</p>
                    </div>
                    <span className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#22304a]">
                      {roster.students.length} learners - {relatedAssignments.length} tasks
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-3">
                    <div className="rounded-[18px] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                        Teacher team
                      </p>
                      <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                        {teachers.map((teacher) => (
                          <li key={teacher.slug}>- {teacher.name} - {teacher.title}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-[18px] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                        Key materials
                      </p>
                      <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                        {programme.keyMaterials.slice(0, 6).map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-[18px] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                        Suggested uploads
                      </p>
                      <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                        {programme.uploadIdeas.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    {genMTerms.map((term) => {
                      const highlights =
                        programme.slug === "arabic"
                          ? term.arabic
                          : programme.slug === "tajweed"
                            ? term.tajweed
                            : programme.slug === "seerah"
                              ? term.seerah
                              : term.lifeSkills;

                      return (
                        <details key={`${roster.programId}-${term.id}`} className="rounded-[18px] bg-white p-4">
                          <summary className="cursor-pointer text-sm font-semibold text-[#22304a]">
                            {term.title} - {term.level} - {term.window}
                          </summary>
                          <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                            {highlights.map((highlight) => (
                              <li key={highlight}>- {highlight}</li>
                            ))}
                          </ul>
                        </details>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TeacherSection>

        <div className="grid gap-6 xl:grid-cols-2">
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
                {visibleClasses.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title} - {entry.startTime}-{entry.endTime}
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
                  defaultValue={selectedProgramme?.title ?? ""}
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
            {selectedRoster ? (
              <input type="hidden" name="programId" value={selectedRoster.programId} />
            ) : (
              <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                Programme
                <select
                  name="programId"
                  className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                  required
                >
                  <option value="">Select a programme</option>
                  {visibleRosters.map((roster) => (
                    <option key={roster.programId} value={roster.programId}>
                      {roster.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selectedRoster ? (
              <div className="rounded-[18px] bg-[#fbf6ef] px-4 py-3 text-sm text-[#5f6b7a]">
                Publishing task for <span className="font-semibold text-[#22304a]">{selectedRoster.title}</span>.
              </div>
            ) : null}

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
                defaultValue={selectedProgramme?.title ?? ""}
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

        <div className="grid gap-6 xl:grid-cols-2">
        <TeacherSection eyebrow="Recent publishing" title="Latest lesson updates">
          <TeacherInfoList
            items={visibleLessons.slice(0, 6).map((entry) => {
              const parsed = parseLessonPayload(entry.summary, entry.homework);
              const label = parsed.weekLabel ? `${parsed.weekLabel} - ` : "";
              return `${entry.title} - ${label}${parsed.topic || entry.topic} - ${entry.lessonDate.toLocaleDateString("en-GB")}`;
            })}
            emptyLabel="Published lesson updates will appear here."
          />
        </TeacherSection>

        <TeacherSection eyebrow="Tasks" title="Recent assignments">
          <TeacherInfoList
            items={visibleAssignments.slice(0, 6).map((task) => {
              const parsed = parseTaskPayload(task.instructions);
              const due = task.dueDate ? task.dueDate.toLocaleDateString("en-GB") : "No due date";
              const label = parsed.weekLabel ? `${parsed.weekLabel} - ` : "";
              return `${task.programTitle} - ${label}${task.title} - ${task.submissions} submissions - ${due}`;
            })}
            emptyLabel="Published tasks will appear here."
          />
        </TeacherSection>
        </div>
    </div>
  );
}
