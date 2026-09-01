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
      position="top-right"
      offset={{ top: 56, right: 16 }}
      visibleToasts={3}
    />
  </StrictMode>
)
