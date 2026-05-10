import { useContext } from 'react'
import { HU360Context, type HU360ContextValue } from './HU360Context'

export function useHU360(): HU360ContextValue {
  const ctx = useContext(HU360Context)
  if (!ctx) {
    throw new Error('useHU360 deve ser usado dentro de <HU360Provider>')
  }
  return ctx
}
