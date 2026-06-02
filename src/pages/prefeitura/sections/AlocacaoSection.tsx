import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { frentesApi, type Frente } from "./frentes/frentes-api";
import { equipamentosApi, type EquipRow } from "./equipamentos/equipamentos-api";
import { iconeTipo } from "./equipamentos/icone";
import { montarAlocacoes } from "./alocacao/alocacao-model";
import { AlocarModal, type AlocarSubmit } from "./alocacao/AlocarModal";
import "./alocacao.css";

export function AlocacaoSection({ prefeituraId }: { prefeituraId: string }) {
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [fr, eq] = await Promise.all([
        frentesApi.listar(prefeituraId),
        equipamentosApi.listar(prefeituraId),
      ]);
      setFrentes(fr);
      setEquipamentos(eq);
    } catch {
      toast.error("Não foi possível carregar as alocações.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const { alocados, disponiveis } = useMemo(
    () => montarAlocacoes(frentes, equipamentos),
    [frentes, equipamentos],
  );

  async function handleAlocar(dados: AlocarSubmit) {
    const frente = frentes.find((f) => f.id === dados.frenteId);
    const equip = equipamentos.find((e) => e.id === dados.vehicleId);
    if (!frente || !equip) {
      toast.error("Selecione equipamento e frente.");
      return;
    }
    try {
      await frentesApi.alocar({
        frente,
        vehicleId: equip.id,
        placa: equip.placa || equip.chassis,
        funcao: dados.funcao,
        prefeituraId,
        dataAlocacao: dados.dataAlocacao,
      });
      toast.success("Equipamento alocado.");
      setModalAberto(false);
      await carregar();
    } catch {
      toast.error("Não foi possível alocar o equipamento.");
    }
  }

  return (
    <section className="al-page">
      <div className="al-head">
        <h1 className="al-title">Alocação de equipamentos</h1>
        <button
          type="button"
          className="ft-btn-primary ft-btn-primary--lg"
          onClick={() => setModalAberto(true)}
        >
          + Alocar
        </button>
      </div>

      <div className="al-card">
        <p className="al-card__title">Equipamentos alocados</p>
        {carregando ? (
          <p className="al-empty">Carregando alocações...</p>
        ) : alocados.length === 0 ? (
          <p className="al-empty">Nenhum equipamento alocado.</p>
        ) : (
          <div className="al-table-wrap">
            <table className="al-table">
              <thead>
                <tr>
                  <th>Equipamento</th>
                  <th>Placa</th>
                  <th>Frente de trabalho</th>
                  <th>Desde</th>
                  <th>Função</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {alocados.map((r) => (
                  <tr key={r.allocationId}>
                    <td>
                      <span className="al-equip">
                        <span aria-hidden>{iconeTipo(r.tipo)}</span>
                        {r.equipamento}
                      </span>
                    </td>
                    <td>
                      <span className="al-plate">{r.placa}</span>
                    </td>
                    <td>{r.frenteNome}</td>
                    <td>{r.desde}</td>
                    <td>{r.funcao}</td>
                    <td>
                      <span className="al-badge">{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="al-card">
        <p className="al-card__title">Disponíveis (sem frente de trabalho)</p>
        {carregando ? (
          <p className="al-empty">Carregando...</p>
        ) : disponiveis.length === 0 ? (
          <p className="al-empty">Nenhum equipamento disponível.</p>
        ) : (
          <div className="al-chips">
            {disponiveis.map((e) => (
              <span key={e.id} className="al-chip">
                <span aria-hidden>{iconeTipo(e.tipo)}</span>
                {e.descricao}
                {e.placa ? <em className="al-chip__plate"> {e.placa}</em> : null}
              </span>
            ))}
          </div>
        )}
      </div>

      {modalAberto && (
        <AlocarModal
          equipamentos={equipamentos}
          frentes={frentes}
          onFechar={() => setModalAberto(false)}
          onAlocar={handleAlocar}
        />
      )}
    </section>
  );
}
