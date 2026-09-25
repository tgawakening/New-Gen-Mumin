import type { AttendanceHistoryEntry } from "@/lib/live-classes/attendance-reports";

function dateTime(value: Date | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" }).format(value) : "Not recorded";
}

function statusClass(status: string) {
  if (status === "PRESENT") return "bg-[#e9f8ef] text-[#237044]";
  if (status === "NEEDS_CONFIRMATION") return "bg-[#fff2d8] text-[#8b5d12]";
  if (status === "LATE") return "bg-[#fff2d8] text-[#8b5d12]";
  if (status === "EXCUSED") return "bg-[#edf3ff] text-[#315c9c]";
  return "bg-[#fdeaea] text-[#a23c3c]";
}

export function AttendanceHistory({ records }: { records: AttendanceHistoryEntry[] }) {
  if (!records.length) return <p className="rounded-[22px] bg-[#fbf6ef] p-5 text-sm text-[#617184]">Attendance will appear after the next tracked class.</p>;
  return <div className="space-y-3">{records.map((record) => <article key={record.id} className="rounded-[22px] border border-[#eadfce] bg-[#fbf6ef] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase text-[#c27a2c]">{record.programTitle}</p><h3 className="mt-1 font-semibold text-[#22304a]">{record.classTitle}</h3><p className="mt-1 text-sm text-[#617184]">{dateTime(record.lessonDate)} PKT - {record.teacherName}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(record.status)}`}>{record.source === "admin-recovery-estimate" ? "Reported - dates uncertain" : record.status === "NEEDS_CONFIRMATION" ? "Needs confirmation" : record.status}</span></div><p className="mt-2 text-xs text-[#617184]">{record.source === "admin-recovery-estimate" ? "Parent reported a missed-class count. See the period summary; this date is not individually confirmed." : record.source === "admin-recovery" ? "Parent report recorded by admin" : record.source === "parent-confirmed" ? "Confirmed by parent" : record.status === "NEEDS_CONFIRMATION" ? "Unmatched attendance is excluded from the percentage until confirmed." : record.source === "zoom" ? "Verified through Zoom" : "Recorded by teacher or admin"}</p><div className="mt-3 grid gap-2 text-sm sm:grid-cols-3"><p><strong>Joined:</strong> {dateTime(record.joinedAt)}</p><p><strong>Left:</strong> {dateTime(record.leftAt)}</p><p><strong>Class time:</strong> {record.durationMinutes == null ? "Not recorded" : `${record.durationMinutes} minutes`}</p></div></article>)}</div>;
}
