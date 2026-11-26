export type ReportPeriod = { key: string | null; label: string; start: Date | null; end: Date | null; selection: "this" | "last" | "month" | "all"; latestPastMonth: string };

function monthKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit" }).formatToParts(date);
  return `${parts.find(p => p.type === "year")?.value}-${parts.find(p => p.type === "month")?.value}`;
}
function shiftMonth(key: string, offset: number) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function validMonth(key: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(key) && Number(key.slice(0, 4)) >= 1970;
}
function karachiMonthStart(year: number, monthIndex: number) {
  const utcGuess = Date.UTC(year, monthIndex, 1);
  const format = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  function offsetAt(instant: number) {
    const values = Object.fromEntries(format.formatToParts(new Date(instant)).map(part => [part.type, Number(part.value)]));
    return Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second) - instant;
  }
  const first = utcGuess - offsetAt(utcGuess);
  return new Date(utcGuess - offsetAt(first));
}
export function resolveReportPeriod(selection?: string | null, month?: string | null, now = new Date()): ReportPeriod {
  const current = monthKey(now);
  const last = shiftMonth(current, -1);
  const selected = selection === "all" || selection === "last" || selection === "month" ? selection : "this";
  if (selected === "all") return { key: null, label: "All time", start: null, end: null, selection: selected, latestPastMonth: last };
  const key = selected === "last" ? last : selected === "month" ? (month && validMonth(month) && month <= current ? month : last) : current;
  const [year, number] = key.split("-").map(Number);
  const start = karachiMonthStart(year, number - 1);
  const end = karachiMonthStart(year, number);
  const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date(Date.UTC(year, number - 1, 15)));
  return { key, label, start, end, selection: selected, latestPastMonth: last };
}
export function inReportPeriod(date: Date | null, period: ReportPeriod) {
  return period.start === null || (date !== null && date >= period.start && date < period.end!);
}
