import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CommunityMessageStatus, CommunityRoomType, CommunityRoomVisibility, ModerationFlagStatus } from "@prisma/client";

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

const AGE_BANDS = ["ALL", "6-8", "9-12", "13-17", "GENERAL"] as const;
const GENDER_SCOPES = ["ALL", "BOYS", "GIRLS", "MENTOR_SUPERVISED"] as const;

function normalizeGender(value?: string | null) {
  const gender = (value ?? "").trim().toLowerCase();
  if (["boy", "boys", "male", "m"].includes(gender)) return "BOYS";
  if (["girl", "girls", "female", "f"].includes(gender)) return "GIRLS";
  return "MENTOR_SUPERVISED";
}

function ageBand(age?: number | null) {
  if (!age) return "GENERAL";
  if (age <= 8) return "6-8";
  if (age <= 12) return "9-12";
  return "13-17";
}

function noticeHref(message: string, tone: "success" | "error" = "success") {
  const params = new URLSearchParams({ notice: message, tone });
  return `/admin/community?${params.toString()}`;
}

export default async function AdminCommunityPage({ searchParams }: PageProps) {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN") redirect("/admin");

  const params = searchParams ? await searchParams : {};
  const [flaggedMessages, recentRooms, programs] = await Promise.all([
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
      take: 50,
      include: {
        _count: {
          select: {
            memberships: true,
            messages: true,
          },
        },
        projects: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: {
            _count: { select: { members: true, submissions: true, tasks: true } },
          },
        },
      },
    }),
    db.program.findMany({
      where: { status: { not: "DRAFT" } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  async function createRoom(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin");

    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const type = String(formData.get("type") || CommunityRoomType.CLASS_ROOM) as CommunityRoomType;
    const programIdRaw = String(formData.get("programId") || "");
    const programId = programIdRaw === "ALL" ? null : programIdRaw;
    const ageScope = String(formData.get("ageBand") || "ALL");
    const genderScope = String(formData.get("genderScope") || "ALL");
    const isReadOnly = formData.get("isReadOnly") === "on" || type === CommunityRoomType.ANNOUNCEMENT || type === CommunityRoomType.PARENT_NOTICE;
    const autoAssign = formData.get("autoAssign") === "on";

    if (!title) redirect(noticeHref("Room title is required.", "error"));

    const room = await db.communityRoom.create({
      data: {
        title,
        description: description || null,
        type,
        programId,
        visibility: type === CommunityRoomType.PARENT_NOTICE ? CommunityRoomVisibility.PARENTS : CommunityRoomVisibility.STUDENTS,
        ageBand: ageScope === "ALL" ? null : ageScope,
        genderScope,
        isReadOnly,
      },
    });

    if (autoAssign) {
      const students = await db.studentProfile.findMany({
        where: {
          enrollments: {
            some: {
              status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] },
              ...(programId ? { programId } : {}),
            },
          },
        },
        include: {
          registrationStudents: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { gender: true },
          },
        },
      });

      const matchingStudents = students.filter((student) => {
        const studentAgeBand = ageBand(student.age);
        const studentGender = normalizeGender(student.registrationStudents[0]?.gender);
        const ageMatches = ageScope === "ALL" || ageScope === studentAgeBand;
        const genderMatches = genderScope === "ALL" || genderScope === "MENTOR_SUPERVISED" || genderScope === studentGender;
        return ageMatches && genderMatches;
      });

      if (matchingStudents.length) {
        await db.communityMembership.createMany({
          data: matchingStudents.map((student) => ({ roomId: room.id, studentId: student.id })),
          skipDuplicates: true,
        });
      }
    }

    await db.moderationAction.create({
      data: {
        actorUserId: currentSession.user.id,
        targetType: "COMMUNITY_ROOM",
        targetId: room.id,
        action: "create",
        note: autoAssign ? "Room created with automatic student assignment." : "Room created without automatic assignment.",
      },
    });

    revalidatePath("/admin/community");
    revalidatePath("/student/community");
    revalidatePath("/parent/community");
    redirect(noticeHref("Community room created."));
  }

  async function createProject(formData: FormData) {
    "use server";

    const currentSession = await getCurrentSession();
    if (!currentSession || currentSession.user.role !== "ADMIN") redirect("/admin");

    const roomId = String(formData.get("roomId") || "");
    const title = String(formData.get("projectTitle") || "").trim();
    const description = String(formData.get("projectDescription") || "").trim();
    const dueDateRaw = String(formData.get("dueDate") || "");
    const tasks = String(formData.get("tasks") || "")
      .split(/\r?\n/)
      .map((task) => task.trim())
      .filter(Boolean);

    if (!roomId || !title) redirect(noticeHref("Choose a room and add a project title.", "error"));

    const room = await db.communityRoom.findUnique({
      where: { id: roomId },
      include: { memberships: true },
    });
    if (!room) redirect(noticeHref("Room not found.", "error"));

    const project = await db.teamProject.create({
      data: {
        roomId: room.id,
        programId: room.programId,
        title,
        description: description || null,
        dueDate: dueDateRaw ? new Date(dueDateRaw) : null,
        members: {
          create: room.memberships.map((membership) => ({
            studentId: membership.studentId,
          })),
        },
        tasks: {
          create: tasks.map((task, index) => ({
            title: task,
            description: `Project step ${index + 1}`,
          })),
        },
      },
    });

    await db.moderationAction.create({
      data: {
        actorUserId: currentSession.user.id,
        targetType: "TEAM_PROJECT",
        targetId: project.id,
        action: "create",
        note: `Created inside ${room.title}.`,
      },
    });

    revalidatePath("/admin/community");
    revalidatePath("/student/community");
    revalidatePath("/parent/community");
    redirect(noticeHref("Team project created."));
  }

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

    const message = await db.communityMessage.update({
      where: { id: messageId },
      data: { status },
      include: { room: true, author: true },
    });
    if (action === "mute") {
      const student = await db.studentProfile.findUnique({ where: { userId: message.authorUserId } });
      if (student) {
        await db.communityMembership.updateMany({
          where: { roomId: message.roomId, studentId: student.id },
          data: { mutedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        });
      }
    }
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
    redirect(noticeHref(action === "approve" ? "Message approved" : action === "mute" ? "Student muted in this room for 7 days" : "Message hidden"));
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

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="space-y-4 rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f7d8f]">Room setup</p>
              <h2 className="mt-2 text-xl font-semibold text-[#22304a]">Create safe room</h2>
            </div>
            <form action={createRoom} className="grid gap-3">
              <input name="title" placeholder="Room title e.g. Girls Seerah Circle 9-12" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              <textarea name="description" rows={3} placeholder="Room purpose and mentor guidance" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              <div className="grid gap-3 md:grid-cols-2">
                <select name="type" defaultValue={CommunityRoomType.CLASS_ROOM} className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                  {Object.values(CommunityRoomType).map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
                </select>
                <select name="programId" defaultValue="ALL" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                  <option value="ALL">All programmes</option>
                  {programs.map((program) => <option key={program.id} value={program.id}>{program.title}</option>)}
                </select>
                <select name="ageBand" defaultValue="ALL" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                  {AGE_BANDS.map((band) => <option key={band} value={band}>{band === "ALL" ? "All ages" : band}</option>)}
                </select>
                <select name="genderScope" defaultValue="ALL" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                  {GENDER_SCOPES.map((scope) => <option key={scope} value={scope}>{scope.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-3 rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm font-semibold text-[#22304a]">
                <input name="autoAssign" type="checkbox" defaultChecked className="h-4 w-4" />
                Auto-assign matching active students
              </label>
              <label className="flex items-center gap-3 rounded-2xl bg-[#fbf6ef] px-4 py-3 text-sm font-semibold text-[#22304a]">
                <input name="isReadOnly" type="checkbox" className="h-4 w-4" />
                Read-only for students
              </label>
              <button className="w-fit rounded-full bg-[#0f4d81] px-5 py-3 text-sm font-semibold text-white">Create room</button>
            </form>
          </div>

          <div className="space-y-4 rounded-[28px] border border-[#dce4ed] bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6f7d8f]">Collaboration</p>
              <h2 className="mt-2 text-xl font-semibold text-[#22304a]">Create team project</h2>
            </div>
            <form action={createProject} className="grid gap-3">
              <select name="roomId" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm">
                <option value="">Choose project room</option>
                {recentRooms.map((room) => <option key={room.id} value={room.id}>{room.title}</option>)}
              </select>
              <input name="projectTitle" placeholder="Project title" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              <input name="dueDate" type="date" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              <textarea name="projectDescription" rows={3} placeholder="Project brief" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              <textarea name="tasks" rows={4} placeholder="One task per line" className="rounded-2xl border border-[#d8e3ed] px-4 py-3 text-sm" />
              <button className="w-fit rounded-full bg-[#2f6b4b] px-5 py-3 text-sm font-semibold text-white">Create project</button>
            </form>
          </div>
        </section>

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
                  <button name="action" value="mute" className="rounded-full border border-[#f2d39f] bg-[#fff8eb] px-4 py-2 text-sm font-semibold text-[#8a6326]">
                    Hide + mute 7 days
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
                <p className="mt-1 text-xs text-[#6d7785]">{room.genderScope ?? "ALL"} - {room._count.memberships} members - {room._count.messages} messages</p>
                {room.projects.length ? (
                  <div className="mt-3 space-y-2">
                    {room.projects.map((project) => (
                      <p key={project.id} className="rounded-xl bg-white px-3 py-2 text-xs text-[#22304a]">
                        {project.title}: {project._count.tasks} tasks, {project._count.submissions} submissions
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
