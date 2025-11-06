// Service for contributions operations in Firestore
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
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { updateProductAveragePrice } from './productService'
import { getUserProfile, updateUserProfile } from './userService'
import { shouldTriggerCompensation, executeAutomaticCompensation } from './compensationService'

/**
 * Create a new contribution with atomicity
 * All operations (contribution creation, details creation) are done atomically using batch
 */
export async function createContribution(contributionData) {
  const isDivided = contributionData.isDivided || false
  const participantUserIds = contributionData.participantUserIds || []
  
  try {
    // Prepare data before batch operations
    const contributionsRef = collection(db, 'contributions')
    const contributionId = doc(contributionsRef).id // Generate ID upfront
    
    const newContribution = {
      userId: contributionData.userId,
      purchaseDate: Timestamp.fromDate(new Date(contributionData.purchaseDate)),
      value: contributionData.value,
      quantityKg: contributionData.quantityKg,
      productId: contributionData.productId,
      purchaseEvidence: contributionData.purchaseEvidence || null,
      arrivalEvidence: contributionData.arrivalEvidence || null,
      arrivalDate: contributionData.arrivalDate 
        ? Timestamp.fromDate(new Date(contributionData.arrivalDate))
        : null,
      isDivided: isDivided,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    // Get user profiles before batch (for divided contributions)
    let userProfiles = []
    if (isDivided && participantUserIds.length > 0) {
      const allParticipants = [...new Set([contributionData.userId, ...participantUserIds])]
      userProfiles = await Promise.all(
        allParticipants.map(userId => getUserProfile(userId))
      )
    }

    // Use batch to ensure atomicity
    const batch = writeBatch(db)
    
    // Create contribution document
    const contributionRef = doc(db, 'contributions', contributionId)
    batch.set(contributionRef, newContribution)
    
    // Handle divided contributions
    if (isDivided && participantUserIds.length > 0) {
      // All participants including the buyer
      const allParticipants = [...new Set([contributionData.userId, ...participantUserIds])]
      const totalParticipants = allParticipants.length
      const quantityPerPerson = contributionData.quantityKg / totalParticipants
      const valuePerPerson = contributionData.value / totalParticipants
      
      // Create contribution details subcollection
      const detailsRef = collection(db, 'contributions', contributionId, 'contributionDetails')
      
      // Create detail for each participant
      for (let i = 0; i < allParticipants.length; i++) {
        const userId = allParticipants[i]
        const userProfile = userProfiles[i]
        
        if (userProfile) {
          const detailRef = doc(detailsRef)
          batch.set(detailRef, {
            userId: userId,
            userName: userProfile.name || 'Usuário desconhecido',
            quantityKg: quantityPerPerson,
            value: valuePerPerson,
            createdAt: serverTimestamp()
          })
        }
      }
    }
    
    // Commit batch atomically - all or nothing
    await batch.commit()
    
    // After successful batch commit, update product average price
    // This is done outside the batch because it requires reading all contributions
    try {
      await updateProductAveragePrice(contributionData.productId)
    } catch (error) {
      console.error('Error updating product average price:', error)
      // Don't fail the whole operation if product update fails
    }
    
    // Reprocess all user balances to ensure accuracy
    // This recalculates from last compensation + contributions after it
    try {
      const { reprocessAllUserBalances } = await import('./userService')
      await reprocessAllUserBalances()
    } catch (error) {
      console.error('Error reprocessing balances:', error)
      // Don't fail the whole operation if balance reprocessing fails
      // The balance will be corrected on next reprocessing
    }
    
    // Check if compensation should be triggered
    try {
      const shouldTrigger = await shouldTriggerCompensation()
      if (shouldTrigger) {
        await executeAutomaticCompensation()
      }
    } catch (error) {
      console.error('Error checking/executing compensation:', error)
      // Don't fail the whole operation if compensation check fails
    }
    
    return contributionId
  } catch (error) {
    console.error('Error creating contribution:', error)
    throw new Error(`Erro ao criar contribuição: ${error.message}`)
  }
}

/**
 * Get all contributions
 */
export async function getAllContributions() {
  const contributionsRef = collection(db, 'contributions')
  const q = query(contributionsRef, orderBy('purchaseDate', 'desc'))
  
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

/**
 * Get contributions by user ID
 */
export async function getContributionsByUser(userId) {
  const contributionsRef = collection(db, 'contributions')
  // Query without orderBy to avoid requiring composite index
  const q = query(contributionsRef, where('userId', '==', userId))
  
  const querySnapshot = await getDocs(q)
  
  // Sort in memory instead
  return querySnapshot.docs
    .map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    .sort((a, b) => {
      const dateA = a.purchaseDate?.toDate?.() || new Date(a.purchaseDate)
      const dateB = b.purchaseDate?.toDate?.() || new Date(b.purchaseDate)
      return dateB - dateA // Descending order
    })
}

/**
 * Get contributions within date range (for calculation base months)
 */
export async function getContributionsInDateRange(startDate, endDate) {
  const contributionsRef = collection(db, 'contributions')
  const q = query(
    contributionsRef,
    where('purchaseDate', '>=', Timestamp.fromDate(startDate)),
    where('purchaseDate', '<=', Timestamp.fromDate(endDate)),
    orderBy('purchaseDate', 'desc')
  )
  
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

/**
 * Get contribution by ID
 */
export async function getContributionById(contributionId) {
  const contributionRef = doc(db, 'contributions', contributionId)
  const contributionSnap = await getDoc(contributionRef)
  
  if (contributionSnap.exists()) {
    const contribution = { id: contributionSnap.id, ...contributionSnap.data() }
    
    // Load contribution details if it's divided
    if (contribution.isDivided) {
      const detailsRef = collection(db, 'contributions', contributionId, 'contributionDetails')
      const detailsSnapshot = await getDocs(detailsRef)
      contribution.details = detailsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    }
    
    return contribution
  }
  return null
}

/**
 * Get contribution details (participants)
 */
export async function getContributionDetails(contributionId) {
  const detailsRef = collection(db, 'contributions', contributionId, 'contributionDetails')
  const detailsSnapshot = await getDocs(detailsRef)
  
  return detailsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

/**
 * Update contribution with atomicity
 * All operations (contribution update, details update/deletion) are done atomically using batch
 */
export async function updateContribution(contributionId, updates) {
  const contribution = await getContributionById(contributionId)
  if (!contribution) {
    throw new Error('Contribution not found')
  }

  try {
    const contributionRef = doc(db, 'contributions', contributionId)
    
    const updateData = {
      ...updates,
      updatedAt: serverTimestamp()
    }
    
    // Convert dates to Timestamps if present
    if (updates.purchaseDate) {
      updateData.purchaseDate = Timestamp.fromDate(new Date(updates.purchaseDate))
    }
    if (updates.arrivalDate) {
      updateData.arrivalDate = Timestamp.fromDate(new Date(updates.arrivalDate))
    }
    
    const isDivided = updates.isDivided !== undefined ? updates.isDivided : (contribution.isDivided || false)
    const participantUserIds = updates.participantUserIds || []
    const skipBalanceUpdate = updates.skipBalanceUpdate || false
    
    // Remove skipBalanceUpdate from updateData as it's not a field to save
    delete updateData.skipBalanceUpdate
    
    // Prepare user profiles before batch (if needed)
    let userProfiles = []
    if (!skipBalanceUpdate && isDivided && participantUserIds.length > 0) {
      const allParticipants = [...new Set([contribution.userId, ...participantUserIds])]
      userProfiles = await Promise.all(
        allParticipants.map(userId => getUserProfile(userId))
      )
    }
    
    // Use single batch to ensure atomicity
    const batch = writeBatch(db)
    
    // Update contribution document
    batch.update(contributionRef, updateData)
    
    // Handle divided contribution changes (only if not skipping balance updates)
    if (!skipBalanceUpdate && isDivided && participantUserIds.length > 0) {
      // Delete old details
      const detailsRef = collection(db, 'contributions', contributionId, 'contributionDetails')
      const oldDetailsSnapshot = await getDocs(detailsRef)
      oldDetailsSnapshot.docs.forEach(detailDoc => {
        batch.delete(detailDoc.ref)
      })
      
      // Create new details
      const allParticipants = [...new Set([contribution.userId, ...participantUserIds])]
      const totalParticipants = allParticipants.length
      const quantityKg = updates.quantityKg !== undefined ? updates.quantityKg : contribution.quantityKg
      const value = updates.value !== undefined ? updates.value : contribution.value
      const quantityPerPerson = quantityKg / totalParticipants
      const valuePerPerson = value / totalParticipants
      
      const newDetailsRef = collection(db, 'contributions', contributionId, 'contributionDetails')
      
      for (let i = 0; i < allParticipants.length; i++) {
        const userId = allParticipants[i]
        const userProfile = userProfiles[i]
        
        if (userProfile) {
          const detailRef = doc(newDetailsRef)
          batch.set(detailRef, {
            userId: userId,
            userName: userProfile.name || 'Usuário desconhecido',
            quantityKg: quantityPerPerson,
            value: valuePerPerson,
            createdAt: serverTimestamp()
          })
        }
      }
      
      updateData.isDivided = true
    } else if (!skipBalanceUpdate && !isDivided && contribution.isDivided) {
      // Was divided, now regular - delete details
      const detailsRef = collection(db, 'contributions', contributionId, 'contributionDetails')
      const oldDetailsSnapshot = await getDocs(detailsRef)
      oldDetailsSnapshot.docs.forEach(detailDoc => {
        batch.delete(detailDoc.ref)
      })
      
      updateData.isDivided = false
    }
    
    // If skipping balance update, still update isDivided flag if changed
    if (skipBalanceUpdate && updates.isDivided !== undefined) {
      updateData.isDivided = updates.isDivided
      batch.update(contributionRef, { isDivided: updates.isDivided })
    }
    
    // Commit batch atomically - all or nothing
    await batch.commit()
    
    // After successful batch commit, update product average price if needed
    if (updates.value !== undefined || updates.quantityKg !== undefined) {
      try {
        await updateProductAveragePrice(contribution.productId)
      } catch (error) {
        console.error('Error updating product average price:', error)
        // Don't fail the whole operation if product update fails
      }
    }
    
    // If arrivalEvidence was added and product has no photo, use it as product photo
    if (updates.arrivalEvidence) {
      try {
        const { getProductById, updateProduct } = await import('./productService')
        const product = await getProductById(contribution.productId)
        if (product && !product.photoURL) {
          await updateProduct(contribution.productId, { photoURL: updates.arrivalEvidence })
        }
      } catch (error) {
        console.error('Error updating product photo:', error)
        // Don't fail the whole operation if product photo update fails
      }
    }
    
    // Reprocess all user balances to ensure accuracy (only if not skipping balance update)
    // This recalculates from last compensation + contributions after it
    if (!skipBalanceUpdate) {
      try {
        const { reprocessAllUserBalances } = await import('./userService')
        await reprocessAllUserBalances()
      } catch (error) {
        console.error('Error reprocessing balances:', error)
        // Don't fail the whole operation if balance reprocessing fails
        // The balance will be corrected on next reprocessing
      }
    }
    
    // Check if compensation should be triggered
    try {
      const shouldTrigger = await shouldTriggerCompensation()
      if (shouldTrigger) {
        await executeAutomaticCompensation()
      }
    } catch (error) {
      console.error('Error checking/executing compensation:', error)
      // Don't fail the whole operation if compensation check fails
    }
  } catch (error) {
    console.error('Error updating contribution:', error)
    throw new Error(`Erro ao atualizar contribuição: ${error.message}`)
  }
}

/**
 * Delete contribution
 */
export async function deleteContribution(contributionId) {
  const contribution = await getContributionById(contributionId)
  const contributionRef = doc(db, 'contributions', contributionId)
  
  // Delete contribution details if it's divided
  if (contribution) {
    if (contribution.isDivided && contribution.details) {
      // Delete details
      const detailsRef = collection(db, 'contributions', contributionId, 'contributionDetails')
      const detailsSnapshot = await getDocs(detailsRef)
      const batch = writeBatch(db)
      detailsSnapshot.docs.forEach(detailDoc => {
        batch.delete(detailDoc.ref)
      })
      await batch.commit()
    }
    
    await updateProductAveragePrice(contribution.productId)
  }
  
  await deleteDoc(contributionRef)
  
  // Reprocess all user balances to ensure accuracy
  // This recalculates from last compensation + contributions after it
  const { reprocessAllUserBalances } = await import('./userService')
  await reprocessAllUserBalances()
}

/**
 * Get contributions missing arrival data for a user
 */
export async function getContributionsMissingArrival(userId) {
  const contributionsRef = collection(db, 'contributions')
  const q = query(
    contributionsRef,
    where('userId', '==', userId),
    orderBy('purchaseDate', 'desc')
  )
  
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(contrib => !contrib.arrivalEvidence || !contrib.arrivalDate)
}
