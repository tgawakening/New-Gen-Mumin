import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { getParentCommunityData, postParentSupervisedCommunityMessage } from "@/lib/community/rooms";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { QabilaIdentity } from "@/components/community/QabilaIdentity";
import {
  ChildSelector,
  CompactList,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string; section?: string; room?: string; mode?: string; posted?: string; error?: string }>;
};

function childName(child: { displayName: string | null; user: { firstName: string; lastName: string } }) {
  return child.displayName || `${child.user.firstName} ${child.user.lastName}`.trim() || child.user.firstName;
}

function authorName(author: { firstName: string; lastName: string; role: string }) {
  if (author.role === "STUDENT") return `${author.firstName} ${author.lastName.slice(0, 1)}.`;
  return `${author.firstName} ${author.lastName}`.trim();
}

export default async function ParentCommunityPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "PARENT") redirect(getDashboardHome(session.user.role));

  const params = searchParams ? await searchParams : {};
  const [dashboard, community] = await Promise.all([
    getParentDashboardData(session.user.id),
    getParentCommunityData(session.user.id, params.child),
  ]);
  if (!dashboard || !community) redirect("/registration");

  const selectedChildId = community.selectedChild?.id ?? dashboard.children[0]?.id;
  const childMode = params.mode === "child";
  const qabilaRooms = community.memberships.filter((membership) => membership.room.type === "PROJECT_TEAM");
  const announcementRooms = community.memberships.filter((membership) => ["ANNOUNCEMENT", "PARENT_NOTICE"].includes(membership.room.type));
  const programmeRooms = community.memberships.filter((membership) => !["PROJECT_TEAM", "ANNOUNCEMENT", "PARENT_NOTICE"].includes(membership.room.type));
  const section = params.section === "programmes" || params.section === "announcements" ? params.section : qabilaRooms.length ? "qabila" : "programmes";
  const sectionRooms = section === "qabila" ? qabilaRooms : section === "announcements" ? announcementRooms : programmeRooms;
  const selectedRoom = sectionRooms.find((membership) => membership.room.id === params.room) ?? sectionRooms[0] ?? null;
  const visibleMemberships = selectedRoom ? [selectedRoom] : [];
  const visibleMessages = community.memberships.reduce((sum, membership) => sum + membership.room.messages.length, 0);
  const projectCount = community.memberships.reduce((sum, membership) => sum + membership.room.projects.length, 0);
  const modeSuffix = childMode ? "&mode=child" : "";
  const tabHref = (nextSection: string) => `/parent/community?child=${selectedChildId}&section=${nextSection}${modeSuffix}`;
  async function postAsChild(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "PARENT") redirect("/auth/login");
    const studentId = String(formData.get("studentId") || "");
    try {
      await postParentSupervisedCommunityMessage({
        parentUserId: current.user.id,
        studentId,
        roomId: String(formData.get("roomId") || ""),
        body: String(formData.get("body") || ""),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to post message.";
      redirect(`/parent/community?child=${studentId}&mode=child&error=${encodeURIComponent(message)}`);
    }
    revalidatePath("/parent/community");
    revalidatePath("/student/community");
    revalidatePath("/teacher/community");
    redirect(`/parent/community?child=${studentId}&mode=child&posted=1`);
  }
  return (
    <FamilyDashboardFrame
      roleLabel={childMode ? "Parent-supervised Child View" : "Parent Dashboard"}
      title={childMode ? "My Qabila Chat" : "Community Visibility"}
      subtitle={childMode ? "Talk with your Qabila teammates in a supervised space. Assigned teachers and admins can see every message." : "Review supervised room membership and visible class discussion summaries for your child."}
      navItems={getParentNavItems(selectedChildId)}
      pendingReason={dashboard.pendingReason}
    >
      <ActionToast message={params.error ?? (params.posted ? "Message posted to the Qabila." : undefined)} tone={params.error ? "error" : "success"} />
      <MetricGrid
        metrics={[
          { label: "Children", value: String(community.children.length), hint: "Linked learners." },
          { label: "Rooms", value: String(community.memberships.length), hint: "Supervised spaces assigned." },
          { label: "Messages", value: String(visibleMessages), hint: "Recent visible discussion items." },
          { label: "Projects", value: String(projectCount), hint: "Guided collaboration work." },
          { label: "Mode", value: childMode ? "Child conversation" : "Read-only", hint: childMode ? "Posting as the selected learner; mentor supervised." : "Parents see transparency without entering student rooms." },
        ]}
      />

      <SectionCard eyebrow="Child selector" title="Choose learner" icon="star">
        <ChildSelector
          learners={community.children.map((child) => ({ id: child.id, name: childName(child) }))}
          selectedChildId={selectedChildId}
          basePath={childMode ? "/parent/community?mode=child" : "/parent/community"}
        />
      </SectionCard>
      <SectionCard eyebrow="Community areas" title="Choose what you want to review" icon="sun">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "qabila", label: "My Qabila", count: qabilaRooms.length },
            { key: "programmes", label: "Programme Rooms", count: programmeRooms.length },
            { key: "announcements", label: "Announcements", count: announcementRooms.length },
          ].map((tab) => <Link key={tab.key} href={tabHref(tab.key)} aria-current={section === tab.key ? "page" : undefined} className={`rounded-full border px-4 py-2 text-sm font-semibold ${section === tab.key ? "border-[#22304a] bg-[#22304a] text-white" : "border-[#d8e3ed] bg-white text-[#22304a]"}`}>{tab.label} <span className="ml-1 opacity-70">({tab.count})</span></Link>)}
        </div>
        {sectionRooms.length > 1 ? <div className="mt-3 flex flex-wrap gap-2 border-t border-[#eadfce] pt-3">
          {sectionRooms.map((membership) => <Link key={membership.id} href={`${tabHref(section)}&room=${membership.room.id}`} aria-current={selectedRoom?.id === membership.id ? "page" : undefined} className={`rounded-xl px-3 py-2 text-xs font-semibold ${selectedRoom?.id === membership.id ? "bg-[#fff0d9] text-[#9a5b16]" : "bg-[#f3f6f9] text-[#526174]"}`}>{membership.room.title}</Link>)}
        </div> : null}
        <p className="mt-3 text-xs leading-5 text-[#617184]">
          {section === "qabila" ? "Your child's main team space, shared only with their Qabila and assigned mentors." : section === "programmes" ? "Course-specific discussion rooms are kept here, separate from Qabila teamwork." : "Read-only notices and faculty updates."}
        </p>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <div className="space-y-6">
          {visibleMemberships.map((membership) => (
            <SectionCard key={membership.id} eyebrow={membership.room.type.replace(/_/g, " ")} title={membership.room.title} icon="sun">
              <div className="space-y-3">
                {membership.room.type === "PROJECT_TEAM" ? <QabilaIdentity name={membership.room.title} /> : null}
                <p className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm leading-6 text-[#5f6b7a]">
                  {membership.room.description ?? "Mentor-supervised class room."}
                </p>
                {membership.room.projects.map((project) => (
                  <div key={project.id} className="rounded-[20px] border border-[#eadfce] bg-white p-4 text-sm">
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
                    {project.submissions.map((submission) => (
                      <p key={submission.id} className="mt-3 whitespace-pre-wrap rounded-2xl bg-[#fbf6ef] px-4 py-3 leading-6 text-[#4d5a6b]">
                        {submission.submissionText}
                      </p>
                    ))}
                  </div>
                ))}
                {childMode && section === "qabila" && !membership.room.isReadOnly ? (
                  <form action={postAsChild} className="grid gap-3 rounded-[20px] border border-[#eadfce] bg-white p-4">
                    <input type="hidden" name="studentId" value={selectedChildId} />
                    <input type="hidden" name="roomId" value={membership.room.id} />
                    <label className="grid gap-2 text-sm font-semibold text-[#22304a]">
                      Message your Qabila
                      <textarea name="body" required maxLength={800} rows={3} placeholder="Share an idea, question, or kind encouragement. Do not share phone numbers, emails, or links." className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                    </label>
                    <button className="w-fit rounded-full bg-[#22304a] px-5 py-2.5 text-sm font-semibold text-white">Send to my Qabila</button>
                    <p className="text-xs leading-5 text-[#617184]">Posted as {community.selectedChild ? childName(community.selectedChild) : "the selected learner"}. Teachers and admins supervise this room.</p>
                  </form>
                ) : null}
                {membership.room.messages.map((message) => (
                  <div key={message.id} className="rounded-[18px] bg-[#fbf6ef] p-4 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[#22304a]">{authorName(message.author)}</p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#2f6b4b]">Visible</span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap leading-6 text-[#4d5a6b]">{message.body}</p>
                    <p className="mt-2 text-xs text-[#6d7785]">{formatDate(message.createdAt)}</p>
                  </div>
                ))}
                {!membership.room.messages.length ? (
                  <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
                    No visible room messages yet.
                  </p>
                ) : null}
              </div>
            </SectionCard>
          ))}
          {!visibleMemberships.length ? (
            <SectionCard eyebrow="Community" title="No rooms assigned yet" icon="sun">
              <p className="text-sm leading-7 text-[#5f6b7a]">
                No room is assigned in this section yet.
              </p>
            </SectionCard>
          ) : null}
        </div>

        <SectionCard eyebrow="Safety rules" title="Parent view" icon="check">
          <CompactList
            items={[
              { label: childMode ? "Child conversation mode" : "Read-only transparency", meta: childMode ? "Posts use the selected learner identity" : "Parents do not enter student chat", icon: "check" },
              { label: "Flagged content hidden", meta: "Admin reviews risky messages", icon: "check" },
              { label: "No private mixed chat", meta: "Structured room model", icon: "sun" },
              { label: "Mentor-visible history", meta: "Designed for safety", icon: "star" },
            ]}
            emptyLabel="Safety rules will appear here."
          />
        </SectionCard>
      </div>
    </FamilyDashboardFrame>
  );
}
