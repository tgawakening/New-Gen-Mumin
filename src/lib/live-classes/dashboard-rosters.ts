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
  const rosters = new Map<string, readonly string[]>();
  const pending = [...scheduleIds];
  // Bound database fan-out on pages with many class schedules.
  await Promise.all(Array.from({ length: Math.min(2, pending.length) }, async () => {
    let id: string | undefined;
    while ((id = pending.shift()) !== undefined) rosters.set(id, await resolveRoster(id));
  }));
  return rosters;
}

export function isStudentInDashboardRoster(
  scheduleId: string,
  studentId: string,
  rosters: ReadonlyMap<string, readonly string[]>,
) {
  return rosters.get(scheduleId)?.includes(studentId) ?? false;
}
