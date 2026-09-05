import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { getParentDashboardData } from "@/lib/dashboard/family";
import { getParentNavItems } from "@/lib/dashboard/family-nav";
import { deleteParentSupervisedCommunityMessage, editParentSupervisedCommunityMessage, getParentCommunityData, postParentSupervisedCommunityMessage, formatQabilaMessage } from "@/lib/community/rooms";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { QabilaIdentity } from "@/components/community/QabilaIdentity";
import { CommunityVoiceRecorder } from "@/components/community/CommunityVoiceRecorder";
import { QabilaMessageComposer } from "@/components/community/QabilaMessageComposer";
import {
  ChildSelector,
  CompactList,
  FamilyDashboardFrame,
  SectionCard,
  formatDate,
} from "@/components/dashboard/family/FamilyDashboardFrame";

type PageProps = {
  searchParams?: Promise<{ child?: string; section?: string; room?: string; mode?: string; posted?: string; error?: string; reply?: string }>;
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
  const childMode = true;
  const qabilaRooms = community.memberships.filter((membership) => membership.room.type === "PROJECT_TEAM");
  const section = "qabila";
  const sectionRooms = qabilaRooms;
  const selectedRoom = sectionRooms.find((membership) => membership.room.id === params.room) ?? sectionRooms[0] ?? null;
  const visibleMemberships = selectedRoom ? [selectedRoom] : [];
  const visibleMessages = qabilaRooms.reduce((sum, membership) => sum + membership.room.messages.length, 0);
  const projectCount = qabilaRooms.reduce((sum, membership) => sum + membership.room.projects.length, 0);
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
        body: await formatQabilaMessage(formData),
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
  async function manageAsChild(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "PARENT") redirect("/auth/login");
    const studentId = String(formData.get("studentId") || "");
    const messageId = String(formData.get("messageId") || "");
    try {
      if (String(formData.get("intent") || "") === "edit") {
        await editParentSupervisedCommunityMessage({ parentUserId: current.user.id, studentId, messageId, body: String(formData.get("body") || "") });
      } else {
        await deleteParentSupervisedCommunityMessage({ parentUserId: current.user.id, studentId, messageId });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update message.";
      redirect(`/parent/community?child=${studentId}&section=qabila&mode=child&error=${encodeURIComponent(message)}`);
    }
    revalidatePath("/parent/community");
    revalidatePath("/student/community");
    revalidatePath("/teacher/community");
    redirect(`/parent/community?child=${studentId}&section=qabila&mode=child&posted=1`);
  }
  return (
    <FamilyDashboardFrame
      roleLabel="Child Qabila"
      title="My Qabila Chat"
      subtitle="Talk with your Qabila teammates in a supervised space. Assigned teachers and admins can see every message."
      navItems={getParentNavItems(selectedChildId)}
      pendingReason={dashboard.pendingReason}
    >
      <ActionToast message={params.error ?? (params.posted ? "Message posted to the Qabila." : undefined)} tone={params.error ? "error" : "success"} />
      <SectionCard
        eyebrow="Switch learner"
        title={community.selectedChild ? childName(community.selectedChild) : "Choose learner"}
        icon="star"
        action={<span className="rounded-full bg-[#fbf6ef] px-3 py-1.5 text-xs font-semibold text-[#617184]">{visibleMessages} messages / {projectCount} projects</span>}
      >
        <ChildSelector
          learners={community.children.map((child) => ({ id: child.id, name: childName(child) }))}
          selectedChildId={selectedChildId}
          basePath="/parent/community?mode=child"
        />
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

                {[...membership.room.messages].reverse().map((message) => (
                  <div key={message.id} className={`rounded-[18px] border p-4 text-sm ${message.author.role === "TEACHER" ? "border-[#efbd68] bg-[#fff4d8] shadow-sm" : "border-transparent bg-[#fbf6ef]"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[#22304a]">{authorName(message.author)} <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase text-[#9a651f]">{message.author.role === "TEACHER" ? "Teacher announcement" : membership.room.memberships.find((member)=>member.student.userId===message.author.id)?.role?.replace("_", " ") || "Member"}</span></p>
                      <div className="flex items-center gap-1"><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#2f6b4b]">Visible</span><details className="relative"><summary className="cursor-pointer list-none rounded-full px-2 text-lg font-bold text-[#617184]" aria-label="Message options">⋯</summary><div className="absolute right-0 z-20 min-w-32 rounded-xl border border-[#d8e3ed] bg-white p-1 shadow-lg"><Link href={`/parent/community?child=${selectedChildId}&room=${membership.room.id}&reply=${message.id}#qabila-composer`} className="block rounded-lg px-3 py-2 text-xs font-semibold text-[#22304a] hover:bg-[#f3f6f9]">↩ Reply{message.author.id===community.selectedChild?.userId?" to yourself":""}</Link>{message.author.id===community.selectedChild?.userId&&Date.now()-message.createdAt.getTime()<=60*60*1000?<form action={manageAsChild} className="border-t border-[#e5ebf0] p-1"><input type="hidden" name="studentId" value={selectedChildId}/><input type="hidden" name="messageId" value={message.id}/><textarea name="body" defaultValue={message.body} required maxLength={800} rows={2} className="mt-1 w-56 rounded-lg border border-[#d8e3ed] px-2 py-1 text-xs"/><div className="mt-1 flex gap-1"><button name="intent" value="edit" className="rounded-lg bg-[#0f4d81] px-2 py-1 text-xs text-white">Edit</button><button name="intent" value="delete" formNoValidate className="rounded-lg px-2 py-1 text-xs text-[#b24646]">Delete</button></div></form>:null}</div></details></div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap leading-6 text-[#4d5a6b]">{message.body}</p>{message.audioDriveFileId ? <audio controls preload="metadata" src={`/api/community/voice/${message.id}`} className="mt-2 h-10 w-full"/> : null}
                    <p className="mt-2 text-xs text-[#6d7785]">{formatDate(message.createdAt)}</p>

                  </div>
                ))}
                {!membership.room.messages.length ? (
                  <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
                    No visible room messages yet.
                  </p>
                ) : null}
                {childMode && !membership.room.isReadOnly ? <div className="overflow-hidden rounded-[24px] border border-[#d8e3ed] bg-[#f4f7fa]"><div className="max-h-[520px] space-y-2 overflow-y-auto p-3"><p className="text-center text-xs font-semibold text-[#7a8797]">Earlier messages appear first · Qabila discussion is supervised</p></div><QabilaMessageComposer action={postAsChild} roomId={membership.room.id} studentId={selectedChildId} buttonLabel="Send to Qabila" mentions={[...membership.room.memberships.map((member)=>({id:member.student.userId,label:childName(member.student)})),...membership.room.supervisors.map((teacher)=>({id:teacher.userId,label:`Teacher ${teacher.user.firstName}`}))]} replyTo={params.reply ? (()=>{const message=membership.room.messages.find((item)=>item.id===params.reply);return message?{id:message.id,label:authorName(message.author),preview:message.body.slice(0,55)}:null})() : null}/><div className="border-t border-[#dbe3ec] bg-white px-4 py-3"><CommunityVoiceRecorder roomId={membership.room.id} studentId={selectedChildId}/></div></div> : null}
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

        <SectionCard eyebrow="Safety rules" title="Conversation safety" icon="check">
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
