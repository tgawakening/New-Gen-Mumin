import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BookOpen, ClipboardList, Edit3, FileText, HelpCircle, Layers, PenSquare, PlusCircle, Trash2, Video } from "lucide-react";

import { ActionToast } from "@/components/dashboard/ActionToast";
import { FormSubmitButton } from "@/components/dashboard/FormSubmitButton";
import { TeacherInfoList, TeacherSection } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { QuizQuestionBuilderClient } from "@/components/dashboard/teacher/QuizQuestionBuilderClient";
import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { genMTerms, getGenMProgrammeByTitle, getGenMTeachersForProgramme, type GenMProgramSlug } from "@/lib/genm/curriculum";
import { buildLessonPayload, buildTaskPayload, parseLessonPayload, parseTaskPayload, type PublishedAttachment } from "@/lib/genm/published-content";
import { uploadTeacherMaterial } from "@/lib/google-drive/materials";
import { requestTeacherLiveClass } from "@/lib/live-classes/service";
import type { TeacherDashboardData } from "@/lib/teacher/dashboard";

type BuilderTab = "overview" | "plan" | "lesson" | "task" | "materials";

type CourseBuilderWorkspaceProps = {
  dashboard: TeacherDashboardData;
  teacherUserId: string;
  success?: string;
  selectedProgrammeSlug?: GenMProgramSlug | null;
  activeTab?: BuilderTab;
  prefillWeekLabel?: string;
  prefillTopic?: string;
  prefillTermId?: string;
  lessonId?: string;
  lessonComposer?: boolean;
  quizComposer?: boolean;
  taskComposer?: boolean;
  liveComposer?: boolean;
  materialComposer?: boolean;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMEZONES = ["Europe/London", "Asia/Karachi", "Asia/Dubai", "Asia/Riyadh", "America/New_York", "America/Toronto", "UTC"];

const builderTabs: Array<{ id: BuilderTab; label: string; icon: typeof Layers }> = [
  { id: "overview", label: "Overview", icon: Layers },
  { id: "plan", label: "Curriculum", icon: BookOpen },
  { id: "task", label: "Assign Homework", icon: ClipboardList },
  { id: "materials", label: "Materials Kit", icon: PlusCircle },
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
  purpose?: "material" | "lesson" | "task";
}) {
  const attachments: PublishedAttachment[] = [];

  for (const file of input.files) {
    const uploaded = await uploadTeacherMaterial({
      programId: input.programId,
      teacherUserId: input.teacherUserId,
      title: `${input.titlePrefix} - ${file.name}`,
      folderName: input.folderName,
      publishToStudents: true,
      purpose: input.purpose,
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

function getProgrammeHighlights(programmeSlug: GenMProgramSlug, term: (typeof genMTerms)[number]) {
  if (programmeSlug === "arabic") return term.arabic;
  if (programmeSlug === "tajweed") return term.tajweed;
  if (programmeSlug === "seerah") return term.seerah;
  return term.lifeSkills;
}

export function CourseBuilderWorkspace({
  dashboard,
  teacherUserId,
  success,
  selectedProgrammeSlug = null,
  activeTab = "overview",
  prefillWeekLabel,
  prefillTopic,
  prefillTermId,
  lessonId,
  lessonComposer = false,
  quizComposer = false,
  taskComposer = false,
  liveComposer = false,
  materialComposer = false,
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
  const parsedVisibleLessons = visibleLessons.map((entry) => ({
    entry,
    parsed: parseLessonPayload(entry.summary, entry.homework),
  }));
  const editingLesson = lessonId
    ? parsedVisibleLessons.find(({ entry }) => entry.id === lessonId)
    : null;

  const selectedProgramme = selectedRoster ? getGenMProgrammeByTitle(selectedRoster.title) : null;
  const successRedirectPath = selectedProgrammeSlug ? `/teacher/course-builder/${selectedProgrammeSlug}` : "/teacher/course-builder";
  const programmeTeachers = selectedRoster ? getGenMTeachersForProgramme(selectedRoster.title) : [];
  const tabBaseHref = selectedProgrammeSlug ? `/teacher/course-builder/${selectedProgrammeSlug}` : "/teacher/course-builder";
  const selectedProgramId = selectedRoster?.programId ?? visibleRosters[0]?.programId ?? "";

  const normalizedActiveTab = activeTab === "lesson" ? "plan" : activeTab;

  function buildBuilderHref(tab: BuilderTab, options?: { weekLabel?: string; topic?: string; termId?: string; lessonId?: string; lessonComposer?: boolean; quizComposer?: boolean; taskComposer?: boolean; liveComposer?: boolean; materialComposer?: boolean }) {
    const query = new URLSearchParams({ tab });
    if (options?.weekLabel) query.set("weekLabel", options.weekLabel);
    if (options?.topic) query.set("topic", options.topic);
    if (options?.termId) query.set("termId", options.termId);
    if (options?.lessonId) query.set("lessonId", options.lessonId);
    if (options?.lessonComposer) query.set("lessonComposer", "1");
    if (options?.quizComposer) query.set("quizComposer", "1");
    if (options?.taskComposer) query.set("taskComposer", "1");
    if (options?.liveComposer) query.set("liveComposer", "1");
    if (options?.materialComposer) query.set("materialComposer", "1");
    return `${tabBaseHref}?${query.toString()}`;
  }

  async function publishLessonContent(formData: FormData) {
    "use server";

    const scheduleId = String(formData.get("scheduleId") || "");
    const lessonDateRaw = String(formData.get("lessonDate") || "");
    const topic = String(formData.get("topic") || "").trim();
    const summary = String(formData.get("summary") || "").trim();
    const homework = cleanOptional(formData.get("homework"));
    const resourceLinks = cleanOptional(formData.get("resourceLinks"));
    const videoUrl = cleanOptional(formData.get("videoUrl"));
    const weekLabel = cleanOptional(formData.get("weekLabel"));
    const termId = cleanOptional(formData.get("termId"));
    const lessonLogId = cleanOptional(formData.get("lessonLogId"));
    const lessonObjective = cleanOptional(formData.get("lessonObjective"));
    const thumbnailFiles = getUploadFiles(formData, "thumbnailFile");
    const videoFiles = getUploadFiles(formData, "videoFile");
    const attachmentFiles = getUploadFiles(formData, "lessonFiles");

    if (!scheduleId || !lessonDateRaw || !topic || !summary) {
      throw new Error("Please complete class, lesson date, topic, and summary before publishing.");
    }

    const schedule = dashboard.classes.find((entry) => entry.id === scheduleId);
    if (!schedule) throw new Error("Choose a valid class schedule.");
    const lessonFolderName = ["Lessons", weekLabel || topic].filter(Boolean).join(" / ");
    const attachments = [
      ...(await uploadBuilderAttachments({
        files: thumbnailFiles,
        programId: schedule.programId,
        teacherUserId,
        folderName: `${lessonFolderName} / Thumbnail`,
        titlePrefix: `${weekLabel || topic} thumbnail`,
        purpose: "lesson",
      })),
      ...(await uploadBuilderAttachments({
        files: videoFiles,
        programId: schedule.programId,
        teacherUserId,
        folderName: `${lessonFolderName} / Video`,
        titlePrefix: `${weekLabel || topic} video`,
        purpose: "lesson",
      })),
      ...(await uploadBuilderAttachments({
        files: attachmentFiles,
        programId: schedule.programId,
        teacherUserId,
        folderName: lessonFolderName,
        titlePrefix: weekLabel || topic,
        purpose: "lesson",
      })),
    ];

    const combinedResourceLinks = [videoUrl, resourceLinks].filter(Boolean).join("\n");
    const finalHomework =
      [homework, combinedResourceLinks ? `Resources: ${combinedResourceLinks}` : null].filter(Boolean).join("\n\n") || null;

    const lessonPayload = {
      scheduleId,
      teacherUserId,
      lessonDate: new Date(lessonDateRaw),
      topic,
      summary: buildLessonPayload({
        topic,
        summary,
        instructorName: dashboard.teacherName,
        programmeFocus: selectedProgramme?.title,
        lessonObjective,
        homework,
        resourceLinks: splitLinks(combinedResourceLinks),
        parentPrompt: null,
        weekLabel,
        termId,
        contentType: "Lesson",
        materials: null,
        attachments,
      }),
      homework: finalHomework,
    };

    if (lessonLogId) {
      const existing = await db.lessonLog.findFirst({
        where: {
          id: lessonLogId,
          teacherUserId,
        },
      });
      if (!existing) throw new Error("Lesson is not available for this teacher.");
      await db.lessonLog.update({
        where: { id: lessonLogId },
        data: lessonPayload,
      });
    } else {
      await db.lessonLog.create({ data: lessonPayload });
    }

    revalidatePath("/teacher");
    revalidatePath("/teacher/course-builder");
    if (selectedProgrammeSlug) {
      revalidatePath(`/teacher/course-builder/${selectedProgrammeSlug}`);
    }
    revalidatePath("/parent");
    revalidatePath("/parent/courses");
    revalidatePath("/student");
    revalidatePath("/student/courses");
    redirect(`${successRedirectPath}?tab=plan&success=${lessonLogId ? "lesson_updated" : "lesson"}`);
  }

  async function deleteLessonAction(formData: FormData) {
    "use server";

    const session = await getCurrentSession();
    if (!session || session.user.role !== "TEACHER") redirect("/auth/login");
    const id = String(formData.get("lessonLogId") || "");
    const existing = await db.lessonLog.findFirst({
      where: { id, teacherUserId: session.user.id },
    });
    if (existing) {
      await db.lessonLog.delete({ where: { id } });
    }
    revalidatePath("/teacher/course-builder");
    if (selectedProgrammeSlug) revalidatePath(`/teacher/course-builder/${selectedProgrammeSlug}`);
    revalidatePath("/student/courses");
    revalidatePath("/parent/courses");
    redirect(`${successRedirectPath}?tab=plan&success=lesson_deleted`);
  }

  async function createCurriculumLiveSessionAction(formData: FormData) {
    "use server";

    const session = await getCurrentSession();
    if (!session || session.user.role !== "TEACHER") redirect("/auth/login");

    const schedule = await requestTeacherLiveClass(
      {
        programId: String(formData.get("programId") || ""),
        title: String(formData.get("title") || ""),
        weekday: Number(formData.get("weekday") || 0),
        startTime: String(formData.get("startTime") || "16:00"),
        endTime: String(formData.get("endTime") || "17:00"),
        timezone: String(formData.get("timezone") || "Europe/London"),
        createZoomMeeting: true,
      },
      session.user.id,
    );

    revalidatePath("/teacher/live-sessions");
    revalidatePath("/teacher/course-builder");
    if (selectedProgrammeSlug) {
      revalidatePath(`/teacher/course-builder/${selectedProgrammeSlug}`);
    }
    revalidatePath("/admin/classes");
    revalidatePath("/student/schedule");
    revalidatePath("/parent/schedule");
    redirect(`${successRedirectPath}?tab=plan&success=${schedule.meetingUrl ? "live" : "live_pending"}`);
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
    const returnTab = String(formData.get("returnTab") || "task") === "plan" ? "plan" : "task";
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
      purpose: "task",
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
    redirect(`${successRedirectPath}?tab=${returnTab}&success=task`);
  }

  async function uploadMaterialKitAction(formData: FormData) {
    "use server";

    const session = await getCurrentSession();
    if (!session || session.user.role !== "TEACHER") redirect("/auth/login");

    const programId = String(formData.get("programId") || "");
    const title = String(formData.get("title") || "").trim();
    const folderName = String(formData.get("folderName") || "Materials Kit").trim();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0 || !programId) {
      redirect(`${successRedirectPath}?tab=materials&success=material_error`);
    }

    await uploadTeacherMaterial({
      programId,
      teacherUserId: session.user.id,
      title: title || file.name,
      folderName: folderName || "Materials Kit",
      publishToStudents: formData.get("publishToStudents") === "on",
      file,
    });

    revalidatePath("/teacher/materials");
    revalidatePath("/admin/materials");
    revalidatePath("/student/courses");
    revalidatePath("/parent/courses");
    redirect(`${successRedirectPath}?tab=materials&success=material`);
  }

  async function createCurriculumQuizAction(formData: FormData) {
    "use server";

    const session = await getCurrentSession();
    if (!session || session.user.role !== "TEACHER") redirect("/auth/login");
    const teacher = await db.teacherProfile.findUnique({
      where: { userId: session.user.id },
      include: { programAssignments: true },
    });
    if (!teacher) redirect("/teacher-registration");

    const programId = String(formData.get("programId") || "");
    if (!teacher.programAssignments.some((assignment) => assignment.programId === programId)) {
      throw new Error("You can only create quizzes for assigned programmes.");
    }

    const title = String(formData.get("title") || "").trim();
    if (!title) throw new Error("Quiz title is required.");
    const weekLabel = cleanOptional(formData.get("weekLabel"));
    const topic = cleanOptional(formData.get("topic"));
    const description = [
      weekLabel ? `Week: ${weekLabel}` : null,
      topic ? `Lesson/topic: ${topic}` : null,
      cleanOptional(formData.get("description")),
    ].filter(Boolean).join("\n");

    const quiz = await db.quiz.create({
      data: {
        programId,
        title,
        description: description || null,
        type: String(formData.get("type") || "POST_LESSON") as "PRE_LESSON" | "POST_LESSON",
        isPublished: formData.get("isPublished") === "on",
        timeLimitSeconds: Number(formData.get("timeLimitMinutes") || 0) > 0 ? Number(formData.get("timeLimitMinutes")) * 60 : null,
      },
    });

    for (let index = 1; index <= 10; index += 1) {
      const prompt = String(formData.get(`question-${index}`) || "").trim();
      if (!prompt) continue;
      const answer = String(formData.get(`answer-${index}`) || "").trim();
      const choices = String(formData.get(`choices-${index}`) || "")
        .split(/\n|,/)
        .map((choice) => choice.trim())
        .filter(Boolean);

      await db.quizQuestion.create({
        data: {
          quizId: quiz.id,
          prompt,
          type: String(formData.get(`type-${index}`) || "MCQ") as "MCQ" | "TRUE_FALSE" | "SHORT_ANSWER" | "FILL_IN_BLANK",
          points: Math.max(1, Number(formData.get(`points-${index}`) || 1)),
          sortOrder: index,
          answerKey: answer ? { answer } : undefined,
          meta: choices.length ? { choices } : undefined,
        },
      });
    }

    revalidatePath("/teacher/quizzes");
    revalidatePath("/student/quizzes");
    redirect(`${successRedirectPath}?tab=plan&success=quiz`);
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
            : success === "lesson_updated"
              ? "Lesson updated successfully."
              : success === "lesson_deleted"
                ? "Lesson deleted successfully."
            : success === "task"
              ? "Student task published with resources."
              : success === "quiz"
                ? "Quiz created and linked to this curriculum topic."
                : success === "live"
                  ? "Recurring Zoom live session created for this topic."
                  : success === "live_pending"
                    ? "Session saved successfully. Zoom join link is pending admin sync."
                    : success === "material"
                      ? "Material kit file uploaded successfully."
                      : success === "material_error"
                        ? "Please choose a file before uploading material."
              : undefined
        }
        tone={success === "material_error" ? "error" : "success"}
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
                  const isActive = normalizedActiveTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <Link
                      key={tab.id}
                      href={`${tabBaseHref}?tab=${tab.id}`}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                        isActive ? "bg-[#22304a] text-white" : "bg-white text-[#2a76aa] hover:bg-[#eef5fb]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
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
          {normalizedActiveTab === "overview" ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <TeacherSection eyebrow="Course builder" title="Build this programme from one place">
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "Curriculum", href: buildBuilderHref("plan"), icon: BookOpen, body: "View term plans, week focus, and lesson actions." },
                    { label: "Create lesson", href: buildBuilderHref("plan", { lessonComposer: true }), icon: FileText, body: "Publish title, summary, thumbnail/video links, and files." },
                    { label: "Assign task", href: buildBuilderHref("task"), icon: ClipboardList, body: "Create homework with Drive resources and submission tracking." },
                    { label: "Quiz builder", href: `/teacher/quizzes/create?programId=${selectedProgramId}`, icon: HelpCircle, body: "Create checks linked to this programme." },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.label} href={item.href} className="rounded-[20px] bg-[#fbf6ef] p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
                        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#c27a2c]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <p className="mt-3 font-semibold text-[#22304a]">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-[#617184]">{item.body}</p>
                      </Link>
                    );
                  })}
                </div>
              </TeacherSection>

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

          {normalizedActiveTab === "plan" ? (
            <TeacherSection eyebrow="Publishing plan" title={`${selectedProgramme.title} term-by-term publishing plan`}>
              <div className="space-y-4">
                <div className="grid gap-3 rounded-[18px] bg-[#fbf6ef] p-3 text-sm text-[#5f6b7a] md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c27a2c]">Team</p>
                    <p className="mt-1 font-semibold text-[#22304a]">{programmeTeachers.length} teachers</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c27a2c]">Upload focus</p>
                    <p className="mt-1 line-clamp-1">{selectedProgramme.uploadIdeas.slice(0, 2).join(", ")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#c27a2c]">Goal</p>
                    <p className="mt-1 line-clamp-1">{selectedProgramme.outcomes[0]}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {genMTerms.map((term) => {
                    const highlights = getProgrammeHighlights(selectedProgramme.slug, term);
                    const termLessons = parsedVisibleLessons.filter(({ parsed }) => parsed.termId === term.id);

                    return (
                      <details key={term.id} className="rounded-[18px] border border-[#eadfce] bg-white p-4" open={term.id === "term-1"}>
                        <summary className="cursor-pointer list-none text-sm font-semibold text-[#22304a] [&::-webkit-details-marker]:hidden">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span>Modules / Chapters / Weeks - {term.title} - {term.level} - {term.window}</span>
                            <Link href={buildBuilderHref("plan", { weekLabel: `${term.title} New Week`, topic: "New weekly topic", termId: term.id, lessonComposer: true })} className="inline-flex items-center gap-2 rounded-full bg-[#22304a] px-3 py-2 text-xs font-semibold text-white">
                              <PlusCircle className="h-3.5 w-3.5" /> Add week/topic
                            </Link>
                          </div>
                        </summary>
                        <div className="mt-4 space-y-3">
                          {highlights.map((highlight, index) => {
                            const weekLabel = `${term.title} Week ${index + 1}`;
                            const weekLessons = termLessons.filter(({ parsed }) => parsed.weekLabel === weekLabel);
                            return (
                              <details key={highlight} className="rounded-[16px] border border-[#f0e5d7] bg-[#fffaf5] px-4 py-3" open={index === 0}>
                                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c27a2c]">{weekLabel}</p>
                                      <h4 className="mt-1 text-sm font-semibold text-[#22304a] sm:text-base">{highlight}</h4>
                                      <p className="mt-1 text-xs text-[#617184]">{weekLessons.length} lesson{weekLessons.length === 1 ? "" : "s"} published under this week</p>
                                    </div>
                                    <Link href={buildBuilderHref("plan", { weekLabel, topic: highlight, termId: term.id, lessonComposer: true })} title="Add lesson" className="inline-flex items-center gap-2 rounded-full bg-[#2a76aa] px-3 py-2 text-xs font-semibold text-white">
                                      <PlusCircle className="h-3.5 w-3.5" /> Add lesson
                                    </Link>
                                  </div>
                                </summary>

                                <div className="mt-3 space-y-2">
                                  {weekLessons.map(({ entry, parsed }) => {
                                    const lessonTopic = parsed.topic || entry.topic || highlight;
                                    return (
                                      <div key={entry.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-[#4d5a6b]">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="font-semibold text-[#22304a]">{lessonTopic}</p>
                                            <p className="mt-1 line-clamp-1 text-xs text-[#617184]">{parsed.summary || "Lesson content added."}</p>
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            <Link href={buildBuilderHref("plan", { weekLabel, topic: lessonTopic, termId: term.id, lessonId: entry.id, lessonComposer: true })} title="Edit lesson" className="inline-flex items-center gap-1 rounded-full bg-[#fff7eb] px-3 py-1.5 text-xs font-semibold text-[#8a6326]">
                                              <Edit3 className="h-3.5 w-3.5" /> Edit
                                            </Link>
                                            <Link href={buildBuilderHref("plan", { weekLabel, topic: lessonTopic, termId: term.id, quizComposer: true })} className="inline-flex items-center gap-1 rounded-full bg-[#eef5fb] px-3 py-1.5 text-xs font-semibold text-[#2a76aa]">
                                              <HelpCircle className="h-3.5 w-3.5" /> Quiz
                                            </Link>
                                            <Link href={buildBuilderHref("plan", { weekLabel, topic: lessonTopic, termId: term.id, liveComposer: true })} className="inline-flex items-center gap-1 rounded-full bg-[#eef5fb] px-3 py-1.5 text-xs font-semibold text-[#2a76aa]">
                                              <Video className="h-3.5 w-3.5" /> Live
                                            </Link>
                                            <Link href={buildBuilderHref("plan", { weekLabel, topic: lessonTopic, termId: term.id, taskComposer: true })} className="inline-flex items-center gap-1 rounded-full bg-[#eef5fb] px-3 py-1.5 text-xs font-semibold text-[#2a76aa]">
                                              <PenSquare className="h-3.5 w-3.5" /> Task
                                            </Link>
                                            <form action={deleteLessonAction}>
                                              <input type="hidden" name="lessonLogId" value={entry.id} />
                                              <FormSubmitButton pendingLabel="Deleting..." className="inline-flex items-center gap-1 rounded-full bg-[#fff4f4] px-3 py-1.5 text-xs font-semibold text-[#b24646] transition disabled:opacity-60">
                                                <Trash2 className="h-3.5 w-3.5" /> Delete
                                              </FormSubmitButton>
                                            </form>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {!weekLessons.length ? (
                                    <p className="rounded-2xl bg-white px-4 py-3 text-sm text-[#617184]">No lessons yet. Use Add lesson to publish the first lesson for this week.</p>
                                  ) : null}
                                </div>
                              </details>
                            );
                          })}

                          {termLessons.filter(({ parsed }) => parsed.weekLabel && !highlights.some((_, index) => parsed.weekLabel === `${term.title} Week ${index + 1}`)).map(({ entry, parsed }) => {
                            const lessonTopic = parsed.topic || entry.topic || "Custom lesson";
                            return (
                              <details key={entry.id} className="rounded-[16px] border border-[#d9e7f2] bg-[#f5fbff] px-4 py-3">
                                <summary className="cursor-pointer text-sm font-semibold text-[#22304a]">{parsed.weekLabel} - custom week/topic</summary>
                                <div className="mt-3 rounded-2xl bg-white px-4 py-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-[#22304a]">{lessonTopic}</p>
                                      <p className="mt-1 text-xs text-[#617184]">{parsed.summary || "Lesson content added."}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      <Link href={buildBuilderHref("plan", { weekLabel: parsed.weekLabel ?? term.title, topic: lessonTopic, termId: term.id, lessonId: entry.id, lessonComposer: true })} className="inline-flex items-center gap-1 rounded-full bg-[#fff7eb] px-3 py-1.5 text-xs font-semibold text-[#8a6326]">
                                        <Edit3 className="h-3.5 w-3.5" /> Edit
                                      </Link>
                                      <Link href={buildBuilderHref("plan", { weekLabel: parsed.weekLabel ?? term.title, topic: lessonTopic, termId: term.id, quizComposer: true })} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2a76aa]">Quiz</Link>
                                      <Link href={buildBuilderHref("plan", { weekLabel: parsed.weekLabel ?? term.title, topic: lessonTopic, termId: term.id, liveComposer: true })} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2a76aa]">Live</Link>
                                      <Link href={buildBuilderHref("plan", { weekLabel: parsed.weekLabel ?? term.title, topic: lessonTopic, termId: term.id, taskComposer: true })} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2a76aa]">Task</Link>
                                    </div>
                                  </div>
                                </div>
                              </details>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })}
                  <div className="rounded-[18px] border border-dashed border-[#d8c3ac] bg-[#fffaf5] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#22304a]">Create a new week / topic</p>
                        <p className="mt-1 text-sm text-[#5f6b7a]">Use this when the programme needs an extra chapter, revision week, or special session.</p>
                      </div>
                      <Link href={buildBuilderHref("plan", { weekLabel: "New week", topic: "New lesson topic", lessonComposer: true })} className="inline-flex items-center gap-2 rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                        <PlusCircle className="h-4 w-4" /> New lesson
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </TeacherSection>
          ) : null}

          {lessonComposer ? (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-[#12213a]/55 px-3 py-6">
              <Link href={buildBuilderHref("plan")} aria-label="Close lesson builder" className="fixed inset-0" />
              <div className="relative mx-auto max-w-5xl rounded-[28px] bg-white p-4 shadow-2xl sm:p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Weekly content</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">{editingLesson ? "Edit lesson" : "Create lesson"}</h2>
                  </div>
                  <Link href={buildBuilderHref("plan")} className="rounded-full border border-[#eadfce] bg-[#fffaf5] px-4 py-2 text-sm font-semibold text-[#22304a]">
                    Close
                  </Link>
                </div>
                <form action={publishLessonContent} className="grid gap-4">
                  <div className="rounded-[18px] border border-[#d9e7f2] bg-[#f5fbff] p-3 text-sm leading-6 text-[#4d5a6b]">
                    Add the lesson update, thumbnail, video, and supporting files. Everything uploads to the programme Drive folder and appears in the student course page.
                  </div>
                  <input type="hidden" name="termId" value={prefillTermId ?? ""} />
                  <input type="hidden" name="weekLabel" value={prefillWeekLabel ?? ""} />
                  <input type="hidden" name="lessonLogId" value={editingLesson?.entry.id ?? ""} />
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                    <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                      Class schedule
                      <select name="scheduleId" defaultValue={editingLesson?.entry.title ? visibleClasses.find((entry) => entry.title === editingLesson.entry.title)?.id : ""} className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" required>
                        <option value="">Select a class</option>
                        {visibleClasses.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.title} - {entry.startTime}-{entry.endTime}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                      Lesson date
                      <input type="date" name="lessonDate" defaultValue={editingLesson?.entry.lessonDate ? editingLesson.entry.lessonDate.toISOString().slice(0, 10) : ""} className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" required />
                    </label>
                  </div>
                  <div className="rounded-[18px] bg-[#fbf6ef] px-4 py-3 text-sm text-[#5f6b7a]">
                    <span className="font-semibold text-[#22304a]">{prefillWeekLabel || "Selected week"}</span>
                    {prefillTopic ? ` - ${prefillTopic}` : ""}
                  </div>
                  <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                    Lesson title
                    <input name="topic" defaultValue={editingLesson?.parsed.topic || prefillTopic || ""} className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" placeholder="Lesson title" required />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                    Lesson overview
                    <textarea name="summary" rows={3} defaultValue={editingLesson?.parsed.summary ?? ""} className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" placeholder="Short lesson description or what students will learn." required />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                      Learning objective
                      <input name="lessonObjective" defaultValue={editingLesson?.parsed.lessonObjective ?? ""} className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" placeholder="One clear objective" />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                      Homework / follow-up
                      <input name="homework" defaultValue={editingLesson?.parsed.homework ?? ""} className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" placeholder="Optional homework note" />
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                      Thumbnail image
                      <input name="thumbnailFile" type="file" accept="image/*" className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#2a76aa] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                      YouTube / video URL
                      <input name="videoUrl" className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" placeholder="https://youtube.com/..." />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                      Upload video
                      <input name="videoFile" type="file" accept="video/*" className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#2a76aa] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                      Extra resource links
                      <input name="resourceLinks" defaultValue={editingLesson?.parsed.resourceLinks.join("\n") ?? ""} className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" placeholder="Optional Drive/PDF links" />
                    </label>
                  </div>
                  <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                    Lesson documents
                    <div className="rounded-[18px] border border-dashed border-[#b9c6d6] bg-[#fbfdff] px-4 py-5">
                      <input name="lessonFiles" type="file" multiple accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,image/*" className="w-full text-sm text-[#22304a] file:mr-4 file:rounded-full file:border-0 file:bg-[#2a76aa] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
                      <p className="mt-2 text-xs font-normal text-[#617184]">Slides, PDFs, worksheets, documents, and images.</p>
                    </div>
                  </label>

                <FormSubmitButton pendingLabel={editingLesson ? "Updating lesson..." : "Publishing lesson..."} className="inline-flex w-fit rounded-full bg-[#2a76aa] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#245f88] disabled:cursor-wait disabled:opacity-70">
                  {editingLesson ? "Update lesson" : "Publish lesson update"}
                </FormSubmitButton>
              </form>
              </div>
            </div>
          ) : null}

          {quizComposer ? (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-[#12213a]/55 px-3 py-6">
              <Link href={buildBuilderHref("plan")} aria-label="Close quiz builder" className="fixed inset-0" />
              <div className="relative mx-auto max-w-4xl rounded-[28px] bg-white p-4 shadow-2xl sm:p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Assessment</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Create quiz</h2>
                    <p className="mt-1 text-sm text-[#617184]">{[prefillWeekLabel, prefillTopic].filter(Boolean).join(" - ")}</p>
                  </div>
                  <Link href={buildBuilderHref("plan")} className="rounded-full border border-[#eadfce] bg-[#fffaf5] px-4 py-2 text-sm font-semibold text-[#22304a]">
                    Close
                  </Link>
                </div>

                <form action={createCurriculumQuizAction} className="grid gap-4">
                  <input type="hidden" name="programId" value={selectedProgramId} />
                  <input type="hidden" name="weekLabel" value={prefillWeekLabel ?? ""} />
                  <input type="hidden" name="topic" value={prefillTopic ?? ""} />
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
                    <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                      Quiz title
                      <input name="title" required defaultValue={prefillTopic ? `${prefillTopic} quiz` : ""} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                      Type
                      <select name="type" defaultValue="POST_LESSON" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                        <option value="PRE_LESSON">Pre lesson</option>
                        <option value="POST_LESSON">Post lesson</option>
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                      Minutes
                      <input name="timeLimitMinutes" type="number" min="0" defaultValue="10" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                    </label>
                  </div>
                  <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                    Short note
                    <textarea name="description" rows={2} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Optional instructions for students." />
                  </label>

                  <QuizQuestionBuilderClient />

                  <label className="flex items-center gap-3 rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm font-semibold text-[#22304a]">
                    <input name="isPublished" type="checkbox" defaultChecked />
                    Publish to students
                  </label>
                  <FormSubmitButton pendingLabel="Creating quiz..." className="w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70">Create quiz</FormSubmitButton>
                </form>
              </div>
            </div>
          ) : null}

          {taskComposer ? (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-[#12213a]/55 px-3 py-6">
              <Link href={buildBuilderHref("plan")} aria-label="Close task builder" className="fixed inset-0" />
              <div className="relative mx-auto max-w-4xl rounded-[28px] bg-white p-4 shadow-2xl sm:p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Student work</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Assign task</h2>
                    <p className="mt-1 text-sm text-[#617184]">{[prefillWeekLabel, prefillTopic].filter(Boolean).join(" - ")}</p>
                  </div>
                  <Link href={buildBuilderHref("plan")} className="rounded-full border border-[#eadfce] bg-[#fffaf5] px-4 py-2 text-sm font-semibold text-[#22304a]">
                    Close
                  </Link>
                </div>

                <form action={publishStudentTask} className="grid gap-4">
                  <input type="hidden" name="programId" value={selectedProgramId} />
                  <input type="hidden" name="taskWeekLabel" value={prefillWeekLabel ?? ""} />
                  <input type="hidden" name="taskTermId" value={prefillTermId ?? ""} />
                  <input type="hidden" name="taskProgrammeFocus" value={selectedProgramme.title} />
                  <input type="hidden" name="returnTab" value="plan" />
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_190px]">
                    <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                      Task title
                      <input name="title" required defaultValue={prefillTopic ?? ""} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                      Due date
                      <input type="date" name="dueDate" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                    </label>
                  </div>
                  <textarea name="instructions" rows={4} required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Clear task instructions for students and parents." />
                  <div className="grid gap-4 md:grid-cols-2">
                    <input name="taskCategory" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Worksheet, recitation, project..." />
                    <select name="evidenceMode" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                      <option value="">Evidence type</option>
                      <option value="photo">Photo upload</option>
                      <option value="video">Short video</option>
                      <option value="document">Document/PPT</option>
                      <option value="verbal">Verbal explanation</option>
                    </select>
                  </div>
                  <input name="taskLinks" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Optional Drive, worksheet, or reference links" />
                  <input name="taskFiles" type="file" multiple accept="image/*,video/*,.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx" className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#22304a] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
                  <FormSubmitButton pendingLabel="Publishing task..." className="w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70">Publish task</FormSubmitButton>
                </form>
              </div>
            </div>
          ) : null}

          {liveComposer ? (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-[#12213a]/55 px-3 py-6">
              <Link href={buildBuilderHref("plan")} aria-label="Close live session builder" className="fixed inset-0" />
              <div className="relative mx-auto max-w-3xl rounded-[28px] bg-white p-4 shadow-2xl sm:p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Zoom session</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Create live session</h2>
                    <p className="mt-1 text-sm text-[#617184]">{[prefillWeekLabel, prefillTopic].filter(Boolean).join(" - ")}</p>
                  </div>
                  <Link href={buildBuilderHref("plan")} className="rounded-full border border-[#eadfce] bg-[#fffaf5] px-4 py-2 text-sm font-semibold text-[#22304a]">
                    Close
                  </Link>
                </div>

                <form action={createCurriculumLiveSessionAction} className="grid gap-4">
                  <input type="hidden" name="programId" value={selectedProgramId} />
                  <div className="rounded-[18px] border border-[#d9e7f2] bg-[#f5fbff] p-3 text-sm leading-6 text-[#4d5a6b]">
                    This creates a weekly recurring Zoom session for the selected curriculum topic.
                  </div>
                  <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                    Session title
                    <input name="title" required defaultValue={prefillTopic ?? ""} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                  </label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                      Day
                      <select name="weekday" defaultValue="6" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                        {WEEKDAYS.map((weekday, index) => (
                          <option key={weekday} value={index}>{weekday}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                      Timezone
                      <select name="timezone" defaultValue="Europe/London" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                        {TIMEZONES.map((timezone) => (
                          <option key={timezone} value={timezone}>{timezone}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                      Start
                      <input name="startTime" type="time" defaultValue="16:00" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                      End
                      <input name="endTime" type="time" defaultValue="17:00" required className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                    </label>
                  </div>
                  <FormSubmitButton pendingLabel="Creating session..." className="w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70">
                    Create recurring Zoom session
                  </FormSubmitButton>
                </form>
              </div>
            </div>
          ) : null}

          {normalizedActiveTab === "task" ? (
            <TeacherSection eyebrow="Student work" title="Assign a task with resources">
              <form action={publishStudentTask} className="grid gap-4">
                <input type="hidden" name="programId" value={selectedRoster?.programId ?? ""} />
                <input type="hidden" name="returnTab" value="task" />

                <div className="rounded-[18px] bg-[#fbf6ef] px-4 py-3 text-sm leading-7 text-[#5f6b7a]">
                  Publishing task for <span className="font-semibold text-[#22304a]">{selectedRoster?.title}</span>. Attach worksheets, examples, images, or files students need before starting.
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-[#2a3f56]">
                    Task title
                    <input
                      name="title"
                      defaultValue={prefillTopic ?? ""}
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
                    <input name="taskWeekLabel" defaultValue={prefillWeekLabel ?? ""} className="rounded-[18px] border border-[#d8e3ed] bg-white px-4 py-3 text-sm text-[#22304a]" placeholder="Week 5 practice task" />
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

                <FormSubmitButton pendingLabel="Publishing student task..." className="inline-flex w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2740] disabled:cursor-wait disabled:opacity-70">
                  Publish student task
                </FormSubmitButton>
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

          {normalizedActiveTab === "materials" ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <TeacherSection
                eyebrow="Materials kit"
                title={`${selectedProgramme.title} resources to prepare`}
                action={
                  <Link href={buildBuilderHref("materials", { materialComposer: true })} className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">
                    Upload material kit
                  </Link>
                }
              >
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

          {materialComposer ? (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-[#12213a]/55 px-3 py-6">
              <Link href={buildBuilderHref("materials")} aria-label="Close material kit uploader" className="fixed inset-0" />
              <div className="relative mx-auto max-w-3xl rounded-[28px] bg-white p-4 shadow-2xl sm:p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Materials kit</p>
                    <h2 className="mt-2 text-2xl font-semibold text-[#22304a]">Upload programme material</h2>
                    <p className="mt-1 text-sm text-[#617184]">Files are saved in the programme Google Drive folder and can be shown in the student LMS.</p>
                  </div>
                  <Link href={buildBuilderHref("materials")} className="rounded-full border border-[#eadfce] bg-[#fffaf5] px-4 py-2 text-sm font-semibold text-[#22304a]">
                    Close
                  </Link>
                </div>

                <form action={uploadMaterialKitAction} className="grid gap-4 md:grid-cols-2">
                  <input type="hidden" name="programId" value={selectedProgramId} />
                  <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                    Display title
                    <input name="title" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Arabic Week 1 slides" />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                    Folder / kit area
                    <input name="folderName" defaultValue="Materials Kit" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Materials Kit, Week 1, Slides" />
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm font-semibold text-[#22304a] md:col-span-2">
                    <input name="publishToStudents" type="checkbox" defaultChecked />
                    Show this material in student/parent dashboards
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-[#22304a] md:col-span-2">
                    Choose material file
                    <div className="rounded-[18px] border border-dashed border-[#b9c6d6] bg-[#fbfdff] px-4 py-5">
                      <input name="file" type="file" required accept="image/*,video/*,.pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx" className="w-full text-sm text-[#22304a] file:mr-4 file:rounded-full file:border-0 file:bg-[#22304a] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
                    </div>
                  </label>
                  <FormSubmitButton pendingLabel="Uploading material..." className="w-fit rounded-full bg-[#22304a] px-5 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70 md:col-span-2">
                    Upload material kit
                  </FormSubmitButton>
                </form>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
