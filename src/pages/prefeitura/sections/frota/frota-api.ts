/**
 * Tradução entre o modelo de UI (VeiculoFrota) e os DTOs do backend NestJS,
 * e as chamadas aos endpoints de `vehicles` e `revision`.
 */
import { api, ApiError } from "../../../../lib/api/client";
import {
  maintenanceUnitDe,
  type RevisaoInput,
  type TipoVeiculo,
  type VeiculoFrota,
  type VeiculoFrotaInput,
} from "./types";

/** Veículo como o backend devolve/armazena (coleção `vehicles`). */
interface VehicleApi {
  id: string;
  name: string;
  plate: string;
  type: string;
  year: number;
  currentMeter: number;
  brand: string;
  maintenanceInterval: number;
  maintenanceUnit: "km" | "hours";
  prefeituraId: string;
  lastRevisionOdometerReading: number;
  obra?: string;
  status?: string;
}

interface ListaResponse {
  data: VehicleApi[];
  message: string;
}

const TIPOS_VALIDOS: TipoVeiculo[] = ["carro", "caminhao", "van", "maquina"];

function tipoFromBackend(type: string): TipoVeiculo {
  const t = (type ?? "").toLowerCase();
  if ((TIPOS_VALIDOS as string[]).includes(t)) return t as TipoVeiculo;
  if (t.includes("camin")) return "caminhao";
  if (t.includes("van")) return "van";
  if (t.includes("máqu") || t.includes("maqu")) return "maquina";
  return "carro";
}

function toVeiculo(v: VehicleApi): VeiculoFrota {
  return {
    id: v.id,
    placa: v.plate ?? "",
    nome: v.name ?? "",
    marca: v.brand ?? "",
    tipo: tipoFromBackend(v.type),
    ano: v.year ?? 0,
    medicaoAtual: v.currentMeter ?? 0,
    intervaloRevisao: v.maintenanceInterval ?? 0,
    ultimaRevisao: v.lastRevisionOdometerReading ?? 0,
    obra: v.obra?.trim() ? v.obra : "Disponível",
    status: v.status === "bloqueado" ? "bloqueado" : "ativo",
  };
}

function toCreateDto(input: VeiculoFrotaInput, prefeituraId: string) {
  return {
    name: input.nome.trim(),
    plate: input.placa.trim(),
    type: input.tipo,
    year: input.ano,
    currentMeter: input.medicaoAtual,
    brand: input.marca.trim(),
    maintenanceInterval: input.intervaloRevisao,
    maintenanceUnit: maintenanceUnitDe(input.tipo),
    prefeituraId,
    lastRevisionOdometerReading: input.ultimaRevisao,
    obra: input.obra.trim() || "Disponível",
  };
}

export const frotaApi = {
  /** Lista os veículos da prefeitura. 404 (sem veículos) vira lista vazia. */
  async listar(prefeituraId: string): Promise<VeiculoFrota[]> {
    try {
      const r = await api.get<ListaResponse>(`/vehicles/${prefeituraId}`);
      return r.data.map(toVeiculo);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return [];
      throw e;
    }
  },

  async criar(
    input: VeiculoFrotaInput,
    prefeituraId: string,
  ): Promise<VeiculoFrota> {
    const dto = toCreateDto(input, prefeituraId);
    const novo = await api.post<VehicleApi>("/vehicles", dto);
    return toVeiculo(novo);
  },

  /** Atualiza o veículo (o backend espera o DTO completo). */
  async atualizar(
    veiculo: VeiculoFrota,
    prefeituraId: string,
  ): Promise<void> {
    const dto = toCreateDto(
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
    await api.post(`/vehicles/update/${veiculo.id}`, dto);
  },

  async remover(id: string): Promise<void> {
    await api.del(`/vehicles/${id}`);
  },

  /** Registra a revisão como concluída e libera o veículo (POST /revision/complete). */
  async concluirRevisao(
    veiculo: VeiculoFrota,
    prefeituraId: string,
    dados: RevisaoInput,
  ): Promise<void> {
    await api.post("/revision/complete", {
      revisionDate: new Date(dados.data).toISOString(),
      odometerReading: dados.hodometro,
      mechanicOrOfficeName: dados.oficina.trim(),
      servicesDescription: dados.servicos.trim(),
      revisionCost: dados.custo,
      invoiceNumber: dados.notaFiscal.trim(),
      prefeituraId,
      vehicleId: veiculo.id,
    });
  },
};
