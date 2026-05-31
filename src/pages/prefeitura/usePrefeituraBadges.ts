import { useEffect, useState } from "react";
import { frotaApi } from "./sections/frota/frota-api";
import { isVencido } from "./sections/frota/types";
import { pontosApi } from "../../lib/api/pontos";
import type { PrefeituraNavBadges } from "./prefeituraNav";

/**
 * Contagens dinâmicas para os badges da sidebar da prefeitura:
 * Revisões = veículos da frota vencidos; Pontos (RH) = batidas pendentes.
 * Retorna `undefined` quando zero (para não exibir badge "0").
 */
export function usePrefeituraBadges(
  prefeituraId: string | undefined,
  pontoAtivo: boolean,
): PrefeituraNavBadges {
  const [revisoes, setRevisoes] = useState<number | undefined>(undefined);
  const [pontosRh, setPontosRh] = useState<number | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    if (!prefeituraId) {
      setRevisoes(undefined);
      setPontosRh(undefined);
      return;
    }

    const carregarBadges = () => {
      frotaApi
        .listar(prefeituraId)
        .then((lista) => {
          if (!vivo) return;
          const n = lista.filter(isVencido).length;
          setRevisoes(n > 0 ? n : undefined);
        })
        .catch(() => {});

      if (pontoAtivo) {
        pontosApi
          .listar(prefeituraId)
          .then((lista) => {
            if (!vivo) return;
            const n = lista.filter(
              (p) => (p.status ?? "pendente") === "pendente",
            ).length;
            setPontosRh(n > 0 ? n : undefined);
          })
          .catch(() => {});
      } else {
        setPontosRh(undefined);
      }
    };

    const onRevisaoAtualizada = (event: Event) => {
      const detail = (event as CustomEvent<{ prefeituraId?: string }>).detail;
      if (detail?.prefeituraId && detail.prefeituraId !== prefeituraId) return;
      carregarBadges();
    };

    carregarBadges();
    window.addEventListener(
      "hu360:frota-revisao-atualizada",
      onRevisaoAtualizada,
    );

    return () => {
      vivo = false;
      window.removeEventListener(
        "hu360:frota-revisao-atualizada",
        onRevisaoAtualizada,
      );
    };
  }, [prefeituraId, pontoAtivo]);

  return { revisoes, pontosRh };
}
