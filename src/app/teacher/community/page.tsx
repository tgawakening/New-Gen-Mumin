import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { TeacherDashboardFrame } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { ActionToast } from "@/components/dashboard/ActionToast";
import { QabilaIdentity } from "@/components/community/QabilaIdentity";
import { CommunityVoiceRecorder } from "@/components/community/CommunityVoiceRecorder";
import { QabilaMessageComposer } from "@/components/community/QabilaMessageComposer";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { deleteCommunityMessage, editCommunityMessage, postTeacherCommunityMessage, formatQabilaMessage, syncAllQabilaRoomMemberships, syncQabilaSupervisors } from "@/lib/community/rooms";
import { getTeacherNavItems } from "@/lib/teacher/nav";

type PageProps = { searchParams?: Promise<{ posted?: string; error?: string; room?: string; reply?: string }> };
export default async function TeacherCommunityPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));
  const params = searchParams ? await searchParams : {};
  await syncQabilaSupervisors();
  await syncAllQabilaRoomMemberships();
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
    const body = await formatQabilaMessage(formData);
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
      {assignments.map(({ room }) => <section id={room.id} key={room.id} className="rounded-[26px] border border-[#dce4ed] bg-white p-5 shadow-sm">
        <QabilaIdentity name={room.title} />
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c27a2c]">Supervised Qabila</p><h2 className="mt-2 text-xl font-bold text-[#22304a]">{room.title}</h2><p className="mt-1 text-sm text-[#617184]">{room.description}</p></div><span className="rounded-full bg-[#eef6f0] px-3 py-1 text-xs font-bold text-[#2f6b4b]">{room.memberships.length} learners</span></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="rounded-2xl bg-[#fbf6ef] p-4"><h3 className="font-bold text-[#22304a]">Team members</h3><p className="mt-1 text-xs text-[#617184]">Names, roles, and recent chat participation.</p><div className="mt-3 space-y-2">{room.memberships.map((membership)=>{const learnerMessages=room.messages.filter((message)=>message.authorUserId===membership.student.userId);return <div key={membership.id} className="rounded-xl bg-white px-3 py-2"><div className="flex justify-between gap-2 text-sm"><span className="font-semibold text-[#22304a]">{membership.student.displayName || `${membership.student.user.firstName} ${membership.student.user.lastName}`}</span><span className="text-xs font-bold text-[#c27a2c]">{membership.role.replace("_", " ")}</span></div><p className="mt-1 text-xs text-[#617184]">{learnerMessages.length ? `${learnerMessages.length} recent message${learnerMessages.length===1?"":"s"} · last activity ${learnerMessages[0].createdAt.toLocaleDateString("en-GB")}` : "No recent chat activity"}</p></div>})}</div></div>
          <div className="overflow-hidden rounded-2xl border border-[#243b5a] bg-[#102544] text-white"><div className="border-b border-white/10 px-4 py-3"><h3 className="font-bold">Qabila conversation</h3><p className="mt-1 text-xs text-white/60">Earlier messages appear first. Reply, tag a learner, or post a teacher announcement.</p></div><div className="max-h-[620px] space-y-2 overflow-y-auto p-4">{[...room.messages].reverse().map((message)=>{const studentRole=room.memberships.find((member)=>member.student.userId===message.authorUserId)?.role;const teacherPost=message.author.role==="TEACHER";return <div key={message.id} className={`rounded-2xl border p-3 text-sm ${teacherPost?"border-[#f4b85f] bg-[#fff4d8] text-[#22304a]":"border-white/10 bg-white/10"}`}><div className="flex justify-between gap-2"><strong>{message.author.firstName} {message.author.lastName}<span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] uppercase ${teacherPost?"bg-[#f4b85f] text-[#102544]":"bg-white/10 text-white/70"}`}>{teacherPost?"Teacher announcement":studentRole?.replace("_"," ")||message.author.role}</span></strong><span className={`text-xs ${teacherPost?"text-[#7a6545]":"text-white/60"}`}>{message.createdAt.toLocaleDateString("en-GB")}</span></div><p className={`mt-2 whitespace-pre-wrap ${teacherPost?"text-[#4d5a6b]":"text-white/80"}`}>{message.body}</p>{message.audioDriveFileId?<audio controls preload="metadata" src={`/api/community/voice/${message.id}`} className="mt-2 h-10 w-full"/>:null}<details className={`mt-2 border-t pt-2 ${teacherPost?"border-[#e8d09f]":"border-white/15"}`}><summary className="ml-auto w-fit cursor-pointer rounded-full px-2 text-lg font-bold text-[#c27a2c]" aria-label="Message options">⋯</summary><Link href={`/teacher/community?reply=${message.id}#${room.id}`} className="block w-fit rounded-full px-3 py-1 text-xs font-semibold text-[#c27a2c]">↩ Reply{message.authorUserId===session.user.id?" to yourself":""}</Link><form action={manageMessage} className="mt-2 grid gap-2"><input type="hidden" name="messageId" value={message.id}/>{message.authorUserId===session.user.id?<textarea name="body" defaultValue={message.body} required maxLength={800} rows={2} className="rounded-lg bg-white px-2 py-1 text-[#22304a]"/>:null}<div className="flex gap-2">{message.authorUserId===session.user.id?<button name="intent" value="edit" className="rounded-full bg-[#f4b85f] px-3 py-1 text-xs font-bold text-[#102544]">Save edit</button>:null}<button name="intent" value="delete" formNoValidate className="rounded-full border border-current px-3 py-1 text-xs font-semibold">Remove</button></div></form></details></div>})}{!room.messages.length?<p className="py-8 text-center text-sm text-white/65">No messages yet. Welcome your team below.</p>:null}</div><QabilaMessageComposer action={postMessage} roomId={room.id} buttonLabel="Send as teacher" mentions={room.memberships.map((member)=>({id:member.student.userId,label:member.student.displayName||member.student.user.firstName}))} replyTo={params.reply ? (()=>{const message=room.messages.find((item)=>item.id===params.reply);return message?{id:message.id,label:`${message.author.firstName} ${message.author.lastName}`.trim(),preview:message.body.slice(0,55)}:null})() : null}/><div className="border-t border-white/10 bg-white px-4 py-3 text-[#22304a]"><CommunityVoiceRecorder roomId={room.id}/></div></div>
        </div>
      </section>)}
      {!assignments.length?<div className="rounded-[26px] border border-[#dce4ed] bg-white p-8 text-center text-[#617184]">No Qabila has been assigned to this teacher account yet. Ask admin to apply the current Qabila draft.</div>:null}
    </div>
  </TeacherDashboardFrame>;
}

