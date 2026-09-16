import test from 'node:test'
import assert from 'node:assert/strict'
import { parseJsonInput, mergeProductVariants, promoteVariantToProduct, updatePurchaseItem } from './data.js'

test('parseJsonInput interpreta JSON padrão', () => {
  const json = '{"mercado": {"nome": "Extra"}, "itens": [{"produto": "Arroz", "precoTotal": 20}]}'
  const result = parseJsonInput(json)
  assert.equal(result.mercado.nome, 'Extra')
  assert.equal(result.itens[0].produto, 'Arroz')
})

test('parseJsonInput interpreta JSON com aspas curvas/inteligentes', () => {
  const json = '{\n  “mercado”: {\n    “nome”: “Pão de Açúcar”\n  },\n  “itens”: [\n    {\n      “produto”: “Leite”, “precoTotal”: 5.5\n    }\n  ]\n}'
  const result = parseJsonInput(json)
  assert.equal(result.mercado.nome, 'Pão de Açúcar')
  assert.equal(result.itens[0].produto, 'Leite')
})

test('parseJsonInput interpreta JSON com aspas simples', () => {
  const json = "{\n  'mercado': {\n    'nome': 'Carrefour'\n  },\n  'itens': [\n    {\n      'produto': 'Café', 'precoTotal': 15\n    }\n  ]\n}"
  const result = parseJsonInput(json)
  assert.equal(result.mercado.nome, 'Carrefour')
  assert.equal(result.itens[0].produto, 'Café')
})

test('parseJsonInput extrai JSON cercado de markdown e texto explicativo', () => {
  const text = `Aqui está o JSON solicitado da sua nota fiscal:
\`\`\`json
{
  "mercado": { "nome": "Assaí Atacadista" },
  "itens": [{ "produto": "Feijão", "precoTotal": 8.90 }]
}
\`\`\`
Espero ter ajudado!`
  const result = parseJsonInput(text)
  assert.equal(result.mercado.nome, 'Assaí Atacadista')
  assert.equal(result.itens[0].produto, 'Feijão')
})

test('parseJsonInput suporta virgulas sobressalentes (trailing commas)', () => {
  const json = '{\n  "mercado": {\n    "nome": "Dia",\n  },\n  "itens": [\n    {\n      "produto": "Biscoito",\n      "precoTotal": 3.20,\n    },\n  ],\n}'
  const result = parseJsonInput(json)
  assert.equal(result.mercado.nome, 'Dia')
  assert.equal(result.itens[0].produto, 'Biscoito')
})

test('parseJsonInput suporta chaves sem aspas e comentarios', () => {
  const json = `// Informações da compra
{
  mercado: {
    nome: "Supermercado BH" /* filial centro */
  },
  itens: [
    { produto: "Maçã", precoTotal: 6.50 }
  ]
}`
  const result = parseJsonInput(json)
  assert.equal(result.mercado.nome, 'Supermercado BH')
  assert.equal(result.itens[0].produto, 'Maçã')
})

test('mergeProductVariants unifica duas variações no produto, compras, listas e mapeamentos', () => {
  const initialState = {
    products: [
      {
        id: 'prod-leite',
        name: 'Leite',
        category: 'Frios',
        defaultUnit: 'un',
        brands: ['Piracanjuba', 'Itambé'],
        variants: [
          { id: 'var-integral', variety: 'Integral', brand: 'Piracanjuba', packageSize: 1, packageUnit: 'L' },
          { id: 'var-int', variety: 'Int', brand: 'Piracanjuba', packageSize: 1, packageUnit: 'L' },
        ],
      },
    ],
    purchases: [
      {
        id: 'purch-1',
        purchasedAt: '2026-03-01T10:00:00Z',
        marketName: 'Mercado A',
        items: [
          { id: 'item-1', productId: 'prod-leite', productName: 'Leite', variantId: 'var-int', variety: 'Int', brand: 'Piracanjuba', packageSize: 1, packageUnit: 'L', unitPrice: 4.5, totalPrice: 4.5, quantity: 1 },
        ],
      },
    ],
    lists: [
      {
        id: 'list-1',
        items: [
          { id: 'list-item-1', productId: 'prod-leite', name: 'Leite', variantId: 'var-int', variety: 'Int', brand: 'Piracanjuba', packageSize: 1, packageUnit: 'L', quantity: 2, unit: 'un' },
        ],
      },
    ],
    productMappings: [
      { id: 'map-1', sourceKey: 'leite int', productId: 'prod-leite', variantId: 'var-int' },
    ],
  }

  const nextState = mergeProductVariants(initialState, {
    productId: 'prod-leite',
    sourceVariantId: 'var-int',
    targetVariantId: 'var-integral',
  })

  const prod = nextState.products.find((p) => p.id === 'prod-leite')
  assert.equal(prod.variants.length, 1)
  assert.equal(prod.variants[0].id, 'var-integral')
  assert.equal(prod.variants[0].variety, 'Integral')

  assert.equal(nextState.purchases[0].items[0].variantId, 'var-integral')
  assert.equal(nextState.purchases[0].items[0].variety, 'Integral')

  assert.equal(nextState.lists[0].items[0].variantId, 'var-integral')
  assert.equal(nextState.lists[0].items[0].variety, 'Integral')

  assert.equal(nextState.productMappings[0].variantId, 'var-integral')
})

test('promoteVariantToProduct cria novo produto e move compras, listas e mapeamentos', () => {
  const initialState = {
    products: [
      {
        id: 'prod-leite',
        name: 'Leite',
        category: 'Frios',
        defaultUnit: 'un',
        brands: ['Piracanjuba', 'Moça'],
        variants: [
          { id: 'var-integral', variety: 'Integral', brand: 'Piracanjuba', packageSize: 1, packageUnit: 'L' },
          { id: 'var-condensado', variety: 'Condensado', brand: 'Moça', packageSize: 395, packageUnit: 'g' },
        ],
      },
    ],
    purchases: [
      {
        id: 'purch-1',
        purchasedAt: '2026-03-01T10:00:00Z',
        marketName: 'Mercado A',
        items: [
          { id: 'item-1', productId: 'prod-leite', productName: 'Leite', variantId: 'var-condensado', variety: 'Condensado', brand: 'Moça', packageSize: 395, packageUnit: 'g', unitPrice: 7.9, totalPrice: 7.9, quantity: 1 },
        ],
      },
    ],
    lists: [
      {
        id: 'list-1',
        items: [
          { id: 'list-item-1', productId: 'prod-leite', name: 'Leite', variantId: 'var-condensado', variety: 'Condensado', brand: 'Moça', packageSize: 395, packageUnit: 'g', quantity: 1, unit: 'un' },
        ],
      },
    ],
    productMappings: [
      { id: 'map-1', sourceKey: 'leite moca cond', productId: 'prod-leite', variantId: 'var-condensado' },
    ],
  }

  const nextState = promoteVariantToProduct(initialState, {
    sourceProductId: 'prod-leite',
    variantId: 'var-condensado',
    newProduct: {
      name: 'Leite Condensado',
      category: 'Mercearia',
      defaultUnit: 'un',
      variantVariety: 'Tradicional',
    },
  })

  const oldProd = nextState.products.find((p) => p.id === 'prod-leite')
  assert.equal(oldProd.variants.length, 1)
  assert.equal(oldProd.variants[0].variety, 'Integral')

  const newProd = nextState.products.find((p) => p.name === 'Leite Condensado')
  assert.ok(newProd)
  assert.equal(newProd.category, 'Mercearia')
  assert.equal(newProd.variants.length, 1)
  assert.equal(newProd.variants[0].variety, 'Tradicional')
  assert.equal(newProd.variants[0].brand, 'Moça')

  const purchaseItem = nextState.purchases[0].items[0]
  assert.equal(purchaseItem.productId, newProd.id)
  assert.equal(purchaseItem.productName, 'Leite Condensado')
  assert.equal(purchaseItem.variantId, newProd.variants[0].id)
  assert.equal(purchaseItem.variety, 'Tradicional')

  const listItem = nextState.lists[0].items[0]
  assert.equal(listItem.productId, newProd.id)
  assert.equal(listItem.name, 'Leite Condensado')
  assert.equal(listItem.variantId, newProd.variants[0].id)

  const mapping = nextState.productMappings[0]
  assert.equal(mapping.productId, newProd.id)
  assert.equal(mapping.variantId, newProd.variants[0].id)
})

test('updatePurchaseItem cria nova variedade no produto e atualiza historico e totais', () => {
  const initialState = {
    products: [
      {
        id: 'prod-chocolate',
        name: 'Chocolate',
        category: 'Mercearia',
        defaultUnit: 'un',
        brands: ['Garoto'],
        variants: [
          { id: 'var-ao-leite', variety: 'Ao Leite', brand: 'Garoto', packageSize: 80, packageUnit: 'g', lastPrice: 6.0 },
        ],
      },
    ],
    purchases: [
      {
        id: 'purch-1',
        marketId: 'm-1',
        marketName: 'Mercado Bom',
        purchasedAt: '2026-03-01T10:00:00Z',
        total: 7.5,
        items: [
          {
            id: 'item-1',
            productId: 'prod-chocolate',
            productName: 'Chocolate',
            variantId: '',
            variety: 'Amargo',
            brand: "Hershey's",
            packageSize: 75,
            packageUnit: 'g',
            quantity: 1,
            unitPrice: 7.5,
            totalPrice: 7.5,
            originalDescription: "CHOC HERSHEYS AMARGO 75G",
          },
        ],
      },
    ],
    markets: [{ id: 'm-1', name: 'Mercado Bom' }],
    lists: [],
    productMappings: [],
  }

  const nextState = updatePurchaseItem(initialState, {
    purchaseId: 'purch-1',
    itemId: 'item-1',
    targetProductId: 'prod-chocolate',
    targetVariantId: 'new',
    itemData: {
      productName: 'Chocolate',
      variety: 'Amargo',
      brand: "Hershey's",
      category: 'Mercearia',
      packageSize: 75,
      packageUnit: 'g',
      quantity: 2,
      unitPrice: 7.5,
      totalPrice: 15.0,
      barcode: '7891234567890',
    },
    createVariantInProduct: true,
  })

  const prod = nextState.products.find((p) => p.id === 'prod-chocolate')
  assert.equal(prod.variants.length, 2)
  const newVariant = prod.variants.find((v) => v.variety === 'Amargo')
  assert.ok(newVariant)
  assert.equal(newVariant.brand, "Hershey's")
  assert.equal(newVariant.packageSize, 75)
  assert.equal(newVariant.packageUnit, 'g')
  assert.equal(newVariant.lastPrice, 7.5)

  const updatedPurchase = nextState.purchases[0]
  assert.equal(updatedPurchase.total, 15.0)
  assert.equal(updatedPurchase.items[0].variantId, newVariant.id)
  assert.equal(updatedPurchase.items[0].quantity, 2)
  assert.equal(updatedPurchase.items[0].totalPrice, 15.0)
  assert.equal(updatedPurchase.items[0].barcode, '7891234567890')

  assert.equal(nextState.productMappings.length, 1)
  assert.equal(nextState.productMappings[0].variantId, newVariant.id)
  assert.equal(nextState.productMappings[0].productId, 'prod-chocolate')
})

test('updatePurchaseItem remapeia item para outro produto existente', () => {
  const initialState = {
    products: [
      {
        id: 'prod-biscoito',
        name: 'Biscoito',
        category: 'Mercearia',
        defaultUnit: 'pacote',
        brands: ['Bauducco'],
        variants: [{ id: 'var-wafer', variety: 'Wafer', brand: 'Bauducco', packageSize: 140, packageUnit: 'g' }],
      },
      {
        id: 'prod-chocolate',
        name: 'Chocolate',
        category: 'Mercearia',
        defaultUnit: 'un',
        brands: ['Nestlé'],
        variants: [{ id: 'var-nestle', variety: 'Ao Leite', brand: 'Nestlé', packageSize: 90, packageUnit: 'g' }],
      },
    ],
    purchases: [
      {
        id: 'purch-1',
        marketName: 'Mercado A',
        purchasedAt: '2026-03-01T10:00:00Z',
        total: 5.0,
        items: [
          {
            id: 'item-1',
            productId: 'prod-biscoito',
            productName: 'Biscoito',
            variantId: 'var-wafer',
            variety: 'Wafer',
            brand: 'Bauducco',
            packageSize: 140,
            packageUnit: 'g',
            quantity: 1,
            unitPrice: 5.0,
            totalPrice: 5.0,
          },
        ],
      },
    ],
    markets: [],
    lists: [],
    productMappings: [],
  }

  const nextState = updatePurchaseItem(initialState, {
    purchaseId: 'purch-1',
    itemId: 'item-1',
    targetProductId: 'prod-chocolate',
    targetVariantId: 'var-nestle',
    itemData: {
      productName: 'Chocolate',
      variety: 'Ao Leite',
      brand: 'Nestlé',
      category: 'Mercearia',
      packageSize: 90,
      packageUnit: 'g',
      quantity: 1,
      unitPrice: 6.5,
      totalPrice: 6.5,
    },
  })

  assert.equal(nextState.purchases[0].items[0].productId, 'prod-chocolate')
  assert.equal(nextState.purchases[0].items[0].productName, 'Chocolate')
  assert.equal(nextState.purchases[0].items[0].variantId, 'var-nestle')
  assert.equal(nextState.purchases[0].total, 6.5)
})


