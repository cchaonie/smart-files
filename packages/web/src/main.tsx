import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import App from './App'
import { I18nProvider } from '@smart-files/shared/src/i18n'
import './index.css'

const ls = { getItem: (k) => localStorage.getItem(k), setItem: (k, v) => localStorage.setItem(k, v) };
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider storage={ls}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)