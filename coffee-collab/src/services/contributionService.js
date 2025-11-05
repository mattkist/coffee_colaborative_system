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
 * Create a new contribution
 */
export async function createContribution(contributionData) {
  const contributionsRef = collection(db, 'contributions')
  
  const isDivided = contributionData.isDivided || false
  const participantUserIds = contributionData.participantUserIds || []
  
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

  const docRef = await addDoc(contributionsRef, newContribution)
  const contributionId = docRef.id
  
  // Recalculate product average price
  await updateProductAveragePrice(contributionData.productId)
  
  // Handle divided contributions
  if (isDivided && participantUserIds.length > 0) {
    // All participants including the buyer
    const allParticipants = [...new Set([contributionData.userId, ...participantUserIds])]
    const totalParticipants = allParticipants.length
    const quantityPerPerson = contributionData.quantityKg / totalParticipants
    const valuePerPerson = contributionData.value / totalParticipants
    
    // Create contribution details subcollection
    const detailsRef = collection(db, 'contributions', contributionId, 'contributionDetails')
    const batch = writeBatch(db)
    
    // Get all user profiles to get names
    const userProfiles = await Promise.all(
      allParticipants.map(userId => getUserProfile(userId))
    )
    
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
        
        // Update user balance (increase by quantityPerPerson)
        const user = await getUserProfile(userId)
        if (user) {
          const newBalance = (user.balance || 0) + quantityPerPerson
          await updateUserProfile(userId, { balance: newBalance })
        }
      }
    }
    
    await batch.commit()
  } else {
    // Regular contribution - update only the buyer's balance
    const user = await getUserProfile(contributionData.userId)
    if (user) {
      const newBalance = (user.balance || 0) + contributionData.quantityKg
      await updateUserProfile(contributionData.userId, { balance: newBalance })
    }
  }
  
  // Check if compensation should be triggered
  const shouldTrigger = await shouldTriggerCompensation()
  if (shouldTrigger) {
    await executeAutomaticCompensation()
  }
  
  return contributionId
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
 * Update contribution
 */
export async function updateContribution(contributionId, updates) {
  const contribution = await getContributionById(contributionId)
  if (!contribution) {
    throw new Error('Contribution not found')
  }

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
  
  // Handle divided contribution changes
  if (isDivided && participantUserIds.length > 0) {
    // First, revert old balances if contribution was previously divided
    if (contribution.isDivided && contribution.details) {
      for (const detail of contribution.details) {
        const user = await getUserProfile(detail.userId)
        if (user) {
          const newBalance = Math.max(0, (user.balance || 0) - (detail.quantityKg || 0))
          await updateUserProfile(detail.userId, { balance: newBalance })
        }
      }
    } else if (!contribution.isDivided) {
      // Was regular, now divided - revert buyer's balance
      const user = await getUserProfile(contribution.userId)
      if (user) {
        const newBalance = Math.max(0, (user.balance || 0) - (contribution.quantityKg || 0))
        await updateUserProfile(contribution.userId, { balance: newBalance })
      }
    } else {
      // Was divided, now regular - revert all participants
      if (contribution.details) {
        for (const detail of contribution.details) {
          const user = await getUserProfile(detail.userId)
          if (user) {
            const newBalance = Math.max(0, (user.balance || 0) - (detail.quantityKg || 0))
            await updateUserProfile(detail.userId, { balance: newBalance })
          }
        }
      }
    }
    
    // Delete old details
    const detailsRef = collection(db, 'contributions', contributionId, 'contributionDetails')
    const oldDetailsSnapshot = await getDocs(detailsRef)
    const batch = writeBatch(db)
    oldDetailsSnapshot.docs.forEach(detailDoc => {
      batch.delete(detailDoc.ref)
    })
    await batch.commit()
    
    // Create new details
    const allParticipants = [...new Set([contribution.userId, ...participantUserIds])]
    const totalParticipants = allParticipants.length
    const quantityKg = updates.quantityKg !== undefined ? updates.quantityKg : contribution.quantityKg
    const value = updates.value !== undefined ? updates.value : contribution.value
    const quantityPerPerson = quantityKg / totalParticipants
    const valuePerPerson = value / totalParticipants
    
    const newDetailsRef = collection(db, 'contributions', contributionId, 'contributionDetails')
    const newBatch = writeBatch(db)
    
    const userProfiles = await Promise.all(
      allParticipants.map(userId => getUserProfile(userId))
    )
    
    for (let i = 0; i < allParticipants.length; i++) {
      const userId = allParticipants[i]
      const userProfile = userProfiles[i]
      
      if (userProfile) {
        const detailRef = doc(newDetailsRef)
        newBatch.set(detailRef, {
          userId: userId,
          userName: userProfile.name || 'Usuário desconhecido',
          quantityKg: quantityPerPerson,
          value: valuePerPerson,
          createdAt: serverTimestamp()
        })
        
        const user = await getUserProfile(userId)
        if (user) {
          const newBalance = (user.balance || 0) + quantityPerPerson
          await updateUserProfile(userId, { balance: newBalance })
        }
      }
    }
    
    await newBatch.commit()
    updateData.isDivided = true
  } else if (!isDivided && contribution.isDivided) {
    // Was divided, now regular - revert all participants and restore buyer's full balance
    if (contribution.details) {
      for (const detail of contribution.details) {
        const user = await getUserProfile(detail.userId)
        if (user) {
          const newBalance = Math.max(0, (user.balance || 0) - (detail.quantityKg || 0))
          await updateUserProfile(detail.userId, { balance: newBalance })
        }
      }
    }
    
    // Delete details
    const detailsRef = collection(db, 'contributions', contributionId, 'contributionDetails')
    const oldDetailsSnapshot = await getDocs(detailsRef)
    const batch = writeBatch(db)
    oldDetailsSnapshot.docs.forEach(detailDoc => {
      batch.delete(detailDoc.ref)
    })
    await batch.commit()
    
    // Restore buyer's full balance
    const quantityKg = updates.quantityKg !== undefined ? updates.quantityKg : contribution.quantityKg
    const user = await getUserProfile(contribution.userId)
    if (user) {
      const newBalance = (user.balance || 0) + quantityKg
      await updateUserProfile(contribution.userId, { balance: newBalance })
    }
    
    updateData.isDivided = false
  } else {
    // Regular contribution update
    const oldQuantityKg = contribution.quantityKg || 0
    const newQuantityKg = updates.quantityKg !== undefined ? updates.quantityKg : oldQuantityKg
    
    if (oldQuantityKg !== newQuantityKg) {
      const user = await getUserProfile(contribution.userId)
      if (user) {
        const balanceDiff = newQuantityKg - oldQuantityKg
        const newBalance = (user.balance || 0) + balanceDiff
        await updateUserProfile(contribution.userId, { balance: Math.max(0, newBalance) })
      }
    }
  }
  
  await updateDoc(contributionRef, updateData)
  
  // Recalculate product average price if value or quantity changed
  if (updates.value !== undefined || updates.quantityKg !== undefined) {
    await updateProductAveragePrice(contribution.productId)
  }
  
  // If arrivalEvidence was added and product has no photo, use it as product photo
  if (updates.arrivalEvidence) {
    const { getProductById, updateProduct } = await import('./productService')
    const product = await getProductById(contribution.productId)
    if (product && !product.photoURL) {
      await updateProduct(contribution.productId, { photoURL: updates.arrivalEvidence })
    }
  }
  
  // Check if compensation should be triggered
  const shouldTrigger = await shouldTriggerCompensation()
  if (shouldTrigger) {
    await executeAutomaticCompensation()
  }
}

/**
 * Delete contribution
 */
export async function deleteContribution(contributionId) {
  const contribution = await getContributionById(contributionId)
  const contributionRef = doc(db, 'contributions', contributionId)
  
  // Update user balance (decrease by quantityKg)
  if (contribution) {
    if (contribution.isDivided && contribution.details) {
      // Revert balances for all participants
      for (const detail of contribution.details) {
        const user = await getUserProfile(detail.userId)
        if (user) {
          const newBalance = Math.max(0, (user.balance || 0) - (detail.quantityKg || 0))
          await updateUserProfile(detail.userId, { balance: newBalance })
        }
      }
      
      // Delete details
      const detailsRef = collection(db, 'contributions', contributionId, 'contributionDetails')
      const detailsSnapshot = await getDocs(detailsRef)
      const batch = writeBatch(db)
      detailsSnapshot.docs.forEach(detailDoc => {
        batch.delete(detailDoc.ref)
      })
      await batch.commit()
    } else {
      // Regular contribution
      const user = await getUserProfile(contribution.userId)
      if (user) {
        const newBalance = Math.max(0, (user.balance || 0) - (contribution.quantityKg || 0))
        await updateUserProfile(contribution.userId, { balance: newBalance })
      }
    }
    
    await updateProductAveragePrice(contribution.productId)
  }
  
  await deleteDoc(contributionRef)
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
