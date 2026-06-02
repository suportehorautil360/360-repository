import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Frente } from "../frentes/frentes-api";
import type { EquipRow } from "../equipamentos/equipamentos-api";

function hojeInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface AlocarSubmit {
  vehicleId: string;
  frenteId: string;
  funcao: string;
  dataAlocacao: string; // yyyy-mm-dd
}

export function AlocarModal({
  equipamentos,
  frentes,
  onFechar,
  onAlocar,
}: {
  equipamentos: EquipRow[];
  frentes: Frente[];
  onFechar: () => void;
  onAlocar: (dados: AlocarSubmit) => Promise<void>;
}) {
  const [vehicleId, setVehicleId] = useState("");
  const [frenteId, setFrenteId] = useState("");
  const [funcao, setFuncao] = useState("");
  const [data, setData] = useState(hojeInput());
  const [salvando, setSalvando] = useState(false);

  const podeAlocar = vehicleId !== "" && frenteId !== "" && data !== "";

  async function handleAlocar() {
    if (!podeAlocar || salvando) return;
    setSalvando(true);
    try {
      await onAlocar({ vehicleId, frenteId, funcao, dataAlocacao: data });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="ft-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Alocar equipamento"
      onClick={onFechar}
    >
      <div className="ft-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ft-modal__head">
          <h2>Alocar Equipamento</h2>
          <button
            type="button"
            className="ft-modal__close"
            onClick={onFechar}
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>

        <div className="ft-modal__body">
          <label className="ft-field">
            <span className="ft-field__label">Equipamento</span>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger className="ft-select-trigger w-full">
                <SelectValue placeholder="Selecione um equipamento..." />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                {equipamentos.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.descricao}
                    {e.placa ? ` (${e.placa})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="ft-field">
            <span className="ft-field__label">Frente de trabalho de destino</span>
            <Select value={frenteId} onValueChange={setFrenteId}>
              <SelectTrigger className="ft-select-trigger w-full">
                <SelectValue placeholder="Selecione a frente..." />
              </SelectTrigger>
              <SelectContent className="z-[70]">
                {frentes.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div className="ft-field-row">
            <label className="ft-field">
              <span className="ft-field__label">Data de alocação</span>
              <input
                type="date"
                className="ft-input"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </label>

            <label className="ft-field">
              <span className="ft-field__label">Função na frente de trabalho</span>
              <input
                className="ft-input"
                value={funcao}
                onChange={(e) => setFuncao(e.target.value)}
                placeholder="Ex: Escavação, Transporte..."
              />
            </label>
          </div>
        </div>

        <footer className="ft-modal__foot">
          <button type="button" className="ft-btn-ghost" onClick={onFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="ft-btn-primary"
            onClick={handleAlocar}
            disabled={!podeAlocar || salvando}
          >
            {salvando ? "Alocando..." : "Alocar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
