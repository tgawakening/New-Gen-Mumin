import "server-only";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay?: boolean;
  url?: string | null;
};

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldLine(line: string) {
  const chunks: string[] = [];
  let remaining = line;
  while (remaining.length > 74) {
    chunks.push(remaining.slice(0, 74));
    remaining = ` ${remaining.slice(74)}`;
  }
  chunks.push(remaining);
  return chunks.join("\r\n");
}

function formatUtcDate(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function formatAllDay(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function eventLines(event: CalendarEvent) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.id}@genmumin.com`,
    `DTSTAMP:${formatUtcDate(new Date())}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatAllDay(event.startsAt)}`);
    lines.push(`DTEND;VALUE=DATE:${formatAllDay(event.endsAt)}`);
  } else {
    lines.push(`DTSTART:${formatUtcDate(event.startsAt)}`);
    lines.push(`DTEND:${formatUtcDate(event.endsAt)}`);
    lines.push("BEGIN:VALARM");
    lines.push("TRIGGER:-PT30M");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escapeText(event.title)}`);
    lines.push("END:VALARM");
  }

  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push("END:VEVENT");

  return lines.map(foldLine);
}

export function buildIcsCalendar({
  name,
  description,
  events,
}: {
  name: string;
  description: string;
  events: CalendarEvent[];
}) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gen-Mumin//Dashboard Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-CALDESC:${escapeText(description)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...events.flatMap(eventLines),
    "END:VCALENDAR",
  ];

  return `${lines.join("\r\n")}\r\n`;
}
