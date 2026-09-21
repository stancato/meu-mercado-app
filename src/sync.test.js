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

test('uma alteração local vence o remoto inalterado mesmo com relógio atrasado', () => {
  const original = { id: 'arroz', name: 'Arroz', checked: false, updatedAt: '2026-08-21T10:00:00.000Z' }
  const changedWithSlowClock = { ...original, checked: true, updatedAt: '2026-08-21T09:59:00.000Z' }
  const base = state([original], '2026-08-21T10:00:00.000Z')
  const local = state([changedWithSlowClock], '2026-08-21T09:59:00.000Z')
  const merged = mergeSyncedStates(base, local, base)
  assert.equal(merged.lists[0].items[0].checked, true)
})

test('produto com variedades atualizado remotamente vence cache local defasado sem base comum', () => {
  const localStaleProduct = {
    id: 'prod-leite',
    name: 'Leite',
    variants: [],
    updatedAt: '2026-08-21T10:00:00.000Z',
  }
  const remoteUpdatedProduct = {
    id: 'prod-leite',
    name: 'Leite',
    variants: [
      { id: 'var-desnatado', variety: 'Desnatado', brand: 'Piracanjuba' },
      { id: 'var-integral', variety: 'Integral', brand: 'Piracanjuba' },
    ],
    updatedAt: '2026-08-21T10:15:00.000Z',
  }
  const localState = state([], '2026-08-21T10:00:00.000Z', { products: [localStaleProduct] })
  const remoteState = state([], '2026-08-21T10:15:00.000Z', { products: [remoteUpdatedProduct] })

  // Na hidratação inicial onde base é vazia, o produto remoto mais recente deve prevalecer
  const merged = mergeSyncedStates({}, localState, remoteState)
  assert.equal(merged.products.length, 1)
  assert.equal(merged.products[0].variants.length, 2)
  assert.equal(merged.products[0].variants[0].variety, 'Desnatado')
})

test('produto editado localmente com timestamp mais recente prevalece sobre cópia remota', () => {
  const remoteProduct = {
    id: 'prod-cafe',
    name: 'Café',
    variants: [{ id: 'var-1', variety: 'Tradicional' }],
    updatedAt: '2026-08-21T10:00:00.000Z',
  }
  const localProduct = {
    id: 'prod-cafe',
    name: 'Café',
    variants: [
      { id: 'var-1', variety: 'Tradicional' },
      { id: 'var-2', variety: 'Extra Forte' },
    ],
    updatedAt: '2026-08-21T10:30:00.000Z',
  }
  const localState = state([], '2026-08-21T10:30:00.000Z', { products: [localProduct] })
  const remoteState = state([], '2026-08-21T10:00:00.000Z', { products: [remoteProduct] })

  const merged = mergeSyncedStates({}, localState, remoteState)
  assert.equal(merged.products[0].variants.length, 2)
})

