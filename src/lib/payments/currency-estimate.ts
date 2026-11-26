export type ManualRate = { value: string; updatedAt: string };
export type ManualRates = Record<string, ManualRate>;
export type CurrencyAmounts = [string, number][];

export function parseManualRate(value: string): number | null {
  const trimmed = value.trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null;
  const rate = Number(trimmed);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function estimateCurrencyAmounts(amounts: CurrencyAmounts, target: string, rates: ManualRates) {
  let total = 0;
  const missing: string[] = [];
  for (const [currency, amount] of amounts) {
    if (currency === target) { total += amount; continue; }
    const rate = parseManualRate(rates[`${currency}:${target}`]?.value ?? "");
    const converted = rate === null ? NaN : amount * rate;
    if (rate === null || !Number.isFinite(converted) || !Number.isFinite(total + converted)) {
      if (amount !== 0) missing.push(currency);
      continue;
    }
    total += converted;
  }
  return { total, missing };
}
