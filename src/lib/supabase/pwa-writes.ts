/**
 * Writes do PWA via Supabase. Contraparte de `pwa-reads.ts`. Cada função aqui
 * devolve o mesmo shape que o consumer legado espera, pra que a troca no site
 * de chamada seja trivial.
 *
 * A batida de ponto usa a RPC `bater_ponto` (SECURITY DEFINER) que faz o
 * seal atômico (NSR + hash encadeado). Idempotência garantida pelo
 * `p_client_id` UUID gerado no aparelho — reenvio da MESMA chave não duplica.
 */
import { getSupabase } from "./client";
import { getCurrentCompanyId } from "./session";
import type { BaterPontoInput, PontoRegistro, RegistroLedger, TipoPonto } from "../api/pontos";
import type {
  CriarSolicitacaoInput,
  SolicitacaoPonto,
  StatusSolicitacao,
  TipoSolicitacao,
} from "../api/solicitacoes-ponto";

function tipoPontoOk(t: string): TipoPonto {
  return (t === "almoco" || t === "volta" || t === "saida" ? t : "entrada") as TipoPonto;
}
function registroOk(r: string): RegistroLedger {
  return (r === "ajuste" || r === "cancelamento" ? r : "original") as RegistroLedger;
}

type BaterRpcRow = {
  out_id: string;
  out_company_id: string;
  out_operator_id: string | null;
  out_operator_nome: string;
  out_operator_cpf: string | null;
  out_timestamp_original: string;
  out_tipo: string;
  out_photo_url: string | null;
  out_registro: string;
  out_nsr: number;
  out_hash: string;
  out_hash_anterior: string | null;
  out_ref_nsr: number | null;
  out_ref_id: string | null;
  out_aplicado: boolean;
  out_motivo: string | null;
  out_motivo_reprovacao: string | null;
  out_avaliado_em: string | null;
  out_created_at: string;
  out_ja_existia: boolean;
};

/**
 * Grava a batida via RPC. `idempotencyKey` é o UUID que o outbox já usa —
 * passamos como `p_client_id` para a idempotência ficar do lado servidor.
 */
export async function baterPontoSupabase(
  input: BaterPontoInput,
  idempotencyKey: string,
): Promise<PontoRegistro> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("bater_ponto", {
    p_client_id: idempotencyKey,
    p_operator_id: null, // resolvido no server via cpf da sessão
    p_operator_nome: input.name,
    p_operator_cpf: input.cpf ?? null,
    p_tipo: input.tipo,
    p_timestamp_original: input.timestampOriginal,
    p_photo_url: input.photo ?? null,
  });
  if (error) throw new Error(error.message);
  const rows = (data as BaterRpcRow[] | null) ?? [];
  if (rows.length === 0) throw new Error("RPC bater_ponto: sem retorno.");
  const r = rows[0];
  return {
    id: r.out_id,
    name: r.out_operator_nome,
    prefeituraId: input.prefeituraId,
    timestampOriginal: r.out_timestamp_original,
    tipo: tipoPontoOk(r.out_tipo),
    photo: r.out_photo_url ?? undefined,
    createdAt: r.out_created_at,
    cpf: r.out_operator_cpf,
    nsr: r.out_nsr,
    hash: r.out_hash,
    hashAnterior: r.out_hash_anterior ?? undefined,
    registro: registroOk(r.out_registro),
    refNsr: r.out_ref_nsr,
    refId: r.out_ref_id ?? undefined,
    aplicado: r.out_aplicado,
    motivo: r.out_motivo,
  };
}

// ─── Checklist de entrada ────────────────────────────────────────────

/**
 * Payload de checklist gerado pelo `ChecklistControlePage.montarPayload()`.
 * Repetimos aqui os campos que efetivamente persistimos, mas aceitamos
 * `Record<string, unknown>` na entrada pra não acoplar ao internal type.
 */
export type SalvarChecklistInput = {
  id: string;
  prefeituraId: string;
  equipamentoId?: string;
  chassis?: string;
  modelo?: string;
  linha?: string;
  categoria?: string;
  operador: string;
  funcionarioId?: string;
  funcionarioCpf?: string;
  localizacaoGps?: string | null;
  horimetro?: string;
  fotoHorimetro?: string;
  assinaturaOperador?: string;
  totalItens?: number;
  totalAplicaveis?: number;
  totalSim?: number;
  totalNao?: number;
  totalNa?: number;
  itensNao?: unknown[];
  pontuacao?: number;
  respostas?: unknown;
  obs?: string | null;
  dataHoraIso: string;
};

export async function salvarChecklistSupabase(
  payload: SalvarChecklistInput,
): Promise<{ id: string }> {
  const supabase = getSupabase();
  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error("Sem sessão Supabase (company_id ausente).");

  const row = {
    id: payload.id,
    legacy_id: payload.id, // mesmo UUID — atende idempotência de reenvio.
    company_id: companyId,
    operador_nome: payload.operador,
    operador_legacy_id: payload.funcionarioId || null,
    operador_cpf: (payload.funcionarioCpf ?? "").replace(/\D+/g, "") || null,
    chassi: payload.chassis ?? null,
    categoria: payload.categoria ?? null,
    modelo: payload.modelo ?? null,
    linha: payload.linha ?? null,
    total_itens: payload.totalItens ?? null,
    total_sim: payload.totalSim ?? null,
    total_nao: payload.totalNao ?? null,
    total_na: payload.totalNa ?? null,
    total_aplicaveis: payload.totalAplicaveis ?? null,
    pontuacao: payload.pontuacao ?? null,
    horimetro: payload.horimetro ?? null,
    respostas: (payload.respostas ?? null) as unknown,
    itens_nao: (payload.itensNao ?? null) as unknown,
    obs: payload.obs ?? null,
    foto_horimetro: payload.fotoHorimetro ?? null,
    assinatura_operador: payload.assinaturaOperador ?? null,
    localizacao_gps: payload.localizacaoGps ?? null,
    executed_at: payload.dataHoraIso,
  };

  // Idempotência: upsert por `id` (nasce no aparelho). Reenvio devolve o
  // mesmo registro sem duplicar.
  const { error } = await supabase.from("checklist_runs").upsert(row, {
    onConflict: "id",
    ignoreDuplicates: false,
  });
  if (error) throw new Error(error.message);
  return { id: payload.id };
}

// ─── Emergência (manual + automática) ────────────────────────────────

export type SalvarEmergenciaInput = {
  id?: string;
  source: "manual" | "checklist_auto";
  severity?: "warning" | "critical" | "blocking";
  chassis?: string;
  equipamentoLegacyId?: string;
  idMaquina?: string;
  modelo?: string;
  operadorNome?: string;
  operadorLegacyId?: string;
  operadorCpf?: string;
  tipoFalha: string;
  descricao: string;
  localizacaoGps?: string | null;
  fotos?: string[];
  checklistLegacyId?: string;
  questionId?: string;
  questionLabel?: string;
  dataHoraIso: string;
};

export async function salvarEmergenciaSupabase(
  payload: SalvarEmergenciaInput,
): Promise<{ id: string }> {
  const supabase = getSupabase();
  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error("Sem sessão Supabase (company_id ausente).");

  const id = payload.id ?? crypto.randomUUID();
  const row = {
    id,
    legacy_id: id,
    company_id: companyId,
    source: payload.source,
    severity: payload.severity ?? "warning",
    chassi: payload.chassis ?? null,
    equipment_legacy_id: payload.equipamentoLegacyId ?? null,
    id_maquina: payload.idMaquina ?? null,
    modelo: payload.modelo ?? null,
    operador_nome: payload.operadorNome ?? null,
    operador_legacy_id: payload.operadorLegacyId ?? null,
    operador_cpf: (payload.operadorCpf ?? "").replace(/\D+/g, "") || null,
    tipo_falha: payload.tipoFalha,
    descricao: payload.descricao,
    localizacao_gps: payload.localizacaoGps ?? null,
    fotos: payload.fotos ?? [],
    checklist_legacy_id: payload.checklistLegacyId ?? null,
    question_id: payload.questionId ?? null,
    question_label: payload.questionLabel ?? null,
    data_hora: payload.dataHoraIso,
  };

  const { error } = await supabase.from("emergencies").upsert(row, {
    onConflict: "id",
    ignoreDuplicates: false,
  });
  if (error) throw new Error(error.message);
  return { id };
}

// ─── Solicitação de ponto (criar) ─────────────────────────────────────

function tipoSolicOk(t: string): TipoSolicitacao {
  return (t === "cancelar" || t === "abono" || t === "mensagem"
    ? t
    : "incluir") as TipoSolicitacao;
}
function statusSolicOk(s: string): StatusSolicitacao {
  return (s === "aprovado" || s === "reprovado" ? s : "pendente") as StatusSolicitacao;
}

export async function criarSolicitacaoSupabase(
  input: CriarSolicitacaoInput,
): Promise<SolicitacaoPonto> {
  const supabase = getSupabase();
  const companyId = await getCurrentCompanyId();
  if (!companyId) throw new Error("Sem sessão Supabase (company_id ausente).");

  const id = crypto.randomUUID();
  const row = {
    id,
    legacy_id: id,
    company_id: companyId,
    tipo: input.tipo,
    status: "pendente" as const,
    operator_nome: input.name,
    operator_cpf: (input.cpf ?? "").replace(/\D+/g, "") || null,
    batida_id: input.batidaId ?? null,
    data: input.data ?? null,
    timestamp_original: input.timestampOriginal ?? null,
    observacao: input.observacao ?? null,
    anexo_data_url: input.anexoDataUrl ?? null,
    anexo_nome: input.anexoNome ?? null,
  };

  const { data, error } = await supabase
    .from("ponto_solicitacoes")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  return {
    id: data.id,
    tipo: tipoSolicOk(data.tipo),
    status: statusSolicOk(data.status),
    prefeituraId: input.prefeituraId,
    name: data.operator_nome,
    cpf: data.operator_cpf,
    batidaId: data.batida_id,
    data: data.data,
    timestampOriginal: data.timestamp_original,
    observacao: data.observacao,
    anexoDataUrl: data.anexo_data_url,
    anexoNome: data.anexo_nome,
    motivoReprovacao: data.motivo_reprovacao,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

