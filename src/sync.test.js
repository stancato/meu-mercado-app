import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeSyncedStates, stampListChanges } from './sync.js'

const state = (items, updatedAt, extra = {}) => ({
  lists: [{ id: 'shopping-list', items }],
  purchases: [],
  products: [],
  markets: [],
  productMappings: [],
  productNormalizations: [],
  deletedListItems: [],
  updatedAt,
  ...extra,
})

test('preserva itens adicionados em aparelhos diferentes', () => {
  const local = state([{ id: 'arroz', name: 'Arroz' }], '2026-08-21T10:00:00.000Z')
  const remote = state([{ id: 'feijao', name: 'Feijão' }], '2026-08-21T10:01:00.000Z')
  const merged = mergeSyncedStates({}, local, remote)
  assert.deepEqual(merged.lists[0].items.map((item) => item.id).sort(), ['arroz', 'feijao'])
})

test('uma exclusão intencional não é desfeita por um aparelho desatualizado', () => {
  const original = { id: 'arroz', name: 'Arroz', updatedAt: '2026-08-21T10:00:00.000Z' }
  const base = state([original], '2026-08-21T10:00:00.000Z')
  const local = stampListChanges(base, state([], '2026-08-21T10:00:00.000Z'), '2026-08-21T10:02:00.000Z')
  local.updatedAt = '2026-08-21T10:02:00.000Z'
  const merged = mergeSyncedStates(base, local, base)
  assert.deepEqual(merged.lists[0].items, [])
  assert.equal(merged.deletedListItems[0].id, 'arroz')
})

test('uma alteração remota vence a cópia local que não mudou', () => {
  const original = { id: 'arroz', name: 'Arroz', checked: false, updatedAt: '2026-08-21T10:00:00.000Z' }
  const changed = { ...original, checked: true, updatedAt: '2026-08-21T10:03:00.000Z' }
  const base = state([original], '2026-08-21T10:00:00.000Z')
  const remote = state([changed], '2026-08-21T10:03:00.000Z')
  const merged = mergeSyncedStates(base, base, remote)
  assert.equal(merged.lists[0].items[0].checked, true)
})
