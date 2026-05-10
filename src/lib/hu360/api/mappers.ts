import type {
  AbastecimentoRegistro,
  ChecklistApiRow,
  ChecklistApiRowRaw,
  LinhaFrota,
  VeiculoApiRow,
  VeiculoApiRowRaw,
} from '../types'

export function mapTipoFrotaToLinha(tipo: string | null | undefined): LinhaFrota {
  const t = String(tipo || '')
  if (t === 'Linha Amarela' || t === 'Empilhadeira') {
    return 'Linha Amarela'
  }
  if (t === 'Onibus') {
    return 'Linha Branca'
  }
  return 'Linha Leve'
}

export function veiculoApiLabel(v: VeiculoApiRowRaw): string {
  const m = String(v.marca || '').trim()
  const mo = String(v.modelo || '').trim()
  const ch = String(v.chassis || '').trim()
  let title = [m, mo].filter(Boolean).join(' ')
  if (!title) {
    title = ch || 'Veículo'
  }
  return title + (ch ? ' — ' + ch : '')
}

export function mapVeiculoApiRow(r: VeiculoApiRowRaw): VeiculoApiRow {
  return {
    id: Number(r.id),
    chassis: String(r.chassis || ''),
    marca: String(r.marca || ''),
    modelo: String(r.modelo || ''),
    tipo_frota: String(r.tipo_frota || 'Outros'),
    label: veiculoApiLabel(r),
    linha: mapTipoFrotaToLinha(r.tipo_frota),
  }
}

export function mapChecklistApiRow(r: ChecklistApiRowRaw): ChecklistApiRow {
  return {
    id: Number(r.id),
    veiculo_id:
      r.veiculo_id != null && r.veiculo_id !== ''
        ? Number(r.veiculo_id)
        : null,
    chassis_qr: String(r.chassis_qr || ''),
    status_oleo: String(r.status_oleo || ''),
    status_filtros: String(r.status_filtros || ''),
    observacoes: r.observacoes != null ? String(r.observacoes) : '',
    criado_em: String(r.criado_em || ''),
  }
}

/**
 * Reaproveita {@link AbastecimentoRegistro}; o servidor devolve no mesmo formato
 * que o local. Se necessário, normalize aqui.
 */
export function mapAbastecimentoApiRow(
  r: AbastecimentoRegistro,
): AbastecimentoRegistro {
  return r
}
