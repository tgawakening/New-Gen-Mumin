export function charityClassification(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).tgaCharity;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.effectiveAt !== "string" || !Number.isFinite(Date.parse(record.effectiveAt))) return null;
  return { effectiveAt: new Date(record.effectiveAt), includeOriginalPayment: record.includeOriginalPayment === true };
}

export function isCharityReceipt(metadata: unknown, paidAt: Date) {
  const classification = charityClassification(metadata);
  return Boolean(classification && paidAt >= classification.effectiveAt);
}
