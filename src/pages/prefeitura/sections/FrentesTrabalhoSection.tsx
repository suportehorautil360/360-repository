import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  frentesApi,
  formatDataBR,
  formatCustoBR,
  type Frente,
  type FrenteStatus,
  type NovaFrenteInput,
} from "./frentes/frentes-api";
import { NovaFrenteModal } from "./frentes/NovaFrenteModal";
import { equipamentosApi, type EquipRow } from "./equipamentos/equipamentos-api";
import "./frentes.css";

function iconeTipo(tipo: string): string {
  const t = tipo.toLowerCase();
  if (/escav|retro|trator|carregadeira|motonivel|rolo|m[aá]quina/.test(t))
    return "🚜";
  if (/caminh|truck|basculante|pipa|munck|comboio|betoneira|ba[uú]/.test(t))
    return "🚚";
  if (/van|sprinter|furg/.test(t)) return "🚐";
  if (/ambul/.test(t)) return "🚑";
  return "🚗";
}

const STATUS_CLASSE: Record<FrenteStatus, string> = {
  Ativa: "ft-badge--ativa",
  Pausada: "ft-badge--pausada",
  Concluída: "ft-badge--concluida",
};

export function FrentesTrabalhoSection({
  prefeituraId,
}: {
  prefeituraId: string;
}) {
  const [frentes, setFrentes] = useState<Frente[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  // null = fechado; { frente: null } = nova; { frente: Frente } = editar
  const [modal, setModal] = useState<{ frente: Frente | null } | null>(null);
  // Rascunho de alocação por frente: { [frenteId]: { vehicleId, funcao } }
  const [rascunho, setRascunho] = useState<
    Record<string, { vehicleId: string; funcao: string }>
  >({});

  const equipPorId = useMemo(() => {
    const m = new Map<string, EquipRow>();
    equipamentos.forEach((e) => m.set(e.id, e));
    return m;
  }, [equipamentos]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [fr, eq] = await Promise.all([
        frentesApi.listar(prefeituraId),
        equipamentosApi.listar(prefeituraId),
      ]);
      // Resolve o nome de cada equipamento alocado pela lista de equipamentos.
      const eqMap = new Map(eq.map((e) => [e.id, e]));
      setFrentes(
        fr.map((f) => ({
          ...f,
          equipamentos: f.equipamentos.map((al) => ({
            ...al,
            nome: eqMap.get(al.vehicleId)?.descricao || al.nome,
          })),
        })),
      );
      setEquipamentos(eq);
    } catch {
      toast.error("Não foi possível carregar as frentes de trabalho.");
    } finally {
      setCarregando(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleSalvar(dados: NovaFrenteInput) {
    const emEdicao = modal?.frente ?? null;
    try {
      if (emEdicao) {
        await frentesApi.atualizar(emEdicao.id, dados);
        toast.success("Frente de trabalho atualizada.");
      } else {
        await frentesApi.criar(dados, prefeituraId);
        toast.success("Frente de trabalho criada.");
      }
      setModal(null);
      await carregar();
    } catch {
      toast.error(
        emEdicao
          ? "Não foi possível atualizar a frente de trabalho."
          : "Não foi possível criar a frente de trabalho.",
      );
    }
  }

  async function handleRemover(frente: Frente) {
    if (
      !window.confirm(
        `Remover a frente "${frente.nome}"? As alocações vinculadas também serão removidas.`,
      )
    )
      return;
    try {
      await frentesApi.remover(frente.id);
      toast.success("Frente de trabalho removida.");
      setFrentes((prev) => prev.filter((f) => f.id !== frente.id));
    } catch {
      toast.error("Não foi possível remover a frente.");
    }
  }

  async function handleAlocar(frente: Frente) {
    const draft = rascunho[frente.id];
    const vehicleId = draft?.vehicleId ?? "";
    const equip = equipPorId.get(vehicleId);
    if (!equip) {
      toast.error("Selecione um equipamento.");
      return;
    }
    try {
      await frentesApi.alocar({
        frente,
        vehicleId,
        placa: equip.placa || equip.chassis,
        funcao: draft?.funcao ?? "",
        prefeituraId,
      });
      toast.success("Equipamento alocado.");
      setRascunho((prev) => ({
        ...prev,
        [frente.id]: { vehicleId: "", funcao: "" },
      }));
      await carregar();
    } catch {
      toast.error("Não foi possível alocar o equipamento.");
    }
  }

  async function handleDesalocar(frente: Frente, allocationId: string) {
    try {
      await frentesApi.desalocar(allocationId);
      setFrentes((prev) =>
        prev.map((f) =>
          f.id === frente.id
            ? {
                ...f,
                equipamentos: f.equipamentos.filter(
                  (e) => e.allocationId !== allocationId,
                ),
              }
            : f,
        ),
      );
    } catch {
      toast.error("Não foi possível desalocar o equipamento.");
    }
  }

  function setDraft(
    frenteId: string,
    patch: Partial<{ vehicleId: string; funcao: string }>,
  ) {
    setRascunho((prev) => ({
      ...prev,
      [frenteId]: {
        vehicleId: prev[frenteId]?.vehicleId ?? "",
        funcao: prev[frenteId]?.funcao ?? "",
        ...patch,
      },
    }));
  }

  return (
    <section className="ft-page">
      <div className="ft-head">
        <h1 className="ft-title">Frentes de Trabalho cadastradas</h1>
        <button
          type="button"
          className="ft-btn-primary ft-btn-primary--lg"
          onClick={() => setModal({ frente: null })}
        >
          + Nova Frente de Trabalho
        </button>
      </div>

      {carregando ? (
        <p className="ft-empty">Carregando frentes de trabalho...</p>
      ) : frentes.length === 0 ? (
        <p className="ft-empty">
          Nenhuma frente de trabalho cadastrada. Clique em “+ Nova Frente de
          Trabalho” para começar.
        </p>
      ) : (
        <div className="ft-list">
          {frentes.map((f) => {
            const draft = rascunho[f.id] ?? { vehicleId: "", funcao: "" };
            return (
              <article key={f.id} className="ft-card">
                <header className="ft-card__head">
                  <div className="ft-card__info">
                    <h2 className="ft-card__name">{f.nome}</h2>
                    <p className="ft-card__meta">
                      📍 {f.endereco || "—"} · Resp: {f.responsavel || "—"}
                    </p>
                    <p className="ft-card__meta">
                      📅 {formatDataBR(f.inicio)} → {formatDataBR(f.fim)} ·
                      Custo: <strong>{formatCustoBR(f.custo)}</strong>
                    </p>
                  </div>
                  <div className="ft-card__actions">
                    <span className={`ft-badge ${STATUS_CLASSE[f.status]}`}>
                      {f.status}
                    </span>
                    <div className="ft-card__btns">
                      <button
                        type="button"
                        className="ft-btn-edit"
                        onClick={() => setModal({ frente: f })}
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        className="ft-btn-danger"
                        onClick={() => handleRemover(f)}
                      >
                        🗑 Remover
                      </button>
                    </div>
                  </div>
                </header>

                <p className="ft-card__label">Equipamentos</p>
                <div className="ft-chips">
                  {f.equipamentos.length === 0 ? (
                    <span className="ft-chips__empty">
                      Nenhum equipamento alocado.
                    </span>
                  ) : (
                    f.equipamentos.map((al) => {
                      const eq = equipPorId.get(al.vehicleId);
                      return (
                        <span key={al.allocationId} className="ft-chip">
                          <span aria-hidden>
                            {iconeTipo(eq?.tipo ?? "")}
                          </span>
                          {al.nome}
                          {al.funcao ? (
                            <em className="ft-chip__func"> · {al.funcao}</em>
                          ) : null}
                          <button
                            type="button"
                            className="ft-chip__x"
                            aria-label={`Desalocar ${al.nome}`}
                            onClick={() => handleDesalocar(f, al.allocationId)}
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>

                <div className="ft-alocar">
                  <Select
                    value={draft.vehicleId}
                    onValueChange={(v) => setDraft(f.id, { vehicleId: v })}
                  >
                    <SelectTrigger className="ft-select-trigger ft-alocar__select">
                      <SelectValue placeholder="Selecione um equipamento..." />
                    </SelectTrigger>
                    <SelectContent>
                      {equipamentos.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.descricao}
                          {e.placa ? ` (${e.placa})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    className="ft-input ft-alocar__func"
                    value={draft.funcao}
                    onChange={(e) => setDraft(f.id, { funcao: e.target.value })}
                    placeholder="Função na Frente de Trabalho..."
                  />
                  <button
                    type="button"
                    className="ft-btn-primary ft-alocar__btn"
                    onClick={() => handleAlocar(f)}
                  >
                    + Alocar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modal && (
        <NovaFrenteModal
          frente={modal.frente}
          onFechar={() => setModal(null)}
          onSalvar={handleSalvar}
        />
      )}
    </section>
  );
}
