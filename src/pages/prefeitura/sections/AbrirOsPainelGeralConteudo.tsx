import { useCallback, useEffect, useState } from "react";
import type { PainelGeralOs } from "./abrir-os-paineis-dados";
import {
  ETAPAS_MOCK,
  fmtBRLPainel,
  fmtQtdPainel,
  INSUMOS_MOCK,
  OCORRENCIAS_MOCK,
  SINTOMAS_MOCK,
} from "./abrir-os-paineis-dados";
import { insumosApi, type InsumoListItem } from "../../../lib/api/insumos";
import { ocorrenciasApi, type OcorrenciaListItem } from "../../../lib/api/ocorrencias";
import { ApiError } from "../../../lib/api/client";

interface AbrirOsPainelGeralConteudoProps {
  painel: PainelGeralOs;
  solicitacaoOsId?: string;
}

function fmtCodigoInsumo(r: InsumoListItem): string {
  const codigo = (r.codigo ?? r.code ?? "").trim();
  return codigo || "—";
}

function InsumosPainel({ solicitacaoOsId }: { solicitacaoOsId?: string }) {
  const [linhas, setLinhas] = useState<InsumoListItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [valorTotal, setValorTotal] = useState(0);

  const id = solicitacaoOsId?.trim() ?? "";

  const carregar = useCallback(async () => {
    if (!id) {
      setLinhas([]);
      setInfo(null);
      setValorTotal(0);
      return;
    }

    setCarregando(true);
    setErro(null);
    try {
      const resp = await insumosApi.listarPorSolicitacao(id);
      setLinhas(resp.data);
      setInfo(resp.message);
      setValorTotal(resp.resumo.valorTotal);
    } catch (err) {
      setLinhas([]);
      setInfo(null);
      setValorTotal(0);
      if (err instanceof ApiError) {
        setErro(
          err.status === 404
            ? "O.S. não encontrada no servidor — recarregue a lista e abra novamente."
            : err.message,
        );
      } else {
        setErro("Não foi possível carregar os insumos desta O.S.");
      }
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="aos-painel-table-scroll">
      <table className="aos-painel-table">
        <thead>
          <tr>
            <th>Código</th>
            <th>Peça / material</th>
            <th>Marca</th>
            <th>Qtd</th>
            <th>Unid</th>
            <th>Vlr. unit</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {!id ? (
            <tr>
              <td colSpan={7} className="aos-painel-empty">
                Abra o detalhe de uma O.S. para consultar insumos do orçamento.
              </td>
            </tr>
          ) : carregando ? (
            <tr>
              <td colSpan={7} className="aos-painel-empty">
                Carregando insumos…
              </td>
            </tr>
          ) : erro ? (
            <tr>
              <td colSpan={7} className="aos-painel-empty aos-painel-empty--erro">
                {erro}
              </td>
            </tr>
          ) : linhas.length === 0 ? (
            <tr>
              <td colSpan={7} className="aos-painel-empty">
                {info ??
                  "Nenhum insumo no orçamento desta O.S."}
              </td>
            </tr>
          ) : (
            linhas.map((r) => (
              <tr key={r.id}>
                <td className="aos-painel-col-cod">
                  {fmtCodigoInsumo(r)}
                </td>
                <td className="aos-painel-col-peca">{r.descricao}</td>
                <td>{r.marca || "—"}</td>
                <td>{fmtQtdPainel(r.qtd)}</td>
                <td className="aos-painel-col-unid">{r.unid}</td>
                <td>{r.vlrUnit > 0 ? fmtBRLPainel(r.vlrUnit) : "—"}</td>
                <td className="aos-painel-col-total">
                  {r.total > 0 ? fmtBRLPainel(r.total) : "—"}
                </td>
              </tr>
            ))
          )}
        </tbody>
        {linhas.length > 0 && valorTotal > 0 ? (
          <tfoot>
            <tr>
              <td colSpan={5} className="aos-painel-foot-label">
                Total estimado
              </td>
              <td className="aos-painel-col-total aos-painel-foot-total">
                {fmtBRLPainel(valorTotal)}
              </td>
              <td />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

function OcorrenciasPainel({ solicitacaoOsId }: { solicitacaoOsId?: string }) {
  const [linhas, setLinhas] = useState<OcorrenciaListItem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const id = solicitacaoOsId?.trim() ?? "";

  const carregar = useCallback(async () => {
    if (!id) {
      setLinhas([]);
      setInfo(null);
      return;
    }

    setCarregando(true);
    setErro(null);
    try {
      const resp = await ocorrenciasApi.listarPorSolicitacao(id);
      setLinhas(resp.data);
      setInfo(resp.message);
    } catch (err) {
      setLinhas([]);
      setInfo(null);
      if (err instanceof ApiError) {
        setErro(
          err.status === 404
            ? "O.S. não encontrada no servidor — recarregue a lista e abra novamente."
            : err.message,
        );
      } else {
        setErro("Não foi possível carregar o histórico desta O.S.");
      }
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <ul className="aos-painel-log">
      {!id ? (
        <li className="aos-painel-empty">
          Abra o detalhe de uma O.S. para consultar o histórico.
        </li>
      ) : carregando ? (
        <li className="aos-painel-empty">Carregando histórico…</li>
      ) : erro ? (
        <li className="aos-painel-empty aos-painel-empty--erro">{erro}</li>
      ) : linhas.length === 0 ? (
        <li className="aos-painel-empty">
          {info ?? "Nenhuma ocorrência registrada."}
        </li>
      ) : (
        linhas.map((r) => (
          <li key={r.id} className="aos-painel-log__item">
            <p className="aos-painel-log__meta">
              {r.dataHora} – Usuário: {r.usuario}
            </p>
            <p className="aos-painel-log__msg">{r.mensagem}</p>
          </li>
        ))
      )}
    </ul>
  );
}

export function AbrirOsPainelGeralConteudo({
  painel,
  solicitacaoOsId,
}: AbrirOsPainelGeralConteudoProps) {
  if (painel === "insumos") {
    if (solicitacaoOsId) {
      return <InsumosPainel solicitacaoOsId={solicitacaoOsId} />;
    }

    return (
      <div className="aos-painel-table-scroll">
        <table className="aos-painel-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Peça / material</th>
              <th>Marca</th>
              <th>Qtd</th>
              <th>Unid</th>
              <th>Vlr. unit</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {INSUMOS_MOCK.length === 0 ? (
              <tr>
                <td colSpan={7} className="aos-painel-empty">
                  Nenhum insumo registrado nesta O.S.
                </td>
              </tr>
            ) : (
              INSUMOS_MOCK.map((r) => (
                <tr key={r.produto}>
                  <td className="aos-painel-col-cod">{r.produto || "—"}</td>
                  <td className="aos-painel-col-peca">{r.descricao}</td>
                  <td>—</td>
                  <td>{fmtQtdPainel(r.qtd)}</td>
                  <td className="aos-painel-col-unid">{r.unid}</td>
                  <td>{fmtBRLPainel(r.vlrUnit)}</td>
                  <td className="aos-painel-col-total">
                    {fmtBRLPainel(r.total)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (painel === "etapas") {
    return (
      <div className="aos-painel-table-scroll">
        <table className="aos-painel-table">
          <thead>
            <tr>
              <th>Seq</th>
              <th>Descrição etapa</th>
              <th>Técnico</th>
              <th>Início previsto</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {ETAPAS_MOCK.length === 0 ? (
              <tr>
                <td colSpan={5} className="aos-painel-empty">
                  Nenhuma etapa registrada nesta O.S.
                </td>
              </tr>
            ) : (
              ETAPAS_MOCK.map((r) => (
                <tr key={r.seq}>
                  <td className="aos-painel-col-cod">{r.seq}</td>
                  <td>{r.descricao}</td>
                  <td>{r.tecnico}</td>
                  <td>{r.inicioPrevisto}</td>
                  <td>
                    <span
                      className={`aos-painel-status aos-painel-status--${r.statusCls}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (painel === "sintomas") {
    return (
      <div className="aos-painel-table-scroll">
        <table className="aos-painel-table">
          <thead>
            <tr>
              <th>Cód</th>
              <th>Descrição do sintoma</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            {SINTOMAS_MOCK.length === 0 ? (
              <tr>
                <td colSpan={3} className="aos-painel-empty">
                  Nenhum sintoma registrado nesta O.S.
                </td>
              </tr>
            ) : (
              SINTOMAS_MOCK.map((r) => (
                <tr key={r.cod}>
                  <td className="aos-painel-col-cod">{r.cod}</td>
                  <td>{r.descricao}</td>
                  <td className="aos-painel-col-obs">{r.observacao}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  if (painel === "ocorrencias") {
    if (solicitacaoOsId) {
      return <OcorrenciasPainel solicitacaoOsId={solicitacaoOsId} />;
    }

    return (
      <ul className="aos-painel-log">
        {OCORRENCIAS_MOCK.length === 0 ? (
          <li className="aos-painel-empty">Nenhuma ocorrência registrada.</li>
        ) : (
          OCORRENCIAS_MOCK.map((r) => (
            <li key={r.id} className="aos-painel-log__item">
              <p className="aos-painel-log__meta">
                {r.dataHora} – Usuário: {r.usuario}
              </p>
              <p className="aos-painel-log__msg">{r.mensagem}</p>
            </li>
          ))
        )}
      </ul>
    );
  }

  return null;
}
