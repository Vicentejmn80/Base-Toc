import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AppStoreProvider } from './state/store'
import { ToastProvider } from './state/toast'
import { InstallProvider } from './pwa/install'
import { GlobalCaptureProvider } from './state/globalCapture'
import { PushProvider } from './push/PushProvider'
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
              <PushProvider>
                <App />
              </PushProvider>
            </GlobalCaptureProvider>
          </InstallProvider>
        </ToastProvider>
      </AppStoreProvider>
    </BrowserRouter>
  </StrictMode>,
)
