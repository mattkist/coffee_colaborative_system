// Service for configuration operations in Firestore
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore'
import { db } from '../lib/firebase'

const DEFAULT_CALCULATION_MONTHS = 6

/**
 * Get configuration by name
 */
export async function getConfiguration(name) {
  const configsRef = collection(db, 'configurations')
  const q = query(configsRef, where('name', '==', name))
  
  const querySnapshot = await getDocs(q)
  
  if (!querySnapshot.empty) {
    const configDoc = querySnapshot.docs[0]
    return { id: configDoc.id, ...configDoc.data() }
  }
  
  // Return default if not found
  if (name === 'calculationBaseMonths') {
    return {
      name: 'calculationBaseMonths',
      description: 'Quantidade de meses para base de cálculo de contribuições',
      value: DEFAULT_CALCULATION_MONTHS
    }
  }
  
  return null
}

/**
 * Get or create configuration
 */
export async function getOrCreateConfiguration(name, description, defaultValue) {
  const existing = await getConfiguration(name)
  
  if (existing) {
    return existing
  }
  
  // Create default configuration
  const configsRef = collection(db, 'configurations')
  const docRef = await addDoc(configsRef, {
    name,
    description,
    value: defaultValue,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  
  return {
    id: docRef.id,
    name,
    description,
    value: defaultValue
  }
}

/**
 * Update configuration
 */
export async function updateConfiguration(configId, value) {
  const configRef = doc(db, 'configurations', configId)
  await setDoc(configRef, {
    value,
    updatedAt: serverTimestamp()
  }, { merge: true })
}

/**
 * Get calculation base months (convenience function)
 */
export async function getCalculationBaseMonths() {
  const config = await getConfiguration('calculationBaseMonths')
  return config ? config.value : DEFAULT_CALCULATION_MONTHS
}

/**
 * Set calculation base months (convenience function)
 */
export async function setCalculationBaseMonths(months) {
  const config = await getConfiguration('calculationBaseMonths')
  
  if (config && config.id) {
    await updateConfiguration(config.id, months)
  } else {
    // Create if doesn't exist
    await getOrCreateConfiguration(
      'calculationBaseMonths',
      'Quantidade de meses para base de cálculo de contribuições',
      months
    )
  }
}






