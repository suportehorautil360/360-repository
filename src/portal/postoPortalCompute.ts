import { formatRealBr, parseDataBr, parseRealBr } from './postoPortalFormat'
import {
  encontrarPostoCredenciado,
  filtrarAbsPosto,
  obterCaMesclado,
} from './postoPortalHu360Data'
import type {
  AbastecimentoRow,
  PortalSessao,
  PostoCredenciado,
} from './postoPortalTypes'

export type DashboardKpis = {
  absMes: number
  litrosMes: string
  valorMes: string
  totalGeralAbs: number
  postoLabel: string
}

export function computeDashboardKpis(portal: PortalSessao): DashboardKpis | null {
  if (!portal || !('postoId' in portal) || !portal.postoId) {
    return null
  }
  const pid = portal.prefeituraId
  const ca = obterCaMesclado(pid)
  const postoId = portal.postoId
  const now = new Date()
  const listaMes = filtrarAbsPosto(ca, postoId, {
    ano: now.getFullYear(),
    mes: now.getMonth() + 1,
  })
  const litrosMes = listaMes.reduce((s, a) => s + (Number(a.litros) || 0), 0)
  const valorMes = listaMes.reduce(
    (s, a) => s + parseRealBr(a.valorTotal),
    0,
  )
  const todosPosto = filtrarAbsPosto(ca, postoId, null)
  const pInfo = encontrarPostoCredenciado(ca, postoId)
  const postoLabel = pInfo
    ? pInfo.nomeFantasia || pInfo.razaoSocial || postoId
    : postoId
  return {
    absMes: listaMes.length,
    litrosMes:
      litrosMes.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }) + ' L',
    valorMes: formatRealBr(valorMes),
    totalGeralAbs: todosPosto.length,
    postoLabel,
  }
}

export function computeAbsRowsSorted(
  portal: PortalSessao,
  filtroMesVal: string | null,
): AbastecimentoRow[] {
  if (!portal || !('postoId' in portal) || !portal.postoId) {
    return []
  }
  const ca = obterCaMesclado(portal.prefeituraId)
  let filtro: { ano: number; mes: number } | null = null
  if (filtroMesVal) {
    const p = filtroMesVal.split('-')
    filtro = { ano: parseInt(p[0], 10), mes: parseInt(p[1], 10) }
  }
  const lista = filtrarAbsPosto(ca, portal.postoId, filtro)
  lista.sort((a, b) => {
    const da = parseDataBr(a.data ?? '')
    const db = parseDataBr(b.data ?? '')
    return (db ? db.getTime() : 0) - (da ? da.getTime() : 0)
  })
  return lista
}

export type CredView =
  | { ok: false; html: string }
  | { ok: true; posto: PostoCredenciado }

export function computeCredenciamentoView(portal: PortalSessao): CredView | null {
  if (!portal || !('postoId' in portal) || !portal.postoId) {
    return null
  }
  const ca = obterCaMesclado(portal.prefeituraId)
  const p = encontrarPostoCredenciado(ca, portal.postoId)
  if (!p) {
    return {
      ok: false,
      html:
        '<p style="color:#92400e;">Posto não encontrado nos dados do município. Verifique o cadastro no Hub.</p>',
    }
  }
  return { ok: true, posto: p }
}
