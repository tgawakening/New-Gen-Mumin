import ExcelJS from "exceljs";
import type { getPaymentsReport } from "@/lib/payments/report";

type Report = Awaited<ReturnType<typeof getPaymentsReport>>;

export async function buildPaymentsReportWorkbook(report: Report) {
  const workbook = new ExcelJS.Workbook();
  const sheet = (name: string, headings: string[]) => {
    const page = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    page.columns = headings.map((heading, index) => ({ header: heading, key: `column${index}`, width: index === 0 ? 46 : 24 }));
    page.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    page.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22304A" } };
    return page;
  };
  const entries = (totals: Map<string, number>) => [...totals].sort(([a], [b]) => a.localeCompare(b));
  const byMethod = sheet("Received by method", ["Method", "Currency", "Amount"]);
  for (const [method, totals] of [...report.methods].sort(([a], [b]) => a.localeCompare(b))) {
    for (const [currency, amount] of entries(totals)) byMethod.addRow([method.replaceAll("_", " "), currency, amount]);
  }
  if (!report.methods.size) byMethod.addRow(["None recorded"]);
  byMethod.getColumn(3).numFmt = "0.00";

  const totalsSheet = sheet("Totals", ["Figure", "Currency", "Amount / date"]);
  for (const [label, totals] of [["Total received", report.received], ["Total upcoming / outstanding", report.upcoming]] as const) {
    if (!totals.size) totalsSheet.addRow([label, "", "None recorded"]);
    for (const [currency, amount] of entries(totals)) totalsSheet.addRow([label, currency, amount]);
  }
  const latest = report.latest ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Asia/Karachi" }).format(report.latest) : "No dated payment recorded";
  totalsSheet.addRow(["Latest recorded payment date (Asia/Karachi)", "", latest]);
  totalsSheet.getColumn(3).numFmt = "0.00";

  const upcoming = sheet("Upcoming and outstanding", ["Category", "Currency", "Amount"]);
  for (const [label, group] of [["Next cycle, active subscriptions", report.expected], ["Pending / under review", report.pending], ["Failed", report.failed]] as const) {
    if (!group.size) upcoming.addRow([label, "", "None recorded"]);
    for (const [currency, amount] of entries(group)) upcoming.addRow([label, currency, amount]);
  }
  upcoming.getColumn(3).numFmt = "0.00";
  return workbook.xlsx.writeBuffer();
}
