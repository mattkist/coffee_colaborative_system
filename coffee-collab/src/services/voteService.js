// Service for votes operations in Firestore
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { updateProductAverageRating } from './productService'

/**
 * Get or create vote for user and product
 */
export async function getVoteByUserAndProduct(userId, productId) {
  const votesRef = collection(db, 'votes')
  const q = query(
    votesRef,
    where('userId', '==', userId),
    where('productId', '==', productId)
  )
  
  const querySnapshot = await getDocs(q)
  
  if (!querySnapshot.empty) {
    const voteDoc = querySnapshot.docs[0]
    return { id: voteDoc.id, ...voteDoc.data() }
  }
  
  return null
}

/**
 * Create or update vote
 */
export async function createOrUpdateVote(userId, productId, rating) {
  // Check if vote already exists
  const existingVote = await getVoteByUserAndProduct(userId, productId)
  
  if (existingVote) {
    // Update existing vote
    const voteRef = doc(db, 'votes', existingVote.id)
    await updateDoc(voteRef, {
      rating,
      updatedAt: serverTimestamp()
    })
  } else {
    // Create new vote
    const votesRef = collection(db, 'votes')
    await addDoc(votesRef, {
      userId,
      productId,
      rating,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  }
  
  // Recalculate product average rating
  await updateProductAverageRating(productId)
}

/**
 * Get all votes
 */
export async function getAllVotes() {
  const votesRef = collection(db, 'votes')
  const querySnapshot = await getDocs(votesRef)
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

/**
 * Get votes by user ID
 */
export async function getVotesByUser(userId) {
  const votesRef = collection(db, 'votes')
  const q = query(votesRef, where('userId', '==', userId))
  
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

/**
 * Get votes by product ID
 */
export async function getVotesByProduct(productId) {
  const votesRef = collection(db, 'votes')
  const q = query(votesRef, where('productId', '==', productId))
  
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

/**
 * Delete vote
 */
export async function deleteVote(voteId, productId) {
  const voteRef = doc(db, 'votes', voteId)
  await deleteDoc(voteRef)
  
  // Recalculate product average rating
  await updateProductAverageRating(productId)
}




