import "server-only";

import { db } from "@/lib/db";
import {
  sendAdminZoomMeetingRequestEmail,
  sendLiveClassScheduledEmail,
  sendTeacherZoomMeetingApprovedEmail,
} from "@/lib/email/notifications";
import { durationMinutes, nextWeeklyOccurrence, toZoomLocalStartTime } from "@/lib/live-classes/time";
import { createRecurringZoomMeeting, isZoomConfigured } from "@/lib/zoom/client";
import { DEFAULT_OFFERS, getCatalogOfferProgramSlugs } from "@/lib/registration/catalog";
import { isArabicTajweedSlug } from "@/lib/genm/curriculum";

export const WHOLE_GEN_MUMIN_PROGRAM_ID = "__whole_gen_mumin__";
export const PENDING_ZOOM_PROVIDER = "Zoom Pending Approval";
export const LIVE_CLASS_AUDIENCE_GROUPS = ["ALL", "PK_UK", "US_CA", "AU"] as const;
export type LiveClassAudienceGroup = (typeof LIVE_CLASS_AUDIENCE_GROUPS)[number];

export type CreateLiveClassInput = {
  programId: string;
  teacherId?: string;
  teacherIds?: string[];
  title: string;
  startDate?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  timezone: string;
  createZoomMeeting: boolean;
  waitingRoom?: boolean;
  joinBeforeHost?: boolean;
  muteUponEntry?: boolean;
  autoRecording?: "none" | "local" | "cloud";
  passcode?: string;
  audienceGroup?: LiveClassAudienceGroup;
  showToStudents?: boolean;
};

const AUDIENCE_LABELS: Record<LiveClassAudienceGroup, string> = {
  ALL: "All students",
  PK_UK: "Pakistan and UK students",
  US_CA: "USA and Canada students",
  AU: "Australia students",
};
const HIDDEN_FROM_STUDENTS_MARKER = "[Students:hidden]";
const VISIBLE_TO_STUDENTS_MARKER = "[Students:visible]";
const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"] as const;
const PAID_REGISTRATION_STATUSES = ["PAID", "CONVERTED"] as const;

function normalizeAudienceGroup(value: unknown): LiveClassAudienceGroup {
  return LIVE_CLASS_AUDIENCE_GROUPS.includes(value as LiveClassAudienceGroup)
    ? (value as LiveClassAudienceGroup)
    : "ALL";
}

function audienceTitleMarker(group: LiveClassAudienceGroup) {
  return group === "ALL" ? "" : ` [Audience:${group}]`;
}

export function cleanLiveClassTitle(title: string) {
  return title
    .replace(/\s*\[Students:hidden\]\s*/gu, " ")
    .replace(/\s*\[Students:visible\]\s*/gu, " ")
    .replace(/\s*\[Audience:(PK_UK|US_CA|AU)\]\s*/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function getLiveClassAudienceGroup(title: string): LiveClassAudienceGroup {
  const match = title.match(/\[Audience:(PK_UK|US_CA|AU)\]/u);
  return match ? (match[1] as LiveClassAudienceGroup) : "ALL";
}

export function isLiveClassVisibleToStudents(title: string) {
  return !title.includes(HIDDEN_FROM_STUDENTS_MARKER);
}

export function getLiveClassAudienceLabel(titleOrGroup: string) {
  const group = normalizeAudienceGroup(titleOrGroup) === "ALL" && !LIVE_CLASS_AUDIENCE_GROUPS.includes(titleOrGroup as LiveClassAudienceGroup)
    ? getLiveClassAudienceGroup(titleOrGroup)
    : normalizeAudienceGroup(titleOrGroup);
  return AUDIENCE_LABELS[group];
}

function withAudienceMarker(title: string, group: LiveClassAudienceGroup) {
  return `${cleanLiveClassTitle(title)}${audienceTitleMarker(group)}`;
}

function withClassMarkers(title: string, group: LiveClassAudienceGroup, showToStudents = true) {
  return `${withAudienceMarker(title, group)} ${showToStudents ? VISIBLE_TO_STUDENTS_MARKER : HIDDEN_FROM_STUDENTS_MARKER}`;
}

function getScheduleStartDate(input: Pick<CreateLiveClassInput, "weekday" | "startTime" | "startDate">) {
  if (input.startDate) {
    const parsed = new Date(`${input.startDate}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return nextWeeklyOccurrence(input.weekday, input.startTime, parsed);
    }
  }

  return nextWeeklyOccurrence(input.weekday, input.startTime);
}

function normalizeCountryAudienceCode(countryCode: string | null | undefined) {
  return (countryCode ?? "").trim().toUpperCase().replace(/[^\dA-Z+]/gu, "");
}

export function countryMatchesLiveClassAudience(
  countryCodeOrCodes: string | Array<string | null | undefined> | null | undefined,
  group: LiveClassAudienceGroup,
) {
  const codes = Array.isArray(countryCodeOrCodes) ? countryCodeOrCodes : [countryCodeOrCodes];
  const normalizedCodes = codes.map(normalizeCountryAudienceCode).filter(Boolean);
  if (group === "ALL") return true;
  if (group === "PK_UK") return normalizedCodes.some((code) => ["PK", "PAK", "PAKISTAN", "+92", "92", "GB", "UK", "GBR", "UNITEDKINGDOM", "+44", "44"].includes(code));
  if (group === "US_CA") return normalizedCodes.some((code) => ["US", "USA", "UNITEDSTATES", "CA", "CAN", "CANADA", "+1", "1"].includes(code));
  if (group === "AU") return normalizedCodes.some((code) => ["AU", "AUS", "AUSTRALIA", "+61", "61"].includes(code));
  return true;
}

export function enrollmentMatchesLiveClassAudience(
  enrollment: {
    student?: {
      countryCode?: string | null;
      countryName?: string | null;
      registrationStudents?: Array<{ countryCode?: string | null; countryName?: string | null }> | null;
    } | null;
    parent?: {
      billingCountryCode?: string | null;
      billingCountryName?: string | null;
      user?: { phoneCountryCode?: string | null } | null;
    } | null;
  },
  group: LiveClassAudienceGroup,
) {
  const registrationCountries = enrollment.student?.registrationStudents ?? [];
  return countryMatchesLiveClassAudience(
    [
      enrollment.student?.countryCode,
      enrollment.student?.countryName,
      ...registrationCountries.flatMap((entry) => [entry.countryCode, entry.countryName]),
      enrollment.parent?.billingCountryCode,
      enrollment.parent?.billingCountryName,
      enrollment.parent?.user?.phoneCountryCode,
    ],
    group,
  );
}

function teacherDisplayName(teacher: { user: { firstName: string; lastName: string | null; email: string } }) {
  return `${teacher.user.firstName} ${teacher.user.lastName ?? ""}`.trim() || teacher.user.email;
}

function personName(user: { firstName: string; lastName: string | null; email: string }) {
  return `${user.firstName} ${user.lastName ?? ""}`.trim() || user.firstName || user.email;
}

function canSendScheduleEmail(email: string | null | undefined) {
  return Boolean(email && !email.endsWith("@genmumin.local"));
}

function isAlternativeHostLicenseError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("alternative host") && (message.includes("not licensed") || message.includes("code 1115"));
}

async function createZoomMeetingAllowingBasicUsers(
  payload: Parameters<typeof createRecurringZoomMeeting>[0],
  options?: Parameters<typeof createRecurringZoomMeeting>[1],
) {
  try {
    return await createRecurringZoomMeeting(payload, options);
  } catch (error) {
    if (!payload.alternativeHosts?.length || !isAlternativeHostLicenseError(error)) {
      throw error;
    }

    const { alternativeHosts: _alternativeHosts, ...meetingWithoutAlternativeHosts } = payload;
    return createRecurringZoomMeeting(meetingWithoutAlternativeHosts, options);
  }
}

async function createZoomMeetingForTeacher(input: CreateLiveClassInput, programTitle: string) {
  if (!input.createZoomMeeting) return null;

  return createZoomMeetingAllowingBasicUsers({
    topic: cleanLiveClassTitle(input.title),
    agenda: `${programTitle} teacher-created live session`,
    timezone: input.timezone,
    startTime: toZoomLocalStartTime(getScheduleStartDate(input)),
    durationMinutes: durationMinutes(input.startTime, input.endTime),
    weekday: input.weekday,
    waitingRoom: input.waitingRoom,
    joinBeforeHost: input.joinBeforeHost,
    muteUponEntry: input.muteUponEntry,
    autoRecording: input.autoRecording,
    passcode: input.passcode,
    alternativeHosts: [],
  });
}

function isRosterTableUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("TeacherStudentRoster") ||
    message.includes("ClassScheduleRoster") ||
    message.includes("doesn't exist") ||
    message.includes("does not exist") ||
    message.includes("P2021")
  );
}

export async function getTeacherProgramRosterEntries(teacherId: string) {
  try {
    return await db.teacherStudentRoster.findMany({
      where: { teacherId },
      select: { programId: true, studentId: true },
    });
  } catch (error) {
    if (isRosterTableUnavailable(error)) {
      console.error("Teacher roster tables are not available yet.", error);
      return [];
    }
    throw error;
  }
}

export async function getTeacherProgramRosterStudentIds(teacherId: string, programId: string) {
  try {
    const rosterEntries = await db.teacherStudentRoster.findMany({
      where: { teacherId, programId },
      select: { studentId: true },
    });
    return rosterEntries.map((entry) => entry.studentId);
  } catch (error) {
    if (isRosterTableUnavailable(error)) {
      console.error("Teacher roster tables are not available yet.", error);
      return [];
    }
    throw error;
  }
}

export async function syncTeacherProgramRoster(teacherId: string, programId: string, studentIds: string[]) {
  try {
    const existing = await db.teacherStudentRoster.findMany({
      where: { teacherId, programId },
      select: { id: true, studentId: true },
    });

    const existingIds = new Set(existing.map((entry) => entry.studentId));
    const toRemove = existing.filter((entry) => !studentIds.includes(entry.studentId)).map((entry) => entry.id);
    const toAdd = studentIds.filter((studentId) => !existingIds.has(studentId));

    const operations = [
      ...(toRemove.length ? [db.teacherStudentRoster.deleteMany({ where: { id: { in: toRemove } } })] : []),
      ...toAdd.map((studentId) =>
        db.teacherStudentRoster.create({
          data: {
            teacherId,
            programId,
            studentId,
          },
        }),
      ),
    ];

    if (operations.length) {
      await db.$transaction(operations);
    }
  } catch (error) {
    if (isRosterTableUnavailable(error)) {
      throw new Error("Roster saving is not ready yet because the roster database tables have not been deployed.");
    }
    throw error;
  }
}

function offerIncludesProgram(
  offer: {
    slug: string;
    programs: Array<{ programId: string; program: { slug: string } }>;
  },
  program: { id: string; slug: string },
) {
  const compatibleSlugs = isArabicTajweedSlug(program.slug) ? ["arabic", "tajweed"] : [program.slug];
  if (offer.programs.some((entry) => entry.programId === program.id || compatibleSlugs.includes(entry.program.slug))) {
    return true;
  }

  return getCatalogOfferProgramSlugs(offer.slug).some((slug) => compatibleSlugs.includes(slug));
}

export async function getProgramEligibleRosterStudents(programId: string) {
  const program = await db.program.findUnique({
    where: { id: programId },
    select: { id: true, slug: true },
  });

  if (!program) {
    return [];
  }

  const compatibleProgramSlugs = isArabicTajweedSlug(program.slug) ? ["arabic", "tajweed"] : [program.slug];
  const [directEnrollmentStudents, paidRegistrationStudents] = await Promise.all([
    db.studentProfile.findMany({
      where: {
        enrollments: {
          some: {
            program: { slug: { in: compatibleProgramSlugs } },
            status: { in: [...ACTIVE_ENROLLMENT_STATUSES] },
          },
        },
      },
      include: {
        user: true,
        enrollments: {
          where: { program: { slug: { in: compatibleProgramSlugs } } },
          select: { status: true },
        },
        registrationStudents: {
          include: {
            registration: {
              select: {
                status: true,
              },
            },
            items: {
              include: {
                offer: {
                  include: {
                    programs: {
                      include: {
                        program: {
                          select: {
                            slug: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.registrationStudent.findMany({
      where: {
        studentProfileId: { not: null },
        registration: {
          status: { in: [...PAID_REGISTRATION_STATUSES] },
        },
      },
      include: {
        studentProfile: {
          include: {
            user: true,
            enrollments: {
              where: { program: { slug: { in: compatibleProgramSlugs } } },
              select: { status: true },
            },
            registrationStudents: {
              include: {
                registration: {
                  select: {
                    status: true,
                  },
                },
                items: {
                  include: {
                    offer: {
                      include: {
                        programs: {
                          include: {
                            program: {
                              select: {
                                slug: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        items: {
          include: {
            offer: {
              include: {
                programs: {
                  include: {
                    program: {
                      select: {
                        slug: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const studentsById = new Map<string, (typeof directEnrollmentStudents)[number]>();

  for (const student of directEnrollmentStudents) {
    const activeDirectEnrollment = student.enrollments.some((enrollment) =>
      ACTIVE_ENROLLMENT_STATUSES.includes(enrollment.status as (typeof ACTIVE_ENROLLMENT_STATUSES)[number]),
    );
    const paidRegistrationItems = student.registrationStudents.flatMap((registrationStudent) =>
      PAID_REGISTRATION_STATUSES.includes(registrationStudent.registration.status as (typeof PAID_REGISTRATION_STATUSES)[number])
        ? registrationStudent.items
        : [],
    );
    const hasRegistrationOfferEvidence = paidRegistrationItems.length > 0;
    const hasProgramOffer = paidRegistrationItems.some((item) => offerIncludesProgram(item.offer, program));

    if (hasProgramOffer || (activeDirectEnrollment && !hasRegistrationOfferEvidence)) {
      studentsById.set(student.id, student);
    }
  }

  for (const registrationStudent of paidRegistrationStudents) {
    if (!registrationStudent.studentProfile) continue;

    const hasProgramOffer = registrationStudent.items.some((item) => offerIncludesProgram(item.offer, program));
    if (hasProgramOffer) {
      studentsById.set(registrationStudent.studentProfile.id, registrationStudent.studentProfile);
    }
  }

  return Array.from(studentsById.values()).sort((left, right) => {
    const leftName = left.displayName || `${left.user.firstName} ${left.user.lastName ?? ""}`.trim() || left.user.email;
    const rightName = right.displayName || `${right.user.firstName} ${right.user.lastName ?? ""}`.trim() || right.user.email;
    return leftName.localeCompare(rightName);
  });
}

export async function getScheduleRosterStudentIds(scheduleId: string) {
  let scheduleRoster: Array<{ studentId: string }> = [];
  try {
    scheduleRoster = await db.classScheduleRoster.findMany({
      where: { scheduleId },
      select: { studentId: true },
    });
  } catch (error) {
    if (isRosterTableUnavailable(error)) {
      console.error("Class schedule roster table is not available yet.", error);
    } else {
      throw error;
    }
  }

  if (scheduleRoster.length) {
    return scheduleRoster.map((entry) => entry.studentId);
  }

  const schedule = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      teacherId: true,
      programId: true,
    },
  });

  if (!schedule) {
    return [];
  }

  return getTeacherProgramRosterStudentIds(schedule.teacherId, schedule.programId);
}

export async function syncScheduleRoster(scheduleId: string, studentIds: string[]) {
  try {
    const existing = await db.classScheduleRoster.findMany({
      where: { scheduleId },
      select: { id: true, studentId: true },
    });

    const existingIds = new Set(existing.map((entry) => entry.studentId));
    const toRemove = existing.filter((entry) => !studentIds.includes(entry.studentId)).map((entry) => entry.id);
    const toAdd = studentIds.filter((studentId) => !existingIds.has(studentId));

    const operations = [
      ...(toRemove.length ? [db.classScheduleRoster.deleteMany({ where: { id: { in: toRemove } } })] : []),
      ...toAdd.map((studentId) =>
        db.classScheduleRoster.create({
          data: {
            scheduleId,
            studentId,
          },
        }),
      ),
    ];

    if (operations.length) {
      await db.$transaction(operations);
    }
  } catch (error) {
    if (isRosterTableUnavailable(error)) {
      throw new Error("Session roster saving is not ready yet because the roster database tables have not been deployed.");
    }
    throw error;
  }
}

async function syncAutomaticScheduleRoster(scheduleId: string) {
  const schedule = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      title: true,
      teacherId: true,
      programId: true,
      program: {
        select: {
          enrollments: {
            where: { status: { in: [...ACTIVE_ENROLLMENT_STATUSES] } },
            include: {
              parent: {
                include: {
                  user: true,
                },
              },
              student: {
                include: {
                  registrationStudents: {
                    select: {
                      countryCode: true,
                      countryName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!schedule) return;

  const audienceGroup = getLiveClassAudienceGroup(schedule.title);
  const defaultRosterStudentIds = new Set(await getTeacherProgramRosterStudentIds(schedule.teacherId, schedule.programId));
  const hasDefaultRoster = defaultRosterStudentIds.size > 0;
  const studentIds = schedule.program.enrollments
    .filter((enrollment) => !hasDefaultRoster || defaultRosterStudentIds.has(enrollment.studentId))
    .filter((enrollment) => enrollmentMatchesLiveClassAudience(enrollment, audienceGroup))
    .map((enrollment) => enrollment.studentId);

  await syncScheduleRoster(schedule.id, Array.from(new Set(studentIds)));
}

export async function createLiveClass(input: CreateLiveClassInput, createdByUserId?: string) {
  const audienceGroup = normalizeAudienceGroup(input.audienceGroup);
  const teacherIds = input.teacherIds?.length ? input.teacherIds : input.teacherId ? [input.teacherId] : [];
  if (!teacherIds.length) throw new Error("Choose at least one teacher.");

  const teachers = await db.teacherProfile.findMany({
    where: { id: { in: teacherIds } },
    include: { user: true },
  });
  if (!teachers.length) throw new Error("Teacher not found.");

  const programs =
    input.programId === WHOLE_GEN_MUMIN_PROGRAM_ID
      ? await db.program.findMany({ where: { status: { not: "DRAFT" } }, orderBy: { sortOrder: "asc" } })
      : await db.program.findMany({ where: { id: input.programId } });
  if (!programs.length) throw new Error("Program not found.");

  const meeting = input.createZoomMeeting
    ? await createZoomMeetingAllowingBasicUsers({
        topic: cleanLiveClassTitle(input.title),
        agenda:
          input.programId === WHOLE_GEN_MUMIN_PROGRAM_ID
            ? "Whole Gen-Mumin live session"
            : `${programs[0].title} live class`,
        timezone: input.timezone,
        startTime: toZoomLocalStartTime(getScheduleStartDate(input)),
        durationMinutes: durationMinutes(input.startTime, input.endTime),
        weekday: input.weekday,
        waitingRoom: input.waitingRoom,
        joinBeforeHost: input.joinBeforeHost,
        muteUponEntry: input.muteUponEntry,
        autoRecording: input.autoRecording,
        passcode: input.passcode,
        alternativeHosts: [],
      })
    : null;

  const createdSchedules = [];

  for (const program of programs) {
    for (const teacher of teachers) {
      const schedule = await db.classSchedule.create({
        data: {
          programId: program.id,
          teacherId: teacher.id,
          createdByUserId,
          title: withClassMarkers(
            input.programId === WHOLE_GEN_MUMIN_PROGRAM_ID ? `Whole Gen-Mumin: ${input.title}` : input.title,
            audienceGroup,
            input.showToStudents,
          ),
          weekday: input.weekday,
          startTime: input.startTime,
          endTime: input.endTime,
          timezone: input.timezone,
          meetingProvider: meeting ? "Zoom" : null,
          meetingUrl: meeting?.join_url ?? null,
          meetingId: meeting?.id ? String(meeting.id) : null,
          recurringSeriesId: meeting?.id ? String(meeting.id) : null,
          startsOn: getScheduleStartDate(input),
        },
      });

      await db.teacherProgram.upsert({
        where: {
          teacherId_programId: {
            teacherId: teacher.id,
            programId: program.id,
          },
        },
        create: {
          teacherId: teacher.id,
          programId: program.id,
        },
        update: {},
      });

      await syncAutomaticScheduleRoster(schedule.id);
      createdSchedules.push(schedule);
    }
  }

  for (const schedule of createdSchedules) {
    await notifyEnrolledUsers(schedule.id);
  }

  return createdSchedules[0];
}

export async function requestTeacherLiveClass(input: CreateLiveClassInput, teacherUserId: string) {
  const audienceGroup = normalizeAudienceGroup(input.audienceGroup);
  if (!input.startDate) {
    throw new Error("Choose the first class date. The weekly day is taken from that calendar date.");
  }

  const teacher = await db.teacherProfile.findUnique({
    where: { userId: teacherUserId },
    include: { user: true, programAssignments: true },
  });
  if (!teacher) throw new Error("Teacher not found.");
  if (!teacher.programAssignments.some((assignment) => assignment.programId === input.programId)) {
    throw new Error("You can only request sessions for assigned programs.");
  }

  const program = await db.program.findUnique({ where: { id: input.programId } });
  if (!program) throw new Error("Program not found.");

  const meeting = await createZoomMeetingForTeacher(input, program.title);

  const schedule = await db.classSchedule.create({
    data: {
      programId: input.programId,
      teacherId: teacher.id,
      createdByUserId: teacherUserId,
      title: withClassMarkers(input.title, audienceGroup, input.showToStudents),
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      timezone: input.timezone,
      meetingProvider: meeting ? "Zoom" : null,
      meetingUrl: meeting?.join_url ?? null,
      meetingId: meeting?.id ? String(meeting.id) : null,
      recurringSeriesId: meeting?.id ? String(meeting.id) : null,
      startsOn: getScheduleStartDate(input),
    },
  });

  await syncAutomaticScheduleRoster(schedule.id);

  const admins = await db.user.findMany({ where: { role: "ADMIN" } });
  if (admins.length) {
    await db.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        title: "Teacher scheduled a Zoom class",
        body: `${teacherDisplayName(teacher)} scheduled ${cleanLiveClassTitle(input.title)} for ${program.title} (${AUDIENCE_LABELS[audienceGroup]}).`,
        href: "/admin/classes",
      })),
    });
  }

  await sendAdminZoomMeetingRequestEmail({
    teacherName: teacherDisplayName(teacher),
    teacherEmail: teacher.user.email,
    programTitle: program.title,
    sessionTitle: cleanLiveClassTitle(input.title),
    schedule: `${input.startTime}-${input.endTime} ${input.timezone}`,
  });

  await notifyEnrolledUsers(schedule.id);

  return schedule;
}

export async function approveTeacherLiveClass(scheduleId: string, approvedByUserId: string) {
  if (!isZoomConfigured()) {
    throw new Error("Zoom is not configured.");
  }

  const schedule = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      program: true,
      teacher: { include: { user: true } },
    },
  });
  if (!schedule) throw new Error("Class schedule not found.");

  const meeting = await createRecurringZoomMeeting({
    topic: cleanLiveClassTitle(schedule.title),
    agenda: `${schedule.program.title} approved live session`,
    timezone: schedule.timezone,
    startTime: toZoomLocalStartTime(nextWeeklyOccurrence(schedule.weekday, schedule.startTime)),
    durationMinutes: durationMinutes(schedule.startTime, schedule.endTime),
    weekday: schedule.weekday,
  });

  const updated = await db.classSchedule.update({
    where: { id: schedule.id },
    data: {
      createdByUserId: schedule.createdByUserId ?? approvedByUserId,
      meetingProvider: "Zoom",
      meetingUrl: meeting.join_url,
      meetingId: String(meeting.id),
      recurringSeriesId: String(meeting.id),
    },
  });

  await syncAutomaticScheduleRoster(updated.id);

  await db.notification.create({
    data: {
      userId: schedule.teacher.user.id,
      title: "Zoom meeting approved",
      body: `${cleanLiveClassTitle(schedule.title)} has been approved and linked to Zoom.`,
      href: "/teacher/schedule",
    },
  });

  await sendTeacherZoomMeetingApprovedEmail({
    toEmail: schedule.teacher.user.email,
    teacherName: schedule.teacher.user.firstName,
    sessionTitle: cleanLiveClassTitle(schedule.title),
    programTitle: schedule.program.title,
  });

  await notifyEnrolledUsers(updated.id);
  return updated;
}

export async function rejectTeacherLiveClass(scheduleId: string) {
  const schedule = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    include: { teacher: { include: { user: true } } },
  });
  if (!schedule) throw new Error("Class schedule not found.");

  await db.classSchedule.delete({ where: { id: scheduleId } });
  await db.notification.create({
    data: {
      userId: schedule.teacher.user.id,
      title: "Zoom meeting request declined",
      body: `${schedule.title} was not approved by admin.`,
      href: "/teacher/schedule",
    },
  });
}

export async function syncScheduleToZoom(scheduleId: string) {
  if (!isZoomConfigured()) {
    throw new Error("Zoom is not configured.");
  }

  const schedule = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      program: true,
      teacher: { include: { user: true } },
    },
  });
  if (!schedule) throw new Error("Class schedule not found.");

  const meeting = await createRecurringZoomMeeting({
    topic: cleanLiveClassTitle(schedule.title),
    agenda: `${schedule.program.title} live class with ${schedule.teacher.user.firstName} ${schedule.teacher.user.lastName}`.trim(),
    timezone: schedule.timezone,
    startTime: toZoomLocalStartTime(nextWeeklyOccurrence(schedule.weekday, schedule.startTime)),
    durationMinutes: durationMinutes(schedule.startTime, schedule.endTime),
    weekday: schedule.weekday,
  });

  const updated = await db.classSchedule.update({
    where: { id: schedule.id },
    data: {
      meetingProvider: "Zoom",
      meetingUrl: meeting.join_url,
      meetingId: String(meeting.id),
      recurringSeriesId: String(meeting.id),
      startsOn: schedule.startsOn ?? nextWeeklyOccurrence(schedule.weekday, schedule.startTime),
    },
  });

  await syncAutomaticScheduleRoster(updated.id);

  await notifyEnrolledUsers(updated.id);
  return updated;
}

export async function notifyEnrolledUsers(scheduleId: string) {
  const schedule = await db.classSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      program: {
        include: {
          enrollments: {
            where: { status: { in: ["ACTIVE", "CONFIRMED", "COMPLETED"] } },
            include: {
              parent: { include: { user: true } },
              student: {
                include: {
                  user: true,
                  registrationStudents: {
                    select: {
                      countryCode: true,
                      countryName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      teacher: { include: { user: true } },
    },
  });
  if (!schedule || !schedule.meetingUrl || !isLiveClassVisibleToStudents(schedule.title)) return;

  const audienceGroup = getLiveClassAudienceGroup(schedule.title);
  const visibleTitle = cleanLiveClassTitle(schedule.title);
  const scheduleLabel = `${WEEKDAY_LABELS[schedule.weekday] ?? "Weekly class"} ${schedule.startTime}-${schedule.endTime} ${schedule.timezone}`;
  const teacherName = teacherDisplayName(schedule.teacher);
  const rosterStudentIds = await getScheduleRosterStudentIds(schedule.id);
  const hasRosterOverride = rosterStudentIds.length > 0;
  const visibleStudentIds = new Set(rosterStudentIds);
  const users = new Map<string, { id: string; role: string }>();
  const emailRecipients = new Map<string, { toEmail: string; recipientName: string; dashboardPath: string }>();
  users.set(schedule.teacher.user.id, { id: schedule.teacher.user.id, role: "teacher" });

  for (const enrollment of schedule.program.enrollments) {
    if (!enrollmentMatchesLiveClassAudience(enrollment, audienceGroup)) continue;
    if (hasRosterOverride && !visibleStudentIds.has(enrollment.studentId)) continue;
    users.set(enrollment.student.user.id, { id: enrollment.student.user.id, role: "student" });
    if (canSendScheduleEmail(enrollment.student.user.email)) {
      emailRecipients.set(enrollment.student.user.email.toLowerCase(), {
        toEmail: enrollment.student.user.email,
        recipientName: personName(enrollment.student.user),
        dashboardPath: "/student/schedule",
      });
    }
    if (enrollment.parent?.user.id) {
      users.set(enrollment.parent.user.id, { id: enrollment.parent.user.id, role: "parent" });
      if (canSendScheduleEmail(enrollment.parent.user.email)) {
        emailRecipients.set(enrollment.parent.user.email.toLowerCase(), {
          toEmail: enrollment.parent.user.email,
          recipientName: personName(enrollment.parent.user),
          dashboardPath: `/parent/schedule?child=${enrollment.studentId}`,
        });
      }
    }
  }

  for (const user of users.values()) {
    await db.notification.create({
      data: {
        userId: user.id,
        title: "Live class scheduled",
        body: `${visibleTitle} is now scheduled on Zoom. ${schedule.startTime}-${schedule.endTime} ${schedule.timezone}.`,
        href:
          user.role === "teacher"
            ? "/teacher/schedule"
            : user.role === "parent"
              ? "/parent/schedule"
              : "/student/schedule",
      },
    });
  }

  const emailResults = await Promise.allSettled(
    [...emailRecipients.values()].map((recipient) =>
      sendLiveClassScheduledEmail({
        ...recipient,
        programTitle: schedule.program.title,
        sessionTitle: visibleTitle,
        teacherName,
        schedule: scheduleLabel,
      }),
    ),
  );

  for (const result of emailResults) {
    if (result.status === "rejected") {
      console.error("Unable to send live class schedule email", result.reason);
    }
  }
}
