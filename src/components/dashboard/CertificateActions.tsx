"use client";

import { Download, Printer } from "lucide-react";

export function CertificateActions() {
  return (
    <div className="mt-8 flex flex-wrap justify-center gap-3 print:hidden">
      <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-[#172842] px-6 py-3 text-sm font-semibold text-white">
        <Download className="h-4 w-4" /> Download / Save PDF
      </button>
      <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-[#d8a657] bg-white px-6 py-3 text-sm font-semibold text-[#172842]">
        <Printer className="h-4 w-4" /> Print certificate
      </button>
    </div>
  );
}