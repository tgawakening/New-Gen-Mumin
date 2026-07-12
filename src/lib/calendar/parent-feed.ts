import "server-only";

import { db } from "@/lib/db";
import {
  countryMatchesLiveClassAudience,
  getLiveClassAudienceGroup,
  isLiveClassVisibleToStudents,
} from "@/lib/live-classes/service";
import { durationMinutes, nextWeeklyOccurrence } from "@/lib/live-classes/time";
import { buildIcsCalendar } from "@/lib/calendar/ics";

const ACTIVE_ENROLLMENT_STATUSES = ["ACTIVE", "CONFIRMED", "COMPLETED"];

function teacherName(schedule: {
  teacher?: { user?: { firstName: string; lastName: string } | null } | null;
}) {
  return schedule.teacher?.user
    ? `${schedule.teacher.user.firstName} ${schedule.teacher.user.lastName}`.trim()
    : "Gen-Mumin teacher";
}

function childName(student: {
  displayName: string | null;
  user: { firstName: string; lastName: string };
}) {
  return student.displayName?.trim() || `${student.user.firstName} ${student.user.lastName}`.trim();
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function allDayEnd(date: Date) {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function scheduleVisibleForStudent(schedule: any, student: any, programId: string) {
  if (!isLiveClassVisibleToStudents(schedule.title)) return false;

  const scheduleRosterIds = Array.isArray(schedule.scheduleRosters)
    ? schedule.scheduleRosters.map((entry: any) => entry.studentId)
    : [];
  const teacherRosterIds = Array.isArray(schedule.teacher?.programRosters)
    ? schedule.teacher.programRosters
        .filter((entry: any) => entry.programId === programId)
        .map((entry: any) => entry.studentId)
    : [];
  const visibleRosterIds = scheduleRosterIds.length ? scheduleRosterIds : teacherRosterIds;
  if (visibleRosterIds.length && !visibleRosterIds.includes(student.id)) return false;

  const registrationCountries = Array.isArray(student.registrationStudents)
    ? student.registrationStudents
    : [];

  return countryMatchesLiveClassAudience(
    [
      student.countryCode,
      student.countryName,
      ...registrationCountries.flatMap((entry: any) => [entry.countryCode, entry.countryName]),
    ],
    getLiveClassAudienceGroup(schedule.title),
  );
}

function nextScheduleOccurrences(schedule: any, windowEnd: Date) {
  const occurrences: Date[] = [];
  let cursor = nextWeeklyOccurrence(schedule.weekday, schedule.startTime);
  const startsOn = schedule.startsOn ? new Date(schedule.startsOn) : null;
  const endsOn = schedule.endsOn ? new Date(schedule.endsOn) : null;

  if (startsOn && cursor < startsOn) {
    cursor = nextWeeklyOccurrence(schedule.weekday, schedule.startTime, startsOn);
  }

  while (cursor <= windowEnd) {
    if ((!startsOn || cursor >= startsOn) && (!endsOn || cursor <= endsOn)) {
      occurrences.push(new Date(cursor));
    }
    cursor = addMinutes(cursor, 7 * 24 * 60);
  }

  return occurrences;
}

export async function buildParentCalendarFeed(parentProfileId: string) {
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 120);

  const [parent, parentNotices] = await Promise.all([
    db.parentProfile.findUnique({
    where: { id: parentProfileId },
    include: {
      user: true,
      students: {
        include: {
          student: {
            include: {
              user: true,
              registrationStudents: {
                select: {
                  countryCode: true,
                  countryName: true,
                },
              },
              enrollments: {
                where: {
                  status: { in: ACTIVE_ENROLLMENT_STATUSES as any },
                },
                include: {
                  program: {
                    include: {
                      assignments: {
                        where: {
                          dueDate: {
                            gte: now,
                            lte: windowEnd,
                          },
                        },
                      },
                      missions: {
                        where: {
                          status: "PUBLISHED",
                          OR: [
                            { opensAt: { gte: now, lte: windowEnd } },
                            { closesAt: { gte: now, lte: windowEnd } },
                          ],
                        },
                      },
                      projects: {
                        where: {
                          dueDate: {
                            gte: now,
                            lte: windowEnd,
                          },
                        },
                      },
                      schedules: {
                        include: {
                          scheduleRosters: true,
                          teacher: {
                            include: {
                              user: true,
                              programRosters: true,
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
    },
    }),
    db.communityMessage.findMany({
      where: {
        status: "VISIBLE",
        createdAt: { gte: now },
        room: {
          isActive: true,
          type: { in: ["ANNOUNCEMENT", "PARENT_NOTICE"] },
        },
      },
      include: { room: true },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);

  if (!parent) return null;

  const events = parent.students.flatMap(({ student }) => {
    const learnerName = childName(student);

    return student.enrollments.flatMap((enrollment) => {
      const program = enrollment.program;
      const liveSessionEvents = program.schedules
        .filter((schedule) => scheduleVisibleForStudent(schedule, student, program.id))
        .flatMap((schedule) => {
          const minutes = durationMinutes(schedule.startTime, schedule.endTime);
          return nextScheduleOccurrences(schedule, windowEnd).map((startsAt) => ({
            id: `class-${schedule.id}-${student.id}-${startsAt.toISOString().slice(0, 10)}`,
            title: `${program.title}: ${schedule.title}`,
            description: [
              `Learner: ${learnerName}`,
              `Teacher: ${teacherName(schedule)}`,
              schedule.meetingUrl ? `Join link: ${schedule.meetingUrl}` : null,
            ]
              .filter(Boolean)
              .join("\n"),
            location: schedule.meetingProvider ?? "Gen-Mumin live class",
            startsAt,
            endsAt: addMinutes(startsAt, minutes),
            url: schedule.meetingUrl,
          }));
        });

      const assignmentEvents = program.assignments.map((assignment) => ({
        id: `assignment-${assignment.id}-${student.id}`,
        title: `${program.title}: ${assignment.title} due`,
        description: `Learner: ${learnerName}\nHomework/task deadline from Gen-Mumin dashboard.`,
        startsAt: assignment.dueDate!,
        endsAt: allDayEnd(assignment.dueDate!),
        allDay: true,
        url: `${process.env.NEXT_PUBLIC_APP_URL || "https://genmumin.com"}/parent`,
      }));

      const missionEvents = program.missions.flatMap((mission) => {
        const dates = [
          mission.opensAt
            ? {
                id: `mission-open-${mission.id}-${student.id}`,
                title: `${mission.title} opens`,
                startsAt: mission.opensAt,
              }
            : null,
          mission.closesAt
            ? {
                id: `mission-close-${mission.id}-${student.id}`,
                title: `${mission.title} closes`,
                startsAt: mission.closesAt,
              }
            : null,
        ].filter(Boolean) as Array<{ id: string; title: string; startsAt: Date }>;

        return dates.map((entry) => ({
          id: entry.id,
          title: `Gen-Mumin mission: ${entry.title}`,
          description: `Learner: ${learnerName}\nMission/reminder from Gen-Mumin dashboard.`,
          startsAt: entry.startsAt,
          endsAt: addMinutes(entry.startsAt, 30),
          url: `${process.env.NEXT_PUBLIC_APP_URL || "https://genmumin.com"}/parent/sunnah-tracker`,
        }));
      });

      const projectEvents = program.projects.map((project) => ({
        id: `project-${project.id}-${student.id}`,
        title: `${program.title}: ${project.title} deadline`,
        description: `Learner: ${learnerName}\nTeam project deadline from Gen-Mumin dashboard.`,
        startsAt: project.dueDate!,
        endsAt: allDayEnd(project.dueDate!),
        allDay: true,
        url: `${process.env.NEXT_PUBLIC_APP_URL || "https://genmumin.com"}/parent/community`,
      }));

      return [...liveSessionEvents, ...assignmentEvents, ...missionEvents, ...projectEvents];
    });
  });

  const noticeEvents = parentNotices.map((notice) => ({
    id: `notice-${notice.id}`,
    title: `Gen-Mumin notice: ${notice.room.title}`,
    description: notice.body,
    startsAt: notice.createdAt,
    endsAt: allDayEnd(notice.createdAt),
    allDay: true,
    url: `${process.env.NEXT_PUBLIC_APP_URL || "https://genmumin.com"}/parent/community`,
  }));

  const allEvents = [...events, ...noticeEvents];

  const deduped = [...new Map(allEvents.map((event) => [event.id, event])).values()].sort(
    (left, right) => left.startsAt.getTime() - right.startsAt.getTime(),
  );

  return buildIcsCalendar({
    name: "Gen-Mumin Family Calendar",
    description: "Live classes, parent reminders, missions, homework deadlines, and Gen-Mumin announcements.",
    events: deduped,
  });
}
