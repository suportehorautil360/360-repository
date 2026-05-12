import { useMemo, useState } from "react";
import { ListaChecklistHistoricoLocal } from "../../../components/checklistHistorico/ChecklistHistoricoLista";
import { checklistAppToHistoricoRow } from "../../../components/checklistHistorico/checklistAppToHistoricoRow";
import type { DadosPrefeitura } from "../../../lib/hu360";

interface AuditoriaSectionProps {
  dados: DadosPrefeitura;
}

export function AuditoriaSection({ dados }: AuditoriaSectionProps) {
  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const out: Record<string, unknown>[] = [];
    dados.auditoria.forEach((a, i) => {
      const c = a.checklistApp;
      if (!c) return;
      const id = `pf-aud-${i}`;
      const statusResumo = `${a.indice} · ${a.fotos} fotos${a.alerta ? " · alerta" : ""}`;
      out.push(
        checklistAppToHistoricoRow(id, c, {
          dataHora: a.hora,
          operador: a.operador,
          equipamento: a.equipamento,
          chassis: a.chassis?.trim() || undefined,
          statusResumo,
        }),
      );
    });
    return out;
  }, [dados.auditoria]);

  return (
    <>
      <h1>Auditoria de Qualidade dos Checklists</h1>
      <p style={{ color: "var(--text-gray)", marginBottom: 16, lineHeight: 1.55, maxWidth: "52rem" }}>
        Mesma visualização do painel operacional: expanda cada registro para ver horímetro,
        observações e itens com <strong>Sim</strong> ou <strong>Não</strong> (com detalhe quando
        aplicável).
      </p>
      <div className="card" style={{ marginTop: 8 }}>
        <div className="hu360-dash-checklists-panel" style={{ marginTop: 0, maxWidth: "100%" }}>
          <div className="hu360-dash-checklists-panel__head">
            <h3 className="hu360-dash-checklists-panel__title">Registros auditados</h3>
          </div>
          <ListaChecklistHistoricoLocal
            rows={rows}
            expandidoId={expandidoId}
            setExpandidoId={setExpandidoId}
            mensagemVazia="Nenhum checklist auditado."
          />
        </div>
      </div>
    </>
  );
}
