import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Ban } from "lucide-react";
import { toast } from "sonner";
import {
  funcionariosApi,
  type Funcionario,
} from "../../../lib/funcionarios/funcionarios";
import {
  pontosApi,
  TIPOS_PONTO,
  type PontoRegistro,
} from "../../../lib/api/pontos";
import {
  solicitacoesPontoApi,
  type SolicitacaoPonto,
  type TipoSolicitacao,
} from "../../../lib/api/solicitacoes-ponto";
import { abonosApi, type Abono } from "../../../lib/api/abonos";
import { limparCpf } from "../../../lib/funcionarios/cpf";
import { diaLocal, diaDaSolicitacao } from "./ponto-dia-utils";
import "./historico-ponto.css";

const SOLIC_LABEL: Record<TipoSolicitacao, string> = {
  incluir: "Incluir batida",
  cancelar: "Cancelar batida",
  abono: "Abono",
  mensagem: "Mensagem",
};
const TIPO_PONTO_LABEL = Object.fromEntries(
  TIPOS_PONTO.map((t) => [t.tipo, t.label]),
) as Record<string, string>;

function mesmoNome(a: string, b: string): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}
function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type AlvoReprova = { tipo: "batida" | "solic"; id: string } | null;

interface Props {
  prefeituraId: string;
  funcId: string;
  dia: string;
}

export function DiaPontoSection({ prefeituraId, funcId, dia }: Props) {
  const navigate = useNavigate();
  const [funcionario, setFuncionario] = useState<Funcionario | null>(null);
  const [batidas, setBatidas] = useState<PontoRegistro[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoPonto[]>([]);
  const [abonos, setAbonos] = useState<Abono[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [reprovando, setReprovando] = useState<AlvoReprova>(null);
  const [motivo, setMotivo] = useState("");

  const carregar = useCallback(async () => {
    if (!prefeituraId || !funcId) return;
    setCarregando(true);
    try {
      const [f, ptos, sols, abs] = await Promise.all([
        funcionariosApi.obter(funcId),
        pontosApi.listar(prefeituraId),
        solicitacoesPontoApi.listar(prefeituraId).catch(() => []),
        abonosApi.listar(prefeituraId).catch(() => []),
      ]);
      setFuncionario(f);
      setBatidas(ptos);
      setSolicitacoes(sols);
      setAbonos(abs);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId, funcId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const nome = funcionario?.nome ?? "";

  const batidasDoDia = useMemo(
    () =>
      batidas
        .filter(
          (b) =>
            mesmoNome(b.name, nome) && diaLocal(b.timestampOriginal) === dia,
        )
        .sort((a, b) => a.timestampOriginal.localeCompare(b.timestampOriginal)),
    [batidas, nome, dia],
  );

  const solicDoDia = useMemo(
    () =>
      solicitacoes.filter(
        (s) => mesmoNome(s.name, nome) && diaDaSolicitacao(s, batidas) === dia,
      ),
    [solicitacoes, batidas, nome, dia],
  );

  const abonoDoDia = useMemo(() => {
    const cpf = limparCpf(funcionario?.cpf ?? "");
    if (!cpf) return null;
    return (
      abonos.find(
        (a) => limparCpf(a.funcionarioCpf) === cpf && a.data === dia,
      ) ?? null
    );
  }, [abonos, funcionario, dia]);

  function voltar() {
    navigate(`/prefeitura/${prefeituraId}/funcionarios/${funcId}/historico`);
  }

  async function executar(acao: () => Promise<void>, ok: string) {
    if (enviando) return;
    setEnviando(true);
    try {
      await acao();
      toast.success(ok);
      await carregar();
      setReprovando(null);
      setMotivo("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setEnviando(false);
    }
  }

  function confirmarReprova() {
    if (!reprovando) return;
    const m = motivo.trim();
    if (!m) {
      toast.error("Informe o motivo da recusa.");
      return;
    }
    if (reprovando.tipo === "batida") {
      void executar(() => pontosApi.reprovar(reprovando.id, m), "Batida recusada.");
    } else {
      void executar(
        () => solicitacoesPontoApi.reprovar(reprovando.id, m),
        "Solicitação recusada.",
      );
    }
  }

  const dataBR = dia.split("-").reverse().join("/");
  const semItens =
    batidasDoDia.length === 0 && solicDoDia.length === 0 && !abonoDoDia;

  return (
    <div className="dia-pt dia-pt--page">
      <header className="dia-pt__head">
        <div className="dia-pt__head-id">
          <button type="button" className="dia-pt__voltar" onClick={voltar}>
            <ArrowLeft size={14} aria-hidden="true" /> Voltar
          </button>
          <div>
            <h2>Dia {dataBR}</h2>
            <span className="dia-pt__sub">{nome || "—"}</span>
          </div>
        </div>
      </header>

      <div className="dia-pt__body">
        {carregando ? (
          <p className="dia-pt__vazio">Carregando…</p>
        ) : (
          <>
            {abonoDoDia && (
              <div className="dia-pt__abono">
                <span>
                  <strong>Dia abonado</strong>
                  {abonoDoDia.motivo ? ` — ${abonoDoDia.motivo}` : ""}
                </span>
                <button
                  type="button"
                  className="dia-pt__btn dia-pt__btn--ghost"
                  disabled={enviando}
                  onClick={() =>
                    void executar(
                      () => abonosApi.remover(abonoDoDia.id),
                      "Abono cancelado.",
                    )
                  }
                >
                  Cancelar abono
                </button>
              </div>
            )}

            <section className="dia-pt__bloco">
              <h3>Batidas do dia</h3>
              {batidasDoDia.length === 0 ? (
                <p className="dia-pt__vazio">Nenhuma batida neste dia.</p>
              ) : (
                <ul className="dia-pt__lista">
                  {batidasDoDia.map((b) => {
                    const st = b.status ?? "pendente";
                    return (
                      <li key={b.id} className="dia-pt__item">
                        <div className="dia-pt__item-info">
                          <strong>
                            {TIPO_PONTO_LABEL[b.tipo] ?? b.tipo} ·{" "}
                            {hora(b.timestampOriginal)}
                          </strong>
                          <span className={`dia-pt__status is-${st}`}>{st}</span>
                          {st === "reprovado" && b.motivoReprovacao && (
                            <small>Motivo: {b.motivoReprovacao}</small>
                          )}
                        </div>
                        {st === "pendente" && (
                          <div className="dia-pt__acoes">
                            <button
                              type="button"
                              className="dia-pt__btn dia-pt__btn--ok"
                              disabled={enviando}
                              onClick={() =>
                                void executar(
                                  () => pontosApi.aprovar(b.id),
                                  "Batida aprovada.",
                                )
                              }
                            >
                              <Check size={13} /> Aprovar
                            </button>
                            <button
                              type="button"
                              className="dia-pt__btn dia-pt__btn--no"
                              disabled={enviando}
                              onClick={() =>
                                setReprovando({ tipo: "batida", id: b.id })
                              }
                            >
                              <Ban size={13} /> Recusar
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="dia-pt__bloco">
              <h3>Solicitações do dia</h3>
              {solicDoDia.length === 0 ? (
                <p className="dia-pt__vazio">Nenhuma solicitação neste dia.</p>
              ) : (
                <ul className="dia-pt__lista">
                  {solicDoDia.map((s) => (
                    <li key={s.id} className="dia-pt__item">
                      <div className="dia-pt__item-info">
                        <strong>{SOLIC_LABEL[s.tipo] ?? s.tipo}</strong>
                        <span className={`dia-pt__status is-${s.status}`}>
                          {s.status}
                        </span>
                        {s.observacao && <small>{s.observacao}</small>}
                        {s.status === "reprovado" && s.motivoReprovacao && (
                          <small>Motivo: {s.motivoReprovacao}</small>
                        )}
                      </div>
                      {s.status === "pendente" && (
                        <div className="dia-pt__acoes">
                          <button
                            type="button"
                            className="dia-pt__btn dia-pt__btn--ok"
                            disabled={enviando}
                            onClick={() =>
                              void executar(
                                () => solicitacoesPontoApi.aprovar(s.id),
                                "Solicitação aprovada.",
                              )
                            }
                          >
                            <Check size={13} /> Aprovar
                          </button>
                          <button
                            type="button"
                            className="dia-pt__btn dia-pt__btn--no"
                            disabled={enviando}
                            onClick={() =>
                              setReprovando({ tipo: "solic", id: s.id })
                            }
                          >
                            <Ban size={13} /> Recusar
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {semItens && (
              <p className="dia-pt__vazio">Nada para revisar neste dia.</p>
            )}
          </>
        )}
      </div>

      {reprovando && (
        <div className="dia-pt__reprova">
          <label>
            Motivo da recusa
            <textarea
              value={motivo}
              autoFocus
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Explique o motivo…"
            />
          </label>
          <div className="dia-pt__reprova-acoes">
            <button
              type="button"
              className="dia-pt__btn dia-pt__btn--ghost"
              onClick={() => {
                setReprovando(null);
                setMotivo("");
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="dia-pt__btn dia-pt__btn--no"
              disabled={enviando}
              onClick={confirmarReprova}
            >
              Confirmar recusa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
