import { useCallback, useEffect, useMemo, useState } from "react";
import {
  pontoApi,
  TIPOS_PONTO,
  type PontoRegistro,
  type StatusPonto,
  type TipoPonto,
} from "./ponto-api";
import { toast } from "sonner";
import { CameraSelfie } from "./CameraSelfie";
import { RelogioAoVivo } from "./RelogioAoVivo";
import { baterComFila } from "../../lib/api/pontos-fila";
import { usePontoSync } from "./usePontoSync";
import { escalaApi, type Escala } from "../../lib/api/escala";
import { solicitacoesPontoApi } from "../../lib/api/solicitacoes-ponto";
import { SinoNotificacoes } from "../../components/Notificacoes/SinoNotificacoes";
import { useOperadorSession } from "./useOperadorSession";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fmtMin,
  minutosPrevistos,
  minutosTrabalhados,
} from "../prefeitura/sections/horasPonto";
import "./ponto.css";

const STATUS_LABEL: Record<StatusPonto, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  reprovado: "Reprovado",
};

function statusDe(r: PontoRegistro): StatusPonto {
  return r.status ?? "pendente";
}

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ehHoje(iso: string): boolean {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/** Data LOCAL (YYYY-MM-DD) da batida — para agrupar o banco de horas por dia. */
function diaDe(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

/** Combina a data de `iso` com um novo horário "HH:MM" (local) → ISO. */
function comNovaHora(iso: string, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(iso);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** Ícones (outline) dos botões de "Solicitar ajustes". */
const IconMais = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
const IconMenos = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12h8" />
  </svg>
);
const IconChat = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 5h16v11H9l-4 3v-3H4z" />
  </svg>
);
const IconAbono = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="4" width="18" height="17" rx="3" />
    <path d="M3 9h18M8 2v4M16 2v4M9 15l2 2 4-4" />
  </svg>
);

/**
 * Folha de ponto do dia (aba do operador): relógio, funcionário, registros do
 * dia (Entrada/Almoço/Volta/Saída com selfie e correção de horário) e coluna
 * de apoio com saldo de banco de horas e solicitações de ajuste.
 */
export function PontosFolha({
  prefeituraId,
  nomePadrao,
}: {
  prefeituraId: string;
  nomePadrao: string;
}) {
  const { pendentes: pendentesSync, atualizar: atualizarSync } = usePontoSync();
  const { session } = useOperadorSession();
  const [todas, setTodas] = useState<PontoRegistro[]>([]);
  const [escala, setEscala] = useState<Escala | null>(null);
  const [nome, setNome] = useState(nomePadrao);
  const [carregando, setCarregando] = useState(true);

  // Fluxo de bater: tipo em andamento + foto capturada.
  const [batendo, setBatendo] = useState<TipoPonto | null>(null);
  const [foto, setFoto] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Fluxo de editar (modal): batida em correção + novo horário + motivo.
  const [editando, setEditando] = useState<PontoRegistro | null>(null);
  const [novaHora, setNovaHora] = useState("");
  const [motivo, setMotivo] = useState("");

  const MOTIVO_MAX = 250;
  const OBS_MAX = 1000;
  const ANEXO_MAX_MB = 25;

  // Fluxo de incluir batida (modal): solicitação de batida esquecida.
  const [incluirAberto, setIncluirAberto] = useState(false);
  const [incData, setIncData] = useState("");
  const [incHora, setIncHora] = useState("");
  const [incObs, setIncObs] = useState("");
  const [incAnexo, setIncAnexo] = useState<File | null>(null);
  const [enviandoInclusao, setEnviandoInclusao] = useState(false);

  // Cancelar batida: aponta uma batida existente do dia.
  const [cancelarAberto, setCancelarAberto] = useState(false);
  const [cancelarBatidaId, setCancelarBatidaId] = useState("");
  const [cancelarMotivo, setCancelarMotivo] = useState("");
  const [enviandoCancelar, setEnviandoCancelar] = useState(false);

  // Solicitar abono: dia + motivo + anexo (atestado).
  const [abonoAberto, setAbonoAberto] = useState(false);
  const [abonoData, setAbonoData] = useState("");
  const [abonoMotivo, setAbonoMotivo] = useState("");
  const [abonoAnexo, setAbonoAnexo] = useState<File | null>(null);
  const [enviandoAbono, setEnviandoAbono] = useState(false);

  // Enviar mensagem ao gestor.
  const [mensagemAberta, setMensagemAberta] = useState(false);
  const [mensagemTexto, setMensagemTexto] = useState("");
  const [enviandoMensagem, setEnviandoMensagem] = useState(false);

  function abrirIncluir() {
    const hoje = new Date();
    const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    setIncData(iso);
    setIncHora("");
    setIncObs("");
    setIncAnexo(null);
    setIncluirAberto(true);
  }

  function escolherAnexo(file: File | null) {
    if (!file) {
      setIncAnexo(null);
      return;
    }
    if (file.size > ANEXO_MAX_MB * 1024 * 1024) {
      toast.error(`Arquivo maior que ${ANEXO_MAX_MB}MB.`);
      return;
    }
    setIncAnexo(file);
  }

  function hojeIso(): string {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
  }

  function abrirCancelar() {
    setCancelarBatidaId("");
    setCancelarMotivo("");
    setCancelarAberto(true);
  }
  function abrirAbono() {
    setAbonoData(hojeIso());
    setAbonoMotivo("");
    setAbonoAnexo(null);
    setAbonoAberto(true);
  }
  function abrirMensagem() {
    setMensagemTexto("");
    setMensagemAberta(true);
  }

  function escolherAbonoAnexo(file: File | null) {
    if (!file) return setAbonoAnexo(null);
    if (file.size > ANEXO_MAX_MB * 1024 * 1024) {
      toast.error(`Arquivo maior que ${ANEXO_MAX_MB}MB.`);
      return;
    }
    setAbonoAnexo(file);
  }

  async function enviarCancelar() {
    if (!cancelarBatidaId) return toast.error("Selecione a batida a cancelar.");
    if (!cancelarMotivo.trim())
      return toast.error("Descreva o motivo do cancelamento.");
    if (!nome.trim()) return toast.error("Informe seu nome.");
    setEnviandoCancelar(true);
    try {
      await solicitacoesPontoApi.criar({
        tipo: "cancelar",
        prefeituraId,
        name: nome.trim(),
        batidaId: cancelarBatidaId,
        observacao: cancelarMotivo.trim(),
      });
      toast.success("Solicitação de cancelamento enviada ao gestor.");
      setCancelarAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar.");
    } finally {
      setEnviandoCancelar(false);
    }
  }

  async function enviarAbono() {
    if (!abonoData) return toast.error("Informe a data do abono.");
    if (!abonoMotivo.trim()) return toast.error("Descreva o motivo.");
    if (!nome.trim()) return toast.error("Informe seu nome.");
    setEnviandoAbono(true);
    try {
      let anexoDataUrl: string | undefined;
      if (abonoAnexo) anexoDataUrl = await lerComoDataUrl(abonoAnexo);
      await solicitacoesPontoApi.criar({
        tipo: "abono",
        prefeituraId,
        name: nome.trim(),
        data: abonoData,
        observacao: abonoMotivo.trim(),
        anexoDataUrl,
        anexoNome: abonoAnexo?.name,
      });
      toast.success("Solicitação de abono enviada ao gestor.");
      setAbonoAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar.");
    } finally {
      setEnviandoAbono(false);
    }
  }

  async function enviarMensagem() {
    if (!mensagemTexto.trim())
      return toast.error("Escreva uma mensagem antes de enviar.");
    if (!nome.trim()) return toast.error("Informe seu nome.");
    setEnviandoMensagem(true);
    try {
      await solicitacoesPontoApi.criar({
        tipo: "mensagem",
        prefeituraId,
        name: nome.trim(),
        observacao: mensagemTexto.trim(),
      });
      toast.success("Mensagem enviada ao gestor.");
      setMensagemAberta(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar.");
    } finally {
      setEnviandoMensagem(false);
    }
  }

  /** Lê o arquivo como data URL (base64) — suficiente para anexos pequenos. */
  function lerComoDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o arquivo."));
      reader.readAsDataURL(file);
    });
  }

  async function enviarInclusao() {
    if (!incData || !incHora) {
      toast.error("Informe data e horário.");
      return;
    }
    if (!nome.trim()) {
      toast.error("Informe seu nome no campo Funcionário.");
      return;
    }
    setEnviandoInclusao(true);
    try {
      // Combina data + hora locais e converte pra ISO 8601 (timezone do device).
      const tsLocal = new Date(`${incData}T${incHora}:00`);
      const timestampOriginal = tsLocal.toISOString();
      let anexoDataUrl: string | undefined;
      if (incAnexo) {
        anexoDataUrl = await lerComoDataUrl(incAnexo);
      }
      await solicitacoesPontoApi.criar({
        tipo: "incluir",
        prefeituraId,
        name: nome.trim(),
        data: incData,
        timestampOriginal,
        observacao: incObs.trim() || undefined,
        anexoDataUrl,
        anexoNome: incAnexo?.name,
      });
      toast.success("Solicitação de inclusão enviada ao gestor.");
      setIncluirAberto(false);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erro ao enviar a solicitação.",
      );
    } finally {
      setEnviandoInclusao(false);
    }
  }

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setCarregando(true);
    try {
      const [lista, esc] = await Promise.all([
        pontoApi.listar(prefeituraId),
        escalaApi.obter(prefeituraId).catch(() => null),
      ]);
      setTodas(lista);
      setEscala(esc);
      // Prefill do nome a partir da entrada de hoje, se houver.
      const entradaHoje = lista.find(
        (p) => p.tipo === "entrada" && ehHoje(p.timestampOriginal),
      );
      if (entradaHoje?.name) setNome((n) => n || entradaHoje.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Batidas de hoje (a folha em si). */
  const batidasDia = useMemo(
    () => todas.filter((p) => ehHoje(p.timestampOriginal)),
    [todas],
  );

  /** Última batida registrada de cada tipo (hoje). */
  const porTipo = useMemo(() => {
    const m = new Map<TipoPonto, PontoRegistro>();
    for (const b of batidasDia) m.set(b.tipo, b);
    return m;
  }, [batidasDia]);

  /**
   * Saldo de banco de horas do funcionário: soma de (trabalhado − previsto)
   * de cada dia com batidas deste nome. Best-effort com os dados disponíveis.
   */
  const banco = useMemo(() => {
    const alvo = nome.trim().toLowerCase();
    if (!alvo) return { saldoMin: 0, dias: 0 };
    const porDia = new Map<string, PontoRegistro[]>();
    for (const b of todas) {
      if ((b.name ?? "").trim().toLowerCase() !== alvo) continue;
      const dia = diaDe(b.timestampOriginal);
      const arr = porDia.get(dia) ?? [];
      arr.push(b);
      porDia.set(dia, arr);
    }
    let saldoMin = 0;
    for (const [dia, bdia] of porDia) {
      const trab = minutosTrabalhados(bdia, escala?.almocoMinutos ?? 0);
      saldoMin += trab - minutosPrevistos(escala, dia);
    }
    return { saldoMin, dias: porDia.size };
  }, [todas, nome, escala]);

  function iniciarBater(tipo: TipoPonto) {
    setFoto("");
    setEditando(null);
    setBatendo(tipo);
  }

  async function confirmarBatida() {
    if (!batendo) return;
    const label = TIPOS_PONTO.find((t) => t.tipo === batendo)?.label ?? "Batida";
    if (!nome.trim()) {
      toast.error("Informe seu nome.");
      return;
    }
    if (!foto) {
      toast.error("Capture a selfie antes de confirmar.");
      return;
    }
    setSalvando(true);
    const agora = new Date();
    try {
      const r = await baterComFila({
        name: nome.trim(),
        photo: foto,
        prefeituraId,
        timestampOriginal: agora.toISOString(),
        tipo: batendo,
      });
      setBatendo(null);
      setFoto("");
      atualizarSync();
      if (r.sincronizado) {
        toast.success(`${label} registrada às ${horaDe(agora.toISOString())}.`);
      } else {
        toast.warning(`${label} registrada offline — sincroniza ao reconectar.`);
      }
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar a batida.");
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicao(reg: PontoRegistro) {
    setBatendo(null);
    setMotivo("");
    setNovaHora(
      new Date(reg.timestampOriginal).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    setEditando(reg);
  }

  function fecharEdicao() {
    setEditando(null);
    setMotivo("");
  }

  async function salvarEdicao() {
    if (!editando || !novaHora) return;
    setSalvando(true);
    try {
      await pontoApi.editarHorario(
        editando.id,
        comNovaHora(editando.timestampOriginal, novaHora),
        motivo,
      );
      fecharEdicao();
      toast.success("Correção enviada — pendente de aprovação do gestor.");
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao editar o horário.");
    } finally {
      setSalvando(false);
    }
  }

  const emBreve = (o: string) =>
    toast.info(`${o} — disponível em breve.`);

  if (carregando) {
    return <p className="ponto-folha__msg">Carregando folha de ponto…</p>;
  }

  return (
    <div className="ponto-folha folha">
      {session?.cpf && (
        <header className="folha__topbar">
          <SinoNotificacoes
            destinatarioTipo="funcionario"
            destinatarioId={session.cpf}
            variant="claro"
          />
        </header>
      )}
      <div className="folha__grid">
        <div className="folha__main">
          <section className="folha__card folha__clock">
            <RelogioAoVivo comData />
          </section>

          <section className="folha__card">
            <label className="ponto-label" htmlFor="folha-nome">
              Funcionário
            </label>
            <input
              id="folha-nome"
              className="ponto-input"
              type="text"
              placeholder="Nome completo"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </section>

          {pendentesSync > 0 && (
            <p className="ponto-pendentes">
              {pendentesSync} batida(s) aguardando sincronização.
            </p>
          )}

          <section className="folha__card">
            <h2 className="folha__card-titulo">Registros do dia</h2>
            <ul className="folha__regs">
              {TIPOS_PONTO.map(({ tipo, label }) => {
                const reg = porTipo.get(tipo);
                return (
                  <li key={tipo} className="folha__reg">
                    <div className="folha__reg-linha">
                      <span className="folha__reg-label">{label}</span>

                      <span className="folha__reg-acao">
                        <strong className="folha__reg-hora">
                          {reg ? horaDe(reg.timestampOriginal) : "—:—"}
                        </strong>
                        {reg ? (
                          <span
                            className={`ponto-status ponto-status--${statusDe(reg)}`}
                          >
                            {STATUS_LABEL[statusDe(reg)]}
                          </span>
                        ) : (
                          <span className="ponto-status ponto-status--pendente">
                            Pendente
                          </span>
                        )}
                        {reg ? (
                          <button
                            type="button"
                            className="ponto-btn ponto-btn--secundario ponto-btn--sm"
                            onClick={() => iniciarEdicao(reg)}
                          >
                            Editar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ponto-btn ponto-btn--primary ponto-btn--sm"
                            onClick={() => iniciarBater(tipo)}
                            disabled={batendo === tipo}
                          >
                            Bater
                          </button>
                        )}
                      </span>
                    </div>

                    {reg &&
                      statusDe(reg) === "reprovado" &&
                      reg.motivoReprovacao && (
                        <span className="ponto-slot__motivo">
                          Reprovado: {reg.motivoReprovacao}
                        </span>
                      )}

                    {batendo === tipo && (
                      <div className="ponto-slot__bater">
                        <CameraSelfie foto={foto} onFoto={setFoto} />
                        <div className="ponto-cam-acoes">
                          <button
                            type="button"
                            className="ponto-btn ponto-btn--primary"
                            onClick={() => void confirmarBatida()}
                            disabled={salvando}
                          >
                            {salvando ? "Registrando…" : `Confirmar ${label}`}
                          </button>
                          <button
                            type="button"
                            className="ponto-btn ponto-btn--secundario"
                            onClick={() => {
                              setBatendo(null);
                              setFoto("");
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <aside className="folha__side">
          <section className="folha__card folha__banco">
            <span className="folha__banco-rotulo">Saldo banco de horas</span>
            <strong
              className={`folha__banco-valor ${
                banco.saldoMin < 0 ? "is-neg" : "is-pos"
              }`}
            >
              {banco.saldoMin >= 0 ? "+" : ""}
              {fmtMin(banco.saldoMin)}
            </strong>
            <span className="folha__banco-sub">
              {banco.dias > 0
                ? `Calculado de ${banco.dias} dia(s) com batidas`
                : "Sem batidas registradas para este nome"}
            </span>
          </section>

          <section className="folha__card folha__ajustes">
            <h2 className="folha__card-titulo">Solicitar ajustes</h2>
            <div className="folha__ajustes-grid">
              <button
                type="button"
                className="folha__ajuste"
                onClick={abrirIncluir}
              >
                <IconMais />
                Incluir batida
              </button>
              <button
                type="button"
                className="folha__ajuste"
                onClick={abrirCancelar}
              >
                <IconMenos />
                Cancelar batida
              </button>
              <button
                type="button"
                className="folha__ajuste"
                onClick={abrirMensagem}
              >
                <IconChat />
                Enviar mensagem
              </button>
              <button
                type="button"
                className="folha__ajuste"
                onClick={abrirAbono}
              >
                <IconAbono />
                Solicitar abono
              </button>
            </div>
          </section>

          <button
            type="button"
            className="folha__card folha__espelho"
            onClick={() => emBreve("Espelho detalhado")}
          >
            <span>📅 Acessar espelho detalhado</span>
            <span aria-hidden="true">›</span>
          </button>
        </aside>
      </div>

      <Dialog
        open={!!editando}
        onOpenChange={(aberto) => {
          if (!aberto) fecharEdicao();
        }}
      >
        <DialogContent showCloseButton={false} className="folha-dialog">
          <header className="folha-modal__head">
            <button
              type="button"
              className="folha-modal__voltar"
              aria-label="Voltar"
              onClick={fecharEdicao}
            >
              ‹
            </button>
            <DialogTitle asChild>
              <h2>Editar registro</h2>
            </DialogTitle>
          </header>

          <div className="folha-modal__body">
            <DialogDescription className="folha-modal__lead">
              Corrija o horário desta batida. A alteração ficará pendente de
              aprovação do gestor.
            </DialogDescription>

            <label className="folha-modal__label" htmlFor="folha-edit-hora">
                Novo horário
              </label>
              <input
                id="folha-edit-hora"
                type="time"
                className="folha-modal__input"
                value={novaHora}
                onChange={(e) => setNovaHora(e.target.value)}
              />

              <label className="folha-modal__label" htmlFor="folha-edit-motivo">
                Motivo da correção
              </label>
              <textarea
                id="folha-edit-motivo"
                className="folha-modal__textarea"
                placeholder="Descreva o motivo…"
                rows={4}
                maxLength={MOTIVO_MAX}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              <span className="folha-modal__contador">
                {motivo.length}/{MOTIVO_MAX}
              </span>

              <button
                type="button"
                className="ponto-btn ponto-btn--primary folha-modal__salvar"
                onClick={() => void salvarEdicao()}
                disabled={salvando || !novaHora}
              >
                {salvando ? "Salvando…" : "Salvar correção"}
              </button>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={incluirAberto} onOpenChange={setIncluirAberto}>
        <DialogContent
          showCloseButton={false}
          className="folha-dialog folha-dialog--azul"
        >
          <header className="folha-modal__head folha-modal__head--azul">
            <button
              type="button"
              className="folha-modal__voltar"
              aria-label="Voltar"
              onClick={() => setIncluirAberto(false)}
            >
              ‹
            </button>
            <DialogTitle asChild>
              <h2>Incluir batida</h2>
            </DialogTitle>
          </header>

          <div className="folha-modal__body">
            <DialogDescription className="folha-modal__lead" asChild>
              <p>
                <strong>
                  Use esta tela para incluir batidas não gravadas ou esquecidas.
                </strong>
                <br />
                Todos os campos são obrigatórios, exceto quando indicado como
                opcional.
              </p>
            </DialogDescription>

            <label className="folha-modal__label" htmlFor="inc-data">
                Data de inclusão
              </label>
              <input
                id="inc-data"
                type="date"
                className="folha-modal__input"
                value={incData}
                onChange={(e) => setIncData(e.target.value)}
              />

              <label className="folha-modal__label" htmlFor="inc-hora">
                Horário
              </label>
              <input
                id="inc-hora"
                type="time"
                className="folha-modal__input"
                value={incHora}
                onChange={(e) => setIncHora(e.target.value)}
              />

              <label className="folha-modal__label" htmlFor="inc-obs">
                Observação
              </label>
              <textarea
                id="inc-obs"
                className="folha-modal__textarea"
                placeholder="Exemplo: esqueci de marcar entrada"
                rows={4}
                maxLength={OBS_MAX}
                value={incObs}
                onChange={(e) => setIncObs(e.target.value)}
              />
              <span className="folha-modal__contador">
                {incObs.length}/{OBS_MAX}
              </span>

              <label className="folha-modal__anexo">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  hidden
                  onChange={(e) => escolherAnexo(e.target.files?.[0] ?? null)}
                />
                📎 {incAnexo ? incAnexo.name : "Adicionar anexo (Opcional)"}
              </label>
              <span className="folha-modal__anexo-dica">
                Arquivos: PDF, JPG, PNG (máx. {ANEXO_MAX_MB}MB).
              </span>

              <button
                type="button"
                className="folha-modal__salvar folha-modal__salvar--azul"
                disabled={enviandoInclusao}
                onClick={() => void enviarInclusao()}
              >
                {enviandoInclusao ? "Enviando…" : "Enviar solicitação"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

      {/* Cancelar batida */}
      <Dialog open={cancelarAberto} onOpenChange={setCancelarAberto}>
        <DialogContent showCloseButton={false} className="folha-dialog">
          <header className="folha-modal__head folha-modal__head--azul">
            <button
              type="button"
              className="folha-modal__voltar"
              aria-label="Voltar"
              onClick={() => setCancelarAberto(false)}
            >
              ‹
            </button>
            <DialogTitle asChild>
              <h2>Cancelar batida</h2>
            </DialogTitle>
          </header>
          <div className="folha-modal__body">
            <DialogDescription className="folha-modal__lead">
              Selecione a batida do dia que deseja cancelar e descreva o motivo.
              A solicitação fica pendente de aprovação do gestor.
            </DialogDescription>

            <label className="folha-modal__label" htmlFor="canc-batida">
              Batida do dia
            </label>
            <select
              id="canc-batida"
              className="folha-modal__input"
              value={cancelarBatidaId}
              onChange={(e) => setCancelarBatidaId(e.target.value)}
            >
              <option value="">Selecione…</option>
              {batidasDia.map((b) => {
                const label =
                  TIPOS_PONTO.find((t) => t.tipo === b.tipo)?.label ?? b.tipo;
                return (
                  <option key={b.id} value={b.id}>
                    {label} — {horaDe(b.timestampOriginal)}
                  </option>
                );
              })}
            </select>

            <label className="folha-modal__label" htmlFor="canc-motivo">
              Motivo do cancelamento
            </label>
            <textarea
              id="canc-motivo"
              className="folha-modal__textarea"
              rows={4}
              maxLength={OBS_MAX}
              placeholder="Ex.: Bati o ponto errado por engano."
              value={cancelarMotivo}
              onChange={(e) => setCancelarMotivo(e.target.value)}
            />
            <span className="folha-modal__contador">
              {cancelarMotivo.length}/{OBS_MAX}
            </span>

            <button
              type="button"
              className="folha-modal__salvar folha-modal__salvar--azul"
              disabled={enviandoCancelar}
              onClick={() => void enviarCancelar()}
            >
              {enviandoCancelar ? "Enviando…" : "Enviar solicitação"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Solicitar abono */}
      <Dialog open={abonoAberto} onOpenChange={setAbonoAberto}>
        <DialogContent showCloseButton={false} className="folha-dialog">
          <header className="folha-modal__head folha-modal__head--azul">
            <button
              type="button"
              className="folha-modal__voltar"
              aria-label="Voltar"
              onClick={() => setAbonoAberto(false)}
            >
              ‹
            </button>
            <DialogTitle asChild>
              <h2>Solicitar abono</h2>
            </DialogTitle>
          </header>
          <div className="folha-modal__body">
            <DialogDescription className="folha-modal__lead">
              Informe o dia, o motivo e — se houver — anexe o documento
              comprovante (atestado, declaração, etc.).
            </DialogDescription>

            <label className="folha-modal__label" htmlFor="abono-data">
              Data do abono
            </label>
            <input
              id="abono-data"
              type="date"
              className="folha-modal__input"
              value={abonoData}
              onChange={(e) => setAbonoData(e.target.value)}
            />

            <label className="folha-modal__label" htmlFor="abono-motivo">
              Motivo
            </label>
            <textarea
              id="abono-motivo"
              className="folha-modal__textarea"
              rows={4}
              maxLength={OBS_MAX}
              placeholder="Ex.: Consulta médica com atestado."
              value={abonoMotivo}
              onChange={(e) => setAbonoMotivo(e.target.value)}
            />
            <span className="folha-modal__contador">
              {abonoMotivo.length}/{OBS_MAX}
            </span>

            <label className="folha-modal__anexo">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                hidden
                onChange={(e) =>
                  escolherAbonoAnexo(e.target.files?.[0] ?? null)
                }
              />
              📎{" "}
              {abonoAnexo
                ? abonoAnexo.name
                : "Adicionar comprovante (Opcional)"}
            </label>
            <span className="folha-modal__anexo-dica">
              Arquivos: PDF, JPG, PNG (máx. {ANEXO_MAX_MB}MB).
            </span>

            <button
              type="button"
              className="folha-modal__salvar folha-modal__salvar--azul"
              disabled={enviandoAbono}
              onClick={() => void enviarAbono()}
            >
              {enviandoAbono ? "Enviando…" : "Enviar solicitação"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enviar mensagem */}
      <Dialog open={mensagemAberta} onOpenChange={setMensagemAberta}>
        <DialogContent showCloseButton={false} className="folha-dialog">
          <header className="folha-modal__head folha-modal__head--azul">
            <button
              type="button"
              className="folha-modal__voltar"
              aria-label="Voltar"
              onClick={() => setMensagemAberta(false)}
            >
              ‹
            </button>
            <DialogTitle asChild>
              <h2>Enviar mensagem</h2>
            </DialogTitle>
          </header>
          <div className="folha-modal__body">
            <DialogDescription className="folha-modal__lead">
              Mande uma observação ao seu gestor sobre o seu ponto. Você
              receberá a resposta no mesmo painel.
            </DialogDescription>

            <label className="folha-modal__label" htmlFor="msg-texto">
              Mensagem
            </label>
            <textarea
              id="msg-texto"
              className="folha-modal__textarea"
              rows={6}
              maxLength={OBS_MAX}
              placeholder="Descreva o que precisa…"
              value={mensagemTexto}
              onChange={(e) => setMensagemTexto(e.target.value)}
            />
            <span className="folha-modal__contador">
              {mensagemTexto.length}/{OBS_MAX}
            </span>

            <button
              type="button"
              className="folha-modal__salvar folha-modal__salvar--azul"
              disabled={enviandoMensagem}
              onClick={() => void enviarMensagem()}
            >
              {enviandoMensagem ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
