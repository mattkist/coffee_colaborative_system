// Contributions page
import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { getAllContributions, getContributionDetails } from '../services/contributionService'
import { getActiveUsers } from '../services/userService'
import { getAllProducts, getProductById } from '../services/productService'
import { useUserProfile } from '../hooks/useUserProfile'
import { NewContributionModal } from '../components/NewContributionModal'
import { EditContributionModal } from '../components/EditContributionModal'
import { deleteContribution } from '../services/contributionService'
import { ensureImageUrl } from '../services/googleDriveService'

export function Contributions() {
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const [contributions, setContributions] = useState([])
  const [usersMap, setUsersMap] = useState({})
  const [productsMap, setProductsMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [showNewContributionModal, setShowNewContributionModal] = useState(false)
  const [editingContributionId, setEditingContributionId] = useState(null)
  const [showingEvidence, setShowingEvidence] = useState(null) // contributionId of the one showing evidence
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    userId: '',
    productId: '',
    startDate: '',
    endDate: ''
  })
  const [sortBy, setSortBy] = useState('date') // 'date', 'value', 'quantity'
  const [sortOrder, setSortOrder] = useState('desc') // 'asc', 'desc'
  const [allContributions, setAllContributions] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [allProducts, setAllProducts] = useState([])

  const loadContributions = async () => {
    try {
      const [contribs, usersList, productsList] = await Promise.all([
        getAllContributions(),
        getActiveUsers(),
        getAllProducts()
      ])
      
      // Load details for divided contributions
      const contribsWithDetails = await Promise.all(
        contribs.map(async (contrib) => {
          if (contrib.isDivided) {
            try {
              const details = await getContributionDetails(contrib.id)
              return { ...contrib, details }
            } catch (error) {
              console.error(`Error loading details for contribution ${contrib.id}:`, error)
              return contrib
            }
          }
          return contrib
        })
      )
      
      setAllContributions(contribsWithDetails)
      setAllUsers(usersList)
      setAllProducts(productsList)
      
      // Build users map for display names
      const usersMapObj = {}
      usersList.forEach(u => {
        usersMapObj[u.id] = u
      })
      setUsersMap(usersMapObj)
      
      // Build products map
      const productsMapObj = {}
      productsList.forEach(p => {
        productsMapObj[p.id] = p
      })
      setProductsMap(productsMapObj)
      
      // Apply filters and sorting
      applyFiltersAndSort(contribsWithDetails, filters, sortBy, sortOrder)
    } catch (error) {
      console.error('Error loading contributions:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFiltersAndSort = (contribs, filterValues, sortField, sortDirection) => {
    let filtered = [...contribs]
    
    // Apply filters
    if (filterValues.userId) {
      filtered = filtered.filter(c => c.userId === filterValues.userId)
    }
    if (filterValues.productId) {
      filtered = filtered.filter(c => c.productId === filterValues.productId)
    }
    if (filterValues.startDate) {
      const startDate = new Date(filterValues.startDate)
      filtered = filtered.filter(c => {
        const contribDate = c.purchaseDate?.toDate?.() || new Date(c.purchaseDate)
        return contribDate >= startDate
      })
    }
    if (filterValues.endDate) {
      const endDate = new Date(filterValues.endDate)
      endDate.setHours(23, 59, 59, 999) // Include entire day
      filtered = filtered.filter(c => {
        const contribDate = c.purchaseDate?.toDate?.() || new Date(c.purchaseDate)
        return contribDate <= endDate
      })
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0
      
      if (sortField === 'date') {
        const dateA = a.purchaseDate?.toDate?.() || new Date(a.purchaseDate)
        const dateB = b.purchaseDate?.toDate?.() || new Date(b.purchaseDate)
        comparison = dateA - dateB
      } else if (sortField === 'value') {
        comparison = (a.value || 0) - (b.value || 0)
      } else if (sortField === 'quantity') {
        comparison = (a.quantityKg || 0) - (b.quantityKg || 0)
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
    
    setContributions(filtered)
  }

  useEffect(() => {
    if (allContributions.length > 0) {
      applyFiltersAndSort(allContributions, filters, sortBy, sortOrder)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sortBy, sortOrder, allContributions.length])

  useEffect(() => {
    loadContributions()
  }, [])

  const handleDelete = async (contributionId, contributionUserId) => {
    if (!user) return
    
    // Check permissions: admins can delete all, others can only delete their own
    const canDelete = profile?.isAdmin || (contributionUserId === user.uid)
    
    if (!canDelete) {
      alert('Você não tem permissão para deletar esta contribuição.')
      return
    }

    if (!confirm('Tem certeza que deseja deletar esta contribuição?')) {
      return
    }

    try {
      await deleteContribution(contributionId)
      loadContributions()
      alert('Contribuição deletada com sucesso!')
    } catch (error) {
      console.error('Error deleting contribution:', error)
      alert('Erro ao deletar contribuição. Tente novamente.')
    }
  }

  if (loading) {
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
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h1 style={{ fontSize: '32px', color: '#FFF', textShadow: '1px 1px 2px rgba(0, 0, 0, 0.3)' }}>
              Contribuições
            </h1>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowFilters(!showFilters)}
                style={{
                  padding: '12px 24px',
                  background: showFilters ? '#8B4513' : '#FFF',
                  color: showFilters ? '#FFF' : '#8B4513',
                  border: '2px solid #8B4513',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
              >
                {showFilters ? 'Ocultar Filtros' : 'Filtrar'}
              </button>
              <button
                onClick={() => setShowNewContributionModal(true)}
                style={{
                  padding: '12px 24px',
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
                + Nova Contribuição
              </button>
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                marginBottom: '24px'
              }}
            >
              <h3 style={{ fontSize: '20px', color: '#8B4513', marginBottom: '16px' }}>Filtros e Ordenação</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold', fontSize: '14px' }}>
                    Usuário
                  </label>
                  <select
                    value={filters.userId}
                    onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '2px solid #DDD',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#FFF'
                    }}
                  >
                    <option value="">Todos os usuários</option>
                    {allUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold', fontSize: '14px' }}>
                    Produto
                  </label>
                  <select
                    value={filters.productId}
                    onChange={(e) => setFilters({ ...filters, productId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '2px solid #DDD',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#FFF'
                    }}
                  >
                    <option value="">Todos os produtos</option>
                    {allProducts.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold', fontSize: '14px' }}>
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '2px solid #DDD',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold', fontSize: '14px' }}>
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '2px solid #DDD',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold', fontSize: '14px' }}>
                    Ordenar por
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                      padding: '8px',
                      border: '2px solid #DDD',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#FFF'
                    }}
                  >
                    <option value="date">Data</option>
                    <option value="value">Valor</option>
                    <option value="quantity">Quantidade</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold', fontSize: '14px' }}>
                    Ordem
                  </label>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    style={{
                      padding: '8px',
                      border: '2px solid #DDD',
                      borderRadius: '8px',
                      fontSize: '14px',
                      background: '#FFF'
                    }}
                  >
                    <option value="desc">Decrescente</option>
                    <option value="asc">Crescente</option>
                  </select>
                </div>
                <div style={{ marginTop: '24px' }}>
                  <button
                    onClick={() => {
                      setFilters({ userId: '', productId: '', startDate: '', endDate: '' })
                      setSortBy('date')
                      setSortOrder('desc')
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#FFF',
                      color: '#8B4513',
                      border: '2px solid #8B4513',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    Limpar Filtros
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {contributions.length === 0 ? (
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              padding: '48px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              textAlign: 'center'
            }}
          >
            <p style={{ fontSize: '18px', color: '#666' }}>
              Nenhuma contribuição registrada ainda.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {contributions.map((contribution) => {
              const purchaseDate = contribution.purchaseDate?.toDate?.() || new Date(contribution.purchaseDate)
              const contributionUser = usersMap[contribution.userId]
              const product = productsMap[contribution.productId]
              const canEdit = user && (contribution.userId === user.uid || profile?.isAdmin)
              const canDelete = user && (contribution.userId === user.uid || profile?.isAdmin)
              
              return (
                <div
                  key={contribution.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        {contributionUser?.photoURL && (
                          <img
                            src={contributionUser.photoURL}
                            alt={contributionUser.name}
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              objectFit: 'cover'
                            }}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#8B4513' }}>
                              {contributionUser?.name || 'Usuário desconhecido'}
                            </div>
                            {contribution.isDivided && contribution.details && contribution.details.length > 0 && (() => {
                              const totalParticipants = contribution.details.length
                              const additionalCollaborators = totalParticipants - 1
                              const valuePerPerson = contribution.value / totalParticipants
                              const quantityPerPerson = contribution.quantityKg / totalParticipants
                              return (
                                <div style={{ 
                                  fontSize: '12px', 
                                  color: '#D2691E', 
                                  background: '#FFF8E7',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #D2691E'
                                }}>
                                  +{additionalCollaborators} colaborador{additionalCollaborators > 1 ? 'es' : ''} 
                                  {' '}(R$ {valuePerPerson.toFixed(2)} - {quantityPerPerson.toFixed(2)}Kg cada)
                                </div>
                              )
                            })()}
                          </div>
                          <div style={{ fontSize: '14px', color: '#666' }}>
                            {purchaseDate.toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      </div>
                      
                      {product && (
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#2d5016', marginBottom: '4px' }}>
                            {product.name}
                          </div>
                          <div style={{ display: 'flex', gap: '16px', fontSize: '14px', color: '#666' }}>
                            <span>
                              R$ {product.averagePricePerKg?.toFixed(2) || '0.00'}/kg
                            </span>
                            <span>
                              {product.averageRating?.toFixed(1) || '0.0'} ⭐
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                        <div style={{ color: '#666', fontSize: '14px' }}>
                          Quantidade: <strong>{contribution.quantityKg?.toFixed(2) || 0} kg</strong>
                        </div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2d5016' }}>
                          R$ {contribution.value?.toFixed(2) || '0.00'}
                        </div>
                      </div>
                      
                      {/* Evidence section */}
                      {showingEvidence === contribution.id && (
                        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(139, 69, 19, 0.05)', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {contribution.purchaseEvidence && (
                              <div>
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>
                                  Evidência de Compra:
                                </div>
                                <img
                                  src={ensureImageUrl(contribution.purchaseEvidence)}
                                  alt="Evidência de compra"
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '300px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    objectFit: 'contain'
                                  }}
                                  onClick={() => window.open(ensureImageUrl(contribution.purchaseEvidence), '_blank')}
                                  onError={(e) => {
                                    e.target.parentElement.innerHTML = `<a href="${contribution.purchaseEvidence}" target="_blank" style="color: #8B4513; text-decoration: underline;">Ver evidência de compra</a>`
                                  }}
                                />
                              </div>
                            )}
                            {contribution.arrivalEvidence && (
                              <div>
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', fontWeight: 'bold' }}>
                                  Evidência de Chegada:
                                </div>
                                <img
                                  src={ensureImageUrl(contribution.arrivalEvidence)}
                                  alt="Evidência de chegada"
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '300px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    objectFit: 'contain'
                                  }}
                                  onClick={() => window.open(ensureImageUrl(contribution.arrivalEvidence), '_blank')}
                                  onError={(e) => {
                                    e.target.parentElement.innerHTML = `<a href="${contribution.arrivalEvidence}" target="_blank" style="color: #8B4513; text-decoration: underline;">Ver evidência de chegada</a>`
                                  }}
                                />
                              </div>
                            )}
                            {!contribution.purchaseEvidence && !contribution.arrivalEvidence && (
                              <div style={{ fontSize: '14px', color: '#999', fontStyle: 'italic' }}>
                                Nenhuma evidência disponível
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexDirection: 'column', alignItems: 'flex-end' }}>
                      {(contribution.purchaseEvidence || contribution.arrivalEvidence) && (
                        <button
                          onClick={() => setShowingEvidence(showingEvidence === contribution.id ? null : contribution.id)}
                          style={{
                            padding: '8px 16px',
                            background: showingEvidence === contribution.id ? '#8B4513' : '#FFF',
                            color: showingEvidence === contribution.id ? '#FFF' : '#8B4513',
                            border: '2px solid #8B4513',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            fontSize: '14px'
                          }}
                        >
                          {showingEvidence === contribution.id ? 'Ocultar Evidências' : 'Evidências'}
                        </button>
                      )}
                      {(canEdit || canDelete) && (
                        <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                          {canEdit && (
                            <button
                              onClick={() => setEditingContributionId(contribution.id)}
                              style={{
                                padding: '8px 16px',
                                background: '#FFF',
                                color: '#8B4513',
                                border: '2px solid #8B4513',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Editar
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(contribution.id, contribution.userId)}
                              style={{
                                padding: '8px 16px',
                                background: '#DC3545',
                                color: '#FFF',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Deletar
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <NewContributionModal
        isOpen={showNewContributionModal}
        onClose={() => setShowNewContributionModal(false)}
        onSuccess={() => {
          // Reload contributions
          loadContributions()
        }}
      />

      {editingContributionId && (
        <EditContributionModal
          isOpen={!!editingContributionId}
          contributionId={editingContributionId}
          onClose={() => setEditingContributionId(null)}
          onSuccess={() => {
            // Reload contributions
            loadContributions()
            setEditingContributionId(null)
          }}
        />
      )}
    </Layout>
  )
}

