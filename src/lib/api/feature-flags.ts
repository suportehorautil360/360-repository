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

/**
 * Indica se o Ponto está ativo para a prefeitura (opt-in: default false).
 * `carregando` evita decidir o gating antes da flag chegar.
 */
export function usePontoAtivo(prefeituraId: string | undefined) {
  const [ativo, setAtivo] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    if (!prefeituraId) {
      setAtivo(false);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    featureFlagsApi
      .obter(prefeituraId)
      .then((f) => {
        if (vivo) setAtivo(f.ponto === true);
      })
      .catch(() => {
        if (vivo) setAtivo(false);
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [prefeituraId]);

  return { ativo, carregando };
}
