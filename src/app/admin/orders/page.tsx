export const dynamic = "force-dynamic";

import { db } from "@/lib/db";

function statusClass(status: string) {
  if (status === "SUCCEEDED") return "bg-[#effaf3] text-[#2f6b4b]";
  if (["PENDING", "UNDER_REVIEW", "REQUIRES_ACTION", "INITIATED"].includes(status)) return "bg-[#fff7eb] text-[#8a6326]";
  return "bg-[#eef2f6] text-[#556274]";
}

export default async function AdminOrdersPage() {
  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 24,
    include: {
      parent: {
        include: {
          user: true,
        },
      },
      payments: true,
    },
  });

  return (
    <div className="min-h-screen bg-[#f7f4eb] py-10">
      <div className="section-container space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#c27a2c]">Admin / Orders</p>
          <h1 className="mt-2 text-4xl font-semibold text-[#22304a]">Orders and payments</h1>
          <p className="mt-3 max-w-3xl text-base leading-8 text-[#5f6b7a]">Recent transactions, payment state, parent details, and gateway review information.</p>
        </div>

        <div className="grid gap-4">
          {orders.map((order) => (
            <div key={order.id} className="rounded-[1.6rem] border border-[#eadfce] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-[#22304a]">{order.orderNumber}</h2>
                  <p className="mt-1 text-sm text-[#6d7785]">{order.parent.user.firstName} {order.parent.user.lastName} · {order.parent.user.email}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(order.status)}`}>{order.status.replace(/_/g, " ")}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#556274]">
                <span>{order.gateway}</span>
                <span>{order.currency} {order.totalAmount}</span>
                <span>{order.payments.length} payment records</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
