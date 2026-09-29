import "server-only";
import { db } from "@/lib/db";
import { charityClassification } from "@/lib/payments/charity-policy";
import { allocateAmount } from "@/lib/payments/billing-policy";

export async function getBillingTargets(parentId?: string, orderId?: string) {
  const items = await db.orderItem.findMany({
    where: { ...(orderId ? { orderId } : {}), order: { ...(parentId ? { parentId } : {}), ...(orderId ? {} : { status: "SUCCEEDED" }) } },
    include: {
      order: { include: { parent: { include: { user: true } }, items: { include: { subscription: true } } } },
      offer: { include: { programs: true } },
      registrationItem: { include: { registrationStudent: { include: { studentProfile: { include: { user: true, enrollments: true } } } } } },
      enrollment: { include: { student: { include: { user: true, enrollments: true } }, program: true } },
    },
    orderBy: [{ order: { createdAt: "desc" } }, { id: "asc" }],
  });
  const seen = new Set<string>();
  const targets = [];
  for (const item of items) {
    if (charityClassification(item.order.metadata)) continue;
    const student = item.registrationItem?.registrationStudent.studentProfile ?? item.enrollment?.student;
    if (!student) continue;
    const programs = item.offer?.programs.map(p => p.programId) ?? (item.enrollment ? [item.enrollment.programId] : []);
    if (!orderId && (!programs.length || !programs.every(p => student.enrollments.some(e => e.programId === p && ["ACTIVE", "CONFIRMED", "COMPLETED"].includes(e.status))))) continue;
    const keys = programs.length ? programs.map(p => student.id + ":" + p) : [student.id + ":" + item.description];
    if (!orderId && keys.some(key => seen.has(key))) continue;
    keys.forEach(key => seen.add(key));
    const orderItems = item.order.items;
    const amounts = allocateAmount(item.order.totalAmount, orderItems.map(i => i.totalAmount));
    const amount = amounts[orderItems.findIndex(i => i.id === item.id)] ?? item.totalAmount;
    const subscription = orderItems.find(i => i.subscription?.providerSubscriptionId)?.subscription ?? null;
    targets.push({ item, student, programs, amount, subscription,
      childName: student.displayName || [student.user.firstName, student.user.lastName].filter(Boolean).join(" "),
      programmeTitle: item.offer?.slug === "full-bundle" ? "Gen-Mumin - Full Programme" : item.offer?.title ?? item.description,
    });
  }
  return targets;
}
