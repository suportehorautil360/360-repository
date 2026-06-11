/** Feature flags por prefeitura (módulo feature-flags do back-360-). */
import { useEffect, useState } from "react";
import { api } from "./client";

export type FeatureFlags = Record<string, boolean>;

export const featureFlagsApi = {
  async obter(prefeituraId: string): Promise<FeatureFlags> {
    const r = await api.get<{ data: FeatureFlags }>(
      `/feature-flags/${prefeituraId}`,
    );
    return r.data ?? {};
  },

  async salvar(prefeituraId: string, flags: FeatureFlags): Promise<void> {
    await api.post("/feature-flags", { prefeituraId, flags });
  },
};

// Último valor conhecido das flags por prefeitura. Operador em campo fica
// horas sem sinal — a flag não pode "sumir" porque a consulta falhou (era o
// motivo do botão de ponto desaparecer offline).
function chaveCache(prefeituraId: string) {
  return `hu360-flags:${prefeituraId}`;
}

function lerCache(prefeituraId: string): FeatureFlags {
  try {
    const raw = localStorage.getItem(chaveCache(prefeituraId));
    return raw ? (JSON.parse(raw) as FeatureFlags) : {};
  } catch {
    return {};
  }
}

function gravarCache(prefeituraId: string, flags: FeatureFlags) {
  try {
    localStorage.setItem(chaveCache(prefeituraId), JSON.stringify(flags));
  } catch {
    /* cota cheia — segue sem cache */
  }
}

/**
 * Indica se uma feature flag está ativa para a prefeitura (opt-in: default
 * false). Stale-while-revalidate: o último valor conhecido (localStorage)
 * vale de imediato; a API revalida e atualiza o cache; falha da API mantém
 * o último valor em vez de derrubar para false. `carregando` evita decidir
 * o gating antes de existir qualquer valor (cache ou API).
 */
export function useFeatureFlag(
  prefeituraId: string | undefined,
  chave: string,
) {
  const [ativo, setAtivo] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    if (!prefeituraId) {
      setAtivo(false);
      setCarregando(false);
      return;
    }
    const cache = lerCache(prefeituraId);
    const temCache = chave in cache;
    setAtivo(cache[chave] === true);
    // Com cache, o gating já pode decidir; a revalidação segue por baixo.
    setCarregando(!temCache);
    featureFlagsApi
      .obter(prefeituraId)
      .then((f) => {
        gravarCache(prefeituraId, f);
        if (vivo) setAtivo(f[chave] === true);
      })
      .catch(() => {
        /* offline/erro: mantém o último valor conhecido */
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [prefeituraId, chave]);

  return { ativo, carregando };
}

/** Ponto ativo (registro pelo operador + aprovação do RH). */
export function usePontoAtivo(prefeituraId: string | undefined) {
  return useFeatureFlag(prefeituraId, "ponto");
}

/** Abastecimento ativo (tela de abastecimentos na prefeitura). */
export function useAbastecimentoAtivo(prefeituraId: string | undefined) {
  return useFeatureFlag(prefeituraId, "abastecimento");
}
