// Service for products operations in Firestore
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getAllContributions } from './contributionService'
import { getAllVotes } from './voteService'

/**
 * Create a new product
 */
export async function createProduct(productData) {
  const productsRef = collection(db, 'products')
  
  const newProduct = {
    name: productData.name,
    description: productData.description || null,
    photoURL: productData.photoURL || null,
    averagePricePerKg: productData.averagePricePerKg || 0,
    averageRating: 0
  }

  const docRef = await addDoc(productsRef, newProduct)
  return docRef.id
}

/**
 * Get all products
 */
export async function getAllProducts() {
  const productsRef = collection(db, 'products')
  const q = query(productsRef, orderBy('name', 'asc'))
  
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

/**
 * Get product by ID
 */
export async function getProductById(productId) {
  const productRef = doc(db, 'products', productId)
  const productSnap = await getDoc(productRef)
  
  if (productSnap.exists()) {
    return { id: productSnap.id, ...productSnap.data() }
  }
  return null
}

/**
 * Search products by name
 */
export async function searchProducts(searchTerm) {
  const products = await getAllProducts()
  const lowerSearchTerm = searchTerm.toLowerCase()
  
  return products.filter(product => 
    product.name.toLowerCase().includes(lowerSearchTerm)
  )
}

/**
 * Update product
 */
export async function updateProduct(productId, updates) {
  const productRef = doc(db, 'products', productId)
  await updateDoc(productRef, updates)
}

/**
 * Delete product
 */
export async function deleteProduct(productId) {
  const productRef = doc(db, 'products', productId)
  await deleteDoc(productRef)
}

/**
 * Recalculate and update average price per kg for a product
 */
export async function updateProductAveragePrice(productId) {
  const contributions = await getAllContributions()
  const productContributions = contributions.filter(c => c.productId === productId)
  
  if (productContributions.length === 0) {
    await updateProduct(productId, { averagePricePerKg: 0 })
    return
  }
  
  const totalValue = productContributions.reduce((sum, c) => sum + (c.value || 0), 0)
  const totalKg = productContributions.reduce((sum, c) => sum + (c.quantityKg || 0), 0)
  
  const averagePricePerKg = totalKg > 0 ? totalValue / totalKg : 0
  
  await updateProduct(productId, { averagePricePerKg })
}

/**
 * Recalculate and update average rating for a product
 */
export async function updateProductAverageRating(productId) {
  const votes = await getAllVotes()
  const productVotes = votes.filter(v => v.productId === productId)
  
  if (productVotes.length === 0) {
    await updateProduct(productId, { averageRating: 0 })
    return
  }
  
  const totalRating = productVotes.reduce((sum, v) => sum + (v.rating || 0), 0)
  const averageRating = totalRating / productVotes.length
  
  // Round to nearest half star (0, 0.5, 1, 1.5, ..., 5)
  const roundedRating = Math.round(averageRating * 2) / 2
  
  await updateProduct(productId, { averageRating: roundedRating })
}




