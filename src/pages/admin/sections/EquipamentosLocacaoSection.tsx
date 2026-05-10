import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  type EquipamentoEntrada,
  criarDadosDemo,
  useEquipamentosCadastro,
  useHU360,
} from '../../../lib/hu360'
import { mergePrefeituraModuloLocacao } from '../../locacao/locacaoMerge'

const COR_INFO = '#93a4c6'
const COR_ERRO = '#ef4444'
const COR_OK = '#22c55e'

interface FormEquipamento {
  descricao: string
  marca: string
  modelo: string
  chassis: string
  linha: string
  obra: string
}

interface Mensagem {
  texto: string
  cor: string
}

const MSG_VAZIA: Mensagem = { texto: '', cor: COR_INFO }

function novoFormEquipamento(linhaPadrao: string): FormEquipamento {
  return {
    descricao: '',
    marca: '',
    modelo: '',
    chassis: '',
    linha: linhaPadrao,
    obra: '',
  }
}

export function EquipamentosLocacaoSection() {
  const { obterDadosPrefeitura, prefeituras, prefeituraLabel } = useHU360()
  const [prefId, setPrefId] = useState(() => prefeituras[0]?.id ?? '')

  useEffect(() => {
    if (!prefId && prefeituras[0]?.id) {
      setPrefId(prefeituras[0].id)
    }
  }, [prefId, prefeituras])

  const pmMerged = useMemo(() => {
    if (!prefId) return null
    return mergePrefeituraModuloLocacao(
      prefId,
      obterDadosPrefeitura,
      criarDadosDemo,
    )
  }, [prefId, obterDadosPrefeitura])

  const linhasDisponiveis = useMemo(() => {
    if (!pmMerged) return [] as string[]
    let linhas = pmMerged.classificacaoLinhas ?? []
    if (!linhas.length && pmMerged.equipamentosPorLinha?.length) {
      const s: Record<string, 1> = {}
      for (const e of pmMerged.equipamentosPorLinha) {
        if (e.linha) s[e.linha] = 1
      }
      linhas = Object.keys(s)
    }
    if (!linhas.length) {
      linhas = ['Linha Amarela', 'Linha Branca', 'Linha Leve']
    }
    return linhas
  }, [pmMerged])

  const equip = useEquipamentosCadastro(prefId || undefined)

  const [eqForm, setEqForm] = useState<FormEquipamento>(() =>
    novoFormEquipamento(''),
  )
  const [eqMsgManual, setEqMsgManual] = useState<Mensagem>(MSG_VAZIA)
  const [eqPaste, setEqPaste] = useState('')
  const [eqMsgImport, setEqMsgImport] = useState<Mensagem>(MSG_VAZIA)

  useEffect(() => {
    if (!eqForm.linha && linhasDisponiveis.length > 0) {
      setEqForm((prev) => ({ ...prev, linha: linhasDisponiveis[0] }))
    }
  }, [linhasDisponiveis, eqForm.linha])

  function atualizarEqForm(campo: keyof FormEquipamento, valor: string) {
    setEqForm((prev) => ({ ...prev, [campo]: valor }))
  }

  function salvarEquipamentoManual(e: FormEvent) {
    e.preventDefault()
    const descricao = eqForm.descricao.trim()
    const marca = eqForm.marca.trim()
    const modelo = eqForm.modelo.trim()
    const chassis = eqForm.chassis.trim()
    const linha = eqForm.linha
    const obra = eqForm.obra.trim()
    if (!chassis) {
      setEqMsgManual({
        texto: 'Informe ao menos o chassis.',
        cor: COR_ERRO,
      })
      return
    }
    const entrada: EquipamentoEntrada = {
      descricao,
      marca,
      modelo,
      chassis,
      linha,
      obra,
    }
    const adicionados = equip.adicionarManual(entrada)
    if (adicionados === 0) {
      setEqMsgManual({
        texto: 'Chassis já cadastrado.',
        cor: COR_ERRO,
      })
      return
    }
    setEqMsgManual({ texto: 'Equipamento adicionado.', cor: COR_OK })
    setEqForm(novoFormEquipamento(linhasDisponiveis[0] ?? ''))
  }

  function importarPlanilha() {
    if (!eqPaste.trim()) {
      setEqMsgImport({
        texto: 'Cole ao menos uma linha ou selecione um arquivo.',
        cor: COR_ERRO,
      })
      return
    }
    const adicionados = equip.importarTexto(eqPaste)
    if (adicionados === 0) {
      setEqMsgImport({
        texto:
          'Nada para importar (verifique o cabeçalho ou possíveis chassis duplicados).',
        cor: COR_ERRO,
      })
      return
    }
    setEqPaste('')
    setEqMsgImport({
      texto: `${adicionados} equipamento(s) importado(s).`,
      cor: COR_OK,
    })
  }

  async function lerArquivoEquipamentos(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    try {
      const adicionados = await equip.importarArquivo(arquivo)
      if (adicionados === 0) {
        setEqMsgImport({
          texto: 'Arquivo sem linhas válidas (ou chassis duplicados).',
          cor: COR_ERRO,
        })
      } else {
        setEqMsgImport({
          texto: `${adicionados} equipamento(s) importado(s) do arquivo.`,
          cor: COR_OK,
        })
      }
    } catch {
      setEqMsgImport({ texto: 'Falha ao ler o arquivo.', cor: COR_ERRO })
    } finally {
      e.target.value = ''
    }
  }

  const labelCliente = prefId ? prefeituraLabel(prefId) : '—'

  return (
    <section className="aba-conteudo ativa">
      <h2>Equipamentos (locação)</h2>
      <p
        className="topbar-user"
        style={{ marginBottom: 14, maxWidth: 920, lineHeight: 1.5 }}
      >
        Cadastro e importação da frota locada por cliente. Escolha o cliente
        abaixo; os dados são os mesmos vistos no Painel Locação desse
        contratante.
      </p>

      <article className="card" style={{ marginBottom: 16 }}>
        <h3>Cliente</h3>
        <label htmlFor="hub-eq-pref">Prefeitura / contratante</label>
        <select
          id="hub-eq-pref"
          value={prefId}
          onChange={(e) => setPrefId(e.target.value)}
          style={{ marginTop: 8, maxWidth: 420, width: '100%' }}
        >
          {prefeituras.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome} ({p.uf})
            </option>
          ))}
        </select>
        <p
          style={{
            fontSize: '0.82rem',
            color: 'var(--muted)',
            marginTop: 10,
            marginBottom: 0,
          }}
        >
          Em foco: <strong style={{ color: 'var(--primary)' }}>{labelCliente}</strong>
        </p>
      </article>

      <article className="card" style={{ marginBottom: 16 }}>
        <h3>Inclusão manual</h3>
        <form onSubmit={salvarEquipamentoManual}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 14,
              marginTop: 8,
            }}
          >
            <div>
              <label htmlFor="hub-eq-desc">Tipo / família</label>
              <input
                type="text"
                id="hub-eq-desc"
                placeholder="Ex: Escavadeira"
                autoComplete="off"
                value={eqForm.descricao}
                onChange={(e) =>
                  atualizarEqForm('descricao', e.target.value)
                }
              />
            </div>
            <div>
              <label htmlFor="hub-eq-marca">Marca</label>
              <input
                type="text"
                id="hub-eq-marca"
                placeholder="Ex: John Deere"
                autoComplete="off"
                value={eqForm.marca}
                onChange={(e) => atualizarEqForm('marca', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="hub-eq-modelo">Modelo</label>
              <input
                type="text"
                id="hub-eq-modelo"
                placeholder="Ex: 310L"
                autoComplete="off"
                value={eqForm.modelo}
                onChange={(e) => atualizarEqForm('modelo', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="hub-eq-chassis">Chassis</label>
              <input
                type="text"
                id="hub-eq-chassis"
                placeholder="Número / VIN ou QR"
                autoComplete="off"
                value={eqForm.chassis}
                onChange={(e) => atualizarEqForm('chassis', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="hub-eq-linha">Linha (classificação)</label>
              <select
                id="hub-eq-linha"
                value={eqForm.linha}
                onChange={(e) => atualizarEqForm('linha', e.target.value)}
              >
                {linhasDisponiveis.length === 0 ? (
                  <option value="">— sem classificações —</option>
                ) : null}
                {linhasDisponiveis.map((linha) => (
                  <option key={linha} value={linha}>
                    {linha}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="hub-eq-obra">Obra</label>
              <input
                type="text"
                id="hub-eq-obra"
                placeholder="Ex: Pavimentação trecho norte"
                autoComplete="off"
                value={eqForm.obra}
                onChange={(e) => atualizarEqForm('obra', e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: 14 }}>
            Adicionar equipamento
          </button>
        </form>
        <p
          style={{
            fontSize: '0.85rem',
            marginTop: 10,
            minHeight: 22,
            color: eqMsgManual.cor,
          }}
        >
          {eqMsgManual.texto}
        </p>
      </article>

      <article className="card" style={{ marginBottom: 16 }}>
        <h3>Importar planilha</h3>
        <p
          style={{
            fontSize: '0.82rem',
            color: 'var(--muted)',
            margin: '0 0 12px',
            lineHeight: 1.5,
          }}
        >
          Vírgula, ponto e vírgula ou tab. Cabeçalho opcional: marca, modelo,
          chassis, tipo, linha, obra (ou serviço / contrato).
        </p>
        <label htmlFor="hub-eq-file">Arquivo .csv ou .txt</label>
        <input
          type="file"
          id="hub-eq-file"
          accept=".csv,.txt,text/csv,text/plain"
          onChange={lerArquivoEquipamentos}
        />
        <label htmlFor="hub-eq-paste" style={{ marginTop: 14, display: 'block' }}>
          Ou cole aqui
        </label>
        <textarea
          id="hub-eq-paste"
          rows={7}
          placeholder="marca;modelo;chassis"
          value={eqPaste}
          onChange={(e) => setEqPaste(e.target.value)}
          style={{ width: '100%', marginTop: 6 }}
        />
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginTop: 10 }}
          onClick={importarPlanilha}
        >
          Importar
        </button>
        <p
          style={{
            fontSize: '0.85rem',
            marginTop: 10,
            minHeight: 22,
            color: eqMsgImport.cor,
          }}
        >
          {eqMsgImport.texto}
        </p>
      </article>

      <article className="card">
        <h3>Equipamentos cadastrados</h3>
        <div className="hub-table-scroll">
          <table style={{ marginTop: 12, width: '100%' }}>
          <thead>
            <tr>
              <th>Tipo / descrição</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Chassis</th>
              <th>Linha</th>
              <th>Obra</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {equip.lista.map((eq) => (
              <tr key={eq.id}>
                <td>
                  <strong>{eq.descricao || eq.modelo || 'Equipamento'}</strong>
                </td>
                <td>{eq.marca}</td>
                <td>{eq.modelo}</td>
                <td style={{ fontSize: '0.82rem' }}>{eq.chassis}</td>
                <td style={{ fontSize: '0.82rem' }}>{eq.linha || '—'}</td>
                <td style={{ fontSize: '0.82rem' }}>
                  {eq.obra?.trim() ? eq.obra : '—'}
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{
                      padding: '6px 12px',
                      margin: 0,
                      width: 'auto',
                      color: '#fca5a5',
                      borderColor: 'rgba(248, 113, 113, 0.35)',
                    }}
                    onClick={() => equip.remover(eq.id)}
                    aria-label="Remover equipamento"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
            {equip.lista.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: 'center',
                    color: 'var(--muted)',
                  }}
                >
                  Nenhum equipamento cadastrado para este cliente.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      </article>
    </section>
  )
}
