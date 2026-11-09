/** Certificate permissions use verified account identities, never display names. */
const WEEKLY_CERTIFICATE_EMAILS = new Set(["mehranraziq@gmail.com", "umm.abdissamee@gmail.com"]);
const MALIHA_CERTIFICATE_EMAIL = "emancheman413@gmail.com";
type CertificateActor = { role: string; email: string; status?: string };

export function canAwardWeeklyCertificates(user: CertificateActor) {
  const email = user.email.trim().toLowerCase();
  return (user.role === "TEACHER" && WEEKLY_CERTIFICATE_EMAILS.has(email))
    || (user.role === "COMMUNICATIONS" && email === MALIHA_CERTIFICATE_EMAIL && user.status === "ACTIVE");
}

export function weeklyCertificateSignatory(author: { firstName: string; lastName?: string | null; email?: string } | null) {
  if (author?.email?.trim().toLowerCase() === MALIHA_CERTIFICATE_EMAIL) return "Sister Saba";
  return author ? `${author.firstName} ${author.lastName ?? ""}`.trim() : "Gen-Mumin Faculty";
}
