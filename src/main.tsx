import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import './index.css'
import { AppRoutes } from './AppRoutes'
import { HU360AuthProvider, HU360Provider } from './lib/hu360'
import { PwaUpdatePrompt } from './components/Pwa/PwaUpdatePrompt'
import { OfflineIndicator } from './components/Pwa/OfflineIndicator'
import { setupPwaInstallPromptListener } from './pages/checklist-controle/usePwaInstallPrompt'

setupPwaInstallPromptListener()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HU360Provider>
      <HU360AuthProvider>
        <AppRoutes />
      </HU360AuthProvider>
    </HU360Provider>
    <PwaUpdatePrompt />
    <OfflineIndicator />
    <Toaster position="top-center" richColors closeButton />
  </StrictMode>,
)
