import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const mode = process.argv[2];
const { CHARITY_ORDER_NUMBER, CHARITY_PARENT_EMAIL, CHARITY_STUDENT_ID } = process.env;
if (!CHARITY_ORDER_NUMBER || !CHARITY_PARENT_EMAIL || !CHARITY_STUDENT_ID) throw new Error("Set the exact order, parent email and student identifiers.");
if (!["future-only", "include-original"].includes(mode)) throw new Error("Choose future-only or include-original explicitly.");
try {
  const result = await db.$transaction(async tx => {
    const order = await tx.order.findUnique({ where: { orderNumber: CHARITY_ORDER_NUMBER }, include: { registration: { include: { students: true } }, items: { include: { subscription: true } } } });
    if (!order || order.registration?.parentEmail.toLowerCase() !== CHARITY_PARENT_EMAIL.toLowerCase() || order.currency !== "GBP" || order.totalAmount !== 20 || order.items.length !== 1) throw new Error("Record identity or amount differs; stop for review.");
    const studentId = CHARITY_STUDENT_ID;
    if (!order.registration.students.some(s => s.studentProfileId === studentId)) throw new Error("Student mismatch.");
    const metadata = order.metadata && typeof order.metadata === "object" ? order.metadata : {};
    const existing = metadata.tgaCharity;
    if (existing && existing.includeOriginalPayment !== (mode === "include-original")) throw new Error("Already classified with a different history scope; review before changing.");
    if (existing) return { alreadyApplied: true, orderNumber: order.orderNumber };
    const enrollments = await tx.enrollment.findMany({ where: { studentId } });
    const teacherRosters = await tx.teacherStudentRoster.findMany({ where: { studentId } });
    const scheduleRosters = await tx.classScheduleRoster.findMany({ where: { studentId } });
    const effectiveAt = new Date().toISOString();
    await tx.order.update({ where: { id: order.id }, data: { metadata: { ...metadata, tgaCharity: {
      effectiveAt, includeOriginalPayment: mode === "include-original", category: "TGA_CHARITY",
      reason: "Client requested course withdrawal; continuing GBP 20 monthly as TGA charity.",
      source: "Explicit administrator request", studentId,
      previousEnrollments: JSON.parse(JSON.stringify(enrollments)),
      previousTeacherRosters: JSON.parse(JSON.stringify(teacherRosters)),
      previousScheduleRosters: JSON.parse(JSON.stringify(scheduleRosters)),
    } } } });
    await tx.enrollment.updateMany({ where: { studentId, status: { in: ["PENDING", "CONFIRMED", "ACTIVE"] } }, data: { status: "CANCELLED" } });
    await tx.teacherStudentRoster.deleteMany({ where: { studentId } });
    await tx.classScheduleRoster.deleteMany({ where: { studentId } });
    if (mode === "include-original") {
      if (order.status !== "SUCCEEDED" || !order.paidAt) throw new Error("Original receipt is not confirmed paid.");
      await tx.charityPayment.create({ data: { sourceKey: "original:" + order.id, orderId: order.id,
        providerSubscriptionId: order.items[0].subscription?.providerSubscriptionId,
        gateway: order.gateway, status: "SUCCEEDED", amount: order.totalAmount, currency: order.currency,
        paidAt: order.paidAt, metadata: { reclassifiedAt: effectiveAt, originalOrderNumber: order.orderNumber } } });
    }
    return { orderNumber: order.orderNumber, currency: order.currency, amount: order.totalAmount, scope: mode, removedTeacherRosters: teacherRosters.length, removedScheduleRosters: scheduleRosters.length, recurringSubscriptionStatus: order.items[0].subscription?.status };
  }, { timeout: 30000 });
  console.log(JSON.stringify(result));
} finally { await db.$disconnect(); }
