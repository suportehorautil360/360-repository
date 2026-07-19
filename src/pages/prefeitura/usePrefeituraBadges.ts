import { useCallback, useEffect, useState } from "react";
import { checklistDevolucaoApi } from "../../lib/api/checklist-devolucao";
import { notificacoesApi } from "../../lib/api/notificacoes";
import { EVENTO_NOTIFICACOES } from "../../components/Notificacoes/DrawerNotificacoes";
import { frotaApi } from "./sections/frota/frota-api";
import { isVencido } from "./sections/frota/types";
import { pontosApi } from "../../lib/api/pontos";
import { contarChdsAuditoriaNaoVistos } from "./auditoria-devolucao-vistos";
import type { PrefeituraNavBadges } from "./prefeituraNav";

/**
 * Contagens dinâmicas para os badges da sidebar da prefeitura:
 * Revisões = veículos da frota vencidos; Pontos (RH) = batidas pendentes;
 * Auditoria de Devolução = CHDs novos ainda não conferidos;
 * Orçamentos = notificações de orçamento não lidas.
 * Retorna `undefined` quando zero (para não exibir badge "0").
 */
export function usePrefeituraBadges(
  prefeituraId: string | undefined,
  pontoAtivo: boolean,
  manutencaoAtivo: boolean,
): PrefeituraNavBadges {
  const [revisoes, setRevisoes] = useState<number | undefined>(undefined);
  const [pontosRh, setPontosRh] = useState<number | undefined>(undefined);
  const [auditoriaDevolucao, setAuditoriaDevolucao] = useState<
    number | undefined
  >(undefined);
  const [orcamentos, setOrcamentos] = useState<number | undefined>(undefined);

  const carregarBadges = useCallback(() => {
    if (!prefeituraId) {
      setRevisoes(undefined);
      setPontosRh(undefined);
      setAuditoriaDevolucao(undefined);
      setOrcamentos(undefined);
      return;
    }

    frotaApi
      .listar(prefeituraId)
      .then((lista) => {
        const n = lista.filter(isVencido).length;
        setRevisoes(n > 0 ? n : undefined);
      })
      .catch(() => {});

    if (pontoAtivo) {
      pontosApi
        .listar(prefeituraId)
        .then((lista) => {
          const n = lista.filter(
            (p) => (p.status ?? "pendente") === "pendente",
          ).length;
          setPontosRh(n > 0 ? n : undefined);
        })
        .catch(() => {});
    } else {
      setPontosRh(undefined);
    }

    if (manutencaoAtivo) {
      checklistDevolucaoApi
        .listarPorPrefeitura(prefeituraId)
        .then((lista) => {
          const ids = lista.map((doc) => doc.id);
          const n = contarChdsAuditoriaNaoVistos(prefeituraId, ids);
          setAuditoriaDevolucao(n > 0 ? n : undefined);
        })
        .catch(() => {
          setAuditoriaDevolucao(undefined);
        });

      notificacoesApi
        .listar("rh", prefeituraId)
        .then((lista) => {
          const n = lista.filter(
            (notif) =>
              !notif.lida && notif.referenciaTipo === "orcamento",
          ).length;
          setOrcamentos(n > 0 ? n : undefined);
        })
        .catch(() => {
          setOrcamentos(undefined);
        });
    } else {
      setAuditoriaDevolucao(undefined);
      setOrcamentos(undefined);
    }
  }, [prefeituraId, pontoAtivo, manutencaoAtivo]);

  useEffect(() => {
    carregarBadges();

    const onRevisaoAtualizada = (event: Event) => {
      const detail = (event as CustomEvent<{ prefeituraId?: string }>).detail;
      if (detail?.prefeituraId && detail.prefeituraId !== prefeituraId) return;
      carregarBadges();
    };

    const onChdVistosAtualizado = (event: Event) => {
      const detail = (event as CustomEvent<{ prefeituraId?: string }>).detail;
      if (detail?.prefeituraId && detail.prefeituraId !== prefeituraId) return;
      carregarBadges();
    };

    const onNotificacoesAtualizadas = (event: Event) => {
      const detail = (event as CustomEvent<{ prefeituraId?: string }>).detail;
      if (detail?.prefeituraId && detail.prefeituraId !== prefeituraId) return;
      carregarBadges();
    };

    window.addEventListener(
      "hu360:frota-revisao-atualizada",
      onRevisaoAtualizada,
    );
    window.addEventListener(
      "hu360:chd-auditoria-vistos",
      onChdVistosAtualizado,
    );
    window.addEventListener(EVENTO_NOTIFICACOES, onNotificacoesAtualizadas);

    const pollId = setInterval(carregarBadges, 60_000);

    return () => {
      window.removeEventListener(
        "hu360:frota-revisao-atualizada",
        onRevisaoAtualizada,
      );
      window.removeEventListener(
        "hu360:chd-auditoria-vistos",
        onChdVistosAtualizado,
      );
      window.removeEventListener(
        EVENTO_NOTIFICACOES,
        onNotificacoesAtualizadas,
      );
      clearInterval(pollId);
    };
  }, [carregarBadges, prefeituraId]);

  return { revisoes, pontosRh, auditoriaDevolucao, orcamentos };
}
