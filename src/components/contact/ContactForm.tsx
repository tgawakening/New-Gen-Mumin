"use client";

import { useState } from "react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSuccess(null);
    setError(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to submit contact form.");

      setSuccess("Your message has been sent. We will get back to you soon.");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit contact form.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[28px] border border-[#eadfce] bg-white p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-[#38506a]">Full name</label>
          <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Your name" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-[#38506a]">Email address</label>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Your email" required />
        </div>
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-[#38506a]">Subject</label>
          <input value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="How can we help?" required />
        </div>
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-[#38506a]">Message</label>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-36 w-full rounded-2xl border border-[#d8c3ac] bg-white px-4 py-3 text-sm outline-none focus:border-[#f39f5f]" placeholder="Write your message here" required />
        </div>
      </div>
      {success ? <div className="mt-4 rounded-2xl bg-[#effaf3] px-4 py-3 text-sm text-[#2f6b4b]">{success}</div> : null}
      {error ? <div className="mt-4 rounded-2xl bg-[#fff4f4] px-4 py-3 text-sm text-[#a23c3c]">{error}</div> : null}
      <button type="submit" disabled={isSubmitting} className="mt-5 cursor-pointer rounded-full bg-[#22304a] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#182235] disabled:opacity-60">
        {isSubmitting ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
