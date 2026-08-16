/**
 * Cliente Supabase — singleton compartilhado por todo o PWA.
 *
 * Sessão persiste em localStorage (key `hu360-supabase-auth`). A auth do
 * operador é feita via Edge Function `login-operador` (ver `session.ts`),
 * que devolve um JWT com `app_metadata.company_id` para RLS.
 *
 * Não usa `persistentLocalCache` estilo Firestore SDK — a camada offline é
 * o Dexie (`lib/offline/*`), que continua responsável por fila de writes e
 * cache de reads. Este client só faz o transporte HTTP para o Supabase.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes — client não vai funcionar.",
  );
}

let _client: SupabaseClient | null = null;

/**
 * Devolve o singleton do Supabase. Cria na primeira chamada. Usa localStorage
 * para persistir a sessão entre reloads do PWA (offline-first exige que a
 * sessão sobreviva ao boot mesmo sem rede).
 */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  // Nada de headers globais custom aqui: a Edge Function `login-operador` só
  // permite `authorization, x-client-info, apikey, content-type` no CORS
  // Access-Control-Allow-Headers. Um `x-client` custom sobrevive ao request
  // direto (curl), mas o browser bloqueia no preflight — motivo do CORS error
  // reportado em prod. `x-client-info` que o supabase-js já envia serve pra
  // telemetria.
  _client = createClient(SUPABASE_URL ?? "", SUPABASE_ANON_KEY ?? "", {
    auth: {
      storageKey: "hu360-supabase-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  return _client;
}
