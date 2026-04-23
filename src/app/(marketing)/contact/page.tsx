import { ContactForm } from "@/components/contact/ContactForm";

export default function ContactPage() {
  return (
    <div className="bg-[#FDF6EF] py-16">
      <div className="section-container grid gap-8 lg:grid-cols-[0.85fr_minmax(0,1fr)]">
        <div>
          <h1 className="mb-6 text-4xl font-bold text-[#334155]">Contact Us</h1>
          <p className="mb-8 max-w-3xl text-lg text-[#64748b]">
            Get in touch with the Gen-Mumins team. We&apos;re here to help with
            enrollment, schedules, and any questions families may have.
          </p>
          <div className="space-y-4 rounded-[28px] border border-[#eadfce] bg-white p-6 shadow-sm">
            <p>
              <strong>Email:</strong>{" "}
              <a
                href="mailto:info@globalawakening.co.uk"
                className="text-orange-500 hover:underline"
              >
                info@globalawakening.co.uk
              </a>
            </p>
            <p>
              <strong>Phone:</strong>{" "}
              <a
                href="tel:+447886398150"
                className="text-orange-500 hover:underline"
              >
                +447886398150
              </a>
            </p>
            <p className="text-sm leading-7 text-[#64748b]">
              When you submit the form, you will receive an acknowledgement email and
              the Gen-Mumins admin team will be notified as well.
            </p>
          </div>
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
