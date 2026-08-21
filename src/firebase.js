import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence, signInWithPopup, signInWithRedirect } from 'firebase/auth'
import { collection, deleteDoc, doc, enableIndexedDbPersistence, getDoc, getDocs, getFirestore, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore'
import { mergeSyncedStates } from './sync'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseReady = Boolean(config.apiKey && config.projectId && config.appId)
let auth = null
let db = null
let googleProvider = null

if (firebaseReady) {
  const app = initializeApp(config)
  auth = getAuth(app)
  db = getFirestore(app)
  googleProvider = new GoogleAuthProvider()
  googleProvider.setCustomParameters({ prompt: 'select_account' })
  setPersistence(auth, browserLocalPersistence).catch(() => {})
  enableIndexedDbPersistence(db).catch(() => {})
}

export { auth, db, googleProvider }

export async function loginWithGoogle() {
  if (!firebaseReady) throw new Error('Configure o Firebase no arquivo .env.local antes de entrar.')
  try {
    return await signInWithPopup(auth, googleProvider)
  } catch (error) {
    if (/popup|web-storage|operation-not-supported/i.test(error.code || '')) {
      await signInWithRedirect(auth, googleProvider)
      return null
    }
    throw error
  }
}

const userCollection = (userId, name) => collection(db, 'users', userId, name)

async function readCollection(userId, name) {
  const snapshot = await getDocs(userCollection(userId, name))
  return snapshot.docs.map((item) => item.data())
}

export async function loadCloudState(userId) {
  const [listSnapshot, purchases, products, markets, preferencesSnapshot] = await Promise.all([
    getDoc(doc(db, 'users', userId, 'shoppingList', 'current')),
    readCollection(userId, 'purchases'),
    readCollection(userId, 'products'),
    readCollection(userId, 'markets'),
    getDoc(doc(db, 'users', userId, 'app', 'preferences')),
  ])

  const hasStructuredData = listSnapshot.exists() || purchases.length || products.length || markets.length
  if (hasStructuredData) {
    const preferences = preferencesSnapshot.exists() ? preferencesSnapshot.data() : {}
    const list = listSnapshot.exists() ? listSnapshot.data() : { id: 'shopping-list', name: 'Lista de mercado', items: [] }
    return {
      hasData: true,
      state: {
        lists: [list],
        purchases: purchases.sort((a, b) => new Date(b.purchasedAt || 0) - new Date(a.purchasedAt || 0)),
        products,
        markets,
        settings: preferences.settings || { theme: 'system' },
        productMappings: Array.isArray(preferences.productMappings) ? preferences.productMappings : [],
        productNormalizations: Array.isArray(preferences.productNormalizations) ? preferences.productNormalizations : [],
        deletedListItems: Array.isArray(list.deletedListItems) ? list.deletedListItems : Array.isArray(preferences.deletedListItems) ? preferences.deletedListItems : [],
        // A lista e as preferências são gravadas em operações separadas. A data
        // da própria lista é a fonte mais recente para resolver conflitos nela.
        updatedAt: list.updatedAt || preferences.updatedAt || null,
      },
    }
  }

  // Compatibilidade com a primeira versão, que salvava tudo em um documento.
  const legacySnapshot = await getDoc(doc(db, 'users', userId, 'app', 'state'))
  return legacySnapshot.exists()
    ? { hasData: true, state: legacySnapshot.data().state, legacy: true }
    : { hasData: false, state: null }
}

async function syncCollection(batch, userId, name, entries) {
  const remote = await getDocs(userCollection(userId, name))
  const desiredIds = new Set(entries.map((entry) => String(entry.id)))
  remote.docs.forEach((entry) => {
    if (!desiredIds.has(entry.id)) batch.delete(entry.ref)
  })
  entries.forEach((entry) => batch.set(doc(db, 'users', userId, name, String(entry.id)), entry))
}

export async function saveCloudState(userId, state, userProfile, baseState = {}) {
  const listRef = doc(db, 'users', userId, 'shoppingList', 'current')
  const savedState = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(listRef)
    if (!snapshot.exists()) {
      const firstList = state.lists?.[0] || { id: 'shopping-list', name: 'Lista de mercado', items: [] }
      const updatedAt = state.updatedAt || new Date().toISOString()
      transaction.set(listRef, { ...firstList, deletedListItems: state.deletedListItems || [], updatedAt })
      return { ...state, updatedAt }
    }

    const remoteList = snapshot.data()
    const remoteState = {
      ...state,
      lists: [remoteList],
      deletedListItems: remoteList.deletedListItems || [],
      updatedAt: remoteList.updatedAt || null,
    }
    // Com uma base conhecida, uma alteração local vence uma cópia remota que
    // não mudou mesmo quando os relógios dos aparelhos estão dessincronizados.
    const merged = mergeSyncedStates(baseState, state, remoteState)
    const mergedList = merged.lists?.[0] || { id: 'shopping-list', name: 'Lista de mercado', items: [] }
    transaction.set(listRef, { ...mergedList, deletedListItems: merged.deletedListItems || [], updatedAt: merged.updatedAt || new Date().toISOString() })
    return merged
  })

  const batch = writeBatch(db)
  await Promise.all([
    syncCollection(batch, userId, 'purchases', savedState.purchases || []),
    syncCollection(batch, userId, 'products', savedState.products || []),
    syncCollection(batch, userId, 'markets', savedState.markets || []),
  ])

  batch.set(doc(db, 'users', userId, 'app', 'preferences'), {
    settings: savedState.settings || { theme: 'system' },
    productMappings: savedState.productMappings || [],
    productNormalizations: savedState.productNormalizations || [],
    deletedListItems: savedState.deletedListItems || [],
    updatedAt: savedState.updatedAt || new Date().toISOString(),
    savedAt: serverTimestamp(),
  })
  if (userProfile) {
    batch.set(doc(db, 'users', userId, 'profile', 'current'), {
      displayName: userProfile.displayName || '',
      email: userProfile.email || '',
      photoURL: userProfile.photoURL || '',
      updatedAt: serverTimestamp(),
    }, { merge: true })
  }
  await batch.commit()
  return savedState
}

export async function removeLegacyCloudState(userId) {
  await deleteDoc(doc(db, 'users', userId, 'app', 'state'))
}
