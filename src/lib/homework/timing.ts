export function homeworkTiming(submittedAt: Date | null, dueDate: Date | null) {
  if (!submittedAt) return "Not submitted";
  return dueDate && submittedAt.getTime() > dueDate.getTime() ? "Submitted late" : "Submitted on time";
}

export function homeworkIsOpen(launchAt: string | null | undefined, now = new Date()) {
  return !launchAt || new Date(launchAt).getTime() <= now.getTime();
}

/** Date-only teacher inputs use the teacher's timezone, including DST. */
export function homeworkDate(value: string | null, timezone: string, endOfDay = false) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Choose a valid homework date.");
  const utc = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (!Number.isFinite(+utc) || utc.toISOString().slice(0, 10) !== value) throw new Error("Choose a valid homework date.");
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  let result = +utc;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(result).map(({ type, value: part }) => [type, part]));
    const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second), utc.getUTCMilliseconds());
    result += +utc - local;
  }
  return new Date(result);
}

export function homeworkWindow(launch: string | null, due: string | null, timezone: string) {
  const launchAt = homeworkDate(launch, timezone);
  const dueDate = homeworkDate(due, timezone, true);
  if (launchAt && dueDate && +dueDate < +launchAt) throw new Error("The due date must be on or after the launch date.");
  return { launchAt: launchAt?.toISOString() ?? null, dueDate };
}
