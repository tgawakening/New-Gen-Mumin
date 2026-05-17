"use client";

import { useEffect, useState } from "react";

type UnsavedChangesGuardProps = {
  rootId: string;
};

export function UnsavedChangesGuard({ rootId }: UnsavedChangesGuardProps) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;

    const markDirty = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-ignore-unsaved]")) return;
      setDirty(true);
    };

    const clearOnSave = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("form[data-curriculum-save]")) {
        setDirty(false);
      }
    };

    root.addEventListener("input", markDirty);
    root.addEventListener("change", markDirty);
    root.addEventListener("submit", clearOnSave, true);

    return () => {
      root.removeEventListener("input", markDirty);
      root.removeEventListener("change", markDirty);
      root.removeEventListener("submit", clearOnSave, true);
    };
  }, [rootId]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const confirmNavigation = (event: MouseEvent) => {
      if (!dirty) return;
      const link = (event.target as HTMLElement | null)?.closest("a[href]");
      if (!link) return;
      if (window.confirm("Unsaved curriculum changes might be lost. Leave this page?")) {
        setDirty(false);
        return;
      }
      event.preventDefault();
    };

    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", confirmNavigation, true);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", confirmNavigation, true);
    };
  }, [dirty]);

  if (!dirty) return null;

  return (
    <div className="sticky top-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#f0c36d] bg-[#fff8e6] px-4 py-3 text-sm text-[#6c4a16] shadow-sm">
      <span className="font-semibold">Unsaved changes might be lost if you leave or refresh.</span>
      <button
        type="button"
        data-ignore-unsaved
        onClick={() => setDirty(false)}
        className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#6c4a16]"
      >
        Dismiss
      </button>
    </div>
  );
}
