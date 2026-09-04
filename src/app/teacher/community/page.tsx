import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { TeacherDashboardFrame } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { QabilaIdentity } from "@/components/community/QabilaIdentity";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deleteCommunityMessage, editCommunityMessage, postTeacherCommunityMessage } from "@/lib/community/rooms";
import { getTeacherNavItems } from "@/lib/teacher/nav";

type PageProps = { searchParams?: Promise<{ posted?: string; error?: string }> };
export default async function TeacherCommunityPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));
  const params = searchParams ? await searchParams : {};
  const assignments = await db.communityRoomSupervisor.findMany({
    where: { userId: session.user.id, room: { isActive: true } },
    orderBy: { room: { title: "asc" } },
    include: {
      room: {
        include: {
          memberships: { include: { student: { include: { user: true } } }, orderBy: { role: "asc" } },
          messages: { where: { status: { not: "HIDDEN" } }, orderBy: { createdAt: "desc" }, take: 50, include: { author: true } },
        },
      },
    },
  });
  async function postMessage(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "TEACHER") redirect("/auth/login");
    const roomId = String(formData.get("roomId") || "");
    const body = String(formData.get("body") || "");
    try {
      await postTeacherCommunityMessage({ userId: current.user.id, roomId, body });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to post message.";
      redirect(`/teacher/community?error=${encodeURIComponent(message)}`);
    }
    revalidatePath("/teacher/community");
    revalidatePath("/student/community");
    revalidatePath("/parent/community");
    redirect("/teacher/community?posted=1");
  }
  async function manageMessage(formData: FormData) {
    "use server";
    const current = await getCurrentSession();
    if (!current || current.user.role !== "TEACHER") redirect("/auth/login");
    const messageId = String(formData.get("messageId") || "");
    const intent = String(formData.get("intent") || "");
    try {
      if (intent === "edit") await editCommunityMessage({ actorUserId: current.user.id, messageId, body: String(formData.get("body") || "") });
      else await deleteCommunityMessage({ actorUserId: current.user.id, messageId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update message.";
      redirect(`/teacher/community?error=${encodeURIComponent(message)}`);
    }
    revalidatePath("/teacher/community"); revalidatePath("/student/community"); revalidatePath("/parent/community");
    redirect("/teacher/community?posted=1");
  }
  return <TeacherDashboardFrame title="My Qabila Communities" subtitle="Mentor-visible team spaces assigned by admin. Messages remain logged and parents retain visibility." navItems={getTeacherNavItems()}>
    <ActionToast message={params.error ?? (params.posted ? "Message posted to your Qabila and recorded for parent/admin visibility." : undefined)} tone={params.error ? "error" : "success"} />
    <div className="grid gap-5">
      {assignments.map(({ room }) => <section key={room.id} className="rounded-[26px] border border-[#dce4ed] bg-white p-5 shadow-sm">
        <QabilaIdentity name={room.title} />
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c27a2c]">Supervised Qabila</p><h2 className="mt-2 text-xl font-bold text-[#22304a]">{room.title}</h2><p className="mt-1 text-sm text-[#617184]">{room.description}</p></div><span className="rounded-full bg-[#eef6f0] px-3 py-1 text-xs font-bold text-[#2f6b4b]">{room.memberships.length} learners</span></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="rounded-2xl bg-[#fbf6ef] p-4"><h3 className="font-bold text-[#22304a]">Team members</h3><div className="mt-3 space-y-2">{room.memberships.map((membership)=><div key={membership.id} className="flex justify-between gap-2 text-sm"><span>{membership.student.displayName || `${membership.student.user.firstName} ${membership.student.user.lastName}`}</span><span className="text-xs font-bold text-[#c27a2c]">{membership.role.replace("_", " ")}</span></div>)}</div></div>
          <div className="rounded-2xl bg-[#102544] p-4 text-white"><h3 className="font-bold">Start or continue the discussion</h3><form action={postMessage} className="mt-3 grid gap-2"><input type="hidden" name="roomId" value={room.id}/><textarea name="body" required maxLength={800} rows={3} placeholder="Message your Qabila members. Do not include personal contact details or external links." className="rounded-xl border border-white/20 bg-white px-3 py-2 text-sm text-[#22304a]"/><button className="w-fit rounded-full bg-[#f4b85f] px-4 py-2 text-sm font-bold text-[#102544]">Send to Qabila</button></form><h3 className="mt-5 font-bold">Logged discussion</h3><div className="mt-3 space-y-2">{room.messages.map((message)=><div key={message.id} className="rounded-xl bg-white/10 p-3 text-sm"><div className="flex justify-between gap-2"><strong>{message.author.firstName} {message.author.lastName}</strong><span className="text-xs text-white/60">{message.status.replace("_", " ")}</span></div><p className="mt-1 whitespace-pre-wrap text-white/75">{message.body}</p><details className="mt-2 border-t border-white/15 pt-2"><summary className="cursor-pointer text-xs font-semibold text-[#f4b85f]">{message.authorUserId === session.user.id ? "Edit or delete my message" : "Moderate student message"}</summary><form action={manageMessage} className="mt-2 grid gap-2"><input type="hidden" name="messageId" value={message.id}/>{message.authorUserId === session.user.id ? <textarea name="body" defaultValue={message.body} required maxLength={800} rows={2} className="rounded-lg bg-white px-2 py-1 text-[#22304a]"/> : null}<div className="flex gap-2">{message.authorUserId === session.user.id ? <button name="intent" value="edit" className="rounded-full bg-[#f4b85f] px-3 py-1 text-xs font-bold text-[#102544]">Save edit</button> : null}<button name="intent" value="delete" formNoValidate className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold">Remove for everyone</button></div></form></details></div>)}{!room.messages.length?<p className="text-sm text-white/65">No messages yet. Use the box above to welcome your team.</p>:null}</div></div>
        </div>
      </section>)}
      {!assignments.length?<div className="rounded-[26px] border border-[#dce4ed] bg-white p-8 text-center text-[#617184]">No Qabila has been assigned to this teacher account yet. Ask admin to apply the current Qabila draft.</div>:null}
    </div>
  </TeacherDashboardFrame>;
}

