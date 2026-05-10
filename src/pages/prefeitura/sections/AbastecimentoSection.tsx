import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  AbastecimentoRegistro,
  DadosPrefeitura,
} from '../../../lib/hu360'
import { useHU360 } from '../../../lib/hu360'

interface AbastecimentoSectionProps {
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

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function novoIdAbs(): string {
  return `abs-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

function MaxBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="pf-bars-wrap">
      <div className="pf-bars">
        {values.map((v, i) => (
          <div
            key={i}
            className="bar"
            style={{ height: `${Math.max(8, (v / max) * 140)}px` }}
          >
            <span className="bar-label">{v.toLocaleString('pt-BR')}</span>
            <span className="bar-foot">{labels[i] ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AbastecimentoSection({
  dados,
  prefeituraId,
}: AbastecimentoSectionProps) {
  const { obterDadosPrefeitura, salvarDadosPrefeitura } = useHU360()
  const ca = dados.prefeituraModulo?.controleAbastecimento
  const postos = ca?.postosCredenciados ?? []
  const abs: AbastecimentoRegistro[] = ca?.abastecimentos ?? []
  const equipsCadastrados =
    dados.prefeituraModulo?.equipamentosCadastro ?? []

  const totalLitros = abs.reduce((acc, r) => acc + (Number(r.litros) || 0), 0)
  const totalValor = abs.reduce((acc, r) => acc + parseValorBR(r.valorTotal), 0)
  const limiteSemana = ca?.limiteCreditoSemanalReais ?? 0
  const usadoSem = totalValor
  const saldoSem = Math.max(0, limiteSemana - usadoSem)

  // Form de novo abastecimento
  const [novoData, setNovoData] = useState('')
  const [novoHora, setNovoHora] = useState('')
  const [novoVeic, setNovoVeic] = useState('')
  const [novoMotor, setNovoMotor] = useState('')
  const [novoSec, setNovoSec] = useState('Secretaria de Infraestrutura')
  const [novoPosto, setNovoPosto] = useState(postos[0]?.id ?? '')
  const [novoComb, setNovoComb] = useState('Diesel S10')
  const [novoLitros, setNovoLitros] = useState('')
  const [novoValor, setNovoValor] = useState('')
  const [novoKm, setNovoKm] = useState('')
  const [novoCupom, setNovoCupom] = useState('')
  const [msgAbs, setMsgAbs] = useState<{ tone: 'none' | 'ok' | 'err'; text: string }>({
    tone: 'none',
    text: '',
  })

  // Liberação de crédito
  const [credVeic, setCredVeic] = useState('')
  const [credMotor, setCredMotor] = useState('')
  const [credResp, setCredResp] = useState('')
  const [credValor, setCredValor] = useState('')
  const [credObs, setCredObs] = useState('')
  const [msgCred, setMsgCred] = useState('')

  const veiculosSelect = useMemo<string[]>(() => {
    const fromCadastro = equipsCadastrados.map((e) =>
      [e.descricao, e.marca, e.modelo, e.chassis].filter(Boolean).join(' · '),
    )
    const fromFrota = (dados.prefeituraModulo?.frota ?? []).map((f) => f.ativo)
    return Array.from(new Set([...fromCadastro, ...fromFrota].filter(Boolean)))
  }, [equipsCadastrados, dados.prefeituraModulo?.frota])

  function persistAbastecimentos(novos: AbastecimentoRegistro[]) {
    const dadosAtual = obterDadosPrefeitura(prefeituraId)
    const pm = { ...(dadosAtual.prefeituraModulo ?? {}) }
    const caBase = pm.controleAbastecimento ?? ca
    if (!caBase) return
    pm.controleAbastecimento = { ...caBase, abastecimentos: novos }
    salvarDadosPrefeitura(prefeituraId, { ...dadosAtual, prefeituraModulo: pm })
  }

  function handleSalvarAbs() {
    setMsgAbs({ tone: 'none', text: '' })
    const litrosNum = Number(novoLitros)
    const valorNum = parseValorBR(novoValor)
    if (!novoData || !novoVeic || !novoMotor || !novoPosto) {
      setMsgAbs({
        tone: 'err',
        text: 'Preencha data, veículo, motorista e posto.',
      })
      return
    }
    if (!Number.isFinite(litrosNum) || litrosNum <= 0) {
      setMsgAbs({ tone: 'err', text: 'Litros inválidos.' })
      return
    }
    if (valorNum <= 0) {
      setMsgAbs({ tone: 'err', text: 'Valor inválido.' })
      return
    }
    if (valorNum > saldoSem) {
      setMsgAbs({
        tone: 'err',
        text: `Sem saldo semanal (disponível ${fmtBRL(saldoSem)}). Libere crédito adicional.`,
      })
      return
    }
    const postoSel = postos.find((p) => p.id === novoPosto)
    const novo: AbastecimentoRegistro = {
      id: novoIdAbs(),
      data: novoData,
      hora: novoHora,
      veiculo: novoVeic,
      placa: '',
      motorista: novoMotor,
      secretaria: novoSec,
      postoId: novoPosto,
      postoNome: postoSel?.nomeFantasia || postoSel?.razaoSocial || '',
      litros: litrosNum,
      valorTotal: novoValor,
      km: Number(novoKm) || 0,
      combustivel: novoComb,
      cupomFiscal: novoCupom,
    }
    persistAbastecimentos([novo, ...abs])
    setMsgAbs({ tone: 'ok', text: 'Abastecimento registrado.' })
    setNovoData('')
    setNovoHora('')
    setNovoVeic('')
    setNovoMotor('')
    setNovoLitros('')
    setNovoValor('')
    setNovoKm('')
    setNovoCupom('')
  }

  function handleLiberarCredito() {
    setMsgCred('')
    if (!credResp || !credValor) {
      setMsgCred('Informe responsável e valor.')
      return
    }
    setMsgCred(
      `Crédito de ${fmtBRL(parseValorBR(credValor))} liberado por ${credResp}.`,
    )
    setCredVeic('')
    setCredMotor('')
    setCredResp('')
    setCredValor('')
    setCredObs('')
  }

  return (
    <>
      <h1>Controle de abastecimento</h1>
      <p className="pf-abs-intro">
        Painel no estilo de <strong>gestão de frota e convênio com postos</strong>.
        O <strong>credenciamento de postos</strong> é feito no Hub Mestre em{' '}
        <strong>Gestão → Oficinas e postos</strong>. Os abastecimentos consomem{' '}
        <strong>crédito semanal</strong> do convênio.
        <span style={{ display: 'block', marginTop: 10 }}>
          <Link
            to="/admin/oficinas-postos"
            className="btn btn-outline"
            style={{
              width: 'auto',
              margin: 0,
              padding: '8px 14px',
              fontSize: '0.8rem',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Ir ao Hub — cadastrar ou editar postos e oficinas
          </Link>
        </span>
      </p>

      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <article className="card">
          <h3>Saldo crédito (semana)</h3>
          <p style={{ color: '#4ade80' }}>{fmtBRL(saldoSem)}</p>
        </article>
        <article className="card">
          <h3>Litros registrados</h3>
          <p>{totalLitros.toLocaleString('pt-BR')} L</p>
        </article>
        <article className="card">
          <h3>Gasto total (NF/cupom)</h3>
          <p>{fmtBRL(totalValor)}</p>
        </article>
        <article className="card">
          <h3>Abastecimentos no período</h3>
          <p>{abs.length}</p>
        </article>
        <article className="card">
          <h3>Postos credenciados ativos</h3>
          <p>
            {postos.filter((p) => (p.status || '').toLowerCase() === 'ativo').length}
          </p>
        </article>
      </div>

      <article className="card" style={{ marginBottom: 22 }}>
        <h3>Consumo por semana (litros)</h3>
        <p style={{ color: 'var(--text-gray)', fontSize: '0.82rem', margin: '0 0 8px' }}>
          Série agregada do mês — comparativo rápido (modelo tipo dashboard de
          gestão de combustível).
        </p>
        <MaxBars
          values={ca?.litrosPorSemana ?? []}
          labels={ca?.labelsSemana ?? []}
        />
      </article>

      <article className="card">
        <h3>Postos credenciados</h3>
        <p style={{ color: 'var(--text-gray)', fontSize: '0.85rem', marginBottom: 14 }}>
          Contratos vigentes para abastecimento da frota municipal neste município.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Razão social</th>
                <th>Nome fantasia</th>
                <th>CNPJ</th>
                <th>Bandeira</th>
                <th>Combustíveis</th>
                <th>Limite L/mês</th>
                <th>Validade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="pf-tbody-postos-abs">
              {postos.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ color: 'var(--text-gray)' }}>
                    Nenhum posto credenciado.
                  </td>
                </tr>
              ) : (
                postos.map((p) => (
                  <tr key={p.id}>
                    <td>{p.razaoSocial}</td>
                    <td>{p.nomeFantasia}</td>
                    <td>
                      <code>{p.cnpj}</code>
                    </td>
                    <td>{p.bandeira}</td>
                    <td>{p.combustiveis}</td>
                    <td>{p.limiteLitrosMes.toLocaleString('pt-BR')}</td>
                    <td>{p.validadeAte}</td>
                    <td>{p.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p style={{ color: 'var(--text-gray)', fontSize: '0.82rem', margin: '8px 0 0' }}>
          Para incluir ou alterar credenciamento de posto, use o Hub Mestre:{' '}
          <strong>Gestão → Oficinas e postos</strong>.
        </p>
      </article>

      <article className="card">
        <h3>Registros de abastecimento</h3>
        <p style={{ color: 'var(--text-gray)', fontSize: '0.85rem', marginBottom: 14 }}>
          Cada linha equivale a um cupom/NF — rastreabilidade por veículo,
          motorista e posto credenciado.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Veículo</th>
                <th>Motorista</th>
                <th>Posto</th>
                <th>Combustível</th>
                <th>Litros</th>
                <th>Valor</th>
                <th>Km</th>
                <th>Cupom/NF</th>
                <th>Secretaria</th>
              </tr>
            </thead>
            <tbody id="pf-tbody-abs-reg">
              {abs.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ color: 'var(--text-gray)' }}>
                    Nenhum abastecimento registrado.
                  </td>
                </tr>
              ) : (
                abs.map((r) => (
                  <tr key={r.id}>
                    <td>{r.data}</td>
                    <td>{r.veiculo}</td>
                    <td>{r.motorista}</td>
                    <td>{r.postoNome}</td>
                    <td>{r.combustivel}</td>
                    <td>{r.litros.toLocaleString('pt-BR')}</td>
                    <td>{r.valorTotal}</td>
                    <td>{r.km}</td>
                    <td>{r.cupomFiscal}</td>
                    <td>{r.secretaria}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div id="pf-abs-cred-strip" className="pf-abs-cred-strip">
          <strong>Crédito semanal (convênio)</strong>
          <br />
          Limite base: <strong>{fmtBRL(limiteSemana)}</strong> · Já utilizado na
          semana: <strong>{fmtBRL(usadoSem)}</strong> ·{' '}
          <span style={{ color: '#e2e8f0' }}>
            Saldo disponível para novos abastecimentos:
          </span>{' '}
          <strong>{fmtBRL(saldoSem)}</strong>
        </div>

        <div className="pf-abs-cred-lib">
          <h4>Liberação de crédito adicional</h4>
          <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-gray)' }}>
            Quando o saldo semanal não cobrir o próximo abastecimento, o
            responsável registra aqui um valor extra (auditável neste período).
          </p>
          <h5>Destino do crédito (frota)</h5>
          <div className="grid">
            <div>
              <label htmlFor="pf-abs-cred-sel-veiculo">Veículo / equipamento</label>
              <select
                id="pf-abs-cred-sel-veiculo"
                value={credVeic}
                onChange={(e) => setCredVeic(e.target.value)}
              >
                <option value="">— selecione —</option>
                {veiculosSelect.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pf-abs-cred-motorista">Motorista</label>
              <input
                type="text"
                id="pf-abs-cred-motorista"
                placeholder="Nome completo"
                autoComplete="name"
                value={credMotor}
                onChange={(e) => setCredMotor(e.target.value)}
              />
            </div>
          </div>
          <h5>Autorização</h5>
          <div className="grid">
            <div>
              <label htmlFor="pf-abs-cred-resp">Responsável pela liberação</label>
              <input
                type="text"
                id="pf-abs-cred-resp"
                placeholder="Nome completo"
                value={credResp}
                onChange={(e) => setCredResp(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="pf-abs-cred-valor">Valor a liberar (R$)</label>
              <input
                type="text"
                id="pf-abs-cred-valor"
                placeholder="5.000,00"
                value={credValor}
                onChange={(e) => setCredValor(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="pf-abs-cred-obs">Observação (opcional)</label>
              <input
                type="text"
                id="pf-abs-cred-obs"
                placeholder="Autorização, ofício, e-mail…"
                value={credObs}
                onChange={(e) => setCredObs(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleLiberarCredito}
          >
            Adicionar crédito à semana
          </button>
          {msgCred ? (
            <span
              style={{
                marginLeft: 12,
                fontSize: '0.88rem',
                color: '#86efac',
              }}
            >
              {msgCred}
            </span>
          ) : null}
        </div>

        <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem', color: 'var(--main-orange)' }}>
          Novo abastecimento{' '}
          <span style={{ fontWeight: 400, color: 'var(--text-gray)' }}>
            (consome crédito semanal)
          </span>
        </h4>
        <p style={{ color: 'var(--text-gray)', fontSize: '0.8rem', margin: '0 0 12px' }}>
          O valor do cupom será debitado do saldo.
        </p>
        <div className="grid">
          <div>
            <label>Data</label>
            <input
              type="date"
              id="pf-abs-data"
              value={novoData}
              onChange={(e) => setNovoData(e.target.value)}
            />
          </div>
          <div>
            <label>Hora</label>
            <input
              type="time"
              id="pf-abs-hora"
              value={novoHora}
              onChange={(e) => setNovoHora(e.target.value)}
            />
          </div>
          <div>
            <label>Veículo / equipamento</label>
            <select
              id="pf-abs-sel-veiculo"
              value={novoVeic}
              onChange={(e) => setNovoVeic(e.target.value)}
            >
              <option value="">— selecione —</option>
              {veiculosSelect.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Motorista</label>
            <input
              type="text"
              id="pf-abs-motorista"
              placeholder="Nome completo"
              value={novoMotor}
              onChange={(e) => setNovoMotor(e.target.value)}
            />
          </div>
          <div>
            <label>Secretaria / departamento</label>
            <select
              id="pf-abs-secretaria"
              value={novoSec}
              onChange={(e) => setNovoSec(e.target.value)}
            >
              <option value="Secretaria de Infraestrutura">
                Secretaria de Infraestrutura
              </option>
              <option value="Secretaria de Transportes">
                Secretaria de Transportes
              </option>
              <option value="Secretaria de Administração">
                Secretaria de Administração
              </option>
            </select>
          </div>
          <div>
            <label>Posto credenciado</label>
            <select
              id="pf-abs-sel-posto"
              value={novoPosto}
              onChange={(e) => setNovoPosto(e.target.value)}
            >
              {postos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nomeFantasia || p.razaoSocial}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Combustível</label>
            <select
              id="pf-abs-combustivel"
              value={novoComb}
              onChange={(e) => setNovoComb(e.target.value)}
            >
              <option value="Diesel S10">Diesel S10</option>
              <option value="Gasolina comum">Gasolina comum</option>
              <option value="Etanol">Etanol</option>
            </select>
          </div>
          <div>
            <label>Litros</label>
            <input
              type="number"
              id="pf-abs-litros"
              min={1}
              step={1}
              placeholder="120"
              value={novoLitros}
              onChange={(e) => setNovoLitros(e.target.value)}
            />
          </div>
          <div>
            <label>Valor total (R$)</label>
            <input
              type="text"
              id="pf-abs-valor"
              placeholder="850,00"
              value={novoValor}
              onChange={(e) => setNovoValor(e.target.value)}
            />
          </div>
          <div>
            <label>Km / horímetro</label>
            <input
              type="number"
              id="pf-abs-km"
              min={0}
              step={1}
              placeholder="45210"
              value={novoKm}
              onChange={(e) => setNovoKm(e.target.value)}
            />
          </div>
          <div>
            <label>Cupom / NF</label>
            <input
              type="text"
              id="pf-abs-cupom"
              placeholder="Número"
              value={novoCupom}
              onChange={(e) => setNovoCupom(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          className="btn btn-success"
          onClick={handleSalvarAbs}
        >
          Registrar abastecimento
        </button>
        <span
          id="pf-msg-abs"
          style={{
            marginLeft: 12,
            fontSize: '0.88rem',
            color:
              msgAbs.tone === 'ok'
                ? '#86efac'
                : msgAbs.tone === 'err'
                  ? '#fca5a5'
                  : 'var(--text-gray)',
          }}
        >
          {msgAbs.text}
        </span>
      </article>
    </>
  )
}
