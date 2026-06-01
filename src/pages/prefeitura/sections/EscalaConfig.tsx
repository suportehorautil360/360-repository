import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
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

/** Cadastro da escala (jornada) da prefeitura. */
export function EscalaConfig({
  prefeituraId,
  escala,
  onSalvo,
}: {
  prefeituraId: string;
  escala: Escala | null;
  onSalvo: () => void;
}) {
  const [inicio, setInicio] = useState(PADRAO.inicio);
  const [fim, setFim] = useState(PADRAO.fim);
  const [dias, setDias] = useState<number[]>(PADRAO.diasSemana);
  const [almoco, setAlmoco] = useState(PADRAO.almocoMinutos);
  const [salvando, setSalvando] = useState(false);

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
      prev.includes(n)
        ? prev.filter((d) => d !== n)
        : [...prev, n].sort((a, b) => a - b),
    );
  }

  async function salvar() {
    if (salvando) return;
    setSalvando(true);
    try {
      await escalaApi.salvar({
        prefeituraId,
        inicio,
        fim,
        diasSemana: dias,
        almocoMinutos: almoco,
      });
      toast.success("Escala salva.");
      onSalvo();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar a escala.");
    } finally {
      setSalvando(false);
    }
  }

  const resumo = escala
    ? `${escala.inicio}–${escala.fim} · ${[...escala.diasSemana]
        .sort((a, b) => a - b)
        .map((d) => DIAS[d].label)
        .join(", ")} · almoço ${escala.almocoMinutos}min`
    : null;

  return (
    <div className="cfg__escala">
      <p className={`cfg__escala-atual${resumo ? "" : " is-off"}`}>
        {resumo ? (
          <>
            Jornada atual: <strong>{resumo}</strong>
          </>
        ) : (
          "Jornada ainda não definida."
        )}
      </p>

      <div className="cfg__escala-campos">
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
            inputMode="numeric"
            value={almoco}
            onChange={(e) => setAlmoco(Number(e.target.value) || 0)}
          />
        </label>
      </div>

      <span className="cfg__escala-rotulo">Dias úteis</span>
      <div className="cfg__escala-dias">
        {DIAS.map((d) => {
          const on = dias.includes(d.n);
          return (
            <button
              key={d.n}
              type="button"
              className={`cfg__dia${on ? " is-on" : ""}`}
              aria-pressed={on}
              onClick={() => toggleDia(d.n)}
            >
              {d.label}
            </button>
          );
        })}
      </div>

      <div className="cfg__card-foot">
        <button
          type="button"
          className="cfg__btn cfg__btn--primary"
          disabled={salvando}
          onClick={() => void salvar()}
        >
          <Save size={14} /> {salvando ? "Salvando…" : "Salvar escala"}
        </button>
      </div>
    </div>
  );
}
