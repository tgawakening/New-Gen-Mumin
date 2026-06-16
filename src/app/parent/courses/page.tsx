import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, ImageIcon, Video } from "lucide-react";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { FULL_GENM_PROGRAM_SLUGS } from "@/lib/registration/catalog";
import { getRegistrationOptions } from "@/lib/registration/service";
import { listMaterials } from "@/lib/google-drive/materials";
import { displayProgramTitle } from "@/lib/genm/curriculum";
import { LiveClassCountdown } from "@/components/dashboard/family/LiveClassCountdown";
import { AddChildEnrollmentModal } from "@/components/registration/AddChildEnrollmentModal";
import {
  ChildSelector,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string; course?: string; lesson?: string; enrollProgram?: string }>;
};

type ParentDashboard = NonNullable<Awaited<ReturnType<typeof getParentDashboardData>>>;
type ParentChild = ParentDashboard["children"][number];
type RegistrationOffer = Awaited<ReturnType<typeof getRegistrationOptions>>["offers"][number];

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

function enrolledProgramSlugs(child: ParentChild) {
  const slugs = new Set(child.courses.map((course) => course.programSlug));
  if (slugs.has("full-bundle")) {
    return new Set<string>(FULL_GENM_PROGRAM_SLUGS);
  }
  return slugs;
}

function hasFullGenM(child: ParentChild) {
  const slugs = enrolledProgramSlugs(child);
  return FULL_GENM_PROGRAM_SLUGS.every((slug) => slugs.has(slug));
}

function offerProgramSlugs(offer: RegistrationOffer) {
  return "programSlugs" in offer && Array.isArray(offer.programSlugs) ? offer.programSlugs : [];
}

function eligibleProgramOffers(offers: RegistrationOffer[], child: ParentChild) {
  const enrolled = enrolledProgramSlugs(child);
  return offers
    .filter((offer) => {
      const programSlugs = offerProgramSlugs(offer);
      return programSlugs.length > 0 && programSlugs.some((slug) => !enrolled.has(slug));
    })
    .sort((left, right) => {
      if (left.slug === "full-bundle") return -1;
      if (right.slug === "full-bundle") return 1;
      return 0;
    });
}

function programTabLabel(course: ParentChild["courses"][number]) {
  const title = displayProgramTitle(course.programSlug || course.title).toLowerCase();
  if (title.includes("arabic") || title.includes("tajweed")) return "Arabic & Tajweed";
  if (title.includes("seerah")) return "Seerah";
  if (title.includes("life") || title.includes("leadership")) return "Leadership";
  return course.title;
}

function courseOwnsProgramTitle(course: ParentChild["courses"][number], programTitle: string) {
  return (course.programTitles ?? [course.title]).some(
    (title) => title === programTitle || displayProgramTitle(title) === displayProgramTitle(programTitle),
  );
}

function courseHref(childId: string, courseId: string, lessonId?: string) {
  const params = new URLSearchParams({ child: childId, course: courseId });
  if (lessonId) params.set("lesson", lessonId);
  return `/parent/courses?${params.toString()}`;
}

export default async function ParentCoursesPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const dashboard = await getParentDashboardData(session.user.id);
  if (!dashboard) redirect("/registration");
  if (!dashboard.children.length) {
    if (dashboard.pendingRegistrationId) {
      redirect(`/registration/pending/${dashboard.pendingRegistrationId}`);
    }
    redirect("/registration");
  }

  const params = searchParams ? await searchParams : undefined;
  const selectedChild =
    dashboard.children.find((child) => child.id === params?.child) ?? dashboard.children[0];
  const selectedCourse = selectedChild.courses.find((course) => course.id === params?.course) ?? selectedChild.courses[0] ?? null;
  const selectedProgramIds = selectedCourse?.programIds?.length ? selectedCourse.programIds : selectedCourse?.programId ? [selectedCourse.programId] : [];
  const showProgramEnrollmentModal = params?.enrollProgram === "1" && !hasFullGenM(selectedChild);
  const selectedLessonUpdates = selectedCourse
    ? selectedChild.lessonUpdates.filter((update) => courseOwnsProgramTitle(selectedCourse, update.programTitle))
    : [];
  const selectedLesson =
    selectedLessonUpdates.find((lesson) => lesson.id === params?.lesson) ?? selectedLessonUpdates[0] ?? null;
  const selectedAssignments = selectedCourse
    ? selectedChild.assignments.filter((assignment) => courseOwnsProgramTitle(selectedCourse, assignment.programTitle))
    : [];
  let materials: Awaited<ReturnType<typeof listMaterials>> = [];
  if (selectedProgramIds.length) {
    try {
      materials = (
        await Promise.all(
          selectedProgramIds.map((programId) =>
            listMaterials({ programId, status: "approved", visibility: "students_parents", limit: 20, studentId: selectedChild.id }),
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
  let options = { offers: [], countries: [] } as Awaited<ReturnType<typeof getRegistrationOptions>>;
  if (showProgramEnrollmentModal) {
    try {
      options = await getRegistrationOptions();
    } catch (error) {
      console.error("Failed to load registration options for program enrollment modal", error);
    }
  }
  const programEnrollmentOffers = showProgramEnrollmentModal ? eligibleProgramOffers(options.offers, selectedChild) : [];

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Courses"
      subtitle="Review live sessions and open each programme curriculum exactly as teachers publish it."
      navItems={getParentNavItems(selectedChild?.id)}
      pendingReason={dashboard.pendingReason}
    >
      <SectionCard
        eyebrow="Child selector"
        title="Choose a learner"
        action={
          !hasFullGenM(selectedChild) ? (
            <Link
              href={`/parent/courses?child=${selectedChild.id}&enrollProgram=1`}
              className="rounded-full bg-[#f39f5f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e07e2b]"
            >
              Explore other programmes
            </Link>
          ) : null
        }
      >
        <ChildSelector
          learners={dashboard.children.map((child) => ({ id: child.id, name: child.name }))}
          selectedChildId={selectedChild?.id}
          basePath="/parent/courses"
        />
      </SectionCard>

      <MetricGrid
        metrics={[
          { label: "Courses", value: String(selectedChild.courses.length), hint: "Current enrolled programmes." },
          { label: "Assignments", value: String(selectedChild.assignments.length), hint: "Coursework and homework items." },
          { label: "Schedule slots", value: String(selectedChild.schedule.length), hint: "Live class slots for the child." },
          { label: "Access", value: selectedChild.accessLocked ? "Locked" : "Unlocked", hint: "Controlled by payment confirmation." },
        ]}
      />

      <SectionCard
        eyebrow="Live sessions"
        title="Scheduled sessions overview"
        action={<Link href={`/parent/schedule?child=${selectedChild.id}`} className="rounded-full bg-[#22304a] px-4 py-2 text-sm font-semibold text-white">Open full schedule</Link>}
      >
        <div className={`grid gap-2 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
          {selectedChild.schedule.slice(0, 4).map((session) => (
            <div key={session.id} className="grid gap-2 rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm text-[#4d5a6b] md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
              <p className="font-semibold text-[#22304a]">{session.title}</p>
              <p>{session.startTime}-{session.endTime} {session.timezone}</p>
              <p className="text-xs text-[#6d7785]">{session.teacherName ?? "Teacher assigned"}</p>
            </div>
          ))}
          {!selectedChild.schedule.length ? (
            <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm text-[#5f6b7a]">Scheduled live classes will appear here.</p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Programmes"
        title={`${selectedChild.name}'s curriculum`}
        action={
          !hasFullGenM(selectedChild) ? (
            <Link
              href={`/parent/courses?child=${selectedChild.id}&enrollProgram=1`}
              className="rounded-full border border-[#d8e3ed] bg-white px-4 py-2 text-sm font-semibold text-[#22304a] transition hover:bg-[#f7fbff]"
            >
              Enroll another programme
            </Link>
          ) : null
        }
      >
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {selectedChild.courses.map((course) => (
            <Link
              key={`${course.id}-tab`}
              href={courseHref(selectedChild.id, course.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                selectedCourse?.id === course.id ? "bg-[#22304a] text-white" : "border border-[#eadfce] bg-white text-[#22304a]"
              }`}
            >
              {programTabLabel(course)}
            </Link>
          ))}
        </div>
        {false ? (
        <div className={`grid gap-4 lg:grid-cols-2 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
          {selectedChild.courses.filter((course) => course.id === selectedCourse?.id).map((course) => (
            <div key={course.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-[#22304a]">{course.title}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                  {course.status}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-[#c27a2c]">
                Instructors: {course.teachers.map((teacher) => teacher.name).slice(0, 2).join(", ") || "Assigned soon"}
              </p>
              {course.strapline ? <p className="mt-2 text-sm text-[#5f6b7a]">{course.strapline}</p> : null}
              <div className="mt-3 grid gap-2 text-sm text-[#5f6b7a] sm:grid-cols-2">
                <p>Started: {formatDate(course.startedAt)}</p>
              <p>Weekly slots: {course.meetingCount}</p>
            </div>
              {course.roomAssignment?.roomName || course.roomAssignment?.roomCode ? (
                <div className="mt-4 rounded-[18px] border border-[#c7dff5] bg-[#eef6ff] p-4 text-sm text-[#2a4f72]">
                  <p className="font-semibold text-[#22304a]">Zoom room/group for this child</p>
                  <p className="mt-1">{course.roomAssignment.roomName ?? "Assigned room"}</p>
                  {course.roomAssignment.roomCode ? <p className="mt-1">Room code: {course.roomAssignment.roomCode}</p> : null}
                  {course.roomAssignment.teacherName ? <p className="mt-1">Teacher: {course.roomAssignment.teacherName}</p> : null}
                  {course.roomAssignment.level ? <p className="mt-1">Level: {course.roomAssignment.level}</p> : null}
                  {course.roomAssignment.instructions ? <p className="mt-2 leading-6">{course.roomAssignment.instructions}</p> : null}
                </div>
              ) : null}
              {course.upcomingSessions.length ? (
                <div className="mt-4 rounded-[18px] bg-[#22304a] p-4 text-white">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                    Upcoming sessions
                  </p>
                  <div className="mt-3 space-y-3">
                    {course.upcomingSessions.map((session) => (
                      <div key={session.id} className="rounded-[16px] bg-white/10 p-3">
                        <p className="font-semibold">{session.provider ?? "Live class"}</p>
                        <p className="mt-1 text-sm text-white/75">
                          {session.startTime}-{session.endTime} {session.timezone}
                        </p>
                        <LiveClassCountdown
                          startsAt={session.nextStartsAt.toISOString()}
                          meetingUrl={session.meetingUrl}
                          accessLocked={selectedChild.accessLocked}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {course.recentLessonTopics.length || course.currentTaskTitles.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {course.recentLessonTopics.slice(0, 2).map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]"
                    >
                      Lesson: {topic}
                    </span>
                  ))}
                  {course.currentTaskTitles.slice(0, 2).map((task) => (
                    <span
                      key={task}
                      className="rounded-full bg-[#22304a] px-3 py-1 text-xs font-semibold text-white"
                    >
                      Task: {task}
                    </span>
                  ))}
                </div>
              ) : null}
              {(course.recentLessonCards.length || course.currentTaskCards.length) ? (
                <div className="mt-4 space-y-3">
                  {course.recentLessonCards.length ? (
                    <div className="rounded-[18px] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                        Latest lesson updates
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-[#5f6b7a]">
                        {course.recentLessonCards.map((lesson) => (
                          <div key={lesson.id} className="rounded-[14px] border border-[#eef2f5] px-3 py-2">
                            <p className="font-semibold text-[#22304a]">{lesson.topic}</p>
                            <p className="mt-1 text-xs text-[#6d7785]">
                              By {lesson.teacherName ?? "Assigned teacher"}
                              {lesson.weekLabel ? ` • ${lesson.weekLabel}` : ""}
                              {lesson.contentType ? ` • ${lesson.contentType}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {course.currentTaskCards.length ? (
                    <div className="rounded-[18px] bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c27a2c]">
                        Current tasks
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-[#5f6b7a]">
                        {course.currentTaskCards.map((task) => (
                          <div key={task.id} className="rounded-[14px] border border-[#eef2f5] px-3 py-2">
                            <p className="font-semibold text-[#22304a]">{task.title}</p>
                            <p className="mt-1 text-xs text-[#6d7785]">
                              By {task.teacherName ?? "Assigned teacher"}
                              {task.weekLabel ? ` • ${task.weekLabel}` : ""}
                              {task.taskCategory ? ` • ${task.taskCategory}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        ) : selectedCourse ? (
          <div className="mt-5 grid gap-3 rounded-[22px] bg-[#fbf6ef] p-4 text-sm text-[#4d5a6b] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <h3 className="text-lg font-semibold text-[#22304a]">{selectedCourse.title}</h3>
              <p className="mt-1">Teacher: {selectedCourse.roomAssignment?.teacherName ?? (selectedCourse.teachers.map((teacher) => teacher.name).slice(0, 2).join(", ") || "Assigned soon")}</p>
              {selectedCourse.roomAssignment?.roomName || selectedCourse.roomAssignment?.roomCode ? (
                <p className="mt-1 text-xs text-[#6d7785]">
                  Group: {selectedCourse.roomAssignment.roomName ?? "Assigned group"}
                  {selectedCourse.roomAssignment.roomCode ? ` - ${selectedCourse.roomAssignment.roomCode}` : ""}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">{selectedLessonUpdates.length} lessons</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">{selectedAssignments.length} tasks</span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">{materials.length} materials</span>
            </div>
          </div>
        ) : null}
      </SectionCard>

      {false && selectedCourse ? (
        <SectionCard eyebrow="Weekly lessons" title={`${selectedCourse.title} lesson content`}>
          <div className={`space-y-4 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
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
                Weekly lessons and attached resources will appear here after the teacher publishes them.
              </p>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      {false ? (
      <SectionCard eyebrow="Course library" title="Approved materials">
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
                    <p className="mt-1 text-xs text-[#617184]">{material.programTitle ?? "Program material"}</p>
                  </a>
                ))}
              </div>
            </div>
          ))}
          {!materials.length ? (
            <p className="rounded-[20px] bg-[#fbf6ef] p-5 text-sm text-[#5f6b7a]">
              Approved course materials will appear here after teacher uploads are approved.
            </p>
          ) : null}
        </div>
      </SectionCard>
      ) : null}

      {false ? (
      <SectionCard eyebrow="Assignments" title="Coursework tracking">
        <div id="parent-assignments" />
        <div className={`space-y-4 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
          {selectedChild.assignments.map((assignment) => (
            <details key={assignment.id} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-[#22304a]">{assignment.title}</h3>
                    <p className="mt-2 text-sm text-[#5f6b7a]">
                      {assignment.programTitle} • {assignment.status.replace(/_/g, " ")} • Due {formatDate(assignment.dueDate)}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#22304a]">
                    {assignment.score === null ? "Pending" : `${assignment.score} pts`}
                  </span>
                </div>
              </summary>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[#5f6b7a]">
                <p>Grade: {assignment.grade ? assignment.grade.replace(/_/g, " ") : "Pending"}</p>
                {assignment.familyNote ? <p>{assignment.familyNote}</p> : null}
                {assignment.instructions ? <p>{assignment.instructions}</p> : null}
              </div>
            </details>
          ))}
        </div>
      </SectionCard>
      ) : null}

      {selectedCourse ? (
        <SectionCard eyebrow="Curriculum" title={`${selectedCourse.title} LMS viewer`}>
          <div className={`grid gap-4 rounded-[24px] bg-[#fbf6ef] p-4 lg:grid-cols-[320px_minmax(0,1fr)] ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
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
                                  href={`/parent/courses?child=${selectedChild.id}&course=${selectedCourse.id}&lesson=${lesson.id}`}
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
                      <Link href={`/parent/quizzes?child=${selectedChild.id}`} className="rounded-full bg-[#eef5fb] px-3 py-1.5 text-xs font-semibold text-[#2a76aa]">Quizzes</Link>
                      <a href="#parent-assignments" className="rounded-full bg-[#fff4e8] px-3 py-1.5 text-xs font-semibold text-[#b46b1e]">Tasks</a>
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
                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-[18px] bg-[#fbf6ef] p-4">
                      <p className="text-sm font-semibold text-[#22304a]">Uploaded materials</p>
                      <div className="mt-3 grid gap-2">
                        {materials.slice(0, 6).map((material) => (
                          <a key={material.id} href={material.webViewLink ?? "#"} target="_blank" className="rounded-2xl bg-white px-4 py-3 text-sm">
                            <p className="font-semibold text-[#22304a]">{material.name}</p>
                            <p className="mt-1 text-xs text-[#617184]">
                              {material.folderName ?? "General"}{material.uploadedBy ? ` - ${material.uploadedBy}` : ""}
                            </p>
                          </a>
                        ))}
                        {!materials.length ? <p className="text-sm leading-6 text-[#5f6b7a]">Teacher uploads for this programme will appear here.</p> : null}
                      </div>
                    </div>
                    <div className="rounded-[18px] bg-[#fbf6ef] p-4">
                      <p className="text-sm font-semibold text-[#22304a]">Tasks for this programme</p>
                      <div className="mt-3 grid gap-2">
                        {selectedAssignments.slice(0, 6).map((assignment) => (
                          <div key={assignment.id} className="rounded-2xl bg-white px-4 py-3 text-sm">
                            <p className="font-semibold text-[#22304a]">{assignment.title}</p>
                            <p className="mt-1 text-xs text-[#617184]">
                              {assignment.status.replace(/_/g, " ")} - Due {formatDate(assignment.dueDate)}
                            </p>
                          </div>
                        ))}
                        {!selectedAssignments.length ? <p className="text-sm leading-6 text-[#5f6b7a]">Teacher tasks for this programme will appear here.</p> : null}
                      </div>
                    </div>
                  </div>
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

      {false ? (
      <SectionCard eyebrow="Curriculum" title="Whole programme plan">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {selectedChild.courses.map((course) => (
            <Link
              key={`${course.id}-curriculum-tab`}
              href={`/parent/courses?child=${selectedChild.id}&course=${course.id}`}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                selectedCourse?.id === course.id ? "bg-[#22304a] text-white" : "border border-[#eadfce] bg-white text-[#22304a]"
              }`}
            >
              {course.title}
            </Link>
          ))}
        </div>
        <div className={`space-y-5 ${selectedChild.accessLocked ? "opacity-60" : ""}`}>
          {selectedChild.courses.filter((course) => course.id === selectedCourse?.id).map((course) => (
            <div key={`${course.id}-curriculum`} className="rounded-[24px] bg-[#fbf6ef] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-semibold text-[#22304a]">{course.title}</h3>
                <span className="rounded-full bg-[#22304a] px-3 py-1 text-xs font-semibold text-white">
                  {course.termPlans.length} terms
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <details className="rounded-[20px] bg-white p-4">
                  <summary className="cursor-pointer text-sm font-semibold text-[#22304a]">
                    Key outcomes and weekly rhythm
                  </summary>
                  <div className="mt-3 grid gap-4 text-sm leading-7 text-[#5f6b7a] xl:grid-cols-2">
                    <ul className="space-y-2">
                      {course.outcomes.slice(0, 4).map((outcome) => (
                        <li key={outcome}>• {outcome}</li>
                      ))}
                    </ul>
                    <ul className="space-y-2">
                      {course.weeklySchedule.slice(0, 5).map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </details>
                {course.termPlans.map((term) => (
                  <details key={term.id} className="rounded-[20px] bg-white p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-[#22304a]">
                      {term.title} • {term.level} • {term.window}
                    </summary>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-[#5f6b7a]">
                      {term.highlights.slice(0, 4).map((highlight) => (
                        <li key={highlight}>• {highlight}</li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
      ) : null}
      {showProgramEnrollmentModal ? (
        <AddChildEnrollmentModal
          parent={{
            parentName: dashboard.parentName,
            parentEmail: dashboard.parentProfile.email,
            phoneCountryCode: dashboard.parentProfile.phoneCountryCode,
            phoneNumber: dashboard.parentProfile.phoneNumber,
            billingCountryCode: dashboard.parentProfile.billingCountryCode,
            billingCountryName: dashboard.parentProfile.billingCountryName,
          }}
          offers={programEnrollmentOffers}
          countries={options.countries}
          existingChild={{
            id: selectedChild.id,
            name: selectedChild.name,
            firstName: selectedChild.profile.firstName,
            lastName: selectedChild.profile.lastName,
            age: selectedChild.profile.age,
            gender: selectedChild.profile.gender,
          }}
          closePath={`/parent/courses?child=${selectedChild.id}`}
        />
      ) : null}
    </FamilyDashboardFrame>
  );
}
