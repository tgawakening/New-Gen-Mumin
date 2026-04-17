"use client";

import { useState } from "react";

type Offer = {
  slug: string;
  title: string;
  description: string | null;
  kind: "SINGLE" | "PAIR" | "BUNDLE";
  basePriceGbp: number;
  basePricePkr: number | null;
};

type Country = {
  code: string;
  name: string;
  currency: string;
};

type RegistrationFormProps = {
  offers: Offer[];
  countries: readonly Country[];
};

type StudentForm = {
  firstName: string;
  lastName: string;
  age: string;
  gender: string;
  notes: string;
  selectedOfferSlugs: string[];
};

const emptyStudent = (): StudentForm => ({
  firstName: "",
  lastName: "",
  age: "",
  gender: "",
  notes: "",
  selectedOfferSlugs: [],
});

export function RegistrationForm({ offers, countries }: RegistrationFormProps) {
  const [parentFirstName, setParentFirstName] = useState("");
  const [parentLastName, setParentLastName] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+44");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState(countries[0]?.code ?? "GB");
  const [notes, setNotes] = useState("");
  const [students, setStudents] = useState<StudentForm[]>([emptyStudent()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedCountry = countries.find((country) => country.code === selectedCountryCode) ?? countries[0];

  function updateStudent(index: number, patch: Partial<StudentForm>) {
    setStudents((current) => current.map((student, currentIndex) => (currentIndex === index ? { ...student, ...patch } : student)));
  }

  function toggleOffer(index: number, offerSlug: string) {
    setStudents((current) =>
      current.map((student, currentIndex) => {
        if (currentIndex !== index) {
          return student;
        }

        const selected = student.selectedOfferSlugs.includes(offerSlug)
          ? student.selectedOfferSlugs.filter((slug) => slug !== offerSlug)
          : [...student.selectedOfferSlugs, offerSlug];

        return {
          ...student,
          selectedOfferSlugs: selected,
        };
      }),
    );
  }

  function addStudent() {
    setStudents((current) => [...current, emptyStudent()]);
  }

  function removeStudent(index: number) {
    setStudents((current) => (current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index)));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/registration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parentFirstName,
          parentLastName,
          parentEmail,
          phoneCountryCode,
          phoneNumber,
          whatsappNumber,
          selectedCountryCode,
          selectedCountryName: selectedCountry?.name ?? "",
          notes,
          students: students.map((student) => ({
            ...student,
            age: Number(student.age),
          })),
        }),
      });

      const payload = (await response.json()) as { error?: string; registrationId?: string; totalAmount?: number; currency?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to create registration draft.");
      }

      setResult(`Draft ${payload.registrationId} created. Total due: ${payload.currency} ${payload.totalAmount}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit registration.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-10" onSubmit={handleSubmit}>
      <section className="grid gap-6 rounded-[32px] bg-white p-6 shadow-sm lg:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Parent first name</label>
          <input value={parentFirstName} onChange={(event) => setParentFirstName(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Parent last name</label>
          <input value={parentLastName} onChange={(event) => setParentLastName(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
          <input type="email" value={parentEmail} onChange={(event) => setParentEmail(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" required />
        </div>
        <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Code</label>
            <input value={phoneCountryCode} onChange={(event) => setPhoneCountryCode(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" required />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">Phone number</label>
            <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" required />
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">WhatsApp number</label>
          <input value={whatsappNumber} onChange={(event) => setWhatsappNumber(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">Country</label>
          <select value={selectedCountryCode} onChange={(event) => setSelectedCountryCode(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3">
            {countries.map((country) => (
              <option key={country.code} value={country.code}>
                {country.name} ({country.currency})
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-semibold text-slate-700">Notes</label>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3" />
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-500">Children</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-800">Build the enrollment</h2>
          </div>
          <button type="button" onClick={addStudent} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
            Add child
          </button>
        </div>

        {students.map((student, index) => (
          <div key={index} className="space-y-5 rounded-[32px] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-800">Child {index + 1}</h3>
              <button type="button" onClick={() => removeStudent(index)} className="text-sm font-semibold text-rose-500">
                Remove
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <input placeholder="First name" value={student.firstName} onChange={(event) => updateStudent(index, { firstName: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" required />
              <input placeholder="Last name" value={student.lastName} onChange={(event) => updateStudent(index, { lastName: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" required />
              <input placeholder="Age" type="number" min="4" max="18" value={student.age} onChange={(event) => updateStudent(index, { age: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" required />
              <input placeholder="Gender" value={student.gender} onChange={(event) => updateStudent(index, { gender: event.target.value })} className="rounded-2xl border border-slate-200 px-4 py-3" />
            </div>

            <textarea placeholder="Child notes or learning context" value={student.notes} onChange={(event) => updateStudent(index, { notes: event.target.value })} className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3" />

            <div className="grid gap-4 lg:grid-cols-2">
              {offers.map((offer) => {
                const selected = student.selectedOfferSlugs.includes(offer.slug);
                const price = selectedCountry?.currency === "PKR" ? offer.basePricePkr : offer.basePriceGbp;

                return (
                  <button
                    key={offer.slug}
                    type="button"
                    onClick={() => toggleOffer(index, offer.slug)}
                    className={`rounded-[28px] border p-5 text-left transition-colors ${selected ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-500">{offer.kind}</p>
                        <h4 className="mt-1 text-lg font-semibold text-slate-800">{offer.title}</h4>
                      </div>
                      <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                        {selectedCountry?.currency} {price}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{offer.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-[32px] bg-slate-900 p-6 text-white shadow-lg">
        <h2 className="text-2xl font-bold">Registration Draft</h2>
        <p className="mt-2 max-w-3xl text-slate-200">
          This first workflow creates a validated draft registration with parent details, multiple child entries, and offer selections.
          Payment processing, scholarship approval, and subscription creation will attach to this draft in the next step.
        </p>

        {error ? <p className="mt-4 rounded-2xl bg-rose-500/20 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
        {result ? <p className="mt-4 rounded-2xl bg-emerald-500/20 px-4 py-3 text-sm text-emerald-100">{result}</p> : null}

        <button type="submit" disabled={isSubmitting} className="mt-6 rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60">
          {isSubmitting ? "Creating draft..." : "Create registration draft"}
        </button>
      </section>
    </form>
  );
}
