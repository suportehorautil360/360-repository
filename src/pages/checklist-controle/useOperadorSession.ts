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

/**
 * Sessão válida por 24h (um turno com folga). Fica em localStorage para
 * sobreviver ao fechamento do PWA — sessionStorage morre quando o iOS mata
 * o app em background, e o operador em campo sem sinal ficava trancado fora.
 */
const SESSAO_TTL_MS = 24 * 60 * 60 * 1000;

type Envelope = { session: OperadorSession; expiraEm: string };

function limpar() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function read(): OperadorSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Envelope>;
      if (
        parsed?.expiraEm &&
        Date.now() < Date.parse(parsed.expiraEm) &&
        isValidSession(parsed.session)
      ) {
        return parsed.session;
      }
      limpar();
      return null;
    }
    // Migração: a sessão antiga vivia em sessionStorage, sem envelope.
    const legado = sessionStorage.getItem(STORAGE_KEY);
    if (legado) {
      const parsed: unknown = JSON.parse(legado);
      if (isValidSession(parsed)) {
        write(parsed);
        return parsed;
      }
      limpar();
    }
    return null;
  } catch {
    limpar();
    return null;
  }
}

function write(session: OperadorSession | null): boolean {
  try {
    if (!session) {
      limpar();
      return true;
    }
    const envelope: Envelope = {
      session,
      expiraEm: new Date(Date.now() + SESSAO_TTL_MS).toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
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
