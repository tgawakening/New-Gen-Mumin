import { redirect } from "next/navigation";

import { TeacherDashboardFrame } from "@/components/dashboard/teacher/TeacherDashboardFrame";
import { getCurrentSession, getDashboardHome } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getTeacherNavItems } from "@/lib/teacher/nav";

export default async function TeacherCommunityPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "TEACHER") redirect(getDashboardHome(session.user.role));
  const assignments = await db.communityRoomSupervisor.findMany({
    where: { userId: session.user.id, room: { isActive: true } },
    orderBy: { room: { title: "asc" } },
    include: {
      room: {
        include: {
          memberships: { include: { student: { include: { user: true } } }, orderBy: { role: "asc" } },
          messages: { orderBy: { createdAt: "desc" }, take: 50, include: { author: true } },
        },
      },
    },
  });
  return <TeacherDashboardFrame title="My Qabila Communities" subtitle="Mentor-visible team spaces assigned by admin. Messages remain logged and parents retain visibility." navItems={getTeacherNavItems()}>
    <div className="grid gap-5">
      {assignments.map(({ room }) => <section key={room.id} className="rounded-[26px] border border-[#dce4ed] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c27a2c]">Supervised Qabila</p><h2 className="mt-2 text-xl font-bold text-[#22304a]">{room.title}</h2><p className="mt-1 text-sm text-[#617184]">{room.description}</p></div><span className="rounded-full bg-[#eef6f0] px-3 py-1 text-xs font-bold text-[#2f6b4b]">{room.memberships.length} learners</span></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="rounded-2xl bg-[#fbf6ef] p-4"><h3 className="font-bold text-[#22304a]">Team members</h3><div className="mt-3 space-y-2">{room.memberships.map((membership)=><div key={membership.id} className="flex justify-between gap-2 text-sm"><span>{membership.student.displayName || `${membership.student.user.firstName} ${membership.student.user.lastName}`}</span><span className="text-xs font-bold text-[#c27a2c]">{membership.role.replace("_", " ")}</span></div>)}</div></div>
          <div className="rounded-2xl bg-[#102544] p-4 text-white"><h3 className="font-bold">Logged discussion</h3><div className="mt-3 space-y-2">{room.messages.map((message)=><div key={message.id} className="rounded-xl bg-white/10 p-3 text-sm"><div className="flex justify-between gap-2"><strong>{message.author.firstName} {message.author.lastName}</strong><span className="text-xs text-white/60">{message.status.replace("_", " ")}</span></div><p className="mt-1 whitespace-pre-wrap text-white/75">{message.body}</p></div>)}{!room.messages.length?<p className="text-sm text-white/65">No messages yet.</p>:null}</div></div>
        </div>
      </section>)}
      {!assignments.length?<div className="rounded-[26px] border border-[#dce4ed] bg-white p-8 text-center text-[#617184]">No Qabila has been assigned to this teacher account yet. Ask admin to apply the current Qabila draft.</div>:null}
    </div>
  </TeacherDashboardFrame>;
}

