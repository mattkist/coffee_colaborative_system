// Landing page for non-authenticated users
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getOrCreateUserProfile, getUserProfile } from '../services/userService'

const acronimoColors = ['#8B4513', '#A0522D', '#D2691E', '#DEB887', '#F5DEB3', '#DAA520', '#A0522D', '#8B4513']
const acronimoLetters = ['C', 'A', 'F', 'E', 'G', 'R', 'A', 'O']

// Function to highlight uppercase letters in text
function highlightUppercaseLetters(text) {
  const letters = text.split('')
  let acronimoIndex = 0
  
  return letters.map((char, index) => {
    // Check if this character is uppercase and matches our acrônimo
    if (acronimoIndex < acronimoLetters.length && char === acronimoLetters[acronimoIndex]) {
      const color = acronimoColors[acronimoIndex]
      acronimoIndex++
      return (
        <span
          key={index}
          style={{
            color,
            fontWeight: 'bold',
            fontSize: '1.2em',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)'
          }}
        >
          {char}
        </span>
      )
    }
    return <span key={index}>{char}</span>
  })
}

export function Landing() {
  const { user, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const checkUserAndRedirect = async () => {
      if (user) {
        const profile = await getUserProfile(user.uid)
        if (profile) {
          if (profile.isActive) {
            navigate('/home')
          } else {
            navigate('/inactive')
          }
        }
      }
    }

    checkUserAndRedirect()
  }, [user, navigate])

  const handleSignIn = async () => {
    try {
      const result = await signInWithGoogle()
      if (result.user) {
        await getOrCreateUserProfile(result.user)
        const profile = await getUserProfile(result.user.uid)
        if (profile) {
          if (profile.isActive) {
            navigate('/home')
          } else {
            navigate('/inactive')
          }
        }
      }
    } catch (error) {
      console.error('Failed to sign in:', error)
      alert('Erro ao fazer login. Tente novamente.')
    }
  }

  const subtitle = 'Controle Automático de Fornecimento, Estoque e Gerenciamento de Registro de Abastecimento Operacional'

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '48px 24px',
        textAlign: 'center'
      }}
    >
      <img 
        src={`${import.meta.env.BASE_URL}meuCafeGrao_logo_transparent.png`}
        alt="CAFÉ GRÃO" 
        style={{ 
          height: '120px', 
          width: 'auto',
          maxWidth: '400px',
          objectFit: 'contain',
          marginBottom: '24px',
          filter: 'drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.3))'
        }} 
      />

      <div style={{ marginBottom: '48px', maxWidth: '600px' }}>
        <p
          style={{
            fontSize: '18px',
            color: '#FFF',
            lineHeight: '1.8',
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.2)',
            marginBottom: '16px'
          }}
        >
          {highlightUppercaseLetters(subtitle)}
        </p>
      </div>

      <button
        onClick={handleSignIn}
        style={{
          padding: '16px 32px',
          fontSize: '18px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #A0522D 0%, #D2691E 100%)',
          color: '#FFF',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          transition: 'all 300ms ease',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
      >
        Entrar com Google
      </button>
    </div>
  )
}

