import { useCallback, useState } from "react";

const STORAGE_KEY = "hu360-operador-session";

export type OperadorSession = {
  nome: string;
  idMaquina: string;
  idCliente: string;
  empresa: string;
};

function isValidSession(s: unknown): s is OperadorSession {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.nome === "string" &&
    o.nome.length > 0 &&
    typeof o.idMaquina === "string" &&
    o.idMaquina.length > 0 &&
    typeof o.idCliente === "string" &&
    typeof o.empresa === "string"
  );
}

function read(): OperadorSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSession(parsed)) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

function write(session: OperadorSession | null): boolean {
  try {
    if (!session) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function useOperadorSession() {
  const [session, setSessionState] = useState<OperadorSession | null>(() =>
    read(),
  );

  const setSession = useCallback((s: OperadorSession | null) => {
    const ok = write(s);
    setSessionState(s);
    return ok;
  }, []);

  return { session, setSession };
}
