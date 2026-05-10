import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  adicionarLote,
  arquivoToTextPromise,
  type EquipamentoEntrada,
  formatLabelEquipamentoCadastro,
  parsePlanilhaTexto,
  removerEquipamentoLista,
} from './equipamentos'
import type { EquipamentoCadastro } from './types'
import { useHU360 } from './useHU360'

export interface UseEquipamentosCadastro {
  /** Lista atual de equipamentos cadastrados para a prefeitura. */
  lista: EquipamentoCadastro[]
  /** Mesma lista, formatada como rótulos legíveis (para selects de frota). */
  labelsParaSelectFrota: string[]
  /** Adiciona 1 item manualmente. Retorna `1` se entrou, `0` se foi descartado (ex.: chassi duplicado). */
  adicionarManual: (entrada: EquipamentoEntrada) => number
  /** Importa um texto colado (.csv/tsv/Excel). Retorna a quantidade adicionada. */
  importarTexto: (
    raw: string,
    opts?: { descartarChassisDup?: boolean },
  ) => number
  /** Lê o File e importa. Retorna a quantidade adicionada. */
  importarArquivo: (
    file: File,
    opts?: { descartarChassisDup?: boolean },
  ) => Promise<number>
  /** Remove o equipamento pelo id. */
  remover: (equipId: string) => void
  /** Substitui a lista por uma versão limpa (pode ser usado para resetar). */
  substituir: (nova: EquipamentoCadastro[]) => void
}

export function useEquipamentosCadastro(
  prefeituraId: string | undefined,
): UseEquipamentosCadastro {
  const { obterDadosPrefeitura, salvarDadosPrefeitura } = useHU360()

  const [lista, setLista] = useState<EquipamentoCadastro[]>(() => {
    if (!prefeituraId) return []
    const dados = obterDadosPrefeitura(prefeituraId)
    return dados.prefeituraModulo?.equipamentosCadastro ?? []
  })

  // Resincroniza quando muda a prefeitura.
  useEffect(() => {
    if (!prefeituraId) {
      setLista([])
      return
    }
    const dados = obterDadosPrefeitura(prefeituraId)
    setLista(dados.prefeituraModulo?.equipamentosCadastro ?? [])
  }, [prefeituraId, obterDadosPrefeitura])

  const persistir = useCallback(
    (nova: EquipamentoCadastro[]) => {
      if (!prefeituraId) return
      const dados = obterDadosPrefeitura(prefeituraId)
      const pm = { ...(dados.prefeituraModulo ?? {}) }
      pm.equipamentosCadastro = nova
      const novoDados = { ...dados, prefeituraModulo: pm }
      salvarDadosPrefeitura(prefeituraId, novoDados)
      setLista(nova)
    },
    [prefeituraId, obterDadosPrefeitura, salvarDadosPrefeitura],
  )

  const adicionarManual = useCallback(
    (entrada: EquipamentoEntrada): number => {
      if (!prefeituraId) return 0
      const { lista: novaLista, adicionados } = adicionarLote(
        prefeituraId,
        lista,
        [entrada],
        { descartarChassisDup: true },
      )
      if (adicionados > 0) persistir(novaLista)
      return adicionados
    },
    [prefeituraId, lista, persistir],
  )

  const importarTexto = useCallback(
    (raw: string, opts?: { descartarChassisDup?: boolean }): number => {
      if (!prefeituraId) return 0
      const itens = parsePlanilhaTexto(raw)
      if (itens.length === 0) return 0
      const { lista: novaLista, adicionados } = adicionarLote(
        prefeituraId,
        lista,
        itens,
        { descartarChassisDup: opts?.descartarChassisDup !== false },
      )
      if (adicionados > 0) persistir(novaLista)
      return adicionados
    },
    [prefeituraId, lista, persistir],
  )

  const importarArquivo = useCallback(
    async (
      file: File,
      opts?: { descartarChassisDup?: boolean },
    ): Promise<number> => {
      const texto = await arquivoToTextPromise(file)
      return importarTexto(texto, opts)
    },
    [importarTexto],
  )

  const remover = useCallback(
    (equipId: string) => {
      const nova = removerEquipamentoLista(lista, equipId)
      if (nova.length !== lista.length) persistir(nova)
    },
    [lista, persistir],
  )

  const substituir = useCallback(
    (nova: EquipamentoCadastro[]) => persistir(nova),
    [persistir],
  )

  const labelsParaSelectFrota = useMemo<string[]>(
    () => lista.map(formatLabelEquipamentoCadastro),
    [lista],
  )

  return {
    lista,
    labelsParaSelectFrota,
    adicionarManual,
    importarTexto,
    importarArquivo,
    remover,
    substituir,
  }
}
