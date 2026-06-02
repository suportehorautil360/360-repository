/**
 * Camada de dados da Frota/Revisões. A frota é a MESMA coleção de
 * `equipamentos` (fonte da verdade) — esta camada é só um adaptador que
 * traduz o documento de `equipamentos` para o modelo de UI `VeiculoFrota`.
 * A coleção `vehicles` foi aposentada.
 */
import { api, ApiError } from "../../../../lib/api/client";
import {
  normalizeEquip,
  type EquipRow,
} from "../equipamentos/equipamentos-api";
import {
  type RevisaoInput,
  type TipoVeiculo,
  type VeiculoFrota,
  type VeiculoFrotaInput,
} from "./types";

interface ListaResponse {
  data: Array<Record<string, unknown> & { id?: string }>;
  message: string;
}

/** Texto de tipo enviado ao backend (round-trip com inferTipo/unidade). */
const TIPO_TXT: Record<TipoVeiculo, string> = {
  carro: "Carro",
  caminhao: "Caminhão",
  van: "Van",
  maquina: "Máquina",
};

/** Equipamento (h = horímetro) → tipo da Frota. */
function tipoDeEquip(eq: EquipRow): TipoVeiculo {
  if (eq.unidadeRevisao === "h") return "maquina";
  const t = `${eq.tipo} ${eq.descricao}`.toLowerCase();
  if (/van|sprinter|furg/.test(t)) return "van";
  if (/camin|truck|basculante|pipa|munck|comboio|betoneira|ba[uú]/.test(t))
    return "caminhao";
  if (/escav|retro|trator|carregadeira|rolo|motonivel|m[aá]quina/.test(t))
    return "maquina";
  return "carro";
}

/** Documento de equipamento normalizado → modelo de UI da Frota. */
function toVeiculo(eq: EquipRow): VeiculoFrota {
  return {
    id: eq.id,
    placa: eq.placa || eq.chassis || "",
    nome: eq.descricao || "",
    marca: eq.marca || "",
    tipo: tipoDeEquip(eq),
    ano: Number(eq.ano) || 0,
    medicaoAtual: eq.medicaoAtual,
    intervaloRevisao: eq.intervaloRevisao,
    ultimaRevisao: eq.ultimaRevisao,
    obra: eq.obra?.trim() ? eq.obra : "Disponível",
    status: eq.status === "ativo" ? "ativo" : "bloqueado",
  };
}

/** Modelo de UI → payload de criação/edição de `equipamentos`. */
function toEquipPayload(input: VeiculoFrotaInput, prefeituraId: string) {
  const descricao = input.nome.trim() || input.marca.trim() || "Equipamento";
  const placa = input.placa.trim();
  return {
    prefeituraId,
    descricao,
    label: descricao,
    modelo: descricao,
    marca: input.marca.trim(),
    placa,
    chassis: placa,
    tipo: TIPO_TXT[input.tipo],
    linha: TIPO_TXT[input.tipo],
    ano: input.ano ? String(input.ano) : "",
    medicaoAtual: input.medicaoAtual,
    intervaloRevisao: input.intervaloRevisao,
    unidadeRevisao: input.tipo === "maquina" ? "h" : "km",
    ultimaRevisao: input.ultimaRevisao,
    status: "ativo",
    obra: input.obra.trim(),
  };
}

export const frotaApi = {
  /** Lista os equipamentos da prefeitura. 404 (sem itens) vira lista vazia. */
  async listar(prefeituraId: string): Promise<VeiculoFrota[]> {
    try {
      const r = await api.get<ListaResponse>(`/equipamentos/${prefeituraId}`);
      return (r.data ?? []).map((d) =>
        toVeiculo(normalizeEquip(String(d.id ?? ""), d)),
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return [];
      throw e;
    }
  },

  async criar(
    input: VeiculoFrotaInput,
    prefeituraId: string,
  ): Promise<VeiculoFrota> {
    const payload = { ...toEquipPayload(input, prefeituraId) };
    const r = await api.post<{ data: Record<string, unknown> & { id?: string } }>(
      "/equipamentos",
      payload,
    );
    const doc = r.data ?? payload;
    return toVeiculo(
      normalizeEquip(String((doc as { id?: string }).id ?? ""), doc),
    );
  },

  /** Atualiza os campos editáveis do equipamento. */
  async atualizar(veiculo: VeiculoFrota, prefeituraId: string): Promise<void> {
    const payload = toEquipPayload(
      {
        placa: veiculo.placa,
        nome: veiculo.nome,
        marca: veiculo.marca,
        tipo: veiculo.tipo,
        ano: veiculo.ano,
        medicaoAtual: veiculo.medicaoAtual,
        intervaloRevisao: veiculo.intervaloRevisao,
        ultimaRevisao: veiculo.ultimaRevisao,
        obra: veiculo.obra,
      },
      prefeituraId,
    );
    await api.post(`/equipamentos/update/${veiculo.id}`, payload);
  },

  async remover(id: string): Promise<void> {
    await api.del(`/equipamentos/${id}`);
  },

  /**
   * Registra a revisão como concluída e libera o equipamento
   * (POST /equipamentos/revision/complete).
   */
  async concluirRevisao(
    veiculo: VeiculoFrota,
    prefeituraId: string,
    dados: RevisaoInput,
  ): Promise<void> {
    await api.post("/equipamentos/revision/complete", {
      revisionDate: new Date(dados.data).toISOString(),
      odometerReading: dados.hodometro,
      mechanicOrOfficeName: dados.oficina.trim(),
      servicesDescription: dados.servicos.trim(),
      revisionCost: dados.custo,
      invoiceNumber: dados.notaFiscal.trim(),
      prefeituraId,
      equipamentoId: veiculo.id,
    });
  },
};
