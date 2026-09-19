"use client";

import { useState } from "react";
import { Download, ImageDown, LoaderCircle, Printer } from "lucide-react";

function safeFilename(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "gen-mumin-certificate";
}

async function downloadCertificatePng(filename: string) {
  const source = document.querySelector<HTMLElement>("[data-certificate-artwork]");
  if (!source) throw new Error("Certificate artwork was not found.");
  await Promise.all(Array.from(source.querySelectorAll("img")).map((image) => image.complete ? Promise.resolve() : image.decode().catch(() => undefined)));
  const bounds = source.getBoundingClientRect();
  const clone = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
  const clones = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
  originals.forEach((element, index) => {
    const target = clones[index];
    if (!target) return;
    const computed = window.getComputedStyle(element);
    for (const property of Array.from(computed)) target.style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
  });
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  clone.style.width = `${bounds.width}px`;
  clone.style.height = `${bounds.height}px`;
  clone.style.margin = "0";
  clone.style.transform = "none";
  const markup = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
  const objectUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    const scale = Math.max(2, Math.min(3, 2400 / bounds.width));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bounds.width * scale);
    canvas.height = Math.round(bounds.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG rendering is not supported by this browser.");
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, bounds.width, bounds.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 1));
    if (!blob) throw new Error("The PNG file could not be created.");
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `${safeFilename(filename)}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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