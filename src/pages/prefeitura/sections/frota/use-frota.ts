import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../../../../lib/api/client";
import { frotaApi } from "./frota-api";
import type { RevisaoInput, VeiculoFrota, VeiculoFrotaInput } from "./types";

export interface UseFrota {
  lista: VeiculoFrota[];
  loading: boolean;
  erro: string;
  /** Adiciona 1 veículo na prefeitura ativa. Recusa placa duplicada. */
  adicionar: (
    data: VeiculoFrotaInput,
  ) => Promise<{ ok: boolean; message: string }>;
  /** Adiciona vários (botão "popular com exemplos"). */
  adicionarLote: (entradas: VeiculoFrotaInput[]) => Promise<number>;
  /** Atualiza a leitura atual (envia o DTO completo ao backend). */
  atualizar: (id: string, medicaoAtual: number) => Promise<void>;
  /**
   * Registra a revisão concluída e libera o veículo: o backend adota o
   * hodômetro como leitura atual e base da próxima revisão, e volta o
   * status para "ativo".
   */
  registrarRevisao: (
    veiculo: VeiculoFrota,
    dados: RevisaoInput,
  ) => Promise<void>;
  remover: (id: string) => Promise<void>;
}

export function useFrota(prefeituraId: string | undefined): UseFrota {
  const [lista, setLista] = useState<VeiculoFrota[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!prefeituraId) {
      setLista([]);
      return;
    }
    setLoading(true);
    setErro("");
    try {
      setLista(await frotaApi.listar(prefeituraId));
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? e.message
          : "Não foi possível carregar a frota.",
      );
      setLista([]);
    } finally {
      setLoading(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const adicionar = useCallback(
    async (data: VeiculoFrotaInput) => {
      if (!prefeituraId)
        return { ok: false, message: "Selecione a prefeitura." };
      const placa = data.placa.trim();
      if (!placa) return { ok: false, message: "Informe a placa / código." };
      if (!data.nome.trim()) return { ok: false, message: "Informe o nome." };
      if (lista.some((v) => v.placa.toLowerCase() === placa.toLowerCase())) {
        return { ok: false, message: "Placa / código já cadastrado." };
      }
      try {
        const novo = await frotaApi.criar(data, prefeituraId);
        setLista((prev) => [...prev, novo]);
        return { ok: true, message: "Veículo adicionado." };
      } catch (e) {
        return {
          ok: false,
          message: e instanceof ApiError ? e.message : "Erro ao salvar.",
        };
      }
    },
    [lista, prefeituraId],
  );

  const adicionarLote = useCallback(
    async (entradas: VeiculoFrotaInput[]) => {
      if (!prefeituraId) return 0;
      let adicionados = 0;
      for (const data of entradas) {
        try {
          await frotaApi.criar(data, prefeituraId);
          adicionados++;
        } catch {
          // ignora falha individual (ex.: duplicado) e segue
        }
      }
      if (adicionados > 0) await carregar();
      return adicionados;
    },
    [prefeituraId, carregar],
  );

  const atualizar = useCallback(
    async (id: string, medicaoAtual: number) => {
      if (!prefeituraId) return;
      const atual = lista.find((v) => v.id === id);
      if (!atual) return;
      const novo = { ...atual, medicaoAtual };
      await frotaApi.atualizar(novo, prefeituraId);
      setLista((prev) => prev.map((v) => (v.id === id ? novo : v)));
    },
    [lista, prefeituraId],
  );

  const registrarRevisao = useCallback(
    async (veiculo: VeiculoFrota, dados: RevisaoInput) => {
      if (!prefeituraId) return;
      await frotaApi.concluirRevisao(veiculo, prefeituraId, dados);
      // Reflete o que o backend fez: leitura e última revisão = hodômetro,
      // status volta a "ativo".
      setLista((prev) =>
        prev.map((v) =>
          v.id === veiculo.id
            ? {
                ...v,
                medicaoAtual: dados.hodometro,
                ultimaRevisao: dados.hodometro,
                status: "ativo",
              }
            : v,
        ),
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("hu360:frota-revisao-atualizada", {
            detail: { prefeituraId },
          }),
        );
      }
    },
    [prefeituraId],
  );

  const remover = useCallback(async (id: string) => {
    await frotaApi.remover(id);
    setLista((prev) => prev.filter((v) => v.id !== id));
  }, []);

  return {
    lista,
    loading,
    erro,
    adicionar,
    adicionarLote,
    atualizar,
    registrarRevisao,
    remover,
  };
}
