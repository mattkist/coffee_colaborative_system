// Protected route component
import { useEffect, useState, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getUserProfile } from '../services/userService'

export function ProtectedRoute({ children, requireActive = false }) {
  const { user, loading: authLoading } = useAuth()
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const isMountedRef = useRef(true)
  const loadingRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    
    const loadProfile = async () => {
      if (!user) {
        if (isMountedRef.current) {
          setProfileLoading(false)
        }
        return
      }

      // Prevent multiple simultaneous loads
      if (loadingRef.current) {
        return
      }

      try {
        loadingRef.current = true
        const userProfile = await getUserProfile(user.uid)
        
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setProfile(userProfile)
        }
      } catch (error) {
        console.error('Error loading profile:', error)
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setProfile(null)
        }
      } finally {
        loadingRef.current = false
        if (isMountedRef.current) {
          setProfileLoading(false)
        }
      }
    }

    if (user) {
      loadProfile()
    } else {
      setProfileLoading(false)
    }

    return () => {
      isMountedRef.current = false
      loadingRef.current = false
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

  // If requireActive and user is not active, redirect to inactive page
  if (requireActive && profile && !profile.isActive) {
    return <Navigate to="/inactive" replace />
  }

  // If user is active and trying to access inactive page, redirect to home
  if (!requireActive && profile && profile.isActive) {
    return <Navigate to="/home" replace />
  }

  return children
}

