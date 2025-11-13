// Hook to manage user profile state
import { useState, useEffect } from 'react'
import { useAuth } from './useAuth'
import { getUserProfile } from '../services/userService'

export function useUserProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) {
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        const userProfile = await getUserProfile(user.uid)
        setProfile(userProfile)
      } catch (error) {
        console.error('Error loading user profile:', error)
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user])

  const refreshProfile = async () => {
    if (!user) return
    
    try {
      const userProfile = await getUserProfile(user.uid)
      setProfile(userProfile)
    } catch (error) {
      console.error('Error refreshing user profile:', error)
    }
  }

  return { profile, loading, refreshProfile }
}







