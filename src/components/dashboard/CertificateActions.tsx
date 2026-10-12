"use client";

import { useState } from "react";
import { toPng } from "html-to-image";
import { Download, ImageDown, LoaderCircle, Printer, ZoomIn, ZoomOut } from "lucide-react";

type PreparingAction = "png" | "pdf" | "print" | null;
type CertificateImage = { dataUrl: string; width: number; height: number };

function safeFilename(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "gen-mumin-certificate";
}

async function renderCertificatePng(): Promise<CertificateImage> {
  const source = document.querySelector<HTMLElement>("[data-certificate-artwork]");
  if (!source) throw new Error("Certificate artwork was not found.");

  await document.fonts.ready;
  // Render a full-size copy so mobile downloads match desktop quality and layout.
  const copy = source.cloneNode(true) as HTMLElement;
  copy.removeAttribute("data-certificate-artwork");
  Object.assign(copy.style, { width: "1120px", minWidth: "1120px", maxWidth: "1120px", margin: "0", boxShadow: "none" });
  const host = document.createElement("div");
  Object.assign(host.style, { position: "fixed", left: "-20000px", top: "0", width: "1120px", pointerEvents: "none" });
  host.setAttribute("aria-hidden", "true");
  host.appendChild(copy);
  document.body.appendChild(host);
  try {
    await Promise.all(Array.from(copy.querySelectorAll("img")).map(async image => {
      image.loading = "eager";
      await image.decode();
    }));
    const bounds = copy.getBoundingClientRect();
    const dataUrl = await toPng(copy, {
      cacheBust: true, backgroundColor: "#fffcf5", pixelRatio: 2,
      width: bounds.width, height: bounds.height, preferredFontFormat: "woff2",
      fetchRequestInit: { credentials: "same-origin" },
      style: { margin: "0", transform: "none", rotate: "none" },
    });
    return { dataUrl, width: bounds.width, height: bounds.height };
  } finally {
    host.remove();
  }
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
  const [expanded, setExpanded] = useState(false);
  function togglePreview() {
    const source = document.querySelector<HTMLElement>("[data-certificate-artwork]");
    if (!source) return;
    source.style.width = expanded ? "" : "1120px";
    source.style.minWidth = expanded ? "" : "1120px";
    setExpanded(!expanded);
  }

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
    <button type="button" onClick={togglePreview} aria-pressed={expanded} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-[#172842]">{expanded ? <ZoomOut className="h-4 w-4"/> : <ZoomIn className="h-4 w-4"/>}{expanded ? "Fit to screen" : "Enlarge preview"}</button>
    <button type="button" onClick={() => run("png")} disabled={Boolean(preparing)} className="inline-flex items-center gap-2 rounded-full bg-[#c27a2c] px-6 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-65">{preparing==="png"?<LoaderCircle className="h-4 w-4 animate-spin"/>:<ImageDown className="h-4 w-4"/>}{preparing==="png"?"Preparing PNG...":"Download PNG"}</button>
    <button type="button" onClick={() => run("pdf")} disabled={Boolean(preparing)} className="inline-flex items-center gap-2 rounded-full bg-[#172842] px-6 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-65">{preparing==="pdf"?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Download className="h-4 w-4"/>}{preparing==="pdf"?"Preparing PDF...":"Download PDF"}</button>
    <button type="button" onClick={() => run("print")} disabled={Boolean(preparing)} className="inline-flex items-center gap-2 rounded-full border border-[#d8a657] bg-white px-6 py-3 text-sm font-semibold text-[#172842] disabled:cursor-wait disabled:opacity-65">{preparing==="print"?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Printer className="h-4 w-4"/>}{preparing==="print"?"Preparing print...":"Print certificate"}</button>
  </div>{error?<p role="alert" className="mt-3 text-center text-sm font-semibold text-[#b24646]">{error}</p>:null}</div>;
}