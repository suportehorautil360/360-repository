import { X } from "lucide-react";

export type PainelGeralOs =
  | "insumos"
  | "etapas"
  | "sintomas"
  | "ocorrencias";

interface InsumoRow {
  produto: string;
  descricao: string;
  qtd: number;
  unid: string;
  vlrUnit: number;
  total: number;
}

interface EtapaRow {
  seq: string;
  descricao: string;
  tecnico: string;
  inicioPrevisto: string;
  status: string;
  statusCls: "pendente" | "aguardando";
}

interface SintomaRow {
  cod: string;
  descricao: string;
  observacao: string;
}

interface OcorrenciaRow {
  id: string;
  dataHora: string;
  usuario: string;
  mensagem: string;
}

const INSUMOS_MOCK: InsumoRow[] = [
  {
    produto: "00125",
    descricao: "Anel O-Ring Viton",
    qtd: 2,
    unid: "UN",
    vlrUnit: 15,
    total: 30,
  },
  {
    produto: "00489",
    descricao: "Óleo Hidráulico 68",
    qtd: 20,
    unid: "L",
    vlrUnit: 22,
    total: 440,
  },
];

const ETAPAS_MOCK: EtapaRow[] = [
  {
    seq: "01",
    descricao: "Desmontagem do Cilindro",
    tecnico: "Mec. João",
    inicioPrevisto: "08/06/2026",
    status: "Pendente",
    statusCls: "pendente",
  },
  {
    seq: "02",
    descricao: "Troca de Vedação",
    tecnico: "Mec. João",
    inicioPrevisto: "09/06/2026",
    status: "Aguardando",
    statusCls: "aguardando",
  },
];

const SINTOMAS_MOCK: SintomaRow[] = [
  {
    cod: "S02",
    descricao: "Vazamento de fluido",
    observacao: "Poça de óleo sob o braço da escavadeira.",
  },
  {
    cod: "S15",
    descricao: "Perda de pressão",
    observacao: "Braço operando com lentidão.",
  },
];

const OCORRENCIAS_MOCK: OcorrenciaRow[] = [
  {
    id: "1",
    dataHora: "08/06/2026 14:00",
    usuario: "ADM",
    mensagem: "Aguardando chegada do kit de vedações da filial 02.",
  },
  {
    id: "2",
    dataHora: "08/06/2026 10:00",
    usuario: "MEC_JOAO",
    mensagem: "Máquina lavada e pronta para início da inspeção.",
  },
];

const PAINEL_META: Record<
  PainelGeralOs,
  { titulo: string; icone: string }
> = {
  insumos: { titulo: "Insumos (peças e materiais)", icone: "📦" },
  etapas: { titulo: "Etapas da manutenção", icone: "⏳" },
  sintomas: { titulo: "Sintomas e diagnóstico", icone: "🔍" },
  ocorrencias: { titulo: "Histórico de ocorrências", icone: "📄" },
};

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtQtd(v: number): string {
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

interface AbrirOsPainelGeralProps {
  painel: PainelGeralOs;
  onFechar: () => void;
}

export function AbrirOsPainelGeral({
  painel,
  onFechar,
}: AbrirOsPainelGeralProps) {
  const meta = PAINEL_META[painel];

  return (
    <div className="aos-painel">
      <div className="aos-painel__head">
        <h3 className="aos-painel__title">
          <span className="aos-painel__title-icon" aria-hidden>
            {meta.icone}
          </span>
          {meta.titulo}
        </h3>
        <button
          type="button"
          className="aos-painel__close"
          onClick={onFechar}
          aria-label="Fechar painel"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      {painel === "insumos" ? (
        <div className="aos-painel-table-scroll">
          <table className="aos-painel-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Descrição</th>
                <th>Qtd</th>
                <th>Unid</th>
                <th>Vlr. unit</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {INSUMOS_MOCK.map((r) => (
                <tr key={r.produto}>
                  <td className="aos-painel-col-cod">{r.produto}</td>
                  <td>{r.descricao}</td>
                  <td>{fmtQtd(r.qtd)}</td>
                  <td className="aos-painel-col-unid">{r.unid}</td>
                  <td>{fmtBRL(r.vlrUnit)}</td>
                  <td className="aos-painel-col-total">{fmtBRL(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : painel === "etapas" ? (
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
              {ETAPAS_MOCK.map((r) => (
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
              ))}
            </tbody>
          </table>
        </div>
      ) : painel === "sintomas" ? (
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
              {SINTOMAS_MOCK.map((r) => (
                <tr key={r.cod}>
                  <td className="aos-painel-col-cod">{r.cod}</td>
                  <td>{r.descricao}</td>
                  <td className="aos-painel-col-obs">{r.observacao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : painel === "ocorrencias" ? (
        <ul className="aos-painel-log">
          {OCORRENCIAS_MOCK.map((r) => (
            <li key={r.id} className="aos-painel-log__item">
              <p className="aos-painel-log__meta">
                {r.dataHora} – Usuário: {r.usuario}
              </p>
              <p className="aos-painel-log__msg">{r.mensagem}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
