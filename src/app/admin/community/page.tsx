import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CommunityMessageStatus, ModerationFlagStatus } from "@prisma/client";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ActionToast } from "@/components/dashboard/ActionToast";

type PageProps = {
  searchParams?: Promise<{ notice?: string; tone?: string }>;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function AdminCommunityPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") redirect("/admin");

  const params = searchParams ? await searchParams : {};
  const [flaggedMessages, recentRooms] = await Promise.all([
    db.communityMessage.findMany({
      where: { status: CommunityMessageStatus.FLAGGED },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        room: true,
        author: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        flags: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    }),
    db.communityRoom.findMany({
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        _count: {
          select: {
            memberships: true,
            messages: true,
          },
        },
      },
    }),
  ]);

  async function moderateMessage(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin");

    const messageId = String(formData.get("messageId") || "");
    const action = String(formData.get("action") || "");
    const note = String(formData.get("note") || "").trim();

    const status =
      action === "approve"
        ? CommunityMessageStatus.VISIBLE
        : action === "hide"
          ? CommunityMessageStatus.HIDDEN
          : CommunityMessageStatus.FLAGGED;

    await db.communityMessage.update({
      where: { id: messageId },
      data: { status },
    });
    await db.moderationFlag.updateMany({
      where: { messageId },
      data: {
        status: action === "approve" ? ModerationFlagStatus.REVIEWED : ModerationFlagStatus.ESCALATED,
        reviewedAt: new Date(),
      },
    });
    await db.moderationAction.create({
      data: {
        actorUserId: currentSession.user.id,
        targetType: "COMMUNITY_MESSAGE",
        targetId: messageId,
        action,
        note: note || null,
      },
    });

    revalidatePath("/admin/community");
    redirect(`/admin/community?notice=${encodeURIComponent(action === "approve" ? "Message approved" : "Message hidden")}&tone=success`);
  }

  return (
    <div className="min-h-screen bg-[#edf2f6] py-6">
      <div className="section-container space-y-5">
        <ActionToast message={params.notice} tone={params.tone} />
        <div className="rounded-[24px] border border-[#dce4ed] bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f7d8f]">Admin moderation</p>
              <h1 className="mt-2 text-2xl font-semibold text-[#22304a]">Community Safety Console</h1>
              <p className="mt-1 text-sm text-[#617184]">Review flagged messages, approve safe posts, hide risky content, and keep an audit trail.</p>
            </div>
            <Link href="/admin" className="rounded-full border border-[#c9d7e6] bg-white px-4 py-2 text-sm font-semibold text-[#22304a]">
              Back to admin
            </Link>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-[22px] border border-[#dce4ed] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#6d7785]">Flagged messages</p>
            <p className="mt-2 text-3xl font-semibold text-[#22304a]">{flaggedMessages.length}</p>
          </div>
          <div className="rounded-[22px] border border-[#dce4ed] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#6d7785]">Rooms</p>
            <p className="mt-2 text-3xl font-semibold text-[#22304a]">{recentRooms.length}</p>
          </div>
          <div className="rounded-[22px] border border-[#dce4ed] bg-white p-5 shadow-sm">
            <p className="text-sm text-[#6d7785]">Safety mode</p>
            <p className="mt-2 text-3xl font-semibold text-[#22304a]">On</p>
          </div>
        </div>

        <section className="space-y-4 rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f7d8f]">Review queue</p>
            <h2 className="mt-2 text-xl font-semibold text-[#22304a]">Flagged messages</h2>
          </div>
          {flaggedMessages.map((message) => (
            <div key={message.id} className="rounded-[20px] border border-[#eadfce] bg-[#fbfdff] p-5">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  <p className="font-semibold text-[#22304a]">{message.room.title}</p>
                  <p className="mt-1 text-sm text-[#617184]">
                    {message.author.firstName} {message.author.lastName} - {message.author.email} - {formatDate(message.createdAt)}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-7 text-[#4d5a6b]">{message.body}</p>
                  <p className="mt-2 text-sm font-semibold text-[#8a6326]">
                    Flag: {message.flagReason ?? message.flags[0]?.reason ?? "Needs review"}
                  </p>
                </div>
                <form action={moderateMessage} className="grid content-start gap-3 rounded-2xl bg-white p-4">
                  <input type="hidden" name="messageId" value={message.id} />
                  <textarea name="note" rows={3} placeholder="Moderation note" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
                  <button name="action" value="approve" className="rounded-full bg-[#2f6b4b] px-4 py-2 text-sm font-semibold text-white">
                    Approve
                  </button>
                  <button name="action" value="hide" className="rounded-full border border-[#efb3b3] bg-white px-4 py-2 text-sm font-semibold text-[#b24646]">
                    Hide
                  </button>
                </form>
              </div>
            </div>
          ))}
          {!flaggedMessages.length ? (
            <p className="rounded-2xl bg-[#fbf6ef] px-4 py-4 text-sm leading-7 text-[#6b7482]">
              No flagged messages are waiting for review.
            </p>
          ) : null}
        </section>

        <section className="space-y-4 rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f7d8f]">Rooms</p>
            <h2 className="mt-2 text-xl font-semibold text-[#22304a]">Recent rooms</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {recentRooms.map((room) => (
              <div key={room.id} className="rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm text-[#4d5a6b]">
                <p className="font-semibold text-[#22304a]">{room.title}</p>
                <p className="mt-1">{room.type.replace(/_/g, " ")} - {room.ageBand ?? "All ages"}</p>
                <p className="mt-1 text-xs text-[#6d7785]">{room._count.memberships} members - {room._count.messages} messages</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
