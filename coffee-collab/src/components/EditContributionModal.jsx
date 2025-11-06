// Modal for editing an existing contribution
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useUserProfile } from '../hooks/useUserProfile'
import { getActiveUsers } from '../services/userService'
import { searchProducts, createProduct, getAllProducts, getProductById } from '../services/productService'
import { getContributionById, updateContribution } from '../services/contributionService'
import { uploadContributionEvidence } from '../services/storageService'
import { ensureImageUrl } from '../services/googleDriveService'
import { isContributionCompensated } from '../services/compensationService'

export function EditContributionModal({ isOpen, contributionId, onClose, onSuccess }) {
  const { user } = useAuth()
  const { profile } = useUserProfile()
  const [users, setUsers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [selectedUserId, setSelectedUserId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [value, setValue] = useState('')
  const [quantityKg, setQuantityKg] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [isNewProduct, setIsNewProduct] = useState(false)
  const [purchaseEvidenceFile, setPurchaseEvidenceFile] = useState(null)
  const [purchaseEvidencePreview, setPurchaseEvidencePreview] = useState(null)
  const [purchaseEvidenceURL, setPurchaseEvidenceURL] = useState(null)
  const [arrivalEvidenceFile, setArrivalEvidenceFile] = useState(null)
  const [arrivalEvidencePreview, setArrivalEvidencePreview] = useState(null)
  const [arrivalEvidenceURL, setArrivalEvidenceURL] = useState(null)
  const [arrivalDate, setArrivalDate] = useState('')
  const [isDivided, setIsDivided] = useState(false)
  const [selectedParticipants, setSelectedParticipants] = useState([])
  const [isCompensated, setIsCompensated] = useState(false)

  // Load contribution data when modal opens
  useEffect(() => {
    if (!isOpen || !contributionId) return
    
    const loadContribution = async () => {
      setLoading(true)
      try {
        const [contribution, usersList, productsList] = await Promise.all([
          getContributionById(contributionId),
          getActiveUsers(), // Always load users for split selection
          getAllProducts()
        ])
        
        if (!contribution) {
          alert('Contribuição não encontrada')
          onClose()
          return
        }

        setUsers(usersList)
        setProducts(productsList)
        
        // Populate form with existing data
        setSelectedUserId(contribution.userId)
        
        const purchaseDateObj = contribution.purchaseDate?.toDate?.() || new Date(contribution.purchaseDate)
        setPurchaseDate(purchaseDateObj.toISOString().split('T')[0])
        
        setValue(contribution.value?.toString() || '')
        setQuantityKg(contribution.quantityKg?.toString() || '')
        setPurchaseEvidenceURL(contribution.purchaseEvidence || null)
        setArrivalEvidenceURL(contribution.arrivalEvidence || null)
        setIsDivided(contribution.isDivided || false)
        
        if (contribution.arrivalDate) {
          const arrivalDateObj = contribution.arrivalDate?.toDate?.() || new Date(contribution.arrivalDate)
          setArrivalDate(arrivalDateObj.toISOString().split('T')[0])
        }
        
        // Load contribution details if divided
        if (contribution.isDivided && contribution.details) {
          const participantIds = contribution.details
            .filter(detail => detail.userId !== contribution.userId)
            .map(detail => detail.userId)
          setSelectedParticipants(participantIds)
        } else {
          setSelectedParticipants([])
        }
        
        // Load product data
        if (contribution.productId) {
          const product = await getProductById(contribution.productId)
          if (product) {
            setProductSearch(product.name)
            setSelectedProductId(product.id)
            setIsNewProduct(false)
          }
        }
        
        // Check if contribution is already compensated
        const compensated = await isContributionCompensated(contribution.purchaseDate)
        setIsCompensated(compensated)
      } catch (error) {
        console.error('Error loading contribution:', error)
        alert('Erro ao carregar contribuição')
      } finally {
        setLoading(false)
      }
    }

    loadContribution()
  }, [isOpen, contributionId, profile, onClose])

  useEffect(() => {
    // If a product is selected and search matches its name, don't search
    if (selectedProductId && productSearch) {
      const selectedProduct = products.find(p => p.id === selectedProductId)
      if (selectedProduct && selectedProduct.name === productSearch) {
        setProducts([])
        setIsNewProduct(false)
        return
      }
    }

    // If no search text, clear results
    if (!productSearch) {
      setProducts([])
      setIsNewProduct(false)
      return
    }

    // Don't search if a product is already selected (unless user is typing a different name)
    if (selectedProductId) {
      const selectedProduct = products.find(p => p.id === selectedProductId)
      // Only search if user is typing something different than the selected product name
      if (selectedProduct && selectedProduct.name === productSearch) {
        setProducts([])
        setIsNewProduct(false)
        return
      }
    }

    const searchProductsAsync = async () => {
      try {
        const results = await searchProducts(productSearch)
        // Check if current search matches a selected product
        const matchesSelected = selectedProductId && results.find(p => p.id === selectedProductId && p.name === productSearch)
        if (matchesSelected) {
          setProducts([])
          setIsNewProduct(false)
        } else {
          setProducts(results)
          // Check if current product is in results
          const currentProductInResults = results.find(p => p.id === selectedProductId)
          setIsNewProduct(!currentProductInResults && !selectedProductId && results.length === 0)
          // Clear selection if search doesn't match selected product
          if (selectedProductId) {
            const selectedProduct = results.find(p => p.id === selectedProductId)
            if (!selectedProduct || selectedProduct.name !== productSearch) {
              setSelectedProductId('')
            }
          }
        }
      } catch (error) {
        console.error('Error searching products:', error)
      }
    }

    const timeoutId = setTimeout(searchProductsAsync, 300)
    return () => clearTimeout(timeoutId)
  }, [productSearch, selectedProductId])

  const handlePurchaseEvidenceChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setPurchaseEvidenceFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPurchaseEvidencePreview(reader.result)
      }
      reader.readAsDataURL(file)
      // Clear existing URL if new file is selected
      setPurchaseEvidenceURL(null)
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
      // Clear existing URL if new file is selected
      setArrivalEvidenceURL(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!purchaseDate || !value || !quantityKg || !productSearch) {
      alert('Preencha todos os campos obrigatórios')
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
      // Handle product - create if new, keep existing if same
      let productId = selectedProductId
      if (isNewProduct || (!selectedProductId && productSearch)) {
        const productValue = parseFloat(value)
        const productQuantity = parseFloat(quantityKg)
        productId = await createProduct({
          name: productSearch,
          description: null,
          photoURL: null,
          averagePricePerKg: productQuantity > 0 ? productValue / productQuantity : 0
        })
      }

      // Upload new evidence files if provided
      let newPurchaseEvidenceURL = purchaseEvidenceURL
      let newArrivalEvidenceURL = arrivalEvidenceURL
      
      if (purchaseEvidenceFile) {
        try {
          newPurchaseEvidenceURL = await uploadContributionEvidence(purchaseEvidenceFile, contributionId, 'purchase')
        } catch (uploadError) {
          console.error('Error uploading purchase evidence:', uploadError)
          alert('Aviso: Upload da evidência de compra falhou. A contribuição será atualizada, mas a imagem antiga será mantida.')
        }
      }

      if (arrivalEvidenceFile) {
        try {
          newArrivalEvidenceURL = await uploadContributionEvidence(arrivalEvidenceFile, contributionId, 'arrival')
        } catch (uploadError) {
          console.error('Error uploading arrival evidence:', uploadError)
          alert('Aviso: Upload da evidência de chegada falhou. A contribuição será atualizada, mas a imagem antiga será mantida.')
        }
      }

      // Check if contribution is already compensated before updating balances
      const contribution = await getContributionById(contributionId)
      const wasCompensated = await isContributionCompensated(contribution.purchaseDate)
      
      // Update contribution
      const updateData = {
        userId: selectedUserId || user.uid,
        purchaseDate: purchaseDate,
        value: parseFloat(value),
        quantityKg: parseFloat(quantityKg),
        productId: productId,
        arrivalDate: arrivalDate || null,
        isDivided: isDivided,
        participantUserIds: isDivided ? selectedParticipants : []
      }

      // Only update evidence URLs if we have new ones
      if (newPurchaseEvidenceURL !== purchaseEvidenceURL || newArrivalEvidenceURL !== arrivalEvidenceURL) {
        updateData.purchaseEvidence = newPurchaseEvidenceURL
        updateData.arrivalEvidence = newArrivalEvidenceURL
      }
      
      // If contribution was already compensated, don't update balances
      if (wasCompensated) {
        // Only update non-balance fields
        updateData.skipBalanceUpdate = true // Flag to skip balance updates
      }

      await updateContribution(contributionId, updateData)

      // Reset form
      setPurchaseEvidenceFile(null)
      setPurchaseEvidencePreview(null)
      setArrivalEvidenceFile(null)
      setArrivalEvidencePreview(null)

      if (onSuccess) onSuccess()
      onClose()
      
      alert('Contribuição atualizada com sucesso!')
    } catch (error) {
      console.error('Error updating contribution:', error)
      alert('Erro ao atualizar contribuição. Tente novamente.')
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
          <h2 style={{ fontSize: '24px', color: '#8B4513', margin: 0 }}>Editar Contribuição</h2>
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
          <>
            {isCompensated && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #FFF8E7 0%, #FFE4B5 100%)',
                  border: '2px solid #DAA520',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '24px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '20px' }}>⚠️</span>
                  <strong style={{ color: '#8B4513', fontSize: '16px' }}>
                    Contribuição já compensada
                  </strong>
                </div>
                <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
                  Esta contribuição já foi compensada. Qualquer edição não afetará o saldo das pessoas.
                </p>
              </div>
            )}
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
                Rachar compra (Vaquinha)
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
                
                {/* Card readonly do usuário que está cadastrando */}
                {(() => {
                  const currentUserObj = users.find(u => u.id === (selectedUserId || user.uid))
                  if (currentUserObj) {
                    return (
                      <div style={{ marginBottom: '12px', padding: '12px', background: '#FFF', borderRadius: '8px', border: '2px solid #D2691E', opacity: 0.8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {currentUserObj.photoURL && (
                            <img
                              src={currentUserObj.photoURL}
                              alt={currentUserObj.name}
                              style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '50%',
                                objectFit: 'cover'
                              }}
                            />
                          )}
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#8B4513' }}>
                              {currentUserObj.name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                              (você está incluído)
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                })()}
                
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
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value)
                    // Clear selection if user starts typing a different name
                    if (selectedProductId) {
                      const selectedProduct = products.find(p => p.id === selectedProductId)
                      if (selectedProduct && e.target.value !== selectedProduct.name) {
                        setSelectedProductId('')
                      }
                    }
                  }}
                  onFocus={() => {
                    // Show search results when focused if there's text and no selection
                    if (productSearch && !selectedProductId) {
                      searchProducts(productSearch).then(results => {
                        setProducts(results)
                        setIsNewProduct(results.length === 0)
                      })
                    }
                  }}
                  required
                  placeholder="Digite para buscar ou criar novo produto"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: selectedProductId ? '2px solid #D2691E' : '2px solid #DDD',
                    borderRadius: '8px',
                    fontSize: '16px',
                    background: selectedProductId ? '#FFF8E7' : '#FFF'
                  }}
                />
                {selectedProductId && (
                  <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#D2691E',
                    fontSize: '18px'
                  }}>
                    ✓
                  </div>
                )}
              </div>
              {/* Only show dropdown if no product is selected and there are search results */}
              {productSearch && products.length > 0 && !selectedProductId && (
                <div
                  style={{
                    marginTop: '8px',
                    border: '1px solid #DDD',
                    borderRadius: '8px',
                    maxHeight: '200px',
                    overflow: 'auto',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    zIndex: 1000,
                    position: 'relative'
                  }}
                >
                  {products.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => {
                        setSelectedProductId(product.id)
                        setProductSearch(product.name)
                        setIsNewProduct(false)
                        setProducts([]) // Hide dropdown immediately after selection
                      }}
                      style={{
                        padding: '12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #EEE',
                        background: '#FFF',
                        transition: 'background 150ms ease'
                      }}
                      onMouseEnter={(e) => e.target.style.background = '#FFF8E7'}
                      onMouseLeave={(e) => e.target.style.background = '#FFF'}
                    >
                      {product.name}
                    </div>
                  ))}
                </div>
              )}
              {selectedProductId && (
                <div style={{ 
                  marginTop: '8px', 
                  padding: '8px 12px',
                  background: '#E8F5E9',
                  borderRadius: '6px',
                  border: '1px solid #4CAF50',
                  color: '#2E7D32',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>✓</span>
                  <span>Produto selecionado: <strong>{productSearch}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProductId('')
                      setProductSearch('')
                      setProducts([])
                      setIsNewProduct(false)
                    }}
                    style={{
                      marginLeft: 'auto',
                      background: 'transparent',
                      border: 'none',
                      color: '#2E7D32',
                      cursor: 'pointer',
                      fontSize: '14px',
                      textDecoration: 'underline'
                    }}
                  >
                    Alterar
                  </button>
                </div>
              )}
              {isNewProduct && productSearch && !selectedProductId && (
                <div style={{ 
                  marginTop: '8px', 
                  padding: '8px 12px',
                  background: '#FFF3E0',
                  borderRadius: '6px',
                  border: '1px solid #FF9800',
                  color: '#E65100',
                  fontSize: '14px'
                }}>
                  ✨ Novo produto será criado: <strong>{productSearch}</strong>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                Evidência Compra {purchaseEvidenceURL ? '(atual)' : '*'}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePurchaseEvidenceChange}
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
              {purchaseEvidenceURL && !purchaseEvidencePreview && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Imagem atual:</p>
                  <img
                    src={ensureImageUrl(purchaseEvidenceURL)}
                    alt="Evidência atual"
                    style={{
                      width: '100%',
                      maxHeight: '200px',
                      objectFit: 'contain',
                      borderRadius: '8px'
                    }}
                    onError={(e) => {
                      console.error('Error loading image:', purchaseEvidenceURL)
                      e.target.style.display = 'none'
                    }}
                  />
                </div>
              )}
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontWeight: 'bold' }}>
                Evidência Chegada {arrivalEvidenceURL ? '(atual)' : ''}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleArrivalEvidenceChange}
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
              {arrivalEvidenceURL && !arrivalEvidencePreview && (
                <div style={{ marginTop: '12px' }}>
                  <p style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Imagem atual:</p>
                  <img
                    src={ensureImageUrl(arrivalEvidenceURL)}
                    alt="Evidência atual"
                    style={{
                      width: '100%',
                      maxHeight: '200px',
                      objectFit: 'contain',
                      borderRadius: '8px'
                    }}
                    onError={(e) => {
                      console.error('Error loading image:', arrivalEvidenceURL)
                      e.target.style.display = 'none'
                    }}
                  />
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
          </>
        )}
      </div>
    </div>
  )
}

