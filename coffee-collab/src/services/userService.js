// Service for user profile operations in Firestore
import { 
  doc, 
  getDoc, 
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { db } from '../lib/firebase'

/**
 * Gets or creates user profile in Firestore
 * Creates profile if it doesn't exist (first login)
 * If no admin exists, first user becomes admin
 */
export async function getOrCreateUserProfile(user) {
  const userRef = doc(db, 'users', user.uid)
  const userSnap = await getDoc(userRef)

  if (userSnap.exists()) {
    // User profile already exists, return it
    return { id: userSnap.id, ...userSnap.data() }
  } else {
    // First login - check if there are any admins
    const adminsRef = collection(db, 'users')
    const adminsQuery = query(adminsRef, where('isAdmin', '==', true))
    const adminsSnapshot = await getDocs(adminsQuery)
    
    // If no admins exist, this user becomes the first admin
    const isAdmin = adminsSnapshot.empty

    // Create user profile
    const newProfile = {
      id: user.uid,
      email: user.email,
      name: user.displayName || user.email?.split('@')[0] || 'Usuário',
      photoURL: user.photoURL,
      isAdmin,
      isActive: isAdmin, // Admins are automatically active, regular users start inactive
      balance: 0, // Initial balance is 0
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }

    await setDoc(userRef, newProfile)
    
    // TODO: Send email to admins about new user registration
    // This would typically be done via Cloud Functions
    
    return newProfile
  }
}

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId) {
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  
  if (userSnap.exists()) {
    return { id: userSnap.id, ...userSnap.data() }
  }
  return null
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId, updates) {
  const userRef = doc(db, 'users', userId)
  await setDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp()
  }, { merge: true })
}

/**
 * Get all active users
 */
export async function getActiveUsers() {
  const usersRef = collection(db, 'users')
  const activeQuery = query(usersRef, where('isActive', '==', true))
  const snapshot = await getDocs(activeQuery)
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

/**
 * Get all admins
 */
export async function getAllAdmins() {
  const usersRef = collection(db, 'users')
  const adminsQuery = query(usersRef, where('isAdmin', '==', true))
  const snapshot = await getDocs(adminsQuery)
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers() {
  const usersRef = collection(db, 'users')
  const snapshot = await getDocs(usersRef)
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

/**
 * Reprocess all user balances based on last compensation and contributions after it
 * This function:
 * 1. Gets the balance from the last compensation (or 0 if user wasn't in it)
 * 2. Sums all contributions that occurred AFTER the last compensation
 * 3. Updates only users whose new balance differs from current balance
 */
export async function reprocessAllUserBalances() {
  const { getAllContributions } = await import('./contributionService')
  const { getAllCompensations, getLastCompensationDate } = await import('./compensationService')
  const { getContributionDetails } = await import('./contributionService')
  
  // Get all users
  const allUsers = await getAllUsers()
  
  // Get last compensation date
  const lastCompDate = await getLastCompensationDate()
  
  // Get last compensation details to get balances after compensation
  let lastCompensation = null
  if (lastCompDate) {
    const compensations = await getAllCompensations()
    if (compensations.length > 0) {
      lastCompensation = compensations[0] // First one is the most recent
    }
  }
  
  // Get all contributions
  const allContributions = await getAllContributions()
  
  // Filter contributions after last compensation (or all if no compensation)
  const contributionsAfterCompensation = lastCompDate
    ? allContributions.filter(contrib => {
        const contribDate = contrib.purchaseDate?.toDate?.() || new Date(contrib.purchaseDate)
        return contribDate > lastCompDate
      })
    : allContributions
  
  // Calculate new balances for each user
  const batch = writeBatch(db)
  let usersUpdated = 0
  
  for (const user of allUsers) {
    // Get balance from last compensation (or 0 if user wasn't in it)
    let baseBalance = 0
    if (lastCompensation && lastCompensation.details) {
      const userDetail = lastCompensation.details.find(d => d.userId === user.id)
      if (userDetail) {
        baseBalance = userDetail.balanceAfter || 0
      }
    }
    
    // Calculate contributions after last compensation for this user
    let contributionsKg = 0
    
    for (const contrib of contributionsAfterCompensation) {
      if (contrib.isDivided) {
        // For divided contributions, get user's share from details
        try {
          const details = await getContributionDetails(contrib.id)
          const userDetail = details.find(d => d.userId === user.id)
          if (userDetail) {
            contributionsKg += userDetail.quantityKg || 0
          }
        } catch (error) {
          console.error(`Error loading details for contribution ${contrib.id}:`, error)
        }
      } else {
        // Regular contribution - only creator gets the full amount
        if (contrib.userId === user.id) {
          contributionsKg += contrib.quantityKg || 0
        }
      }
    }
    
    // Calculate new balance
    const newBalance = Math.max(0, baseBalance + contributionsKg)
    const currentBalance = user.balance || 0
    
    // Only update if balance changed
    if (newBalance !== currentBalance) {
      const userRef = doc(db, 'users', user.id)
      batch.update(userRef, {
        balance: newBalance,
        updatedAt: serverTimestamp()
      })
      usersUpdated++
    }
  }
  
  await batch.commit()
  
  return {
    success: true,
    usersUpdated,
    message: `Balances reprocessed: ${usersUpdated} user(s) updated`
  }
}

/**
 * Migrate all user balances based on contributions and compensations
 * This function calculates balance = totalContributions - totalCompensations
 * NOTE: This is the old logic. For correct reprocessing, use reprocessAllUserBalances() instead
 */
export async function migrateAllUserBalances() {
  // Use the new reprocess logic which is more accurate
  return await reprocessAllUserBalances()
}

/**
 * Delete user profile (admin only)
 * WARNING: This only deletes the Firestore document, not the Firebase Auth user
 */
export async function deleteUser(userId) {
  const userRef = doc(db, 'users', userId)
  await deleteDoc(userRef)
}