export function homeworkTiming(submittedAt: Date | null, dueDate: Date | null) {
  if (!submittedAt) return "Not submitted";
  return dueDate && submittedAt.getTime() > dueDate.getTime() ? "Submitted late" : "Submitted on time";
}

export function homeworkIsOpen(launchAt: string | null | undefined, now = new Date()) {
  return !launchAt || new Date(launchAt).getTime() <= now.getTime();
}

/** Teacher inputs use the teacher's timezone, including DST; old date-only values remain valid. */
export function homeworkDate(value: string | null, timezone: string, endOfDay = false) {
  if (!value) return null;
  const timed = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);
  if (!timed && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose a valid homework date and time.");
  const utc = new Date(timed ? `${value}:00.000Z` : `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (!Number.isFinite(+utc) || utc.toISOString().slice(0, timed ? 16 : 10) !== value) throw new Error("Choose a valid homework date and time.");
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  let result = +utc;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(result).map(({ type, value: part }) => [type, part]));
    const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second), utc.getUTCMilliseconds());
    result += +utc - local;
  }
  const resolved = new Date(result);
  if (timed) {
    const parts = Object.fromEntries(formatter.formatToParts(resolved).map(({ type, value: part }) => [type, part]));
    if (`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}` !== value) throw new Error("This time does not exist in your timezone. Choose another time.");
  }
  return resolved;
}

export function homeworkWeekDeadline(launch: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(launch)) return "";
  const value = new Date(`${launch}:00Z`);
  if (!Number.isFinite(+value)) return "";
  value.setUTCDate(value.getUTCDate() + 7);
  return value.toISOString().slice(0, 16);
}

export function homeworkDateDefaults(timezone: string, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map(({ type, value }) => [type, value]));
  const launch = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  return { launch, due: homeworkWeekDeadline(launch) };
}

export function homeworkWindow(launch: string | null, due: string | null, timezone: string) {
  const launchAt = homeworkDate(launch, timezone);
  const dueDate = homeworkDate(due, timezone, true);
  if (launchAt && dueDate && +dueDate < +launchAt) throw new Error("The due date must be on or after the launch date.");
  return { launchAt: launchAt?.toISOString() ?? null, dueDate };
}
