import type { ContratoServico, Prefeitura } from './types'

export function contratoServicoPadrao(): ContratoServico {
  return {
    numero: '',
    processo: '',
    modalidade: 'pregao_eletronico',
    dataAssinatura: '',
    vigenciaInicio: '',
    vigenciaFim: '',
    objeto: '',
    valorMensal: '',
    valorTotal: '',
    indiceReajuste: 'IPCA',
    periodicidadeFaturamento: 'mensal',
    slaRespostaHoras: '',
    responsavelContratante: '',
    cargoContratante: '',
    emailContratante: '',
    telefoneContratante: '',
    observacoes: '',
    status: 'ativo',
  }
}

export function mesclarContratoSalvo(
  c: Partial<ContratoServico> | null | undefined,
): ContratoServico {
  const base = contratoServicoPadrao()
  if (!c || typeof c !== 'object') {
    return base
  }
  ;(Object.keys(base) as Array<keyof ContratoServico>).forEach((k) => {
    const v = c[k]
    if (v !== undefined && v !== null && String(v).length > 0) {
      base[k] = v as ContratoServico[typeof k]
    }
  })
  return base
}

export function enriquecerPrefeitura(p: Prefeitura): Prefeitura {
  return {
    id: p.id,
    nome: p.nome,
    uf: p.uf,
    tipoCliente: p.tipoCliente ?? 'prefeitura',
    contrato: mesclarContratoSalvo(p.contrato),
  }
}

export function slugifyPref(nome: string): string {
  const s = String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return s || 'mun'
}

export function novoIdPrefeitura(
  nome: string,
  uf: string,
  lista: Prefeitura[],
): string {
  const u = String(uf || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2)
  let base = slugifyPref(nome) + (u ? '-' + u.toLowerCase() : '')
  if (!base || base === '-') {
    base = 'mun-' + Date.now()
  }
  let id = base
  let n = 2
  while (lista.some((x) => x.id === id)) {
    id = base + '-' + n
    n += 1
  }
  return id
}

export function prefeituraLabelFromList(
  lista: Prefeitura[],
  id: string,
): string {
  const p = lista.find((x) => x.id === id)
  return p ? `${p.nome} (${p.uf})` : id
}
