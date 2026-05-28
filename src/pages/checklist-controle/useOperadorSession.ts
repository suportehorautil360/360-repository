import { useCallback, useState } from "react";

const STORAGE_KEY = "hu360-operador-session";

export type OperadorSession = {
  nome: string;
  idCliente: string;
  empresa: string;
  /** Identidade do funcionário autenticado (login por CPF+senha). */
  funcionarioId?: string;
  cpf?: string;
  tipo?: "operador" | "supervisor" | "admin";
  /**
   * Equipamento da sessão. Não vem mais do login (que agora identifica a
   * pessoa) — é preenchido quando o operador abre um checklist por chassi.
   */
  idMaquina?: string;
  chassis?: string;
};

function isValidSession(s: unknown): s is OperadorSession {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.nome === "string" &&
    o.nome.length > 0 &&
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
