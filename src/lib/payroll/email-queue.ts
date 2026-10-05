import "server-only";
import type { Prisma } from "@prisma/client";

export function payrollEmailKey(payslipId: string, version: number) { return "payroll:" + payslipId + ":" + version; }

/** Enqueue in the publication transaction. Namespaced states isolate this from billing workers. */
export async function queuePayrollEmail(tx: Pick<Prisma.TransactionClient, "billingEmailJob">, payslipId: string, version: number, toEmail: string) {
 return tx.billingEmailJob.upsert({ where: { key: payrollEmailKey(payslipId, version) }, update: {}, create: {
  key: payrollEmailKey(payslipId, version), kind: "TEACHER_PAYROLL", status: "PAYROLL_PENDING", recordId: payslipId, toEmail, payload: { version },
 } });
}
