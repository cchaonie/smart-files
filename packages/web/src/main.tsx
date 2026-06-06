import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { UploadProvider } from './context/UploadContext'
import App from './App'
import { I18nProvider } from '@smart-files/shared/src/i18n'
import './index.css'

const ls = { getItem: (k: string) => localStorage.getItem(k), setItem: (k: string, v: string) => localStorage.setItem(k, v) };
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider storage={ls}>
        <AuthProvider>
          <UploadProvider>
            <App />
          </UploadProvider>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)