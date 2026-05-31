import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  defaultInterval,
  equipamentosApi,
  unitForTipo,
  type EquipRow,
  type StatusEquipamento,
  type UnidadeRevisao,
} from "./equipamentos/equipamentos-api";

interface EquipamentosSectionProps {
  prefeituraId: string;
  labelMunicipio: string;
}

interface EquipFormState {
  nomeModelo: string;
  chassis: string;
  placa: string;
  tipo: string;
  ano: string;
  medicaoAtual: string;
  marca: string;
  intervaloRevisao: string;
  unidadeRevisao: UnidadeRevisao | "auto";
}

interface RevisaoFormState {
  data: string;
  leitura: string;
  oficina: string;
  servicos: string;
  custo: string;
  notaFiscal: string;
}

const TIPO_OPTIONS = [
  "Carro Leve",
  "Caminhões",
  "Munck",
  "Pipa",
  "Basculante",
  "Betoneira",
  "Comboio",
  "Ambulância",
  "Baú",
  "Motoniveladora",
  "Escavadeira",
  "Trator de Esteira",
  "Retroescavadeira",
  "Pá Carregadeira",
  "Rolo Compactador",
  "Trator",
];

const emptyForm: EquipFormState = {
  nomeModelo: "",
  chassis: "",
  placa: "",
  tipo: "Carro",
  ano: "",
  medicaoAtual: "0",
  marca: "",
  intervaloRevisao: "0",
  unidadeRevisao: "auto",
};

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyRevisao(eq: EquipRow): RevisaoFormState {
  return {
    data: hojeISO(),
    leitura: String(eq.medicaoAtual || ""),
    oficina: "",
    servicos: "",
    custo: "",
    notaFiscal: "",
  };
}

function asNumber(value: string): number {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMedicao(value: number, unidade: UnidadeRevisao): string {
  return `${Math.max(0, value).toLocaleString("pt-BR")} ${unidade}`;
}

function statusRevisao(eq: EquipRow): "Bloqueado" | "Atenção" | "Em dia" {
  if (eq.status !== "ativo") return "Bloqueado";
  if (!eq.intervaloRevisao) return "Em dia";
  const usadoDesdeRevisao = eq.medicaoAtual - eq.ultimaRevisao;
  return usadoDesdeRevisao >= eq.intervaloRevisao ? "Atenção" : "Em dia";
}

function typeIcon(tipo: string): string {
  if (tipo === "Carro" || tipo === "Carro Leve" || tipo === "Van") return "🚗";
  if (
    [
      "Caminhões",
      "Munck",
      "Pipa",
      "Basculante",
      "Betoneira",
      "Comboio",
      "Baú",
    ].includes(tipo)
  )
    return "🚚";
  if (
    [
      "Motoniveladora",
      "Escavadeira",
      "Trator de Esteira",
      "Retroescavadeira",
      "Pá Carregadeira",
      "Rolo Compactador",
      "Trator",
    ].includes(tipo)
  )
    return "🚜";
  if (tipo === "Ônibus") return "🚌";
  return "🛠️";
}

export function EquipamentosSection({
  prefeituraId,
  labelMunicipio,
}: EquipamentosSectionProps) {
  const [lista, setLista] = useState<EquipRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState("");
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [form, setForm] = useState<EquipFormState>(emptyForm);
  const [editando, setEditando] = useState<EquipRow | null>(null);
  const [novaMedicao, setNovaMedicao] = useState("");
  const [revisando, setRevisando] = useState<EquipRow | null>(null);
  const [revForm, setRevForm] = useState<RevisaoFormState | null>(null);

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setLoading(true);
    try {
      setLista(await equipamentosApi.listar(prefeituraId));
    } catch (err) {
      console.error("[Prefeitura Equipamentos] Erro ao carregar:", err);
      toast.error("Não foi possível carregar os equipamentos.");
    } finally {
      setLoading(false);
    }
  }, [prefeituraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter((eq) =>
      [
        eq.descricao,
        eq.modelo,
        eq.marca,
        eq.chassis,
        eq.placa,
        eq.tipo,
        eq.obra,
        eq.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(termo),
    );
  }, [busca, lista]);

  const metricas = useMemo(() => {
    const bloqueados = lista.filter((eq) => statusRevisao(eq) === "Bloqueado");
    const atencao = lista.filter((eq) => statusRevisao(eq) === "Atenção");
    return {
      total: lista.length,
      ativos: lista.filter((eq) => eq.status === "ativo").length,
      bloqueados: bloqueados.length,
      atencao: atencao.length,
    };
  }, [lista]);

  const salvarNovo = async (event: FormEvent) => {
    event.preventDefault();
    if (!prefeituraId || saving) return;

    const nomeModelo = form.nomeModelo.trim();
    const chassis = form.chassis.trim();
    const placa = form.placa.trim();
    if (!nomeModelo || !chassis) {
      toast.error("Informe nome/modelo e chassi do equipamento.");
      return;
    }
    if (lista.some((eq) => eq.chassis.toLowerCase() === chassis.toLowerCase())) {
      toast.error("Já existe um equipamento com esse chassi.");
      return;
    }

    setSaving(true);
    try {
      const tipo = form.tipo || "Equipamento";
      const unidade =
        form.unidadeRevisao === "auto"
          ? unitForTipo(tipo)
          : form.unidadeRevisao;
      const medicaoAtual = asNumber(form.medicaoAtual);
      const intervaloRevisao =
        asNumber(form.intervaloRevisao) || defaultInterval(tipo, unidade);

      const nova = await equipamentosApi.criar(
        {
          descricao: nomeModelo,
          chassis,
          placa,
          tipo,
          ano: form.ano.trim(),
          marca: form.marca.trim(),
          medicaoAtual,
          intervaloRevisao,
          unidadeRevisao: unidade,
        },
        prefeituraId,
      );

      setLista((prev) =>
        [...prev, nova].sort((a, b) =>
          a.descricao.localeCompare(b.descricao, "pt-BR"),
        ),
      );
      setForm(emptyForm);
      setModalNovoAberto(false);
      toast.success("Equipamento cadastrado.");
    } catch (err) {
      console.error("[Prefeitura Equipamentos] Erro ao salvar:", err);
      toast.error("Não foi possível salvar o equipamento.");
    } finally {
      setSaving(false);
    }
  };

  const abrirAtualizacao = (eq: EquipRow) => {
    setEditando(eq);
    setNovaMedicao(String(eq.medicaoAtual || ""));
  };

  const atualizarMedicao = async (event: FormEvent) => {
    event.preventDefault();
    if (!editando || saving) return;
    const medicaoAtual = asNumber(novaMedicao);
    setSaving(true);
    try {
      await equipamentosApi.atualizarMedicao(editando.id, medicaoAtual);
      setLista((prev) =>
        prev.map((eq) =>
          eq.id === editando.id ? { ...eq, medicaoAtual } : eq,
        ),
      );
      setEditando(null);
      toast.success("Medição atualizada.");
    } catch (err) {
      console.error("[Prefeitura Equipamentos] Erro ao atualizar:", err);
      toast.error("Não foi possível atualizar a medição.");
    } finally {
      setSaving(false);
    }
  };

  const alternarBloqueio = async (eq: EquipRow) => {
    if (saving) return;
    const status: StatusEquipamento =
      eq.status === "bloqueado" ? "ativo" : "bloqueado";
    setSaving(true);
    try {
      await equipamentosApi.atualizarStatus(eq.id, status);
      setLista((prev) =>
        prev.map((item) => (item.id === eq.id ? { ...item, status } : item)),
      );
      toast.success(
        status === "bloqueado"
          ? "Equipamento bloqueado."
          : "Equipamento liberado.",
      );
    } catch (err) {
      console.error("[Prefeitura Equipamentos] Erro ao bloquear:", err);
      toast.error("Não foi possível alterar o status do equipamento.");
    } finally {
      setSaving(false);
    }
  };

  const remover = async (eq: EquipRow) => {
    if (saving) return;
    const ok = window.confirm(
      `Remover o equipamento "${eq.descricao}" (${eq.chassis || "sem ID"})? Esta ação não pode ser desfeita.`,
    );
    if (!ok) return;
    setSaving(true);
    try {
      await equipamentosApi.remover(eq.id);
      setLista((prev) => prev.filter((item) => item.id !== eq.id));
      toast.success("Equipamento removido.");
    } catch (err) {
      console.error("[Prefeitura Equipamentos] Erro ao remover:", err);
      toast.error("Não foi possível remover o equipamento.");
    } finally {
      setSaving(false);
    }
  };

  const abrirRevisao = (eq: EquipRow) => {
    setRevisando(eq);
    setRevForm(emptyRevisao(eq));
  };

  const concluirRevisao = async (event: FormEvent) => {
    event.preventDefault();
    if (!revisando || !revForm || saving) return;
    const leitura = asNumber(revForm.leitura);
    if (leitura < revisando.medicaoAtual) {
      toast.error("A leitura não pode ser menor que a medição atual.");
      return;
    }
    setSaving(true);
    try {
      await equipamentosApi.concluirRevisao(revisando, prefeituraId, {
        data: revForm.data,
        leitura,
        oficina: revForm.oficina,
        servicos: revForm.servicos,
        custo: asNumber(revForm.custo),
        notaFiscal: revForm.notaFiscal,
      });
      setLista((prev) =>
        prev.map((item) =>
          item.id === revisando.id
            ? {
                ...item,
                medicaoAtual: leitura,
                ultimaRevisao: leitura,
                status: "ativo",
              }
            : item,
        ),
      );
      setRevisando(null);
      setRevForm(null);
      toast.success("Revisão concluída e equipamento liberado.");
    } catch (err) {
      console.error("[Prefeitura Equipamentos] Erro na revisão:", err);
      toast.error(
        err instanceof Error ? err.message : "Não foi possível concluir a revisão.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="pf-eq-page">
        <div className="pf-eq-topline" />
        <p className="pf-eq-breadcrumb">
          <span>Clientes</span> /{" "}
          <strong id="pf-eq-bc-cliente">{labelMunicipio}</strong> /{" "}
          <span>Equipamentos</span>
        </p>
        <h1>Equipamentos</h1>

        <div className="pf-eq-notice">
          <span>
            <strong>Oficinas e postos credenciados</strong> também são geridos
            no Hub, no contexto deste município.
          </span>
          <Link to="/admin/equipamentos-locacao" className="pf-eq-hub-button">
            Abrir Hub — oficinas e postos
          </Link>
        </div>

        <div className="pf-eq-metrics">
          <article>
            <span>Total</span>
            <strong>{metricas.total}</strong>
          </article>
          <article>
            <span>Ativos</span>
            <strong>{metricas.ativos}</strong>
          </article>
          <article>
            <span>Em atenção</span>
            <strong>{metricas.atencao}</strong>
          </article>
          <article>
            <span>Bloqueados</span>
            <strong>{metricas.bloqueados}</strong>
          </article>
        </div>

        <section className="pf-eq-panel">
          <header className="pf-eq-panel-head">
            <h2>🔧 Equipamentos</h2>
            <div className="pf-eq-actions">
              <input
                type="search"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
                placeholder="Buscar por nome, placa, marca ou obra"
                aria-label="Buscar equipamentos"
              />
              <button
                className="pf-eq-primary"
                type="button"
                onClick={() => setModalNovoAberto(true)}
              >
                + Equipamento
              </button>
            </div>
          </header>

          <div className="pf-eq-table-wrap">
            <table className="pf-eq-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Chassi / Placa</th>
                  <th>Tipo</th>
                  <th>Marca</th>
                  <th>Ano</th>
                  <th>Medição</th>
                  <th>Frente de trabalho</th>
                  <th>Status rev.</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody id="pf-eq-tbody">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="pf-eq-empty">
                      Carregando equipamentos...
                    </td>
                  </tr>
                ) : null}
                {!loading &&
                  filtrados.map((eq) => {
                    const revisao = statusRevisao(eq);
                    return (
                      <tr key={eq.id}>
                        <td>
                          <strong>{eq.descricao || eq.modelo}</strong>
                          <small>{eq.modelo || eq.linha || "Equipamento"}</small>
                        </td>
                        <td>
                          <span className="pf-eq-plate">
                            {eq.chassis || "Sem ID"}
                          </span>
                          {eq.placa && eq.placa !== eq.chassis ? (
                            <small>Placa: {eq.placa}</small>
                          ) : null}
                        </td>
                        <td>
                          <span className="pf-eq-type">
                            {typeIcon(eq.tipo)} {eq.tipo}
                          </span>
                        </td>
                        <td>{eq.marca || "—"}</td>
                        <td>{eq.ano || "—"}</td>
                        <td>
                          {formatMedicao(eq.medicaoAtual, eq.unidadeRevisao)}
                        </td>
                        <td className={!eq.obra ? "pf-eq-muted" : undefined}>
                          {eq.obra || "Disponível"}
                        </td>
                        <td>
                          <span
                            className={`pf-eq-status pf-eq-status-${revisao
                              .toLowerCase()
                              .replace("ç", "c")
                              .replace("ã", "a")
                              .replace(" ", "-")}`}
                          >
                            {revisao}
                          </span>
                        </td>
                        <td>
                          <div className="pf-eq-row-actions">
                            <button
                              type="button"
                              className="pf-eq-secondary"
                              onClick={() => abrirAtualizacao(eq)}
                            >
                              Atualizar
                            </button>
                            <button
                              type="button"
                              className="pf-eq-secondary"
                              onClick={() => abrirRevisao(eq)}
                            >
                              Revisão
                            </button>
                            <button
                              type="button"
                              className="pf-eq-lock"
                              title={
                                eq.status === "bloqueado"
                                  ? "Desbloquear equipamento"
                                  : "Bloquear equipamento"
                              }
                              onClick={() => alternarBloqueio(eq)}
                            >
                              {eq.status === "bloqueado" ? "🔓" : "🔒"}
                            </button>
                            <button
                              type="button"
                              className="pf-eq-lock"
                              title="Remover equipamento"
                              onClick={() => remover(eq)}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {!loading && filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="pf-eq-empty">
                      Nenhum equipamento encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editando ? (
        <div className="pf-modal-overlay pf-eq-modal-overlay">
          <form className="pf-eq-modal" onSubmit={atualizarMedicao}>
            <header>
              <h2>
                Atualizar — {editando.descricao} ({editando.chassis || "sem ID"})
              </h2>
              <button type="button" onClick={() => setEditando(null)}>
                ×
              </button>
            </header>
            <div className="pf-eq-modal-body">
              <label>
                Horímetro atual ({editando.unidadeRevisao})
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={novaMedicao}
                  onChange={(event) => setNovaMedicao(event.target.value)}
                  autoFocus
                />
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button type="submit" disabled={saving}>
                Atualizar
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {revisando && revForm ? (
        <div className="pf-modal-overlay pf-eq-modal-overlay">
          <form className="pf-eq-modal pf-eq-modal-wide" onSubmit={concluirRevisao}>
            <header>
              <h2>
                Revisão — {revisando.descricao} (
                {revisando.chassis || "sem ID"})
              </h2>
              <button
                type="button"
                onClick={() => {
                  setRevisando(null);
                  setRevForm(null);
                }}
              >
                ×
              </button>
            </header>
            <div className="pf-eq-modal-body pf-eq-form-grid">
              <label>
                Data da revisão
                <input
                  type="date"
                  value={revForm.data}
                  onChange={(e) =>
                    setRevForm((p) => p && { ...p, data: e.target.value })
                  }
                />
              </label>
              <label>
                Leitura na revisão ({revisando.unidadeRevisao})
                <input
                  inputMode="numeric"
                  value={revForm.leitura}
                  onChange={(e) =>
                    setRevForm((p) => p && { ...p, leitura: e.target.value })
                  }
                  placeholder={String(revisando.medicaoAtual)}
                />
              </label>
              <label>
                Oficina / mecânico
                <input
                  value={revForm.oficina}
                  onChange={(e) =>
                    setRevForm((p) => p && { ...p, oficina: e.target.value })
                  }
                  placeholder="Oficina Central"
                />
              </label>
              <label>
                Custo (R$)
                <input
                  inputMode="numeric"
                  value={revForm.custo}
                  onChange={(e) =>
                    setRevForm((p) => p && { ...p, custo: e.target.value })
                  }
                  placeholder="0,00"
                />
              </label>
              <label>
                Nota fiscal
                <input
                  value={revForm.notaFiscal}
                  onChange={(e) =>
                    setRevForm((p) => p && { ...p, notaFiscal: e.target.value })
                  }
                  placeholder="NF-0394"
                />
              </label>
              <label className="pf-eq-form-full">
                Serviços executados
                <input
                  value={revForm.servicos}
                  onChange={(e) =>
                    setRevForm((p) => p && { ...p, servicos: e.target.value })
                  }
                  placeholder="Troca de óleo e filtros"
                />
              </label>
            </div>
            <footer>
              <button
                type="button"
                onClick={() => {
                  setRevisando(null);
                  setRevForm(null);
                }}
              >
                Cancelar
              </button>
              <button type="submit" disabled={saving}>
                Concluir e liberar
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {modalNovoAberto ? (
        <div className="pf-modal-overlay pf-eq-modal-overlay">
          <form className="pf-eq-modal pf-eq-modal-wide" onSubmit={salvarNovo}>
            <header>
              <h2>Adicionar equipamento</h2>
              <button type="button" onClick={() => setModalNovoAberto(false)}>
                ×
              </button>
            </header>
            <div className="pf-eq-modal-body pf-eq-form-grid">
              <label>
                Nome / modelo <span className="pf-eq-required">*</span>
                <input
                  required
                  value={form.nomeModelo}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      nomeModelo: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Scania R450"
                />
              </label>
              <label>
                Chassi <span className="pf-eq-required">*</span>
                <input
                  required
                  value={form.chassis}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, chassis: event.target.value }))
                  }
                  placeholder="Ex.: 9BWZZZ377VT004251 ou MQ-02"
                />
              </label>
              <label>
                Placa / ID visual
                <input
                  value={form.placa}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, placa: event.target.value }))
                  }
                  placeholder="Ex.: ABC-1234"
                />
              </label>
              <label>
                Tipo <span className="pf-eq-required">*</span>
                <select
                  required
                  value={form.tipo}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, tipo: event.target.value }))
                  }
                >
                  {TIPO_OPTIONS.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ano
                <input
                  value={form.ano}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, ano: event.target.value }))
                  }
                  placeholder="2022"
                  inputMode="numeric"
                />
              </label>
              <label>
                Km / horímetro atual
                <input
                  value={form.medicaoAtual}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      medicaoAtual: event.target.value,
                    }))
                  }
                  inputMode="numeric"
                />
              </label>
              <label>
                Marca
                <input
                  value={form.marca}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, marca: event.target.value }))
                  }
                  placeholder="Scania, Caterpillar..."
                />
              </label>
              <label>
                Intervalo revisão
                <input
                  value={form.intervaloRevisao}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      intervaloRevisao: event.target.value,
                    }))
                  }
                  placeholder="0 = usar padrão"
                  inputMode="numeric"
                />
              </label>
              <label>
                Unidade revisão
                <select
                  value={form.unidadeRevisao}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      unidadeRevisao: event.target
                        .value as EquipFormState["unidadeRevisao"],
                    }))
                  }
                >
                  <option value="auto">Auto (por tipo)</option>
                  <option value="km">Km</option>
                  <option value="h">Horas</option>
                </select>
              </label>
            </div>
            <footer>
              <button type="button" onClick={() => setModalNovoAberto(false)}>
                Cancelar
              </button>
              <button type="submit" disabled={saving}>
                Salvar
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </>
  );
}
