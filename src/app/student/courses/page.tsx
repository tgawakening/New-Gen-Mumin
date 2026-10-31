import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, ImageIcon, Video } from "lucide-react";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { displayProgramTitle } from "@/lib/genm/curriculum";
import { listMaterials } from "@/lib/google-drive/materials";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { LiveClassCountdown } from "@/components/dashboard/family/LiveClassCountdown";
import {
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ course?: string; lesson?: string; submitted?: string; task?: string; error?: string }>;
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

type StudentChild = NonNullable<Awaited<ReturnType<typeof getStudentDashboardData>>>["child"];

function programTabLabel(course: StudentChild["courses"][number]) {
  const title = displayProgramTitle(course.programSlug || course.title).toLowerCase();
  if (title.includes("arabic") || title.includes("tajweed")) return "Arabic & Tajweed";
  if (title.includes("seerah")) return "Seerah";
  if (title.includes("life") || title.includes("leadership")) return "Leadership";
  return course.title;
}

function courseOwnsProgramTitle(course: StudentChild["courses"][number], programTitle: string) {
  return (course.programTitles ?? [course.title]).some(
    (title) => title === programTitle || displayProgramTitle(title) === displayProgramTitle(programTitle),
  );
}

export default async function StudentCoursesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();

  if (!session) redirect("/auth/login");
  const legacyParams = searchParams ? await searchParams : {};
  if (session.user.role === "PARENT" && legacyParams.task) redirect(`/parent/homework?task=${encodeURIComponent(legacyParams.task)}`);
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getStudentDashboardData(session.user.id);
  if (!dashboard) redirect("/auth/login");

  const child = dashboard.child;
  const params = legacyParams;
  if (params.task) redirect(`/student/homework?task=${encodeURIComponent(params.task)}`);
  const linkedTask = params.task ? child.assignments.find((assignment) => assignment.id === params.task) ?? null : null;
  const linkedTaskCourse = linkedTask
    ? child.courses.find((course) => courseOwnsProgramTitle(course, linkedTask.programTitle)) ?? null
    : null;
  const selectedCourse = linkedTaskCourse ?? child.courses.find((course) => course.id === params.course) ?? child.courses[0] ?? null;
  const selectedProgramIds = selectedCourse?.programIds?.length ? selectedCourse.programIds : selectedCourse?.programId ? [selectedCourse.programId] : [];
  let materials: Awaited<ReturnType<typeof listMaterials>> = [];
  if (selectedProgramIds.length) {
    try {
      materials = (
        await Promise.all(
          selectedProgramIds.map((programId) =>
            listMaterials({ programId, status: "approved", visibility: "students_parents", limit: 20, studentId: child.id }),
          ),
        )
      ).flat();
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
    ? child.lessonUpdates.filter((update) => courseOwnsProgramTitle(selectedCourse, update.programTitle))
    : [];
  const selectedLesson =
    selectedLessonUpdates.find((lesson) => lesson.id === params.lesson) ?? selectedLessonUpdates[0] ?? null;



  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Courses"
      subtitle="Explore your Gen-Mumins learning path, weekly rhythm, teacher team, and term highlights in a compact course space."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <ActionToast message={params.error === "not_launched" ? "This homework is scheduled for a future launch date. Please return when it opens." : params.error === "empty" ? "Add an answer or upload your homework file before submitting." : params.submitted ? "Homework submitted successfully. Your teacher has been notified." : undefined} tone={params.error ? "error" : "success"} />

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
              {programTabLabel(course)}
            </Link>
          ))}
        </div>

        {selectedCourse ? (
          <div className={`mt-5 rounded-[24px] bg-[#fbf6ef] p-5 ${child.accessLocked ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-semibold text-[#22304a]">{programTabLabel(selectedCourse)}</h3>
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
                        isLive={session.isLive}
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
        <SectionCard eyebrow="Weekly lessons" title={`${programTabLabel(selectedCourse)} lesson content`}>
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
        <SectionCard eyebrow="Course library" title={`${programTabLabel(selectedCourse)} materials`}>
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
                      <p className="mt-1 text-xs text-[#617184]">{material.programTitle ? displayProgramTitle(material.programTitle) : programTabLabel(selectedCourse)}</p>
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
        <SectionCard eyebrow="Gen-Mumins plan" title={`${programTabLabel(selectedCourse)} curriculum`}>
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
                      <a href="/student/homework" className="rounded-full bg-[#fff4e8] px-3 py-1.5 text-xs font-semibold text-[#b46b1e]">Tasks</a>
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

      <SectionCard eyebrow="Assignments" title="Homework & Tasks"><div id="student-assignments" /><p className="text-sm text-[#617184]">Homework has its own section. Find your latest tasks by programme and submit your work there.</p><Link href="/student/homework" className="mt-4 inline-flex min-h-12 items-center rounded-full bg-[#22304a] px-5 py-3 text-sm font-bold text-white">Open Homework & Tasks</Link></SectionCard>
    </FamilyDashboardFrame>
  );
}
