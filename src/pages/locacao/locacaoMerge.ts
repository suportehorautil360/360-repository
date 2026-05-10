import type { DadosPrefeitura, PrefeituraModulo } from '../../lib/hu360/types'

export function mergePrefeituraModuloLocacao(
  prefeituraId: string,
  obterDadosPrefeitura: (id: string) => DadosPrefeitura,
  criarDadosDemo: (id: string) => DadosPrefeitura,
): PrefeituraModulo {
  const dados = obterDadosPrefeitura(prefeituraId)
  const pmBase = criarDadosDemo(prefeituraId).prefeituraModulo
  const pm: PrefeituraModulo = {
    ...pmBase,
    ...(dados.prefeituraModulo ?? {}),
  }
  if (!pm.equipamentosPorLinha?.length) {
    pm.equipamentosPorLinha = pmBase.equipamentosPorLinha
  }
  if (!pm.oficinasPorLinha) {
    pm.oficinasPorLinha = pmBase.oficinasPorLinha
  }
  if (!pm.dashboardGraficos) {
    pm.dashboardGraficos = pmBase.dashboardGraficos
  }
  const caBase = pmBase.controleAbastecimento ?? {}
  const caSav = dados.prefeituraModulo?.controleAbastecimento ?? {}
  pm.controleAbastecimento = { ...caBase, ...caSav }
  return pm
}
