/**
 * Bridge: expõe `window.HU360EquipamentosCadastro` para compat com HTML/JS
 * legado que ainda referencia o global. Código React novo deve usar
 * `useEquipamentosCadastro(prefeituraId)`.
 *
 * As funções de UI (`renderTabelaUi` / `removerUi`) continuam disponíveis
 * para que páginas legadas que ainda usam `<tbody id="...">` funcionem
 * sem mudança.
 */
import {
  adicionarLote,
  arquivoToTextPromise,
  type EquipamentoEntrada,
  formatLabelEquipamentoCadastro,
  parsePlanilhaTexto,
  removerEquipamentoLista,
} from './equipamentos'
import {
  getDadosPrefeitura,
  prefeituraLabel,
  salvarDadosPrefeitura,
} from './storage'
import type { EquipamentoCadastro } from './types'

interface RenderTabelaUiOpts {
  prefeituraId: string
  tbodyId: string
  breadcrumbClienteElId?: string | null
  msgElId?: string | null
}

interface AdicionarManualPayload {
  marca?: string
  modelo?: string
  chassis?: string
  descricao?: string
  linha?: string
  obra?: string
}

declare global {
  interface Window {
    HU360EquipamentosCadastro?: {
      formatLabel: typeof formatLabelEquipamentoCadastro
      lista: (pid: string) => EquipamentoCadastro[]
      labelsParaSelectFrota: (pid: string) => string[]
      adicionarManual: (pid: string, o: AdicionarManualPayload) => number
      importarPlanilhaTexto: (
        pid: string,
        raw: string,
        opts?: { descartarChassisDup?: boolean },
      ) => number
      remover: (pid: string, equipId: string) => void
      arquivoToTextPromise: (file: File) => Promise<string>
      renderTabelaUi: (opts: RenderTabelaUiOpts) => void
      removerUi: (
        pid: string,
        equipId: string,
        tbodyId: string,
        breadcrumbId: string | null,
      ) => void
    }
    /** Hook opcional para legacy: chamado depois de mudanças na lista. */
    hu360EquipamentosAposListaChange?: (pid: string) => void
  }
}

function obterListaPersistida(pid: string): EquipamentoCadastro[] {
  const dados = getDadosPrefeitura(pid)
  return dados.prefeituraModulo?.equipamentosCadastro ?? []
}

function persistirLista(pid: string, nova: EquipamentoCadastro[]): void {
  const dados = getDadosPrefeitura(pid)
  const pm = { ...(dados.prefeituraModulo ?? {}) }
  pm.equipamentosCadastro = nova
  const novoDados = { ...dados, prefeituraModulo: pm }
  salvarDadosPrefeitura(pid, novoDados)
}

function escHtml(t: unknown): string {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderTabelaUi(opts: RenderTabelaUiOpts): void {
  if (!opts || !opts.prefeituraId || !opts.tbodyId) return
  if (typeof document === 'undefined') return
  const tbody = document.getElementById(opts.tbodyId) as HTMLElement | null
  if (!tbody) return
  if (opts.breadcrumbClienteElId) {
    const bc = document.getElementById(opts.breadcrumbClienteElId)
    if (bc) bc.textContent = prefeituraLabel(opts.prefeituraId)
  }
  tbody.innerHTML = ''
  const lista = obterListaPersistida(opts.prefeituraId)
  for (const row of lista) {
    const tr = document.createElement('tr')
    const safeId = String(row.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    const breadcrumbArg = opts.breadcrumbClienteElId
      ? `'${opts.breadcrumbClienteElId.replace(/'/g, "\\'")}'`
      : 'null'
    tr.innerHTML =
      `<td><strong>${escHtml(
        row.descricao || row.modelo || 'Equipamento',
      )}</strong></td>` +
      `<td>${escHtml(row.marca)}</td>` +
      `<td>${escHtml(row.modelo)}</td>` +
      `<td style="font-size:0.82rem;">${escHtml(row.chassis)}</td>` +
      `<td style="font-size:0.82rem;">${escHtml(row.linha || '—')}</td>` +
      `<td style="font-size:0.82rem;">${escHtml(row.obra || '—')}</td>` +
      `<td><button type="button" class="btn btn-outline" ` +
      `style="margin:0;padding:6px 10px;font-size:0.82rem;color:#fca5a5;border-color:rgba(248,113,113,0.35);" ` +
      `onclick="HU360EquipamentosCadastro.removerUi('${opts.prefeituraId}','${safeId}','${opts.tbodyId}',${breadcrumbArg})">Remover</button></td>`
    tbody.appendChild(tr)
  }
}

function removerUi(
  pid: string,
  equipId: string,
  tbodyId: string,
  breadcrumbId: string | null,
): void {
  const atual = obterListaPersistida(pid)
  const nova = removerEquipamentoLista(atual, equipId)
  persistirLista(pid, nova)
  renderTabelaUi({
    prefeituraId: pid,
    tbodyId,
    breadcrumbClienteElId: breadcrumbId,
  })
  if (typeof window.hu360EquipamentosAposListaChange === 'function') {
    window.hu360EquipamentosAposListaChange(pid)
  }
}

export function instalarBridgeEquipamentos(): void {
  if (typeof window === 'undefined') return

  window.HU360EquipamentosCadastro = {
    formatLabel: formatLabelEquipamentoCadastro,

    lista(pid) {
      return obterListaPersistida(pid).slice()
    },

    labelsParaSelectFrota(pid) {
      return obterListaPersistida(pid).map(formatLabelEquipamentoCadastro)
    },

    adicionarManual(pid, o) {
      const entrada: EquipamentoEntrada = {
        marca: o.marca,
        modelo: o.modelo,
        chassis: o.chassis,
        descricao: o.descricao,
        linha: o.linha,
        obra: o.obra,
      }
      const atual = obterListaPersistida(pid)
      const { lista: nova, adicionados } = adicionarLote(
        pid,
        atual,
        [entrada],
        { descartarChassisDup: true },
      )
      if (adicionados > 0) persistirLista(pid, nova)
      return adicionados
    },

    importarPlanilhaTexto(pid, raw, opts) {
      const itens = parsePlanilhaTexto(raw)
      const atual = obterListaPersistida(pid)
      const { lista: nova, adicionados } = adicionarLote(pid, atual, itens, {
        descartarChassisDup: opts?.descartarChassisDup !== false,
      })
      if (adicionados > 0) persistirLista(pid, nova)
      return adicionados
    },

    remover(pid, equipId) {
      const atual = obterListaPersistida(pid)
      const nova = removerEquipamentoLista(atual, equipId)
      if (nova.length !== atual.length) persistirLista(pid, nova)
    },

    arquivoToTextPromise,
    renderTabelaUi,
    removerUi,
  }
}
