/**
 * Sessão do operador: precisa sobreviver ao fechamento do PWA (iOS mata o
 * app em background) e expirar em 24h. Antes ficava em sessionStorage e o
 * operador era deslogado toda vez que o app fechava — em campo sem sinal,
 * ficava trancado fora.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOperadorSession, type OperadorSession } from "./useOperadorSession";

const KEY = "hu360-operador-session";

const SESSAO: OperadorSession = {
  nome: "João Operador",
  idCliente: "pref-1",
  empresa: "Prefeitura de Três Lagoas",
  funcionarioId: "f1",
  cpf: "39053344705",
  tipo: "operador",
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-11T08:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useOperadorSession", () => {
  it("login persiste em localStorage e sobrevive a 'reabrir o app'", () => {
    const { result } = renderHook(() => useOperadorSession());
    act(() => {
      result.current.setSession(SESSAO);
    });
    // "Reabrir o app": novo mount lendo do armazenamento.
    const { result: reaberto } = renderHook(() => useOperadorSession());
    expect(reaberto.current.session?.nome).toBe("João Operador");
    expect(localStorage.getItem(KEY)).toBeTruthy();
  });

  it("sessão expira após 24h", () => {
    const { result } = renderHook(() => useOperadorSession());
    act(() => {
      result.current.setSession(SESSAO);
    });
    vi.setSystemTime(new Date("2026-06-12T08:00:01Z")); // 24h + 1s depois
    const { result: depois } = renderHook(() => useOperadorSession());
    expect(depois.current.session).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("dentro das 24h a sessão continua válida", () => {
    const { result } = renderHook(() => useOperadorSession());
    act(() => {
      result.current.setSession(SESSAO);
    });
    vi.setSystemTime(new Date("2026-06-12T07:59:00Z")); // 23h59 depois
    const { result: depois } = renderHook(() => useOperadorSession());
    expect(depois.current.session?.nome).toBe("João Operador");
  });

  it("logout limpa o armazenamento", () => {
    const { result } = renderHook(() => useOperadorSession());
    act(() => {
      result.current.setSession(SESSAO);
      result.current.setSession(null);
    });
    expect(localStorage.getItem(KEY)).toBeNull();
    const { result: depois } = renderHook(() => useOperadorSession());
    expect(depois.current.session).toBeNull();
  });

  it("migra sessão legada do sessionStorage (formato antigo, sem envelope)", () => {
    sessionStorage.setItem(KEY, JSON.stringify(SESSAO));
    const { result } = renderHook(() => useOperadorSession());
    expect(result.current.session?.nome).toBe("João Operador");
  });

  it("envelope corrompido é descartado sem quebrar", () => {
    localStorage.setItem(KEY, "{lixo");
    const { result } = renderHook(() => useOperadorSession());
    expect(result.current.session).toBeNull();
  });
});
