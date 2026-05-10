/**
 * Cadastro de equipamentos (locação) — utilidades puras.
 *
 * Espelha a lógica de `js/equipamentos-cadastro.js` legado, sem depender de
 * DOM, React ou window. Os efeitos (storage / state) ficam no hook
 * `useEquipamentosCadastro` e na bridge `equipamentosBridge`.
 */
import type { EquipamentoCadastro } from './types'

export interface EquipamentoEntrada {
  marca?: string
  modelo?: string
  chassis?: string
  descricao?: string
  linha?: string
  obra?: string
}

export function norm(s: unknown): string {
  return String(s == null ? '' : s).trim()
}

export function formatLabelEquipamentoCadastro(e: EquipamentoEntrada): string {
  const tipo = norm(e.descricao) || norm(e.modelo) || 'Equipamento'
  const marca = norm(e.marca) || '—'
  const ch = norm(e.chassis) || '—'
  return `${tipo} (${marca}), chassi ${ch}`
}

export function novoIdEquipamento(pid: string): string {
  return `eq-cad-${pid}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/* ============== Parser de planilha (CSV / TSV / colado do Excel) ============== */

type Delimitador = ',' | ';' | '\t'

function splitLine(line: string, delim: Delimitador): string[] {
  if (delim === '\t') {
    return line.split('\t').map(norm)
  }
  const parts: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      q = !q
      continue
    }
    if (!q && c === delim) {
      parts.push(norm(cur))
      cur = ''
      continue
    }
    cur += c
  }
  parts.push(norm(cur))
  return parts
}

function detectDelim(firstLine: string): Delimitador {
  if (firstLine.indexOf('\t') >= 0) return '\t'
  const sc = (firstLine.match(/;/g) || []).length
  const cc = (firstLine.match(/,/g) || []).length
  if (sc >= cc && sc > 0) return ';'
  return ','
}

function indiceCabecalho(headLower: string[], names: string[]): number {
  for (const want of names) {
    const j = headLower.indexOf(want)
    if (j >= 0) return j
    for (let k = 0; k < headLower.length; k++) {
      if (headLower[k].indexOf(want) >= 0) return k
    }
  }
  return -1
}

interface MapaCabecalho {
  marcaIdx: number
  modeloIdx: number
  tipoIdx: number
  chassisIdx: number
  linhaIdx: number
  obraIdx: number
}

function parseLinhasCabecalho(
  headLower: string[],
  cols: string[],
): MapaCabecalho {
  let im = indiceCabecalho(headLower, ['marca', 'fabricante'])
  let imo = indiceCabecalho(headLower, ['modelo'])
  const it = indiceCabecalho(headLower, [
    'tipo',
    'descrição',
    'descricao',
    'equipamento',
    'família',
    'familia',
  ])
  let ic = indiceCabecalho(headLower, [
    'chassis',
    'chassi',
    'nº chassi',
    'serie',
    'serial',
    'vin',
  ])
  if (im < 0) im = 0
  if (imo < 0) imo = 1
  if (ic < 0) {
    ic =
      cols.length >= 3
        ? Math.max(im, imo, 2)
        : Math.max(im, imo + 1, cols.length - 1)
  }
  if (ic >= cols.length) ic = cols.length - 1
  const ilinha = indiceCabecalho(headLower, [
    'linha',
    'classificacao',
    'classificação',
    'categoria',
  ])
  const iobra = indiceCabecalho(headLower, [
    'obra',
    'obras',
    'serviço',
    'servico',
    'contrato',
  ])
  return {
    marcaIdx: im,
    modeloIdx: imo,
    tipoIdx: it,
    chassisIdx: ic,
    linhaIdx: ilinha,
    obraIdx: iobra,
  }
}

export interface EquipamentoParseado {
  marca: string
  modelo: string
  chassis: string
  descricao: string
  linha: string
  obra: string
}

export function parsePlanilhaTexto(raw: string): EquipamentoParseado[] {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map(norm)
    .filter((l) => l.length > 0)
  const out: EquipamentoParseado[] = []
  if (!lines.length) return out

  const delim = detectDelim(lines[0])
  const cols0 = splitLine(lines[0], delim)
  const headGuess = cols0.some((c) =>
    /marca|modelo|chassis|chassi|tipo|fabricante|descri|equip|linha|classif|obra|servi[cç]o|contrato/i.test(
      c,
    ),
  )
  let start = 0
  let idxMap: MapaCabecalho | null = null
  if (headGuess) {
    start = 1
    const headLow = cols0.map((c) => norm(c).toLowerCase())
    idxMap = parseLinhasCabecalho(headLow, cols0)
  }

  for (let i = start; i < lines.length; i++) {
    const cols = splitLine(lines[i], delim).map(norm)
    if (!cols.filter(Boolean).length) continue

    let marca = ''
    let modelo = ''
    let tipo = ''
    let chassis = ''
    let linhaVal = ''
    let obraVal = ''

    if (idxMap) {
      marca = cols[idxMap.marcaIdx] || ''
      modelo = cols[idxMap.modeloIdx] || ''
      if (idxMap.tipoIdx >= 0) tipo = cols[idxMap.tipoIdx] || ''
      chassis = cols[idxMap.chassisIdx] || ''
      if (!chassis && cols.length > idxMap.chassisIdx + 1) {
        chassis = cols[idxMap.chassisIdx + 1] || ''
      }
      if (idxMap.linhaIdx >= 0) linhaVal = cols[idxMap.linhaIdx] || ''
      if (idxMap.obraIdx >= 0) obraVal = cols[idxMap.obraIdx] || ''
    } else if (cols.length === 1) {
      chassis = cols[0]
    } else if (cols.length === 2) {
      marca = cols[0]
      chassis = cols[1]
    } else {
      marca = cols[0] || ''
      modelo = cols[1] || ''
      chassis = cols[2] || ''
      if (cols.length > 3) {
        linhaVal = cols.slice(3).join(' ').trim()
      }
    }

    const marcaFinal = marca || '—'
    if (!chassis) continue

    out.push({
      marca: marcaFinal,
      modelo,
      chassis,
      descricao: tipo || modelo || '',
      linha: linhaVal,
      obra: obraVal,
    })
  }
  return out
}

/* ============== Mesclar lista existente com novos itens ============== */

export interface AddBatchOpts {
  /** Se true, ignora itens cujo chassi já existe na lista. Default: true. */
  descartarChassisDup?: boolean
}

export interface AddBatchResult {
  lista: EquipamentoCadastro[]
  adicionados: number
}

/**
 * Recebe a lista atual + novos itens e devolve a lista atualizada e o
 * número de adicionados (puro, sem efeito colateral).
 */
export function adicionarLote(
  pid: string,
  listaAtual: EquipamentoCadastro[],
  itens: EquipamentoEntrada[],
  opts: AddBatchOpts = {},
): AddBatchResult {
  const descartarDup = opts.descartarChassisDup !== false
  const lista = [...listaAtual]
  const seen = new Set<string>()
  for (const x of lista) {
    const k = norm(x.chassis).toLowerCase()
    if (k) seen.add(k)
  }
  let adicionados = 0
  for (const item of itens) {
    const ch = norm(item.chassis)
    if (!ch) continue
    const lk = ch.toLowerCase()
    if (descartarDup && seen.has(lk)) continue
    seen.add(lk)
    lista.push({
      id: novoIdEquipamento(pid),
      marca: norm(item.marca) || '—',
      modelo: norm(item.modelo),
      chassis: ch,
      descricao: norm(item.descricao),
      linha: norm(item.linha),
      obra: norm(item.obra) || undefined,
      criadoEm: new Date().toISOString().slice(0, 16).replace('T', ' '),
    })
    adicionados += 1
  }
  return { lista, adicionados }
}

export function removerEquipamentoLista(
  listaAtual: EquipamentoCadastro[],
  equipId: string,
): EquipamentoCadastro[] {
  return listaAtual.filter((x) => x.id !== equipId)
}

/**
 * Lê um File como UTF-8 e devolve o texto. Útil para o input `<input type=file>`.
 */
export function arquivoToTextPromise(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('Arquivo não selecionado.'))
      return
    }
    const r = new FileReader()
    r.onload = () => resolve(String(r.result || ''))
    r.onerror = () => reject(r.error ?? new Error('Falha ao ler arquivo.'))
    r.readAsText(file, 'UTF-8')
  })
}
