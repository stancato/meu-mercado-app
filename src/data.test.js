import test from 'node:test'
import assert from 'node:assert/strict'
import { parseJsonInput, mergeProductVariants, promoteVariantToProduct, updatePurchaseItem, parseNfceHtml, normalizeImport, findMatchingVariant, levenshteinDistance, findDuplicateProductSuggestions } from './data.js'

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

test('parseNfceHtml extrai dados do estabelecimento, itens, valores e data da NFC-e SEFAZ SP', () => {
  const sampleHtml = `
    <div id="u20" class="txtTopo">SUPERMERCADOS DALBEN LTDA</div>
    <div class="text">CNPJ: 46.241.741/0004-08</div>
    <div class="text">AV. ALBINO J B DE OLIVEIRA, 511, BARAO GERALDO, CAMPINAS, SP</div>
    <table id="tabResult">
      <tr id="Item + 1">
        <td>
          <span class="txtTit">SANSEVIEIRA VEILING P12</span>
          <span class="RCod">(Código: 59704)</span>
          <span class="Rqtd"><strong>Qtde.:</strong>1</span>
          <span class="RUN"><strong>UN: </strong>UN</span>
          <span class="RvlUnit"><strong>Vl. Unit.:</strong> 24,99</span>
        </td>
        <td class="txtTit"><span class="valor">24,99</span></td>
      </tr>
      <tr id="Item + 2">
        <td>
          <span class="txtTit">PAO FRANCES Kg</span>
          <span class="RCod">(Código: 608)</span>
          <span class="Rqtd"><strong>Qtde.:</strong>0,488</span>
          <span class="RUN"><strong>UN: </strong>KG</span>
          <span class="RvlUnit"><strong>Vl. Unit.:</strong> 19,99</span>
        </td>
        <td class="txtTit"><span class="valor">9,76</span></td>
      </tr>
    </table>
    <div id="linhaTotal" class="linhaShade">
      <label>Valor a pagar R$:</label>
      <span class="totalNumb txtMax">34,75</span>
    </div>
    <div id="infos">
      <strong>Número: </strong>71304<strong> Série: </strong>209<strong> Emissão: </strong>19/09/2026 10:03:57
    </div>
  `

  const result = parseNfceHtml(sampleHtml)
  assert.equal(result.mercado.nome, 'SUPERMERCADOS DALBEN LTDA')
  assert.equal(result.mercado.cnpj, '46241741000408')
  assert.ok(result.mercado.endereco.includes('CAMPINAS'))
  assert.equal(result.compra.numeroDocumento, '71304')
  assert.equal(result.compra.data, '2026-09-19T10:03:57')
  assert.equal(result.compra.valorTotal, 34.75)
  assert.equal(result.itens.length, 2)

  // Item 1
  assert.equal(result.itens[0].produto, 'SANSEVIEIRA VEILING P12')
  assert.equal(result.itens[0].codigoBarras, '59704')
  assert.equal(result.itens[0].quantidadeComprada, 1)
  assert.equal(result.itens[0].precoUnitario, 24.99)
  assert.equal(result.itens[0].precoTotal, 24.99)
  assert.equal(result.itens[0].unidadeConteudo, 'un')

  // Item 2 (a granel / kg)
  assert.equal(result.itens[1].produto, 'PAO FRANCES Kg')
  assert.equal(result.itens[1].quantidadeComprada, 0.488)
  assert.equal(result.itens[1].unidadeConteudo, 'kg')
  assert.equal(result.itens[1].precoTotal, 9.76)

  // Compatibilidade com normalizeImport
  const normalized = normalizeImport(result)
  assert.equal(normalized.market.name, 'SUPERMERCADOS DALBEN LTDA')
  assert.equal(normalized.items.length, 2)
  assert.equal(normalized.items[0].productName, 'SANSEVIEIRA VEILING P12')
})

test('findMatchingVariant localiza variante por variantId ou por características (variedade, marca, embalagem)', () => {
  const product = {
    id: 'prod-1',
    name: 'Leite',
    variants: [
      { id: 'var-1', variety: 'Integral', brand: 'Italac', packageSize: 1, packageUnit: 'L' },
      { id: 'var-2', variety: 'Desnatado', brand: 'Piracanjuba', packageSize: 1, packageUnit: 'L' }
    ]
  }

  // Busca por variantId
  const matchById = findMatchingVariant(product, { variantId: 'var-2', variety: 'Outro', brand: 'Outro', packageSize: 1, packageUnit: 'L' })
  assert.equal(matchById?.id, 'var-2')

  // Busca por atributos coincidentes
  const matchByProps = findMatchingVariant(product, { variety: 'Integral', brand: 'Italac', packageSize: 1, packageUnit: 'L' })
  assert.equal(matchByProps?.id, 'var-1')

  // Variação inexistente
  const noMatch = findMatchingVariant(product, { variety: 'Sem Lactose', brand: 'Italac', packageSize: 1, packageUnit: 'L' })
  assert.equal(noMatch, undefined)

  // Entradas nulas ou indefinidas
  assert.equal(findMatchingVariant(null, {}), undefined)
  assert.equal(findMatchingVariant(product, null), undefined)
})

test('levenshteinDistance calcula a distância de edição entre palavras', () => {
  assert.equal(levenshteinDistance('feijao', 'feijao'), 0)
  assert.equal(levenshteinDistance('iogurte', 'iogurt'), 1)
  assert.equal(levenshteinDistance('sabonete', 'sabonte'), 1)
  assert.equal(levenshteinDistance('carne', 'frango'), 5)
  assert.equal(levenshteinDistance('', 'leite'), 5)
})

test('findDuplicateProductSuggestions detecta duplicatas com nomes normalizados idênticos', () => {
  const products = [
    { id: 'p1', name: 'Feijão Carioca', category: 'Mercearia', variants: [] },
    { id: 'p2', name: 'feijao carioca', category: 'Mercearia', variants: [] },
    { id: 'p3', name: 'Arroz Branco', category: 'Mercearia', variants: [] },
  ]
  const suggestions = findDuplicateProductSuggestions(products)
  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0].type, 'identical')
  assert.ok(suggestions[0].score >= 0.95)
  assert.equal(suggestions[0].confidence, 'high')
})

test('findDuplicateProductSuggestions detecta erros de digitação e pequenos desvios de nome', () => {
  const products = [
    { id: 'p1', name: 'Iogurte Natural', category: 'Frios', variants: [] },
    { id: 'p2', name: 'Iogurt Natural', category: 'Frios', variants: [] },
  ]
  const suggestions = findDuplicateProductSuggestions(products)
  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0].type, 'fuzzy')
  assert.equal(suggestions[0].confidence, 'high')
})

test('findDuplicateProductSuggestions detecta contenção de nomes (marca/sabor embutido)', () => {
  const products = [
    { id: 'p1', name: 'Café', category: 'Mercearia', variants: [] },
    { id: 'p2', name: 'Café Pilão', category: 'Mercearia', variants: [] },
    { id: 'p3', name: 'Detergente Neutro', category: 'Limpeza', variants: [] },
    { id: 'p4', name: 'Detergente', category: 'Limpeza', variants: [] },
  ]
  const suggestions = findDuplicateProductSuggestions(products)
  assert.equal(suggestions.length, 2)
  const cafeSuggestion = suggestions.find((s) => s.products.some((p) => p.name === 'Café'))
  assert.ok(cafeSuggestion)
  assert.equal(cafeSuggestion.type, 'containment')
  assert.equal(cafeSuggestion.products[0].name, 'Café')
  assert.equal(cafeSuggestion.products[1].name, 'Café Pilão')
})

test('findDuplicateProductSuggestions detecta produtos com mesmo código de barras', () => {
  const products = [
    { id: 'p1', name: 'Shampoo A', category: 'Higiene', variants: [{ id: 'v1', barcode: '7891234567890' }] },
    { id: 'p2', name: 'Shampoo Anticaspa', category: 'Higiene', variants: [{ id: 'v2', barcode: '7891234567890' }] },
  ]
  const suggestions = findDuplicateProductSuggestions(products)
  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0].type, 'barcode')
  assert.equal(suggestions[0].score, 1.0)
})

test('findDuplicateProductSuggestions ignora produtos arquivados e pares dispensados', () => {
  const products = [
    { id: 'p1', name: 'Leite', category: 'Frios', variants: [] },
    { id: 'p2', name: 'Leite Integral', category: 'Frios', variants: [] },
    { id: 'p3', name: 'Leite Desnatado', category: 'Frios', archivedAt: '2026-01-01T00:00:00Z', variants: [] },
  ]
  const dismissedPairIds = new Set([[ 'p1', 'p2' ].sort().join('::')])
  const suggestions = findDuplicateProductSuggestions(products, { dismissedPairIds })
  assert.equal(suggestions.length, 0)
})

