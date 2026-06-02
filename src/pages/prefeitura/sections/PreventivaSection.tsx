import { useMemo, useState } from "react";
import { toast } from "sonner";
import "./preventiva.css";
import { useFrota } from "./frota/use-frota";
import type { VeiculoFrota } from "./frota/types";
import { montarPreventivas, type PreventivaRow } from "./preventiva-model";

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS: Record<PreventivaRow["status"], { label: string; cls: string }> = {
  "em-dia": { label: "Em dia", cls: "is-ok" },
  vencida: { label: "Vencida", cls: "is-overdue" },
  proxima: { label: "Próxima", cls: "is-next" },
};

export function PreventivaSection({ prefeituraId }: { prefeituraId: string }) {
  const frota = useFrota(prefeituraId);
  const [registrando, setRegistrando] = useState<string | null>(null);

  const rows = useMemo(() => montarPreventivas(frota.lista), [frota.lista]);

  async function handleFeito(v: VeiculoFrota) {
    setRegistrando(v.id);
    try {
      // Registro rápido: zera o ciclo adotando a leitura atual como base.
      await frota.registrarRevisao(v, {
        data: hojeISO(),
        hodometro: v.medicaoAtual,
        oficina: "",
        servicos: "Preventiva (registro rápido)",
        custo: 0,
        notaFiscal: "",
      });
      toast.success("Preventiva registrada.");
    } catch {
      toast.error("Não foi possível registrar a preventiva.");
    } finally {
      setRegistrando(null);
    }
  }

  return (
    <section className="pv-page">
      <div className="pv-wrap">
        <div className="pv-head">
          <h1 className="pv-title">Plano de manutenção preventiva</h1>
        </div>

        {frota.loading ? (
          <p className="pv-empty">Carregando preventivas...</p>
        ) : rows.length === 0 ? (
          <p className="pv-empty">Nenhum equipamento cadastrado.</p>
        ) : (
          <div className="pv-table-wrap">
            <table className="pv-table">
              <thead>
                <tr>
                  <th>ID (Chassi / Placa)</th>
                  <th>Nome do Equipamento</th>
                  <th>Tipo de Medidor</th>
                  <th>Plano / Intervalo</th>
                  <th>Última Preventiva</th>
                  <th>Próxima Preventiva (Meta)</th>
                  <th>Leitura Atual</th>
                  <th>Restante para Vencer</th>
                  <th>Status / Alerta</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const st = STATUS[row.status];
                  return (
                    <tr key={row.id}>
                      <td>{row.idChassiPlaca}</td>
                      <td>{row.nomeEquipamento}</td>
                      <td>{row.tipoMedidor}</td>
                      <td>{row.planoIntervalo}</td>
                      <td>{row.ultimaPreventiva}</td>
                      <td>{row.proximaPreventivaMeta}</td>
                      <td>{row.leituraAtual}</td>
                      <td>{row.restanteParaVencer}</td>
                      <td>
                        <span className={`pv-status ${st.cls}`}>{st.label}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="pv-done"
                          disabled={registrando === row.id}
                          onClick={() => {
                            const v = frota.lista.find((e) => e.id === row.id);
                            if (v) void handleFeito(v);
                          }}
                        >
                          <span aria-hidden="true">✓</span>
                          <span>
                            {registrando === row.id ? "..." : "Feito"}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
