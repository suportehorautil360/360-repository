/**
 * API de ponto (módulo time-records do back-360-). Infra compartilhada:
 * consumida pelo operador (checklist) e pelo RH (portal da prefeitura).
 */
import { api } from "./client";

export type TipoPonto = "entrada" | "almoco" | "volta" | "saida";

export type StatusPonto =
  | "pendente"
  | "aprovado"
  | "reprovado"
  /** Batida cancelada — gerada pela aprovação de uma solicitação tipo=cancelar. Front filtra. */
  | "cancelado";

/** Ordem e rótulos da folha do dia. */
export const TIPOS_PONTO: { tipo: TipoPonto; label: string }[] = [
  { tipo: "entrada", label: "Entrada" },
  { tipo: "almoco", label: "Saída p/ almoço" },
  { tipo: "volta", label: "Volta do almoço" },
  { tipo: "saida", label: "Saída" },
];

export interface BaterPontoInput {
  name: string;
  /** Foto (selfie) como data URL base64. */
  photo: string;
  prefeituraId: string;
  /** Horário da batida no dispositivo (ISO 8601). */
  timestampOriginal: string;
  tipo: TipoPonto;
  /**
   * CPF do trabalhador (da sessão de login por CPF). Identifica a marcação no
   * ledger/AFD e no comprovante (CRPT) — Portaria 671.
   */
  cpf?: string;
}

/**
 * Natureza do registro no ledger imutável (Portaria 671).
 * - `original`: marcação feita pelo trabalhador — nunca alterada/apagada.
 * - `ajuste`: correção de horário (refNsr/refId apontam a original) OU inclusão
 *   de batida esquecida (sem refNsr). Vale na folha só quando `aplicado`.
 * - `cancelamento`: anula uma original na folha (sem apagá-la do ledger).
 */
export type RegistroLedger = "original" | "ajuste" | "cancelamento";

export interface PontoRegistro {
  id: string;
  name: string;
  prefeituraId: string;
  timestampOriginal: string;
  tipo: TipoPonto;
  photo?: string;
  /** @deprecated status legado de batida; o modelo atual usa o ledger. */
  status?: StatusPonto;
  motivoReprovacao?: string;
  createdAt?: string;
  /** CPF/PIS do trabalhador (quando capturado). */
  cpf?: string | null;
  // --- Ledger (Portaria 671) ---
  /** Número Sequencial de Registro (por prefeitura). Ausente em dados legados. */
  nsr?: number;
  /** Hash SHA-256 encadeado ao registro anterior. */
  hash?: string;
  hashAnterior?: string;
  /** Natureza no ledger. Ausente = `original` (compat. legado). */
  registro?: RegistroLedger;
  /** Para ajuste/cancelamento: NSR da batida original alvo. */
  refNsr?: number | null;
  /** Para ajuste/cancelamento: id da batida original alvo (fallback do NSR). */
  refId?: string;
  /** Ajuste/cancelamento aplicado à folha pelo RH. */
  aplicado?: boolean;
  /** Motivo da correção informado pelo trabalhador (em registros de ajuste). */
  motivo?: string | null;
}

interface RespostaLista {
  data: PontoRegistro[];
  message: string;
}

interface RespostaCriar {
  data: PontoRegistro;
  message: string;
}

export const pontosApi = {
  /**
   * Registra uma batida. `idempotencyKey` é o id do item no outbox offline:
   * reenvio com a mesma chave não duplica no servidor (interceptor no back).
   */
  async bater(
    input: BaterPontoInput,
    idempotencyKey?: string,
  ): Promise<PontoRegistro> {
    const r = await api.post<RespostaCriar>(
      "/time-records",
      input,
      idempotencyKey
        ? { headers: { "Idempotency-Key": idempotencyKey } }
        : undefined,
    );
    return r.data;
  },

  async listar(prefeituraId: string): Promise<PontoRegistro[]> {
    const r = await api.get<RespostaLista>(`/time-records/${prefeituraId}`);
    return r.data;
  },

  /**
   * Corrige o horário de uma batida (operador). A correção fica pendente de
   * aprovação do gestor. `motivo` é opcional e acompanha a solicitação.
   */
  async editarHorario(
    id: string,
    timestampOriginal: string,
    motivo?: string,
  ): Promise<void> {
    await api.post(`/time-records/update/${id}`, {
      timestampOriginal,
      ...(motivo?.trim() ? { motivo: motivo.trim() } : {}),
    });
  },

  /** Aprova uma batida (RH). */
  async aprovar(id: string): Promise<void> {
    await api.post(`/time-records/${id}/aprovar`);
  },

  /** Reprova uma batida com motivo (RH). */
  async reprovar(id: string, motivo: string): Promise<void> {
    await api.post(`/time-records/${id}/reprovar`, { motivo });
  },

  /**
   * Gera o AFD (Arquivo Fonte de Dados — Portaria 671) da prefeitura no período
   * [de, ate] (YYYY-MM-DD, opcionais). Retorna o conteúdo textual e o nome do
   * arquivo; o front monta o download em ISO-8859-1.
   */
  async exportarAFD(
    prefeituraId: string,
    de?: string,
    ate?: string,
  ): Promise<AfdResultado> {
    const qs = new URLSearchParams();
    if (de) qs.set("de", de);
    if (ate) qs.set("ate", ate);
    const sufixo = qs.toString() ? `?${qs.toString()}` : "";
    const r = await api.get<{ data: AfdResultado; message: string }>(
      `/time-records/afd/${prefeituraId}${sufixo}`,
    );
    return r.data;
  },

  /**
   * Gera o AEJ (Arquivo Eletrônico de Jornada — tratado, Portaria 671) da
   * prefeitura no período [de, ate]. Mesmo formato de retorno do AFD.
   */
  async exportarAEJ(
    prefeituraId: string,
    de?: string,
    ate?: string,
  ): Promise<AejResultado> {
    const qs = new URLSearchParams();
    if (de) qs.set("de", de);
    if (ate) qs.set("ate", ate);
    const sufixo = qs.toString() ? `?${qs.toString()}` : "";
    const r = await api.get<{ data: AejResultado; message: string }>(
      `/time-records/aej/${prefeituraId}${sufixo}`,
    );
    return r.data;
  },
};

export interface AfdResultado {
  /** Conteúdo do arquivo (linhas terminadas em CRLF). */
  conteudo: string;
  /** Nome sugerido do arquivo (AFD…REP_P.txt). */
  nome: string;
  totalMarcacoes: number;
  /** Marcações exportadas sem CPF (legado) — devem ser tratadas. */
  semCpf: number;
  /** Se o AFD foi assinado com certificado ICP-Brasil. */
  assinado: boolean;
  /** Assinatura destacada (.p7s) em base64, quando assinado. */
  assinaturaP7sBase64?: string;
}

/** O AEJ (tratado) tem o mesmo formato de retorno do AFD. */
export type AejResultado = AfdResultado;
