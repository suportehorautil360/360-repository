import type {
  AbastecimentoRegistro,
  ApiResult,
  ChecklistApiRowRaw,
  RegistroFluxo,
  Usuario,
  VeiculoApiRowRaw,
} from '../types'
import { fetchJson } from './base'

/* ============== Sessão ============== */

export interface LoginResponse {
  ok: boolean
  msg?: string
  user?: Usuario
}

export interface SessionResponse {
  ok: boolean
  msg?: string
  logged?: boolean
  user?: Usuario
}

export async function login(
  usuario: string,
  senha: string,
): Promise<LoginResponse> {
  const res = await fetchJson('/login.php', {
    method: 'POST',
    body: { usuario, senha },
  })
  return res as unknown as LoginResponse
}

export function logout(): Promise<ApiResult> {
  return fetchJson('/logout.php', { method: 'POST', body: {} })
}

export async function session(): Promise<SessionResponse> {
  const res = await fetchJson('/session.php', { method: 'GET' })
  return res as unknown as SessionResponse
}

/* ============== Abastecimentos ============== */

export function getAbastecimentos(): Promise<ApiResult<AbastecimentoRegistro>> {
  return fetchJson<AbastecimentoRegistro>('/abastecimentos.php', { method: 'GET' })
}

export function postAbastecimento(
  row: Partial<AbastecimentoRegistro> & {
    client_ref?: string | number | null
  },
): Promise<ApiResult<AbastecimentoRegistro>> {
  return fetchJson<AbastecimentoRegistro>('/abastecimentos.php', {
    method: 'POST',
    body: row,
  })
}

/* ============== Veículos ============== */

export function getVeiculos(): Promise<ApiResult<VeiculoApiRowRaw>> {
  return fetchJson<VeiculoApiRowRaw>('/veiculos.php', { method: 'GET' })
}

export function postVeiculo(row: Partial<VeiculoApiRowRaw>): Promise<ApiResult> {
  return fetchJson('/veiculos.php', { method: 'POST', body: row })
}

/* ============== Checklists ============== */

export function getChecklists(): Promise<ApiResult<ChecklistApiRowRaw>> {
  return fetchJson<ChecklistApiRowRaw>('/checklists.php', { method: 'GET' })
}

export function postChecklist(
  row: Partial<ChecklistApiRowRaw> & { chassis?: string },
): Promise<ApiResult> {
  return fetchJson('/checklists.php', { method: 'POST', body: row })
}

/* ============== O.S. ============== */

export function getOs(): Promise<ApiResult<RegistroFluxo>> {
  return fetchJson<RegistroFluxo>('/os.php', { method: 'GET' })
}

export function postOs(row: RegistroFluxo): Promise<ApiResult> {
  return fetchJson('/os.php', { method: 'POST', body: row })
}

export function postOsStatus(
  id: number | string,
  status: string,
): Promise<ApiResult> {
  return fetchJson('/os.php', {
    method: 'POST',
    body: { action: 'status', id, status },
  })
}

/* ============== Orçamentos ============== */

export function getOrcamentos(
  osId?: number | string,
): Promise<ApiResult<RegistroFluxo>> {
  const q = osId ? `?os_id=${encodeURIComponent(String(osId))}` : ''
  return fetchJson<RegistroFluxo>(`/orcamentos.php${q}`, { method: 'GET' })
}

export function postOrcamento(row: RegistroFluxo): Promise<ApiResult> {
  return fetchJson('/orcamentos.php', { method: 'POST', body: row })
}

/* ============== NF Posto ============== */

export function getNfPosto(): Promise<ApiResult<RegistroFluxo>> {
  return fetchJson<RegistroFluxo>('/nf_posto.php', { method: 'GET' })
}

export function postNfPosto(row: RegistroFluxo): Promise<ApiResult> {
  return fetchJson('/nf_posto.php', { method: 'POST', body: row })
}

export function postNfPostoStatus(
  id: number | string,
  status: string,
): Promise<ApiResult> {
  return fetchJson('/nf_posto.php', {
    method: 'POST',
    body: { action: 'status', id, status },
  })
}

/* ============== App Eventos ============== */

export function getAppEventos(): Promise<ApiResult<RegistroFluxo>> {
  return fetchJson<RegistroFluxo>('/app_eventos.php', { method: 'GET' })
}

export function postAppEventos(events: RegistroFluxo[]): Promise<ApiResult> {
  return fetchJson('/app_eventos.php', {
    method: 'POST',
    body: { events },
  })
}
