import type {
  AuditoriaItem,
  ChecklistApp,
  ChecklistOficina,
  CotacaoPendente,
  ControleAbastecimento,
  DadosPrefeitura,
  DashboardGraficos,
  EquipamentoPorLinha,
  FrotaItem,
  HubDashboardData,
  OficinaModulo,
  OsPendente,
  Parceiro,
  RiscoItem,
  TopOperador,
} from './types'

interface PrefeituraSeedDados {
  cidade: string
  suf: 'TL' | 'PR' | 'BH'
  ativos: number
  checklists: number
  manut: number
  custo: string
  barras: number[]
  donut: number[]
  gastoPct: number
  orcVal: string
}

function resolverSeed(prefeituraId: string): PrefeituraSeedDados {
  const cidade =
    prefeituraId === 'tl-ms'
      ? 'Três Lagoas'
      : prefeituraId === 'curitiba-pr'
        ? 'Curitiba'
        : prefeituraId === 'bh-mg'
          ? 'Belo Horizonte'
          : 'Município'
  const suf: PrefeituraSeedDados['suf'] =
    prefeituraId === 'tl-ms' ? 'TL' : prefeituraId === 'curitiba-pr' ? 'PR' : 'BH'
  const ativos =
    prefeituraId === 'tl-ms' ? 45 : prefeituraId === 'curitiba-pr' ? 112 : 203
  const checklists =
    prefeituraId === 'tl-ms' ? 128 : prefeituraId === 'curitiba-pr' ? 89 : 256
  const manut =
    prefeituraId === 'tl-ms' ? 4 : prefeituraId === 'curitiba-pr' ? 7 : 12
  const custo =
    prefeituraId === 'tl-ms'
      ? 'R$ 46,2k'
      : prefeituraId === 'curitiba-pr'
        ? 'R$ 128k'
        : 'R$ 310k'
  const barras =
    prefeituraId === 'tl-ms'
      ? [85, 88, 84, 90, 93, 91]
      : prefeituraId === 'curitiba-pr'
        ? [72, 75, 78, 80, 82, 79]
        : [68, 70, 74, 76, 78, 81]
  const donut =
    prefeituraId === 'tl-ms'
      ? [62, 23, 15]
      : prefeituraId === 'curitiba-pr'
        ? [55, 30, 15]
        : [48, 35, 17]
  const gastoPct =
    prefeituraId === 'tl-ms' ? 46 : prefeituraId === 'curitiba-pr' ? 38 : 52
  const orcVal =
    prefeituraId === 'tl-ms'
      ? 'R$ 3.450,00'
      : prefeituraId === 'curitiba-pr'
        ? 'R$ 4.120,00'
        : 'R$ 2.890,00'

  return { cidade, suf, ativos, checklists, manut, custo, barras, donut, gastoPct, orcVal }
}

function montarHubDashboard(s: PrefeituraSeedDados): HubDashboardData {
  return {
    ativos: s.ativos,
    checklists: s.checklists,
    manutencao: s.manut,
    custoLabel: s.custo,
    chartBarras: s.barras,
    donut: s.donut,
  }
}

function checklistAppAlta(suf: string): ChecklistApp {
  return {
    protocolo: `APP-${suf}-88921`,
    sincronizadoEm: '03/05/2026 10:08',
    versaoApp: 'Hora Útil Campo 2.4',
    referenciaOs: 'Sem O.S. — inspeção de rotina',
    horimetroCampo: '8.540,1 h',
    secoes: [
      {
        titulo: '1. Condições no momento da inspeção',
        itens: [
          { item: 'Equipamento em local seguro para inspeção', resposta: 'Sim', conforme: true },
          { item: 'Motor ligado / painel sem luzes críticas', resposta: 'Normal', conforme: true },
          { item: 'Nível de combustível registrado', resposta: '78%', conforme: true },
        ],
      },
      {
        titulo: '2. Sintomas e severidade (campo)',
        itens: [
          { item: 'Tipo de ocorrência', resposta: 'Vazamento leve — comando hidráulico', conforme: true },
          { item: 'Gravidade percebida', resposta: 'Média — uso controlado', conforme: true },
          { item: 'Equipamento apto a deslocamento até oficina?', resposta: 'Sim, com restrição', conforme: true },
        ],
      },
      {
        titulo: '3. Registro fotográfico (app)',
        itens: [
          { item: 'Fotos georreferenciadas obrigatórias', resposta: '06 fotos OK', conforme: true },
          { item: 'Áudio / nota de voz anexada', resposta: 'Não necessário', conforme: true },
        ],
      },
    ],
    observacoesCampo:
      'Operador relatou perda leve de óleo após subida prolongada. Fotos da região do comando e do nível no reservatório anexadas.',
    fotosResumo:
      '06 capturas: lateral comando, mangueiras superiores, piso da cabine, painel, hodômetro, panorâmica do equipamento.',
    assinaturaDigital:
      'Enviado pelo app — 03/05/2026 10:05 · Ricardo Souza · GPS ativo (precisão ~4 m)',
  }
}

function checklistAppAlerta(suf: string): ChecklistApp {
  return {
    protocolo: `APP-${suf}-88907`,
    sincronizadoEm: '03/05/2026 09:35',
    versaoApp: 'Hora Útil Campo 2.4',
    referenciaOs: 'Pré-O.S. — chamado emergencial',
    horimetroCampo: '52.108,2 km',
    secoes: [
      {
        titulo: '1. Inspeção rápida',
        itens: [
          { item: 'Estacionamento e sinalização', resposta: 'Parcial', conforme: false },
          { item: 'Ruídos anormais em movimento', resposta: 'Sim — eixo traseiro', conforme: false },
        ],
      },
      {
        titulo: '2. Registro mínimo exigido',
        itens: [
          { item: 'Conjunto de fotos externas (4 ângulos)', resposta: 'Só 1 foto (painel)', conforme: false },
          { item: 'Descrição textual do defeito', resposta: 'Sim', conforme: true },
        ],
      },
    ],
    observacoesCampo:
      'Inspeção interrompida por chuva — operador deve complementar fotos externas.',
    fotosResumo: '01 foto (painel).',
    assinaturaDigital: 'Rascunho sincronizado — 03/05/2026 09:33 · João Santos',
  }
}

function montarAuditoria(suf: string): AuditoriaItem[] {
  return [
    {
      hora: '10:15',
      operador: 'Ricardo Souza',
      equipamento: `Retroescavadeira ${suf}-02`,
      chassis: `RTR-${suf}-1FF420702`,
      fotos: '06',
      indice: '98% (Alta)',
      alerta: false,
      checklistApp: checklistAppAlta(suf),
    },
    {
      hora: '09:42',
      operador: 'João Santos',
      equipamento: `Caminhão Caçamba ${suf}-09`,
      chassis: `CAC-${suf}-9BM958150`,
      fotos: '01',
      indice: '30% (Alerta)',
      alerta: true,
      checklistApp: checklistAppAlerta(suf),
    },
  ]
}

function montarRiscos(suf: string): RiscoItem[] {
  return [
    {
      nivel: 'Alto',
      equipamento: `Patrola ${suf}-05`,
      defeito: 'Vazamento de óleo',
      operador: 'Marcos Silva',
      acao: 'Encaminhar para oficina',
    },
    {
      nivel: 'Médio',
      equipamento: `Fiat Strada ${suf}-10`,
      defeito: 'Barulho na suspensão',
      operador: 'Ana Paula',
      acao: 'Agendar manutenção',
    },
    {
      nivel: 'Baixo',
      equipamento: 'Caminhão Pipa',
      defeito: 'Lâmpada de ré',
      operador: 'Carlos Lima',
      acao: 'Troca simples',
    },
  ]
}

function montarParceiros(prefeituraId: string, cidade: string, suf: string): Parceiro[] {
  return [
    {
      id: `seed-${prefeituraId}-oficina`,
      nome: `Mecânica Diesel ${cidade}`,
      tipo: 'Oficina',
      especialidade: 'Linha pesada / frota',
      status: 'Ativa',
    },
    {
      id: `seed-${prefeituraId}-posto`,
      nome: `Posto Convênio ${suf} — Frota`,
      tipo: 'Posto de combustível',
      especialidade: 'Diesel S10 · abastecimento credenciado',
      status: 'Ativa',
    },
  ]
}

function montarFrota(suf: string): FrotaItem[] {
  return [
    {
      ativo: 'Trator Massey Ferguson',
      linha: 'Linha Amarela',
      pat: `${suf}-001`,
      status: 'Operacional',
      hori: '4.120h',
    },
    {
      ativo: 'VW Constellation',
      linha: 'Linha Branca',
      pat: `${suf}-042`,
      status: 'Oficina',
      hori: '12.450km',
    },
    {
      ativo: 'Fiat Strada Frota',
      linha: 'Linha Leve',
      pat: `${suf}-010`,
      status: 'Operacional',
      hori: '8.200km',
    },
  ]
}

function checklistDevolucaoPipa(suf: string, cidade: string): ChecklistOficina {
  return {
    protocolo: `DEV-${suf}-2026-015`,
    osRef: '#2026-15',
    oficinaExecutora: `Mecânica Diesel ${cidade} — credenciada`,
    horimetroLeitura: '42.330 km',
    tipoServico: 'Revisão sistema de bombeamento e vedadores do tanque',
    secoes: [
      {
        titulo: '1. Identificação e conferência pós-serviço',
        itens: [
          { item: 'Veículo confere com O.S. e placas', resposta: 'Sim', conforme: true },
          { item: 'Odômetro registrado na devolução', resposta: 'Sim', conforme: true },
          { item: 'Serviços executados conforme orçamento aprovado', resposta: 'Sim', conforme: true },
        ],
      },
      {
        titulo: '2. Testes de funcionamento (oficina)',
        itens: [
          { item: 'Bomba e comandos sem vazamento após teste', resposta: 'Sim', conforme: true },
          { item: 'Freios e estacionamento', resposta: 'Testados OK', conforme: true },
          { item: 'Iluminação e setas', resposta: 'Conforme', conforme: true },
        ],
      },
      {
        titulo: '3. Documentação fotográfica da devolução',
        itens: [
          { item: 'Fotos da área trabalhada e componentes', resposta: '08 fotos', conforme: true },
          { item: 'Relato técnico assinado pelo responsável da oficina', resposta: 'Sim', conforme: true },
        ],
      },
    ],
    observacoesOperador:
      'Substituídos retentores do comando da bomba e reabastecimento de fluido. Teste em bancada hidráulica sem anormalidades.',
    fotosResumo:
      '08 anexos: comando bomba, mangueiras novas, vista lateral tanque, painel, rodagem traseira, freios, NF serviços colada no vidro, hodômetro.',
    assinaturaDigital: `Checklist de devolução — Mecânica Diesel ${cidade} — resp. técnico · 02/05/2026 16:40`,
  }
}

function checklistDevolucaoPatrola(suf: string): ChecklistOficina {
  return {
    protocolo: `DEV-${suf}-2026-016`,
    osRef: '#2026-16',
    oficinaExecutora: `Auto Elétrica ${suf} — credenciada`,
    horimetroLeitura: '6.890,2 h',
    tipoServico: 'Regulagem esteira e tensionamento — pinos de giro',
    secoes: [
      {
        titulo: '1. Identificação',
        itens: [
          { item: 'Equipamento confere com O.S.', resposta: 'Sim', conforme: true },
          { item: 'Horímetro na devolução', resposta: 'Sim', conforme: true },
        ],
      },
      {
        titulo: '2. Itens críticos pós-serviço',
        itens: [
          { item: 'Esteira e tensionamento conforme especificação', resposta: 'Sim', conforme: true },
          { item: 'Teste de giro e comando sem folga excessiva', resposta: 'Sim', conforme: true },
          {
            item: 'Todas as fotos obrigatórias da devolução',
            resposta: '04 de 06 ângulos',
            conforme: false,
          },
        ],
      },
    ],
    observacoesOperador:
      'Cliente deve enviar 2 fotos complementares do esteira traseira para fechar o protocolo.',
    fotosResumo: '04 fotos anexas — pendentes 2 ângulos laterais.',
    assinaturaDigital: `Auto Elétrica ${suf} — 01/05/2026 14:22`,
  }
}

function montarOsPendentes(suf: string, cidade: string): OsPendente[] {
  return [
    {
      os: '#2026-15',
      maquina: 'Caminhão Pipa',
      oficina: `Mecânica ${cidade} (após aprovação)`,
      valor: 'R$ 2.450,00',
      etapa: 'Aguardando checklist / NF',
      checklistOficina: checklistDevolucaoPipa(suf, cidade),
    },
    {
      os: '#2026-16',
      maquina: 'Patrola linha pesada',
      oficina: `Auto Elétrica ${suf} (após aprovação)`,
      valor: 'R$ 890,00',
      etapa: 'Conferir NF',
      checklistOficina: checklistDevolucaoPatrola(suf),
    },
  ]
}

const LINHA_AMARELA = 'Linha Amarela — máquinas pesadas'
const LINHA_BRANCA = 'Linha Branca — caminhões'
const LINHA_LEVE = 'Linha Leve — carros e utilitários'

function montarEquipamentosPorLinha(suf: string): EquipamentoPorLinha[] {
  return [
    { label: `Pá Carregadeira ${suf}-45`, linha: LINHA_AMARELA },
    { label: `Rolo Compactador ${suf}-08`, linha: LINHA_AMARELA },
    { label: `Patrola frota ${suf}-12`, linha: LINHA_AMARELA },
    { label: `Retroescavadeira ${suf}-02`, linha: LINHA_AMARELA },
    { label: `Trator — Massey Ferguson ${suf}-001`, linha: LINHA_AMARELA },
    { label: `Caminhão Pipa ${suf}-02`, linha: LINHA_BRANCA },
    { label: `Caminhão Caçamba ${suf}-09`, linha: LINHA_BRANCA },
    { label: `Caminhão Basculante ${suf}-22`, linha: LINHA_BRANCA },
    { label: `VW Constellation ${suf}-042`, linha: LINHA_BRANCA },
    { label: `Fiat Strada ${suf}-10`, linha: LINHA_LEVE },
    { label: `Pick-up / utilitário ${suf}-15`, linha: LINHA_LEVE },
    { label: `Veículo passeio — frota ${suf}-88`, linha: LINHA_LEVE },
  ]
}

function montarOficinasPorLinha(
  cidade: string,
  suf: string,
): Record<string, string[]> {
  return {
    [LINHA_AMARELA]: [
      `Mecânica Diesel ${cidade} — cred. máquinas pesadas (Linha Amarela)`,
      `Auto Elétrica ${suf} — cred. implementos e frota pesada`,
      `Diesel Center ${cidade} — cred. linha amarela`,
    ],
    [LINHA_BRANCA]: [
      `Diesel Center ${cidade} — cred. caminhões e ônibus`,
      `Mecânica Diesel ${cidade} — cred. frota caminhão`,
      `Auto Elétrica ${suf} — cred. transporte rodoviário`,
    ],
    [LINHA_LEVE]: [
      `Auto Centro ${cidade} — cred. carros e utilitários`,
      `Mecânica Diesel ${cidade} — cred. frota leve / passeio`,
      `Auto Elétrica ${suf} — cred. linha leve`,
    ],
  }
}

function montarDashboardGraficos(prefeituraId: string): DashboardGraficos {
  const semanas = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4']
  let gVal: number[]
  let cVal: number[]
  let tops: TopOperador[]

  if (prefeituraId === 'curitiba-pr') {
    gVal = [210000, 187000, 195400, 178200]
    cVal = [45, 41, 48, 44]
    tops = [
      { nome: 'Fernando Alves', bemFeitos: 44, indice: '97%' },
      { nome: 'Juliana Reis', bemFeitos: 40, indice: '99%' },
      { nome: 'Pedro Henrique', bemFeitos: 36, indice: '95%' },
      { nome: 'Camila Nogueira', bemFeitos: 33, indice: '96%' },
      { nome: 'Lucas Martins', bemFeitos: 30, indice: '94%' },
    ]
  } else if (prefeituraId === 'bh-mg') {
    gVal = [340000, 298000, 312000, 289000]
    cVal = [62, 58, 64, 61]
    tops = [
      { nome: 'Roberto Dias', bemFeitos: 52, indice: '98%' },
      { nome: 'Mariana Lopes', bemFeitos: 48, indice: '97%' },
      { nome: 'Thiago Freitas', bemFeitos: 45, indice: '96%' },
      { nome: 'Beatriz Rocha', bemFeitos: 41, indice: '95%' },
      { nome: 'Felipe Araujo', bemFeitos: 39, indice: '94%' },
    ]
  } else {
    gVal = [118500, 95200, 124300, 87650]
    cVal = [32, 38, 35, 41]
    tops = [
      { nome: 'Ricardo Souza', bemFeitos: 38, indice: '98%' },
      { nome: 'João Santos', bemFeitos: 34, indice: '96%' },
      { nome: 'Marcos Silva', bemFeitos: 31, indice: '97%' },
      { nome: 'Ana Paula Costa', bemFeitos: 28, indice: '95%' },
      { nome: 'Carlos Lima', bemFeitos: 26, indice: '94%' },
    ]
  }

  return {
    gastosLabels: semanas,
    gastosReais: gVal,
    checklistLabels: semanas,
    checklistRecebidos: cVal,
    topOperadores: tops,
    tituloPeriodo: 'Mês corrente — agregado por semana',
  }
}

function montarCotacoesPendentes(
  cidade: string,
  suf: string,
): CotacaoPendente[] {
  const nomesTresOficinas = [
    `Mecânica Diesel ${cidade} — Cred. 01`,
    `Auto Elétrica ${suf} — Cred. 02`,
    `Diesel Center ${cidade} — Cred. 03`,
  ]

  return [
    {
      os: '#2026-048',
      equip: `Patrola frota ${suf}-12`,
      classificacao: LINHA_AMARELA,
      v1: 'R$ 5.200,00',
      v2: 'R$ 4.890,00',
      v3: 'R$ 5.100,00',
      status: 'Aguardando aprovação da prefeitura',
      orcamentosDetalhados: [
        {
          titulo: nomesTresOficinas[0],
          total: 'R$ 5.200,00',
          prazoExecucao: '6 dias úteis',
          validadeProposta: 'Orçamento válido por 15 dias',
          itens: [
            { descricao: 'Diagnóstico, desmontagem e limpeza do comando', valor: 'R$ 680,00' },
            { descricao: 'Kit retentores, vedadores e juntas (originais)', valor: 'R$ 1.420,00' },
            { descricao: 'Retífica e montagem — mão de obra', valor: 'R$ 2.450,00' },
            { descricao: 'Óleo hidráulico e fluidos', valor: 'R$ 650,00' },
          ],
          observacoes:
            'Garantia de 90 dias em peças. Equipamento testado em bancada antes da devolução.',
        },
        {
          titulo: nomesTresOficinas[1],
          total: 'R$ 4.890,00',
          prazoExecucao: '5 dias úteis',
          validadeProposta: 'Orçamento válido por 10 dias',
          itens: [
            { descricao: 'Mão de obra completa (desmontagem / montagem)', valor: 'R$ 1.900,00' },
            { descricao: 'Peças kit vedação + retentores compatíveis', valor: 'R$ 1.210,00' },
            { descricao: 'Retífica de comando (terceirizada)', valor: 'R$ 1.780,00' },
          ],
          observacoes: 'Menor prazo de execução. Frete de peças incluso no valor.',
        },
        {
          titulo: nomesTresOficinas[2],
          total: 'R$ 5.100,00',
          prazoExecucao: '7 dias úteis',
          validadeProposta: 'Orçamento válido por 20 dias',
          itens: [
            { descricao: 'Pacote revisão hidráulica (mão de obra)', valor: 'R$ 2.100,00' },
            { descricao: 'Componentes e consumíveis', valor: 'R$ 2.000,00' },
            { descricao: 'Teste de pressão e alinhamento', valor: 'R$ 1.000,00' },
          ],
          observacoes: 'Inclui relatório fotográfico do antes/depois.',
        },
      ],
    },
  ]
}

function montarControleAbastecimento(
  prefeituraId: string,
  cidade: string,
  suf: string,
): ControleAbastecimento {
  const posto1 = `posto-${prefeituraId}-001`
  const posto2 = `posto-${prefeituraId}-002`
  const litrosSem =
    prefeituraId === 'curitiba-pr'
      ? [8200, 7800, 8100, 7950]
      : prefeituraId === 'bh-mg'
        ? [12400, 11800, 12100, 11950]
        : [4100, 3850, 4020, 3980]
  const limCredSem =
    prefeituraId === 'curitiba-pr'
      ? 45000
      : prefeituraId === 'bh-mg'
        ? 60000
        : 3500
  const valorLitroEdital =
    prefeituraId === 'curitiba-pr'
      ? 5.92
      : prefeituraId === 'bh-mg'
        ? 5.78
        : 5.85

  return {
    labelsSemana: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
    litrosPorSemana: litrosSem,
    valorUnitarioEdital: valorLitroEdital,
    limiteCreditoSemanalReais: limCredSem,
    creditoLiberacoes: [],
    postosCredenciados: [
      {
        id: posto1,
        razaoSocial: 'Auto Posto Rodovia Ltda.',
        nomeFantasia: `Auto Posto Rodovia — ${cidade}`,
        cnpj: '12.345.678/0001-99',
        bandeira: 'BR Distribuidora',
        endereco: 'Rod. Principal, km 42',
        combustiveis: 'Diesel S10 · Gasolina comum',
        limiteLitrosMes: 25000,
        contrato: `CT-${suf}-ABS-2025`,
        validadeAte: '31/12/2026',
        status: 'Ativo',
      },
      {
        id: posto2,
        razaoSocial: 'Combustíveis Convênio Frota ME',
        nomeFantasia: `Posto Convênio Frota — ${cidade}`,
        cnpj: '98.765.432/0001-11',
        bandeira: 'Ipiranga',
        endereco: 'Av. Central, 1500 — Centro',
        combustiveis: 'Diesel S10 · Etanol',
        limiteLitrosMes: 18000,
        contrato: `CT-${suf}-ABS-2025-B`,
        validadeAte: '30/06/2027',
        status: 'Ativo',
      },
    ],
    abastecimentos: [
      {
        id: `abs-${prefeituraId}-01`,
        data: '02/05/2026',
        hora: '07:42',
        veiculo: `Caminhão Pipa ${suf}-02`,
        placa: `${suf}-2841`,
        motorista: 'Carlos Lima',
        secretaria: 'Secretaria de Infraestrutura',
        postoId: posto1,
        postoNome: `Auto Posto Rodovia — ${cidade}`,
        litros: 185,
        valorTotal: 'R$ 1.092,30',
        km: 128440,
        combustivel: 'Diesel S10',
        cupomFiscal: '3526',
      },
      {
        id: `abs-${prefeituraId}-02`,
        data: '01/05/2026',
        hora: '14:18',
        veiculo: `VW Constellation ${suf}-042`,
        placa: `${suf}-9012`,
        motorista: 'João Santos',
        secretaria: 'Secretaria de Transportes',
        postoId: posto2,
        postoNome: `Posto Convênio Frota — ${cidade}`,
        litros: 142,
        valorTotal: 'R$ 838,80',
        km: 89420,
        combustivel: 'Diesel S10',
        cupomFiscal: '90211',
      },
      {
        id: `abs-${prefeituraId}-03`,
        data: '30/04/2026',
        hora: '11:05',
        veiculo: `Patrola frota ${suf}-12`,
        placa: `${suf}-3310`,
        motorista: 'Marcos Silva',
        secretaria: 'Secretaria de Infraestrutura',
        postoId: posto1,
        postoNome: `Auto Posto Rodovia — ${cidade}`,
        litros: 98,
        valorTotal: 'R$ 579,10',
        km: 68902,
        combustivel: 'Diesel S10',
        cupomFiscal: '3519',
      },
      {
        id: `abs-${prefeituraId}-04`,
        data: '15/05/2026',
        hora: '09:20',
        veiculo: `Motoniveladora 670G (${suf}-09)`,
        placa: `${suf}-4410`,
        motorista: 'Paulo Henrique',
        secretaria: 'Secretaria de Infraestrutura',
        postoId: posto1,
        postoNome: `Auto Posto Rodovia — ${cidade}`,
        litros: 1200,
        valorTotal: 'R$ 7.020,00',
        km: 45210,
        combustivel: 'Diesel S10',
        cupomFiscal: '4418',
      },
    ],
  }
}

function montarOficinaModulo(suf: string, orcVal: string): OficinaModulo {
  return {
    osReq: '#2026-045',
    equipLabel: `Patrola linha pesada 120 (${suf}-05)`,
    defeito: 'Vazamento no pistão hidráulico e perda de força.',
    orcamentoValor: orcVal,
    nfPlaceholder: '000.123.456',
    checklistTitulo: `Patrola ${suf}-05 (O.S. #2026-045)`,
    comparativo: [
      { concorrente: 'Orçamento 1', valor: 'R$ 3.800,00', status: 'Superior', destaque: false },
      { concorrente: 'Orçamento 2', valor: 'R$ 3.650,00', status: 'Superior', destaque: false },
      { concorrente: 'Orçamento 3', valor: orcVal, status: 'Menor Preço', destaque: true },
    ],
  }
}

export function criarDadosDemo(prefeituraId: string): DadosPrefeitura {
  const seed = resolverSeed(prefeituraId)

  return {
    hubDashboard: montarHubDashboard(seed),
    auditoria: montarAuditoria(seed.suf),
    riscos: montarRiscos(seed.suf),
    parceiros: montarParceiros(prefeituraId, seed.cidade, seed.suf),
    prefeituraModulo: {
      orcamentoContratual: 1000000,
      gastoPct: seed.gastoPct,
      gastoEfetivadoLabel:
        prefeituraId === 'tl-ms'
          ? 'R$ 460.000,00'
          : prefeituraId === 'curitiba-pr'
            ? 'R$ 380.000,00'
            : 'R$ 520.000,00',
      frota: montarFrota(seed.suf),
      osPendentes: montarOsPendentes(seed.suf, seed.cidade),
      operadoresSelect: ['João Silva', 'Ricardo Mendes'],
      oficinasCotacao: [
        `Mecânica Diesel ${seed.cidade} — Cred. 01`,
        `Auto Elétrica ${seed.suf} — Cred. 02`,
        `Diesel Center ${seed.cidade} — Cred. 03`,
      ],
      classificacaoLinhas: [LINHA_AMARELA, LINHA_BRANCA, LINHA_LEVE],
      equipamentosPorLinha: montarEquipamentosPorLinha(seed.suf),
      oficinasPorLinha: montarOficinasPorLinha(seed.cidade, seed.suf),
      dashboardGraficos: montarDashboardGraficos(prefeituraId),
      cotacoesPendentes: montarCotacoesPendentes(seed.cidade, seed.suf),
      controleAbastecimento: montarControleAbastecimento(
        prefeituraId,
        seed.cidade,
        seed.suf,
      ),
    },
    oficinaModulo: montarOficinaModulo(seed.suf, seed.orcVal),
  }
}
