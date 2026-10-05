import { renderGenMuminsEmailTemplate } from "@/lib/email/templates";
import { minutesLabel, monthLabel, pounds, type PayrollSnapshot } from "./calculation";

export function payrollEmailContent(snapshot: PayrollSnapshot, appUrl: string) {
 const month = monthLabel(snapshot.month), totals = snapshot.totals;
 const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(snapshot.paidOn + "T00:00:00Z"));
 const amount = pounds(totals.totalPence) + (snapshot.showPkr && totals.pkr !== null ? " (PKR " + totals.pkr.toLocaleString("en-GB") + " equivalent)" : "");
 const sections = [
  { label: "Final amount paid", value: amount },
  { label: "Payroll month / payment date", value: month + " / " + date },
  { label: "Sessions taken", value: String(totals.sessions) },
  { label: "Actual teaching time", value: minutesLabel(totals.actualMinutes) },
  { label: "Paid hours", value: String(totals.paidHours) + " hours" },
  ...snapshot.lines.map((line, index) => ({ label: line.label, value: line.sessions + " sessions | Actual: " + minutesLabel(line.actualMinutes) + "\n" + line.paidHours + " paid hours x GBP " + line.hourlyRate + "/hour = " + pounds(totals.linePence[index]) })),
 ];
 if (totals.adjustmentPence) sections.push({ label: "Payment adjustment", value: pounds(totals.adjustmentPence) + " - " + snapshot.adjustmentReason });
 if (snapshot.paymentReference) sections.push({ label: "Payment reference", value: snapshot.paymentReference });
 if (snapshot.showPkr) sections.push({ label: "Currency conversion", value: "GBP 1 = PKR " + snapshot.fxRate + " (" + snapshot.fxDate + "). PKR is shown as an equivalent." });
 if (snapshot.note) sections.push({ label: "Note from finance", value: snapshot.note });
 return {
  subject: "TGA | Your Gen-Mumin payroll slip - " + month,
  html: renderGenMuminsEmailTemplate({ heading: "Your " + month + " payroll slip", preview: month + " payroll: " + amount + " paid. View your hours and payment summary.", intro: "Assalamu alaikum " + snapshot.teacherName + ", your paid Gen-Mumin payroll slip has been published by TGA Finance. Here is a summary of the recorded payment.", sections,
   callToAction: { label: "View my payroll slip", href: new URL("/teacher/payroll?month=" + encodeURIComponent(snapshot.month), appUrl).toString() },
   closing: "Paid hours and actual teaching time are shown separately for clarity. Sign in to view your full slip, hours log and any payment evidence. For a correction, please contact TGA Finance. JazakAllahu khairan for your teaching and dedication. - TGA Finance / Gen-Mumin" }),
 };
}
