import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FileText, ImageIcon, Video } from "lucide-react";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { db } from "@/lib/db";
import { listMaterials, uploadStudentSubmissionFile } from "@/lib/google-drive/materials";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { LiveClassCountdown } from "@/components/dashboard/family/LiveClassCountdown";
import {
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ course?: string; lesson?: string; submitted?: string }>;
};

type Attachment = {
  id: string;
  name: string;
  url: string | null;
  mimeType: string | null;
  thumbnailUrl?: string | null;
};

function getAttachmentIcon(mimeType: string | null) {
  if (mimeType?.startsWith("image/")) return ImageIcon;
  if (mimeType?.startsWith("video/")) return Video;
  return FileText;
}

function AttachmentGrid({ attachments }: { attachments: Attachment[] }) {
  if (!attachments.length) return null;

  return (
    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {attachments.map((attachment) => {
        const Icon = getAttachmentIcon(attachment.mimeType);
        return (
          <a
            key={attachment.id}
            href={attachment.url ?? "#"}
            target="_blank"
            className="overflow-hidden rounded-[18px] border border-[#eadfce] bg-white text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex aspect-video items-center justify-center bg-[#f5efe6]">
              {attachment.thumbnailUrl ? (
                <img src={attachment.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Icon className="h-8 w-8 text-[#c27a2c]" />
              )}
            </div>
            <div className="p-3">
              <p className="line-clamp-2 font-semibold text-[#22304a]">{attachment.name}</p>
              <p className="mt-1 text-xs text-[#617184]">{attachment.mimeType ?? "Course file"}</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}

export default async function StudentCoursesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();

  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const child = dashboard.child;
  const params = searchParams ? await searchParams : {};
  const selectedCourse = child.courses.find((course) => course.id === params.course) ?? child.courses[0] ?? null;
  let materials: Awaited<ReturnType<typeof listMaterials>> = [];
  if (selectedCourse) {
    try {
      materials = await listMaterials({ programId: selectedCourse.id, status: "approved", visibility: "students_parents", limit: 20 });
    } catch {
      materials = [];
    }
  }
  const groupedMaterials = materials.reduce<Record<string, typeof materials>>((groups, material) => {
    const folderName = material.folderName ?? "General";
    groups[folderName] = groups[folderName] ?? [];
    groups[folderName].push(material);
    return groups;
  }, {});
  const selectedLessonUpdates = selectedCourse
    ? child.lessonUpdates.filter((update) => update.programTitle === selectedCourse.title)
    : [];
  const selectedLesson =
    selectedLessonUpdates.find((lesson) => lesson.id === params.lesson) ?? selectedLessonUpdates[0] ?? null;
  const selectedAssignments = selectedCourse
    ? child.assignments.filter((assignment) => assignment.programTitle === selectedCourse.title)
    : child.assignments;

  async function submitAssignmentAction(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "STUDENT") redirect("/auth/login");

    const student = await db.studentProfile.findUnique({
      where: { userId: currentSession.user.id },
      include: { user: true },
    });
    if (!student) redirect("/auth/login");

    const assignmentId = String(formData.get("assignmentId") || "");
    const submissionText = String(formData.get("submissionText") || "").trim();
    const submissionType = String(formData.get("submissionType") || "task") as "task" | "homework" | "assignment";
    const file = formData.get("submissionFile");

    const assignment = await db.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        program: {
          include: {
            teacherAssignments: { include: { teacher: { include: { user: true } } } },
          },
        },
      },
    });
    if (!assignment) throw new Error("Assignment not found.");

    const enrollment = await db.enrollment.findUnique({
      where: { studentId_programId: { studentId: student.id, programId: assignment.programId } },
    });
    if (!enrollment) throw new Error("You are not enrolled in this program.");

    let attachmentUrl: string | null = null;
    if (file instanceof File && file.size > 0) {
      const uploaded = await uploadStudentSubmissionFile({
        studentId: student.id,
        studentName: student.displayName || `${student.user.firstName} ${student.user.lastName}`.trim(),
        programId: assignment.programId,
        programTitle: assignment.program.title,
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        submissionType,
        file,
      });
      attachmentUrl = uploaded.webViewLink;
    }

    const existing = await db.assignmentSubmission.findFirst({
      where: { assignmentId: assignment.id, studentId: student.id },
    });

    const submission = existing
      ? await db.assignmentSubmission.update({
          where: { id: existing.id },
          data: {
            enrollmentId: enrollment.id,
            submissionText,
            attachmentUrl: attachmentUrl ?? existing.attachmentUrl,
            status: "SUBMITTED",
            submittedAt: new Date(),
          },
        })
      : await db.assignmentSubmission.create({
          data: {
            assignmentId: assignment.id,
            enrollmentId: enrollment.id,
            studentId: student.id,
            submissionText,
            attachmentUrl,
            status: "SUBMITTED",
            submittedAt: new Date(),
          },
        });

    if (assignment.program.teacherAssignments.length) {
      await db.notification.createMany({
        data: assignment.program.teacherAssignments.map(({ teacher }) => ({
          userId: teacher.user.id,
          title: "Student task submitted",
          body: `${student.displayName || student.user.firstName} submitted ${assignment.title}.`,
          href: "/teacher/course-builder?tab=task",
        })),
      });
    }

    revalidatePath("/student/courses");
    revalidatePath("/teacher/course-builder");
    redirect(`/student/courses?course=${assignment.programId}&submitted=${submission.id}`);
  }

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Courses"
      subtitle="Explore your Gen-Mumins learning path, weekly rhythm, teacher team, and term highlights in a compact course space."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <ActionToast message={params.submitted ? "Task submitted successfully. Your teacher has been notified." : undefined} />

      <MetricGrid
        metrics={[
          { label: "Enrolled courses", value: String(child.courses.length), hint: "Current programme load." },
          { label: "Assignments", value: String(child.assignments.length), hint: "Homework and coursework items." },
          { label: "Unlocked", value: child.accessLocked ? "No" : "Yes", hint: "Learning access after payment confirmation." },
          { label: "Weekly classes", value: String(child.schedule.length), hint: "Live recurring timetable slots." },
        ]}
      />

      <SectionCard eyebrow="Programme tabs" title="Your enrolled programmes">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {child.courses.map((course) => (
            <Link
              key={course.id}
              href={`/student/courses?course=${course.id}`}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                selectedCourse?.id === course.id
                  ? "bg-[#22304a] text-white"
                  : "border border-[#eadfce] bg-white text-[#22304a]"
              }`}
            >
              {course.title}
            </Link>
          ))}
        </div>

        {selectedCourse ? (
          <div className={`mt-5 rounded-[24px] bg-[#fbf6ef] p-5 ${child.accessLocked ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-[#22304a]">{selectedCourse.title}</h3>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                {selectedCourse.status}
              </span>
            </div>
            {selectedCourse.strapline ? (
              <p className="mt-2 text-sm font-medium text-[#c27a2c]">{selectedCourse.strapline}</p>
            ) : null}
            <p className="mt-3 text-sm font-medium text-[#22304a]">
              Instructors: {selectedCourse.teachers.map((teacher) => teacher.name).slice(0, 2).join(", ") || "Assigned soon"}
            </p>
            <div className="mt-3 grid gap-2 text-sm text-[#5f6b7a] sm:grid-cols-2">
              <p>Started: {formatDate(selectedCourse.startedAt)}</p>
              <p>Weekly slots: {selectedCourse.meetingCount}</p>
            </div>
            {selectedCourse.roomAssignment?.roomName || selectedCourse.roomAssignment?.roomCode ? (
              <div className="mt-4 rounded-[18px] border border-[#c7dff5] bg-[#eef6ff] p-4 text-sm text-[#2a4f72]">
                <p className="font-semibold text-[#22304a]">Your Zoom room/group</p>
                <p className="mt-1">{selectedCourse.roomAssignment.roomName ?? "Assigned room"}</p>
                {selectedCourse.roomAssignment.roomCode ? <p className="mt-1">Room code: {selectedCourse.roomAssignment.roomCode}</p> : null}
                {selectedCourse.roomAssignment.teacherName ? <p className="mt-1">Teacher: {selectedCourse.roomAssignment.teacherName}</p> : null}
                {selectedCourse.roomAssignment.level ? <p className="mt-1">Level: {selectedCourse.roomAssignment.level}</p> : null}
                {selectedCourse.roomAssignment.instructions ? <p className="mt-2 leading-6">{selectedCourse.roomAssignment.instructions}</p> : null}
              </div>
            ) : null}

            {selectedCourse.upcomingSessions.length ? (
              <div id="student-live-classes" className="mt-4 rounded-[18px] bg-[#22304a] p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Upcoming sessions</p>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  {selectedCourse.upcomingSessions.map((session) => (
                    <div key={session.id} className="rounded-[16px] bg-white/10 p-3">
                      <p className="font-semibold">{session.provider ?? "Live class"}</p>
                      <p className="mt-1 text-sm text-white/75">
                        {session.startTime}-{session.endTime} {session.timezone}
                      </p>
                      <LiveClassCountdown
                        startsAt={session.nextStartsAt.toISOString()}
                        meetingUrl={session.meetingUrl}
                        accessLocked={child.accessLocked}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-5 rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
            Enrolled courses will appear here once registration is complete.
          </p>
        )}
      </SectionCard>

      {selectedCourse ? (
        <SectionCard eyebrow="Weekly lessons" title={`${selectedCourse.title} lesson content`}>
          <div className="space-y-4">
            {selectedLessonUpdates.map((update) => (
              <article key={update.id} className="rounded-[22px] bg-[#fbf6ef] p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                      {update.weekLabel ?? update.contentType ?? "Lesson"}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-[#22304a]">{update.topic}</h3>
                    <p className="mt-2 text-sm leading-7 text-[#5f6b7a]">{update.summary}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                    {formatDate(update.lessonDate)}
                  </span>
                </div>
                {update.lessonObjective ? <p className="mt-3 text-sm font-semibold text-[#22304a]">{update.lessonObjective}</p> : null}
                <AttachmentGrid attachments={update.attachments} />
                {update.resourceLinks.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {update.resourceLinks.map((resource) => (
                      <a key={resource} href={resource} target="_blank" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2a76aa]">
                        Resource link
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
            {!selectedLessonUpdates.length ? (
              <p className="rounded-[20px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
                Weekly lessons and attached resources will appear here after your teacher publishes them.
              </p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {selectedCourse ? (
        <SectionCard eyebrow="Course library" title={`${selectedCourse.title} materials`}>
          <div className="space-y-4">
            {Object.entries(groupedMaterials).map(([folderName, folderMaterials]) => (
              <div key={folderName} className="rounded-[20px] bg-[#fbf6ef] p-4">
                <p className="text-sm font-semibold text-[#22304a]">{folderName}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {folderMaterials.map((material) => (
                    <a
                      key={material.id}
                      href={material.webViewLink ?? "#"}
                      target="_blank"
                      className="rounded-[16px] border border-[#eadfce] bg-white px-4 py-3 text-sm"
                    >
                      <p className="font-semibold text-[#22304a]">{material.name}</p>
                      <p className="mt-1 text-xs text-[#617184]">{material.programTitle ?? selectedCourse.title}</p>
                    </a>
                  ))}
                </div>
              </div>
            ))}
            {!materials.length ? (
              <p className="rounded-[20px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
                Approved course materials will appear here after your teacher uploads them.
              </p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {selectedCourse ? (
        <SectionCard eyebrow="Gen-Mumins plan" title={`${selectedCourse.title} curriculum`}>
          <div className={`grid gap-4 rounded-[24px] bg-[#fbf6ef] p-4 lg:grid-cols-[320px_minmax(0,1fr)] ${child.accessLocked ? "opacity-60" : ""}`}>
            <aside className="max-h-[760px] overflow-y-auto rounded-[20px] bg-white p-3">
              <p className="px-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">Curriculum tree</p>
              <div className="mt-3 space-y-2">
                {selectedCourse.termPlans.map((term) => (
                  <details key={term.id} className="rounded-[16px] border border-[#eef2f5] bg-[#fffdf9] p-3" open>
                    <summary className="cursor-pointer text-sm font-semibold text-[#22304a]">
                      {term.title}
                      <span className="mt-1 block text-xs font-medium text-[#6d7785]">{term.level} - {term.window}</span>
                    </summary>
                    <div className="mt-3 space-y-2">
                      {term.highlights.map((highlight, index) => {
                        const weekLabel = `${term.title} Week ${index + 1}`;
                        const weekLessons = selectedLessonUpdates.filter((update) => update.weekLabel === weekLabel);
                        return (
                          <details key={weekLabel} className="rounded-[14px] bg-[#fbf6ef] p-2">
                            <summary className="cursor-pointer text-xs font-semibold text-[#22304a]">
                              {weekLabel}
                              <span className="mt-1 block font-medium text-[#6d7785]">{highlight}</span>
                            </summary>
                            <div className="mt-2 space-y-1">
                              {weekLessons.map((lesson) => (
                                <Link
                                  key={lesson.id}
                                  href={`/student/courses?course=${selectedCourse.id}&lesson=${lesson.id}`}
                                  className={`block rounded-xl px-3 py-2 text-xs font-semibold ${
                                    selectedLesson?.id === lesson.id ? "bg-[#22304a] text-white" : "bg-white text-[#2a76aa]"
                                  }`}
                                >
                                  {lesson.topic}
                                </Link>
                              ))}
                              {!weekLessons.length ? <p className="px-2 py-1 text-xs leading-5 text-[#8a94a3]">No lesson yet</p> : null}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
            </aside>

            <div className="min-w-0 rounded-[20px] bg-white p-4">
              {selectedLesson ? (
                <article>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                        {selectedLesson.weekLabel ?? "Lesson"}
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-[#22304a]">{selectedLesson.topic}</h3>
                      <p className="mt-2 text-sm text-[#6d7785]">
                        {formatDate(selectedLesson.lessonDate)} - {selectedLesson.teacherName ?? "Teacher update"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/student/quizzes" className="rounded-full bg-[#eef5fb] px-3 py-1.5 text-xs font-semibold text-[#2a76aa]">Quizzes</Link>
                      <a href="#student-assignments" className="rounded-full bg-[#fff4e8] px-3 py-1.5 text-xs font-semibold text-[#b46b1e]">Tasks</a>
                      <a href="#student-live-classes" className="rounded-full bg-[#eef8f0] px-3 py-1.5 text-xs font-semibold text-[#2c7a48]">Live</a>
                    </div>
                  </div>
                  <p className="mt-5 text-sm leading-7 text-[#4d5a6b]">{selectedLesson.summary}</p>
                  {selectedLesson.lessonObjective ? <p className="mt-3 rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm font-semibold text-[#22304a]">{selectedLesson.lessonObjective}</p> : null}
                  <AttachmentGrid attachments={selectedLesson.attachments} />
                  {selectedLesson.resourceLinks.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedLesson.resourceLinks.map((resource) => (
                        <a key={resource} href={resource} target="_blank" className="rounded-full bg-[#eef5fb] px-3 py-1.5 text-xs font-semibold text-[#2a76aa]">
                          Open resource
                        </a>
                      ))}
                    </div>
                  ) : null}
                  {selectedLesson.homework ? (
                    <div className="mt-4 rounded-[18px] border border-[#eadfce] bg-[#fffdf9] p-4 text-sm leading-7 text-[#4d5a6b]">
                      <p className="font-semibold text-[#22304a]">Homework / follow-up</p>
                      <p className="mt-2">{selectedLesson.homework}</p>
                    </div>
                  ) : null}
                </article>
              ) : (
                <div className="rounded-[18px] bg-[#fbf6ef] p-5 text-sm leading-7 text-[#5f6b7a]">
                  Select a lesson from the curriculum tree. Published lessons, thumbnails, videos, slides, and worksheets will open here.
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard eyebrow="Assignments" title="Coursework and submissions">
        <div id="student-assignments" />
        <div className={`space-y-4 ${child.accessLocked ? "opacity-60" : ""}`}>
          {selectedAssignments.map((assignment) => (
            <details key={assignment.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#22304a]">{assignment.title}</h3>
                    <p className="mt-2 text-sm text-[#5f6b7a]">
                      {assignment.programTitle} - {assignment.status.replace(/_/g, " ")} - Due {formatDate(assignment.dueDate)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                    {assignment.score === null ? "Pending" : `${assignment.score} pts`}
                  </span>
                </div>
              </summary>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[#4d5a6b]">
                {assignment.instructions ? <p>{assignment.instructions}</p> : null}
                <AttachmentGrid attachments={assignment.attachments} />
                {assignment.resourceLinks.length ? (
                  <div className="flex flex-wrap gap-2">
                    {assignment.resourceLinks.map((resource) => (
                      <a key={resource} href={resource} target="_blank" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#2a76aa]">
                        Resource link
                      </a>
                    ))}
                  </div>
                ) : null}
                {assignment.feedback ? <p>{assignment.feedback}</p> : null}
                <form action={submitAssignmentAction} className="mt-4 grid gap-3 rounded-[18px] border border-[#eadfce] bg-white p-4">
                  <input type="hidden" name="assignmentId" value={assignment.id} />
                  <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                    Submission type
                    <select name="submissionType" defaultValue="task" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                      <option value="task">Task</option>
                      <option value="homework">Homework</option>
                      <option value="assignment">Assignment</option>
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                    Your answer / notes
                    <textarea name="submissionText" rows={3} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" placeholder="Write a short answer or note for your teacher." />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                    Upload evidence
                    <input name="submissionFile" type="file" accept="image/*,video/*,.pdf,.ppt,.pptx,.doc,.docx" className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[#22304a] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white" />
                  </label>
                  <button className="w-fit rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white">Submit task</button>
                </form>
              </div>
            </details>
          ))}
          {!selectedAssignments.length ? (
            <p className="rounded-[24px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Assignments will appear once teachers publish coursework.
            </p>
          ) : null}
        </div>
      </SectionCard>
    </FamilyDashboardFrame>
  );
}
