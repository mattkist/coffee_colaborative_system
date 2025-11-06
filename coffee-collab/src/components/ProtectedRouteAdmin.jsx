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
        console.log('ProtectedRouteAdmin - No user, setting loading to false')
        setProfile(null)
        setProfileLoading(false)
        return
      }

      // Always set loading to true when we have a user
      setProfileLoading(true)

      try {
        console.log('ProtectedRouteAdmin - Loading profile for user:', user.uid)
        const userProfile = await getUserProfile(user.uid)
        console.log('ProtectedRouteAdmin - Profile loaded:', userProfile)
        setProfile(userProfile)
      } catch (error) {
        console.error('ProtectedRouteAdmin - Error loading profile:', error)
        setProfile(null)
      } finally {
        setProfileLoading(false)
      }
    }

    loadProfile()
  }, [user])

  // Determine if we should show loading
  // Show loading if: auth is loading, OR profile is loading, OR we have a user but no profile yet
  const isLoading = authLoading || profileLoading || (user && !profile)

  // Show loading while auth or profile is loading
  if (isLoading) {
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

  // No user, redirect to landing
  if (!user) {
    console.log('ProtectedRouteAdmin: No user, redirecting to /')
    return <Navigate to="/" replace />
  }

  // No profile loaded after loading is complete, redirect to home
  // (profileLoading is already handled above, so if we reach here, loading is complete)
  if (!profile) {
    console.error('ProtectedRouteAdmin: No profile loaded for user', user.uid)
    return <Navigate to="/home" replace />
  }

  // Check if user is admin and active
  const isAdmin = profile.isAdmin === true
  const isActive = profile.isActive === true

  console.log('ProtectedRouteAdmin - Profile check:', {
    userId: user.uid,
    isAdmin: profile.isAdmin,
    isActive: profile.isActive,
    isAdminBool: isAdmin,
    isActiveBool: isActive,
    profile: profile
  })

  if (!isAdmin) {
    console.warn('ProtectedRouteAdmin: User is not admin. isAdmin =', profile.isAdmin)
    return <Navigate to="/home" replace />
  }

  if (!isActive) {
    console.warn('ProtectedRouteAdmin: User is not active. isActive =', profile.isActive)
    return <Navigate to="/inactive" replace />
  }

  // User is admin and active, allow access
  console.log('ProtectedRouteAdmin: Access granted!')
  return children
}




