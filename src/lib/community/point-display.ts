/** Neutral display for legacy arrival-time awards; stored ledger evidence is unchanged. */
export function pointActivityReason(sourceType: string, reason: string) {
  return sourceType === "ATTENDANCE_LATE" || sourceType === "ATTENDANCE_ON_TIME"
    ? "Attended live class" : reason;
}

export function pointActivityCategory(sourceType: string) {
  return sourceType === "ATTENDANCE_LATE" || sourceType === "ATTENDANCE_ON_TIME"
    ? "attendance" : sourceType.replaceAll("_", " ").toLowerCase();
}
