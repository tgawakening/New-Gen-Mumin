export const dynamic = "force-dynamic";

import { db } from "@/lib/db";

function statusClass(status: string) {
  if (status === "NEW") return "bg-[#fff7eb] text-[#8a6326]";
  if (status === "REPLIED") return "bg-[#effaf3] text-[#2f6b4b]";
  if (status === "ARCHIVED") return "bg-[#eef2f6] text-[#556274]";
  return "bg-[#f4f6f9] text-[#556274]";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function AdminMessagesPage() {
  const messages = await db.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="min-h-screen bg-[#f7f4eb] py-10">
      <div className="section-container space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Admin / Messages</p>
          <h1 className="mt-2 text-4xl font-semibold text-[#22304a]">Contact inbox</h1>
          <p className="mt-3 max-w-3xl text-base leading-8 text-[#5f6b7a]">
            Track incoming enquiries, current reply state, and the latest parent contact activity from the public site.
          </p>
        </div>

        <div className="grid gap-4">
          {messages.map((message) => (
            <div key={message.id} className="rounded-[1.6rem] border border-[#eadfce] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#22304a]">{message.name}</h2>
                  <p className="mt-1 text-sm text-[#6d7785]">{message.email}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(message.status)}`}>
                  {message.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#556274]">
                <span>{message.subject || "General enquiry"}</span>
                <span>{formatDate(message.createdAt)}</span>
              </div>

              <p className="mt-4 text-sm leading-7 text-[#556274]">{message.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
