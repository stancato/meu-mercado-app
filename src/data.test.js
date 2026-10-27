import test from 'node:test'
import assert from 'node:assert/strict'
import { parseJsonInput, mergeProductVariants, promoteVariantToProduct, updatePurchaseItem, parseNfceHtml, isValidNfceHtml, normalizeImport, findMatchingVariant, levenshteinDistance, findDuplicateProductSuggestions, mergeCatalogProducts, buildDismissedPairKey, findPeriodicitySuggestions, calculateHistoryPeriodicity, nextPurchaseSuggestions } from './data.js'

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
  assert.equal(nextState.productMappings[0].sourceKey, 'barcode:7891234567890')
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

test('parseNfceHtml suporta layout mobile QR Code (txtTit2, entidades HTML) e texto plano copiado da SEFAZ', () => {
  const mobileHtml = `
    <div class="txtTopo">MERCADO EXEMPLO LTDA</div>
    <div class="text">CNPJ: 12.345.678/0001-99</div>
    <table>
      <tr class="linha" id="Item + 1">
        <td>
          <span class="txtTit2">LEITE INTEGRAL 1L</span>
          <span class="RCod">(C&oacute;digo: 7891000)</span>
          <span class="Rqtd"><strong>Qtde.:</strong>&nbsp;2</span>
          <span class="RUN"><strong>UN: </strong>L</span>
          <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;5,49</span>
        </td>
        <td><span class="valor">10,98</span></td>
      </tr>
    </table>
    <div><strong>N&uacute;mero: </strong>1234 <strong>Emiss&atilde;o: </strong>20/10/2026 14:30:00</div>
    <div><label>Valor a pagar R$:</label><span class="totalNumb">10,98</span></div>
  `
  const fromMobileHtml = parseNfceHtml(mobileHtml)
  assert.equal(fromMobileHtml.mercado.nome, 'MERCADO EXEMPLO LTDA')
  assert.equal(fromMobileHtml.itens.length, 1)
  assert.equal(fromMobileHtml.itens[0].produto, 'LEITE INTEGRAL 1L')
  assert.equal(fromMobileHtml.itens[0].quantidadeComprada, 2)
  assert.equal(fromMobileHtml.itens[0].unidadeConteudo, 'L')
  assert.equal(fromMobileHtml.itens[0].precoTotal, 10.98)

  const copiedText = `
    DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA
    SUPERMERCADO CENTRAL
    CNPJ: 11.222.333/0001-44
    RUA DAS FLORES, 100, CENTRO
    ARROZ TIPO 1 5KG (Código: 102030)
    Qtde.: 1 UN: UN Vl. Unit.: 28,90 Vl. Total 28,90
    BANANA NANICA (Código: 4050)
    Qtde.: 1,250 UN: KG Vl. Unit.: 6,00 Vl. Total 7,50
    Valor a pagar R$: 36,40
    Número: 9876 Série: 1 Emissão: 25/10/2026 09:15:00
  `
  const fromPlainText = parseNfceHtml(copiedText)
  assert.equal(fromPlainText.mercado.nome, 'SUPERMERCADO CENTRAL')
  assert.equal(fromPlainText.mercado.cnpj, '11222333000144')
  assert.equal(fromPlainText.compra.valorTotal, 36.40)
  assert.equal(fromPlainText.compra.numeroDocumento, '9876')
  assert.equal(fromPlainText.itens.length, 2)
  assert.equal(fromPlainText.itens[0].produto, 'ARROZ TIPO 1 5KG')
  assert.equal(fromPlainText.itens[0].precoTotal, 28.90)
  assert.equal(fromPlainText.itens[1].produto, 'BANANA NANICA')
  assert.equal(fromPlainText.itens[1].unidadeConteudo, 'kg')
  assert.equal(fromPlainText.itens[1].quantidadeComprada, 1.25)
  assert.equal(fromPlainText.itens[1].precoTotal, 7.50)
})

test('isValidNfceHtml rejeita index.html do SPA e páginas de erro Cloudflare 522', () => {
  const spaIndex = '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.jsx"></script>' + 'a'.repeat(800) + '</body></html>'
  assert.equal(isValidNfceHtml(spaIndex), false)

  const cfError = '<!DOCTYPE html><html><body><div id="cf-error-details">Error 522 Connection timed out</div>' + 'b'.repeat(800) + '</body></html>'
  assert.equal(isValidNfceHtml(cfError), false)

  const validNfce = '<table id="tabResult"><tr id="Item + 1"><span class="txtTit2">CAFE</span></tr></table>'
  assert.equal(isValidNfceHtml(validNfce), true)
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

test('findDuplicateProductSuggestions ignora produtos arquivados e pares dispensados (inclusive via dismissedMergePairs)', () => {
  const products = [
    { id: 'p1', name: 'Leite', category: 'Frios', variants: [] },
    { id: 'p2', name: 'Leite Integral', category: 'Frios', variants: [] },
    { id: 'p3', name: 'Leite Desnatado', category: 'Frios', archivedAt: '2026-01-01T00:00:00Z', variants: [] },
  ]
  const dismissedPairIds = new Set([[ 'p1', 'p2' ].sort().join('::')])
  assert.equal(findDuplicateProductSuggestions(products, { dismissedPairIds }).length, 0)

  // Usando a lista persistida dismissedMergePairs (por ID ou por nome)
  const dismissedMergePairs = [
    { id: buildDismissedPairKey('other-1', 'other-2'), leftId: 'other-1', rightId: 'other-2', leftName: 'Leite', rightName: 'Leite Integral', dismissed: true },
  ]
  assert.equal(findDuplicateProductSuggestions(products, { dismissedMergePairs }).length, 0)

  // Quando restaurado (dismissed: false), volta a sugerir
  const restoredPairs = [
    { id: buildDismissedPairKey('p1', 'p2'), leftId: 'p1', rightId: 'p2', leftName: 'Leite', rightName: 'Leite Integral', dismissed: false },
  ]
  assert.equal(findDuplicateProductSuggestions(products, { dismissedMergePairs: restoredPairs }).length, 1)
})

test('findDuplicateProductSuggestions evita falsos positivos comuns de produtos distintos', () => {
  const products = [
    { id: 'p-leite', name: 'Leite', category: 'Frios', variants: [] },
    { id: 'p-leite-cond', name: 'Leite Condensado', category: 'Mercearia', variants: [] },
    { id: 'p-queijo', name: 'Queijo', category: 'Frios', variants: [] },
    { id: 'p-pao-queijo', name: 'Pão de queijo', category: 'Frios', variants: [] },
    { id: 'p-tomate', name: 'Tomate', category: 'Hortifruti', variants: [] },
    { id: 'p-molho-tomate', name: 'Molho de tomate', category: 'Mercearia', variants: [] },
    { id: 'p-papel-hig', name: 'Papel higiênico', category: 'Higiene', variants: [] },
    { id: 'p-papel-toalha', name: 'Papel-toalha', category: 'Limpeza', variants: [] },
    { id: 'p-pera', name: 'Pera', category: 'Hortifruti', variants: [] },
    { id: 'p-cera', name: 'Cera', category: 'Limpeza', variants: [] },
  ]
  const suggestions = findDuplicateProductSuggestions(products)
  assert.equal(suggestions.length, 0)
})

test('mergeCatalogProducts unifica produtos, preserva historico de compras, atualiza updatedAt no arquivado e recalcula metadados', () => {
  const initialState = {
    products: [
      { id: 'p-cafe', name: 'Café', category: 'Mercearia', defaultUnit: 'pacote', variants: [], updatedAt: '2026-01-01T00:00:00Z' },
      { id: 'p-cafe-pilao', name: 'Café Pilão', category: 'Mercearia', defaultUnit: 'pacote', variants: [], updatedAt: '2026-01-01T00:00:00Z' },
    ],
    purchases: [
      {
        id: 'purch-1',
        marketId: 'm1',
        marketName: 'Mercado X',
        purchasedAt: '2026-03-10T12:00:00Z',
        total: 18.9,
        items: [
          { id: 'i1', productId: 'p-cafe-pilao', productName: 'Café Pilão', variety: '', brand: 'Pilão', packageSize: 500, packageUnit: 'g', quantity: 1, unitPrice: 18.9, totalPrice: 18.9 },
        ],
      },
    ],
    lists: [
      {
        id: 'list-1',
        items: [
          { id: 'li-1', productId: 'p-cafe', name: 'Café', quantity: 1, unit: 'pacote', category: 'Mercearia' },
          { id: 'li-2', productId: 'p-cafe-pilao', name: 'Café Pilão', quantity: 2, unit: 'pacote', category: 'Mercearia' },
        ],
      },
    ],
    productMappings: [
      { id: 'map-1', sourceKey: 'description:cafe pilao 500g', productId: 'p-cafe-pilao', variantId: '' },
    ],
    productNormalizations: [],
  }

  const nextState = mergeCatalogProducts(initialState, {
    leftId: 'p-cafe',
    rightId: 'p-cafe-pilao',
    mode: 'variant',
    variantValue: 'Pilão',
    result: { name: 'Café', category: 'Mercearia', defaultUnit: 'pacote' },
  })

  const mainProduct = nextState.products.find((p) => p.id === 'p-cafe')
  const archivedProduct = nextState.products.find((p) => p.id === 'p-cafe-pilao')

  assert.equal(mainProduct.archivedAt, null)
  assert.ok(mainProduct.aliases.includes('Café Pilão'))
  assert.equal(mainProduct.variants.length, 1)
  assert.equal(mainProduct.variants[0].variety, 'Pilão')
  assert.equal(mainProduct.variants[0].lastPrice, 18.9)
  assert.equal(mainProduct.variants[0].lastMarketName, 'Mercado X')

  assert.ok(archivedProduct.archivedAt)
  assert.equal(archivedProduct.mergedIntoId, 'p-cafe')
  assert.notEqual(archivedProduct.updatedAt, '2026-01-01T00:00:00Z')

  assert.equal(nextState.purchases[0].items[0].productId, 'p-cafe')
  assert.equal(nextState.purchases[0].items[0].productName, 'Café')
  assert.equal(nextState.purchases[0].items[0].variety, 'Pilão')
  assert.equal(nextState.purchases[0].items[0].variantId, mainProduct.variants[0].id)

  assert.equal(nextState.lists[0].items.length, 1)
  assert.equal(nextState.lists[0].items[0].quantity, 3)

  assert.equal(nextState.productMappings[0].productId, 'p-cafe')
})

test('findPeriodicitySuggestions detecta compras semanais e ignora sugestões dispensadas ou iguais', () => {
  const products = [
    { id: 'p-pao', name: 'Pão', category: 'Mercearia', recurrenceDays: null, dismissedRecurrenceSuggestion: null },
    { id: 'p-leite', name: 'Leite', category: 'Laticínios', recurrenceDays: 7, dismissedRecurrenceSuggestion: null },
    { id: 'p-cafe', name: 'Café', category: 'Mercearia', recurrenceDays: null, dismissedRecurrenceSuggestion: 14 },
  ]

  const purchases = [
    {
      id: 'pur-1',
      purchasedAt: '2026-10-01T10:00:00Z',
      items: [
        { id: 'i1', productId: 'p-pao', productName: 'Pão', totalPrice: 8.5 },
        { id: 'i2', productId: 'p-pao', productName: 'Pão', totalPrice: 8.5 }, // mesmo dia, deve deduplicar
        { id: 'i3', productId: 'p-leite', productName: 'Leite', totalPrice: 5.5 },
        { id: 'i4', productId: 'p-cafe', productName: 'Café', totalPrice: 18.0 },
      ],
    },
    {
      id: 'pur-2',
      purchasedAt: '2026-10-08T10:00:00Z',
      items: [
        { id: 'i5', productId: 'p-pao', productName: 'Pão', totalPrice: 9.0 },
        { id: 'i6', productId: 'p-leite', productName: 'Leite', totalPrice: 5.8 },
      ],
    },
    {
      id: 'pur-3',
      purchasedAt: '2026-10-15T10:00:00Z',
      items: [
        { id: 'i7', productId: 'p-pao', productName: 'Pão', totalPrice: 8.9 },
        { id: 'i8', productId: 'p-cafe', productName: 'Café', totalPrice: 18.5 },
      ],
    },
  ]

  const state = { products, purchases }
  const paoHistory = calculateHistoryPeriodicity(state, products[0])
  assert.equal(paoHistory.purchaseCount, 3)
  assert.equal(paoHistory.days, 7)

  const suggestions = findPeriodicitySuggestions(state)
  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0].product.id, 'p-pao')
  assert.equal(suggestions[0].currentDays, 30) // padrão de Mercearia
  assert.equal(suggestions[0].suggestedDays, 7)
  assert.equal(suggestions[0].suggestedLabel, 'Semanal')
})

test('nextPurchaseSuggestions retorna apenas itens para a próxima compra (<= 7 dias) que não estão na lista', () => {
  const now = new Date()
  const sixDaysAgo = new Date(now.getTime() - 6 * 86400000).toISOString()
  const thirteenDaysAgo = new Date(now.getTime() - 13 * 86400000).toISOString()
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString()

  const products = [
    { id: 'p-pao', name: 'Pão', category: 'Mercearia', defaultUnit: 'pacote', recurrenceDays: null },
    { id: 'p-arroz', name: 'Arroz', category: 'Mercearia', defaultUnit: 'pacote', recurrenceDays: 30 },
    { id: 'p-leite', name: 'Leite', category: 'Laticínios', defaultUnit: 'caixa', recurrenceDays: 7 },
  ]

  const purchases = [
    {
      id: 'pur-old',
      purchasedAt: thirteenDaysAgo,
      items: [
        { id: 'i1', productId: 'p-pao', productName: 'Pão', totalPrice: 8.5 },
      ],
    },
    {
      id: 'pur-recent',
      purchasedAt: sixDaysAgo,
      items: [
        { id: 'i2', productId: 'p-pao', productName: 'Pão', totalPrice: 9.0 },
        { id: 'i3', productId: 'p-leite', productName: 'Leite', totalPrice: 5.5 },
      ],
    },
    {
      id: 'pur-very-recent',
      purchasedAt: twoDaysAgo,
      items: [
        { id: 'i4', productId: 'p-arroz', productName: 'Arroz', totalPrice: 25.0 },
      ],
    },
  ]

  // Leite já está na lista de compras; Arroz falta ~28 dias; Pão tem histórico semanal (comprado há 6 dias -> falta 1 dia)
  const list = {
    items: [
      { id: 'li-1', productId: 'p-leite', name: 'Leite' },
    ],
  }

  const suggestions = nextPurchaseSuggestions({ products, purchases }, list, now)
  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0].id, 'p-pao')
})

