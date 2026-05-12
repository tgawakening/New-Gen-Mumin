import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { TeacherInfoList, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { genMTerms, getGenMProgrammeByTitle, getGenMTeachersForProgramme, type GenMProgramSlug } from "@/lib/genm/curriculum";
import { buildLessonPayload, buildTaskPayload, parseLessonPayload, parseTaskPayload, type PublishedAttachment } from "@/lib/genm/published-content";
import { uploadTeacherMaterial } from "@/lib/google-drive/materials";
import type { TeacherDashboardData } from "@/lib/teacher/dashboard";

type BuilderTab = "overview" | "plan" | "lesson" | "task" | "materials";

type CourseBuilderWorkspaceProps = {
  dashboard: TeacherDashboardData;
  teacherUserId: string;
  success?: string;
  selectedProgrammeSlug?: GenMProgramSlug | null;
  activeTab?: BuilderTab;
};

const builderTabs: Array<{ id: BuilderTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "plan", label: "Publishing Plan" },
  { id: "lesson", label: "Publish Lesson" },
  { id: "task", label: "Assign Homework" },
  { id: "materials", label: "Materials Kit" },
];

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

function getUploadFiles(formData: FormData, fieldName: string) {
  return formData.getAll(fieldName).filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

async function uploadBuilderAttachments(input: {
  files: File[];
  programId: string;
  teacherUserId: string;
  folderName: string;
  titlePrefix: string;
}) {
  const attachments: PublishedAttachment[] = [];

  for (const file of input.files) {
    const uploaded = await uploadTeacherMaterial({
      programId: input.programId,
      teacherUserId: input.teacherUserId,
      title: `${input.titlePrefix} - ${file.name}`,
      folderName: input.folderName,
      publishToStudents: true,
      file,
    });

    attachments.push({
      id: uploaded.id,
      name: uploaded.name,
      url: uploaded.webViewLink ?? null,
      mimeType: uploaded.mimeType ?? file.type ?? null,
      thumbnailUrl: uploaded.thumbnailLink ?? null,
    });
  }

  return attachments;
}

function getProgrammeTeachingCapabilities(programmeSlug: GenMProgramSlug) {
  if (programmeSlug === "arabic") {
    return [
      "Update textbook progress across Al-Arabiyyah Bayna Yaday Awladina books 1-6.",
      "Publish weekly vocabulary decks, speaking games, and writing prompts.",
      "Track reading, dialogue practice, and simple presentation readiness.",
    ];
  }

  if (programmeSlug === "tajweed") {
    return [
      "Publish recitation targets, listening tasks, and rule-practice homework.",
      "Highlight makharij, noon saakin, madd, and fluency goals by term.",
      "Keep memorisation and pronunciation correction visible to families.",
    ];
  }

  if (programmeSlug === "seerah") {
    return [
      "Post weekly Seerah stories, reflection prompts, and child-friendly activities.",
      "Publish craft ideas, timeline work, and discussion questions for families.",
      "Keep behaviour and leadership lessons linked to the weekly story focus.",
    ];
  }

  return [
    "Publish first-aid, gardening, and life-skills project briefs clearly each week.",
    "List tools, materials, and home follow-up tasks for parents and students.",
    "Track practical demonstrations, confidence tasks, and leadership activities.",
  ];
}

export function CourseBuilderWorkspace({
  dashboard,
  teacherUserId,
  success,
  selectedProgrammeSlug = null,
  activeTab = "overview",
}: CourseBuilderWorkspaceProps) {
  const selectedRoster = selectedProgrammeSlug
    ? dashboard.rosters.find((roster) => getGenMProgrammeByTitle(roster.title)?.slug === selectedProgrammeSlug) ?? null
    : null;

  const visibleRosters = selectedRoster ? [selectedRoster] : dashboard.rosters;
  const visibleProgramIds = new Set(visibleRosters.map((roster) => roster.programId));
  const visibleClasses = dashboard.classes.filter((entry) => visibleProgramIds.has(entry.programId));
  const visibleAssignments = dashboard.assignments.filter((entry) => visibleProgramIds.has(entry.programId));
  const visibleLessons = dashboard.lessonLogs.filter((entry) =>
    visibleClasses.some((course) => course.title === entry.title),
  );

  const selectedProgramme = selectedRoster ? getGenMProgrammeByTitle(selectedRoster.title) : null;
  const successRedirectPath = selectedProgrammeSlug ? `/teacher/course-builder/${selectedProgrammeSlug}` : "/teacher/course-builder";
  const programmeTeachers = selectedRoster ? getGenMTeachersForProgramme(selectedRoster.title) : [];
  const tabBaseHref = selectedProgrammeSlug ? `/teacher/course-builder/${selectedProgrammeSlug}` : "/teacher/course-builder";

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
    const attachmentFiles = getUploadFiles(formData, "lessonFiles");

    if (!scheduleId || !lessonDateRaw || !topic || !summary) {
      throw new Error("Please complete class, lesson date, topic, and summary before publishing.");
    }

    const schedule = dashboard.classes.find((entry) => entry.id === scheduleId);
    if (!schedule) throw new Error("Choose a valid class schedule.");
    const attachments = await uploadBuilderAttachments({
      files: attachmentFiles,
      programId: schedule.programId,
      teacherUserId,
      folderName: ["Lessons", weekLabel || topic].filter(Boolean).join(" / "),
      titlePrefix: weekLabel || topic,
    });

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
          attachments,
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
    redirect(`${successRedirectPath}?tab=lesson&success=lesson`);
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
    const attachmentFiles = getUploadFiles(formData, "taskFiles");

    if (!programId || !title || !instructions) {
      throw new Error("Please complete programme, task title, and instructions before publishing.");
    }

    const attachments = await uploadBuilderAttachments({
      files: attachmentFiles,
      programId,
      teacherUserId,
      folderName: ["Tasks", weekLabel || title].filter(Boolean).join(" / "),
      titlePrefix: weekLabel || title,
    });

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
          attachments,
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
    redirect(`${successRedirectPath}?tab=task&success=task`);
  }

  async function reviewSubmissionAction(formData: FormData) {
    "use server";

    const session = await getCurrentSession();
    if (!session || session.user.role !== "TEACHER") redirect("/auth/login");
    const submissionId = String(formData.get("submissionId") || "");
    const reviewStatus = String(formData.get("reviewStatus") || "REVIEWED");
    const scoreRaw = String(formData.get("score") || "");
    const feedback = String(formData.get("feedback") || "").trim();
    const grade = String(formData.get("grade") || "");

    const submission = await db.assignmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        assignment: {
          include: {
            program: {
              include: {
                teacherAssignments: {
                  include: { teacher: true },
                },
              },
            },
          },
        },
        student: { include: { user: true } },
      },
    });
    if (!submission || !submission.assignment.program.teacherAssignments.some(({ teacher }) => teacher.userId === session.user.id)) {
      throw new Error("Submission is not available for this teacher.");
    }

    const reviewed = await db.assignmentSubmission.update({
      where: { id: submission.id },
      data: {
        status: reviewStatus === "PENDING" ? "SUBMITTED" : "REVIEWED",
        grade: grade ? (grade as "EXCELLENT" | "GOOD" | "SATISFACTORY" | "NEEDS_IMPROVEMENT") : null,
        score: scoreRaw ? Number(scoreRaw) : null,
        feedback: feedback || null,
        reviewedByUserId: session.user.id,
      },
    });

    await db.notification.create({
      data: {
        userId: submission.student.user.id,
        title: "Task reviewed",
        body: `${submission.assignment.title} was marked ${reviewed.status.toLowerCase().replace(/_/g, " ")}${reviewed.score === null ? "." : ` with score ${reviewed.score}.`}`,
        href: "/student/courses",
      },
    });

    revalidatePath("/teacher/course-builder");
    revalidatePath("/student/courses");
    redirect(`${successRedirectPath}?tab=task&success=task`);
  }

  return (
    <div className="space-y-6">
      <ActionToast
        message={
          success === "lesson"
            ? "Lesson content published with resources."
            : success === "task"
              ? "Student task published with resources."
              : undefined
        }
      />

      <TeacherSection eyebrow="Programme map" title={selectedProgramme ? `${selectedProgramme.title} builder` : "Choose your programme workspace"}>
        {selectedProgramme ? (
          <div className="space-y-5">
            <div className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-semibold text-[#22304a]">{selectedProgramme.title}</h3>
                  <p className="mt-2 text-sm font-medium text-[#c27a2c]">{selectedProgramme.strapline}</p>
                  <p className="mt-3 max-w-4xl text-sm leading-7 text-[#5f6b7a]">{selectedProgramme.description}</p>
                </div>
                <div className="rounded-[18px] bg-white px-4 py-3 text-sm text-[#5f6b7a]">
                  <span className="font-semibold text-[#22304a]">{selectedRoster?.students.length ?? 0}</span> learners
                  <br />
                  <span className="font-semibold text-[#22304a]">{visibleAssignments.length}</span> published tasks
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                {builderTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <Link
                      key={tab.id}
                      href={`${tabBaseHref}?tab=${tab.id}`}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        isActive ? "bg-[#22304a] text-white" : "bg-white text-[#2a76aa] hover:bg-[#eef5fb]"
                      }`}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {visibleRosters.map((roster) => {
              const programme = getGenMProgrammeByTitle(roster.title);
              const teachers = getGenMTeachersForProgramme(roster.title);

              return (
                <div key={roster.programId} className="rounded-[24px] bg-[#fbf6ef] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-[#22304a]">{roster.title}</h3>
                      {programme?.strapline ? <p className="mt-2 text-sm font-medium text-[#c27a2c]">{programme.strapline}</p> : null}
                    </div>
                    <Link
                      href={`/teacher/course-builder/${programme?.slug ?? ""}`}
                      className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#2a76aa]"
                    >
                      Open workspace
                    </Link>
                  </div>
                  {programme?.description ? <p className="mt-3 text-sm leading-7 text-[#5f6b7a]">{programme.description}</p> : null}
                  <div className="mt-4 rounded-[18px] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Teacher team</p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                      {teachers.map((teacher) => (
                        <li key={teacher.slug}>- {teacher.name} - {teacher.title}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </TeacherSection>

      {selectedProgramme ? (
        <>
          {activeTab === "overview" ? (
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
                <div className="space-y-3">
                  {visibleAssignments.slice(0, 6).map((task) => {
                    const parsed = parseTaskPayload(task.instructions);
                    const due = task.dueDate ? task.dueDate.toLocaleDateString("en-GB") : "No due date";
                    const label = parsed.weekLabel ? `${parsed.weekLabel} - ` : "";
                    return (
                      <details key={task.id} className="rounded-[18px] bg-[#fbf6ef] p-4">
                        <summary className="cursor-pointer text-sm font-semibold text-[#22304a]">
                          {task.programTitle} - {label}{task.title} - {task.submissions} submissions - {due}
                        </summary>
                        <div className="mt-3 space-y-2">
                          {task.submissionDetails.map((submission) => (
                            <div key={submission.id} className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-[#4d5a6b]">
                              <p className="font-semibold text-[#22304a]">{submission.studentName}</p>
                              <p>Status: {submission.status} {submission.submittedAt ? `- ${submission.submittedAt.toLocaleDateString("en-GB")}` : ""}</p>
                              <p>Score: {submission.score ?? "Pending"} {submission.grade ? `- ${submission.grade}` : ""}</p>
                              {submission.feedback ? <p>Feedback: {submission.feedback}</p> : null}
                            </div>
                          ))}
                          {!task.submissionDetails.length ? (
                            <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#6b7482]">No submissions yet.</p>
                          ) : null}
                        </div>
                      </details>
                    );
                  })}
                  {!visibleAssignments.length ? (
                    <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">Published tasks will appear here.</p>
                  ) : null}
                </div>
              </TeacherSection>

              <TeacherSection eyebrow="Teacher team" title="Who is coordinating this programme">
                <TeacherInfoList
                  items={programmeTeachers.map((teacher) => `${teacher.name} - ${teacher.title} - ${teacher.credential}`)}
                  emptyLabel="Teacher assignments will appear here."
                />
              </TeacherSection>

              <TeacherSection eyebrow="Teacher focus" title="What to keep active in this builder">
                <TeacherInfoList
                  items={getProgrammeTeachingCapabilities(selectedProgramme.slug)}
                  emptyLabel="Teaching guidance will appear here."
                />
              </TeacherSection>
            </div>
          ) : null}

          {activeTab === "plan" ? (
            <TeacherSection eyebrow="Publishing plan" title={`${selectedProgramme.title} term-by-term publishing plan`}>
              <div className="space-y-5">
                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-[18px] bg-[#fbf6ef] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Teacher team</p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                      {programmeTeachers.map((teacher) => (
                        <li key={teacher.slug}>- {teacher.name} - {teacher.title}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-[18px] bg-[#fbf6ef] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Upload focus</p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                      {selectedProgramme.uploadIdeas.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-[18px] bg-[#fbf6ef] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Learning outcomes</p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                      {selectedProgramme.outcomes.map((item) => (
                        <li key={item}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-3">
                  {genMTerms.map((term) => {
                    const highlights =
                      selectedProgramme.slug === "arabic"
                        ? term.arabic
                        : selectedProgramme.slug === "tajweed"
                          ? term.tajweed
                          : selectedProgramme.slug === "seerah"
                            ? term.seerah
                            : term.lifeSkills;

                    return (
                      <details key={term.id} className="rounded-[18px] border border-[#eadfce] bg-white p-4" open={term.id === "term-1"}>
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
            </TeacherSection>
          ) : null}

          {activeTab === "lesson" ? (
            <TeacherSection eyebrow="Weekly content" title="Publish a lesson with resources">
              <form action={publishLessonContent} className="grid gap-4">
                <div className="rounded-[20px] border border-[#d9e7f2] bg-[#f5fbff] p-4 text-sm leading-7 text-[#4d5a6b]">
                  Add the weekly lesson update, then attach slides, images, PDFs, worksheets, or short videos. Uploaded files are saved in the programme Drive folder and shown inside the student course page.
                </div>
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
                    <input type="date" name="lessonDate" className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" required />
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

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                    Term
                    <select name="termId" className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]">
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
                    <input name="weekLabel" className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" placeholder="Week 5 - Cave Hira" />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                    Content type
                    <input name="contentType" className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" placeholder="Story, worksheet, listening task" />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                    Programme focus
                    <input
                      name="programmeFocus"
                      defaultValue={selectedProgramme.title}
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

                <div className="grid gap-4 md:grid-cols-2">
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
                </div>

                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Parent prompt
                  <textarea
                    name="parentPrompt"
                    rows={3}
                    className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]"
                    placeholder="How should parents follow up with this lesson at home?"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Lesson files
                  <div className="rounded-[18px] border border-dashed border-[#b9c6d6] bg-[#fbfdff] px-4 py-5">
                    <input
                      name="lessonFiles"
                      type="file"
                      multiple
                      accept="image/*,video/*,.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx"
                      className="w-full text-sm text-[#22304a] file:mr-4 file:rounded-full file:border-0 file:bg-[#2a76aa] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                    />
                    <p className="mt-2 text-xs font-normal text-[#617184]">Slides, PDFs, images, worksheets, docs, and short videos are supported.</p>
                  </div>
                </label>

                <button type="submit" className="inline-flex w-fit rounded-full bg-[#2a76aa] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245f88]">
                  Publish lesson update
                </button>
              </form>
            </TeacherSection>
          ) : null}

          {activeTab === "task" ? (
            <TeacherSection eyebrow="Student work" title="Assign a task with resources">
              <form action={publishStudentTask} className="grid gap-4">
                <input type="hidden" name="programId" value={selectedRoster?.programId ?? ""} />

                <div className="rounded-[18px] bg-[#fbf6ef] px-4 py-3 text-sm leading-7 text-[#5f6b7a]">
                  Publishing task for <span className="font-semibold text-[#22304a]">{selectedRoster?.title}</span>. Attach worksheets, examples, images, or files students need before starting.
                </div>

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
                    <input type="date" name="dueDate" className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                    Term
                    <select name="taskTermId" className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]">
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
                    <input name="taskWeekLabel" className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" placeholder="Week 5 practice task" />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                    Evidence mode
                    <select name="evidenceMode" className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]">
                      <option value="">Select evidence</option>
                      <option value="photo">Photo upload later</option>
                      <option value="video">Short video</option>
                      <option value="zoom">Live demonstration on Zoom</option>
                      <option value="verbal">Verbal explanation</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                    Task category
                    <input name="taskCategory" className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" placeholder="Worksheet, memorisation, recitation, project" />
                  </label>
                </div>

                <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                  Programme focus
                  <input
                    name="taskProgrammeFocus"
                    defaultValue={selectedProgramme.title}
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
                  Task files
                  <div className="rounded-[18px] border border-dashed border-[#b9c6d6] bg-[#fbfdff] px-4 py-5">
                    <input
                      name="taskFiles"
                      type="file"
                      multiple
                      accept="image/*,video/*,.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx"
                      className="w-full text-sm text-[#22304a] file:mr-4 file:rounded-full file:border-0 file:bg-[#22304a] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                    />
                    <p className="mt-2 text-xs font-normal text-[#617184]">Uploaded files are saved to Google Drive and shown with this task in the student LMS.</p>
                  </div>
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

                <button type="submit" className="inline-flex w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2740]">
                  Publish student task
                </button>
              </form>

              <div className="mt-8 border-t border-[#eadfce] pt-6">
                <h3 className="text-lg font-semibold text-[#22304a]">Submission tracker</h3>
                <div className="mt-4 space-y-3">
                  {visibleAssignments.map((task) => (
                    <details key={task.id} className="rounded-[18px] bg-[#fbf6ef] p-4">
                      <summary className="cursor-pointer text-sm font-semibold text-[#22304a]">
                        {task.title} - {task.submissions} submissions
                      </summary>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {task.submissionDetails.map((submission) => (
                          <div key={submission.id} className="rounded-2xl bg-white px-4 py-3 text-sm leading-6 text-[#4d5a6b]">
                            <p className="font-semibold text-[#22304a]">{submission.studentName}</p>
                            <p>Status: {submission.status}</p>
                            <p>Submitted: {submission.submittedAt ? submission.submittedAt.toLocaleDateString("en-GB") : "Not submitted"}</p>
                            <p>Score: {submission.score ?? "Pending"} {submission.grade ? `- ${submission.grade}` : ""}</p>
                            {submission.attachmentUrl ? <a href={submission.attachmentUrl} target="_blank" className="font-semibold text-[#2a76aa]">Open uploaded file</a> : null}
                            {submission.feedback ? <p>Feedback: {submission.feedback}</p> : null}
                            <form action={reviewSubmissionAction} className="mt-3 grid gap-2 rounded-2xl bg-[#fbf6ef] p-3">
                              <input type="hidden" name="submissionId" value={submission.id} />
                              <div className="grid gap-2 sm:grid-cols-3">
                                <select name="reviewStatus" className="rounded-xl border border-[#eadfce] px-3 py-2">
                                  <option value="REVIEWED">Complete</option>
                                  <option value="PENDING">Pending</option>
                                </select>
                                <select name="grade" defaultValue={submission.grade?.replace(/ /g, "_") ?? ""} className="rounded-xl border border-[#eadfce] px-3 py-2">
                                  <option value="">No grade</option>
                                  <option value="EXCELLENT">Excellent</option>
                                  <option value="GOOD">Good</option>
                                  <option value="SATISFACTORY">Satisfactory</option>
                                  <option value="NEEDS_IMPROVEMENT">Needs improvement</option>
                                </select>
                                <input name="score" type="number" min="0" placeholder="Score" defaultValue={submission.score ?? ""} className="rounded-xl border border-[#eadfce] px-3 py-2" />
                              </div>
                              <textarea name="feedback" rows={2} placeholder="Feedback for student" defaultValue={submission.feedback ?? ""} className="rounded-xl border border-[#eadfce] px-3 py-2" />
                              <button className="w-fit rounded-full bg-[#22304a] px-4 py-2 text-xs font-semibold text-white">Save review</button>
                            </form>
                          </div>
                        ))}
                        {!task.submissionDetails.length ? (
                          <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#6b7482]">No student submissions yet.</p>
                        ) : null}
                      </div>
                    </details>
                  ))}
                  {!visibleAssignments.length ? (
                    <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">Publish a task first, then submissions will appear here.</p>
                  ) : null}
                </div>
              </div>
            </TeacherSection>
          ) : null}

          {activeTab === "materials" ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <TeacherSection eyebrow="Materials kit" title={`${selectedProgramme.title} resources to prepare`}>
                <TeacherInfoList
                  items={selectedProgramme.keyMaterials}
                  emptyLabel="Programme materials will appear here."
                />
              </TeacherSection>

              <TeacherSection eyebrow="Weekly flow" title="How class delivery should move">
                <TeacherInfoList
                  items={selectedProgramme.weeklyFlow}
                  emptyLabel="Weekly flow guidance will appear here."
                />
              </TeacherSection>

              <TeacherSection eyebrow="Upload ideas" title="Useful content to publish for learners">
                <TeacherInfoList
                  items={selectedProgramme.uploadIdeas}
                  emptyLabel="Upload suggestions will appear here."
                />
              </TeacherSection>

              <TeacherSection eyebrow="Teacher focus" title="Practical capabilities for this programme">
                <TeacherInfoList
                  items={getProgrammeTeachingCapabilities(selectedProgramme.slug)}
                  emptyLabel="Teaching guidance will appear here."
                />
              </TeacherSection>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
