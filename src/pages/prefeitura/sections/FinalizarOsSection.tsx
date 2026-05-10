import { useMemo, useState } from 'react'
import type {
  AbastecimentoRegistro,
  ChecklistOficina,
  DadosPrefeitura,
} from '../../../lib/hu360'

interface FinalizarOsSectionProps {
  dados: DadosPrefeitura
  prefeituraId: string
}

function parseValorBR(v: string): number {
  if (!v) return 0
  const limpo = v
    .replace(/[^0-9,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? n : 0
}

function mesIsoDoRegistro(r: AbastecimentoRegistro): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(r.data)
  if (m) return `${m[1]}-${m[2]}`
  const m2 = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(r.data)
  if (m2) return `${m2[3]}-${m2[2]}`
  return ''
}

function labelMes(iso: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const meses = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ]
  return `${meses[Number(m[2]) - 1]}/${m[1]}`
}

export function FinalizarOsSection({ dados, prefeituraId }: FinalizarOsSectionProps) {
  const pm = dados.prefeituraModulo
  const osPendentes = pm?.osPendentes ?? []
  const ca = pm?.controleAbastecimento
  const postos = ca?.postosCredenciados ?? []
  const abs = useMemo<AbastecimentoRegistro[]>(
    () => ca?.abastecimentos ?? [],
    [ca],
  )

  const [checklistAberto, setChecklistAberto] = useState<{
    titulo: string
    sub: string
    checklist: ChecklistOficina
  } | null>(null)

  const [postoSel, setPostoSel] = useState<string>(postos[0]?.id ?? '')
  const meses = useMemo<string[]>(() => {
    const set = new Set<string>()
    abs.forEach((r) => {
      const m = mesIsoDoRegistro(r)
      if (m) set.add(m)
    })
    return Array.from(set).sort().reverse()
  }, [abs])

  const [mesSel, setMesSel] = useState<string>(meses[0] ?? '')
  const [chaveNFe, setChaveNFe] = useState('')
  const [arquivoNFe, setArquivoNFe] = useState('')
  const [dataPg, setDataPg] = useState('')
  const [conferi, setConferi] = useState(false)
  const [msgFin, setMsgFin] = useState<{ tone: 'none' | 'ok' | 'err'; text: string }>({
    tone: 'none',
    text: '',
  })

  const resumoSelecao = useMemo(() => {
    if (!postoSel || !mesSel) return null
    const itens = abs.filter(
      (r) => r.postoId === postoSel && mesIsoDoRegistro(r) === mesSel,
    )
    const totalLitros = itens.reduce((acc, r) => acc + (Number(r.litros) || 0), 0)
    const totalValor = itens.reduce((acc, r) => acc + parseValorBR(r.valorTotal), 0)
    return {
      qtd: itens.length,
      litros: totalLitros,
      valor: totalValor,
    }
  }, [postoSel, mesSel, abs])

  function handleCsv() {
    const linhas = [
      ['Data', 'Veículo', 'Motorista', 'Posto', 'Combustível', 'Litros', 'Valor', 'Km', 'Cupom/NF', 'Secretaria'],
      ...abs.map((r) => [
        r.data,
        r.veiculo,
        r.motorista,
        r.postoNome,
        r.combustivel,
        String(r.litros),
        r.valorTotal,
        String(r.km ?? ''),
        r.cupomFiscal,
        r.secretaria,
      ]),
    ]
    const csv = linhas
      .map((l) => l.map((c) => `"${(c ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abastecimentos_${prefeituraId}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleRegistrarNF() {
    setMsgFin({ tone: 'none', text: '' })
    if (!postoSel || !mesSel) {
      setMsgFin({ tone: 'err', text: 'Selecione posto e mês.' })
      return
    }
    if (chaveNFe.replace(/\D/g, '').length !== 44) {
      setMsgFin({ tone: 'err', text: 'Chave NF-e deve ter 44 dígitos.' })
      return
    }
    if (!conferi) {
      setMsgFin({ tone: 'err', text: 'Marque a confirmação da conferência.' })
      return
    }
    setMsgFin({
      tone: 'ok',
      text: `NF registrada para ${labelMes(mesSel)} (chave terminada em ${chaveNFe.slice(-6)}). Pagamento agendado.`,
    })
    setChaveNFe('')
    setArquivoNFe('')
    setDataPg('')
    setConferi(false)
  }

  return (
    <>
      <h1>Checklist de devolução, NF e pagamento</h1>

      <article className="card">
        <span className="tag-etapa">Etapas 5 e 6 — Financeiro</span>
        <h3 style={{ marginTop: 8 }}>Serviços aguardando NF e pagamento</h3>
        <div className="table-scroll" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>O.S.</th>
                <th>Máquina</th>
                <th>Oficina executora</th>
                <th>Valor aprovado</th>
                <th>Etapa</th>
                <th>Checklist da oficina</th>
              </tr>
            </thead>
            <tbody id="pf-tbody-os">
              {osPendentes.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ color: 'var(--text-gray)' }}>
                    Nenhuma O.S. aguardando NF.
                  </td>
                </tr>
              ) : (
                osPendentes.map((os) => (
                  <tr key={os.os}>
                    <td>
                      <strong>{os.os}</strong>
                    </td>
                    <td>{os.maquina}</td>
                    <td>{os.oficina}</td>
                    <td>{os.valor}</td>
                    <td>{os.etapa}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{
                          margin: 0,
                          padding: '5px 10px',
                          fontSize: '0.78rem',
                        }}
                        onClick={() =>
                          setChecklistAberto({
                            titulo: os.checklistOficina.tipoServico,
                            sub: `${os.os} · ${os.maquina} · ${os.oficina}`,
                            checklist: os.checklistOficina,
                          })
                        }
                      >
                        Ver checklist
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="card">
        <span className="tag-etapa">Combustível — Financeiro</span>
        <h3 style={{ marginTop: 8 }}>Planilha do controle de abastecimento (Excel)</h3>
        <p style={{ color: 'var(--text-gray)', fontSize: '0.88rem', marginBottom: 12 }}>
          Exporta os mesmos registros da aba <strong>Abastecimento</strong> em CSV
          para abrir no Excel.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: 'auto' }}
          onClick={handleCsv}
        >
          Baixar Excel (CSV) dos abastecimentos
        </button>
      </article>

      <article className="card">
        <h3>NF combustível — conferir e enviar para pagamento</h3>
        <p style={{ color: 'var(--text-gray)', fontSize: '0.88rem', marginBottom: 12 }}>
          Conferência municipal do consumo por posto e mês, cadastro da{' '}
          <strong>chave NF-e</strong> e registro do envio para pagamento.
        </p>
        <div className="grid">
          <div>
            <label htmlFor="pf-fin-abs-posto">Posto credenciado</label>
            <select
              id="pf-fin-abs-posto"
              value={postoSel}
              onChange={(e) => setPostoSel(e.target.value)}
            >
              {postos.length === 0 ? (
                <option value="">— sem postos credenciados —</option>
              ) : (
                postos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nomeFantasia || p.razaoSocial}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label htmlFor="pf-fin-abs-mes">Mês de referência</label>
            <select
              id="pf-fin-abs-mes"
              value={mesSel}
              onChange={(e) => setMesSel(e.target.value)}
            >
              {meses.length === 0 ? (
                <option value="">— sem registros —</option>
              ) : (
                meses.map((m) => (
                  <option key={m} value={m}>
                    {labelMes(m)}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        <p
          id="pf-fin-abs-resumo"
          style={{
            margin: '14px 0',
            fontSize: '0.88rem',
            color: '#cbd5e1',
            lineHeight: 1.5,
          }}
        >
          {resumoSelecao
            ? `Período selecionado: ${resumoSelecao.qtd} cupom(s), ${resumoSelecao.litros.toLocaleString('pt-BR')} L · R$ ${resumoSelecao.valor.toLocaleString(
                'pt-BR',
                { minimumFractionDigits: 2, maximumFractionDigits: 2 },
              )}.`
            : 'Selecione posto e mês para visualizar o resumo.'}
        </p>
        <div className="grid" style={{ marginTop: 8 }}>
          <div>
            <label htmlFor="pf-fin-abs-nfe">Chave NF-e (44 dígitos)</label>
            <input
              type="text"
              id="pf-fin-abs-nfe"
              maxLength={44}
              placeholder="Somente números"
              autoComplete="off"
              value={chaveNFe}
              onChange={(e) => setChaveNFe(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pf-fin-abs-arq">
              Nome do arquivo da NF (PDF/XML)
            </label>
            <input
              type="text"
              id="pf-fin-abs-arq"
              placeholder="ex.: NF_combustivel_052026.pdf"
              autoComplete="off"
              value={arquivoNFe}
              onChange={(e) => setArquivoNFe(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pf-fin-abs-data-pg">Data do pagamento</label>
            <input
              type="date"
              id="pf-fin-abs-data-pg"
              value={dataPg}
              onChange={(e) => setDataPg(e.target.value)}
            />
          </div>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 12,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          <input
            type="checkbox"
            id="pf-fin-abs-check"
            checked={conferi}
            onChange={(e) => setConferi(e.target.checked)}
            style={{ width: 'auto', margin: 0 }}
          />
          <span>
            Confirmo a conferência entre consumo do período, valores e NF-e.
          </span>
        </label>
        <button
          type="button"
          className="btn btn-success"
          style={{ width: '100%', marginTop: 14 }}
          onClick={handleRegistrarNF}
        >
          Registrar NF e enviar para pagamento
        </button>
        <p
          id="pf-fin-abs-msg"
          style={{
            marginTop: 12,
            fontSize: '0.88rem',
            minHeight: 22,
            color:
              msgFin.tone === 'ok'
                ? '#86efac'
                : msgFin.tone === 'err'
                  ? '#fca5a5'
                  : 'var(--text-gray)',
          }}
        >
          {msgFin.text}
        </p>
      </article>

      {checklistAberto ? (
        <div
          className="pf-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setChecklistAberto(null)}
        >
          <div className="pf-modal-box pf-modal-checklist-wide" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="pf-modal-fechar"
              onClick={() => setChecklistAberto(null)}
              aria-label="Fechar"
            >
              ×
            </button>
            <h2 className="pf-modal-titulo">{checklistAberto.titulo}</h2>
            <p className="pf-modal-sub">{checklistAberto.sub}</p>
            <div className="pf-checklist-meta">
              <div>
                <strong>Protocolo:</strong> {checklistAberto.checklist.protocolo}
              </div>
              <div>
                <strong>Oficina:</strong>{' '}
                {checklistAberto.checklist.oficinaExecutora}
              </div>
              <div>
                <strong>Horímetro:</strong>{' '}
                {checklistAberto.checklist.horimetroLeitura}
              </div>
              <div>
                <strong>O.S.:</strong> {checklistAberto.checklist.osRef}
              </div>
            </div>
            {checklistAberto.checklist.secoes.map((s, idx) => (
              <div key={idx} className="pf-checklist-secao">
                <h4>{s.titulo}</h4>
                <ul>
                  {s.itens.map((it, j) => (
                    <li key={j} className={!it.conforme ? 'nao-conforme' : ''}>
                      <strong>{it.item}</strong> — {it.resposta}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {checklistAberto.checklist.observacoesOperador ? (
              <p className="pf-modal-obs">
                <strong>Observações:</strong>{' '}
                {checklistAberto.checklist.observacoesOperador}
              </p>
            ) : null}
            {checklistAberto.checklist.fotosResumo ? (
              <p className="pf-modal-obs">
                <strong>Fotos:</strong> {checklistAberto.checklist.fotosResumo}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
