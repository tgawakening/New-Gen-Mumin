export const PAYSLIP_HIGHLIGHT_DAYS = 5;
export function payslipInitiallyOpen(publishedAt: string, preference: string | null, now = Date.now()) {
  if (preference === "closed") return false;
  if (preference === "open") return true;
  const age = now - new Date(publishedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < PAYSLIP_HIGHLIGHT_DAYS * 86400000;
}
