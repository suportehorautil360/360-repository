import { useMemo, useState } from 'react'
import type { DadosPrefeitura } from '../../../lib/hu360'

interface AbrirOsSectionProps {
  dados: DadosPrefeitura
}

export function AbrirOsSection({ dados }: AbrirOsSectionProps) {
  const pm = dados.prefeituraModulo
  const equips = pm?.equipamentosPorLinha ?? []
  const operadores = pm?.operadoresSelect ?? []
  const oficinasPorLinha = pm?.oficinasPorLinha ?? {}

  const [equipIdx, setEquipIdx] = useState<number>(0)
  const [operador, setOperador] = useState<string>(operadores[0] ?? '')
  const [relato, setRelato] = useState('')
  const [enviado, setEnviado] = useState(false)

  const equipSel = equips[equipIdx]
  const linha = equipSel?.linha ?? ''
  const oficinas = useMemo<string[]>(
    () => (linha ? oficinasPorLinha[linha] ?? [] : []),
    [linha, oficinasPorLinha],
  )

  function handleEnviar() {
    setEnviado(true)
    setTimeout(() => setEnviado(false), 6000)
  }

  return (
    <>
      <h1>Abrir O.S.</h1>
      <article className="card">
        <div className="grid">
          <div>
            <label>Equipamento</label>
            <select
              id="pf-sel-equip"
              value={equipIdx}
              onChange={(e) => setEquipIdx(Number(e.target.value))}
            >
              {equips.length === 0 ? (
                <option value={0}>— sem equipamentos —</option>
              ) : (
                equips.map((eq, i) => (
                  <option key={i} value={i}>
                    {eq.label}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label>
              Classificação / linha do equipamento{' '}
              <span
                style={{
                  fontWeight: 'normal',
                  color: 'var(--text-gray)',
                  fontSize: '0.78rem',
                }}
              >
                (automático)
              </span>
            </label>
            <input
              type="text"
              id="pf-classificacao-auto"
              readOnly
              placeholder="Selecione o equipamento acima"
              value={linha}
              style={{
                cursor: 'default',
                background: '#0b1220',
                border: '1px solid #374151',
                color: '#e2e8f0',
              }}
            />
          </div>
          <div>
            <label>Operador solicitante</label>
            <select
              id="pf-sel-operador"
              value={operador}
              onChange={(e) => setOperador(e.target.value)}
            >
              {operadores.length === 0 ? (
                <option value="">— sem operadores —</option>
              ) : (
                operadores.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))
              )}
            </select>
          </div>
          <div>
            <label>Horímetro atual (sensor)</label>
            <input type="text" value="4.552,5 h" readOnly />
          </div>
        </div>

        <div className="oficinas-tres">
          <h4 id="pf-oficinas-envio-titulo">
            Oficinas que receberão esta O.S. (conforme a linha do equipamento)
          </h4>
          <ul id="pf-lista-tres-oficinas">
            {oficinas.length === 0 ? (
              <li style={{ color: 'var(--text-gray)' }}>
                Nenhuma oficina credenciada para esta linha. Cadastre no Hub
                Mestre → Oficinas e postos.
              </li>
            ) : (
              oficinas.map((o) => <li key={o}>{o}</li>)
            )}
          </ul>
        </div>

        <label style={{ marginTop: 12 }}>Relato do problema</label>
        <textarea
          rows={4}
          placeholder="Descreva o sintoma ou defeito para auxiliar o diagnóstico nas três oficinas..."
          value={relato}
          onChange={(e) => setRelato(e.target.value)}
        />
        <button
          type="button"
          className="btn btn-success"
          style={{ width: '100%' }}
          onClick={handleEnviar}
        >
          Enviar
        </button>
        {enviado ? (
          <p style={{ color: '#86efac', marginTop: 10, fontSize: '0.88rem' }}>
            O.S. disparada para as 3 oficinas credenciadas. Acompanhe orçamentos
            na aba <strong>Orçamentos &amp; Aprovação</strong>.
          </p>
        ) : null}
      </article>
    </>
  )
}
