// Main App component with routing
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ProtectedRouteAdmin } from './components/ProtectedRouteAdmin'

// Pages
import { Landing } from './pages/Landing'
import { Inactive } from './pages/Inactive'
import { Home } from './pages/Home'
import { Settings } from './pages/Settings'
import { Votes } from './pages/Votes'
import { Contributions } from './pages/Contributions'
import { Compensations } from './pages/Compensations'
import { Products } from './pages/Products'
import { Users } from './pages/Users'

export function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 25%, #D2691E 50%, #DEB887 75%, #F5DEB3 100%)',
          color: '#FFF',
          fontSize: '18px'
        }}
      >
        Carregando...
      </div>
    )
  }

  return (
    <BrowserRouter basename={import.meta.env.MODE === 'production' ? '/cafe_grao' : undefined}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/inactive"
          element={
            <ProtectedRoute>
              <Inactive />
            </ProtectedRoute>
          }
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute requireActive>
              <Home />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contributions"
          element={
            <ProtectedRoute requireActive>
              <Contributions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/compensations"
          element={
            <ProtectedRoute requireActive>
              <Compensations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/votes"
          element={
            <ProtectedRoute requireActive>
              <Votes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute requireActive>
              <Products />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute requireActive>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRouteAdmin>
              <Users />
            </ProtectedRouteAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
