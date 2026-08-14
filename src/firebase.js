import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence, signInWithPopup, signInWithRedirect } from 'firebase/auth'
import { collection, deleteDoc, doc, enableIndexedDbPersistence, getDoc, getDocs, getFirestore, serverTimestamp, writeBatch } from 'firebase/firestore'

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
    return {
      hasData: true,
      state: {
        lists: [listSnapshot.exists() ? listSnapshot.data() : { id: 'shopping-list', name: 'Lista de mercado', items: [] }],
        purchases: purchases.sort((a, b) => new Date(b.purchasedAt || 0) - new Date(a.purchasedAt || 0)),
        products,
        markets,
        settings: preferences.settings || { theme: 'system' },
        updatedAt: preferences.updatedAt || null,
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

export async function saveCloudState(userId, state, userProfile) {
  const batch = writeBatch(db)
  await Promise.all([
    syncCollection(batch, userId, 'purchases', state.purchases || []),
    syncCollection(batch, userId, 'products', state.products || []),
    syncCollection(batch, userId, 'markets', state.markets || []),
  ])

  const list = state.lists?.[0] || { id: 'shopping-list', name: 'Lista de mercado', items: [] }
  batch.set(doc(db, 'users', userId, 'shoppingList', 'current'), list)
  batch.set(doc(db, 'users', userId, 'app', 'preferences'), {
    settings: state.settings || { theme: 'system' },
    updatedAt: state.updatedAt || new Date().toISOString(),
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
}

export async function removeLegacyCloudState(userId) {
  await deleteDoc(doc(db, 'users', userId, 'app', 'state'))
}
