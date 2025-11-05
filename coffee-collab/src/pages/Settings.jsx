// Settings page
import { useState, useEffect } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { updateUserProfile, migrateAllUserBalances } from '../services/userService'

export function Settings() {
  const { user } = useAuth()
  const { profile, refreshProfile } = useUserProfile()
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)

  useEffect(() => {
    setLoading(false)
  }, [])

  const handleMigrateBalances = async () => {
    if (!confirm('Esta ação irá recalcular os saldos de todos os usuários baseado nas contribuições e compensações existentes. Deseja continuar?')) {
      return
    }

    setMigrating(true)
    try {
      const result = await migrateAllUserBalances()
      alert(`Migração concluída! ${result.message}`)
      window.location.reload() // Reload to show updated balances
    } catch (error) {
      console.error('Error migrating balances:', error)
      alert('Erro ao migrar saldos: ' + error.message)
    } finally {
      setMigrating(false)
    }
  }

  if (loading || !profile) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '48px', color: '#FFF' }}>
          <p>Carregando...</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '32px', color: '#FFF', marginBottom: '24px', textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)' }}>
          Settings
        </h1>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            marginBottom: '24px'
          }}
        >
          <h2 style={{ fontSize: '24px', color: '#8B4513', marginBottom: '24px' }}>
            Seus Dados
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                Nome
              </label>
              <input
                type="text"
                value={profile.name || ''}
                disabled
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #DDD',
                  borderRadius: '8px',
                  fontSize: '16px',
                  background: '#F5F5F5'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                Email
              </label>
              <input
                type="email"
                value={profile.email || ''}
                disabled
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #DDD',
                  borderRadius: '8px',
                  fontSize: '16px',
                  background: '#F5F5F5'
                }}
              />
            </div>
            {profile.photoURL && (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                  Foto
                </label>
                <img
                  src={profile.photoURL}
                  alt={profile.name}
                  style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    border: '3px solid #D2691E',
                    objectFit: 'cover'
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {profile.isAdmin && (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <h2 style={{ fontSize: '24px', color: '#8B4513', marginBottom: '24px' }}>
              Configurações do Sistema
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'rgba(139, 69, 19, 0.1)', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '18px', color: '#8B4513', marginBottom: '8px' }}>
                  Migração de Saldos
                </h3>
                <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                  Use esta função para recalcular os saldos de todos os usuários baseado nas contribuições e compensações existentes. 
                  Isso é útil após a migração para o novo sistema de saldo.
                </p>
                <button
                  onClick={handleMigrateBalances}
                  disabled={migrating}
                  style={{
                    padding: '12px 24px',
                    background: migrating ? '#CCC' : 'linear-gradient(135deg, #A0522D 0%, #D2691E 100%)',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: migrating ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                  }}
                >
                  {migrating ? 'Migrando...' : 'Migrar Saldos de Todos os Usuários'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}




