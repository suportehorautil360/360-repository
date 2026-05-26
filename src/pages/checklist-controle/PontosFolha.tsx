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

/** Combina a data de `iso` com um novo horário "HH:MM" (local) → ISO. */
function comNovaHora(iso: string, hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(iso);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/**
 * Folha de ponto do dia (aba do operador): mostra Entrada, Almoço, Volta e
 * Saída; permite bater (com selfie) os que faltam e editar o horário.
 */
export function PontosFolha({
  prefeituraId,
  nomePadrao,
}: {
  prefeituraId: string;
  nomePadrao: string;
}) {
  const { pendentes: pendentesSync, atualizar: atualizarSync } = usePontoSync();
  const [batidas, setBatidas] = useState<PontoRegistro[]>([]);
  const [nome, setNome] = useState(nomePadrao);
  const [carregando, setCarregando] = useState(true);

  // Fluxo de bater: tipo em andamento + foto capturada.
  const [batendo, setBatendo] = useState<TipoPonto | null>(null);
  const [foto, setFoto] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Fluxo de editar: id da batida + novo horário (HH:MM).
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novaHora, setNovaHora] = useState("");

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setCarregando(true);
    try {
      const lista = await pontoApi.listar(prefeituraId);
      const doDia = lista.filter((p) => ehHoje(p.timestampOriginal));
      setBatidas(doDia);
      // Prefill do nome a partir da entrada do dia, se houver.
      const entrada = doDia.find((p) => p.tipo === "entrada");
      if (entrada?.name) setNome((n) => n || entrada.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Última batida registrada de cada tipo. */
  const porTipo = useMemo(() => {
    const m = new Map<TipoPonto, PontoRegistro>();
    for (const b of batidas) m.set(b.tipo, b);
    return m;
  }, [batidas]);

  function iniciarBater(tipo: TipoPonto) {
    setFoto("");
    setEditandoId(null);
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
    setEditandoId(reg.id);
    setNovaHora(
      new Date(reg.timestampOriginal).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  }

  async function salvarEdicao(reg: PontoRegistro) {
    if (!novaHora) return;
    setSalvando(true);
    try {
      await pontoApi.editarHorario(
        reg.id,
        comNovaHora(reg.timestampOriginal, novaHora),
      );
      setEditandoId(null);
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao editar o horário.");
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <p className="ponto-folha__msg">Carregando folha de ponto…</p>;
  }

  return (
    <div className="ponto-folha">
      <RelogioAoVivo comData />

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

      {pendentesSync > 0 && (
        <p className="ponto-pendentes">
          {pendentesSync} batida(s) aguardando sincronização.
        </p>
      )}

      <ul className="ponto-slots">
        {TIPOS_PONTO.map(({ tipo, label }) => {
          const reg = porTipo.get(tipo);
          const emEdicao = reg && editandoId === reg.id;
          return (
            <li key={tipo} className="ponto-slot">
              <div className="ponto-slot__topo">
                <span className="ponto-slot__label">{label}</span>
                {emEdicao ? (
                  <span className="ponto-slot__edit">
                    <input
                      type="time"
                      className="ponto-input ponto-input--time"
                      value={novaHora}
                      onChange={(e) => setNovaHora(e.target.value)}
                    />
                    <button
                      type="button"
                      className="ponto-btn ponto-btn--primary ponto-btn--sm"
                      onClick={() => void salvarEdicao(reg)}
                      disabled={salvando}
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      className="ponto-btn ponto-btn--secundario ponto-btn--sm"
                      onClick={() => setEditandoId(null)}
                    >
                      Cancelar
                    </button>
                  </span>
                ) : reg ? (
                  <span className="ponto-slot__valor">
                    <strong>{horaDe(reg.timestampOriginal)}</strong>
                    <span
                      className={`ponto-status ponto-status--${statusDe(reg)}`}
                    >
                      {STATUS_LABEL[statusDe(reg)]}
                    </span>
                    <button
                      type="button"
                      className="ponto-btn ponto-btn--secundario ponto-btn--sm"
                      onClick={() => iniciarEdicao(reg)}
                    >
                      Editar
                    </button>
                  </span>
                ) : batendo === tipo ? null : (
                  <button
                    type="button"
                    className="ponto-btn ponto-btn--primary ponto-btn--sm"
                    onClick={() => iniciarBater(tipo)}
                  >
                    Bater
                  </button>
                )}
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
    </div>
  );
}
