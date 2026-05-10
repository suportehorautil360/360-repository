import { criarDadosDemo } from './demoData'
import { DEFAULT_USERS, PREFEITURAS_SEED } from './seed'
import {
  enriquecerPrefeitura,
  mesclarContratoSalvo,
  novoIdPrefeitura,
  prefeituraLabelFromList,
} from './tenant'
import type {
  AdicionarClientePayload,
  DadosPrefeitura,
  OperationResult,
  Prefeitura,
  Usuario,
} from './types'

export const USERS_KEY = 'hu360_users'
export const SESSION_KEY = 'hu360_session'
export const PREFEITURAS_KEY = 'hu360_prefeituras'

function lerJson<T>(key: string): T | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function salvarPrefeiturasLista(arr: Prefeitura[]): void {
  localStorage.setItem(PREFEITURAS_KEY, JSON.stringify(arr))
}

export function obterPrefeituras(): Prefeitura[] {
  let arr = lerJson<Prefeitura[]>(PREFEITURAS_KEY)
  if (!arr || !Array.isArray(arr) || arr.length === 0) {
    arr = PREFEITURAS_SEED.slice()
    salvarPrefeiturasLista(arr)
  }
  return arr.map(enriquecerPrefeitura)
}

export function prefeituraLabel(id: string): string {
  return prefeituraLabelFromList(obterPrefeituras(), id)
}

export function salvarUsuarios(users: Usuario[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function carregarUsuarios(): Usuario[] {
  let list = lerJson<Usuario[]>(USERS_KEY)
  if (!list || !Array.isArray(list)) {
    list = DEFAULT_USERS.slice()
    salvarUsuarios(list)
    return list
  }
  let mudou = false
  list = list.map((u) => {
    if (!u.prefeituraId) {
      if (u.usuario === 'gestor') {
        u.prefeituraId = 'curitiba-pr'
      } else if (u.usuario === 'admin.bh') {
        u.prefeituraId = 'bh-mg'
      } else {
        u.prefeituraId = 'tl-ms'
      }
      mudou = true
    }
    if (!u.vinculo) {
      u.vinculo = 'prefeitura'
      mudou = true
    }
    return u
  })
  DEFAULT_USERS.forEach((def) => {
    if (!list!.some((u) => u.usuario === def.usuario)) {
      list!.push({ ...def })
      mudou = true
    }
  })
  if (mudou) salvarUsuarios(list)
  return list
}

export function adicionarClienteContratoServico(
  payload: AdicionarClientePayload,
): OperationResult {
  const dados = payload || ({} as AdicionarClientePayload)
  const nome = String(dados.nome || '').trim()
  const uf = String(dados.uf || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2)

  if (!nome || uf.length !== 2) {
    return { ok: false, msg: 'Informe o município e a UF com 2 letras.' }
  }

  const cIn = dados.contrato || {}
  const numero = String(cIn.numero || '').trim()
  const objeto = String(cIn.objeto || '').trim()
  const vigenciaInicio = String(cIn.vigenciaInicio || '').trim()

  if (!numero) {
    return { ok: false, msg: 'Informe o número do instrumento contratual.' }
  }
  if (!objeto) {
    return {
      ok: false,
      msg: 'Descreva o objeto do contrato (escopo dos serviços contratados).',
    }
  }
  if (!vigenciaInicio) {
    return { ok: false, msg: 'Informe o início da vigência do contrato.' }
  }

  const contrato = mesclarContratoSalvo(cIn)
  contrato.numero = numero
  contrato.objeto = objeto
  contrato.vigenciaInicio = vigenciaInicio

  let list = lerJson<Prefeitura[]>(PREFEITURAS_KEY)
  if (!list || !Array.isArray(list) || list.length === 0) {
    list = PREFEITURAS_SEED.map((x) => ({
      id: x.id,
      nome: x.nome,
      uf: x.uf,
      tipoCliente: x.tipoCliente ?? 'prefeitura',
      contrato: x.contrato ? mesclarContratoSalvo(x.contrato) : mesclarContratoSalvo(null),
    }))
  } else {
    list = list.map((p) => ({
      id: p.id,
      nome: p.nome,
      uf: p.uf,
      tipoCliente: p.tipoCliente ?? 'prefeitura',
      contrato: mesclarContratoSalvo(p.contrato),
    }))
  }

  const tipoCliente = dados.tipoCliente === 'locacao' ? 'locacao' : 'prefeitura'
  const id = novoIdPrefeitura(nome, uf, list)
  list.push({ id, nome, uf, tipoCliente, contrato })
  salvarPrefeiturasLista(list)

  return { ok: true, id }
}

export function removerPrefeituraContrato(id: string): OperationResult {
  const list = obterPrefeituras()
  if (list.length <= 1) {
    return { ok: false, msg: 'Mantenha ao menos uma prefeitura com contrato ativo.' }
  }
  const users = carregarUsuarios()
  if (users.some((u) => u.prefeituraId === id)) {
    return {
      ok: false,
      msg: 'Existem usuários do sistema vinculados a este município. Remova ou altere esses acessos antes de encerrar o contrato.',
    }
  }
  const next = list.filter((p) => p.id !== id)
  salvarPrefeiturasLista(next)
  return { ok: true }
}

function dadosPrefeituraKey(id: string): string {
  return `hu360_dados_${id}`
}

export function getDadosPrefeitura(prefeituraId: string): DadosPrefeitura {
  const id = prefeituraId || 'tl-ms'
  const key = dadosPrefeituraKey(id)
  const raw = localStorage.getItem(key)
  if (raw) {
    try {
      return JSON.parse(raw) as DadosPrefeitura
    } catch {
      // segue para gerar novos dados demo
    }
  }
  const inicial = criarDadosDemo(id)
  localStorage.setItem(key, JSON.stringify(inicial))
  return inicial
}

export function salvarDadosPrefeitura(
  prefeituraId: string,
  dados: DadosPrefeitura,
): void {
  localStorage.setItem(dadosPrefeituraKey(prefeituraId), JSON.stringify(dados))
}

/** Garante id estável em cada parceiro (dados antigos em localStorage). */
export function normalizarIdsParceiros(
  prefeituraId: string,
  dados: DadosPrefeitura,
): boolean {
  if (!dados || !dados.parceiros || !dados.parceiros.length) return false
  let mudou = false
  dados.parceiros.forEach((p, i) => {
    if (!p.id) {
      p.id = `p-leg-${prefeituraId}-${i}-${String(Date.now()).slice(-6)}`
      mudou = true
    }
  })
  return mudou
}
