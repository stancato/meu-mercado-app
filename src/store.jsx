import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { initialState, normalizeText, nowIso, STARTER_PRODUCTS } from './data'
import { firebaseReady, loadCloudState, removeLegacyCloudState, saveCloudState } from './firebase'

const STORAGE_KEY = 'meu-mercado-state-v1'
const StoreContext = createContext(null)

const normalizeState = (value = {}) => {
  const merged = { ...initialState, ...value }
  const oldLists = Array.isArray(merged.lists) ? merged.lists : []
  const uniqueItems = []
  oldLists.flatMap((list) => list.items || []).forEach((item) => {
    if (!uniqueItems.some((saved) => saved.name?.toLocaleLowerCase() === item.name?.toLocaleLowerCase())) uniqueItems.push(item)
  })
  const savedProducts = Array.isArray(merged.products) ? merged.products : []
  const products = [...savedProducts]
  STARTER_PRODUCTS.forEach((starter) => {
    if (!products.some((product) => normalizeText(product.name) === normalizeText(starter.name))) products.push(starter)
  })
  return {
    ...merged,
    products,
    lists: [{ id: 'shopping-list', name: 'Lista de mercado', status: 'active', items: uniqueItems, createdAt: oldLists[0]?.createdAt || new Date().toISOString() }],
    activePurchase: undefined,
  }
}

const readLocal = () => {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'))
  } catch { return initialState }
}

export function StoreProvider({ user, children }) {
  const [state, setState] = useState(readLocal)
  const [syncStatus, setSyncStatus] = useState(firebaseReady ? 'local' : 'not-configured')
  const hydratedUser = useRef(null)
  const stateRef = useRef(state)
  const hydrationRun = useRef(0)

  useEffect(() => {
    stateRef.current = state
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    const run = ++hydrationRun.current
    if (!user || !firebaseReady) {
      hydratedUser.current = null
      setSyncStatus(firebaseReady ? 'local' : 'not-configured')
      return
    }

    const userStorageKey = `${STORAGE_KEY}-${user.uid}`
    const cached = localStorage.getItem(userStorageKey)
    if (cached) {
      try {
        const cachedState = normalizeState(JSON.parse(cached))
        stateRef.current = cachedState
        setState(cachedState)
      } catch { /* usa o estado local atual */ }
    }

    setSyncStatus('syncing')
    loadCloudState(user.uid).then(async (cloud) => {
      if (hydrationRun.current !== run) return
      if (cloud.hasData) {
        const cloudState = normalizeState(cloud.state)
        setState(cloudState)
        stateRef.current = cloudState
        localStorage.setItem(userStorageKey, JSON.stringify(cloudState))
        if (cloud.legacy) {
          await saveCloudState(user.uid, cloudState, user)
          await removeLegacyCloudState(user.uid)
        }
      } else {
        const localState = stateRef.current
        await saveCloudState(user.uid, localState, user)
        localStorage.setItem(userStorageKey, JSON.stringify(localState))
      }
      if (hydrationRun.current !== run) return
      hydratedUser.current = user.uid
      setSyncStatus('synced')
    }).catch(() => { if (hydrationRun.current === run) setSyncStatus('error') })
  }, [user])

  useEffect(() => {
    if (!user || !firebaseReady || hydratedUser.current !== user.uid) return
    setSyncStatus('syncing')
    const timeout = setTimeout(() => {
      saveCloudState(user.uid, state, user).then(() => {
        localStorage.setItem(`${STORAGE_KEY}-${user.uid}`, JSON.stringify(state))
        setSyncStatus('synced')
      }).catch(() => setSyncStatus('offline'))
    }, 700)
    return () => clearTimeout(timeout)
  }, [state, user])

  const mutate = useCallback((recipe) => {
    setState((current) => ({ ...recipe(current), updatedAt: nowIso() }))
  }, [])

  const value = useMemo(() => ({ state, setState, mutate, syncStatus }), [state, mutate, syncStatus])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)
