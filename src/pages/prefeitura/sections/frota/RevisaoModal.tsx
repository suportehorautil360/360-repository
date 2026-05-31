import { useState } from "react";
import {
  textoVencimento,
  unidadeDe,
  type RevisaoInput,
  type VeiculoFrota,
} from "./types";
import "./frota.css";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Extrai só os dígitos de um texto e devolve o valor em centavos. */
function digitosParaCentavos(raw: string): number {
  const d = raw.replace(/\D/g, "");
  return d ? parseInt(d, 10) : 0;
}

/** Formata centavos como "R$ 1.234,56" (vazio quando 0). */
function formatBRL(centavos: number): string {
  if (!centavos) return "";
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function RevisaoModal({
  veiculo,
  onFechar,
  onConfirmar,
}: {
  veiculo: VeiculoFrota;
  onFechar: () => void;
  onConfirmar: (dados: RevisaoInput) => Promise<void>;
}) {
  const unidade = unidadeDe(veiculo.tipo);
  const [data, setData] = useState(hojeISO());
  const [hodometro, setHodometro] = useState<number | "">("");
  const [oficina, setOficina] = useState("");
  const [servicos, setServicos] = useState("");
  const [custoCents, setCustoCents] = useState(0);
  const [notaFiscal, setNotaFiscal] = useState("");
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  const novoLimite =
    typeof hodometro === "number" ? hodometro + veiculo.intervaloRevisao : null;

  async function handleConfirmar() {
    if (typeof hodometro !== "number" || hodometro <= 0) {
      setMsg("Informe o hodômetro / horas registrado na revisão.");
      return;
    }
    if (hodometro < veiculo.medicaoAtual) {
      setMsg(
        `A leitura não pode ser menor que a atual (${veiculo.medicaoAtual.toLocaleString("pt-BR")} ${unidade}).`,
      );
      return;
    }
    setSalvando(true);
    try {
      await onConfirmar({
        data,
        hodometro,
        oficina,
        servicos,
        custo: custoCents / 100,
        notaFiscal,
      });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao concluir a revisão.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="frota-modal-backdrop"
      role="presentation"
      onClick={onFechar}
    >
      <div
        className="frota-modal frota-modal--rev"
        role="dialog"
        aria-modal="true"
        aria-label="Liberar bloqueio de revisão"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="frota-rev__head">
          <div>
            <h3 style={{ margin: 0 }}>🔒 Liberar bloqueio de revisão</h3>
            <p className="frota-rev__veic">
              Veículo: <strong>{veiculo.placa}</strong> — {veiculo.nome}
            </p>
          </div>
          <button
            type="button"
            className="frota-rev__close"
            onClick={onFechar}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="frota-rev__alerta">
          <span aria-hidden="true">⚠️</span>
          <div>
            <strong>Revisão vencida</strong>
            <p>{textoVencimento(veiculo)}</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleConfirmar();
          }}
        >
          <div className="frota-modal__grid">
            <div>
              <label htmlFor="rev-data">Data da revisão realizada</label>
              <input
                id="rev-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="rev-hod">
                Hodômetro / horas na revisão ({unidade})
              </label>
              <input
                id="rev-hod"
                type="number"
                min={0}
                placeholder="Ex: 183900"
                value={hodometro}
                onChange={(e) =>
                  setHodometro(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
              />
            </div>
            <div className="full">
              <label htmlFor="rev-oficina">Oficina / responsável</label>
              <input
                id="rev-oficina"
                type="text"
                placeholder="Nome da oficina ou mecânico"
                value={oficina}
                onChange={(e) => setOficina(e.target.value)}
              />
            </div>
            <div className="full">
              <label htmlFor="rev-serv">Serviços realizados</label>
              <textarea
                id="rev-serv"
                rows={3}
                placeholder="Descreva os serviços realizados…"
                value={servicos}
                onChange={(e) => setServicos(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="rev-custo">Custo da revisão (R$)</label>
              <input
                id="rev-custo"
                type="text"
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={formatBRL(custoCents)}
                onChange={(e) =>
                  setCustoCents(digitosParaCentavos(e.target.value))
                }
              />
            </div>
            <div>
              <label htmlFor="rev-nf">Nota fiscal</label>
              <input
                id="rev-nf"
                type="text"
                placeholder="NF-00000"
                value={notaFiscal}
                onChange={(e) => setNotaFiscal(e.target.value)}
              />
            </div>
          </div>

          <div className="frota-rev__aviso">
            <strong>Atenção:</strong> ao confirmar, o próximo limite de revisão
            será recalculado
            {novoLimite != null && (
              <>
                {" "}
                para {novoLimite.toLocaleString("pt-BR")} {unidade}
              </>
            )}{" "}
            e o uso será liberado imediatamente.
          </div>

          <p className="frota-modal__msg">{msg}</p>

          <div className="frota-modal__footer">
            <button
              type="button"
              className="frota-btn frota-btn--secundario"
              onClick={onFechar}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="frota-btn frota-btn-confirmar"
              disabled={salvando}
            >
              {salvando ? "Salvando…" : "✓ Confirmar revisão e liberar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
