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

/**
 * Estado discriminado da instalação do PWA.
 *
 * - `instalado`: rodando como app instalado (display-mode standalone).
 * - `nativo`: navegador disparou `beforeinstallprompt` — `instalar()` chama
 *   o prompt do sistema.
 * - `manual-ios`: iOS Safari (não suporta o prompt) — instruções "Compartilhar
 *   → Adicionar à Tela de Início".
 * - `manual-outro`: demais navegadores sem prompt disponível ainda — instruções
 *   genéricas (menu do navegador → Instalar app).
 */
export type PwaInstallEstado =
  | "instalado"
  | "nativo"
  | "manual-ios"
  | "manual-outro";

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

function ehIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function calcularEstado(): PwaInstallEstado {
  if (installed) return "instalado";
  if (installPrompt) return "nativo";
  if (ehIos()) return "manual-ios";
  return "manual-outro";
}

function notifyInstallPromptChange() {
  listeners.forEach((listener) => listener());
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
  const [estado, setEstado] = useState<PwaInstallEstado>(() => calcularEstado());

  useEffect(() => {
    setupPwaInstallPromptListener();
    const listener = () => setEstado(calcularEstado());
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  /**
   * Dispara o prompt nativo quando disponível. Retorna `true` se o prompt
   * foi disparado, `false` se não rolou (a UI deve mostrar instruções
   * manuais quando o estado for `manual-*`).
   */
  const instalar = useCallback(async (): Promise<boolean> => {
    const promptEvent = installPrompt;
    if (!promptEvent) return false;

    await promptEvent.prompt();
    await promptEvent.userChoice;
    if (installPrompt === promptEvent) {
      installPrompt = null;
    }
    installed = isAppInstalled();
    notifyInstallPromptChange();
    return true;
  }, []);

  // Compat: o nome antigo continua funcionando, mas o consumidor deve
  // migrar para `estado` + `instalar` (mais rico).
  const canInstall = estado === "nativo";

  return {
    estado,
    instalar,
    canInstall,
    installApp: instalar,
  };
}
