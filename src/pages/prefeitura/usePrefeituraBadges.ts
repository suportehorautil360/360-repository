import { useEffect, useState } from "react";
import { suporteApi } from "../../lib/api/suporte";
import { frotaApi } from "./sections/frota/frota-api";
import { isVencido } from "./sections/frota/types";
import { pontosApi } from "../../lib/api/pontos";
import type { PrefeituraNavBadges } from "./prefeituraNav";

const POLL_INBOX_MS = 30_000;

/** Dispara após ler/responder no inbox para atualizar o badge da sidebar. */
export function notificarInboxSuporteAtualizado(prefeituraId: string) {
  window.dispatchEvent(
    new CustomEvent("hu360:suporte-inbox-atualizado", {
      detail: { prefeituraId },
    }),
  );
}

/**
 * Contagens dinâmicas para os badges da sidebar da prefeitura:
 * Revisões = veículos da frota vencidos; Pontos (RH) = batidas pendentes;
 * Mensagens dos Postos = threads com mensagens do operador não lidas.
 * Retorna `undefined` quando zero (para não exibir badge "0").
 */
export function usePrefeituraBadges(
  prefeituraId: string | undefined,
  pontoAtivo: boolean,
  abastecimentoAtivo: boolean,
): PrefeituraNavBadges {
  const [revisoes, setRevisoes] = useState<number | undefined>(undefined);
  const [pontosRh, setPontosRh] = useState<number | undefined>(undefined);
  const [mensagensPostos, setMensagensPostos] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    let vivo = true;
    if (!prefeituraId) {
      setRevisoes(undefined);
      setPontosRh(undefined);
      setMensagensPostos(undefined);
      return;
    }

    const carregarInbox = () => {
      if (!abastecimentoAtivo) {
        setMensagensPostos(undefined);
        return;
      }
      suporteApi
        .contarPendentes(prefeituraId)
        .then((n) => {
          if (!vivo) return;
          setMensagensPostos(n > 0 ? n : undefined);
        })
        .catch(() => {});
    };

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

      carregarInbox();
    };

    const onRevisaoAtualizada = (event: Event) => {
      const detail = (event as CustomEvent<{ prefeituraId?: string }>).detail;
      if (detail?.prefeituraId && detail.prefeituraId !== prefeituraId) return;
      carregarBadges();
    };

    const onInboxAtualizado = (event: Event) => {
      const detail = (event as CustomEvent<{ prefeituraId?: string }>).detail;
      if (detail?.prefeituraId && detail.prefeituraId !== prefeituraId) return;
      carregarInbox();
    };

    carregarBadges();
    const pollId = setInterval(carregarInbox, POLL_INBOX_MS);
    window.addEventListener(
      "hu360:frota-revisao-atualizada",
      onRevisaoAtualizada,
    );
    window.addEventListener(
      "hu360:suporte-inbox-atualizado",
      onInboxAtualizado,
    );

    return () => {
      vivo = false;
      clearInterval(pollId);
      window.removeEventListener(
        "hu360:frota-revisao-atualizada",
        onRevisaoAtualizada,
      );
      window.removeEventListener(
        "hu360:suporte-inbox-atualizado",
        onInboxAtualizado,
      );
    };
  }, [prefeituraId, pontoAtivo, abastecimentoAtivo]);

  return { revisoes, pontosRh, mensagensPostos };
}
