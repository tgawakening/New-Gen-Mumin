/** Use verified account identity, not editable display names, for certificate permissions. */
const WEEKLY_CERTIFICATE_EMAILS = new Set(["mehranraziq@gmail.com", "umm.abdissamee@gmail.com"]);

export function canAwardWeeklyCertificates(user: { role: string; email: string }) {
  return user.role === "TEACHER" && WEEKLY_CERTIFICATE_EMAILS.has(user.email.trim().toLowerCase());
}
