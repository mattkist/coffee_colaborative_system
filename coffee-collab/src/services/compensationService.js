// Service for compensation operations in Firestore
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { getActiveUsers, updateUserProfile } from './userService'

/**
 * Create a new compensation
 */
export async function createCompensation(date, totalKg, details) {
  const compensationsRef = collection(db, 'compensations')
  
  // Create compensation document
  const compensationDoc = await addDoc(compensationsRef, {
    date: date,
    totalKg: totalKg,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })

  // Create details subcollection
  const detailsRef = collection(db, 'compensations', compensationDoc.id, 'compensationDetails')
  const batch = writeBatch(db)

  for (const detail of details) {
    const detailRef = doc(detailsRef)
    batch.set(detailRef, {
      userId: detail.userId,
      userName: detail.userName,
      balanceBefore: detail.balanceBefore,
      balanceAfter: detail.balanceAfter,
      compensationKg: detail.compensationKg
    })
  }

  await batch.commit()

  return compensationDoc.id
}

/**
 * Get all compensations ordered by date (descending)
 */
export async function getAllCompensations() {
  const compensationsRef = collection(db, 'compensations')
  const q = query(compensationsRef, orderBy('date', 'desc'))
  const snapshot = await getDocs(q)

  const compensations = []
  for (const compDoc of snapshot.docs) {
    const compData = { id: compDoc.id, ...compDoc.data() }
    
    // Get details
    const detailsRef = collection(db, 'compensations', compDoc.id, 'compensationDetails')
    const detailsSnapshot = await getDocs(detailsRef)
    compData.details = detailsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    compensations.push(compData)
  }

  return compensations
}

/**
 * Get compensation by ID
 */
export async function getCompensationById(compensationId) {
  const compRef = doc(db, 'compensations', compensationId)
  const compSnap = await getDoc(compRef)

  if (!compSnap.exists()) {
    return null
  }

  const compData = { id: compSnap.id, ...compSnap.data() }

  // Get details
  const detailsRef = collection(db, 'compensations', compensationId, 'compensationDetails')
  const detailsSnapshot = await getDocs(detailsRef)
  compData.details = detailsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))

  return compData
}

/**
 * Check if compensation should be triggered
 * Returns true if all active users have balance > 0
 */
export async function shouldTriggerCompensation() {
  const activeUsers = await getActiveUsers()
  
  if (activeUsers.length === 0) {
    return false
  }

  // Check if all users have balance > 0
  return activeUsers.every(user => (user.balance || 0) > 0)
}

/**
 * Execute automatic compensation
 * This function finds the minimum balance and reduces all balances by that amount
 */
export async function executeAutomaticCompensation() {
  const activeUsers = await getActiveUsers()

  if (activeUsers.length === 0) {
    return null
  }

  // Get all balances
  const balances = activeUsers.map(user => user.balance || 0)
  
  // Find minimum balance (this is what will be compensated)
  const minBalance = Math.min(...balances)

  if (minBalance <= 0) {
    return null // No compensation needed
  }

  // Prepare compensation details
  const details = activeUsers.map(user => ({
    userId: user.id,
    userName: user.name,
    balanceBefore: user.balance || 0,
    balanceAfter: (user.balance || 0) - minBalance,
    compensationKg: minBalance
  }))

  // Update user balances
  const batch = writeBatch(db)
  for (const user of activeUsers) {
    const userRef = doc(db, 'users', user.id)
    batch.update(userRef, {
      balance: (user.balance || 0) - minBalance,
      updatedAt: serverTimestamp()
    })
  }

  await batch.commit()

  // Create compensation record
  const compensationId = await createCompensation(
    new Date(),
    minBalance,
    details
  )

  return compensationId
}

