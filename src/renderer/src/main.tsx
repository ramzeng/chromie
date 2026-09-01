import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { Toaster } from '@/components/ui/sonner'

import { App } from './app'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      closeButton
      position="top-center"
      offset={{ top: 64 }}
      visibleToasts={3}
    />
  </StrictMode>
)
