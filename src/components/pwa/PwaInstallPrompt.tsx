"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISS_KEY = "gen-mumin-pwa-install-dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstallPrompt({ audience = "dashboard" }: { audience?: "dashboard" | "parent" | "teacher" | "student" }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);

  const label = useMemo(() => {
    if (audience === "teacher") return "Install teacher app";
    if (audience === "parent" || audience === "student") return "Install dashboard app";
    return "Install Gen-Mumin app";
  }, [audience]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (window.localStorage.getItem(DISMISS_KEY) === "true") return;

    setIosDevice(isIOS());
    setVisible(true);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);


  if (!visible) return null;

  async function installApp() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      window.localStorage.setItem(DISMISS_KEY, "true");
      setVisible(false);
    }
    setInstallEvent(null);
  }

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "true");
    setVisible(false);
  }

  return (
    <section className="mt-5 rounded-[22px] border border-white/15 bg-white/10 p-4 text-white shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-[#f2c58f]">
            <Smartphone className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">{label}</p>
            <p className="mt-1 text-xs leading-5 text-white/72">
              Add Gen-Mumin to your phone home screen for quicker dashboard access.
              {iosDevice && !installEvent ? " On iPhone, tap Share, then Add to Home Screen." : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {installEvent ? (
            <button
              type="button"
              onClick={installApp}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#17243a] transition hover:bg-[#fff3df]"
            >
              <Download className="h-4 w-4" />
              Install
            </button>
          ) : (
            <span className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/80">
              Add to Home Screen
            </span>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss install prompt"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/8 text-white transition hover:bg-white/15"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
