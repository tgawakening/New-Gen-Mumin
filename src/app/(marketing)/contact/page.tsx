export default function ContactPage() {
  return (
    <div className="bg-[#FDF6EF] py-16">
      <div className="section-container">
        <h1 className="text-4xl font-bold text-[#334155] mb-6">Contact Us</h1>
        <p className="text-lg text-[#64748b] max-w-3xl mb-8">
          Get in touch with the Gen-Mumins team. We&apos;re here to help with
          enrollment and any questions.
        </p>
        <div className="space-y-4">
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
        </div>
      </div>
    </div>
  );
}
