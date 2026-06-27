/** Header `x-admin-secret` para rotas admin do back (WhatsApp, suporte postos, etc.). */

const STORAGE_KEY = "hu360_admin_secret";

/** Segredo disponível: sessão (senha digitada no hub) ou env do build. */
export function getAdminSecret(): string {
  if (typeof window !== "undefined") {
    const fromSession = sessionStorage.getItem(STORAGE_KEY)?.trim();
    if (fromSession) return fromSession;
  }
  return (import.meta.env.VITE_ADMIN_SECRET as string | undefined)?.trim() ?? "";
}

export function setAdminSecretForSession(secret: string): void {
  if (typeof window === "undefined") return;
  const trimmed = secret.trim();
  if (trimmed) {
    sessionStorage.setItem(STORAGE_KEY, trimmed);
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function clearAdminSecretFromSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Headers extras para fetch em rotas protegidas por AdminSecretGuard. */
export function adminSecretHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const secret = getAdminSecret();
  return {
    ...extra,
    ...(secret ? { "x-admin-secret": secret } : {}),
  };
}

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.DEV ? "http://localhost:3000" : "/api");

/** Valida a senha admin contra o back (funciona sem VITE_ADMIN_SECRET no bundle). */
export async function verifyAdminSecretWithBackend(
  input: string,
): Promise<boolean> {
  const trimmed = input.trim();
  if (!trimmed) return false;
  try {
    const res = await fetch(`${API_BASE}/whatsapp/status`, {
      headers: { "x-admin-secret": trimmed },
    });
    return res.ok;
  } catch {
    return false;
  }
}
