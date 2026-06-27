import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { osOrcamentosAprovacoesApi } from "../../../lib/api/os-orcamentos-aprovacoes";
import {
  fmtBRL,
  statusOrdem,
  type OrdemOrcamento,
} from "./orcamentos-aprovacoes-model";
import "./orcamentos-aprovacoes.css";
import type { SolicitacaoOS } from "./abrir-os-model";
import {
  fmtClassificacao,
  fmtDataAgendamento,
  fmtDataOs,
  fmtTipoOs,
  statusBadgeOs,
  totalOficinasConvidadas,
} from "./abrir-os-model";
import { AbrirOsDetalheAbas } from "./AbrirOsDetalheAbas";

interface AbrirOsDetalhePageProps {
  prefeituraId: string;
  os: SolicitacaoOS;
  onVoltar: () => void;
}

function CampoDetalhe({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`aos-detalhe__campo${wide ? " aos-detalhe__campo--wide" : ""}`}>
      <span className="aos-detalhe__label">{label}</span>
      <div className="aos-detalhe__valor">{children}</div>
    </div>
  );
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section className="aos-detalhe__secao">
      <h2 className="aos-detalhe__secao-titulo">{titulo}</h2>
      {children}
    </section>
  );
}

export function AbrirOsDetalhePage({
  prefeituraId,
  os,
  onVoltar,
}: AbrirOsDetalhePageProps) {
  const [ordens, setOrdens] = useState<OrdemOrcamento[]>([]);
  const [carregandoOrcamentos, setCarregandoOrcamentos] = useState(true);
  const [erroOrcamentos, setErroOrcamentos] = useState<string | null>(null);

  const st = statusBadgeOs(os.status);
  const relato = os.relato?.trim() || "—";
  const convidadas = totalOficinasConvidadas(os);
  const responderam = os.oficinasResponderam?.length ?? 0;

  const carregarOrcamentos = useCallback(async () => {
    if (!prefeituraId) {
      setOrdens([]);
      setCarregandoOrcamentos(false);
      return;
    }
    setCarregandoOrcamentos(true);
    setErroOrcamentos(null);
    try {
      const cards = await osOrcamentosAprovacoesApi.listarCards(prefeituraId);
      const card = cards.find((c) => c.solicitacao.id === os.id);
      setOrdens(card?.ordens ?? []);
    } catch {
      setOrdens([]);
      setErroOrcamentos("Não foi possível carregar os orçamentos desta O.S.");
    } finally {
      setCarregandoOrcamentos(false);
    }
  }, [prefeituraId, os.id]);

  useEffect(() => {
    void carregarOrcamentos();
  }, [carregarOrcamentos]);

  const oficinasLista = (() => {
    const nomes = os.oficinas?.filter(Boolean) ?? [];
    const ids = os.oficinasIds ?? [];
    const respondidas = new Set(os.oficinasResponderam ?? []);

    if (nomes.length > 0) {
      return nomes.map((nome, i) => {
        const id = ids[i];
        const respondeu = id ? respondidas.has(id) : false;
        return { key: id ?? nome, nome, respondeu };
      });
    }

    if (ids.length > 0) {
      return ids.map((id) => ({
        key: id,
        nome: id,
        respondeu: respondidas.has(id),
      }));
    }

    return [];
  })();

  return (
    <div className="aos-detalhe">
      <header className="aos-detalhe__topo">
        <button type="button" className="aos-detalhe__voltar" onClick={onVoltar}>
          <ArrowLeft size={14} aria-hidden="true" />
          Voltar
        </button>
        <div className="aos-detalhe__head-id">
          <p className="aos-detalhe__kicker">Ordem de serviço</p>
          <div className="aos-detalhe__titulo-row">
            <h1 className="aos-detalhe__titulo">{os.protocolo || "—"}</h1>
            <span className={`aos-status ${st.cls}`}>{st.label}</span>
          </div>
        </div>
      </header>

      <AbrirOsDetalheAbas
        os={os}
        resumo={
          <>
            <Secao titulo="Informações gerais">
        <div className="aos-detalhe__grid">
          <CampoDetalhe label="Tipo de O.S.">
            {fmtTipoOs(os.serviceType, os.serviceTypeLabel)}
          </CampoDetalhe>
          <CampoDetalhe label="Data de abertura">
            {fmtDataOs(os.criadoEm)}
          </CampoDetalhe>
          <CampoDetalhe label="Data agendada">
            {fmtDataAgendamento(os.dataAgendamento)}
          </CampoDetalhe>
          {os.cicloId ? (
            <CampoDetalhe label="Ciclo preventivo">
              {os.cicloId}
            </CampoDetalhe>
          ) : null}
        </div>
      </Secao>

      <Secao titulo="Equipamento">
        <div className="aos-detalhe__grid">
          <CampoDetalhe label="Equipamento" wide>
            {os.equipamento || "—"}
          </CampoDetalhe>
          <CampoDetalhe label="Classificação / linha">
            {fmtClassificacao(os.linha)}
          </CampoDetalhe>
          <CampoDetalhe label="Horímetro / medição">
            {os.horimetro?.trim() || "—"}
          </CampoDetalhe>
        </div>
      </Secao>

      <Secao titulo="Solicitação">
        <div className="aos-detalhe__grid">
          <CampoDetalhe label="Operador solicitante">
            {os.operador || "—"}
          </CampoDetalhe>
        </div>
        <div className="aos-detalhe__bloco-texto">
          <span className="aos-detalhe__label">Descrição / relato</span>
          <div className="aos-detalhe__texto">{relato}</div>
        </div>
      </Secao>

      <Secao titulo="Oficinas convidadas">
        <div className="aos-detalhe__resumo-oficinas">
          <span>
            {responderam}/{convidadas || oficinasLista.length || "—"}{" "}
            orçamento(s) recebido(s)
          </span>
        </div>
        {oficinasLista.length === 0 ? (
          <p className="aos-detalhe__vazio">
            Nenhuma oficina vinculada a esta O.S.
          </p>
        ) : (
          <ul className="aos-detalhe__oficinas">
            {oficinasLista.map((o) => (
              <li key={o.key} className="aos-detalhe__oficina">
                <span className="aos-detalhe__oficina-nome">{o.nome}</span>
                <span
                  className={`aos-detalhe__oficina-status${
                    o.respondeu ? " is-respondeu" : ""
                  }`}
                >
                  {o.respondeu ? "Orçamento enviado" : "Aguardando orçamento"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      <Secao titulo="Orçamentos recebidos">
        {erroOrcamentos ? (
          <p className="aos-detalhe__erro">{erroOrcamentos}</p>
        ) : null}
        {carregandoOrcamentos ? (
          <p className="aos-detalhe__vazio">Carregando orçamentos…</p>
        ) : ordens.length === 0 ? (
          <p className="aos-detalhe__vazio">
            Nenhum orçamento enviado pelas oficinas ainda.
          </p>
        ) : (
          <div className="aos-detalhe-table-scroll">
            <table className="aos-detalhe-table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Oficina</th>
                  <th>Valor total</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {ordens.map((ord) => {
                  const osSt = statusOrdem(ord.status);
                  return (
                    <tr key={ord.id}>
                      <td className="aos-detalhe-col-os">
                        {ord.protocolo || "—"}
                      </td>
                      <td>
                        {ord.oficinaNome ?? ord.operador ?? "—"}
                      </td>
                      <td className="aos-detalhe-col-valor">
                        {fmtBRL(ord.valorTotal)}
                      </td>
                      <td>
                        <span className={`oap-ordem ${osSt.cls}`}>
                          {osSt.label}
                        </span>
                      </td>
                      <td>{fmtDataOs(ord.criadoEm)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
          </>
        }
      />

      <footer className="aos-detalhe__foot">
        <button
          type="button"
          className="aos-btn aos-btn--outline"
          onClick={onVoltar}
        >
          Voltar para lista
        </button>
      </footer>
    </div>
  );
}
