import type { FatUltimoSnapshot, PostoUsuarioPortal } from './portal/postoPortalTypes'
import type { Hu360Api } from './portal/hu360Access'

export {}

declare global {
  interface Window {
    HU360?: Hu360Api
    HU360Sync?: {
      apiEnabled(): boolean
      login(
        usuario: string,
        senha: string,
      ): Promise<{ ok: boolean; user?: PostoUsuarioPortal; msg?: string }>
      session(): Promise<{
        ok: boolean
        logged?: boolean
        user?: PostoUsuarioPortal
      }>
      logout?: () => Promise<void>
    }
    postoGerarRelatorioFaturamento?: () => void
    postoExportarFaturamentoCsv?: () => void
    postoExportarFaturamentoPdf?: () => void
    postoAppRefresh?: () => void
    postoLogout?: () => void
    postoNavegar?: (idTab: string, el?: HTMLElement) => void
    __postoFatUltimoAgg?: FatUltimoSnapshot
  }
}
