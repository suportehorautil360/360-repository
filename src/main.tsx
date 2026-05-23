import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { AppRoutes } from './AppRoutes'
import { HU360AuthProvider, HU360Provider } from './lib/hu360'
import { PwaUpdatePrompt } from './components/Pwa/PwaUpdatePrompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HU360Provider>
      <HU360AuthProvider>
        <AppRoutes />
      </HU360AuthProvider>
    </HU360Provider>
    <PwaUpdatePrompt />
  </StrictMode>,
)
