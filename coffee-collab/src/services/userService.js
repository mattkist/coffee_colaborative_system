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
 * Migrate all user balances based on contributions and compensations
 * This function calculates balance = totalContributions - totalCompensations
 */
export async function migrateAllUserBalances() {
  const { getAllContributions } = await import('./contributionService')
  const { getAllCompensations } = await import('./compensationService')
  
  // Get all users
  const users = await getAllUsers()
  
  // Get all contributions
  const contributions = await getAllContributions()
  
  // Get all compensations
  const compensations = await getAllCompensations()
  
  // Calculate balance for each user
  const batch = writeBatch(db)
  
  for (const user of users) {
    // Calculate total contributions
    const userContributions = contributions.filter(c => c.userId === user.id)
    const totalContributions = userContributions.reduce((sum, c) => sum + (c.quantityKg || 0), 0)
    
    // Calculate total compensations
    let totalCompensations = 0
    for (const compensation of compensations) {
      const userDetail = compensation.details?.find(d => d.userId === user.id)
      if (userDetail) {
        totalCompensations += userDetail.compensationKg || 0
      }
    }
    
    // Calculate balance
    const balance = totalContributions - totalCompensations
    
    // Update user balance
    const userRef = doc(db, 'users', user.id)
    batch.update(userRef, {
      balance: Math.max(0, balance),
      updatedAt: serverTimestamp()
    })
  }
  
  await batch.commit()
  
  return {
    success: true,
    usersUpdated: users.length,
    message: `Balances updated for ${users.length} users`
  }
}

/**
 * Delete user profile (admin only)
 * WARNING: This only deletes the Firestore document, not the Firebase Auth user
 */
export async function deleteUser(userId) {
  const userRef = doc(db, 'users', userId)
  await deleteDoc(userRef)
}