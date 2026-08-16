/**
 * Auth do operador via Supabase (Edge Function `login-operador`).
 *
 * Chama a função Edge com CPF+senha, recebe uma `session` real do Supabase
 * Auth (JWT com claim `app_metadata.company_id` para RLS) + shape do
 * `Operador`. A sessão é gravada no client via `setSession()` — a partir daí
 * qualquer chamada `supabase.from(...)` já vai autenticada.
 *
 * O rate limit e a validação do hash SHA-256(cpf:senha) ficam do lado do
 * servidor. Aqui só empacota/desempacota.
 */
import { getSupabase } from "./client";

export type OperadorSessao = {
  id: string;
  companyId: string;
  /** legacyId (docId Firestore) da empresa — preservado pra manter compat
   *  com endpoints REST NestJS que ainda usam `prefeituraId`. */
  companyLegacyId: string | null;
  companyName: string | null;
  nome: string;
  cpf: string;
  cargo: string | null;
  matricula: string | null;
  tipo: "operador" | "supervisor" | "admin";
  loginGerado: string | null;
};

export type LoginResult =
  | { ok: true; operador: OperadorSessao }
  | {
      ok: false;
      /** 401 credencial inválida, 409 CPF em várias empresas (opcoes), 429 rate limit, 500 servidor. */
      status: number;
      error: string;
      /** Quando status=409 — o cliente escolhe qual empresa e reenvia com companyId. */
      opcoes?: Array<{ companyId: string; operatorId: string; nome: string }>;
    };

/**
 * Efetua login online do operador. Só funciona com rede — a auth offline
 * (cache local Dexie) é responsabilidade da camada acima (`credenciais-offline.ts`).
 */
export async function loginOperadorSupabase(input: {
  cpf: string;
  senha: string;
  companyId?: string;
}): Promise<LoginResult> {
  const supabase = getSupabase();
  const { data, error } = await supabase.functions.invoke("login-operador", {
    body: input,
  });

  if (error) {
    // FunctionsHttpError inclui o body de erro em `context.response`.
    const status =
      (error as { context?: { response?: { status?: number } } }).context
        ?.response?.status ?? 500;
    let msg = error.message || "Falha ao autenticar.";
    let opcoes: LoginResult extends { opcoes?: infer O } ? O : undefined =
      undefined;
    try {
      const resp = (error as { context?: { response?: Response } }).context
        ?.response;
      if (resp) {
        const body = (await resp.clone().json()) as {
          error?: string;
          opcoes?: LoginResult extends { opcoes?: infer O } ? O : never;
        };
        if (body?.error) msg = body.error;
        if (body?.opcoes) opcoes = body.opcoes;
      }
    } catch {
      /* ignore parse errors */
    }
    return { ok: false, status, error: msg, opcoes };
  }

  const payload = data as {
    session: {
      access_token: string;
      refresh_token: string;
    };
    operador: OperadorSessao;
  };
  if (!payload?.session?.access_token) {
    return { ok: false, status: 500, error: "Resposta sem sessão válida." };
  }

  // Fixa a sessão no client — a partir daqui todas as queries vão com JWT.
  const { error: setErr } = await supabase.auth.setSession({
    access_token: payload.session.access_token,
    refresh_token: payload.session.refresh_token,
  });
  if (setErr) {
    return { ok: false, status: 500, error: setErr.message };
  }

  return { ok: true, operador: payload.operador };
}

/** Encerra a sessão Supabase (não limpa a store da UI — quem chama faz isso). */
export async function logoutOperadorSupabase(): Promise<void> {
  await getSupabase().auth.signOut();
}

/** Devolve o `company_id` do JWT atual (null se não logado). */
export async function getCurrentCompanyId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  const md = data.session?.user?.app_metadata as
    | { company_id?: string }
    | undefined;
  return md?.company_id ?? null;
}
