import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AppStoreProvider } from './state/store'
import { ToastProvider } from './state/toast'
import { InstallProvider } from './pwa/install'
import { GlobalCaptureProvider } from './state/globalCapture'
import { registerServiceWorker } from './pwa/register'
import './index.css'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppStoreProvider>
        <ToastProvider>
          <InstallProvider>
            <GlobalCaptureProvider>
              <App />
            </GlobalCaptureProvider>
          </InstallProvider>
        </ToastProvider>
      </AppStoreProvider>
    </BrowserRouter>
  </StrictMode>,
)
