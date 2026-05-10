import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { instalarBridgeHU360Sync } from './api/apiBridge'
import { instalarBridgeHU360 } from './bridge'
import { instalarBridgeEquipamentos } from './equipamentosBridge'
import * as storage from './storage'
import type {
  AdicionarClientePayload,
  DadosPrefeitura,
  OperationResult,
  Prefeitura,
  Usuario,
} from './types'

export interface HU360ContextValue {
  prefeituras: Prefeitura[]
  usuarios: Usuario[]
  prefeituraLabel: (id: string) => string
  obterDadosPrefeitura: (id: string) => DadosPrefeitura
  salvarDadosPrefeitura: (id: string, dados: DadosPrefeitura) => void
  normalizarIdsParceiros: (id: string, dados: DadosPrefeitura) => boolean
  adicionarCliente: (payload: AdicionarClientePayload) => OperationResult
  removerPrefeitura: (id: string) => OperationResult
  salvarUsuarios: (users: Usuario[]) => void
  refresh: () => void
}

export const HU360Context = createContext<HU360ContextValue | null>(null)

interface HU360ProviderProps {
  children: ReactNode
}

export function HU360Provider({ children }: HU360ProviderProps) {
  const [prefeituras, setPrefeituras] = useState<Prefeitura[]>(() =>
    storage.obterPrefeituras(),
  )
  const [usuarios, setUsuarios] = useState<Usuario[]>(() =>
    storage.carregarUsuarios(),
  )

  useEffect(() => {
    instalarBridgeHU360()
    instalarBridgeHU360Sync()
    instalarBridgeEquipamentos()
  }, [])

  const refresh = useCallback(() => {
    setPrefeituras(storage.obterPrefeituras())
    setUsuarios(storage.carregarUsuarios())
  }, [])

  const adicionarCliente = useCallback(
    (payload: AdicionarClientePayload): OperationResult => {
      const r = storage.adicionarClienteContratoServico(payload)
      if (r.ok) setPrefeituras(storage.obterPrefeituras())
      return r
    },
    [],
  )

  const removerPrefeitura = useCallback((id: string): OperationResult => {
    const r = storage.removerPrefeituraContrato(id)
    if (r.ok) setPrefeituras(storage.obterPrefeituras())
    return r
  }, [])

  const salvarUsuariosCb = useCallback((users: Usuario[]) => {
    storage.salvarUsuarios(users)
    setUsuarios(users)
  }, [])

  const value = useMemo<HU360ContextValue>(
    () => ({
      prefeituras,
      usuarios,
      prefeituraLabel: (id: string) => {
        const p = prefeituras.find((x) => x.id === id)
        return p ? `${p.nome} (${p.uf})` : id
      },
      obterDadosPrefeitura: storage.getDadosPrefeitura,
      salvarDadosPrefeitura: storage.salvarDadosPrefeitura,
      normalizarIdsParceiros: storage.normalizarIdsParceiros,
      adicionarCliente,
      removerPrefeitura,
      salvarUsuarios: salvarUsuariosCb,
      refresh,
    }),
    [
      prefeituras,
      usuarios,
      adicionarCliente,
      removerPrefeitura,
      salvarUsuariosCb,
      refresh,
    ],
  )

  return (
    <HU360Context.Provider value={value}>{children}</HU360Context.Provider>
  )
}
