import { redirect } from "next/navigation";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { getParentCommunityData } from "@/lib/community/rooms";
import {
  ChildSelector,
  CompactList,
  FamilyDashboardFrame,
  MetricGrid,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string }>;
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
  const visibleMessages = community.memberships.reduce((sum, membership) => sum + membership.room.messages.length, 0);
  const projectCount = community.memberships.reduce((sum, membership) => sum + membership.room.projects.length, 0);

  return (
    <FamilyDashboardFrame
      roleLabel="Parent Dashboard"
      title="Community Visibility"
      subtitle="Review supervised room membership and visible class discussion summaries for your child."
      navItems={getParentNavItems(selectedChildId)}
      pendingReason={dashboard.pendingReason}
    >
      <MetricGrid
        metrics={[
          { label: "Children", value: String(community.children.length), hint: "Linked learners." },
          { label: "Rooms", value: String(community.memberships.length), hint: "Supervised spaces assigned." },
          { label: "Messages", value: String(visibleMessages), hint: "Recent visible discussion items." },
          { label: "Projects", value: String(projectCount), hint: "Guided collaboration work." },
          { label: "Mode", value: "Read-only", hint: "Parents see transparency without entering student rooms." },
        ]}
      />

      <SectionCard eyebrow="Child selector" title="Choose learner" icon="star">
        <ChildSelector
          learners={community.children.map((child) => ({ id: child.id, name: childName(child) }))}
          selectedChildId={selectedChildId}
          basePath="/parent/community"
        />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
        <div className="space-y-6">
          {community.memberships.map((membership) => (
            <SectionCard key={membership.id} eyebrow={membership.room.type.replace(/_/g, " ")} title={membership.room.title} icon="sun">
              <div className="space-y-3">
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
          {!community.memberships.length ? (
            <SectionCard eyebrow="Community" title="No rooms assigned yet" icon="sun">
              <p className="text-sm leading-7 text-[#5f6b7a]">
                Supervised rooms will appear once active enrollments are assigned.
              </p>
            </SectionCard>
          ) : null}
        </div>

        <SectionCard eyebrow="Safety rules" title="Parent view" icon="check">
          <CompactList
            items={[
              { label: "Read-only transparency", meta: "Parents do not enter student chat", icon: "check" },
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
