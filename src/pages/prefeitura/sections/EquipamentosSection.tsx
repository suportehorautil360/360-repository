import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../lib/firebase/firebase";

interface EquipamentosSectionProps {
  prefeituraId: string;
  labelMunicipio: string;
}

type UnidadeRevisao = "km" | "h";
type StatusEquipamento = "ativo" | "bloqueado" | "inativo";

interface EquipRow {
  id: string;
  descricao: string;
  marca: string;
  modelo: string;
  chassis: string;
  placa: string;
  linha: string;
  tipo: string;
  ano: string;
  obra: string;
  status: StatusEquipamento;
  medicaoAtual: number;
  intervaloRevisao: number;
  ultimaRevisao: number;
  unidadeRevisao: UnidadeRevisao;
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

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function inferTipo(data: Record<string, unknown>): string {
  const raw = `${asText(data.tipo)} ${asText(data.linha)} ${asText(
    data.descricao,
  )} ${asText(data.modelo)}`.toLowerCase();
  if (
    raw.includes("carro leve") ||
    raw.includes("linha leve") ||
    raw.includes("veiculo leve") ||
    raw.includes("veículo leve") ||
    raw.includes("automovel") ||
    raw.includes("automóvel")
  )
    return "Carro Leve";
  if (raw.includes("munck") || raw.includes("munk")) return "Munck";
  if (raw.includes("pipa")) return "Pipa";
  if (raw.includes("basculante")) return "Basculante";
  if (raw.includes("betoneira")) return "Betoneira";
  if (raw.includes("comboio")) return "Comboio";
  if (raw.includes("ambulancia") || raw.includes("ambulância"))
    return "Ambulância";
  if (raw.includes("baú") || raw.includes("bau")) return "Baú";
  if (raw.includes("motoniveladora")) return "Motoniveladora";
  if (raw.includes("escavadeira")) return "Escavadeira";
  if (
    raw.includes("trator de esteira") ||
    (raw.includes("trator") && raw.includes("esteira"))
  )
    return "Trator de Esteira";
  if (raw.includes("retroescavadeira")) return "Retroescavadeira";
  if (
    raw.includes("pa carregadeira") ||
    raw.includes("pá carregadeira") ||
    raw.includes("carregadeira")
  )
    return "Pá Carregadeira";
  if (raw.includes("rolo compactador") || raw.includes("compactador"))
    return "Rolo Compactador";
  if (/carro|leve|hatch|sedan|pickup|camionete/.test(raw)) return "Carro";
  if (/van|sprinter|furg[aã]o/.test(raw)) return "Van";
  if (/caminh|truck|pipa|munck|basculante|comboio|betoneira/.test(raw)) {
    return "Caminhão";
  }
  if (/m[aá]quina|escav|retro|p[aá] carregadeira|trator|komatsu|caterpillar/.test(raw)) {
    return "Máquina";
  }
  return asText(data.tipo) || asText(data.linha) || "Equipamento";
}

function unitForTipo(tipo: string, fallback?: string): UnidadeRevisao {
  if (fallback === "h" || fallback === "km") return fallback;
  return [
    "motoniveladora",
    "escavadeira",
    "trator de esteira",
    "retroescavadeira",
    "pá carregadeira",
    "pa carregadeira",
    "rolo compactador",
    "trator",
  ].some((needle) => tipo.toLowerCase().includes(needle))
    ? "h"
    : "km";
}

function defaultInterval(tipo: string, unidade: UnidadeRevisao): number {
  if (unidade === "h") return 500;
  return tipo === "Carro" || tipo === "Carro Leve" || tipo === "Van"
    ? 10000
    : 15000;
}

function normalizeStatus(value: unknown): StatusEquipamento {
  const raw = asText(value).toLowerCase();
  if (raw.includes("bloq") || raw === "blocked") return "bloqueado";
  if (raw.includes("inat")) return "inativo";
  return "ativo";
}

function normalizeEquip(id: string, data: Record<string, unknown>): EquipRow {
  const tipo = inferTipo(data);
  const unidade = unitForTipo(tipo, asText(data.unidadeRevisao));
  const intervaloInformado =
    asNumber(data.intervaloRevisao) ||
    asNumber(data.maintenanceInterval) ||
    asNumber(data.intervaloManutencao);
  const medicaoAtual =
    asNumber(data.medicaoAtual) ||
    asNumber(data.currentMeter) ||
    asNumber(data.horimetro) ||
    asNumber(data.odometro) ||
    asNumber(data.kmAtual);

  return {
    id,
    descricao: asText(data.label) || asText(data.descricao) || "Equipamento",
    marca: asText(data.marca),
    modelo: asText(data.modelo) || asText(data.descricao),
    chassis: asText(data.chassis) || asText(data.placa) || asText(data.placaId),
    placa: asText(data.placa) || asText(data.placaId),
    linha: asText(data.linha),
    tipo,
    ano: asText(data.ano),
    obra: asText(data.obra),
    status: normalizeStatus(data.status),
    medicaoAtual,
    intervaloRevisao:
      intervaloInformado > 0 ? intervaloInformado : defaultInterval(tipo, unidade),
    ultimaRevisao:
      asNumber(data.ultimaRevisao) ||
      asNumber(data.lastRevisionOdometerReading) ||
      0,
    unidadeRevisao: unidade,
  };
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
  if (tipo === "Carro" || tipo === "Carro Leve" || tipo === "Van")
    return "🚗";
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
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [form, setForm] = useState<EquipFormState>(emptyForm);
  const [editando, setEditando] = useState<EquipRow | null>(null);
  const [novaMedicao, setNovaMedicao] = useState("");

  const carregar = useCallback(async () => {
    if (!prefeituraId) return;
    setLoading(true);
    setErro("");
    try {
      const snap = await getDocs(
        query(
          collection(db, "equipamentos"),
          where("prefeituraId", "==", prefeituraId),
        ),
      );
      setLista(
        snap.docs
          .map((d) => normalizeEquip(d.id, d.data()))
          .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR")),
      );
    } catch (err) {
      console.error("[Prefeitura Equipamentos] Erro ao carregar:", err);
      setErro("Não foi possível carregar os equipamentos.");
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
      setErro("Informe nome/modelo e chassi do equipamento.");
      return;
    }
    if (
      lista.some((eq) => eq.chassis.toLowerCase() === chassis.toLowerCase())
    ) {
      setErro("Já existe um equipamento com esse chassi.");
      return;
    }

    setSaving(true);
    setErro("");
    try {
      const tipo = form.tipo || "Equipamento";
      const unidade =
        form.unidadeRevisao === "auto"
          ? unitForTipo(tipo)
          : form.unidadeRevisao;
      const medicaoAtual = asNumber(form.medicaoAtual);
      const intervaloRevisao =
        asNumber(form.intervaloRevisao) || defaultInterval(tipo, unidade);
      const payload = {
        prefeituraId,
        descricao: nomeModelo,
        label: nomeModelo,
        modelo: nomeModelo,
        chassis,
        placa,
        tipo,
        linha: tipo,
        ano: form.ano.trim(),
        marca: form.marca.trim(),
        medicaoAtual,
        currentMeter: medicaoAtual,
        intervaloRevisao,
        unidadeRevisao: unidade,
        ultimaRevisao: medicaoAtual,
        obra: "",
        status: "ativo",
        criadoEm: new Date().toISOString(),
        createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "equipamentos"), payload);
      setLista((prev) =>
        [...prev, normalizeEquip(ref.id, payload)].sort((a, b) =>
          a.descricao.localeCompare(b.descricao, "pt-BR"),
        ),
      );
      setForm(emptyForm);
      setModalNovoAberto(false);
    } catch (err) {
      console.error("[Prefeitura Equipamentos] Erro ao salvar:", err);
      setErro("Não foi possível salvar o equipamento.");
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
    setErro("");
    try {
      await updateDoc(doc(db, "equipamentos", editando.id), {
        medicaoAtual,
        currentMeter: medicaoAtual,
        atualizadoEm: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
      setLista((prev) =>
        prev.map((eq) =>
          eq.id === editando.id ? { ...eq, medicaoAtual } : eq,
        ),
      );
      setEditando(null);
    } catch (err) {
      console.error("[Prefeitura Equipamentos] Erro ao atualizar:", err);
      setErro("Não foi possível atualizar a medição.");
    } finally {
      setSaving(false);
    }
  };

  const alternarBloqueio = async (eq: EquipRow) => {
    if (saving) return;
    const status: StatusEquipamento =
      eq.status === "bloqueado" ? "ativo" : "bloqueado";
    setSaving(true);
    setErro("");
    try {
      await updateDoc(doc(db, "equipamentos", eq.id), {
        status,
        atualizadoEm: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
      setLista((prev) =>
        prev.map((item) => (item.id === eq.id ? { ...item, status } : item)),
      );
    } catch (err) {
      console.error("[Prefeitura Equipamentos] Erro ao bloquear:", err);
      setErro("Não foi possível alterar o status do equipamento.");
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
                onClick={() => {
                  setErro("");
                  setModalNovoAberto(true);
                }}
              >
                + Equipamento
              </button>
            </div>
          </header>

          {erro ? <p className="pf-eq-error">{erro}</p> : null}

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
                        <td>{formatMedicao(eq.medicaoAtual, eq.unidadeRevisao)}</td>
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

      {modalNovoAberto ? (
        <div className="pf-modal-overlay pf-eq-modal-overlay">
          <form className="pf-eq-modal pf-eq-modal-wide" onSubmit={salvarNovo}>
            <header>
              <h2>Adicionar veículo</h2>
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
