import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useHU360, type AdicionarClientePayload, type TipoCliente } from '../../../lib/hu360'

const MODALIDADES: { value: string; label: string }[] = [
  { value: 'pregao_eletronico', label: 'Pregão eletrônico' },
  { value: 'pregao_presencial', label: 'Pregão presencial' },
  { value: 'dispensa', label: 'Dispensa de licitação' },
  { value: 'inexigibilidade', label: 'Inexigibilidade' },
  { value: 'credenciamento', label: 'Credenciamento / chamamento público' },
  {
    value: 'inexigibilidade_chamamento',
    label: 'Inexigibilidade com chamamento',
  },
  { value: 'outros', label: 'Outros' },
]

const PERIODICIDADES: { value: string; label: string }[] = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'anual', label: 'Anual' },
]

const STATUS_OPCOES: { value: string; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'suspenso', label: 'Suspenso' },
  { value: 'encerrado', label: 'Encerrado' },
]

function labelModalidade(v: string | undefined): string {
  if (!v) return '—'
  if (v === 'contrato_privado_locacao') return 'Contrato comercial (sem licitação)'
  return MODALIDADES.find((m) => m.value === v)?.label ?? v
}

function labelStatusContrato(v: string | undefined): string {
  if (!v) return '—'
  return STATUS_OPCOES.find((s) => s.value === v)?.label ?? v
}

function formatarDataIso(iso: string | undefined): string {
  if (!iso) return '—'
  const p = iso.split('-')
  if (p.length !== 3) return iso
  return `${p[2]}/${p[1]}/${p[0]}`
}

interface FormState {
  tipoCliente: TipoCliente
  nome: string
  uf: string
  numero: string
  processo: string
  modalidade: string
  status: string
  dataAssinatura: string
  vigenciaInicio: string
  vigenciaFim: string
  objeto: string
  valorMensal: string
  valorTotal: string
  periodicidade: string
  indiceReajuste: string
  slaHoras: string
  resp: string
  cargo: string
  email: string
  telefone: string
  observacoes: string
}

const FORM_INICIAL: FormState = {
  tipoCliente: 'prefeitura',
  nome: '',
  uf: '',
  numero: '',
  processo: '',
  modalidade: 'pregao_eletronico',
  status: 'ativo',
  dataAssinatura: '',
  vigenciaInicio: '',
  vigenciaFim: '',
  objeto: '',
  valorMensal: '',
  valorTotal: '',
  periodicidade: 'mensal',
  indiceReajuste: '',
  slaHoras: '',
  resp: '',
  cargo: '',
  email: '',
  telefone: '',
  observacoes: '',
}

export function CadastroClientesSection() {
  const { prefeituras, adicionarCliente, removerPrefeitura } = useHU360()
  const [form, setForm] = useState<FormState>(FORM_INICIAL)
  const [msg, setMsg] = useState('')
  const [msgTone, setMsgTone] = useState<'none' | 'ok' | 'err'>('none')

  const isLoc = form.tipoCliente === 'locacao'

  const introTexto = useMemo(() => {
    if (isLoc) {
      return (
        <>
          <strong>Empresa de locação:</strong> contrato comercial, <strong>sem</strong>{' '}
          bloco de licitação (pregão, edital, modalidade legal). Informe objeto,
          valores e contato corporativo.
          <br />
          O armazenamento continua apenas neste navegador (demonstração).
        </>
      )
    }
    return (
      <>
        <strong>Prefeitura:</strong> obrigatório o instrumento público — processo /
        edital quando couber e <strong>modalidade de contratação</strong>{' '}
        compatível com a Lei 14.133/2021 (ou lei local). Vigência, objeto e
        fiscal no órgão contratante.
        <br />
        O armazenamento continua apenas neste navegador (demonstração).
      </>
    )
  }, [isLoc])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function setMsgTexto(tone: 'none' | 'ok' | 'err', texto: string) {
    setMsgTone(tone)
    setMsg(texto)
  }

  useEffect(() => {
    if (form.tipoCliente === 'locacao') {
      setForm((p) => ({
        ...p,
        modalidade: 'contrato_privado_locacao',
        processo: '',
      }))
    } else if (form.modalidade === 'contrato_privado_locacao') {
      setForm((p) => ({ ...p, modalidade: 'pregao_eletronico' }))
    }
  }, [form.tipoCliente]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setMsgTexto('none', '')

    const payload: AdicionarClientePayload = {
      nome: form.nome,
      uf: form.uf,
      tipoCliente: form.tipoCliente,
      contrato: {
        numero: form.numero.trim(),
        processo: isLoc ? '' : form.processo.trim(),
        modalidade: isLoc ? 'contrato_privado_locacao' : form.modalidade,
        dataAssinatura: form.dataAssinatura,
        vigenciaInicio: form.vigenciaInicio,
        vigenciaFim: form.vigenciaFim,
        objeto: form.objeto.trim(),
        valorMensal: form.valorMensal.trim(),
        valorTotal: form.valorTotal.trim(),
        indiceReajuste: form.indiceReajuste.trim(),
        periodicidadeFaturamento: form.periodicidade,
        slaRespostaHoras: form.slaHoras.trim(),
        responsavelContratante: form.resp.trim(),
        cargoContratante: form.cargo.trim(),
        emailContratante: form.email.trim(),
        telefoneContratante: form.telefone.trim(),
        observacoes: form.observacoes.trim(),
        status: form.status,
      },
    }

    const r = adicionarCliente(payload)
    if (!r.ok) {
      setMsgTexto('err', r.msg ?? 'Não foi possível salvar o cliente.')
      return
    }

    setMsgTexto(
      'ok',
      `Cliente cadastrado: ${form.nome.trim()} (${form.uf.toUpperCase()}). ID interno: ${r.id ?? '—'}.`,
    )
    setForm({ ...FORM_INICIAL, tipoCliente: form.tipoCliente })
  }

  function handleRemover(id: string, nome: string) {
    if (!window.confirm(`Encerrar contrato e remover "${nome}" da lista?`)) {
      return
    }
    const r = removerPrefeitura(id)
    if (!r.ok) {
      setMsgTexto('err', r.msg ?? 'Não foi possível remover o contrato.')
      return
    }
    setMsgTexto('ok', `Contrato "${nome}" removido da lista.`)
  }

  const msgClass =
    msgTone === 'none' ? 'status' : `status status--${msgTone === 'ok' ? 'ok' : 'err'}`

  return (
    <section id="acessos" className="aba-conteudo ativa">
      <h2>Cadastro de clientes — contrato de prestação de serviços</h2>
      <p
        id="cadastroClienteIntro"
        className="topbar-user"
        style={{ marginBottom: 16, maxWidth: 920, lineHeight: 1.55 }}
      >
        <span id="cadastroClienteIntroTexto">{introTexto}</span>
      </p>

      <article className="card">
        <h3>Novo cliente e contrato de serviço</h3>
        <form id="formPrefeituraContrato" onSubmit={handleSubmit}>
          <div className="contrato-secao">
            <div className="contrato-secao-titulo">Tipo de cliente</div>
            <div>
              <label htmlFor="cadastroTipoCliente">
                Segmento <span style={{ color: '#f87171' }}>*</span>
              </label>
              <select
                id="cadastroTipoCliente"
                name="cadastroTipoCliente"
                required
                value={form.tipoCliente}
                onChange={(e) =>
                  update('tipoCliente', e.target.value as TipoCliente)
                }
              >
                <option value="prefeitura">Prefeitura (município)</option>
                <option value="locacao">Empresa de locação</option>
              </select>
            </div>
          </div>

          <div className="contrato-secao">
            <div id="cadastroContratanteTitulo" className="contrato-secao-titulo">
              {isLoc ? 'Contratante (empresa de locação)' : 'Contratante (poder público municipal)'}
            </div>
            <div className="row-2">
              <div>
                <label htmlFor="cadastroPrefNome">
                  <span id="cadastroLblNome">
                    {isLoc ? 'Razão social ou nome fantasia' : 'Município'}
                  </span>{' '}
                  <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  id="cadastroPrefNome"
                  name="cadastroPrefNome"
                  required
                  placeholder={
                    isLoc ? 'Ex.: Frota Norte Locações Ltda' : 'Ex.: Campo Grande'
                  }
                  autoComplete="organization"
                  value={form.nome}
                  onChange={(e) => update('nome', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="cadastroPrefUf">
                  UF{' '}
                  <span
                    id="cadastroLblUfHint"
                    style={{ fontWeight: 400, color: 'var(--muted)' }}
                  >
                    {isLoc ? '(UF da sede)' : '(do município)'}
                  </span>{' '}
                  <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  id="cadastroPrefUf"
                  name="cadastroPrefUf"
                  required
                  maxLength={2}
                  placeholder="MS"
                  autoComplete="off"
                  style={{ maxWidth: 120, textTransform: 'uppercase' }}
                  value={form.uf}
                  onChange={(e) => update('uf', e.target.value.toUpperCase())}
                />
              </div>
            </div>
          </div>

          <div className="contrato-secao" id="ctr-secao-instrumento">
            <div id="ctr-titulo-instrumento" className="contrato-secao-titulo">
              {isLoc ? 'Contrato comercial — sem licitação' : 'Instrumento e licitação'}
            </div>
            <div className="row-2">
              <div>
                <label htmlFor="ctrNumero">
                  <span id="ctrLblNumeroContrato">
                    {isLoc ? 'Nº contrato ou proposta comercial' : 'Nº do contrato / termo'}
                  </span>{' '}
                  <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  id="ctrNumero"
                  required
                  placeholder={isLoc ? 'Ex.: LOC-FROTA-2026-018' : 'Ex.: 012/2026'}
                  value={form.numero}
                  onChange={(e) => update('numero', e.target.value)}
                />
              </div>
              <div>
                {!isLoc ? (
                  <div id="ctr-wrap-processo">
                    <label htmlFor="ctrProcesso">Processo / edital / ata</label>
                    <input
                      id="ctrProcesso"
                      placeholder="Ex.: PE 003/2026"
                      value={form.processo}
                      onChange={(e) => update('processo', e.target.value)}
                    />
                  </div>
                ) : (
                  <div id="ctr-status-slot-loc" style={{ marginTop: 0 }}>
                    <label htmlFor="ctrStatus-loc">Status do contrato</label>
                    <select
                      id="ctrStatus-loc"
                      value={form.status}
                      onChange={(e) => update('status', e.target.value)}
                    >
                      {STATUS_OPCOES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
            {!isLoc ? (
              <div
                id="ctr-wrap-licitacao-linha"
                className="row-2"
                style={{ marginTop: 10 }}
              >
                <div>
                  <label htmlFor="ctrModalidade">
                    Modalidade de contratação (licitação / instrumento público)
                  </label>
                  <select
                    id="ctrModalidade"
                    value={form.modalidade}
                    onChange={(e) => update('modalidade', e.target.value)}
                  >
                    {MODALIDADES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div id="ctr-status-slot-pref">
                  <label htmlFor="ctrStatus">Status do contrato</label>
                  <select
                    id="ctrStatus"
                    value={form.status}
                    onChange={(e) => update('status', e.target.value)}
                  >
                    {STATUS_OPCOES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </div>

          <div className="contrato-secao">
            <div className="contrato-secao-titulo">Vigência</div>
            <div className="row-3">
              <div>
                <label htmlFor="ctrDataAssinatura">Data de assinatura</label>
                <input
                  id="ctrDataAssinatura"
                  type="date"
                  value={form.dataAssinatura}
                  onChange={(e) => update('dataAssinatura', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ctrVigenciaInicio">
                  Início da vigência <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  id="ctrVigenciaInicio"
                  type="date"
                  required
                  value={form.vigenciaInicio}
                  onChange={(e) => update('vigenciaInicio', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ctrVigenciaFim">Fim da vigência</label>
                <input
                  id="ctrVigenciaFim"
                  type="date"
                  value={form.vigenciaFim}
                  onChange={(e) => update('vigenciaFim', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="contrato-secao">
            <div id="ctr-titulo-objeto" className="contrato-secao-titulo">
              {isLoc ? 'Escopo para locação / frota e software' : 'Objeto e escopo do serviço'}
            </div>
            <div>
              <label htmlFor="ctrObjeto">
                <span id="ctrLblObjeto">
                  {isLoc
                    ? 'Descrição do que será contratado (frota sob gestão, módulos, SLA, exclusões)'
                    : 'Objeto do contrato (descrição detalhada do que será prestado)'}
                </span>{' '}
                <span style={{ color: '#f87171' }}>*</span>
              </label>
              <textarea
                id="ctrObjeto"
                required
                placeholder={
                  isLoc
                    ? 'Ex.: Gestão digital da frota locada para clientes PJ; checklists preventivos por máquina; painel gerencial para locadora; usuários máximos; integração opcional com oficinas.'
                    : 'Descreva o escopo: gestão de frota, manutenção preventiva, integração com oficinas, indicadores, SLA, exclusões, etc.'
                }
                value={form.objeto}
                onChange={(e) => update('objeto', e.target.value)}
              />
            </div>
          </div>

          <div className="contrato-secao">
            <div id="ctr-titulo-valores" className="contrato-secao-titulo">
              {isLoc ? 'Valores e forma de cobrança' : 'Valores e faturamento'}
            </div>
            <div className="row-3">
              <div>
                <label htmlFor="ctrValorMensal">Valor mensal estimado</label>
                <input
                  id="ctrValorMensal"
                  placeholder="Ex.: R$ 25.000,00"
                  value={form.valorMensal}
                  onChange={(e) => update('valorMensal', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ctrValorTotal">Valor total do contrato</label>
                <input
                  id="ctrValorTotal"
                  placeholder="Ex.: R$ 900.000,00"
                  value={form.valorTotal}
                  onChange={(e) => update('valorTotal', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ctrPeriodicidade">Periodicidade de faturamento</label>
                <select
                  id="ctrPeriodicidade"
                  value={form.periodicidade}
                  onChange={(e) => update('periodicidade', e.target.value)}
                >
                  {PERIODICIDADES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row-2" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="ctrIndiceReajuste">Índice / reajuste</label>
                <input
                  id="ctrIndiceReajuste"
                  placeholder="Ex.: IPCA, IPCA + 1%"
                  value={form.indiceReajuste}
                  onChange={(e) => update('indiceReajuste', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ctrSlaHoras">SLA de resposta (horas úteis)</label>
                <input
                  id="ctrSlaHoras"
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex.: 24"
                  value={form.slaHoras}
                  onChange={(e) => update('slaHoras', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="contrato-secao" id="ctr-secao-fiscal">
            <div id="ctr-titulo-fiscal" className="contrato-secao-titulo">
              {isLoc
                ? 'Interlocutor no cliente (empresa)'
                : 'Fiscalização e contato no órgão contratante'}
            </div>
            <div className="row-2">
              <div>
                <label htmlFor="ctrResp" id="ctrLblResp">
                  {isLoc ? 'Responsável pela conta (nome)' : 'Nome do responsável / fiscal'}
                </label>
                <input
                  id="ctrResp"
                  placeholder="Nome completo"
                  value={form.resp}
                  onChange={(e) => update('resp', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ctrCargo" id="ctrLblCargo">
                  {isLoc ? 'Função ou departamento' : 'Cargo ou setor'}
                </label>
                <input
                  id="ctrCargo"
                  placeholder={
                    isLoc
                      ? 'Ex.: Gestão de frotas / Operações'
                      : 'Ex.: Secretaria de Administração'
                  }
                  value={form.cargo}
                  onChange={(e) => update('cargo', e.target.value)}
                />
              </div>
            </div>
            <div className="row-2" style={{ marginTop: 10 }}>
              <div>
                <label htmlFor="ctrEmail" id="ctrLblEmail">
                  {isLoc ? 'E-mail corporativo' : 'E-mail institucional'}
                </label>
                <input
                  id="ctrEmail"
                  type="email"
                  placeholder={
                    isLoc
                      ? 'contratos@suafrotalocadora.com.br'
                      : 'frota@prefeitura.ms.gov.br'
                  }
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ctrTelefone">Telefone</label>
                <input
                  id="ctrTelefone"
                  placeholder="Com DDD"
                  value={form.telefone}
                  onChange={(e) => update('telefone', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="contrato-secao">
            <div className="contrato-secao-titulo">
              Observações e cláusulas gerais
            </div>
            <div>
              <label htmlFor="ctrObs">
                Penalidades, renovação, rescisão, LGPD, horário de atendimento,
                etc.
              </label>
              <textarea
                id="ctrObs"
                placeholder="Notas internas sobre multas, multas contratuais, renovação automática, SLA de implantação…"
                value={form.observacoes}
                onChange={(e) => update('observacoes', e.target.value)}
              />
            </div>
          </div>

          <button className="btn btn-primary" type="submit">
            Salvar cliente e contrato
          </button>
          <div id="msgPrefeituras" className={msgClass} role="status">
            {msg}
          </div>
        </form>
      </article>

      <article className="card" style={{ marginTop: 18 }}>
        <h3>Clientes e contratos cadastrados</h3>
        <p className="topbar-user" style={{ marginBottom: 12 }}>
          Resumo dos instrumentos; o identificador interno é usado pelo sistema
          para vincular dados operacionais.
        </p>
        <div className="hub-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>UF</th>
                <th>Nº contrato</th>
                <th>Instrumento / modalidade</th>
                <th>Vigência</th>
                <th>Valor mensal</th>
                <th>Status</th>
                <th>ID sistema</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody id="tabelaPrefeituras">
              {prefeituras.length === 0 ? (
                <tr>
                  <td colSpan={10} className="topbar-user">
                    Nenhum cliente cadastrado.
                  </td>
                </tr>
              ) : (
                prefeituras.map((p) => {
                  const c = p.contrato ?? null
                  const tipo = p.tipoCliente === 'locacao' ? 'Locação' : 'Prefeitura'
                  const modalidade =
                    p.tipoCliente === 'locacao'
                      ? labelModalidade(c?.modalidade || 'contrato_privado_locacao')
                      : labelModalidade(c?.modalidade)
                  const vigencia = `${formatarDataIso(c?.vigenciaInicio)} → ${
                    c?.vigenciaFim ? formatarDataIso(c.vigenciaFim) : '—'
                  }`
                  return (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.nome}</strong>
                      </td>
                      <td>{tipo}</td>
                      <td>{p.uf}</td>
                      <td>{c?.numero || '—'}</td>
                      <td>{modalidade}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {vigencia}
                      </td>
                      <td>{c?.valorMensal || '—'}</td>
                      <td>{labelStatusContrato(c?.status)}</td>
                      <td>
                        <code style={{ fontSize: '0.72rem' }}>{p.id}</code>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-text"
                          onClick={() => handleRemover(p.id, p.nome)}
                        >
                          Remover
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  )
}
