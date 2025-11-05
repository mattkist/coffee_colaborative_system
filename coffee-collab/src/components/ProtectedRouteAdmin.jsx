// Protected route component for admin only
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getUserProfile } from '../services/userService'

export function ProtectedRouteAdmin({ children }) {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setProfileLoading(false)
        return
      }

      try {
        const userProfile = await getUserProfile(user.uid)
        setProfile(userProfile)
      } catch (error) {
        console.error('Error loading profile:', error)
      } finally {
        setProfileLoading(false)
      }
    }

    if (user) {
      loadProfile()
    }
  }, [user])

  if (authLoading || profileLoading) {
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

  if (!user) {
    return <Navigate to="/" replace />
  }

  // Check if user is admin and active
  if (!profile || !profile.isAdmin || !profile.isActive) {
    return <Navigate to="/home" replace />
  }

  return children
}



