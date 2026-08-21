import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { initialState, normalizeText, nowIso, STARTER_PRODUCTS } from './data'
import { firebaseReady, loadCloudState, removeLegacyCloudState, saveCloudState } from './firebase'
import { mergeSyncedStates, stampListChanges } from './sync'

const STORAGE_KEY = 'meu-mercado-state-v1'
const StoreContext = createContext(null)

const normalizeState = (value = {}) => {
  const merged = { ...initialState, ...value }
  const oldLists = Array.isArray(merged.lists) ? merged.lists : []
  const uniqueItems = []
  oldLists.flatMap((list) => list.items || []).forEach((item) => {
    const itemKey = item.variantId
      ? `${item.productId || normalizeText(item.name)}|variant:${item.variantId}`
      : `${item.productId || normalizeText(item.name)}|base`
    if (!uniqueItems.some((saved) => (saved.variantId ? `${saved.productId || normalizeText(saved.name)}|variant:${saved.variantId}` : `${saved.productId || normalizeText(saved.name)}|base`) === itemKey)) {
      uniqueItems.push({ ...item, checked: Boolean(item.checked) })
    }
  })
  const savedProducts = Array.isArray(merged.products) ? merged.products : []
  const products = [...savedProducts]
  STARTER_PRODUCTS.forEach((starter) => {
    if (!products.some((product) => normalizeText(product.name) === normalizeText(starter.name))) products.push(starter)
  })
  return {
    ...merged,
    products,
    productMappings: Array.isArray(merged.productMappings) ? merged.productMappings : [],
    productNormalizations: Array.isArray(merged.productNormalizations) ? merged.productNormalizations : [],
    deletedListItems: Array.isArray(merged.deletedListItems) ? merged.deletedListItems : [],
    lists: [{ ...oldLists[0], id: 'shopping-list', name: 'Lista de mercado', status: 'active', items: uniqueItems, createdAt: oldLists[0]?.createdAt || new Date().toISOString() }],
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
  const activeUser = useRef(null)
  const stateRef = useRef(state)
  const hydrationRun = useRef(0)
  const lastSyncedState = useRef(null)
  const saveQueue = useRef(Promise.resolve())

  useEffect(() => {
    stateRef.current = state
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    // A cópia por usuário também precisa ser imediata. Se ela fosse atualizada
    // apenas depois do debounce/envio, um refresh restauraria a versão anterior.
    if (user && activeUser.current === user.uid) {
      localStorage.setItem(`${STORAGE_KEY}-${user.uid}`, JSON.stringify(state))
    }
  }, [state, user])

  useEffect(() => {
    const run = ++hydrationRun.current
    if (!user || !firebaseReady) {
      activeUser.current = null
      hydratedUser.current = null
      lastSyncedState.current = null
      setSyncStatus(firebaseReady ? 'local' : 'not-configured')
      return
    }

    activeUser.current = user.uid
    const userStorageKey = `${STORAGE_KEY}-${user.uid}`
    const stateAtHydrationStart = stateRef.current
    const cached = localStorage.getItem(userStorageKey)
    let cachedState = null
    if (cached) {
      try {
        cachedState = normalizeState(JSON.parse(cached))
        stateRef.current = cachedState
        setState(cachedState)
      } catch { /* usa o estado local atual */ }
    }

    setSyncStatus('syncing')
    loadCloudState(user.uid).then(async (cloud) => {
      if (hydrationRun.current !== run) return
      if (cloud.hasData) {
        const cloudState = normalizeState(cloud.state)
        const hydrationBase = cachedState || stateAtHydrationStart
        const cachedAndCloud = cachedState ? normalizeState(mergeSyncedStates({}, cachedState, cloudState)) : cloudState
        // Se o usuário editar enquanto a nuvem ainda está carregando, inclui a
        // edição na reconciliação em vez de substituí-la pela resposta tardia.
        const reconciledState = stateRef.current === hydrationBase
          ? cachedAndCloud
          : normalizeState(mergeSyncedStates(hydrationBase, stateRef.current, cachedAndCloud))
        setState(reconciledState)
        stateRef.current = reconciledState
        lastSyncedState.current = cloudState
        localStorage.setItem(userStorageKey, JSON.stringify(reconciledState))
        if (JSON.stringify(reconciledState) !== JSON.stringify(cloudState)) {
          const savedState = normalizeState(await saveCloudState(user.uid, reconciledState, user, cloudState))
          lastSyncedState.current = savedState
          if (stateRef.current === reconciledState) {
            stateRef.current = savedState
            setState(savedState)
          } else {
            const latestState = normalizeState(mergeSyncedStates(reconciledState, stateRef.current, savedState))
            stateRef.current = latestState
            setState(latestState)
          }
        }
        if (cloud.legacy) {
          await saveCloudState(user.uid, reconciledState, user)
          await removeLegacyCloudState(user.uid)
        }
      } else {
        const localState = stateRef.current
        const savedState = normalizeState(await saveCloudState(user.uid, localState, user))
        lastSyncedState.current = savedState
        stateRef.current = savedState
        setState(savedState)
        localStorage.setItem(userStorageKey, JSON.stringify(savedState))
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
      saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
        const cloud = await loadCloudState(user.uid)
        const remoteState = cloud.hasData ? normalizeState(cloud.state) : lastSyncedState.current || state
        const stateToSave = normalizeState(mergeSyncedStates(lastSyncedState.current || {}, state, remoteState))
        const savedState = normalizeState(await saveCloudState(user.uid, stateToSave, user, remoteState))
        lastSyncedState.current = savedState
        // Não sobrescreve uma nova edição feita enquanto esta gravação
        // estava em andamento; a próxima passagem da fila cuidará dela.
        if (stateRef.current === state) {
          stateRef.current = savedState
          localStorage.setItem(`${STORAGE_KEY}-${user.uid}`, JSON.stringify(savedState))
          if (JSON.stringify(savedState) !== JSON.stringify(state)) setState(savedState)
        }
        setSyncStatus('synced')
      }).catch(() => setSyncStatus('offline'))
    }, 700)
    return () => clearTimeout(timeout)
  }, [state, user])

  const mutate = useCallback((recipe) => {
    setState((current) => {
      const changedAt = nowIso()
      return { ...stampListChanges(current, recipe(current), changedAt), updatedAt: changedAt }
    })
  }, [])

  const value = useMemo(() => ({ state, setState, mutate, syncStatus }), [state, mutate, syncStatus])
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = () => useContext(StoreContext)
