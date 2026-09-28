import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { canAccessAdminFinance } from "@/lib/admin/access";
export const dynamic = "force-dynamic";
export default async function CharityPaymentsPage() {
  const session = await getCurrentSession();
  if (!session || session.user.role !== "ADMIN" || !(await canAccessAdminFinance(session.user.id))) redirect("/admin");
  const orders = await db.order.findMany({
    where: { metadata: { path: "$.tgaCharity.category", equals: "TGA_CHARITY" } },
    include: { parent: { include: { user: true } }, items: { include: { subscription: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const receipts = await db.charityPayment.findMany({ where: { orderId: { in: orders.map(o => o.id) } }, orderBy: { createdAt: "desc" } });
  return <div className="section-container space-y-6 py-8">
    <Link href="/admin/orders" className="underline">Back to Gen-M payments</Link>
    <h1 className="text-3xl font-semibold">TGA charity payments</h1>
    <p>Charity contributions are separate from Gen-M course fees. Amounts below are recorded receipts; subscription status reflects the latest saved gateway information.</p>
    {orders.length === 0 && <p>No charity contributions registered yet.</p>}
    {orders.map(order => <section key={order.id} className="space-y-3 rounded-2xl border bg-white p-5">
      <h2 className="text-xl font-semibold">{order.parent.user.firstName} {order.parent.user.lastName}</h2>
      <p>{order.orderNumber} - {order.currency} {order.totalAmount} monthly charity commitment</p>
      <p>Subscription: {order.items.map(i => i.subscription?.status).filter(Boolean).join(", ") || "Not linked"}</p>
      <p>Course enrolment discontinued. Recurring collection remains with the existing payment provider.</p>
      <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Reference</th></tr></thead>
        <tbody>{receipts.filter(r => r.orderId === order.id).map(r => <tr key={r.id} className="border-t"><td className="py-3">{(r.paidAt ?? r.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Karachi" })}</td><td>{r.currency} {r.amount.toFixed(2)}</td><td>{r.status}</td><td>{r.sourceKey}</td></tr>)}</tbody>
      </table></div>
      {!receipts.some(r => r.orderId === order.id) && <p>No charity receipts recorded yet. Earlier course payments remain in Gen-M unless reclassified.</p>}
    </section>)}
  </div>;
}
