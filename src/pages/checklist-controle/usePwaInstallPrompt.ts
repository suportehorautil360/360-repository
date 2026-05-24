import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let installPrompt: BeforeInstallPromptEvent | null = null;
let installed = typeof window !== "undefined" ? isAppInstalled() : false;
let listenerStarted = false;
const listeners = new Set<() => void>();

function isAppInstalled(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function notifyInstallPromptChange() {
  listeners.forEach((listener) => listener());
}

function canInstallApp(): boolean {
  return Boolean(installPrompt && !installed);
}

export function setupPwaInstallPromptListener() {
  if (listenerStarted || typeof window === "undefined") return;
  listenerStarted = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installed = isAppInstalled();
    installPrompt = installed ? null : event;
    notifyInstallPromptChange();
  });

  window.addEventListener("appinstalled", () => {
    installed = true;
    installPrompt = null;
    notifyInstallPromptChange();
  });
}

export function usePwaInstallPrompt() {
  const [canInstall, setCanInstall] = useState(() => canInstallApp());

  useEffect(() => {
    setupPwaInstallPromptListener();
    const listener = () => setCanInstall(canInstallApp());
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const installApp = useCallback(async () => {
    const promptEvent = installPrompt;
    if (!promptEvent) return;

    await promptEvent.prompt();
    await promptEvent.userChoice;
    if (installPrompt === promptEvent) {
      installPrompt = null;
    }
    installed = isAppInstalled();
    notifyInstallPromptChange();
  }, []);

  return {
    canInstall,
    installApp,
  };
}
