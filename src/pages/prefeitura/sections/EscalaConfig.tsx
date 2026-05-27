import { useEffect, useState } from "react";
import { escalaApi, type Escala } from "../../../lib/api/escala";

const DIAS = [
  { n: 0, label: "Dom" },
  { n: 1, label: "Seg" },
  { n: 2, label: "Ter" },
  { n: 3, label: "Qua" },
  { n: 4, label: "Qui" },
  { n: 5, label: "Sex" },
  { n: 6, label: "Sáb" },
];

const PADRAO = {
  inicio: "08:00",
  fim: "18:00",
  diasSemana: [1, 2, 3, 4, 5],
  almocoMinutos: 60,
};

/** Cadastro da escala (jornada) da prefeitura — usado no topo do RH. */
export function EscalaConfig({
  prefeituraId,
  escala,
  onSalvo,
}: {
  prefeituraId: string;
  escala: Escala | null;
  onSalvo: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState(PADRAO.inicio);
  const [fim, setFim] = useState(PADRAO.fim);
  const [dias, setDias] = useState<number[]>(PADRAO.diasSemana);
  const [almoco, setAlmoco] = useState(PADRAO.almocoMinutos);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (escala) {
      setInicio(escala.inicio);
      setFim(escala.fim);
      setDias(escala.diasSemana);
      setAlmoco(escala.almocoMinutos);
    }
  }, [escala]);

  function toggleDia(n: number) {
    setDias((prev) =>
      prev.includes(n) ? prev.filter((d) => d !== n) : [...prev, n].sort(),
    );
  }

  async function salvar() {
    setSalvando(true);
    setMsg("");
    try {
      await escalaApi.salvar({
        prefeituraId,
        inicio,
        fim,
        diasSemana: dias,
        almocoMinutos: almoco,
      });
      setMsg("Escala salva.");
      onSalvo();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao salvar a escala.");
    } finally {
      setSalvando(false);
    }
  }

  const resumo = escala
    ? `${escala.inicio}–${escala.fim} · ${escala.diasSemana
        .map((d) => DIAS[d].label)
        .join(", ")} · almoço ${escala.almocoMinutos}min`
    : "não definida";

  return (
    <section className="rh-escala">
      <button
        type="button"
        className="rh-escala__toggle"
        onClick={() => setAberto((v) => !v)}
      >
        <span>
          ⏱ Escala da jornada: <strong>{resumo}</strong>
        </span>
        <span aria-hidden="true">{aberto ? "▲" : "▼"}</span>
      </button>

      {aberto && (
        <div className="rh-escala__form">
          <div className="rh-escala__linha">
            <label>
              Início
              <input
                type="time"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </label>
            <label>
              Fim
              <input
                type="time"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </label>
            <label>
              Almoço (min)
              <input
                type="number"
                min={0}
                value={almoco}
                onChange={(e) => setAlmoco(Number(e.target.value))}
              />
            </label>
          </div>

          <div className="rh-escala__dias">
            {DIAS.map((d) => (
              <label key={d.n} className="rh-escala__dia">
                <input
                  type="checkbox"
                  checked={dias.includes(d.n)}
                  onChange={() => toggleDia(d.n)}
                />
                {d.label}
              </label>
            ))}
          </div>

          <div className="rh-escala__acoes">
            <button
              type="button"
              className="rh-btn rh-btn--ok"
              disabled={salvando}
              onClick={() => void salvar()}
            >
              {salvando ? "Salvando…" : "Salvar escala"}
            </button>
            {msg && <span className="rh-escala__msg">{msg}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
