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

async function ensureClassRoomForEnrollment(input: {
  programId: string;
  programTitle: string;
  studentId: string;
  age: number | null;
}) {
  const band = ageBand(input.age);
  let room = await db.communityRoom.findFirst({
    where: {
      programId: input.programId,
      type: CommunityRoomType.CLASS_ROOM,
      ageBand: band,
      isActive: true,
    },
  });

  if (!room) {
    room = await db.communityRoom.create({
      data: {
        programId: input.programId,
        title: `${input.programTitle} Circle (${band})`,
        description: "A supervised class circle for mentor-guided discussion.",
        type: CommunityRoomType.CLASS_ROOM,
        visibility: CommunityRoomVisibility.STUDENTS,
        ageBand: band,
        genderScope: "CLASS",
      },
    });
  }

  await db.communityMembership.upsert({
    where: {
      roomId_studentId: {
        roomId: room.id,
        studentId: input.studentId,
      },
    },
    update: {},
    create: {
      roomId: room.id,
      studentId: input.studentId,
    },
  });

  return room;
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
  for (const enrollment of student.enrollments) {
    await ensureClassRoomForEnrollment({
      programId: enrollment.programId,
      programTitle: enrollment.program.title,
      studentId: student.id,
      age: student.age,
    });
  }
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
    where: { studentId: student.id },
    orderBy: { joinedAt: "desc" },
    include: {
      room: {
        include: {
          messages: {
            where: { status: { in: [CommunityMessageStatus.VISIBLE, CommunityMessageStatus.FLAGGED] } },
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
    where: { studentId: selectedChild.id },
    orderBy: { joinedAt: "desc" },
    include: {
      room: {
        include: {
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
