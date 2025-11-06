// Login component with Google authentication
import { useAuth } from '../hooks/useAuth'
import { getOrCreateUserProfile } from '../services/userService'

export function LoginButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth()

  const handleSignIn = async () => {
    try {
      const result = await signInWithGoogle()
      if (result.user) {
        // Create or get user profile on first login
        await getOrCreateUserProfile(result.user)
      }
    } catch (error) {
      console.error('Failed to sign in:', error)
      alert('Erro ao fazer login. Tente novamente.')
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Failed to sign out:', error)
    }
  }

  if (loading) {
    return <div>Carregando...</div>
  }

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {user.photoURL && (
          <img 
            src={user.photoURL} 
            alt={user.displayName || 'User'} 
            style={{ width: 32, height: 32, borderRadius: '50%' }}
          />
        )}
        <span>Olá, {user.displayName || user.email}!</span>
        <button onClick={handleSignOut}>
          Sair
        </button>
      </div>
    )
  }

  return (
    <button onClick={handleSignIn}>
      Entrar com Google
    </button>
  )
}






