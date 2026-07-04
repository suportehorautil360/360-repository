/** Feature flags por prefeitura (módulo feature-flags do back-360-). */
import { useEffect, useState } from "react";
import { api } from "./client";

export type FeatureFlags = Record<string, boolean>;

export interface FlagDef {
  key: string;
  label: string;
  group: string;
  default: boolean;
}

export const FEATURE_FLAGS: FlagDef[] = [
  { key: "abastecimento", label: "Abastecimento", group: "Abastecimento", default: false },
  { key: "ponto", label: "Ponto", group: "Pessoas / RH", default: false },
  { key: "frota", label: "Gestão de Frota", group: "Gestão de Frota", default: true },
  { key: "manutencao", label: "Manutenção", group: "Manutenção", default: true },
  { key: "pessoas", label: "Pessoas / RH", group: "Pessoas / RH", default: true },
  { key: "qualidade", label: "Qualidade e Segurança", group: "Qualidade e Segurança", default: true },
];


export function resolveFlags(raw: FeatureFlags): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const def of FEATURE_FLAGS) {
    out[def.key] = raw[def.key] ?? def.default;
  }
  return out;
}

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

export function useResolvedFlags(prefeituraId: string | undefined) {
  const [flags, setFlags] = useState<Record<string, boolean>>(() =>
    resolveFlags({}),
  );
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    if (!prefeituraId) {
      setFlags(resolveFlags({}));
      setCarregando(false);
      return;
    }
    const cache = lerCache(prefeituraId);
    setFlags(resolveFlags(cache));
    setCarregando(Object.keys(cache).length === 0);
    featureFlagsApi
      .obter(prefeituraId)
      .then((f) => {
        gravarCache(prefeituraId, f);
        if (vivo) setFlags(resolveFlags(f));
      })
      .catch(() => {
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [prefeituraId]);

  return { flags, carregando };
}

/** Ponto ativo (registro pelo operador + aprovação do RH). */
export function usePontoAtivo(prefeituraId: string | undefined) {
  return useFeatureFlag(prefeituraId, "ponto");
}

/** Abastecimento ativo (tela de abastecimentos na prefeitura). */
export function useAbastecimentoAtivo(prefeituraId: string | undefined) {
  return useFeatureFlag(prefeituraId, "abastecimento");
}
