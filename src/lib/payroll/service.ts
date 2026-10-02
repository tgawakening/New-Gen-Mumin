import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth/session";
import { canAccessAdminFinance } from "@/lib/admin/access";
import { calculatePayroll, validMonth, type PayrollInput, type PayrollSnapshot } from "./calculation";
import { payrollFolderId, uploadPayrollProof, verifyPayrollFolder } from "./drive";
export async function payrollAdmin() {
 const session = await getCurrentSession();
 if (!session || session.user.role !== "ADMIN" || !(await canAccessAdminFinance(session.user.id))) throw new Error("Finance administrator access required.");
 return session.user;
}
function dateValid(value: string) { return /^20\d{2}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value+"T00:00:00Z").getTime()) && new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value; }
export function validatePayroll(input: PayrollInput, publish: boolean) {
 if (typeof input.showPkr !== "boolean") throw new Error("Choose the local currency display.");
 for (const key of ["fxDate","paidOn","paymentReference","note","sourceNote","adjustmentReason"] as const) if (typeof input[key] !== "string" || input[key].length > (key === "note" ? 2000 : 500)) throw new Error("Invalid payslip details.");
 const totals = calculatePayroll(input);
 if (totals.adjustmentPence !== 0 && !input.adjustmentReason.trim()) throw new Error("Explain the payment adjustment.");
 if (input.showPkr && !dateValid(input.fxDate)) throw new Error("Set the date of the GBP to PKR conversion rate.");
 if (input.paidOn && !dateValid(input.paidOn)) throw new Error("Enter a valid payment date.");
 const today = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Karachi",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 if (publish && (!dateValid(input.paidOn) || input.paidOn > today)) throw new Error("Confirm the actual payment date before publishing.");
 if (publish && (!totals.totalPence || input.lines.some(l=>Number(l.paidHours)>0 && Number(l.hourlyRate)<=0))) throw new Error("Set the hourly rates and a positive final payment before publishing.");
 return totals;
}
export async function savePayroll(form: FormData) {
 const actor = await payrollAdmin();
 const teacherId = String(form.get("teacherId") || ""), month = String(form.get("month") || ""), mode = String(form.get("mode") || "");
 const version = Number(form.get("version"));
 if (!validMonth(month) || !["save","publish"].includes(mode) || !Number.isInteger(version) || version < 0) throw new Error("Invalid payroll selection.");
 if (mode === "publish" && form.get("paidConfirmed") !== "yes") throw new Error("Confirm that this payment has been made.");
 const serialized = String(form.get("payload") || "");
 if (serialized.length > 30000) throw new Error("Payslip details are too large.");
 const input = JSON.parse(serialized) as PayrollInput;
 const totals = validatePayroll(input, mode === "publish");
 const teacher = await db.teacherProfile.findUnique({where:{id:teacherId},include:{user:true,payrollSettings:true}});
 if (!teacher) throw new Error("Teacher not found.");
 const existing = await db.teacherPayslip.findUnique({where:{teacherId_month:{teacherId,month}}});
 if ((existing?.version ?? 0) !== version) throw new Error("This payslip changed in another window. Reload before saving.");
 const teacherName = (teacher.user.firstName+" "+teacher.user.lastName).trim();
 let proof = (existing?.draftData as unknown as PayrollSnapshot | undefined)?.proof ?? null;
 const file = form.get("proof");
 const folderValue = String(form.get("folder") || "").trim();
 const folder = folderValue ? payrollFolderId(folderValue) : null;
 if (folder && folder !== teacher.payrollSettings?.driveFolderId) await verifyPayrollFolder(folder);
 if (form.get("removeProof") === "yes") proof = null;
 if (file instanceof File && file.size) {
   if (!folder) throw new Error("Add this teacher's payroll Drive folder before uploading evidence.");
   proof = await uploadPayrollProof(file,folder,teacherName,month,input.paidOn);
 }
 // Explicit field selection prevents the browser supplying totals or private Drive file IDs.
 const snapshot: PayrollSnapshot = {teacherName,month,lines:input.lines.map(l=>({label:l.label.trim(),sessions:l.sessions,paidHours:l.paidHours,hourlyRate:l.hourlyRate,actualMinutes:l.actualMinutes})),showPkr:input.showPkr,fxRate:input.fxRate,fxDate:input.fxDate,paidOn:input.paidOn,paymentReference:input.paymentReference,note:input.note,sourceNote:input.sourceNote,adjustment:input.adjustment,adjustmentReason:input.adjustmentReason,totals,proof};
 const json = snapshot as unknown as Prisma.InputJsonValue;
 return db.$transaction(async tx=>{
   await tx.$queryRaw(Prisma.sql`SELECT id FROM TeacherProfile WHERE id = ${teacherId} FOR UPDATE`);
   const current = await tx.teacherPayslip.findUnique({where:{teacherId_month:{teacherId,month}}});
   if ((current?.version ?? 0)!==version) throw new Error("This payslip changed in another window. Reload before saving.");
   const nextVersion = version+1;
   const data = {draftData:json,version:nextVersion,updatedByUserId:actor.id,...(mode==="publish"?{publishedData:json,publishedAt:new Date()}: {})};
   const slip = current ? await tx.teacherPayslip.update({where:{id:current.id},data}) : await tx.teacherPayslip.create({data:{teacherId,month,...data}});
   await tx.teacherPayrollSettings.upsert({where:{teacherId},create:{teacherId,driveFolderId:folder,showPkr:input.showPkr},update:{driveFolderId:folder,showPkr:input.showPkr}});
   if(mode==="publish") await tx.teacherPayslipRevision.create({data:{payslipId:slip.id,version:nextVersion,snapshot:json,publishedByUserId:actor.id}});
   return {id:slip.id,version:nextVersion,snapshot,published:mode==="publish"};
 },{maxWait:10000,timeout:15000});
}
export async function publishedPayslips(userId:string, take=24) {
 try { return await db.teacherPayslip.findMany({where:{teacher:{userId,user:{status:"ACTIVE"}},publishedAt:{not:null}},orderBy:{month:"desc"},take}); }
 catch(error) { if ((error as {code?:string}).code === "P2021") return []; throw error; }
}
