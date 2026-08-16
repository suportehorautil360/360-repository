/**
 * Reads do PWA via Supabase. Cada função aqui devolve o **shape exato** do
 * consumer legado (`escalaApi.obter`, `pontosApi.listar`, etc), pra que a
 * troca no site de chamada seja trivial.
 *
 * Todas usam o cliente autenticado — RLS filtra por `company_id` do JWT
 * automaticamente, então NÃO passamos `prefeituraId` nas queries.
 */
import { getSupabase } from "./client";
import type { Escala } from "../api/escala";
import type { Configuracao } from "../api/configuracoes";
import type { PontoRegistro, TipoPonto, RegistroLedger } from "../api/pontos";
import type { SolicitacaoPonto, TipoSolicitacao, StatusSolicitacao } from "../api/solicitacoes-ponto";
import type { EquipFrota } from "../../pages/checklist-controle/frota-operador";
import type { ChecklistDefinition } from "../../features/checklist/api/checklist-definitions-api";

// ─── Escala ──────────────────────────────────────────────────────────

export async function obterEscalaSupabase(
  prefeituraId: string,
): Promise<Escala | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("company_settings")
    .select("escala_inicio, escala_fim, escala_dias, escala_almoco_min")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const dias = Array.isArray(data.escala_dias)
    ? (data.escala_dias as unknown[]).filter(
        (x): x is number => typeof x === "number",
      )
    : [];
  return {
    prefeituraId,
    inicio: data.escala_inicio,
    fim: data.escala_fim,
    diasSemana: dias,
    almocoMinutos: data.escala_almoco_min,
  };
}

// ─── Configurações ───────────────────────────────────────────────────

/// A `Configuracao` do legado carrega várias sub-seções (empresa, alertas,
/// intervalos, bloqueio). No Postgres tudo isso mora em `company_settings`
/// + snapshot fiscal no `clients` — juntamos aqui pra devolver o shape
/// completo.
export async function obterConfiguracaoSupabase(
  prefeituraId: string,
): Promise<Configuracao> {
  const supabase = getSupabase();
  const [{ data: cs }, { data: cli }] = await Promise.all([
    supabase.from("company_settings").select("*").maybeSingle(),
    supabase
      .from("clients")
      .select("name, cnpj, caepf, cidade, uf, email, whatsapp, razao_social")
      .maybeSingle(),
  ]);

  const empresa = {
    razaoSocial: (cli?.razao_social ?? cli?.name ?? "").trim(),
    cnpj: cli?.cnpj ?? "",
    caepf: cli?.caepf ?? "",
    cidade: cli?.cidade ?? "",
    estado: cli?.uf ?? "",
    emailAlertas: cli?.email ?? "",
    whatsappNumero: cli?.whatsapp ?? "",
  };

  const intervalos =
    (cs?.intervalos as Configuracao["intervalos"] | null) ?? {};

  return {
    prefeituraId,
    empresa,
    alertas: {
      bloqueioRevisaoVencida: cs?.alert_bloqueio_revisao_vencida ?? true,
      nivelCriticoTanque: cs?.alert_nivel_critico_tanque ?? true,
      abastecimentoIrregular: cs?.alert_abastecimento_irregular ?? true,
      cnhProximaVencimento: cs?.alert_cnh_proxima_vencimento ?? true,
      relatorioSemanal: cs?.alert_relatorio_semanal ?? false,
      notificacaoWhatsapp: cs?.alert_whatsapp_emergencia ?? false,
    },
    intervalos,
    bloqueio: {
      bloquearAoVencer: cs?.bloquear_ao_vencer ?? true,
      alertar80: cs?.alertar_80 ?? true,
      alertar90: cs?.alertar_90 ?? true,
    },
  } as Configuracao;
}

// ─── Frota ───────────────────────────────────────────────────────────

export async function listarFrotaSupabase(
  prefeituraId: string,
): Promise<EquipFrota[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("equipments")
    .select("id, descricao, chassi, modelo, linha, tipo")
    .order("descricao", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    prefeituraId,
    label: r.descricao ?? "",
    chassis: r.chassi ?? "",
    modelo: r.modelo ?? "",
    linha: r.linha ?? "",
    tipo: r.tipo ?? "",
  }));
}

// ─── Definições de checklist ─────────────────────────────────────────

export async function listarDefinicoesSupabase(): Promise<ChecklistDefinition[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("checklist_definitions")
    .select("id, nome, categoria, keywords, ativo, version, itens, created_at, updated_at")
    .eq("ativo", true)
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    nome: r.nome,
    categoria: r.categoria,
    keywords: Array.isArray(r.keywords)
      ? (r.keywords as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    ativo: r.ativo,
    version: r.version,
    itens: Array.isArray(r.itens) ? (r.itens as ChecklistDefinition["itens"]) : [],
    createdAt: r.created_at ?? undefined,
    updatedAt: r.updated_at ?? undefined,
  }));
}

// ─── Últimas batidas do operador ─────────────────────────────────────

function tipoPontoOk(t: string): TipoPonto {
  return (t === "almoco" || t === "volta" || t === "saida"
    ? t
    : "entrada") as TipoPonto;
}
function registroOk(r: string): RegistroLedger {
  return (r === "ajuste" || r === "cancelamento" ? r : "original") as RegistroLedger;
}

export async function listarPontosSupabase(
  prefeituraId: string,
  operatorCpf?: string,
  limit = 500,
): Promise<PontoRegistro[]> {
  const supabase = getSupabase();
  let q = supabase
    .from("ponto_registros")
    .select("*")
    .order("nsr", { ascending: true })
    .limit(limit);
  if (operatorCpf) q = q.eq("operator_cpf", operatorCpf.replace(/\D+/g, ""));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.operator_nome,
    prefeituraId,
    timestampOriginal: r.timestamp_original,
    tipo: tipoPontoOk(r.tipo),
    photo: r.photo_url ?? undefined,
    createdAt: r.created_at,
    cpf: r.operator_cpf,
    nsr: r.nsr,
    hash: r.hash,
    hashAnterior: r.hash_anterior ?? undefined,
    registro: registroOk(r.registro),
    refNsr: r.ref_nsr,
    refId: r.ref_id ?? undefined,
    aplicado: r.aplicado,
    motivo: r.motivo,
  }));
}

// ─── Checklists de entrada (histórico do dia + auditoria) ───────────

/**
 * Lê checklists salvos pra montar o histórico do PWA. Devolve rows já no
 * shape `firestoreDocToHistRow` do consumer legado — reduz mudanças na tela.
 * O filtro `idOperadorSession` é feito em memória (mesmo padrão do legado).
 */
export async function listarChecklistsSupabase(): Promise<Array<Record<string, unknown>>> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("checklist_runs")
    .select(
      "id, executed_at, operador_nome, chassi, categoria, modelo, linha, total_itens, total_sim, total_nao, total_na, total_aplicaveis, pontuacao, horimetro, assinatura_operador, respostas, obs, localizacao_gps, operador_legacy_id, operador_cpf",
    )
    .order("executed_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const respostasJson =
      r.respostas && typeof r.respostas === "object"
        ? JSON.stringify(r.respostas)
        : typeof r.respostas === "string"
          ? r.respostas
          : "{}";
    return {
      ID_Registro: r.id,
      Data_Hora: r.executed_at ?? "",
      Operador: r.operador_nome ?? "",
      Chassis: r.chassi ?? "",
      Categoria: r.categoria ?? "",
      Modelo: r.modelo ?? "",
      Linha: r.linha ?? "",
      Item_Verificado: `Checklist ${r.total_itens ?? "?"} itens`,
      Status_Ok_Nao:
        typeof r.total_na === "number" && r.total_na > 0
          ? `${r.total_sim ?? 0}/${r.total_aplicaveis ?? r.total_itens ?? 0} OK · ${r.total_na} N/A`
          : `${r.total_sim ?? 0}/${r.total_aplicaveis ?? r.total_itens ?? 0} OK`,
      Respostas_JSON: respostasJson,
      Horimetro_Final: r.horimetro ?? "",
      Assinatura_Operador: r.assinatura_operador ?? "",
      Pontuacao: r.pontuacao ?? 0,
      // Snapshots mínimos pra `registroDoOperador` continuar filtrando.
      idOperadorSession: r.operador_legacy_id ?? "",
      funcionarioId: r.operador_legacy_id ?? "",
      funcionarioCpf: r.operador_cpf ?? "",
      operador: r.operador_nome ?? "",
      Localizacao_GPS: r.localizacao_gps ?? null,
      Obs: r.obs ?? null,
    };
  });
}

// ─── Emergências do operador ────────────────────────────────────────

/**
 * Lê emergências que o PWA precisa exibir na aba "Emerg". Devolve rows com
 * chaves compatíveis com o consumer legado (`dataHoraIso`, `operador`, etc).
 */
export async function listarEmergenciasSupabase(): Promise<Array<Record<string, unknown>>> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("emergencies")
    .select(
      "id, source, severity, status_atendimento, chassi, id_maquina, modelo, operador_nome, operador_legacy_id, operador_cpf, tipo_falha, descricao, localizacao_gps, fotos, data_hora, created_at",
    )
    .order("data_hora", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    _docId: r.id,
    id: r.id,
    source: r.source,
    severity: r.severity,
    statusAtendimento: r.status_atendimento,
    chassis: r.chassi ?? "",
    idMaquina: r.id_maquina ?? "",
    modelo: r.modelo ?? "",
    operador: r.operador_nome ?? "",
    operadorNome: r.operador_nome ?? "",
    funcionarioId: r.operador_legacy_id ?? "",
    funcionarioCpf: r.operador_cpf ?? "",
    idOperadorSession: r.operador_legacy_id ?? "",
    tipoFalha: r.tipo_falha,
    descricao: r.descricao,
    localizacaoGps: r.localizacao_gps ?? null,
    fotos: Array.isArray(r.fotos) ? r.fotos : [],
    dataHoraIso: r.data_hora,
    criadoEm: r.created_at,
  }));
}

// ─── Solicitações de ponto (do próprio operador) ─────────────────────

function statusSolicOk(s: string): StatusSolicitacao {
  return (s === "aprovado" || s === "reprovado" ? s : "pendente") as StatusSolicitacao;
}
function tipoSolicOk(t: string): TipoSolicitacao {
  return (t === "cancelar" || t === "abono" || t === "mensagem"
    ? t
    : "incluir") as TipoSolicitacao;
}

export async function listarSolicitacoesSupabase(
  prefeituraId: string,
  operatorCpf?: string,
): Promise<SolicitacaoPonto[]> {
  const supabase = getSupabase();
  let q = supabase
    .from("ponto_solicitacoes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (operatorCpf) q = q.eq("operator_cpf", operatorCpf.replace(/\D+/g, ""));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    tipo: tipoSolicOk(r.tipo),
    status: statusSolicOk(r.status),
    prefeituraId,
    name: r.operator_nome,
    cpf: r.operator_cpf,
    batidaId: r.batida_id,
    data: r.data,
    timestampOriginal: r.timestamp_original,
    observacao: r.observacao,
    anexoDataUrl: r.anexo_data_url,
    anexoNome: r.anexo_nome,
    motivoReprovacao: r.motivo_reprovacao,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
