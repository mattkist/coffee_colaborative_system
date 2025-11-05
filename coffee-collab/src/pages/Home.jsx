// Home page (Dashboard) - Most complex page
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { getUserProfile } from '../services/userService'
import { getAllContributions, getContributionsByUser, getContributionsMissingArrival } from '../services/contributionService'
import { getAllProducts } from '../services/productService'
import { getAllVotes, getVotesByUser } from '../services/voteService'
import { getActiveUsers } from '../services/userService'
import { NewContributionModal } from '../components/NewContributionModal'
import { NewProductModal } from '../components/NewProductModal'
import { EditContributionModal } from '../components/EditContributionModal'
import { CollaboratorsChart } from '../components/CollaboratorsChart'
import { TimelineChart } from '../components/TimelineChart'

export function Home() {
  const { user, signOut } = useAuth()
  const { profile } = useUserProfile()
  const navigate = useNavigate()
  const [userStats, setUserStats] = useState({ totalValue: 0, totalKg: 0 })
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showNewContributionModal, setShowNewContributionModal] = useState(false)
  const [showNewProductModal, setShowNewProductModal] = useState(false)
  const [collaboratorsData, setCollaboratorsData] = useState([])
  const [indicators, setIndicators] = useState({
    totalValue: 0,
    totalKg: 0,
    avgMonthlyKg: 0,
    avgMonthlyValue: 0,
    avgPerCollaborator: 0
  })
  const [newIndicators, setNewIndicators] = useState({
    nextInQueue: null, // { name, photoURL, totalKg }
    stockProjection: null, // { estimatedKg, daysLeft, status }
    avgSpendingPerActive: 0,
    priceTrend: null // { currentAvg, previousAvg, percentage, direction }
  })
  const [allContributions, setAllContributions] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [alerts, setAlerts] = useState({
    missingArrival: [],
    missingVotes: [],
    lastPlace: false
  })
  const [editingContributionId, setEditingContributionId] = useState(null)

  const loadData = async () => {
    if (!user) return

    try {
      setLoading(true)
      
      const [contributions, allContribs, users] = await Promise.all([
        getContributionsByUser(user.uid),
        getAllContributions(),
        getActiveUsers()
      ])

      // User stats
      const totalValue = contributions.reduce((sum, c) => sum + (c.value || 0), 0)
      const totalKg = contributions.reduce((sum, c) => sum + (c.quantityKg || 0), 0)
      setUserStats({ totalValue, totalKg })

      setAllUsers(users) // Store users for chart component (users already have balance field)

      // Calculate indicators
      const allKg = allContribs.reduce((sum, c) => sum + (c.quantityKg || 0), 0)
      const allValue = allContribs.reduce((sum, c) => sum + (c.value || 0), 0)
      
      // Calculate months with contributions
      const monthsSet = new Set()
      allContribs.forEach(c => {
        const date = c.purchaseDate?.toDate?.() || new Date(c.purchaseDate)
        monthsSet.add(`${date.getFullYear()}-${date.getMonth()}`)
      })
      const monthsCount = Math.max(monthsSet.size, 1)

      setIndicators({
        totalValue: allValue,
        totalKg: allKg,
        avgMonthlyKg: allKg / monthsCount,
        avgMonthlyValue: allValue / monthsCount,
        avgPerCollaborator: users.length > 0 ? allValue / users.length : 0
      })

      setAllContributions(allContribs)

      // Calculate new indicators (using balance instead of period-based calculation)
      calculateNewIndicators(allContribs, users)

      // Check for alerts
      await checkAlerts(user.uid, allContribs, users)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateNewIndicators = (allContribs, users) => {
    // 1. Próximo colaborador na fila (menor saldo)
    const usersWithBalance = users.map(user => ({
      userId: user.id,
      name: user.name,
      photoURL: user.photoURL,
      balance: user.balance || 0
    }))
    const sortedByBalance = [...usersWithBalance].sort((a, b) => a.balance - b.balance)
    const nextInQueue = sortedByBalance.length > 0 ? {
      name: sortedByBalance[0].name,
      photoURL: sortedByBalance[0].photoURL,
      balance: sortedByBalance[0].balance
    } : null

    // 2. Projeção de estoque (baseado em consumo médio e última compra)
    let stockProjection = null
    if (allContribs.length > 0) {
      // Encontrar última compra com arrivalDate (quando realmente chegou)
      const contributionsWithArrival = allContribs
        .filter(c => c.arrivalDate)
        .map(c => ({
          ...c,
          arrivalDateObj: c.arrivalDate?.toDate?.() || new Date(c.arrivalDate)
        }))
        .sort((a, b) => b.arrivalDateObj - a.arrivalDateObj)
      
      if (contributionsWithArrival.length > 0) {
        const lastArrival = contributionsWithArrival[0]
        const lastArrivalDate = lastArrival.arrivalDateObj
        const lastQuantityKg = lastArrival.quantityKg || 0
        
        // Calcular consumo médio mensal (kg) - usar últimos 6 meses como base
        const endDate = new Date()
        const startDate = new Date()
        startDate.setMonth(startDate.getMonth() - 6)
        
        const contributionsInPeriod = allContribs.filter(c => {
          const contribDate = c.purchaseDate?.toDate?.() || new Date(c.purchaseDate)
          return contribDate >= startDate && contribDate <= endDate
        })
        
        const totalKgInPeriod = contributionsInPeriod.reduce((sum, c) => sum + (c.quantityKg || 0), 0)
        const avgMonthlyConsumption = totalKgInPeriod / 6
        const avgDailyConsumption = avgMonthlyConsumption / 30
        
        // Calcular dias desde a chegada
        const daysSinceArrival = Math.floor((endDate - lastArrivalDate) / (1000 * 60 * 60 * 24))
        
        // Estoque estimado = quantidade inicial - (consumo diário * dias)
        const estimatedKg = Math.max(0, lastQuantityKg - (avgDailyConsumption * daysSinceArrival))
        const daysLeft = avgDailyConsumption > 0 ? Math.floor(estimatedKg / avgDailyConsumption) : null
        
        let status = 'normal'
        if (daysLeft !== null) {
          if (daysLeft <= 7) status = 'critical'
          else if (daysLeft <= 15) status = 'warning'
        }
        
        stockProjection = {
          estimatedKg: estimatedKg.toFixed(2),
          daysLeft: daysLeft !== null ? daysLeft : null,
          status,
          lastQuantityKg: lastQuantityKg.toFixed(2),
          avgMonthlyConsumption: avgMonthlyConsumption.toFixed(2)
        }
      }
    }

    // 3. Gasto médio por colaborador ativo (últimos 6 meses)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - 6)
    
    const contributionsInPeriod = allContribs.filter(c => {
      const contribDate = c.purchaseDate?.toDate?.() || new Date(c.purchaseDate)
      return contribDate >= startDate && contribDate <= endDate
    })
    
    const totalValueInPeriod = contributionsInPeriod.reduce((sum, c) => sum + (c.value || 0), 0)
    const avgSpendingPerActive = users.length > 0 ? totalValueInPeriod / users.length : 0

    // 4. Tendência de preços (últimos 3 meses vs 3 meses anteriores)
    const now = new Date()
    const last3MonthsStart = new Date(now)
    last3MonthsStart.setMonth(last3MonthsStart.getMonth() - 3)
    
    const previous3MonthsStart = new Date(now)
    previous3MonthsStart.setMonth(previous3MonthsStart.getMonth() - 6)
    const previous3MonthsEnd = new Date(now)
    previous3MonthsEnd.setMonth(previous3MonthsEnd.getMonth() - 3)
    
    const last3MonthsContribs = allContribs.filter(c => {
      const contribDate = c.purchaseDate?.toDate?.() || new Date(c.purchaseDate)
      return contribDate >= last3MonthsStart && contribDate <= now
    })
    
    const previous3MonthsContribs = allContribs.filter(c => {
      const contribDate = c.purchaseDate?.toDate?.() || new Date(c.purchaseDate)
      return contribDate >= previous3MonthsStart && contribDate < previous3MonthsEnd
    })
    
    // Calcular preço médio por kg
    const calculateAvgPricePerKg = (contribs) => {
      if (contribs.length === 0) return null
      const totalValue = contribs.reduce((sum, c) => sum + (c.value || 0), 0)
      const totalKg = contribs.reduce((sum, c) => sum + (c.quantityKg || 0), 0)
      return totalKg > 0 ? totalValue / totalKg : null
    }
    
    const currentAvg = calculateAvgPricePerKg(last3MonthsContribs)
    const previousAvg = calculateAvgPricePerKg(previous3MonthsContribs)
    
    let priceTrend = null
    if (currentAvg !== null && previousAvg !== null && previousAvg > 0) {
      const percentage = ((currentAvg - previousAvg) / previousAvg) * 100
      const direction = percentage > 0 ? 'up' : percentage < 0 ? 'down' : 'stable'
      priceTrend = {
        currentAvg: currentAvg.toFixed(2),
        previousAvg: previousAvg.toFixed(2),
        percentage: Math.abs(percentage).toFixed(1),
        direction
      }
    } else if (currentAvg !== null && previousAvg === null) {
      priceTrend = {
        currentAvg: currentAvg.toFixed(2),
        previousAvg: null,
        percentage: null,
        direction: 'new'
      }
    }

    setNewIndicators({
      nextInQueue,
      stockProjection,
      avgSpendingPerActive,
      priceTrend
    })
  }

  const checkAlerts = async (userId, allContribs, users) => {
    try {
      // 1. Check for contributions missing arrival
      const missingArrival = await getContributionsMissingArrival(userId)
      
      // 2. Check for products without votes
      const allProducts = await getAllProducts()
      const userVotes = await getVotesByUser(userId)
      const userVotedProductIds = new Set(userVotes.map(v => v.productId))
      const missingVotes = allProducts.filter(p => !userVotedProductIds.has(p.id))
      
      // 3. Check if user has the lowest balance (or tied for lowest)
      const usersWithBalance = users.map(user => ({
        userId: user.id,
        balance: user.balance || 0
      }))
      const sortedByBalance = [...usersWithBalance].sort((a, b) => a.balance - b.balance)
      const lowestBalance = sortedByBalance[0]?.balance || 0
      const userBalance = users.find(u => u.id === userId)?.balance || 0
      const isLastPlace = userBalance === lowestBalance && lowestBalance >= 0
      
      setAlerts({
        missingArrival: missingArrival || [],
        missingVotes: missingVotes || [],
        lastPlace: isLastPlace || false
      })
    } catch (error) {
      console.error('Error checking alerts:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Error signing out:', error)
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
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '16px',
            padding: '0px 24px',
            marginBottom: '24px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div style={{ marginTop: '-100px', marginBottom: '-80px', marginLeft: '-70px' }}>
            <img 
              src="/meuCafeGrao_logo_transparent.png" 
              alt="CAFÉ GRÃO" 
              style={{ 
                height: '390px', 
                width: 'auto',
                maxWidth: '950px',
                objectFit: 'contain',
                display: 'block'
              }} 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: '8px',
                transition: 'background 150ms ease'
              }}
              onClick={() => navigate('/settings')}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139, 69, 19, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <img
                src={profile.photoURL || user.photoURL || 'https://via.placeholder.com/48?text=☕'}
                alt={profile.name}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  border: '2px solid #D2691E'
                }}
              />
              <div>
                <div style={{ fontWeight: 'bold', color: '#8B4513' }}>{profile.name}</div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  Saldo Atual: {(allUsers.find(u => u.id === user.uid)?.balance || 0).toFixed(2)} kg
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  Total: R$ {userStats.totalValue.toFixed(2)} | {userStats.totalKg.toFixed(2)} kg
                </div>
              </div>
            </div>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                style={{
                  padding: '12px 20px',
                  background: 'linear-gradient(135deg, #A0522D 0%, #D2691E 100%)',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
              >
                + Novo
              </button>

              {showAddMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: '#FFF',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                    padding: '8px',
                    minWidth: '200px',
                    zIndex: 100
                  }}
                >
                  <button
                    onClick={() => {
                      setShowAddMenu(false)
                      setShowNewContributionModal(true)
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#F5F5F5'
                    }}
                  >
                    📝 Nova Contribuição
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMenu(false)
                      navigate('/votes')
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#F5F5F5'
                    }}
                  >
                    ⭐ Votação
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMenu(false)
                      setShowNewProductModal(true)
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '4px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#F5F5F5'
                    }}
                  >
                    🏷️ Novo Produto
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={handleLogout}
              style={{
                padding: '12px 20px',
                background: '#FFF',
                color: '#8B4513',
                border: '2px solid #8B4513',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Sair
            </button>
          </div>
        </div>

        {/* Avisos section */}
        <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Alert 1: Missing arrival */}
          {alerts.missingArrival.length > 0 && (
            <div
              style={{
                background: 'linear-gradient(135deg, #FFE4B5 0%, #FFDAB9 100%)',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                border: '2px solid #D2691E',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '18px', color: '#8B4513', margin: '0 0 8px 0', fontWeight: 'bold' }}>
                  ☕ Já chegou o café?!
                </h3>
                <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                  Você tem {alerts.missingArrival.length} contribuição{alerts.missingArrival.length > 1 ? 'ões' : ''} 
                  {' '}sem evidência de chegada ou data de chegada.
                </p>
              </div>
              <button
                onClick={() => {
                  if (alerts.missingArrival.length > 0) {
                    setEditingContributionId(alerts.missingArrival[0].id)
                  }
                }}
                style={{
                  padding: '10px 20px',
                  background: '#8B4513',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Editar Contribuição
              </button>
            </div>
          )}

          {/* Alert 2: Missing votes */}
          {alerts.missingVotes.length > 0 && (
            <div
              style={{
                background: 'linear-gradient(135deg, #FFF8DC 0%, #FFE4B5 100%)',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                border: '2px solid #DAA520',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '18px', color: '#8B4513', margin: '0 0 8px 0', fontWeight: 'bold' }}>
                  ⭐ Não esqueça de dar o seu voto!
                </h3>
                <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                  Você ainda não votou em {alerts.missingVotes.length} produto{alerts.missingVotes.length > 1 ? 's' : ''}.
                </p>
              </div>
              <button
                onClick={() => navigate('/votes')}
                style={{
                  padding: '10px 20px',
                  background: '#DAA520',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Ir para Votações
              </button>
            </div>
          )}

          {/* Alert 3: Last place */}
          {alerts.lastPlace && (
            <div
              style={{
                background: 'linear-gradient(135deg, #F0E68C 0%, #FFFACD 100%)',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                border: '2px solid #B8860B',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '18px', color: '#8B4513', margin: '0 0 8px 0', fontWeight: 'bold' }}>
                  📊 Menor saldo detectado!
                </h3>
                <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
                  Você está na última posição (ou dividindo a última) no ranking de saldo. Você é o próximo da fila para comprar café!
                  {(allUsers.find(u => u.id === user.uid)?.balance || 0) === 0 && ' Que tal começar a contribuir?'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Dashboard Cards - First Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
          {/* Colaboradores - 2 columns */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <h2 style={{ fontSize: '20px', color: '#8B4513', marginBottom: '16px' }}>
              Saldo dos Colaboradores
            </h2>
            <CollaboratorsChart users={allUsers} />
          </div>

          {/* Indicadores - 1 column */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <h2 style={{ fontSize: '20px', color: '#8B4513', marginBottom: '16px' }}>
              Indicadores
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '12px', background: 'rgba(139, 69, 19, 0.05)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Valor Total Investido</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#8B4513' }}>
                  R$ {indicators.totalValue.toFixed(2)}
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(139, 69, 19, 0.05)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>KGs Total Consumido</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#8B4513' }}>
                  {indicators.totalKg.toFixed(2)} kg
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(139, 69, 19, 0.05)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Média Consumo Mensal</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#8B4513' }}>
                  {indicators.avgMonthlyKg.toFixed(2)} kg
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(139, 69, 19, 0.05)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Média Investimento Mensal</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#8B4513' }}>
                  R$ {indicators.avgMonthlyValue.toFixed(2)}
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(139, 69, 19, 0.05)', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Gasto Médio por Colaborador Ativo</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#8B4513' }}>
                  R$ {newIndicators.avgSpendingPerActive.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Cards - Second Row - New Indicators */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
          {/* Próximo na Fila */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <h2 style={{ fontSize: '18px', color: '#8B4513', marginBottom: '16px' }}>
              👤 Próximo na Fila
            </h2>
            {newIndicators.nextInQueue ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                <img
                  src={newIndicators.nextInQueue.photoURL || 'https://via.placeholder.com/64?text=☕'}
                  alt={newIndicators.nextInQueue.name}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    border: '2px solid #D2691E'
                  }}
                />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: '#8B4513', fontSize: '16px' }}>
                    {newIndicators.nextInQueue.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Saldo: {newIndicators.nextInQueue.balance.toFixed(2)} kg
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
                Sem dados suficientes
              </div>
            )}
          </div>

          {/* Projeção de Estoque */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <h2 style={{ fontSize: '18px', color: '#8B4513', marginBottom: '16px' }}>
              📦 Projeção de Estoque
            </h2>
            {newIndicators.stockProjection ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Estoque Estimado</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#8B4513' }}>
                    {newIndicators.stockProjection.estimatedKg} kg
                  </div>
                </div>
                {newIndicators.stockProjection.daysLeft !== null ? (
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Dias Restantes</div>
                    <div style={{ 
                      fontSize: '18px', 
                      fontWeight: 'bold', 
                      color: newIndicators.stockProjection.status === 'critical' ? '#DC3545' : 
                             newIndicators.stockProjection.status === 'warning' ? '#FF9800' : '#8B4513'
                    }}>
                      {newIndicators.stockProjection.daysLeft} dias
                    </div>
                  </div>
                ) : null}
                <div style={{ fontSize: '11px', color: '#999', marginTop: '8px' }}>
                  Consumo médio: {newIndicators.stockProjection.avgMonthlyConsumption} kg/mês
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
                Sem dados de chegada
              </div>
            )}
          </div>

          {/* Tendência de Preços */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <h2 style={{ fontSize: '18px', color: '#8B4513', marginBottom: '16px' }}>
              📈 Tendência de Preços
            </h2>
            {newIndicators.priceTrend ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Últimos 3 meses</div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#8B4513' }}>
                    R$ {newIndicators.priceTrend.currentAvg}/kg
                  </div>
                </div>
                {newIndicators.priceTrend.previousAvg && newIndicators.priceTrend.percentage !== null ? (
                  <>
                    <div>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>3 meses anteriores</div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        R$ {newIndicators.priceTrend.previousAvg}/kg
                      </div>
                    </div>
                    <div style={{ 
                      marginTop: '8px',
                      padding: '8px',
                      background: newIndicators.priceTrend.direction === 'up' ? 'rgba(220, 53, 69, 0.1)' :
                                 newIndicators.priceTrend.direction === 'down' ? 'rgba(40, 167, 69, 0.1)' :
                                 'rgba(139, 69, 19, 0.1)',
                      borderRadius: '6px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>Variação</div>
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: 'bold',
                        color: newIndicators.priceTrend.direction === 'up' ? '#DC3545' :
                               newIndicators.priceTrend.direction === 'down' ? '#28A745' :
                               '#8B4513'
                      }}>
                        {newIndicators.priceTrend.direction === 'up' ? '↑' : 
                         newIndicators.priceTrend.direction === 'down' ? '↓' : '→'} {newIndicators.priceTrend.percentage}%
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                    Dados anteriores insuficientes
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#666', fontSize: '14px' }}>
                Sem dados suficientes
              </div>
            )}
          </div>
        </div>

        {/* Dashboard Cards - Third Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          {/* Linha do Tempo - 3 columns (full width) */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <h2 style={{ fontSize: '20px', color: '#8B4513', marginBottom: '16px' }}>
              Linha do Tempo
            </h2>
            <TimelineChart contributions={allContributions} />
          </div>
        </div>
      </div>

      <NewContributionModal
        isOpen={showNewContributionModal}
        onClose={() => setShowNewContributionModal(false)}
        onSuccess={() => {
          // Reload all data
          loadData()
        }}
      />

      <NewProductModal
        isOpen={showNewProductModal}
        onClose={() => setShowNewProductModal(false)}
        onSuccess={() => {
          // Optionally reload data if needed
        }}
      />

      {editingContributionId && (
        <EditContributionModal
          isOpen={!!editingContributionId}
          contributionId={editingContributionId}
          onClose={() => {
            setEditingContributionId(null)
            loadData() // Reload to update alerts
          }}
          onSuccess={() => {
            loadData() // Reload to update alerts
            setEditingContributionId(null)
          }}
        />
      )}
    </Layout>
  )
}

