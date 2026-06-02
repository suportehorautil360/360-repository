import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STATUS_FRENTE_OPTIONS,
  isoParaDateInput,
  type Frente,
  type FrenteStatus,
  type NovaFrenteInput,
} from "./frentes-api";

export function NovaFrenteModal({
  frente,
  onFechar,
  onSalvar,
}: {
  /** Quando informado, o modal abre em modo edição. */
  frente?: Frente | null;
  onFechar: () => void;
  onSalvar: (dados: NovaFrenteInput) => Promise<void>;
}) {
  const editando = !!frente;
  const [nome, setNome] = useState(frente?.nome ?? "");
  const [endereco, setEndereco] = useState(frente?.endereco ?? "");
  const [responsavel, setResponsavel] = useState(frente?.responsavel ?? "");
  const [status, setStatus] = useState<FrenteStatus>(frente?.status ?? "Ativa");
  const [custo, setCusto] = useState<string>(
    frente ? String(frente.custo || "") : "",
  );
  const [inicio, setInicio] = useState(isoParaDateInput(frente?.inicio ?? ""));
  const [fim, setFim] = useState(isoParaDateInput(frente?.fim ?? ""));
  const [salvando, setSalvando] = useState(false);

  const podeSalvar =
    nome.trim() !== "" &&
    endereco.trim() !== "" &&
    responsavel.trim() !== "" &&
    inicio !== "";

  async function handleSalvar() {
    if (!podeSalvar || salvando) return;
    setSalvando(true);
    try {
      await onSalvar({
        nome,
        endereco,
        responsavel,
        status,
        custo: Number(custo) || 0,
        inicio,
        fim,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="ft-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={editando ? "Editar frente de trabalho" : "Nova frente de trabalho"}
      onClick={onFechar}
    >
      <div className="ft-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ft-modal__head">
          <h2>{editando ? "Editar Frente de Trabalho" : "Nova Frente de Trabalho"}</h2>
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
            <span className="ft-field__label">Nome da frente de trabalho</span>
            <input
              className="ft-input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Rodovia SP-310 — Trecho 4"
              autoFocus
            />
          </label>

          <label className="ft-field">
            <span className="ft-field__label">Local / Endereço</span>
            <input
              className="ft-input"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Ex: São Carlos, SP"
            />
          </label>

          <div className="ft-field-row">
            <label className="ft-field">
              <span className="ft-field__label">Responsável</span>
              <input
                className="ft-input"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                placeholder="Nome do responsável"
              />
            </label>

            <label className="ft-field">
              <span className="ft-field__label">Status</span>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as FrenteStatus)}
              >
                <SelectTrigger className="ft-select-trigger w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FRENTE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <label className="ft-field">
            <span className="ft-field__label">Custo estimado (R$)</span>
            <input
              type="number"
              min={0}
              step={1}
              className="ft-input"
              value={custo}
              onChange={(e) => setCusto(e.target.value)}
              placeholder="0"
            />
          </label>

          <div className="ft-field-row">
            <label className="ft-field">
              <span className="ft-field__label">Início</span>
              <input
                type="date"
                className="ft-input"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </label>

            <label className="ft-field">
              <span className="ft-field__label">Previsão de término</span>
              <input
                type="date"
                className="ft-input"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
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
            onClick={handleSalvar}
            disabled={!podeSalvar || salvando}
          >
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
