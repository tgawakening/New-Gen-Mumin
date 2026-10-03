export function currentRecognitionWeek(now = new Date()) {
 const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
 const part = (type: string) => parts.find(p => p.type === type)!.value;
 const date = new Date(part("year") + "-" + part("month") + "-" + part("day") + "T00:00:00Z");
 date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
 return date.toISOString().slice(0, 10);
}
export function validRecognitionWeek(value: unknown, now = new Date()): value is string {
 if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return false;
 const date = new Date(value + "T00:00:00Z");
 return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value && date.getUTCDay() === 1 && value <= currentRecognitionWeek(now);
}
export function recognitionWeekLabel(value: string) {
 const start = new Date(value + "T00:00:00Z");
 if (Number.isNaN(start.getTime())) return value;
 const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
 const format = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
 return format.format(start) + " - " + format.format(end);
}
export function recognitionMonthWeeks(month: string, currentWeek: string) {
 if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return [];
 const first = new Date(month + "-01T00:00:00Z"), end = new Date(first);
 end.setUTCMonth(end.getUTCMonth()+1);
 first.setUTCDate(first.getUTCDate() - (first.getUTCDay()+6)%7);
 const weeks: Array<{value:string;label:string}> = [];
 for (let number=1;first<end;number++,first.setUTCDate(first.getUTCDate()+7)) {
  const value=first.toISOString().slice(0,10);
  if(value<=currentWeek)weeks.push({value,label:"Week "+number+" ? "+recognitionWeekLabel(value)});
 }
 return weeks;
}
