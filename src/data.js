export const CATEGORIES = ['Hortifruti', 'Mercearia', 'Frios', 'Carnes', 'Bebidas', 'Limpeza', 'Higiene', 'Outros']
export const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'pacote', 'caixa', 'dúzia']

const STARTER_PRODUCT_NAMES = [
  ['Arroz', 'Mercearia'], ['Feijão', 'Mercearia'], ['Café', 'Mercearia'], ['Açúcar', 'Mercearia'],
  ['Sal', 'Mercearia'], ['Óleo', 'Mercearia'], ['Azeite', 'Mercearia'], ['Macarrão', 'Mercearia'],
  ['Molho de tomate', 'Mercearia'], ['Farinha de trigo', 'Mercearia'], ['Leite', 'Frios'], ['Manteiga', 'Frios'],
  ['Queijo', 'Frios'], ['Presunto', 'Frios'], ['Iogurte', 'Frios'], ['Ovos', 'Frios'],
  ['Pão', 'Mercearia'], ['Bolacha', 'Mercearia'], ['Cereal', 'Mercearia'], ['Frango', 'Carnes'],
  ['Carne bovina', 'Carnes'], ['Peixe', 'Carnes'], ['Banana', 'Hortifruti'], ['Maçã', 'Hortifruti'],
  ['Laranja', 'Hortifruti'], ['Limão', 'Hortifruti'], ['Tomate', 'Hortifruti'], ['Cebola', 'Hortifruti'],
  ['Alho', 'Hortifruti'], ['Batata', 'Hortifruti'], ['Cenoura', 'Hortifruti'], ['Alface', 'Hortifruti'],
  ['Água', 'Bebidas'], ['Refrigerante', 'Bebidas'], ['Suco', 'Bebidas'], ['Cerveja', 'Bebidas'],
  ['Papel higiênico', 'Higiene'], ['Sabonete', 'Higiene'], ['Shampoo', 'Higiene'], ['Creme dental', 'Higiene'],
  ['Detergente', 'Limpeza'], ['Sabão em pó', 'Limpeza'], ['Amaciante', 'Limpeza'], ['Desinfetante', 'Limpeza'],
  ['Água sanitária', 'Limpeza'], ['Esponja', 'Limpeza'], ['Saco de lixo', 'Limpeza'], ['Papel-toalha', 'Limpeza'],
]

export function defaultUnitForProduct(name, category) {
  const normalized = String(name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  if (category === 'Carnes') return 'kg'
  if (category === 'Hortifruti') {
    if (['alface', 'alho'].includes(normalized)) return 'un'
    return 'kg'
  }
  if (normalized === 'ovos') return 'dúzia'
  if (['arroz', 'feijao', 'acucar', 'sal', 'macarrao', 'farinha de trigo', 'cafe', 'bolacha', 'cereal'].includes(normalized)) return 'pacote'
  if (['leite', 'agua', 'refrigerante', 'suco', 'cerveja', 'oleo', 'azeite'].includes(normalized)) return 'un'
  return 'un'
}

export const STARTER_PRODUCTS = STARTER_PRODUCT_NAMES.map(([name, category], index) => ({
  id: `starter-${index + 1}`,
  name,
  category,
  brands: [],
  variants: [],
  defaultUnit: defaultUnitForProduct(name, category),
  starter: true,
}))

export const initialState = {
  lists: [{ id: 'shopping-list', name: 'Lista de mercado', status: 'active', items: [], createdAt: null }],
  purchases: [],
  products: STARTER_PRODUCTS,
  productMappings: [],
  productNormalizations: [],
  markets: [],
  settings: { theme: 'system' },
  updatedAt: null,
}

export const uid = () => crypto.randomUUID()
export const nowIso = () => new Date().toISOString()
export const normalizeText = (value = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
export const onlyDigits = (value = '') => String(value).replace(/\D/g, '')
export const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0)
export const shortDate = (value, fallback = 'Data não informada') => {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return new Intl.DateTimeFormat('pt-BR').format(date)
}
export const dateTimeLocal = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16)
}

export function contentInBaseUnit(amount, unit) {
  const number = Number(amount)
  if (!Number.isFinite(number) || number <= 0) return null
  if (unit === 'kg' || unit === 'L') return { amount: number, unit }
  if (unit === 'g') return { amount: number / 1000, unit: 'kg' }
  if (unit === 'ml') return { amount: number / 1000, unit: 'L' }
  if (unit === 'un') return { amount: number, unit: 'un' }
  return null
}

export function normalizedPrice(item) {
  const content = contentInBaseUnit(item.packageSize, item.packageUnit)
  const quantity = Number(item.quantity) || 1
  if (!content || !Number(item.totalPrice)) return null
  return { value: Number(item.totalPrice) / (content.amount * quantity), unit: content.unit }
}

export function parseJsonInput(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(cleaned)
}

const pick = (object, keys, fallback = '') => keys.find((key) => object?.[key] !== undefined) ? object[keys.find((key) => object?.[key] !== undefined)] : fallback

export function normalizeImport(payload) {
  const market = pick(payload, ['mercado', 'market'], {})
  const purchase = pick(payload, ['compra', 'purchase'], {})
  const rawItems = pick(payload, ['itens', 'items'], [])
  if (!Array.isArray(rawItems) || !rawItems.length) throw new Error('O JSON não contém uma lista de itens.')
  const items = rawItems.map((item) => {
    const hasValue = (keys) => keys.some((key) => item?.[key] !== undefined && item[key] !== null && String(item[key]).trim() !== '')
    const missingFields = [
      [['produto', 'product'], 'productName'],
      [['quantidadeComprada', 'quantidade', 'quantity'], 'quantity'],
      [['conteudoEmbalagem', 'tamanhoEmbalagem', 'packageSize'], 'packageSize'],
      [['unidadeConteudo', 'unidadeEmbalagem', 'packageUnit'], 'packageUnit'],
      [['precoTotal', 'valorTotal', 'totalPrice'], 'totalPrice'],
      [['categoria', 'category'], 'category'],
    ].filter(([keys]) => !hasValue(keys)).map(([, field]) => field)
    const itemWarnings = pick(item, ['problemasPossiveis', 'avisos', 'warnings'], [])
    const quantity = Number(pick(item, ['quantidadeComprada', 'quantidade', 'quantity'], 1)) || 1
    const totalPrice = Number(pick(item, ['precoTotal', 'valorTotal', 'totalPrice'], 0)) || 0
    return {
      id: uid(),
      originalDescription: String(pick(item, ['descricaoOriginal', 'descricao', 'originalDescription'], '')),
      productName: String(pick(item, ['produto', 'product'], '') || pick(item, ['descricaoOriginal', 'descricao'], 'Item')),
      variety: String(pick(item, ['variedade', 'tipo', 'sabor', 'variety', 'flavor'], '')),
      brand: String(pick(item, ['marca', 'brand'], '')),
      quantity,
      packageSize: Number(pick(item, ['conteudoEmbalagem', 'tamanhoEmbalagem', 'packageSize'], 1)) || 1,
      packageUnit: String(pick(item, ['unidadeConteudo', 'unidadeEmbalagem', 'packageUnit'], 'un')),
      unitPrice: Number(pick(item, ['precoUnitario', 'unitPrice'], totalPrice / quantity)) || 0,
      totalPrice,
      barcode: String(pick(item, ['codigoBarras', 'gtin', 'barcode'], '') || ''),
      category: String(pick(item, ['categoria', 'category'], 'Outros')),
      importMissingFields: missingFields,
      importWarnings: Array.isArray(itemWarnings) ? itemWarnings.map(String).filter(Boolean) : String(itemWarnings || '').trim() ? [String(itemWarnings)] : [],
    }
  })
  const rawPurchaseDate = String(pick(purchase, ['data', 'date'], '') || '').trim()
  const parsedPurchaseDate = rawPurchaseDate ? new Date(rawPurchaseDate) : null
  const purchasedAt = parsedPurchaseDate && !Number.isNaN(parsedPurchaseDate.getTime())
    ? parsedPurchaseDate.toISOString()
    : nowIso()
  return {
    market: {
      name: String(pick(market, ['nome', 'name'], '') || '').trim() || 'Mercado não identificado',
      legalName: String(pick(market, ['razaoSocial', 'legalName'], '')),
      cnpj: onlyDigits(pick(market, ['cnpj'], '')),
      address: String(pick(market, ['endereco', 'address'], '')),
    },
    purchasedAt,
    purchaseDateInferred: !rawPurchaseDate || !parsedPurchaseDate || Number.isNaN(parsedPurchaseDate.getTime()),
    documentNumber: String(pick(purchase, ['numeroDocumento', 'documentNumber'], '')),
    declaredTotal: Number(pick(purchase, ['valorTotal', 'total'], 0)) || 0,
    importWarnings: (() => { const warnings = pick(payload, ['problemasPossiveis', 'avisos', 'warnings'], []); return Array.isArray(warnings) ? warnings.map(String).filter(Boolean) : String(warnings || '').trim() ? [String(warnings)] : [] })(),
    items,
  }
}

export const RECEIPT_PROMPT = `Analise a foto desta nota fiscal brasileira e responda SOMENTE com JSON válido, sem markdown e sem explicações.

Use exatamente este formato:
{
  "mercado": {
    "nome": "nome fantasia ou nome visível",
    "razaoSocial": "razão social ou string vazia",
    "cnpj": "somente 14 dígitos ou string vazia",
    "endereco": "endereço completo ou string vazia"
  },
  "compra": {
    "data": "data e hora em ISO 8601; use apenas a data se a hora não estiver legível",
    "numeroDocumento": "número da nota/cupom ou string vazia",
    "valorTotal": 0.00
  },
  "problemasPossiveis": [],
  "itens": [
    {
      "descricaoOriginal": "descrição exatamente como aparece na nota",
      "produto": "nome genérico e legível do produto, sem marca nem tamanho",
      "variedade": "sabor, tipo ou versão do produto, como Tradicional, Queijo, Micro-ondas, Integral ou Sem lactose; string vazia se não houver",
      "marca": "marca inferida com segurança ou string vazia",
      "categoria": "Hortifruti, Mercearia, Frios, Carnes, Bebidas, Limpeza, Higiene ou Outros",
      "quantidadeComprada": 1,
      "conteudoEmbalagem": 1,
      "unidadeConteudo": "un, kg, g, L ou ml",
      "precoUnitario": 0.00,
      "precoTotal": 0.00,
      "codigoBarras": "GTIN/EAN ou string vazia",
      "problemasPossiveis": []
    }
  ]
}

Regras:
- Use números, não textos, nos campos numéricos.
- Não invente marca, código de barras, CNPJ ou tamanho ilegível.
- Separe produto, variedade e marca. Use variedade para sabor, tipo ou versão. Exemplo: produto "Pipoca", variedade "Tradicional" e marca "Yoki". Não coloque variedade ou marca no nome do produto.
- Use problemasPossiveis para apontar texto cortado, leitura incerta, quantidade/embalagem ambígua, desconto duvidoso, preço incompatível ou qualquer campo relevante que mereça revisão. Use [] quando não houver alertas.
- Se uma informação não estiver legível, deixe o campo vazio quando ele aceitar string; para número obrigatório use 0 e explique o problema no alerta do item.
- Para itens vendidos por peso, quantidadeComprada deve ser o peso e conteudoEmbalagem deve ser 1, usando kg como unidadeConteudo.
- precoTotal é o valor efetivamente cobrado pelo item após descontos identificáveis.
- Preserve todos os itens, inclusive itens repetidos.
- Confira se a soma dos preços totais dos itens é compatível com valorTotal; não altere dados legíveis apenas para forçar a soma.`
