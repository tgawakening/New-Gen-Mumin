/** Identical on server and browser, regardless of the device timezone/locale. */
export function formatNotificationTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Date unavailable";
  const pkt = new Date(timestamp + 5 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return pad(pkt.getUTCDate()) + "/" + pad(pkt.getUTCMonth() + 1) + "/" + pkt.getUTCFullYear() + ", " + pad(pkt.getUTCHours()) + ":" + pad(pkt.getUTCMinutes()) + " PKT";
}
