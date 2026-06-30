import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getStudentDashboardData } from "@/lib/dashboard/family";
import { getStudentNavItems } from "@/lib/dashboard/family-nav";
import { getStudentCommunityData, postCommunityMessage, submitCommunityProjectWork } from "@/lib/community/rooms";
import { ActionToast } from "@/components/dashboard/ActionToast";
import {
  CompactList,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ posted?: string; flagged?: string; project?: string; error?: string }>;
};

function displayName(user: { firstName: string; lastName: string; role: string }) {
  if (user.role === "STUDENT") return `${user.firstName} ${user.lastName.slice(0, 1)}.`;
  return `${user.firstName} ${user.lastName}`.trim();
}

export default async function StudentCommunityPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "STUDENT") redirect(getDashboardHome(session.user.role));

  const [dashboard, community] = await Promise.all([
    getStudentDashboardData(session.user.id),
    getStudentCommunityData(session.user.id),
  ]);
  if (!dashboard || !community) redirect("/auth/login");

  const params = searchParams ? await searchParams : {};
  const roomCount = community.memberships.length;
  const messageCount = community.memberships.reduce((sum, membership) => sum + membership.room.messages.length, 0);
  const flaggedCount = community.memberships.reduce(
    (sum, membership) => sum + membership.room.messages.filter((message) => message.status === "FLAGGED").length,
    0,
  );

  async function postMessage(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "STUDENT") redirect("/auth/login");

    const roomId = String(formData.get("roomId") || "");
    const body = String(formData.get("body") || "");
    try {
      const message = await postCommunityMessage({
        userId: currentSession.user.id,
        roomId,
        body,
      });

      revalidatePath("/student/community");
      redirect(message.status === "FLAGGED" ? "/student/community?flagged=1" : "/student/community?posted=1");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to post message.";
      redirect(`/student/community?error=${encodeURIComponent(message)}`);
    }
  }

  async function submitProject(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "STUDENT") redirect("/auth/login");

    const projectId = String(formData.get("projectId") || "");
    const submissionText = String(formData.get("submissionText") || "");
    try {
      await submitCommunityProjectWork({
        userId: currentSession.user.id,
        projectId,
        submissionText,
      });

      revalidatePath("/student/community");
      redirect("/student/community?project=1");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit project work.";
      redirect(`/student/community?error=${encodeURIComponent(message)}`);
    }
  }

  return (
    <FamilyDashboardFrame
      roleLabel="Student Dashboard"
      title="Safe Community"
      subtitle="Join supervised class circles, ask questions, and keep every discussion respectful and mentor-visible."
      navItems={getStudentNavItems()}
      pendingReason={dashboard.pendingReason}
    >
      <ActionToast
        message={
          params.error ??
          (params.flagged
            ? "Message received and sent to mentors for review because it may contain private contact details or a link."
            : params.project
              ? "Project work submitted for mentor review."
            : params.posted
              ? "Message posted."
              : undefined)
        }
        tone={params.error ? "error" : "success"}
      />

      <MetricGrid
        metrics={[
          { label: "Rooms", value: String(roomCount), hint: "Supervised spaces assigned to you." },
          { label: "Messages", value: String(messageCount), hint: "Recent visible room activity." },
          { label: "Safety alerts", value: String(flaggedCount), hint: "Messages waiting for mentor review." },
          { label: "Mode", value: "Supervised", hint: "No uncontrolled private messaging." },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <div className="space-y-6">
          {community.memberships.map((membership) => (
            <SectionCard key={membership.id} eyebrow={membership.room.type.replace(/_/g, " ")} title={membership.room.title} icon="sun">
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm leading-6 text-[#5f6b7a]">
                  {membership.room.description ?? "Mentor-supervised room."}
                </div>
                {membership.room.projects.length ? (
                  <div className="space-y-3">
                    {membership.room.projects.map((project) => (
                      <details key={project.id} className="rounded-[22px] border border-[#eadfce] bg-white p-4" open={project.submissions.length === 0}>
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[#22304a]">{project.title}</p>
                              <p className="mt-1 text-xs text-[#6d7785]">
                                {project.dueDate ? `Due ${formatDate(project.dueDate)}` : "No due date"} - {project.tasks.length} guided steps
                              </p>
                            </div>
                            <span className="rounded-full bg-[#fbf6ef] px-3 py-1 text-xs font-semibold text-[#22304a]">
                              {project.submissions.length ? "Submitted" : "Open"}
                            </span>
                          </div>
                        </summary>
                        <div className="mt-4 grid gap-4">
                          {project.description ? <p className="text-sm leading-7 text-[#4d5a6b]">{project.description}</p> : null}
                          <div className="grid gap-2">
                            {project.tasks.map((task) => (
                              <div key={task.id} className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm">
                                <p className="font-semibold text-[#22304a]">{task.title}</p>
                                {task.description ? <p className="mt-1 text-[#617184]">{task.description}</p> : null}
                              </div>
                            ))}
                          </div>
                          <form action={submitProject} className="grid gap-3 rounded-[18px] bg-[#fbf6ef] p-4">
                            <input type="hidden" name="projectId" value={project.id} />
                            <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                              Share completed project work
                              <textarea
                                name="submissionText"
                                rows={4}
                                maxLength={1500}
                                required
                                placeholder="Paste your project answer, reflection, script, or presentation summary. Do not include phone numbers, emails, or external links."
                                className="rounded-2xl border border-[#d8e3ed] bg-white px-4 py-3 text-sm"
                              />
                            </label>
                            <button className="w-fit rounded-full bg-[#2f6b4b] px-5 py-2.5 text-sm font-semibold text-white">
                              Submit project work
                            </button>
                          </form>
                          {project.submissions.map((submission) => (
                            <div key={submission.id} className="rounded-2xl border border-[#dfe7ef] bg-white px-4 py-3 text-sm">
                              <p className="font-semibold text-[#22304a]">Your latest submission</p>
                              <p className="mt-2 whitespace-pre-wrap leading-6 text-[#4d5a6b]">{submission.submissionText}</p>
                              {submission.mentorFeedback ? <p className="mt-2 text-[#2f6b4b]">Mentor feedback: {submission.mentorFeedback}</p> : null}
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : null}
                <form action={postMessage} className="grid gap-3 rounded-[22px] border border-[#eadfce] bg-white p-4">
                  <input type="hidden" name="roomId" value={membership.room.id} />
                  <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                    Message
                    <textarea
                      name="body"
                      rows={3}
                      maxLength={800}
                      required
                      placeholder="Share a class question or respectful reflection. Links and contact details are sent to review."
                      className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm"
                    />
                  </label>
                  <button className="w-fit rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white">
                    Post safely
                  </button>
                </form>
                <div className="space-y-3">
                  {membership.room.messages.map((message) => (
                    <div key={message.id} className="rounded-[18px] bg-[#fbf6ef] p-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold text-[#22304a]">{displayName(message.author)}</p>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${message.status === "FLAGGED" ? "bg-[#fff7eb] text-[#8a6326]" : "bg-white text-[#2f6b4b]"}`}>
                          {message.status === "FLAGGED" ? "Mentor review" : "Visible"}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap leading-6 text-[#4d5a6b]">{message.body}</p>
                      <p className="mt-2 text-xs text-[#6d7785]">{formatDate(message.createdAt)}</p>
                    </div>
                  ))}
                  {!membership.room.messages.length ? (
                    <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
                      This room is ready. Start with a class question or reflection.
                    </p>
                  ) : null}
                </div>
              </div>
            </SectionCard>
          ))}

          {!community.memberships.length ? (
            <SectionCard eyebrow="Community" title="No rooms assigned yet" icon="sun">
              <p className="text-sm leading-7 text-[#5f6b7a]">
                Your supervised class rooms will appear here once your active enrollments are assigned.
              </p>
            </SectionCard>
          ) : null}
        </div>

        <SectionCard eyebrow="Safety rules" title="Community guardrails" icon="check">
          <CompactList
            items={[
              { label: "No phone numbers or emails", meta: "Automatically flagged", icon: "check" },
              { label: "No external links", meta: "Sent to mentor review", icon: "check" },
              { label: "No uncontrolled private chat", meta: "Room-based MVP", icon: "check" },
              { label: "Mentor-visible logs", meta: "Designed for trust", icon: "star" },
            ]}
            emptyLabel="Safety rules will appear here."
          />
        </SectionCard>
      </div>
    </FamilyDashboardFrame>
  );
}
