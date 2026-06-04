/** Configurações da empresa por prefeitura — módulo `configuracoes` do back-360-. */
import { api } from "./client";

export type UnidadeIntervalo = "km" | "horas";

export interface ConfigIntervalo {
  valor: number;
  unidade: UnidadeIntervalo;
}

export type CategoriaIntervalo =
  | "carro"
  | "caminhao"
  | "maquina"
  | "ambulancia"
  | "van";

export interface Configuracao {
  prefeituraId: string;
  empresa: {
    razaoSocial: string;
    cnpj: string;
    /** CAEPF/CEI — inscrição alternativa para empregador sem CNPJ (órgão público). */
    caepf: string;
    cidade: string;
    estado: string;
    emailAlertas: string;
    /** WhatsApp que recebe as notificações de emergência. */
    whatsappNumero: string;
  };
  alertas: {
    bloqueioRevisaoVencida: boolean;
    nivelCriticoTanque: boolean;
    abastecimentoIrregular: boolean;
    cnhProximaVencimento: boolean;
    relatorioSemanal: boolean;
    /** Notificar emergências por WhatsApp. */
    notificacaoWhatsapp: boolean;
  };
  intervalos: Record<CategoriaIntervalo, ConfigIntervalo>;
  bloqueio: {
    bloquearAoVencer: boolean;
    alertar80: boolean;
    alertar90: boolean;
  };
}

/** Configuração padrão (usada quando a prefeitura ainda não salvou nada). */
export function configPadrao(prefeituraId: string): Configuracao {
  return {
    prefeituraId,
    empresa: {
      razaoSocial: "",
      cnpj: "",
      caepf: "",
      cidade: "",
      estado: "",
      emailAlertas: "",
      whatsappNumero: "",
    },
    alertas: {
      bloqueioRevisaoVencida: true,
      nivelCriticoTanque: true,
      abastecimentoIrregular: true,
      cnhProximaVencimento: true,
      relatorioSemanal: false,
      notificacaoWhatsapp: false,
    },
    intervalos: {
      carro: { valor: 1000, unidade: "km" },
      caminhao: { valor: 500, unidade: "horas" },
      maquina: { valor: 500, unidade: "horas" },
      ambulancia: { valor: 1000, unidade: "km" },
      van: { valor: 1000, unidade: "km" },
    },
    bloqueio: { bloquearAoVencer: true, alertar80: true, alertar90: true },
  };
}

/** Mescla o que veio do banco sobre o padrão (tolera doc parcial/legado). */
function normalizar(prefeituraId: string, raw: unknown): Configuracao {
  const base = configPadrao(prefeituraId);
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Partial<Configuracao>;
  return {
    prefeituraId,
    empresa: { ...base.empresa, ...(d.empresa ?? {}) },
    alertas: { ...base.alertas, ...(d.alertas ?? {}) },
    intervalos: {
      carro: { ...base.intervalos.carro, ...(d.intervalos?.carro ?? {}) },
      caminhao: { ...base.intervalos.caminhao, ...(d.intervalos?.caminhao ?? {}) },
      maquina: { ...base.intervalos.maquina, ...(d.intervalos?.maquina ?? {}) },
      ambulancia: {
        ...base.intervalos.ambulancia,
        ...(d.intervalos?.ambulancia ?? {}),
      },
      van: { ...base.intervalos.van, ...(d.intervalos?.van ?? {}) },
    },
    bloqueio: { ...base.bloqueio, ...(d.bloqueio ?? {}) },
  };
}

/**
 * Os dados do empregador estão completos para emissão legal (CRPT/AFD —
 * Portaria 671)? Exige razão social e ao menos uma inscrição (CNPJ ou CAEPF).
 */
export function empresaCompleta(empresa: Configuracao["empresa"]): boolean {
  const temRazao = !!empresa.razaoSocial?.trim();
  const temInscricao = !!empresa.cnpj?.trim() || !!empresa.caepf?.trim();
  return temRazao && temInscricao;
}

/** Mapeia o tipo do equipamento para a categoria de intervalo da config. */
export function categoriaDoTipo(tipo: string): CategoriaIntervalo {
  const t = tipo.toLowerCase();
  if (t.includes("ambul")) return "ambulancia";
  if (t.includes("van")) return "van";
  if (t === "carro" || t.includes("carro leve") || t.includes("leve"))
    return "carro";
  if (
    /motoniveladora|escavadeira|trator|retro|carregadeira|compactador|m[aá]quina/.test(
      t,
    )
  )
    return "maquina";
  // Caminhões e derivados (munck, pipa, basculante, betoneira, comboio, baú…).
  return "caminhao";
}

export const configuracoesApi = {
  async obter(prefeituraId: string): Promise<Configuracao> {
    const r = await api.get<{ data: unknown }>(
      `/configuracoes/${prefeituraId}`,
    );
    return normalizar(prefeituraId, r.data);
  },

  async salvar(config: Configuracao): Promise<void> {
    await api.post("/configuracoes", config);
  },
};
