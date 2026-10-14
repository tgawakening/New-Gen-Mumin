"use client";
import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { toPng } from "html-to-image";
export function BadgeDownload({ filename }: { filename: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (busy) return;
    setBusy(true); setError("");
    let host: HTMLDivElement | undefined;
    try {
      const source = document.querySelector<HTMLElement>("[data-badge-artwork]");
      if (!source) throw new Error("Badge preview is unavailable.");
      await document.fonts.ready;
      const copy = source.cloneNode(true) as HTMLElement;
      copy.removeAttribute("data-badge-artwork");
      Object.assign(copy.style, { width: "640px", minWidth: "640px", maxWidth: "640px", margin: "0" });
      host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      Object.assign(host.style, { position: "fixed", top: "0", left: "-20000px", width: "640px" });
      host.appendChild(copy); document.body.appendChild(host);
      await Promise.all(Array.from(copy.querySelectorAll("img")).map(async img => { img.loading = "eager"; await img.decode(); }));
      const bounds = copy.getBoundingClientRect();
      const png = await toPng(copy, { width: bounds.width, height: bounds.height, pixelRatio: 2, backgroundColor: "#fffdf7", cacheBust: true, preferredFontFormat: "woff2", fetchRequestInit: { credentials: "same-origin" } });
      const link = document.createElement("a"); link.href = png;
      link.download = (filename.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0,120) || "gen-mumin-badge") + ".png";
      document.body.appendChild(link); link.click(); link.remove();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to download. Please try again."); }
    finally { host?.remove(); setBusy(false); }
  }
  return <div className="text-center"><button type="button" disabled={busy} onClick={download} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#22304a] px-6 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60">{busy ? <LoaderCircle className="h-5 w-5 animate-spin"/> : <Download className="h-5 w-5"/>}{busy ? "Preparing badge..." : "Download badge PNG"}</button>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}</div>;
}
