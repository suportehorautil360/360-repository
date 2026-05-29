import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Paperclip,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  type LucideIcon,
} from "lucide-react";
import {
  solicitacoesPontoApi,
  type SolicitacaoPonto,
  type StatusSolicitacao,
  type TipoSolicitacao,
} from "../../lib/api/solicitacoes-ponto";
import { limparCpf } from "../../lib/funcionarios/cpf";
import "./minhas-solicitacoes.css";

const TIPO_LABEL: Record<TipoSolicitacao, string> = {
  incluir: "Incluir batida",
  cancelar: "Cancelar batida",
  abono: "Solicitar abono",
  mensagem: "Mensagem ao gestor",
};

const STATUS_LABEL: Record<StatusSolicitacao, string> = {
  pendente: "Pendente",
  aprovado: "Aprovada",
  reprovado: "Reprovada",
};

const STATUS_ICONE: Record<StatusSolicitacao, LucideIcon> = {
  pendente: Clock,
  aprovado: CheckCircle2,
  reprovado: XCircle,
};

interface Props {
  prefeituraId: string;
  /** CPF do operador (limpo). Usado para casar com a solicitação. */
  cpf?: string;
  /** Nome do operador — fallback de match quando a solicitação não tem CPF. */
  nome: string;
  onVoltar: () => void;
}

function fmtData(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function fmtDataHora(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDiaIso(diaIso: string | null | undefined): string {
  if (!diaIso) return "—";
  const [y, m, d] = diaIso.split("-");
  if (!y || !m || !d) return diaIso;
  return `${d}/${m}/${y}`;
}

export function MinhasSolicitacoes({ prefeituraId, cpf, nome, onVoltar }: Props) {
  const [lista, setLista] = useState<SolicitacaoPonto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<"todas" | StatusSolicitacao>("todas");
  const [anexoAberto, setAnexoAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setCarregando(true);
    setErro("");
    try {
      setLista(await solicitacoesPontoApi.listar(prefeituraId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Filtra só as solicitações deste operador. Casa por CPF ou por nome. */
  const minhas = useMemo(() => {
    const meuCpf = limparCpf(cpf ?? "");
    const meuNome = nome.trim().toLowerCase();
    return lista
      .filter((s) => {
        const cpfBate = meuCpf && s.cpf && limparCpf(s.cpf) === meuCpf;
        const nomeBate =
          !s.cpf && meuNome && s.name.trim().toLowerCase() === meuNome;
        return cpfBate || nomeBate;
      })
      .filter((s) => filtro === "todas" || s.status === filtro);
  }, [lista, cpf, nome, filtro]);

  const totais = useMemo(() => {
    const meuCpf = limparCpf(cpf ?? "");
    const meuNome = nome.trim().toLowerCase();
    const todas = lista.filter((s) => {
      const cpfBate = meuCpf && s.cpf && limparCpf(s.cpf) === meuCpf;
      const nomeBate =
        !s.cpf && meuNome && s.name.trim().toLowerCase() === meuNome;
      return cpfBate || nomeBate;
    });
    return {
      total: todas.length,
      pendentes: todas.filter((s) => s.status === "pendente").length,
      aprovadas: todas.filter((s) => s.status === "aprovado").length,
      reprovadas: todas.filter((s) => s.status === "reprovado").length,
    };
  }, [lista, cpf, nome]);

  return (
    <div className="mins">
      <header className="mins__topo">
        <button type="button" className="mins__voltar" onClick={onVoltar}>
          <ArrowLeft size={14} aria-hidden="true" />
          Voltar
        </button>
        <h2 className="mins__titulo">Minhas solicitações</h2>
      </header>

      <div className="mins__resumo">
        <button
          type="button"
          className={`mins__chip ${filtro === "todas" ? "is-ativo" : ""}`}
          onClick={() => setFiltro("todas")}
        >
          Todas <strong>{totais.total}</strong>
        </button>
        <button
          type="button"
          className={`mins__chip mins__chip--pendente ${filtro === "pendente" ? "is-ativo" : ""}`}
          onClick={() => setFiltro("pendente")}
        >
          Pendentes <strong>{totais.pendentes}</strong>
        </button>
        <button
          type="button"
          className={`mins__chip mins__chip--aprovado ${filtro === "aprovado" ? "is-ativo" : ""}`}
          onClick={() => setFiltro("aprovado")}
        >
          Aprovadas <strong>{totais.aprovadas}</strong>
        </button>
        <button
          type="button"
          className={`mins__chip mins__chip--reprovado ${filtro === "reprovado" ? "is-ativo" : ""}`}
          onClick={() => setFiltro("reprovado")}
        >
          Reprovadas <strong>{totais.reprovadas}</strong>
        </button>
      </div>

      {erro && <p className="mins__msg mins__msg--err">{erro}</p>}

      {carregando ? (
        <p className="mins__msg">Carregando…</p>
      ) : minhas.length === 0 ? (
        <div className="mins__vazio">
          <p>
            {filtro === "todas"
              ? "Você ainda não enviou nenhuma solicitação."
              : `Nenhuma solicitação ${STATUS_LABEL[filtro].toLowerCase()}.`}
          </p>
          {filtro === "todas" && (
            <p className="mins__vazio-dica">
              Use os botões em <strong>Solicitar ajustes</strong> na folha de
              ponto para incluir uma batida esquecida, cancelar uma, pedir
              abono ou enviar mensagem.
            </p>
          )}
        </div>
      ) : (
        <ul className="mins__lista">
          {minhas.map((s) => {
            const Icone = STATUS_ICONE[s.status];
            return (
              <li
                key={s.id}
                className={`mins__item mins__item--${s.status}`}
              >
                <div className="mins__item-topo">
                  <span className={`mins__tag mins__tag--${s.tipo}`}>
                    {TIPO_LABEL[s.tipo]}
                  </span>
                  <span className="mins__data">
                    Enviada em {fmtDataHora(s.createdAt)}
                  </span>
                  <span className={`mins__status mins__status--${s.status}`}>
                    <Icone size={12} aria-hidden="true" />
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>

                <div className="mins__item-corpo">
                  {s.tipo === "incluir" && s.timestampOriginal && (
                    <span>
                      <strong>Batida pedida:</strong>{" "}
                      {fmtDataHora(s.timestampOriginal)}
                    </span>
                  )}
                  {s.tipo === "cancelar" && s.batidaId && (
                    <span>
                      <strong>Batida-alvo:</strong>{" "}
                      <code>{s.batidaId.slice(0, 8)}…</code>
                    </span>
                  )}
                  {s.tipo === "abono" && s.data && (
                    <span>
                      <strong>Dia:</strong> {fmtDiaIso(s.data)}
                    </span>
                  )}
                  {s.observacao && (
                    <span className="mins__obs">"{s.observacao}"</span>
                  )}
                  {s.anexoNome && s.anexoDataUrl && (
                    <button
                      type="button"
                      className="mins__anexo"
                      onClick={() => setAnexoAberto(s.anexoDataUrl ?? null)}
                    >
                      <Paperclip size={12} aria-hidden="true" /> {s.anexoNome}
                    </button>
                  )}
                  {s.status === "reprovado" && s.motivoReprovacao && (
                    <span className="mins__reprov">
                      <AlertTriangle size={12} aria-hidden="true" />
                      <strong>Reprovada:</strong> {s.motivoReprovacao}
                    </span>
                  )}
                  {s.status === "aprovado" && s.tipo === "abono" && (
                    <span className="mins__nota mins__nota--ok">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      Seu abono está ativo para o dia {fmtDiaIso(s.data ?? "")}.
                    </span>
                  )}
                  {s.status === "aprovado" && s.tipo === "incluir" && (
                    <span className="mins__nota mins__nota--ok">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      A batida foi adicionada na sua folha.
                    </span>
                  )}
                  {s.status === "aprovado" && s.tipo === "cancelar" && (
                    <span className="mins__nota mins__nota--ok">
                      <CheckCircle2 size={12} aria-hidden="true" />
                      A batida foi cancelada na sua folha.
                    </span>
                  )}
                </div>

                <span className="mins__atualizada">
                  Atualizada em {fmtData(s.updatedAt)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {anexoAberto && (
        <div
          className="mins__anexo-modal"
          role="presentation"
          onClick={() => setAnexoAberto(null)}
        >
          {anexoAberto.startsWith("data:image") ? (
            <img src={anexoAberto} alt="Anexo" />
          ) : anexoAberto.startsWith("data:application/pdf") ? (
            <iframe src={anexoAberto} title="Anexo" />
          ) : (
            <a href={anexoAberto} download>
              Baixar anexo
            </a>
          )}
        </div>
      )}
    </div>
  );
}
