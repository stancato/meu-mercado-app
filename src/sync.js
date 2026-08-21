const asTime = (value) => {
  const time = new Date(value || 0).getTime()
  return Number.isFinite(time) ? time : 0
}

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const itemKey = (item) => String(item?.id || `${item?.productId || item?.name || ''}|${item?.variantId || 'base'}`)

const latestById = (entries = []) => {
  const result = new Map()
  entries.forEach((entry) => {
    const key = itemKey(entry)
    const saved = result.get(key)
    if (!saved || asTime(entry.deletedAt) >= asTime(saved.deletedAt)) result.set(key, entry)
  })
  return result
}

const mergeItemArrays = (base = [], local = [], remote = [], tombstones = [], localStateTime, remoteStateTime) => {
  const baseMap = new Map(base.map((item) => [itemKey(item), item]))
  const localMap = new Map(local.map((item) => [itemKey(item), item]))
  const remoteMap = new Map(remote.map((item) => [itemKey(item), item]))
  const deletedMap = latestById(tombstones)
  const orderedKeys = [...new Set([...localMap.keys(), ...remoteMap.keys(), ...baseMap.keys()])]

  return orderedKeys.flatMap((key) => {
    const baseItem = baseMap.get(key)
    const localItem = localMap.get(key)
    const remoteItem = remoteMap.get(key)
    let selected

    if (same(localItem, baseItem)) selected = remoteItem
    else if (same(remoteItem, baseItem)) selected = localItem
    else if (!localItem) selected = remoteItem
    else if (!remoteItem) selected = localItem
    else {
      const localTime = asTime(localItem.updatedAt) || asTime(localStateTime)
      const remoteTime = asTime(remoteItem.updatedAt) || asTime(remoteStateTime)
      selected = localTime >= remoteTime ? localItem : remoteItem
    }

    if (!selected) return []
    const itemTime = asTime(selected.updatedAt) || Math.max(asTime(localStateTime), asTime(remoteStateTime))
    if (asTime(deletedMap.get(key)?.deletedAt) >= itemTime) return []
    return [selected]
  })
}

const mergeEntityArrays = (base = [], local = [], remote = []) => {
  const keyOf = (entry) => String(entry?.id || '')
  const baseMap = new Map(base.map((entry) => [keyOf(entry), entry]))
  const localMap = new Map(local.map((entry) => [keyOf(entry), entry]))
  const remoteMap = new Map(remote.map((entry) => [keyOf(entry), entry]))
  const orderedKeys = [...new Set([...localMap.keys(), ...remoteMap.keys(), ...baseMap.keys()])]

  return orderedKeys.flatMap((key) => {
    const baseEntry = baseMap.get(key)
    const localEntry = localMap.get(key)
    const remoteEntry = remoteMap.get(key)
    if (same(localEntry, baseEntry)) return remoteEntry ? [remoteEntry] : []
    if (same(remoteEntry, baseEntry)) return localEntry ? [localEntry] : []
    return localEntry ? [localEntry] : remoteEntry ? [remoteEntry] : []
  })
}

export function mergeSyncedStates(base = {}, local = {}, remote = {}) {
  const localTime = local.updatedAt
  const remoteTime = remote.updatedAt
  const localIsNewer = asTime(localTime) >= asTime(remoteTime)
  const preferred = localIsNewer ? local : remote
  const tombstones = [...(local.deletedListItems || []), ...(remote.deletedListItems || [])]
  const deletedListItems = [...latestById(tombstones).values()]
  const baseList = base.lists?.[0] || {}
  const localList = local.lists?.[0] || {}
  const remoteList = remote.lists?.[0] || {}
  const listTemplate = localIsNewer ? localList : remoteList
  const items = mergeItemArrays(
    baseList.items,
    localList.items,
    remoteList.items,
    deletedListItems,
    localTime,
    remoteTime,
  )

  return {
    ...preferred,
    lists: [{ ...listTemplate, id: 'shopping-list', items }],
    purchases: mergeEntityArrays(base.purchases, local.purchases, remote.purchases),
    products: mergeEntityArrays(base.products, local.products, remote.products),
    markets: mergeEntityArrays(base.markets, local.markets, remote.markets),
    productMappings: mergeEntityArrays(base.productMappings, local.productMappings, remote.productMappings),
    productNormalizations: mergeEntityArrays(base.productNormalizations, local.productNormalizations, remote.productNormalizations),
    deletedListItems,
    updatedAt: localIsNewer ? localTime : remoteTime,
  }
}

export function stampListChanges(current, next, changedAt) {
  const currentItems = current.lists?.[0]?.items || []
  const nextItems = next.lists?.[0]?.items || []
  if (same(currentItems, nextItems)) return next

  const currentMap = new Map(currentItems.map((item) => [itemKey(item), item]))
  const nextKeys = new Set(nextItems.map(itemKey))
  const existingTombstones = current.deletedListItems || []
  const removed = currentItems
    .filter((item) => !nextKeys.has(itemKey(item)))
    .map((item) => ({ id: itemKey(item), deletedAt: changedAt }))
  const deletedListItems = [...latestById([...existingTombstones, ...removed]).values()]
    .filter((entry) => !nextKeys.has(String(entry.id)) || currentMap.has(String(entry.id)))
  const items = nextItems.map((item) => same(item, currentMap.get(itemKey(item))) ? item : { ...item, updatedAt: changedAt })

  return {
    ...next,
    lists: (next.lists || []).map((list, index) => index === 0 ? { ...list, items, updatedAt: changedAt } : list),
    deletedListItems,
  }
}
