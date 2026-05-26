import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./frota-api", () => ({
  frotaApi: {
    listar: vi.fn(),
    criar: vi.fn(),
    atualizar: vi.fn(),
    remover: vi.fn(),
    concluirRevisao: vi.fn(),
  },
}));

import { useFrota } from "./use-frota";
import { frotaApi } from "./frota-api";
import type { VeiculoFrota } from "./types";

const mock = vi.mocked(frotaApi);

function veiculo(over: Partial<VeiculoFrota> = {}): VeiculoFrota {
  return {
    id: "v1",
    placa: "CAR-001",
    nome: "HB20 2021",
    marca: "Hyundai",
    tipo: "carro",
    ano: 2021,
    medicaoAtual: 12000,
    intervaloRevisao: 10000,
    ultimaRevisao: 0,
    obra: "Disponível",
    status: "ativo",
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.listar.mockResolvedValue([]);
});

describe("useFrota", () => {
  it("carrega a lista da prefeitura no mount", async () => {
    mock.listar.mockResolvedValue([veiculo()]);
    const { result } = renderHook(() => useFrota("pref-1"));

    await waitFor(() => expect(result.current.lista).toHaveLength(1));
    expect(mock.listar).toHaveBeenCalledWith("pref-1");
  });

  it("não busca e mantém lista vazia sem prefeitura", async () => {
    const { result } = renderHook(() => useFrota(undefined));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mock.listar).not.toHaveBeenCalled();
    expect(result.current.lista).toEqual([]);
  });

  it("recusa placa duplicada (case-insensitive) sem chamar a API", async () => {
    mock.listar.mockResolvedValue([veiculo({ placa: "CAR-001" })]);
    const { result } = renderHook(() => useFrota("pref-1"));
    await waitFor(() => expect(result.current.lista).toHaveLength(1));

    let r!: { ok: boolean; message: string };
    await act(async () => {
      r = await result.current.adicionar({
        placa: "car-001",
        nome: "Outro",
        marca: "X",
        tipo: "carro",
        ano: 2020,
        medicaoAtual: 0,
        intervaloRevisao: 1000,
        ultimaRevisao: 0,
        obra: "",
      });
    });

    expect(r.ok).toBe(false);
    expect(mock.criar).not.toHaveBeenCalled();
  });

  it("registrarRevisao reflete a liberação no estado local", async () => {
    mock.listar.mockResolvedValue([
      veiculo({ medicaoAtual: 12000, ultimaRevisao: 0, status: "ativo" }),
    ]);
    mock.concluirRevisao.mockResolvedValue(undefined);
    const { result } = renderHook(() => useFrota("pref-1"));
    await waitFor(() => expect(result.current.lista).toHaveLength(1));

    await act(async () => {
      await result.current.registrarRevisao(result.current.lista[0], {
        data: "2026-05-25",
        hodometro: 15000,
        oficina: "Oficina X",
        servicos: "",
        custo: 0,
        notaFiscal: "",
      });
    });

    const v = result.current.lista[0];
    expect(v.medicaoAtual).toBe(15000);
    expect(v.ultimaRevisao).toBe(15000);
    expect(v.status).toBe("ativo");
  });
});
