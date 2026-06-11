import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const get = vi.fn();
vi.mock("./client", () => ({
  api: {
    get: (...args: unknown[]) => get(...args),
    post: vi.fn(),
  },
}));

import { useFeatureFlag, useAbastecimentoAtivo } from "./feature-flags";

beforeEach(() => {
  get.mockReset();
  localStorage.clear();
});

describe("useFeatureFlag", () => {
  it("ativo=true quando a chave está true", async () => {
    get.mockResolvedValue({ data: { abastecimento: true } });
    const { result } = renderHook(() =>
      useFeatureFlag("pref-1", "abastecimento"),
    );
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.ativo).toBe(true);
  });

  it("ativo=false quando a chave está ausente", async () => {
    get.mockResolvedValue({ data: { ponto: true } });
    const { result } = renderHook(() => useAbastecimentoAtivo("pref-1"));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.ativo).toBe(false);
  });

  it("sem prefeituraId → inativo e não chama a API", async () => {
    const { result } = renderHook(() =>
      useFeatureFlag(undefined, "abastecimento"),
    );
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.ativo).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });

  // Operador em campo sem sinal: a flag não pode "sumir" só porque a API
  // falhou — usa o último valor conhecido (cache em localStorage).
  it("API falhou + cache anterior → mantém o último valor conhecido", async () => {
    localStorage.setItem("hu360-flags:pref-1", JSON.stringify({ ponto: true }));
    get.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useFeatureFlag("pref-1", "ponto"));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.ativo).toBe(true);
  });

  it("API falhou sem cache → inativo (opt-in continua valendo)", async () => {
    get.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useFeatureFlag("pref-1", "ponto"));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.ativo).toBe(false);
  });

  it("sucesso da API atualiza o cache para a próxima vez offline", async () => {
    get.mockResolvedValue({ data: { ponto: true } });
    const { result } = renderHook(() => useFeatureFlag("pref-1", "ponto"));
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(
      JSON.parse(localStorage.getItem("hu360-flags:pref-1") ?? "{}"),
    ).toEqual({ ponto: true });
  });

  it("cache aparece de imediato enquanto revalida (sem flicker)", async () => {
    localStorage.setItem("hu360-flags:pref-1", JSON.stringify({ ponto: true }));
    let resolver: (v: unknown) => void = () => {};
    get.mockReturnValue(new Promise((res) => (resolver = res)));
    const { result } = renderHook(() => useFeatureFlag("pref-1", "ponto"));
    // Antes da API responder, o último valor conhecido já vale.
    await waitFor(() => expect(result.current.ativo).toBe(true));
    resolver({ data: { ponto: false } });
    await waitFor(() => expect(result.current.ativo).toBe(false));
  });
});
