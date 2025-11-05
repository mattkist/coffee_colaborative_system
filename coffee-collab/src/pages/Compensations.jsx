// Compensations page - CRUD for compensations
import { useState, useEffect } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { getAllCompensations } from '../services/compensationService'
import { getActiveUsers } from '../services/userService'

export function Compensations() {
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const [compensations, setCompensations] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedCompensation, setExpandedCompensation] = useState(null)

  useEffect(() => {
    loadCompensations()
  }, [])

  const loadCompensations = async () => {
    try {
      setLoading(true)
      const data = await getAllCompensations()
      setCompensations(data)
    } catch (error) {
      console.error('Error loading compensations:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
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
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '32px', color: '#FFF', textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)' }}>
            Compensações
          </h1>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            marginBottom: '24px'
          }}
        >
          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(139, 69, 19, 0.1)', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '16px', color: '#8B4513', marginBottom: '8px' }}>
              ℹ️ Como funciona o Saldo e as Compensações?
            </h3>
            <p style={{ fontSize: '14px', color: '#666', lineHeight: '1.6', margin: 0 }}>
              <strong>Saldo:</strong> Representa o quanto de café (em kg) cada colaborador ainda tem em contribuições positivas. 
              Quando alguém compra café, o saldo aumenta. Quando uma compensação é feita, todos têm o mesmo valor reduzido do saldo.
              <br /><br />
              <strong>Compensação Automática:</strong> Quando todos os usuários ativos têm saldo maior que zero, uma compensação automática é disparada. 
              A compensação reduz o menor saldo de todos os usuários proporcionalmente.
              <br /><br />
              <strong>Histórico:</strong> Todas as compensações ficam registradas aqui para consulta, mostrando o saldo antes e depois de cada compensação.
            </p>
          </div>
        </div>

        {compensations.length === 0 ? (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              padding: '48px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              textAlign: 'center',
              color: '#666'
            }}
          >
            <p style={{ fontSize: '18px', margin: 0 }}>Nenhuma compensação registrada ainda.</p>
            <p style={{ fontSize: '14px', marginTop: '8px', color: '#999' }}>
              As compensações automáticas serão criadas quando todos os usuários tiverem saldo maior que zero.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {compensations.map((compensation) => (
              <div
                key={compensation.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    marginBottom: expandedCompensation === compensation.id ? '16px' : 0
                  }}
                  onClick={() => {
                    setExpandedCompensation(expandedCompensation === compensation.id ? null : compensation.id)
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '20px', color: '#8B4513', margin: '0 0 8px 0' }}>
                      Compensação de {formatDate(compensation.date)}
                    </h3>
                    <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                      Total compensado: <strong>{compensation.totalKg.toFixed(2)} kg</strong>
                    </p>
                  </div>
                  <div style={{ fontSize: '24px', color: '#8B4513' }}>
                    {expandedCompensation === compensation.id ? '▼' : '▶'}
                  </div>
                </div>

                {expandedCompensation === compensation.id && compensation.details && (
                  <div style={{ marginTop: '16px', borderTop: '2px solid #E0E0E0', paddingTop: '16px' }}>
                    <h4 style={{ fontSize: '16px', color: '#8B4513', marginBottom: '12px' }}>
                      Detalhes por Usuário:
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {compensation.details.map((detail) => (
                        <div
                          key={detail.id}
                          style={{
                            padding: '12px',
                            background: 'rgba(139, 69, 19, 0.05)',
                            borderRadius: '8px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', color: '#8B4513', marginBottom: '4px' }}>
                              {detail.userName}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              Saldo anterior: {detail.balanceBefore.toFixed(2)} kg → 
                              Saldo final: {detail.balanceAfter.toFixed(2)} kg
                            </div>
                          </div>
                          <div style={{ fontSize: '14px', color: '#8B4513', fontWeight: 'bold' }}>
                            -{detail.compensationKg.toFixed(2)} kg
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}

