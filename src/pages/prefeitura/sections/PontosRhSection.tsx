import { useCallback, useEffect, useMemo, useState } from "react";
import {
  pontosApi,
  TIPOS_PONTO,
  type PontoRegistro,
  type StatusPonto,
} from "../../../lib/api/pontos";
import "./pontos-rh.css";

function horaDe(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Data LOCAL (YYYY-MM-DD) da batida — não a data UTC do ISO. */
function diaDe(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

function diaLegivel(diaIso: string): string {
  return new Date(`${diaIso}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

function statusDe(r: PontoRegistro): StatusPonto {
  return r.status ?? "pendente";
}

const TIPOS_CONHECIDOS = new Set(TIPOS_PONTO.map((t) => t.tipo));

const STATUS_ICONE: Record<StatusPonto, string> = {
  pendente: "⏳",
  aprovado: "✓",
  reprovado: "✕",
};

interface Grupo {
  chave: string;
  nome: string;
  dia: string;
  batidas: PontoRegistro[];
}

export function PontosRhSection({ prefeituraId }: { prefeituraId: string }) {
  const [registros, setRegistros] = useState<PontoRegistro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);
  const [reprovandoId, setReprovandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [fotoAmpliada, setFotoAmpliada] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setCarregando(true);
    setErro("");
    try {
      setRegistros(await pontosApi.listar(prefeituraId));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const grupos = useMemo(() => {
    const map = new Map<string, Grupo>();
    for (const r of registros) {
      const dia = diaDe(r.timestampOriginal);
      const chave = `${r.name}__${dia}`;
      const g = map.get(chave) ?? { chave, nome: r.name, dia, batidas: [] };
      g.batidas.push(r);
      map.set(chave, g);
    }
    let lista = [...map.values()];
    if (soPendentes) {
      lista = lista.filter((g) =>
        g.batidas.some((b) => statusDe(b) === "pendente"),
      );
    }
    return lista.sort((a, b) =>
      a.dia === b.dia ? a.nome.localeCompare(b.nome) : b.dia.localeCompare(a.dia),
    );
  }, [registros, soPendentes]);

  async function aprovar(id: string) {
    setOcupado(true);
    try {
      await pontosApi.aprovar(id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao aprovar.");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmarReprovacao(id: string) {
    if (!motivo.trim()) return;
    setOcupado(true);
    try {
      await pontosApi.reprovar(id, motivo.trim());
      setReprovandoId(null);
      setMotivo("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao reprovar.");
    } finally {
      setOcupado(false);
    }
  }

  async function aprovarDia(g: Grupo) {
    const pendentes = g.batidas.filter((b) => statusDe(b) === "pendente");
    setOcupado(true);
    try {
      for (const b of pendentes) await pontosApi.aprovar(b.id);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao aprovar o dia.");
    } finally {
      setOcupado(false);
    }
  }

  /** Conteúdo de uma batida registrada (foto, horário, status e ações). */
  function corpoBatida(reg: PontoRegistro, label: string) {
    const st = statusDe(reg);
    return (
      <>
        {reg.photo ? (
          <button
            type="button"
            className="rh-foto"
            onClick={() => setFotoAmpliada(reg.photo ?? "")}
            aria-label="Ampliar foto"
          >
            <img src={reg.photo} alt={`Selfie ${label}`} />
          </button>
        ) : (
          <span className="rh-foto rh-foto--sem">—</span>
        )}
        <div className="rh-batida__info">
          <span className="rh-batida__label">{label}</span>
          <strong>{horaDe(reg.timestampOriginal)}</strong>
        </div>
        <span className={`rh-badge rh-badge--${st}`}>
          <span aria-hidden="true">{STATUS_ICONE[st]}</span> {st}
        </span>

        {reprovandoId === reg.id ? (
          <div className="rh-reprovar">
            <input
              type="text"
              placeholder="Motivo da reprovação"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <button
              type="button"
              className="rh-btn rh-btn--err"
              disabled={ocupado || !motivo.trim()}
              onClick={() => void confirmarReprovacao(reg.id)}
            >
              Confirmar
            </button>
            <button
              type="button"
              className="rh-btn"
              onClick={() => {
                setReprovandoId(null);
                setMotivo("");
              }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="rh-batida__acoes">
            {st !== "aprovado" && (
              <button
                type="button"
                className="rh-btn rh-btn--ok"
                disabled={ocupado}
                onClick={() => void aprovar(reg.id)}
              >
                Aprovar
              </button>
            )}
            {st !== "reprovado" && (
              <button
                type="button"
                className="rh-btn rh-btn--err"
                disabled={ocupado}
                onClick={() => {
                  setReprovandoId(reg.id);
                  setMotivo("");
                }}
              >
                Reprovar
              </button>
            )}
          </div>
        )}

        {st === "reprovado" && reg.motivoReprovacao && (
          <span className="rh-motivo">Motivo: {reg.motivoReprovacao}</span>
        )}
      </>
    );
  }

  if (carregando) return <p className="rh-msg">Carregando registros de ponto…</p>;

  return (
    <div className="rh-pontos">
      <h1>Pontos (RH)</h1>
      <p className="rh-lead">
        Batidas registradas no checklist pelos operadores. Confira a foto e o
        horário e aprove ou reprove cada batida — ou o dia inteiro.
      </p>

      <label className="rh-filtro">
        <input
          type="checkbox"
          checked={soPendentes}
          onChange={(e) => setSoPendentes(e.target.checked)}
        />
        Mostrar só dias com batidas pendentes
      </label>

      {erro && <p className="rh-msg rh-msg--err">{erro}</p>}

      {grupos.length === 0 ? (
        <p className="rh-msg">Nenhum registro de ponto encontrado.</p>
      ) : (
        <div className="rh-grupos">
          {grupos.map((g) => {
            const temPendente = g.batidas.some(
              (b) => statusDe(b) === "pendente",
            );
            // Batidas sem um dos 4 tipos conhecidos (ex.: registros antigos).
            const extras = g.batidas.filter((b) => !TIPOS_CONHECIDOS.has(b.tipo));
            return (
              <article key={g.chave} className="rh-grupo">
                <header className="rh-grupo__head">
                  <div>
                    <strong>{g.nome}</strong>
                    <span className="rh-grupo__dia">{diaLegivel(g.dia)}</span>
                  </div>
                  {temPendente && (
                    <button
                      type="button"
                      className="rh-btn rh-btn--ok"
                      disabled={ocupado}
                      onClick={() => void aprovarDia(g)}
                    >
                      Aprovar dia
                    </button>
                  )}
                </header>

                <ul className="rh-batidas">
                  {TIPOS_PONTO.map(({ tipo, label }) => {
                    const reg = g.batidas.find((b) => b.tipo === tipo);
                    return (
                      <li
                        key={tipo}
                        className={`rh-batida ${reg ? "" : "rh-batida--vazia"}`}
                      >
                        {reg ? (
                          corpoBatida(reg, label)
                        ) : (
                          <>
                            <span className="rh-batida__label">{label}</span>
                            <span className="rh-batida__sem">—</span>
                          </>
                        )}
                      </li>
                    );
                  })}

                  {extras.map((reg) => (
                    <li key={reg.id} className="rh-batida">
                      {corpoBatida(reg, "Batida (sem tipo)")}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      )}

      {fotoAmpliada && (
        <div
          className="rh-foto-modal"
          role="presentation"
          onClick={() => setFotoAmpliada("")}
        >
          <img src={fotoAmpliada} alt="Selfie ampliada" />
        </div>
      )}
    </div>
  );
}
