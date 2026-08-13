import "server-only";

export function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 0;
  return hours * 60 + minutes;
}

export function durationMinutes(startTime: string, endTime: string) {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (end > start) return end - start;
  return 60;
}

export function nextWeeklyOccurrence(weekday: number, startTime: string, from = new Date()) {
  const [hours, minutes] = startTime.split(":").map((part) => Number(part));
  const next = new Date(from);
  next.setSeconds(0, 0);
  next.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);

  let daysUntilClass = weekday - next.getDay();
  if (daysUntilClass < 0 || (daysUntilClass === 0 && next <= from)) {
    daysUntilClass += 7;
  }

  next.setDate(next.getDate() + daysUntilClass);
  return next;
}

export function currentOrNextWeeklyOccurrence(weekday: number, startTime: string, endTime: string, from = new Date()) {
  const start = new Date(from);
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  start.setHours(Number.isFinite(startHour) ? startHour : 0, Number.isFinite(startMinute) ? startMinute : 0, 0, 0);
  const end = new Date(start);
  end.setHours(Number.isFinite(endHour) ? endHour : 0, Number.isFinite(endMinute) ? endMinute : 0, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);
  if (from.getDay() === weekday && from <= end) return start;
  return nextWeeklyOccurrence(weekday, startTime, from);
}

export function toZoomLocalStartTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:00`;
}
