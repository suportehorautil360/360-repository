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

beforeEach(() => get.mockReset());

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
});
