import type { ApiResult } from '../types'

declare global {
  interface Window {
    HU360_API_BASE?: string
  }
}

export function getApiBase(): string {
  if (typeof window === 'undefined') return ''
  const b = window.HU360_API_BASE
  return b == null ? '' : String(b).replace(/\/+$/, '')
}

export function apiEnabled(): boolean {
  return getApiBase().length > 0
}

export function buildUrl(path: string): string {
  const base = getApiBase()
  return base + (path.startsWith('/') ? path : '/' + path)
}

export interface FetchJsonOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

export async function fetchJson<TRow = unknown>(
  path: string,
  opts: FetchJsonOptions = {},
): Promise<ApiResult<TRow>> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string> | undefined),
  }
  let body: BodyInit | null | undefined
  const method = (opts.method || 'GET').toUpperCase()

  if (method !== 'GET' && method !== 'HEAD') {
    if (opts.body instanceof FormData) {
      body = opts.body
    } else if (
      opts.body !== undefined &&
      opts.body !== null &&
      typeof opts.body === 'object'
    ) {
      body = JSON.stringify(opts.body)
      headers['Content-Type'] = 'application/json'
    } else if (typeof opts.body === 'string') {
      body = opts.body
    }
  }

  const init: RequestInit = {
    ...opts,
    method,
    headers,
    body,
    credentials: 'include',
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path), init)
  } catch {
    return { ok: false, msg: 'Falha de rede.' }
  }

  const text = await response.text()
  let parsed: Partial<ApiResult<TRow>>
  try {
    parsed = (text ? JSON.parse(text) : {}) as Partial<ApiResult<TRow>>
  } catch {
    return { ok: false, msg: 'Resposta inválida do servidor.' }
  }

  const result: ApiResult<TRow> = {
    ...parsed,
    ok: parsed.ok ?? response.ok,
  }
  if (!response.ok && result.msg == null) {
    result.msg = `HTTP ${response.status}`
  }
  return result
}
