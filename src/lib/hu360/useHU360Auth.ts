import { useContext } from 'react'
import { HU360AuthContext, type HU360AuthValue } from './HU360AuthContext'

export function useHU360Auth(): HU360AuthValue {
  const ctx = useContext(HU360AuthContext)
  if (!ctx) {
    throw new Error(
      'useHU360Auth deve ser usado dentro de <HU360AuthProvider> (que vive dentro de <HU360Provider>).',
    )
  }
  return ctx
}
