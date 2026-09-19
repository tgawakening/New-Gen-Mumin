"use client";

import { useState } from "react";
import { toPng } from "html-to-image";
import { Download, ImageDown, LoaderCircle, Printer } from "lucide-react";

function safeFilename(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "gen-mumin-certificate";
}

async function downloadCertificatePng(filename: string) {
  const source = document.querySelector<HTMLElement>("[data-certificate-artwork]");
  if (!source) throw new Error("Certificate artwork was not found.");

  await Promise.all(
    Array.from(source.querySelectorAll("img")).map((image) =>
      image.complete ? image.decode().catch(() => undefined) : image.decode().catch(() => undefined),
    ),
  );

  const bounds = source.getBoundingClientRect();
  const pixelRatio = Math.max(2, Math.min(3, 2400 / bounds.width));
  const dataUrl = await toPng(source, {
    cacheBust: true,
    backgroundColor: "#fffaf0",
    pixelRatio,
    width: bounds.width,
    height: bounds.height,
    canvasWidth: Math.round(bounds.width * pixelRatio),
    canvasHeight: Math.round(bounds.height * pixelRatio),
    preferredFontFormat: "woff2",
    fetchRequestInit: { credentials: "same-origin" },
    style: {
      margin: "0",
      transform: "none",
    },
  });

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${safeFilename(filename)}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function CertificateActions({ filename = "Gen-Mumin certificate" }: { filename?: string }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  async function handlePng() {
    if (downloading) return;
    setDownloading(true); setError("");
    try { await downloadCertificatePng(filename); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create the PNG. Please try again."); }
    finally { setDownloading(false); }
  }
  return <div className="mt-8 print:hidden"><div className="flex flex-wrap justify-center gap-3">
    <button type="button" onClick={handlePng} disabled={downloading} className="inline-flex items-center gap-2 rounded-full bg-[#c27a2c] px-6 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-65">{downloading?<LoaderCircle className="h-4 w-4 animate-spin"/>:<ImageDown className="h-4 w-4"/>}{downloading?"Preparing PNG...":"Download PNG"}</button>
    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-[#172842] px-6 py-3 text-sm font-semibold text-white"><Download className="h-4 w-4"/>Download / Save PDF</button>
    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-[#d8a657] bg-white px-6 py-3 text-sm font-semibold text-[#172842]"><Printer className="h-4 w-4"/>Print certificate</button>
  </div>{error?<p role="alert" className="mt-3 text-center text-sm font-semibold text-[#b24646]">{error}</p>:null}</div>;
}