import { getHu360 } from './hu360Access'
import type { ControleAbastecimento, FatAggResult, FatUltimoSnapshot } from './postoPortalTypes'
import { esc, formatRealBr } from './postoPortalFormat'
import {
  encontrarPostoCredenciado,
  obterCaMesclado,
  postoAbsDentroDoMesRef,
} from './postoPortalHu360Data'
import type { PortalSessao } from './postoPortalTypes'

type PmBase = { controleAbastecimento?: ControleAbastecimento }

export function postoAgregarFaturamentoMes(
  ca: ControleAbastecimento,
  pmBase: PmBase | undefined,
  ano: number,
  mes: number,
  secretariaFiltro: string,
  postoId: string | undefined,
): FatAggResult {
  const abs = ca.abastecimentos ?? []
  let vEdital = Number(ca.valorUnitarioEdital)
  if (Number.isNaN(vEdital) || vEdital <= 0) {
    const baseCa = pmBase?.controleAbastecimento
    vEdital =
      baseCa && Number(baseCa.valorUnitarioEdital)
        ? Number(baseCa.valorUnitarioEdital)
        : 0
  }
  const map: Record<
    string,
    { equip: string; qtd: number; litros: number }
  > = {}
  abs.forEach((a) => {
    if (postoId && a.postoId !== postoId) {
      return
    }
    if (!postoAbsDentroDoMesRef(a.data, ano, mes)) {
      return
    }
    if (secretariaFiltro && secretariaFiltro !== '__todas__') {
      const sec = (a.secretaria ?? '').trim()
      if (sec !== secretariaFiltro) {
        return
      }
    }
    let eq = (a.veiculo ?? '—').trim()
    if (!eq) {
      eq = '—'
    }
    if (!map[eq]) {
      map[eq] = { equip: eq, qtd: 0, litros: 0 }
    }
    map[eq].qtd += 1
    map[eq].litros += Number(a.litros) || 0
  })
  const rows = Object.keys(map)
    .sort()
    .map((k) => {
      const r = map[k]
      return {
        ...r,
        valorFaturar: r.litros * vEdital,
      }
    })
  const totalLitros = rows.reduce((s, r) => s + r.litros, 0)
  const totalFaturar = totalLitros * vEdital
  return {
    rows,
    totalLitros,
    totalFaturar,
    valorUnitarioEdital: vEdital,
  }
}

export function buildFaturamentoSnapshot(
  portal: PortalSessao,
  ano: number,
  mes: number,
  secretariaFiltro: string,
): FatUltimoSnapshot | null {
  if (!portal || !('postoId' in portal) || !portal.postoId) {
    return null
  }
  const pid = portal.prefeituraId || 'tl-ms'
  const postoId = portal.postoId
  const ca = obterCaMesclado(pid)
  const hu = getHu360()
  const pmBase = hu?.criarDadosDemo(pid) as { prefeituraModulo?: PmBase } | undefined
  const agg = postoAgregarFaturamentoMes(
    ca,
    pmBase?.prefeituraModulo,
    ano,
    mes,
    secretariaFiltro,
    postoId,
  )
  const pInfo = encontrarPostoCredenciado(ca, postoId)
  const postoLabel = pInfo
    ? pInfo.nomeFantasia || pInfo.razaoSocial || postoId
    : postoId
  const municipio = hu?.prefeituraLabel(pid) ?? pid
  return {
    agg,
    ano,
    mes,
    municipio,
    secretariaFiltro,
    postoLabel,
    postoId,
  }
}

export function postoExportarFaturamentoCsvFromSnapshot(u: FatUltimoSnapshot): void {
  const agg = u.agg
  const linhas = [
    'Equipamento;Qtd abastecimentos;Total litros;Valor unit edital (R$/L);Valor total edital (R$)',
  ]
  agg.rows.forEach((r) => {
    linhas.push(
      [
        `"${String(r.equip).replace(/"/g, '""')}"`,
        String(r.qtd),
        String(r.litros).replace('.', ','),
        String(agg.valorUnitarioEdital).replace('.', ','),
        String(r.valorFaturar.toFixed(2)).replace('.', ','),
      ].join(';'),
    )
  })
  linhas.push(
    [
      '"TOTAL"',
      '',
      String(agg.totalLitros).replace('.', ','),
      '',
      String(agg.totalFaturar.toFixed(2)).replace('.', ','),
    ].join(';'),
  )
  const slugPosto = String(u.postoId || 'posto').replace(/[^\w-]/g, '_')
  const nome =
    'faturamento-posto-' +
    slugPosto +
    '-' +
    u.ano +
    '-' +
    String(u.mes).padStart(2, '0') +
    (u.secretariaFiltro && u.secretariaFiltro !== '__todas__'
      ? '-' + u.secretariaFiltro.replace(/\s+/g, '_').slice(0, 24)
      : '') +
    '.csv'
  const blob = new Blob(['\ufeff' + linhas.join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  a.click()
  URL.revokeObjectURL(a.href)
}

export function postoExportarFaturamentoPdfFromSnapshot(u: FatUltimoSnapshot): void {
  const agg = u.agg
  const mesNomes = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ]
  const tituloMes = mesNomes[u.mes - 1] + ' / ' + u.ano
  const secTxt =
    u.secretariaFiltro === '__todas__'
      ? 'Todas as secretarias'
      : u.secretariaFiltro
  const rowsHtml = agg.rows
    .map((r) => {
      return (
        '<tr><td>' +
        esc(r.equip) +
        '</td><td style="text-align:center">' +
        r.qtd +
        '</td><td style="text-align:right">' +
        r.litros.toLocaleString('pt-BR') +
        " L</td><td style=\"text-align:right\">" +
        esc(formatRealBr(r.valorFaturar)) +
        '</td></tr>'
      )
    })
    .join('')
  const html =
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Relatório faturamento</title>' +
    '<style>body{font-family:Segoe UI,sans-serif;padding:24px;color:#111}h1{font-size:18px}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #333;padding:8px;font-size:12px}th{background:#eee;text-align:left}</style></head><body>' +
    '<h1>Relatório para conferência / anexo NF</h1>' +
    '<p><strong>Município:</strong> ' +
    esc(u.municipio) +
    '<br><strong>Posto credenciado:</strong> ' +
    esc(u.postoLabel || u.postoId) +
    '<br><strong>Período:</strong> ' +
    esc(tituloMes) +
    '<br><strong>Secretaria:</strong> ' +
    esc(secTxt) +
    '<br><strong>Valor unitário (edital):</strong> ' +
    esc(formatRealBr(agg.valorUnitarioEdital)) +
    ' / L</p>' +
    '<table><thead><tr><th>Equipamento</th><th>Qtd</th><th>Litros</th><th>Valor (edital)</th></tr></thead><tbody>' +
    rowsHtml +
    '</tbody><tfoot><tr><th colspan="2">Totais</th><th style="text-align:right">' +
    agg.totalLitros.toLocaleString('pt-BR') +
    " L</th><th style=\"text-align:right\">" +
    esc(formatRealBr(agg.totalFaturar)) +
    '</th></tr></tfoot></table>' +
    '<p style="margin-top:20px;font-size:11px;color:#444">Gerado em ' +
    new Date().toLocaleString('pt-BR') +
    ' — Hora Útil 360 (demonstração).</p>' +
    '</body></html>'
  const w = window.open('', '_blank')
  if (!w) {
    alert('Permita pop-ups para gerar o PDF por impressão.')
    return
  }
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
}
