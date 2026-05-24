import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { completedOrderWhere } from "@/lib/payments/completed-orders";
import { convertAmountToGbp } from "@/lib/registration/catalog";

export const dynamic = "force-dynamic";

const PAYMENT_GROUPS = [
  { key: "STRIPE", label: "Stripe" },
  { key: "PAYPAL", label: "PayPal" },
  { key: "BANK_TRANSFER", label: "Bank Transfer" },
] as const;

function formatPersonName(firstName?: string | null, lastName?: string | null) {
  return [firstName, lastName === "Parent" ? "" : lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function formatProgramTitle(title?: string | null, slug?: string | null) {
  if (slug === "full-bundle" || title === "Gen-Mumins Full Bundle") {
    return "Gen-Mumin Bundle";
  }

  return title || "Program pending";
}

function extractNoteValue(notes: string | null | undefined, label: string) {
  if (!notes) return null;
  const entry = notes
    .split(/\s*\|\s*|\r?\n/)
    .find((item) => item.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return entry ? entry.split(":").slice(1).join(":").trim() : null;
}

function escapeXml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatGbp(amount: number) {
  return `GBP ${amount.toFixed(2)}`;
}

function formatPayment(amount: number, currency: string) {
  const gbp = convertAmountToGbp(amount, currency);
  return `${currency} ${amount} (${formatGbp(gbp)})`;
}

function completedAt(order: {
  paidAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
  payments: Array<{ status: string; paidAt: Date | null; updatedAt: Date; createdAt: Date }>;
}) {
  const successfulPayment = order.payments.find((payment) => payment.status === "SUCCEEDED");
  return order.paidAt ?? successfulPayment?.paidAt ?? successfulPayment?.updatedAt ?? order.updatedAt ?? order.createdAt;
}

function paymentTotalLabel(totalGbp: number, count: number) {
  return `${formatGbp(totalGbp)} received from ${count} payment${count === 1 ? "" : "s"}`;
}

function monthWindow(monthParam: string | null) {
  const now = new Date();
  const normalized = monthParam && /^\d{4}-\d{2}$/.test(monthParam)
    ? monthParam
    : now.toISOString().slice(0, 7);
  const [year, month] = normalized.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return { key: normalized, start, end };
}

type SheetCell = {
  value: string | number;
  style?: number;
};

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  CRC_TABLE[index] = value >>> 0;
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function buildZip(files: Array<{ name: string; content: string | Buffer }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.name);
    const content = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, "utf8");
    const crc = crc32(content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.length, 20);
    centralHeader.writeUInt32LE(content.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function columnName(index: number) {
  let value = index;
  let name = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    value = Math.floor((value - 1) / 26);
  }
  return name;
}

function cellXml(cell: SheetCell | null, rowIndex: number, columnIndex: number) {
  const reference = `${columnName(columnIndex)}${rowIndex}`;
  if (!cell) return `<c r="${reference}" />`;
  const style = cell.style ? ` s="${cell.style}"` : "";
  return `<c r="${reference}" t="inlineStr"${style}><is><t>${escapeXml(cell.value)}</t></is></c>`;
}

function rowXml(cells: Array<SheetCell | null>, rowIndex: number) {
  return `<row r="${rowIndex}">${cells.map((cell, index) => cellXml(cell, rowIndex, index + 1)).join("")}</row>`;
}

function buildWorkbook(rows: Array<Array<SheetCell | null>>, merges: string[]) {
  const sheetRows = rows.map((row, index) => rowXml(row, index + 1)).join("");
  const mergeXml = merges.length
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}" />`).join("")}</mergeCells>`
    : "";
  const worksheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    ${Array.from({ length: 12 }, (_, index) => `<col min="${index + 1}" max="${index + 1}" width="${[24, 24, 18, 32][index % 4]}" customWidth="1" />`).join("")}
  </cols>
  <sheetData>${sheetRows}</sheetData>
  ${mergeXml}
</worksheet>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="4">
    <font><sz val="11" /><color rgb="FF22304A" /><name val="Arial" /></font>
    <font><b /><sz val="18" /><color rgb="FFFFFFFF" /><name val="Arial" /></font>
    <font><b /><sz val="11" /><color rgb="FF0F4D81" /><name val="Arial" /></font>
    <font><b /><sz val="11" /><color rgb="FF2F6B4B" /><name val="Arial" /></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none" /></fill>
    <fill><patternFill patternType="gray125" /></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF22304A" /><bgColor indexed="64" /></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEEF6FF" /><bgColor indexed="64" /></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF39F5F" /><bgColor indexed="64" /></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFF8F0" /><bgColor indexed="64" /></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFEFFAF3" /><bgColor indexed="64" /></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left /><right /><top /><bottom /><diagonal /></border>
    <border><left style="thin"><color rgb="FFCBD9E8" /></left><right style="thin"><color rgb="FFCBD9E8" /></right><top style="thin"><color rgb="FFCBD9E8" /></top><bottom style="thin"><color rgb="FFCBD9E8" /></bottom><diagonal /></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" /></cellStyleXfs>
  <cellXfs count="9">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top" /></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" /></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" /></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" /></xf>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" /></xf>
    <xf numFmtId="0" fontId="2" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" /></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" /></xf>
    <xf numFmtId="0" fontId="3" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment wrapText="1" vertical="top" /></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1" /></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0" /></cellStyles>
</styleSheet>`;

  return buildZip([
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" /><Default Extension="xml" ContentType="application/xml" /><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" /><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" /><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml" /></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml" /></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Payment Records" sheetId="1" r:id="rId1" /></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml" /><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml" /></Relationships>`,
    },
    { name: "xl/styles.xml", content: styles },
    { name: "xl/worksheets/sheet1.xml", content: worksheet },
  ]);
}

export async function GET(request: Request) {
  const session = await getCurrentSession();

  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const exportAll = searchParams.get("all") === "1";
  const window = monthWindow(searchParams.get("month"));
  const orders = await db.order.findMany({
    where: completedOrderWhere,
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    include: {
      parent: { include: { user: true } },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      registration: {
        include: {
          students: true,
          items: { include: { offer: true } },
        },
      },
    },
  });

  const allTimeTotalGbp = orders.reduce((sum, order) => {
    return sum + convertAmountToGbp(order.totalAmount, order.currency);
  }, 0);
  const scopedOrders = exportAll ? orders : orders.filter((order) => {
    const paidDate = completedAt(order);
    return paidDate >= window.start && paidDate < window.end;
  });
  const scopedTotalGbp = scopedOrders.reduce((sum, order) => {
    return sum + convertAmountToGbp(order.totalAmount, order.currency);
  }, 0);

  const grouped = PAYMENT_GROUPS.map((group) => ({
    ...group,
    rows: scopedOrders
      .filter((order) => order.gateway === group.key)
      .map((order) => {
        const registration = order.registration;
        const children = registration?.students ?? [];
        const programmes = Array.from(
          new Set(registration?.items.map((item) => formatProgramTitle(item.offer?.title, item.offer?.slug)) ?? []),
        );
        const parentName = registration
          ? formatPersonName(registration.parentFirstName, registration.parentLastName)
          : formatPersonName(order.parent.user.firstName, order.parent.user.lastName);
        const city = extractNoteValue(registration?.notes, "City");

        return {
          parent: parentName || "Parent pending",
          payment: formatPayment(order.totalAmount, order.currency),
          overview: `${children.length || 0} child${children.length === 1 ? "" : "ren"}${city ? `, ${city}` : ""}`,
          programmes: programmes.join(", ") || "Program pending",
        };
      }),
  }));

  const maxRows = Math.max(0, ...grouped.map((group) => group.rows.length));
  const groupTotals = grouped.map((group) => ({
    ...group,
    totalGbp: group.rows.reduce((sum, row) => {
      const match = row.payment.match(/\(GBP ([\d.]+)\)/);
      return sum + (match ? Number(match[1]) : 0);
    }, 0),
  }));
  const rows: Array<Array<SheetCell | null>> = [
    [{ value: exportAll ? "Gen-Mumin Full Payment Records" : "Gen-Mumin Monthly Payment Records", style: 1 }],
    [{ value: "Report Scope", style: 2 }, null, null, { value: exportAll ? "All completed payments" : window.key, style: 3 }],
    [{ value: "Total Payment Received Yet", style: 2 }, null, null, { value: formatGbp(allTimeTotalGbp), style: 3 }],
    [{ value: exportAll ? "Total In This Export" : "Total Received This Month", style: 2 }, null, null, { value: formatGbp(scopedTotalGbp), style: 3 }],
    [],
    groupTotals.flatMap((group) => [{ value: group.label, style: 4 }, null, null, null]),
    groupTotals.flatMap((group) => [{ value: paymentTotalLabel(group.totalGbp, group.rows.length), style: 5 }, null, null, null]),
    groupTotals.flatMap(() => [
      { value: "Parent Name", style: 6 },
      { value: "Paid Amount", style: 6 },
      { value: "Children", style: 6 },
      { value: "Programmes", style: 6 },
    ]),
  ];

  for (let index = 0; index < Math.max(maxRows, 1); index += 1) {
    rows.push(groupTotals.flatMap((group) => {
      const row = group.rows[index];
      if (!row) {
        return [
          { value: index === 0 && group.rows.length === 0 ? "No completed payments found" : "", style: 8 },
          null,
          null,
          null,
        ];
      }

      return [
        { value: row.parent },
        { value: row.payment, style: 7 },
        { value: row.overview },
        { value: row.programmes },
      ];
    }));
  }

  const workbook = buildWorkbook(rows, [
    "A1:L1",
    "A2:C2",
    "D2:L2",
    "A3:C3",
    "D3:L3",
    "A4:C4",
    "D4:L4",
    "A6:D6",
    "E6:H6",
    "I6:L6",
    "A7:D7",
    "E7:H7",
    "I7:L7",
  ]);
  const filename = exportAll
    ? `gen-mumin-all-completed-payments.xlsx`
    : `gen-mumin-monthly-payments-${window.key}.xlsx`;

  return new NextResponse(workbook, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
