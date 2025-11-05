// Modal for creating a new contribution
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { getActiveUsers } from '../services/userService'
import { searchProducts, createProduct, getAllProducts } from '../services/productService'
import { createContribution, updateContribution } from '../services/contributionService'
import { uploadContributionEvidence } from '../services/storageService'

export function NewContributionModal({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const [users, setUsers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [value, setValue] = useState('')
  const [quantityKg, setQuantityKg] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [isNewProduct, setIsNewProduct] = useState(false)
  const [purchaseEvidenceFile, setPurchaseEvidenceFile] = useState(null)
  const [purchaseEvidencePreview, setPurchaseEvidencePreview] = useState(null)
  const [purchaseEvidenceLink, setPurchaseEvidenceLink] = useState('')
  const [arrivalEvidenceFile, setArrivalEvidenceFile] = useState(null)
  const [arrivalEvidencePreview, setArrivalEvidencePreview] = useState(null)
  const [arrivalEvidenceLink, setArrivalEvidenceLink] = useState('')
  const [arrivalDate, setArrivalDate] = useState('')
  const [isDivided, setIsDivided] = useState(false)
  const [selectedParticipants, setSelectedParticipants] = useState([])

  useEffect(() => {
    if (!isOpen) return
    
    const loadData = async () => {
      setLoading(true)
      try {
        const [usersList, productsList] = await Promise.all([
          profile?.isAdmin ? getActiveUsers() : Promise.resolve([]),
          getAllProducts()
        ])
        setUsers(usersList)
        setProducts(productsList)
        setSelectedUserId(user?.uid || '')
      } catch (error) {
        console.error('Error loading data:', error)
        alert('Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [isOpen, profile, user])

  useEffect(() => {
    if (!productSearch) {
      setProducts([])
      return
    }

    const searchProductsAsync = async () => {
      try {
        const results = await searchProducts(productSearch)
        setProducts(results)
        setIsNewProduct(results.length === 0)
        setSelectedProductId('')
      } catch (error) {
        console.error('Error searching products:', error)
      }
    }

    const timeoutId = setTimeout(searchProductsAsync, 300)
    return () => clearTimeout(timeoutId)
  }, [productSearch])

  const handlePurchaseEvidenceChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPurchaseEvidenceFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPurchaseEvidencePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleArrivalEvidenceChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setArrivalEvidenceFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setArrivalEvidencePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!purchaseDate || !value || !quantityKg || !productSearch || (!purchaseEvidenceFile && !purchaseEvidenceLink)) {
      alert('Preencha todos os campos obrigatórios (incluindo evidência de compra)')
      return
    }

    if (parseFloat(value) <= 0 || parseFloat(quantityKg) <= 0) {
      alert('Valor e quantidade devem ser maiores que zero')
      return
    }

    const purchaseDateObj = new Date(purchaseDate)
    if (purchaseDateObj > new Date()) {
      alert('Data de compra não pode ser futura')
      return
    }

    if (arrivalDate) {
      const arrivalDateObj = new Date(arrivalDate)
      if (arrivalDateObj < purchaseDateObj) {
        alert('Data de chegada não pode ser anterior à data de compra')
        return
      }
    }

    setSaving(true)
    try {
      // Create product if it's new
      let productId = selectedProductId
      if (isNewProduct || !selectedProductId) {
        const productValue = parseFloat(value)
        const productQuantity = parseFloat(quantityKg)
        productId = await createProduct({
          name: productSearch,
          description: null,
          photoURL: null,
          averagePricePerKg: productQuantity > 0 ? productValue / productQuantity : 0
        })
      }

      // Create contribution first to get the ID
      const contributionData = {
        userId: selectedUserId || user.uid,
        purchaseDate: purchaseDate,
        value: parseFloat(value),
        quantityKg: parseFloat(quantityKg),
        productId: productId,
        purchaseEvidence: null, // Will be updated after upload
        arrivalEvidence: null, // Will be updated after upload
        arrivalDate: arrivalDate || null,
        isDivided: isDivided,
        participantUserIds: isDivided ? selectedParticipants : []
      }

      const contributionId = await createContribution(contributionData)

      // Upload evidence files using the contribution ID (with error handling)
      let purchaseEvidenceURL = null
      let arrivalEvidenceURL = null
      
      try {
        // Use Google Drive link if provided, otherwise try file upload
        const purchaseEvidenceInput = purchaseEvidenceLink || purchaseEvidenceFile
        if (purchaseEvidenceInput) {
          purchaseEvidenceURL = await uploadContributionEvidence(purchaseEvidenceInput, contributionId, 'purchase')
        }
      } catch (uploadError) {
        console.error('Error uploading purchase evidence:', uploadError)
        const errorMessage = uploadError.message || 'Erro desconhecido ao fazer upload'
        
        // Show user-friendly error message
        if (errorMessage.includes('Google Client ID não configurado')) {
          alert('⚠️ Google Drive não está configurado. Por favor, configure as credenciais OAuth2 conforme o guia GOOGLE_DRIVE_SETUP.md')
        } else if (errorMessage.includes('autenticação') || errorMessage.includes('auth')) {
          alert('⚠️ Erro de autenticação com Google Drive. Por favor, tente novamente e autorize o acesso quando solicitado.')
        } else {
          alert(`⚠️ Erro ao processar evidência de compra: ${errorMessage}\n\nVocê pode fazer upload manual e colar o link do Google Drive.`)
        }
        // Continue even if upload fails - contribution is already created
      }

      if (arrivalEvidenceLink || arrivalEvidenceFile) {
        try {
          const arrivalEvidenceInput = arrivalEvidenceLink || arrivalEvidenceFile
          arrivalEvidenceURL = await uploadContributionEvidence(arrivalEvidenceInput, contributionId, 'arrival')
        } catch (uploadError) {
          console.error('Error uploading arrival evidence:', uploadError)
          const errorMessage = uploadError.message || 'Erro desconhecido ao fazer upload'
          
          // Show user-friendly error message
          if (errorMessage.includes('Google Client ID não configurado')) {
            alert('⚠️ Google Drive não está configurado. Por favor, configure as credenciais OAuth2.')
          } else if (errorMessage.includes('autenticação') || errorMessage.includes('auth')) {
            alert('⚠️ Erro de autenticação com Google Drive. Por favor, tente novamente.')
          } else {
            alert(`⚠️ Erro ao processar evidência de chegada: ${errorMessage}\n\nVocê pode fazer upload manual e colar o link.`)
          }
          // Continue even if upload fails
        }
      }

      // Update contribution with evidence URLs (only if we have any)
      if (purchaseEvidenceURL || arrivalEvidenceURL) {
        await updateContribution(contributionId, {
          purchaseEvidence: purchaseEvidenceURL,
          arrivalEvidence: arrivalEvidenceURL
        })
      }

      // Reset form
      setPurchaseDate(new Date().toISOString().split('T')[0])
      setValue('')
      setQuantityKg('')
      setProductSearch('')
      setSelectedProductId('')
      setIsNewProduct(false)
      setPurchaseEvidenceFile(null)
      setPurchaseEvidencePreview(null)
      setPurchaseEvidenceLink('')
      setArrivalEvidenceFile(null)
      setArrivalEvidencePreview(null)
      setArrivalEvidenceLink('')
      setArrivalDate('')
      setIsDivided(false)
      setSelectedParticipants([])

      if (onSuccess) onSuccess()
      onClose()
      
      // Show success message
      alert('Contribuição criada com sucesso!')
    } catch (error) {
      console.error('Error creating contribution:', error)
      alert('Erro ao criar contribuição. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFF',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', color: '#8B4513', margin: 0 }}>Nova Contribuição</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px' }}>Carregando...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            {profile?.isAdmin && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                  Pessoa *
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                  {users.map((u) => (
                    <div
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      style={{
                        padding: '12px',
                        border: selectedUserId === u.id ? '3px solid #D2691E' : '2px solid #DDD',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        background: selectedUserId === u.id ? '#FFF8E7' : '#FFF',
                        transition: 'all 150ms ease'
                      }}
                    >
                      {u.photoURL && (
                        <img
                          src={u.photoURL}
                          alt={u.name}
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            marginBottom: '8px',
                            objectFit: 'cover'
                          }}
                        />
                      )}
                      <div style={{ fontSize: '12px', color: '#666' }}>{u.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                Data Compra *
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #DDD',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                Valor (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
                min="0.01"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #DDD',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                Quantidade (KG) *
              </label>
              <input
                type="number"
                step="0.01"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                required
                min="0.01"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #DDD',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                Rachar compra
              </label>
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={!isDivided}
                    onChange={() => {
                      setIsDivided(false)
                      setSelectedParticipants([])
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Não</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={isDivided}
                    onChange={() => setIsDivided(true)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Sim</span>
                </label>
              </div>
            </div>

            {isDivided && (
              <div style={{ marginBottom: '16px', padding: '16px', background: '#FFF8E7', borderRadius: '8px', border: '2px solid #D2691E' }}>
                <label style={{ display: 'block', marginBottom: '12px', color: '#666', fontWeight: 'bold' }}>
                  Selecionar colaboradores que vão rachar:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  {users.filter(u => u.id !== (selectedUserId || user.uid)).map((u) => (
                    <div
                      key={u.id}
                      onClick={() => {
                        if (selectedParticipants.includes(u.id)) {
                          setSelectedParticipants(selectedParticipants.filter(id => id !== u.id))
                        } else {
                          setSelectedParticipants([...selectedParticipants, u.id])
                        }
                      }}
                      style={{
                        padding: '12px',
                        border: selectedParticipants.includes(u.id) ? '3px solid #D2691E' : '2px solid #DDD',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        background: selectedParticipants.includes(u.id) ? '#FFF' : '#FFF',
                        transition: 'all 150ms ease'
                      }}
                    >
                      {u.photoURL && (
                        <img
                          src={u.photoURL}
                          alt={u.name}
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            marginBottom: '8px',
                            objectFit: 'cover'
                          }}
                        />
                      )}
                      <div style={{ fontSize: '12px', color: '#666' }}>{u.name}</div>
                    </div>
                  ))}
                </div>
                {value && quantityKg && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#FFF', borderRadius: '8px' }}>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
                      <strong>Total de pessoas:</strong> {selectedParticipants.length + 1} (incluindo você)
                    </div>
                    <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
                      <strong>Valor por pessoa:</strong> R$ {((parseFloat(value) || 0) / (selectedParticipants.length + 1)).toFixed(2)}
                    </div>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      <strong>Quantidade por pessoa:</strong> {((parseFloat(quantityKg) || 0) / (selectedParticipants.length + 1)).toFixed(2)} kg
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                Café/Produto *
              </label>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                required
                placeholder="Digite para buscar ou criar novo produto"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #DDD',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
              {productSearch && products.length > 0 && (
                <div
                  style={{
                    marginTop: '8px',
                    border: '1px solid #DDD',
                    borderRadius: '8px',
                    maxHeight: '200px',
                    overflow: 'auto'
                  }}
                >
                  {products.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => {
                        setSelectedProductId(product.id)
                        setProductSearch(product.name)
                        setIsNewProduct(false)
                      }}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #EEE',
                        background: selectedProductId === product.id ? '#FFF8E7' : '#FFF'
                      }}
                    >
                      {product.name}
                    </div>
                  ))}
                </div>
              )}
              {isNewProduct && productSearch && (
                <div style={{ marginTop: '8px', color: '#D2691E', fontSize: '14px' }}>
                  ✨ Novo produto será criado: {productSearch}
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                Evidência Compra *
              </label>
              <div style={{ marginBottom: '8px', fontSize: '12px', color: '#666' }}>
                Selecione um arquivo para upload automático (ou cole o link do Google Drive se preferir manual)
              </div>
              <input
                type="text"
                value={purchaseEvidenceLink}
                onChange={(e) => {
                  setPurchaseEvidenceLink(e.target.value)
                  setPurchaseEvidenceFile(null)
                  setPurchaseEvidencePreview(null)
                }}
                placeholder="Cole aqui o link do Google Drive (ou selecione arquivo abaixo)"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #DDD',
                  borderRadius: '8px',
                  fontSize: '16px',
                  marginBottom: '8px'
                }}
              />
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>OU</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  handlePurchaseEvidenceChange(e)
                  setPurchaseEvidenceLink('')
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #DDD',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
              {purchaseEvidencePreview && (
                <img
                  src={purchaseEvidencePreview}
                  alt="Preview"
                  style={{
                    width: '100%',
                    maxHeight: '200px',
                    objectFit: 'contain',
                    marginTop: '12px',
                    borderRadius: '8px'
                  }}
                />
              )}
              {purchaseEvidenceLink && !purchaseEvidencePreview && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
                  Link do Google Drive: {purchaseEvidenceLink.substring(0, 50)}...
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                Evidência Chegada
              </label>
              <input
                type="text"
                value={arrivalEvidenceLink}
                onChange={(e) => {
                  setArrivalEvidenceLink(e.target.value)
                  setArrivalEvidenceFile(null)
                  setArrivalEvidencePreview(null)
                }}
                placeholder="Cole aqui o link do Google Drive (ou selecione arquivo abaixo)"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #DDD',
                  borderRadius: '8px',
                  fontSize: '16px',
                  marginBottom: '8px'
                }}
              />
              <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>OU</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  handleArrivalEvidenceChange(e)
                  setArrivalEvidenceLink('')
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #DDD',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
              {arrivalEvidencePreview && (
                <img
                  src={arrivalEvidencePreview}
                  alt="Preview"
                  style={{
                    width: '100%',
                    maxHeight: '200px',
                    objectFit: 'contain',
                    marginTop: '12px',
                    borderRadius: '8px'
                  }}
                />
              )}
              {arrivalEvidenceLink && !arrivalEvidencePreview && (
                <div style={{ marginTop: '12px', fontSize: '12px', color: '#666' }}>
                  Link do Google Drive: {arrivalEvidenceLink.substring(0, 50)}...
                </div>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                Data Chegada
              </label>
              <input
                type="date"
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #DDD',
                  borderRadius: '8px',
                  fontSize: '16px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{
                  padding: '12px 24px',
                  background: '#FFF',
                  color: '#8B4513',
                  border: '2px solid #8B4513',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '12px 24px',
                  background: saving ? '#CCC' : 'linear-gradient(135deg, #A0522D 0%, #D2691E 100%)',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

