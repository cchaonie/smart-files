import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useI18n } from '@smart-files/shared/src/i18n'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { FilesPage } from './pages/FilesPage'
import { PhotosPage } from './pages/PhotosPage'
import { UploadsPage } from './pages/UploadsPage'
import { SettingsPage } from './pages/SettingsPage'
import { HomePage } from './pages/HomePage'
import { SharePage } from './pages/SharePage'
import { AlbumsPage } from './pages/AlbumsPage'
import { AlbumDetailPage } from './pages/AlbumDetailPage'
import { FamilyTimelinePage } from './pages/FamilyTimelinePage'
import { AdminPage } from './pages/AdminPage'
import { AppLayout } from './components/AppLayout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const { t } = useI18n()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">{t.loading}</p>
      </div>
    )
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const { t: tt } = useI18n()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-500">{tt.loading}</p>
      </div>
    )
  }

  return user ? <Navigate to="/files" replace /> : <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <HomePage />
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <RegisterPage />
          </PublicRoute>
        }
      />
      <Route path="/share/:token" element={<SharePage />} />

      <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
        <Route path="/files" element={<FilesPage />} />
        <Route path="/photos" element={<PhotosPage />} />
        <Route path="/albums" element={<AlbumsPage />} />
        <Route path="/albums/:id" element={<AlbumDetailPage />} />
        <Route path="/family-timeline" element={<FamilyTimelinePage />} />
        <Route path="/uploads" element={<UploadsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Route>
    </Routes>
  )
}

export default App
