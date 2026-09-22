/** Share the same resolved roster IDs used by live-class access and attendance. */
type ScheduleSource = {
  enrollments: Array<{ program: { schedules: Array<{ id: string }> } }>;
};

export async function loadDashboardScheduleRosters(
  students: ScheduleSource[],
  resolveRoster: (scheduleId: string) => Promise<string[]>,
): Promise<Map<string, readonly string[]>> {
  const scheduleIds = new Set(students.flatMap((student) =>
    student.enrollments.flatMap((enrollment) => enrollment.program.schedules.map((schedule) => schedule.id)),
  ));
  const entries = await Promise.all([...scheduleIds].map(async (id) => [id, await resolveRoster(id)] as const));
  return new Map(entries);
}

export function isStudentInDashboardRoster(
  scheduleId: string,
  studentId: string,
  rosters: ReadonlyMap<string, readonly string[]>,
) {
  return rosters.get(scheduleId)?.includes(studentId) ?? false;
}
