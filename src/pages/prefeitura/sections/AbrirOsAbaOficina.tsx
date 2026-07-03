import { useEffect, useMemo, useState } from "react";
import { clientesApi } from "../../../lib/api/clientes";
import { fmtClassificacao } from "./abrir-os-model";
import type { EquipRow } from "./equipamentos/equipamentos-api";
import {
  filtrarOficinasElegiveis,
  labelSegmento,
  linhaDoEquipamento,
  resolveSegmentoEquipamento,
} from "./direcionamento-os";

interface AbrirOsAbaOficinaProps {
  prefeituraId: string;
  equipamento: EquipRow | null;
}

export function AbrirOsAbaOficina({
  prefeituraId,
  equipamento,
}: AbrirOsAbaOficinaProps) {
  const [oficinas, setOficinas] = useState<
    Array<{
      id: string;
      nome: string;
      especialidade: string;
      segmentosAtuacao?: string[];
    }>
  >([]);
  const [carregando, setCarregando] = useState(false);

  const linhaEquipamento = equipamento ? linhaDoEquipamento(equipamento) : "";
  const segmento = equipamento ? resolveSegmentoEquipamento(equipamento) : "";
  const linhaFmt = linhaEquipamento.trim()
    ? fmtClassificacao(linhaEquipamento)
    : "";

  useEffect(() => {
    if (!prefeituraId) return;
    let vivo = true;
    setCarregando(true);
    clientesApi
      .listarOficinasCredenciadas(prefeituraId)
      .then((lista) => {
        if (!vivo) return;
        setOficinas(
          lista
            .filter((o) => o.status === "Ativa")
            .map((o) => ({
              id: o.id,
              nome: o.nome,
              especialidade: o.especialidade,
              linhasAtuacao: o.linhasAtuacao,
              segmentosAtuacao: o.segmentosAtuacao,
            })),
        );
      })
      .catch(() => {
        if (vivo) setOficinas([]);
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [prefeituraId]);

  const oficinasElegiveis = useMemo(() => {
    if (!linhaEquipamento.trim()) return [];
    return filtrarOficinasElegiveis(
      oficinas,
      linhaEquipamento,
      segmento || undefined,
    );
  }, [oficinas, linhaEquipamento, segmento]);

  return (
    <div className="aos-oficina">
      <h2 className="aos-oficina__title">
        <span className="aos-oficina__title-icon" aria-hidden>
          🏭
        </span>
        Direcionamento de oficinas
      </h2>

      <div className="aos-oficina__grid">
        <div className="aos-field">
          <label>Linha do equipamento</label>
          <input
            type="text"
            readOnly
            value={linhaFmt}
            placeholder="Selecione o bem na aba Geral"
          />
        </div>
        <div className="aos-field">
          <label>Segmento identificado</label>
          <input
            type="text"
            readOnly
            value={equipamento ? labelSegmento(segmento) : ""}
            placeholder="Selecione o bem na aba Geral"
          />
        </div>
      </div>

      <div className="aos-oficina__pool">
        <div className="aos-oficina__pool-header">
          <h3>Oficinas compatíveis</h3>
          {!carregando && linhaEquipamento.trim() ? (
            <span className="aos-oficina__pool-badge">
              {oficinasElegiveis.length === 0
                ? "Nenhuma"
                : `${oficinasElegiveis.length} convite${oficinasElegiveis.length === 1 ? "" : "s"}`}
            </span>
          ) : null}
        </div>

        {carregando ? (
          <p className="aos-oficina__pool-empty">Carregando oficinas…</p>
        ) : !linhaEquipamento.trim() ? (
          <p className="aos-oficina__pool-empty">
            Selecione um equipamento na aba Geral para ver o funil de
            direcionamento.
          </p>
        ) : oficinasElegiveis.length === 0 ? (
          <p className="aos-oficina__pool-empty aos-oficina__pool-empty--warn">
            Nenhuma oficina credenciada atende
            {segmento ? ` o segmento "${segmento}"` : ""} e a linha "
            {linhaFmt}". Revise o cadastro das oficinas ou a classificação do
            equipamento antes de salvar.
          </p>
        ) : (
          <ul className="aos-oficina__pool-list">
            {oficinasElegiveis.map((o) => (
              <li key={o.id} className="aos-oficina__pool-item">
                <span className="aos-oficina__pool-nome">{o.nome}</span>
                <span className="aos-oficina__pool-meta">
                  {o.linhasAtuacao?.length
                    ? o.linhasAtuacao.join(", ")
                    : o.especialidade}
                  {o.segmentosAtuacao?.length
                    ? ` · ${o.segmentosAtuacao.join(", ")}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="aos-oficina__regra" role="note">
        <span className="aos-oficina__regra-icon" aria-hidden>
          💡
        </span>
        <p>
          <strong>Regra de negócio:</strong> ao salvar, o sistema convida
          automaticamente <strong>todas as oficinas compatíveis</strong> (segmento
          + linha) para enviar orçamento no pregão.
        </p>
      </div>
    </div>
  );
}
