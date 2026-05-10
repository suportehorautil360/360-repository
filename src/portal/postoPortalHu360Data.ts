import { getHu360 } from './hu360Access'
import type {
  AbastecimentoRow,
  ControleAbastecimento,
  PostoCredenciado,
} from './postoPortalTypes'
import { mesmoMes, parseDataBr } from './postoPortalFormat'

export function obterCaMesclado(prefeituraId: string): ControleAbastecimento {
  const hu = getHu360()
  if (!hu) {
    return {}
  }
  const dados = hu.getDadosPrefeitura(prefeituraId) as {
    prefeituraModulo?: { controleAbastecimento?: ControleAbastecimento }
  }
  const demo = hu.criarDadosDemo(prefeituraId) as {
    prefeituraModulo?: { controleAbastecimento?: ControleAbastecimento }
  }
  const pmBase = demo.prefeituraModulo
  const caBase = pmBase?.controleAbastecimento ?? {}
  const caSav =
    dados.prefeituraModulo?.controleAbastecimento ??
    ({} as ControleAbastecimento)
  return { ...caBase, ...caSav }
}

export function encontrarPostoCredenciado(
  ca: ControleAbastecimento,
  postoId: string,
): PostoCredenciado | null {
  const list = ca.postosCredenciados ?? []
  return list.find((p) => p.id === postoId) ?? null
}

export function filtrarAbsPosto(
  ca: ControleAbastecimento,
  postoId: string,
  anoMesFiltro: { ano: number; mes: number } | null,
): AbastecimentoRow[] {
  const abs = ca.abastecimentos ?? []
  return abs.filter((a) => {
    if (a.postoId !== postoId) {
      return false
    }
    if (!anoMesFiltro) {
      return true
    }
    const dt = parseDataBr(a.data ?? '')
    return mesmoMes(dt, anoMesFiltro.ano, anoMesFiltro.mes)
  })
}

export function postoAbsDentroDoMesRef(
  dataStr: string | undefined,
  ano: number,
  mes: number,
): boolean {
  const d = parseDataBr(dataStr ?? '')
  if (!d) {
    return false
  }
  return d.getFullYear() === ano && d.getMonth() + 1 === mes
}

export function mesesOptions(count: number): { value: string; label: string }[] {
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
  const now = new Date()
  const out: { value: string; label: string }[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const value = `${y}-${String(m).padStart(2, '0')}`
    out.push({ value, label: `${mesNomes[m - 1]} / ${y}` })
  }
  return out
}

export function parseMesValor(selVal: string | null | undefined): {
  ano: number
  mes: number
} | null {
  if (!selVal) return null
  const p = selVal.split('-')
  return { ano: parseInt(p[0], 10), mes: parseInt(p[1], 10) }
}
