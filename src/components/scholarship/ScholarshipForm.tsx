"use client";

import { useState } from "react";

type Offer = {
  slug: string;
  title: string;
};

type ScholarshipFormProps = {
  offers: Offer[];
};

const DISCOUNT_OPTIONS = [25, 50, 75, 100] as const;

export function ScholarshipForm({ offers }: ScholarshipFormProps) {
  const [parentName, setParentName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentWhatsapp, setParentWhatsapp] = useState("");
  const [childAge, setChildAge] = useState("");
  const [childCountry, setChildCountry] = useState("");
  const [householdSize, setHouseholdSize] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [reasonForSupport, setReasonForSupport] = useState("");
  const [supportingDetails, setSupportingDetails] = useState("");
  const [requestedPercent, setRequestedPercent] = useState<(typeof DISCOUNT_OPTIONS)[number]>(50);
  const [offerSlug, setOfferSlug] = useState(offers[0]?.slug ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/scholarships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName,
          parentEmail,
          parentWhatsapp,
          childAge: Number(childAge),
          childCountry,
          householdSize: Number(householdSize),
          monthlyIncome,
          reasonForSupport,
          supportingDetails,
          requestedPercent,
          offerSlug,
        }),
      });

      const payload = (await response.json()) as { applicationId?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit scholarship application.");
      }

      setMessage("Scholarship application submitted successfully. Our team will review it and contact you by email.");
      setParentName("");
      setParentEmail("");
      setParentWhatsapp("");
      setChildAge("");
      setChildCountry("");
      setHouseholdSize("");
      setMonthlyIncome("");
      setReasonForSupport("");
      setSupportingDetails("");
      setRequestedPercent(50);
      setOfferSlug(offers[0]?.slug ?? "");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit scholarship application.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 rounded-[2rem] border border-[#eadfcd] bg-white p-6 shadow-sm md:grid-cols-2 md:p-8">
      <div className="md:col-span-2">
        <h2 className="text-2xl font-semibold text-[#22304a]">Scholarship application</h2>
        <p className="mt-2 text-sm leading-7 text-[#5f6b7a]">
          Share a few details and we will review the request for 25%, 50%, 75%, or full support.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[#405166]">Parent / Guardian name</label>
        <input value={parentName} onChange={(event) => setParentName(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" required />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[#405166]">Email address</label>
        <input type="email" value={parentEmail} onChange={(event) => setParentEmail(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" required />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[#405166]">WhatsApp number</label>
        <input value={parentWhatsapp} onChange={(event) => setParentWhatsapp(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" required />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[#405166]">Requested support</label>
        <select value={requestedPercent} onChange={(event) => setRequestedPercent(Number(event.target.value) as 25 | 50 | 75 | 100)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm">
          {DISCOUNT_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}%</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[#405166]">Child age</label>
        <input type="number" min="4" max="18" value={childAge} onChange={(event) => setChildAge(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" required />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[#405166]">Child country</label>
        <input value={childCountry} onChange={(event) => setChildCountry(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" required />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[#405166]">Household size</label>
        <input type="number" min="1" max="20" value={householdSize} onChange={(event) => setHouseholdSize(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" required />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-[#405166]">Program of interest</label>
        <select value={offerSlug} onChange={(event) => setOfferSlug(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm">
          {offers.map((offer) => (
            <option key={offer.slug} value={offer.slug}>{offer.title}</option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-[#405166]">Monthly income / financial context</label>
        <input value={monthlyIncome} onChange={(event) => setMonthlyIncome(event.target.value)} className="w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" required />
      </div>
      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-[#405166]">Why are you requesting support?</label>
        <textarea value={reasonForSupport} onChange={(event) => setReasonForSupport(event.target.value)} className="min-h-32 w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" required />
      </div>
      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-[#405166]">Additional details</label>
        <textarea value={supportingDetails} onChange={(event) => setSupportingDetails(event.target.value)} className="min-h-28 w-full rounded-2xl border border-[#d9deea] px-4 py-3 text-sm" />
      </div>

      {message ? <div className="md:col-span-2 rounded-2xl bg-[#effaf3] px-4 py-3 text-sm text-[#2f6b4b]">{message}</div> : null}
      {error ? <div className="md:col-span-2 rounded-2xl bg-[#fff4f4] px-4 py-3 text-sm text-[#a23c3c]">{error}</div> : null}

      <div className="md:col-span-2">
        <button type="submit" disabled={isSubmitting} className="rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {isSubmitting ? "Submitting..." : "Submit scholarship application"}
        </button>
      </div>
    </form>
  );
}
