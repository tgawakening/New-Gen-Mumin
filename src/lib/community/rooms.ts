import "server-only";

import { CommunityMessageStatus, CommunityRoomType, CommunityRoomVisibility } from "@prisma/client";

import { db } from "@/lib/db";

const BLOCK_PATTERNS = [
  { label: "phone number", pattern: /(?:\+?\d[\s-]?){8,}/ },
  { label: "external link", pattern: /(https?:\/\/|www\.)/i },
  { label: "social handle", pattern: /(^|\s)@[a-z0-9_.]{3,}/i },
  { label: "email address", pattern: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
];

function detectFlagReason(body: string) {
  const match = BLOCK_PATTERNS.find((entry) => entry.pattern.test(body));
  return match?.label ?? null;
}

function ageBand(age?: number | null) {
  if (!age) return "GENERAL";
  if (age <= 8) return "6-8";
  if (age <= 12) return "9-12";
  return "13-17";
}

function normalizeGender(value?: string | null) {
  const gender = (value ?? "").trim().toLowerCase();
  if (["boy", "boys", "male", "m"].includes(gender)) return "BOYS";
  if (["girl", "girls", "female", "f"].includes(gender)) return "GIRLS";
  return "MENTOR_SUPERVISED";
}

function genderRoomType(genderScope: string) {
  if (genderScope === "BOYS") return CommunityRoomType.BOYS_CIRCLE;
  if (genderScope === "GIRLS") return CommunityRoomType.GIRLS_CIRCLE;
  return CommunityRoomType.MENTOR_QA;
}

async function getStudentCommunityProfile(studentId: string) {
  const student = await db.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      registrationStudents: {
        orderBy: { createdAt: "desc" },
        select: { gender: true },
      },
      houseMembership: { select: { qabilaGroup: true } },
    },
  });

  return {
    age: student?.age ?? null,
    genderScope: student?.houseMembership?.qabilaGroup?.toLowerCase().startsWith("girls")
      ? "GIRLS"
      : student?.houseMembership?.qabilaGroup?.toLowerCase().startsWith("boys")
        ? "BOYS"
        : normalizeGender([...new Set((student?.registrationStudents ?? []).map((entry) => entry.gender).filter(Boolean))].length === 1 ? student?.registrationStudents.find((entry) => entry.gender)?.gender : null),
  };
}

async function addStudentToRoom(roomId: string, studentId: string, role = "MEMBER") {
  await db.communityMembership.upsert({
    where: {
      roomId_studentId: {
        roomId,
        studentId,
      },
    },
    update: { role },
    create: {
      roomId,
      studentId,
      role,
    },
  });
}

async function ensureClassRoomForEnrollment(input: {
  programId: string;
  programTitle: string;
  studentId: string;
  age: number | null;
  genderScope: string;
}) {
  const band = ageBand(input.age);
  let room = await db.communityRoom.findFirst({
    where: {
      programId: input.programId,
      type: CommunityRoomType.CLASS_ROOM,
      ageBand: band,
      genderScope: input.genderScope,
      isActive: true,
    },
  });

  if (!room) {
    room = await db.communityRoom.create({
      data: {
        programId: input.programId,
        title: `${input.programTitle} Circle (${band})`,
        description: "A supervised class circle for mentor-guided discussion and respectful peer support.",
        type: CommunityRoomType.CLASS_ROOM,
        visibility: CommunityRoomVisibility.STUDENTS,
        ageBand: band,
        genderScope: input.genderScope,
      },
    });
  }

  await addStudentToRoom(room.id, input.studentId);

  return room;
}

async function ensureCircleRoom(studentId: string, age: number | null, genderScope: string) {
  const band = ageBand(age);
  const type = genderRoomType(genderScope);
  const titlePrefix = genderScope === "BOYS" ? "Boys Circle" : genderScope === "GIRLS" ? "Girls Circle" : "Mentor Q&A";
  let room = await db.communityRoom.findFirst({
    where: {
      type,
      ageBand: band,
      genderScope,
      isActive: true,
    },
  });

  if (!room) {
    room = await db.communityRoom.create({
      data: {
        title: `${titlePrefix} (${band})`,
        description: "A same-group supervised community room. No private contact details, links, or unsupervised sharing.",
        type,
        visibility: CommunityRoomVisibility.STUDENTS,
        ageBand: band,
        genderScope,
      },
    });
  }

  await addStudentToRoom(room.id, studentId);
}

async function ensureAnnouncementRoom(studentId: string) {
  let room = await db.communityRoom.findFirst({
    where: {
      type: CommunityRoomType.ANNOUNCEMENT,
      visibility: CommunityRoomVisibility.STUDENTS,
      isActive: true,
    },
  });

  if (!room) {
    room = await db.communityRoom.create({
      data: {
        title: "Gen-Mumin Announcements",
        description: "Read-only mentor announcements, reminders, and safe community updates.",
        type: CommunityRoomType.ANNOUNCEMENT,
        visibility: CommunityRoomVisibility.STUDENTS,
        genderScope: "ALL",
        isReadOnly: true,
      },
    });
  }

  await addStudentToRoom(room.id, studentId);
}

export async function ensureStudentQabilaRoom(studentId: string) {
  const membership = await db.houseMembership.findUnique({
    where: { studentId },
    select: { qabilaGroup: true, role: true },
  });
  const qabilaGroup = membership?.qabilaGroup?.trim();
  if (!qabilaGroup) {
    await db.communityMembership.deleteMany({
      where: { studentId, room: { type: CommunityRoomType.PROJECT_TEAM, title: { in: ["Girls Qabila A", "Girls Qabila B", "Boys Qabila A", "Boys Qabila B"] } } },
    });
    return;
  }
  const genderScope = qabilaGroup.toLowerCase().startsWith("girls")
    ? "GIRLS"
    : qabilaGroup.toLowerCase().startsWith("boys") ? "BOYS" : "MENTOR_SUPERVISED";
  let room = await db.communityRoom.findFirst({
    where: { title: qabilaGroup, type: CommunityRoomType.PROJECT_TEAM },
  });
  if (room && !room.isActive) return;
  if (!room) {
    room = await db.communityRoom.create({
      data: {
        title: qabilaGroup,
        description: "A supervised Qabila team room for mentor-guided planning, encouragement, and safe community projects. Personal contact details and external links are blocked.",
        type: CommunityRoomType.PROJECT_TEAM,
        visibility: CommunityRoomVisibility.STUDENTS,
        genderScope,
        ageBand: "GENERAL",
      },
    });
  } else if (room.genderScope !== genderScope || room.isReadOnly) {
    room = await db.communityRoom.update({ where: { id: room.id }, data: { genderScope, isReadOnly: false } });
  }
  await db.communityMembership.deleteMany({
    where: {
      studentId,
      roomId: { not: room.id },
      room: { type: CommunityRoomType.PROJECT_TEAM, title: { in: ["Girls Qabila A", "Girls Qabila B", "Boys Qabila A", "Boys Qabila B"] } },
    },
  });
  await addStudentToRoom(room.id, studentId, membership?.role ?? "MEMBER");
}
const QABILA_SUPERVISOR_DRAFT: Record<string, string[]> = {
  "Girls Qabila A": ["Saba"],
  "Girls Qabila B": ["Aisha"],
  "Boys Qabila A": ["Mehran", "Afira"],
  "Boys Qabila B": ["Abdul Badee", "Javeria"],
};

export async function syncQabilaSupervisors() {
  const [rooms, teachers] = await Promise.all([
    db.communityRoom.findMany({ where: { type: CommunityRoomType.PROJECT_TEAM, title: { in: Object.keys(QABILA_SUPERVISOR_DRAFT) } } }),
    db.user.findMany({ where: { role: "TEACHER", teacherProfile: { is: { isActive: true } } }, select: { id: true, firstName: true, lastName: true, email: true } }),
  ]);
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const assigned: string[] = [];
  const skipped: string[] = [];
  for (const room of rooms) {
    const requested = QABILA_SUPERVISOR_DRAFT[room.title] ?? [];
    await db.communityRoomSupervisor.deleteMany({ where: { roomId: room.id } });
    for (const name of requested) {
      const key = normalize(name);
      const matches = teachers.filter((teacher) => {
        const full = normalize(`${teacher.firstName} ${teacher.lastName}`);
        return full === key || full.startsWith(key) || normalize(teacher.email).startsWith(key);
      });
      if (matches.length !== 1) {
        skipped.push(`${room.title}: ${name}`);
        continue;
      }
      await db.communityRoomSupervisor.create({ data: { roomId: room.id, userId: matches[0].id, role: "MENTOR" } });
      assigned.push(`${room.title}: ${name}`);
    }
  }
  return { assigned, skipped };
}


async function ensureStudentClassRooms(student: {
  id: string;
  age: number | null;
  enrollments: Array<{
    programId: string;
    program: {
      title: string;
    };
  }>;
}) {
  const profile = await getStudentCommunityProfile(student.id);
  const studentAge = student.age ?? profile.age;
  for (const enrollment of student.enrollments) {
    await ensureClassRoomForEnrollment({
      programId: enrollment.programId,
      programTitle: enrollment.program.title,
      studentId: student.id,
      age: studentAge,
      genderScope: profile.genderScope,
    });
  }
  await ensureCircleRoom(student.id, studentAge, profile.genderScope);
  await ensureStudentQabilaRoom(student.id);
  await ensureAnnouncementRoom(student.id);
}

export async function getStudentCommunityData(userId: string) {
  const student = await db.studentProfile.findUnique({
    where: { userId },
    include: {
      user: true,
      enrollments: {
        where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
        include: { program: true },
      },
    },
  });
  if (!student) return null;

  await ensureStudentClassRooms(student);

  const memberships = await db.communityMembership.findMany({
    where: { studentId: student.id, room: { isActive: true } },
    orderBy: { joinedAt: "desc" },
    include: {
      room: {
        include: {
          projects: {
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            include: {
              tasks: { orderBy: { createdAt: "asc" } },
              submissions: {
                where: { studentId: student.id },
                orderBy: { submittedAt: "desc" },
                take: 3,
              },
            },
          },
          messages: {
            where: { status: CommunityMessageStatus.VISIBLE },
            orderBy: { createdAt: "desc" },
            take: 25,
            include: {
              author: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return { student, memberships };
}

export async function getParentCommunityData(parentUserId: string, selectedChildId?: string) {
  const parent = await db.parentProfile.findUnique({
    where: { userId: parentUserId },
    include: {
      students: {
        include: {
          student: {
            include: {
              user: true,
              enrollments: {
                where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
                include: { program: true },
              },
            },
          },
        },
      },
    },
  });
  if (!parent) return null;

  const children = parent.students.map((relation) => relation.student);
  const selectedChild = children.find((child) => child.id === selectedChildId) ?? children[0] ?? null;
  if (!selectedChild) {
    return {
      children,
      selectedChild: null,
      memberships: [],
    };
  }

  await ensureStudentClassRooms(selectedChild);

  const memberships = await db.communityMembership.findMany({
    where: { studentId: selectedChild.id, room: { isActive: true } },
    orderBy: { joinedAt: "desc" },
    include: {
      room: {
        include: {
          projects: {
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            include: {
              tasks: { orderBy: { createdAt: "asc" } },
              submissions: {
                where: { studentId: selectedChild.id },
                orderBy: { submittedAt: "desc" },
                take: 3,
              },
            },
          },
          messages: {
            where: { status: CommunityMessageStatus.VISIBLE },
            orderBy: { createdAt: "desc" },
            take: 20,
            include: {
              author: {
                select: {
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
            },
          },
        },
      },
    },
  });

  return {
    children,
    selectedChild,
    memberships,
  };
}

export async function postCommunityMessage(input: {
  userId: string;
  roomId: string;
  body: string;
}) {
  const student = await db.studentProfile.findUnique({ where: { userId: input.userId } });
  if (!student) throw new Error("Student profile not found.");

  const membership = await db.communityMembership.findUnique({
    where: {
      roomId_studentId: {
        roomId: input.roomId,
        studentId: student.id,
      },
    },
    include: { room: true },
  });
  if (!membership || !membership.room.isActive) throw new Error("Room is not available.");
  if (membership.room.isReadOnly) throw new Error("This room is read-only.");
  if (membership.mutedUntil && membership.mutedUntil > new Date()) throw new Error("Posting is muted for this room.");
  if (membership.room.genderScope && !["ALL", "CLASS", "MENTOR_SUPERVISED"].includes(membership.room.genderScope)) {
    const profile = await getStudentCommunityProfile(student.id);
    if (profile.genderScope !== membership.room.genderScope) {
      throw new Error("This room is not available for your community group.");
    }
  }

  const body = input.body.trim().slice(0, 800);
  if (!body) throw new Error("Message cannot be empty.");

  const flagReason = detectFlagReason(body);
  const message = await db.communityMessage.create({
    data: {
      roomId: input.roomId,
      authorUserId: input.userId,
      body,
      status: flagReason ? CommunityMessageStatus.FLAGGED : CommunityMessageStatus.VISIBLE,
      flagReason,
    },
  });

  if (flagReason) {
    await db.moderationFlag.create({
      data: {
        messageId: message.id,
        reason: `Possible ${flagReason}`,
      },
    });
  }

  return message;
}

export async function postParentSupervisedCommunityMessage(input: {
  parentUserId: string;
  studentId: string;
  roomId: string;
  body: string;
}) {
  const relation = await db.parentStudent.findFirst({
    where: { studentId: input.studentId, parent: { userId: input.parentUserId } },
    include: { student: { select: { userId: true } } },
  });
  if (!relation) throw new Error("This learner is not linked to your parent account.");
  return postCommunityMessage({ userId: relation.student.userId, roomId: input.roomId, body: input.body });
}
export async function postTeacherCommunityMessage(input: { userId: string; roomId: string; body: string }) {
  const supervision = await db.communityRoomSupervisor.findUnique({
    where: { roomId_userId: { roomId: input.roomId, userId: input.userId } },
    include: { room: true, user: { select: { role: true } } },
  });
  if (!supervision || supervision.user.role !== "TEACHER" || !supervision.room.isActive) {
    throw new Error("You are not assigned to supervise this Qabila.");
  }
  const body = input.body.trim().slice(0, 800);
  if (!body) throw new Error("Message cannot be empty.");
  const flagReason = detectFlagReason(body);
  const message = await db.communityMessage.create({
    data: {
      roomId: input.roomId,
      authorUserId: input.userId,
      body,
      status: flagReason ? CommunityMessageStatus.FLAGGED : CommunityMessageStatus.VISIBLE,
      flagReason,
    },
  });
  if (flagReason) {
    await db.moderationFlag.create({ data: { messageId: message.id, reason: `Possible ${flagReason}` } });
  }
  return message;
}

export async function editCommunityMessage(input: { actorUserId: string; messageId: string; body: string }) {
  const message = await db.communityMessage.findUnique({ where: { id: input.messageId } });
  if (!message || message.authorUserId !== input.actorUserId || message.status === CommunityMessageStatus.HIDDEN) {
    throw new Error("You can edit only your own visible messages.");
  }
  const body = input.body.trim().slice(0, 800);
  if (!body) throw new Error("Message cannot be empty.");
  const flagReason = detectFlagReason(body);
  const updated = await db.communityMessage.update({
    where: { id: message.id },
    data: { body, flagReason, status: flagReason ? CommunityMessageStatus.FLAGGED : CommunityMessageStatus.VISIBLE },
  });
  if (flagReason) await db.moderationFlag.create({ data: { messageId: message.id, reason: `Possible ${flagReason} after edit` } });
  await db.moderationAction.create({ data: { actorUserId: input.actorUserId, targetType: "COMMUNITY_MESSAGE", targetId: message.id, action: "edit", note: "Author edited the message; safety checks were rerun." } });
  return updated;
}

export async function deleteCommunityMessage(input: { actorUserId: string; messageId: string }) {
  const [actor, message] = await Promise.all([
    db.user.findUnique({ where: { id: input.actorUserId }, select: { role: true } }),
    db.communityMessage.findUnique({ where: { id: input.messageId }, include: { room: { include: { supervisors: true } } } }),
  ]);
  if (!actor || !message) throw new Error("Message was not found.");
  const ownMessage = message.authorUserId === input.actorUserId;
  const assignedTeacher = actor.role === "TEACHER" && message.room.supervisors.some((entry) => entry.userId === input.actorUserId);
  if (!ownMessage && actor.role !== "ADMIN" && !assignedTeacher) throw new Error("You cannot remove this message.");
  await db.communityMessage.update({ where: { id: message.id }, data: { status: CommunityMessageStatus.HIDDEN } });
  await db.moderationAction.create({ data: { actorUserId: input.actorUserId, targetType: "COMMUNITY_MESSAGE", targetId: message.id, action: ownMessage ? "delete_own" : "remove", note: ownMessage ? "Author deleted message for everyone." : "Message removed from the Qabila discussion." } });
}

export async function postAdminCommunityMessage(input: { userId: string; roomId: string; body: string }) {
  const [admin, room] = await Promise.all([
    db.user.findUnique({ where: { id: input.userId }, select: { role: true } }),
    db.communityRoom.findUnique({ where: { id: input.roomId } }),
  ]);
  if (admin?.role !== "ADMIN" || !room?.isActive || room.type !== CommunityRoomType.PROJECT_TEAM) {
    throw new Error("Admin Qabila room is not available.");
  }
  const body = input.body.trim().slice(0, 800);
  if (!body) throw new Error("Message cannot be empty.");
  const message = await db.communityMessage.create({ data: { roomId: room.id, authorUserId: input.userId, body, status: CommunityMessageStatus.VISIBLE } });
  await db.moderationAction.create({ data: { actorUserId: input.userId, targetType: "COMMUNITY_MESSAGE", targetId: message.id, action: "admin_post", note: `Posted to ${room.title}.` } });
  return message;
}

export async function submitCommunityProjectWork(input: {
  userId: string;
  projectId: string;
  submissionText: string;
}) {
  const student = await db.studentProfile.findUnique({ where: { userId: input.userId } });
  if (!student) throw new Error("Student profile not found.");

  const member = await db.projectMember.findUnique({
    where: {
      projectId_studentId: {
        projectId: input.projectId,
        studentId: student.id,
      },
    },
    include: { project: { include: { room: true } } },
  });
  if (!member || member.project.status !== "ACTIVE") throw new Error("Project is not available.");

  if (member.project.roomId) {
    const roomMembership = await db.communityMembership.findUnique({
      where: {
        roomId_studentId: {
          roomId: member.project.roomId,
          studentId: student.id,
        },
      },
    });
    if (!roomMembership) throw new Error("You are not part of this project room.");
    if (roomMembership.mutedUntil && roomMembership.mutedUntil > new Date()) throw new Error("Project posting is muted for this room.");
  }

  const submissionText = input.submissionText.trim().slice(0, 1500);
  if (!submissionText) throw new Error("Add your project work before submitting.");

  const flagReason = detectFlagReason(submissionText);
  if (flagReason) {
    throw new Error(`Please remove ${flagReason}s before submitting project work.`);
  }

  const submission = await db.projectSubmission.create({
    data: {
      projectId: input.projectId,
      studentId: student.id,
      submissionText,
    },
  });

  await db.notification.createMany({
    data: [
      {
        userId: input.userId,
        title: "Project work submitted",
        body: `${member.project.title} was submitted for mentor review.`,
        href: "/student/community",
      },
    ],
  });

  return submission;
}
