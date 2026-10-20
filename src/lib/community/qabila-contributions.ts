type Contribution = {
  studentId: string; points: number; reason: string; sourceType: string; sourceId: string | null; awardedAt: Date;
};
export function latestContributions<T extends Contribution>(recent: T[]): T[] {
  const seen = new Set<string>();
  return recent.filter(row => { if (seen.has(row.studentId)) return false; seen.add(row.studentId); return true; });
}
export function prayerDay(row: Contribution) {
  return row.sourceType === "FARDH_PRAYER" && /^\d{4}-\d{2}-\d{2}:/.test(row.sourceId ?? "") ? row.sourceId!.slice(0, 10) : null;
}
export function summarizePrayerContributions<T extends Contribution>(recent: T[], prayers: Contribution[]): T[] {
  return recent.map(row => {
    const day = prayerDay(row);
    if (!day) return row;
    const entries = prayers.filter(p => p.studentId === row.studentId && p.sourceType === "FARDH_PRAYER" && prayerDay(p) === day);
    if (!entries.length) return row;
    return { ...row, points: entries.reduce((sum, entry) => sum + entry.points, 0), reason: "Daily Salah: " + entries.length + "/5 prayers (" + day + ")" };
  });
}
