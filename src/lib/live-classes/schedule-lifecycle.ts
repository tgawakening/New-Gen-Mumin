/** Ending a recurrence must never delete its historical records. */
export function hasScheduleEnded(schedule: { endsOn?: Date | string | null }, now = Date.now()) {
  return !!schedule.endsOn && new Date(schedule.endsOn).getTime() <= now;
}
