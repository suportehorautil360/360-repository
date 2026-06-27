import {
  clearAdminSecretFromSession,
  setAdminSecretForSession,
} from "../lib/api/admin-secret";

const ADMIN_SESSION_KEY = "hu360_admin_ok";
const ADMIN_PERSISTED_SESSION_KEY = "hu360_admin_session";
const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const LEGACY_PORTAL_SESSION_KEYS = [
  "hu360_session",
  "hu360_hub_ctx_posto",
  "hu360_hub_ctx_pref",
];

type AdminPersistedSession = {
  authenticated: true;
  expiresAt: number;
};

export function isAdminAuthenticated(): boolean {
  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1") {
    return true;
  }

  try {
    const raw = localStorage.getItem(ADMIN_PERSISTED_SESSION_KEY);
    if (!raw) {
      return false;
    }

    const session = JSON.parse(raw) as Partial<AdminPersistedSession>;
    if (session.authenticated === true && Number(session.expiresAt) > Date.now()) {
      return true;
    }
  } catch {
    /* sessão inválida: limpa abaixo */
  }

  localStorage.removeItem(ADMIN_PERSISTED_SESSION_KEY);
  return false;
}

/** Persiste sessão do hub; guarde a senha para chamadas admin ao back. */
export function setAdminAuthenticated(adminSecret?: string): void {
  sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
  if (adminSecret?.trim()) {
    setAdminSecretForSession(adminSecret);
  }
  const session: AdminPersistedSession = {
    authenticated: true,
    expiresAt: Date.now() + ADMIN_SESSION_TTL_MS,
  };
  localStorage.setItem(ADMIN_PERSISTED_SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  localStorage.removeItem(ADMIN_PERSISTED_SESSION_KEY);
  clearAdminSecretFromSession();
  LEGACY_PORTAL_SESSION_KEYS.forEach((key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  });
}

/** Compare com `import.meta.env.VITE_ADMIN_SECRET` no `.env` local (não commitar). */
export function verifyAdminSecret(input: string): boolean {
  const expected = import.meta.env.VITE_ADMIN_SECRET ?? "";
  if (!expected.trim()) {
    return false;
  }
  return input === expected;
}

export function isAdminSecretConfigured(): boolean {
  return Boolean((import.meta.env.VITE_ADMIN_SECRET ?? "").trim());
}
