"use client";

import { useEffect, useState } from "react";
import { Calculator, Info } from "lucide-react";
import { estimateCurrencyAmounts, parseManualRate, type CurrencyAmounts, type ManualRates } from "@/lib/payments/currency-estimate";
const storageKey = "genmumin:payments-report:manual-rates:v1";
const formatAmount = new Intl.NumberFormat("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function readRates(): ManualRates {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const safe: ManualRates = {};
    for (const [key, item] of Object.entries(parsed)) {
      if (!/^[A-Z0-9]{1,12}:[A-Z0-9]{1,12}$/.test(key) || !item || typeof item !== "object" || Array.isArray(item)) continue;
      const value = (item as { value?: unknown }).value;
      const updatedAt = (item as { updatedAt?: unknown }).updatedAt;
      if (typeof value === "string" && typeof updatedAt === "string" && value.length <= 100 && Number.isFinite(Date.parse(updatedAt))) safe[key] = { value, updatedAt };
    }
    return safe;
  } catch {
    return {};
  }
}

export function CurrencyCalculator({ currencies, received, upcoming }: { currencies: string[]; received: CurrencyAmounts; upcoming: CurrencyAmounts }) {
  const [target, setTarget] = useState(() => currencies.includes("GBP") ? "GBP" : currencies[0] ?? "");
  const [rates, setRates] = useState<ManualRates>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => { setRates(readRates()); setReady(true); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateRate(currency: string, value: string) {
    const next = { ...rates, [`${currency}:${target}`]: { value, updatedAt: new Date().toISOString() } };
    setRates(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* The calculator still works when browser storage is unavailable. */ }
  }
  const others = currencies.filter((currency) => currency !== target);
  const figures = [{ label: "Total received", amounts: received }, { label: "Total upcoming and outstanding", amounts: upcoming }];

  return <section className="rounded-[28px] border border-[#dce4ed] bg-white p-5 shadow-sm sm:p-6" aria-labelledby="currency-calculator-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex max-w-2xl items-start gap-3"><span className="rounded-2xl bg-[#fff7eb] p-2.5 text-[#a66828]"><Calculator size={20} aria-hidden="true" /></span><div><h2 id="currency-calculator-title" className="text-lg font-semibold text-[#22304a]">See everything in one currency</h2><p className="mt-1 text-sm leading-6 text-[#617184]">Choose a currency and enter your own exchange rates to see an approximate combined amount. Your original amounts stay above.</p></div></div>
      {currencies.length > 0 && <label className="grid gap-1.5 text-sm font-semibold text-[#22304a]">Show estimates in<select value={target} onChange={(event) => setTarget(event.target.value)} className="min-h-11 min-w-32 rounded-2xl border border-[#c9d7e6] bg-white px-4 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22304a]">{currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</select></label>}
    </div>
    {!currencies.length ? <p className="mt-5 rounded-2xl bg-[#f6f8fa] p-4 text-sm text-[#617184]">There are no currencies to convert yet.</p> : <>
      <div className="mt-5 flex items-start gap-2 rounded-2xl bg-[#fff7eb] px-4 py-3 text-sm leading-6 text-[#73532c]"><Info aria-hidden="true" size={17} className="mt-1 shrink-0" /><p>Rates are entered manually and saved only in this browser. Check them before relying on an estimate.</p></div>
      {others.length > 0 ? <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{others.map((currency) => {
        const entry = rates[`${currency}:${target}`];
        const value = entry?.value ?? "";
        const valid = parseManualRate(value) !== null;
        const inputId = `payment-rate-${currency}-${target}`;
        return <div key={currency} className="rounded-2xl border border-[#e4eaf0] bg-[#f9fbfc] p-4"><label htmlFor={inputId} className="block text-sm font-semibold text-[#22304a]">1 {currency} = ? {target}</label><div className="mt-2 flex items-center gap-2"><input id={inputId} type="text" inputMode="decimal" autoComplete="off" placeholder="Enter rate" value={value} maxLength={100} disabled={!ready} onChange={(event) => updateRate(currency, event.target.value)} aria-invalid={value.trim() !== "" && !valid} aria-describedby={`${inputId}-hint`} className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#c9d7e6] bg-white px-3 py-2 text-sm tabular-nums text-[#22304a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22304a]" /><span className="text-sm font-semibold text-[#617184]">{target}</span></div><p id={`${inputId}-hint`} className="mt-2 text-xs leading-5 text-[#617184]">{value.trim() && !valid ? "Enter a number greater than zero." : valid && entry ? `Rate entered ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.updatedAt))} on this browser.` : "Enter the value of one unit in your chosen currency."}</p></div>;
      })}</div> : <p className="mt-5 text-sm text-[#617184]">All recorded amounts are already in {target}.</p>}
      <div className="mt-5 grid gap-3 md:grid-cols-2" aria-live="polite">{figures.map(({ label, amounts }) => {
        const result = estimateCurrencyAmounts(amounts, target, rates);
        const partial = result.missing.length > 0;
        return <div key={label} className="min-w-0 rounded-2xl border border-[#dce4ed] bg-[#f6f8fa] p-4"><p className="text-sm font-semibold text-[#617184]">{label}</p><p className="mt-2 text-xs leading-5 text-[#617184]">{partial ? `Estimated subtotal in ${target}, based on the rates you entered` : `Estimated total in ${target}, based on the rates you entered`}</p><p className="mt-1 break-all text-2xl font-semibold tabular-nums text-[#22304a]">{amounts.length ? `${target} ${formatAmount.format(result.total)}` : "None recorded"}</p>{partial && <p className="mt-2 text-xs font-medium leading-5 text-[#8a6326]">Not included: {result.missing.join(", ")}. Enter valid rates for a complete estimate.</p>}</div>;
      })}</div>
    </>}
  </section>;
}
