"use client";

import { useState } from "react";
import { toPng } from "html-to-image";
import { Download, ImageDown, LoaderCircle, Printer } from "lucide-react";

type PreparingAction = "png" | "pdf" | "print" | null;
type CertificateImage = { dataUrl: string; width: number; height: number };

function safeFilename(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "gen-mumin-certificate";
}

async function renderCertificatePng(): Promise<CertificateImage> {
  const source = document.querySelector<HTMLElement>("[data-certificate-artwork]");
  if (!source) throw new Error("Certificate artwork was not found.");

  await Promise.all(Array.from(source.querySelectorAll("img")).map((image) => image.decode().catch(() => undefined)));
  const bounds = source.getBoundingClientRect();
  const pixelRatio = Math.max(2, Math.min(3, 2400 / bounds.width));
  const dataUrl = await toPng(source, {
    cacheBust: true,
    backgroundColor: "#fffaf0",
    pixelRatio,
    width: bounds.width,
    height: bounds.height,
    preferredFontFormat: "woff2",
    fetchRequestInit: { credentials: "same-origin" },
    style: { margin: "0", transform: "none", rotate: "none" },
  });
  return { dataUrl, width: bounds.width, height: bounds.height };
}

function clickDownload(href: string, filename: string) {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function createCertificatePdf(image: CertificateImage, autoPrint = false) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxWidth = pageWidth - 20;
  const maxHeight = pageHeight - 20;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
  pdf.addImage(image.dataUrl, "PNG", (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, "FAST", 0);
  if (autoPrint) pdf.autoPrint({ variant: "non-conform" });
  return pdf;
}

export function CertificateActions({ filename = "Gen-Mumin certificate" }: { filename?: string }) {
  const [preparing, setPreparing] = useState<PreparingAction>(null);
  const [error, setError] = useState("");

  async function run(action: Exclude<PreparingAction, null>) {
    if (preparing) return;
    const printWindow = action === "print" ? window.open("", "_blank") : null;
    setPreparing(action);
    setError("");
    try {
      const image = await renderCertificatePng();
      const name = safeFilename(filename);
      if (action === "png") {
        clickDownload(image.dataUrl, `${name}.png`);
      } else {
        const pdf = await createCertificatePdf(image, action === "print");
        if (action === "pdf") {
          pdf.save(`${name}.pdf`);
        } else {
          const url = URL.createObjectURL(pdf.output("blob"));
          if (printWindow) printWindow.location.href = url;
          else window.location.href = url;
          setTimeout(() => URL.revokeObjectURL(url), 120000);
        }
      }
    } catch (caught) {
      printWindow?.close();
      setError(caught instanceof Error ? caught.message : "Could not prepare the certificate. Please try again.");
    } finally {
      setPreparing(null);
    }
  }

  return <div className="mt-8 print:hidden"><div className="flex flex-wrap justify-center gap-3">
    <button type="button" onClick={() => run("png")} disabled={Boolean(preparing)} className="inline-flex items-center gap-2 rounded-full bg-[#c27a2c] px-6 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-65">{preparing==="png"?<LoaderCircle className="h-4 w-4 animate-spin"/>:<ImageDown className="h-4 w-4"/>}{preparing==="png"?"Preparing PNG...":"Download PNG"}</button>
    <button type="button" onClick={() => run("pdf")} disabled={Boolean(preparing)} className="inline-flex items-center gap-2 rounded-full bg-[#172842] px-6 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-65">{preparing==="pdf"?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Download className="h-4 w-4"/>}{preparing==="pdf"?"Preparing PDF...":"Download PDF"}</button>
    <button type="button" onClick={() => run("print")} disabled={Boolean(preparing)} className="inline-flex items-center gap-2 rounded-full border border-[#d8a657] bg-white px-6 py-3 text-sm font-semibold text-[#172842] disabled:cursor-wait disabled:opacity-65">{preparing==="print"?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Printer className="h-4 w-4"/>}{preparing==="print"?"Preparing print...":"Print certificate"}</button>
  </div>{error?<p role="alert" className="mt-3 text-center text-sm font-semibold text-[#b24646]">{error}</p>:null}</div>;
}