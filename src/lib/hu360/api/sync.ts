import { criarDadosDemo } from '../demoData'
import { getDadosPrefeitura, salvarDadosPrefeitura } from '../storage'
import type {
  AbastecimentoRegistro,
  ApiResult,
  ChecklistApiRowRaw,
  ControleAbastecimento,
  RegistroFluxo,
  VeiculoApiRowRaw,
} from '../types'
import { apiEnabled } from './base'
import {
  getAbastecimentos,
  getAppEventos,
  getChecklists,
  getNfPosto,
  getOrcamentos,
  getOs,
  getVeiculos,
  postAbastecimento,
  postChecklist,
  postVeiculo,
} from './endpoints'
import { mapChecklistApiRow, mapVeiculoApiRow } from './mappers'

function mergeAbastecimentosIntoLocalStorage(
  prefeituraId: string,
  rows: AbastecimentoRegistro[],
): void {
  if (!prefeituraId || !Array.isArray(rows)) return
  const dados = getDadosPrefeitura(prefeituraId)
  const pmBase = criarDadosDemo(prefeituraId).prefeituraModulo
  const ca: ControleAbastecimento = {
    ...pmBase.controleAbastecimento,
    ...(dados.prefeituraModulo?.controleAbastecimento || {}),
    abastecimentos: rows.slice(),
  }
  dados.prefeituraModulo = {
    ...dados.prefeituraModulo,
    controleAbastecimento: ca,
  }
  salvarDadosPrefeitura(prefeituraId, dados)
}

export function pullAbastecimentos(
  prefeituraId: string,
): Promise<ApiResult<AbastecimentoRegistro>> {
  if (!apiEnabled()) {
    return Promise.resolve({ ok: true, skipped: true })
  }
  return getAbastecimentos().then((res) => {
    if (res.ok && res.rows) {
      mergeAbastecimentosIntoLocalStorage(prefeituraId, res.rows)
    }
    return res
  })
}

export function pushAbastecimento(
  prefeituraId: string,
  registro: AbastecimentoRegistro,
): Promise<ApiResult<AbastecimentoRegistro>> {
  if (!apiEnabled()) {
    return Promise.resolve({ ok: true, skipped: true })
  }
  const payload: Partial<AbastecimentoRegistro> & {
    client_ref?: string | number | null
  } = { ...registro }
  payload.client_ref =
    (registro as { client_ref?: string | number }).client_ref ??
    registro.id ??
    null

  return postAbastecimento(payload).then((res) => {
    if (res.ok && res.row) {
      const dados = getDadosPrefeitura(prefeituraId)
      const pmBase = criarDadosDemo(prefeituraId).prefeituraModulo
      const ca: ControleAbastecimento = {
        ...pmBase.controleAbastecimento,
        ...(dados.prefeituraModulo?.controleAbastecimento || {}),
      }
      const list = (ca.abastecimentos || []).slice()
      const idx = list.findIndex((x) => x.id === registro.id)
      if (idx >= 0) {
        list[idx] = res.row
      } else {
        list.unshift(res.row)
      }
      ca.abastecimentos = list
      dados.prefeituraModulo = {
        ...dados.prefeituraModulo,
        controleAbastecimento: ca,
      }
      salvarDadosPrefeitura(prefeituraId, dados)
    }
    return res
  })
}

function mergeVeiculosIntoLocalStorage(
  prefeituraId: string,
  rows: VeiculoApiRowRaw[],
): void {
  if (!prefeituraId || !Array.isArray(rows)) return
  const dados = getDadosPrefeitura(prefeituraId)
  dados.prefeituraModulo = {
    ...dados.prefeituraModulo,
    veiculosApi: rows.map(mapVeiculoApiRow),
  }
  salvarDadosPrefeitura(prefeituraId, dados)
}

function mergeChecklistsIntoLocalStorage(
  prefeituraId: string,
  rows: ChecklistApiRowRaw[],
): void {
  if (!prefeituraId || !Array.isArray(rows)) return
  const dados = getDadosPrefeitura(prefeituraId)
  dados.prefeituraModulo = {
    ...dados.prefeituraModulo,
    checklistsCampo: rows.map(mapChecklistApiRow),
  }
  salvarDadosPrefeitura(prefeituraId, dados)
}

export function pullVeiculos(
  prefeituraId: string,
): Promise<ApiResult<VeiculoApiRowRaw>> {
  if (!apiEnabled()) {
    return Promise.resolve({ ok: true, skipped: true })
  }
  return getVeiculos().then((res) => {
    if (res.ok && res.rows) {
      mergeVeiculosIntoLocalStorage(prefeituraId, res.rows)
    }
    return res
  })
}

export function pullChecklists(
  prefeituraId: string,
): Promise<ApiResult<ChecklistApiRowRaw>> {
  if (!apiEnabled()) {
    return Promise.resolve({ ok: true, skipped: true })
  }
  return getChecklists().then((res) => {
    if (res.ok && res.rows) {
      mergeChecklistsIntoLocalStorage(prefeituraId, res.rows)
    }
    return res
  })
}

export function pushVeiculo(
  prefeituraId: string,
  row: Partial<VeiculoApiRowRaw>,
): Promise<ApiResult> {
  if (!apiEnabled()) {
    return Promise.resolve({ ok: true, skipped: true })
  }
  return postVeiculo(row).then((res) => {
    if (res.ok && res.id != null) {
      const dados = getDadosPrefeitura(prefeituraId)
      const list = dados.prefeituraModulo?.veiculosApi
        ? dados.prefeituraModulo.veiculosApi.slice()
        : []
      const nv = mapVeiculoApiRow({
        id: res.id,
        chassis: row.chassis,
        marca: row.marca,
        modelo: row.modelo,
        tipo_frota: row.tipo_frota,
      })
      const idx = list.findIndex((x) => x.id === nv.id)
      if (idx >= 0) {
        list[idx] = nv
      } else {
        list.unshift(nv)
      }
      dados.prefeituraModulo = {
        ...dados.prefeituraModulo,
        veiculosApi: list,
      }
      salvarDadosPrefeitura(prefeituraId, dados)
    }
    return res
  })
}

function isoAgora(): string {
  const now = new Date()
  const z2 = (n: number) => (n < 10 ? '0' + n : String(n))
  return (
    now.getFullYear() +
    '-' +
    z2(now.getMonth() + 1) +
    '-' +
    z2(now.getDate()) +
    ' ' +
    z2(now.getHours()) +
    ':' +
    z2(now.getMinutes()) +
    ':' +
    z2(now.getSeconds())
  )
}

export function pushChecklist(
  prefeituraId: string,
  row: Partial<ChecklistApiRowRaw> & { chassis?: string },
): Promise<ApiResult> {
  if (!apiEnabled()) {
    return Promise.resolve({ ok: true, skipped: true })
  }
  return postChecklist(row).then((res) => {
    if (res.ok && res.id != null) {
      const dados = getDadosPrefeitura(prefeituraId)
      const list = dados.prefeituraModulo?.checklistsCampo
        ? dados.prefeituraModulo.checklistsCampo.slice()
        : []
      const merged = mapChecklistApiRow({
        id: res.id,
        veiculo_id: row.veiculo_id,
        chassis_qr: row.chassis_qr || row.chassis || '',
        status_oleo: row.status_oleo,
        status_filtros: row.status_filtros,
        observacoes: row.observacoes,
        criado_em: isoAgora(),
      })
      list.unshift(merged)
      dados.prefeituraModulo = {
        ...dados.prefeituraModulo,
        checklistsCampo: list,
      }
      salvarDadosPrefeitura(prefeituraId, dados)
    }
    return res
  })
}

interface FluxoServidorPack {
  os: RegistroFluxo[]
  orcamentos: RegistroFluxo[]
  nfPosto: RegistroFluxo[]
  appEventos: RegistroFluxo[]
}

function mergeFluxoServidorIntoLocalStorage(
  prefeituraId: string,
  pack: FluxoServidorPack,
): void {
  if (!prefeituraId || !pack) return
  const dados = getDadosPrefeitura(prefeituraId)
  dados.prefeituraModulo = {
    ...dados.prefeituraModulo,
    fluxoServidor: {
      os: Array.isArray(pack.os) ? pack.os.slice() : [],
      orcamentos: Array.isArray(pack.orcamentos)
        ? pack.orcamentos.slice()
        : [],
      nfPosto: Array.isArray(pack.nfPosto) ? pack.nfPosto.slice() : [],
      appEventos: Array.isArray(pack.appEventos)
        ? pack.appEventos.slice()
        : [],
      atualizadoEm: new Date().toISOString(),
    },
  }
  salvarDadosPrefeitura(prefeituraId, dados)
}

export function pullFluxoServidor(
  prefeituraId: string,
): Promise<ApiResult> {
  if (!apiEnabled()) {
    return Promise.resolve({ ok: true, skipped: true })
  }
  return Promise.all([
    getOs(),
    getOrcamentos(),
    getNfPosto(),
    getAppEventos(),
  ]).then(([a, b, c, d]) => {
    if (a.ok && b.ok && c.ok && d.ok) {
      mergeFluxoServidorIntoLocalStorage(prefeituraId, {
        os: a.rows || [],
        orcamentos: b.rows || [],
        nfPosto: c.rows || [],
        appEventos: d.rows || [],
      })
    }
    return { ok: true, partial: !(a.ok && b.ok && c.ok && d.ok) }
  })
}
