"use client";

import { type ReactNode, useMemo, useState } from "react";

type Offer = {
  slug: string;
  title: string;
};

type ScholarshipFormProps = {
  offers: Offer[];
};

type FormState = {
  parentName: string;
  parentEmail: string;
  parentWhatsapp: string;
  childAge: string;
  cityCountry: string;
  occupation: string;
  knowledgeLevel: string;
  previousStudy: string;
  currentInvolvement: string;
  whatDrawsYou: string;
  howItBenefits: string;
  mostInterestingTopic: string;
  whyThisTopic: string;
  canAttendRegularly: string;
  attendedOrientation: boolean;
  contributionPreference: "" | "FULL_SCHOLARSHIP" | "PARTIAL_CONTRIBUTION";
  monthlyContribution: "" | "2000" | "5000";
  manualSenderName: string;
  manualSenderNumber: string;
  manualReferenceKey: string;
  manualNotes: string;
  reasonForSupport: string;
  howHeard: string;
  adabCommitment: boolean;
  genuineFinancialNeed: boolean;
  requestedPercent: 25 | 50 | 75 | 100;
  offerSlug: string;
};

const DISCOUNT_OPTIONS = [25, 50, 75, 100] as const;

const initialFormState = (defaultOfferSlug: string): FormState => ({
  parentName: "",
  parentEmail: "",
  parentWhatsapp: "",
  childAge: "",
  cityCountry: "",
  occupation: "",
  knowledgeLevel: "Beginner",
  previousStudy: "",
  currentInvolvement: "",
  whatDrawsYou: "",
  howItBenefits: "",
  mostInterestingTopic: "",
  whyThisTopic: "",
  canAttendRegularly: "",
  attendedOrientation: false,
  contributionPreference: "",
  monthlyContribution: "",
  manualSenderName: "",
  manualSenderNumber: "",
  manualReferenceKey: "",
  manualNotes: "",
  reasonForSupport: "",
  howHeard: "",
  adabCommitment: false,
  genuineFinancialNeed: false,
  requestedPercent: 50,
  offerSlug: defaultOfferSlug,
});

export function ScholarshipForm({ offers }: ScholarshipFormProps) {
  const defaultOfferSlug = offers[0]?.slug ?? "";
  const [form, setForm] = useState<FormState>(initialFormState(defaultOfferSlug));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedOffer = useMemo(
    () => offers.find((offer) => offer.slug === form.offerSlug) ?? offers[0],
    [form.offerSlug, offers],
  );

  const isPartialContribution = form.contributionPreference === "PARTIAL_CONTRIBUTION";

  function copyValue(value: string) {
    void navigator.clipboard.writeText(value);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setError(null);

    if (!form.contributionPreference) {
      setError("Please tell us whether you need a complete scholarship or can contribute a smaller monthly amount.");
      setIsSubmitting(false);
      return;
    }

    if (isPartialContribution && !form.monthlyContribution) {
      setError("Please select how much you can contribute monthly.");
      setIsSubmitting(false);
      return;
    }

    if (isPartialContribution && !form.manualSenderName.trim()) {
      setError("Please provide the sender name used for the transfer.");
      setIsSubmitting(false);
      return;
    }

    if (isPartialContribution && !form.manualSenderNumber.trim()) {
      setError("Please provide the sender number used for the transfer.");
      setIsSubmitting(false);
      return;
    }

    if (isPartialContribution && !form.manualReferenceKey.trim()) {
      setError("Please provide the transfer reference ID before submitting.");
      setIsSubmitting(false);
      return;
    }

    if (!form.adabCommitment) {
      setError("Please confirm your commitment to adab and respectful conduct.");
      setIsSubmitting(false);
      return;
    }

    if (!form.genuineFinancialNeed) {
      setError("Please confirm that this request is based on genuine financial need.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/scholarships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: form.parentName,
          parentEmail: form.parentEmail,
          parentWhatsapp: form.parentWhatsapp,
          childAge: Number(form.childAge),
          childCountry: form.cityCountry,
          occupation: form.occupation,
          knowledgeLevel: form.knowledgeLevel,
          previousStudy: form.previousStudy,
          currentInvolvement: form.currentInvolvement,
          whatDrawsYou: form.whatDrawsYou,
          howItBenefits: form.howItBenefits,
          mostInterestingTopic: form.mostInterestingTopic,
          whyThisTopic: form.whyThisTopic,
          canAttendRegularly: form.canAttendRegularly,
          attendedOrientation: form.attendedOrientation,
          contributionPreference: form.contributionPreference,
          monthlyContribution: form.monthlyContribution,
          manualSenderName: form.manualSenderName,
          manualSenderNumber: form.manualSenderNumber,
          manualReferenceKey: form.manualReferenceKey,
          manualNotes: form.manualNotes,
          reasonForSupport: form.reasonForSupport,
          howHeard: form.howHeard,
          adabCommitment: form.adabCommitment,
          genuineFinancialNeed: form.genuineFinancialNeed,
          requestedPercent: form.requestedPercent,
          offerSlug: form.offerSlug,
        }),
      });

      const payload = (await response.json()) as { applicationId?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit fee waiver application.");
      }

      setMessage("Your fee waiver application has been submitted. Our team will review it and contact you by email.");
      setForm(initialFormState(defaultOfferSlug));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit fee waiver application.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-[2rem] border border-[#e7d9c7] bg-[linear-gradient(180deg,#fffdf9_0%,#fff7ef_100%)] p-5 shadow-[0_24px_60px_rgba(34,48,74,0.08)] md:p-8"
    >
      <div className="grid gap-4 rounded-[1.5rem] bg-[linear-gradient(135deg,#f39f5f_0%,#efbf7a_100%)] p-4 text-white md:grid-cols-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">Programme</p>
          <p className="mt-2 text-sm font-semibold">{selectedOffer?.title ?? "Gen-Mumins"}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">Support Type</p>
          <p className="mt-2 text-sm font-semibold">Fee waiver review</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">Requested Support</p>
          <p className="mt-2 text-sm font-semibold">{form.requestedPercent}% tuition support</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">Purpose</p>
          <p className="mt-2 text-sm font-semibold">Scholarship pathway for Gen-Mumins families</p>
        </div>
      </div>

      <SectionTitle title="Personal Information" />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Parent / Guardian name*" required>
          <input value={form.parentName} onChange={(event) => setForm((prev) => ({ ...prev, parentName: event.target.value }))} className={inputClassName} autoComplete="name" required />
        </Field>
        <Field label="Email address*" required>
          <input type="email" value={form.parentEmail} onChange={(event) => setForm((prev) => ({ ...prev, parentEmail: event.target.value }))} className={inputClassName} autoComplete="email" required />
        </Field>
        <Field label="WhatsApp number*" required>
          <input value={form.parentWhatsapp} onChange={(event) => setForm((prev) => ({ ...prev, parentWhatsapp: event.target.value }))} className={inputClassName} autoComplete="tel" placeholder="+923001234567" required />
        </Field>
        <Field label="Child age*" required>
          <input type="number" min="4" max="18" value={form.childAge} onChange={(event) => setForm((prev) => ({ ...prev, childAge: event.target.value }))} className={inputClassName} required />
        </Field>
        <Field label="City & country*" required>
          <input value={form.cityCountry} onChange={(event) => setForm((prev) => ({ ...prev, cityCountry: event.target.value }))} className={inputClassName} placeholder="Lahore, Pakistan" required />
        </Field>
        <Field label="Occupation*" required>
          <input value={form.occupation} onChange={(event) => setForm((prev) => ({ ...prev, occupation: event.target.value }))} className={inputClassName} required />
        </Field>
      </div>

      <Divider />

      <SectionTitle title="Background & Programme Fit" />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Programme of interest*" required>
          <select value={form.offerSlug} onChange={(event) => setForm((prev) => ({ ...prev, offerSlug: event.target.value }))} className={inputClassName} required>
            {offers.map((offer) => (
              <option key={offer.slug} value={offer.slug}>
                {offer.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Requested fee waiver*" required>
          <select value={form.requestedPercent} onChange={(event) => setForm((prev) => ({ ...prev, requestedPercent: Number(event.target.value) as 25 | 50 | 75 | 100 }))} className={inputClassName} required>
            {DISCOUNT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}% support
              </option>
            ))}
          </select>
        </Field>
        <Field label="Current Islamic / Arabic level*" required>
          <select value={form.knowledgeLevel} onChange={(event) => setForm((prev) => ({ ...prev, knowledgeLevel: event.target.value }))} className={inputClassName} required>
            <option>Beginner</option>
            <option>Intermediate</option>
            <option>Advanced</option>
          </select>
        </Field>
        <Field label="Previous study in Arabic / Qur'an / Islamic studies">
          <input value={form.previousStudy} onChange={(event) => setForm((prev) => ({ ...prev, previousStudy: event.target.value }))} className={inputClassName} />
        </Field>
      </div>

      <Field label="Current involvement in Islamic learning or family practice">
        <input value={form.currentInvolvement} onChange={(event) => setForm((prev) => ({ ...prev, currentInvolvement: event.target.value }))} className={inputClassName} />
      </Field>

      <Divider />

      <SectionTitle title="Why Gen-Mumins" />
      <Field label="What draws you to Gen-Mumins?*" required>
        <textarea value={form.whatDrawsYou} onChange={(event) => setForm((prev) => ({ ...prev, whatDrawsYou: event.target.value }))} className={textareaClassName} rows={3} required />
      </Field>
      <Field label="How do you hope this programme will benefit your child and family?*" required>
        <textarea value={form.howItBenefits} onChange={(event) => setForm((prev) => ({ ...prev, howItBenefits: event.target.value }))} className={textareaClassName} rows={4} required />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Which Gen-Mumins topic or programme area feels most important to you?*" required>
          <input value={form.mostInterestingTopic} onChange={(event) => setForm((prev) => ({ ...prev, mostInterestingTopic: event.target.value }))} className={inputClassName} required />
        </Field>
        <Field label="Why is that especially important for your child?*" required>
          <input value={form.whyThisTopic} onChange={(event) => setForm((prev) => ({ ...prev, whyThisTopic: event.target.value }))} className={inputClassName} required />
        </Field>
      </div>

      <Divider />

      <SectionTitle title="Commitment & Financial Need" />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Can your child attend regularly?*" required>
          <input value={form.canAttendRegularly} onChange={(event) => setForm((prev) => ({ ...prev, canAttendRegularly: event.target.value }))} className={inputClassName} placeholder="Yes, in sha Allah" required />
        </Field>
        <label className="flex items-center justify-between gap-4 rounded-[1.2rem] border border-[#e6d7c6] bg-white px-4 py-3 text-sm font-medium text-[#314258]">
          <span>Attended introductory session?</span>
          <input type="checkbox" checked={form.attendedOrientation} onChange={(event) => setForm((prev) => ({ ...prev, attendedOrientation: event.target.checked }))} className="h-4 w-4 accent-[#f39f5f]" />
        </label>
      </div>

      <div className="space-y-4 rounded-[1.5rem] border border-[#ead8c4] bg-white px-4 py-4">
        <div>
          <p className="text-sm font-semibold text-[#22304a]">Can you contribute part of the fees monthly?*</p>
          <p className="mt-1 text-sm leading-6 text-[#5f6b7a]">
            This helps us understand whether you need a full scholarship or can still contribute a smaller amount each month.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ChoiceCard
            active={form.contributionPreference === "FULL_SCHOLARSHIP"}
            onSelect={() =>
              setForm((prev) => ({
                ...prev,
                contributionPreference: "FULL_SCHOLARSHIP",
                monthlyContribution: "",
                manualSenderName: "",
                manualSenderNumber: "",
                manualReferenceKey: "",
                manualNotes: "",
              }))
            }
            title="No, I need a full scholarship"
            description="Choose this if you need the full fee waived for now."
          />
          <ChoiceCard
            active={form.contributionPreference === "PARTIAL_CONTRIBUTION"}
            onSelect={() =>
              setForm((prev) => ({
                ...prev,
                contributionPreference: "PARTIAL_CONTRIBUTION",
              }))
            }
            title="I can contribute some amount monthly"
            description="Choose this if you can still support a smaller monthly payment."
          />
        </div>

        {isPartialContribution ? (
          <div className="space-y-4 rounded-[1.3rem] border border-[#f0d4b2] bg-[#fff9f2] p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <MiniChoice
                active={form.monthlyContribution === "5000"}
                onSelect={() => setForm((prev) => ({ ...prev, monthlyContribution: "5000" }))}
                label="5000 PKR monthly"
              />
              <MiniChoice
                active={form.monthlyContribution === "2000"}
                onSelect={() => setForm((prev) => ({ ...prev, monthlyContribution: "2000" }))}
                label="2000 PKR monthly"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ManualCard
                title="[BANK] Meezan Bank"
                rows={[
                  { label: "Account Title", value: "AREEJ FATIMA" },
                  { label: "Account Number", value: "98900114432111" },
                  { label: "IBAN", value: "PK96MEZN0098900114432111" },
                ]}
                onCopy={copyValue}
              />
              <ManualCard
                title="[JAZZ] JazzCash"
                rows={[
                  { label: "Name", value: "Areej Fatima" },
                  { label: "Number", value: "03244517741" },
                ]}
                onCopy={copyValue}
              />
            </div>

            <div className="rounded-[1rem] border border-[#f0d4b2] bg-white px-4 py-3 text-sm leading-6 text-[#6a5946]">
              1. Send your partial contribution by Meezan Bank or JazzCash.
              <br />
              2. Keep your sender details ready.
              <br />
              3. Fill sender name, sender number, and transfer reference clearly below.
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Sender name*" required>
                <input value={form.manualSenderName} onChange={(event) => setForm((prev) => ({ ...prev, manualSenderName: event.target.value }))} className={inputClassName} required={isPartialContribution} />
              </Field>
              <Field label="Sender number*" required>
                <input value={form.manualSenderNumber} onChange={(event) => setForm((prev) => ({ ...prev, manualSenderNumber: event.target.value }))} className={inputClassName} required={isPartialContribution} />
              </Field>
            </div>

            <Field label="Transfer reference ID*" required>
              <input value={form.manualReferenceKey} onChange={(event) => setForm((prev) => ({ ...prev, manualReferenceKey: event.target.value }))} className={inputClassName} required={isPartialContribution} />
            </Field>

            <Field label="Notes (optional)">
              <textarea value={form.manualNotes} onChange={(event) => setForm((prev) => ({ ...prev, manualNotes: event.target.value }))} className={textareaClassName} rows={2} />
            </Field>
          </div>
        ) : null}
      </div>

      <Field label="Why are you requesting fee waiver support?*" required>
        <textarea value={form.reasonForSupport} onChange={(event) => setForm((prev) => ({ ...prev, reasonForSupport: event.target.value }))} className={textareaClassName} rows={4} required />
      </Field>
      <Field label="How did you hear about Gen-Mumins?">
        <input value={form.howHeard} onChange={(event) => setForm((prev) => ({ ...prev, howHeard: event.target.value }))} className={inputClassName} />
      </Field>

      <Divider />

      <SectionTitle title="Agreements" />
      <div className="grid gap-3 md:grid-cols-2">
        <Agreement
          checked={form.adabCommitment}
          onChange={(checked) => setForm((prev) => ({ ...prev, adabCommitment: checked }))}
          label="I commit to adab, respectful conduct, and sincere participation in the Gen-Mumins programme."
        />
        <Agreement
          checked={form.genuineFinancialNeed}
          onChange={(checked) => setForm((prev) => ({ ...prev, genuineFinancialNeed: checked }))}
          label="I confirm that this fee waiver request is based on genuine financial need."
        />
      </div>

      {message ? <div className="rounded-[1rem] bg-[#effaf3] px-4 py-3 text-sm text-[#2f6b4b]">{message}</div> : null}
      {error ? <div className="rounded-[1rem] bg-[#fff4f4] px-4 py-3 text-sm text-[#a23c3c]">{error}</div> : null}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm leading-6 text-[#5f6b7a]">
          Your submission remains confidential and goes straight to manual admin review.
        </p>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-w-56 items-center justify-center rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2740] disabled:opacity-60"
        >
          {isSubmitting ? "Submitting..." : "Submit Fee Waiver Application"}
        </button>
      </div>
    </form>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c27a2c]">
      {title}
    </p>
  );
}

function Divider() {
  return <div className="h-px bg-[#eadfd1]" />;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#314258]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ChoiceCard({
  active,
  onSelect,
  title,
  description,
}: {
  active: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-[1.2rem] border px-4 py-4 text-left transition ${
        active
          ? "border-[#f39f5f] bg-[#fff5eb] shadow-[0_12px_24px_rgba(243,159,95,0.14)]"
          : "border-[#ead8c4] bg-white hover:border-[#f0c79a]"
      }`}
    >
      <p className="text-sm font-semibold text-[#22304a]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[#5f6b7a]">{description}</p>
    </button>
  );
}

function MiniChoice({
  active,
  onSelect,
  label,
}: {
  active: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`rounded-[1rem] border px-4 py-3 text-sm font-semibold transition ${
        active ? "border-[#22304a] bg-[#22304a] text-white" : "border-[#ead8c4] bg-white text-[#22304a]"
      }`}
    >
      {label}
    </button>
  );
}

function ManualCard({
  title,
  rows,
  onCopy,
}: {
  title: string;
  rows: { label: string; value: string }[];
  onCopy: (value: string) => void;
}) {
  return (
    <div className="rounded-[1.2rem] border border-[#ead8c4] bg-white p-4">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#c27a2c]">{title}</p>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <div key={`${row.label}-${row.value}`} className="flex items-start justify-between gap-3">
            <span className="text-sm leading-6 text-[#314258]">
              {row.label}: {row.value}
            </span>
            <button
              type="button"
              onClick={() => onCopy(row.value)}
              className="shrink-0 rounded-full border border-[#e8d4bc] px-3 py-1 text-xs font-semibold text-[#22304a] transition hover:bg-[#fff6ec]"
            >
              Copy
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Agreement({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex gap-3 rounded-[1.2rem] border border-[#ead8c4] bg-white px-4 py-4 text-sm leading-6 text-[#314258]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#f39f5f]" />
      <span>{label}</span>
    </label>
  );
}

const inputClassName =
  "w-full rounded-[1rem] border border-[#d9deea] bg-white px-4 py-3 text-sm text-[#22304a] outline-none transition focus:border-[#f39f5f] focus:ring-2 focus:ring-[#f39f5f]/20";

const textareaClassName =
  "min-h-28 w-full rounded-[1rem] border border-[#d9deea] bg-white px-4 py-3 text-sm text-[#22304a] outline-none transition focus:border-[#f39f5f] focus:ring-2 focus:ring-[#f39f5f]/20";
