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
  deletedListItems: [],
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

function stripJsonComments(source) {
  let insideString = false
  let stringChar = ''
  let isEscaped = false
  let result = ''
  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    const next = source[i + 1]

    if (insideString) {
      result += char
      if (isEscaped) {
        isEscaped = false
      } else if (char === '\\') {
        isEscaped = true
      } else if (char === stringChar) {
        insideString = false
      }
      continue
    }

    if (char === '"' || char === "'") {
      insideString = true
      stringChar = char
      result += char
      continue
    }

    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n' && source[i] !== '\r') {
        i++
      }
      result += '\n'
      continue
    }

    if (char === '/' && next === '*') {
      i += 2
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        i++
      }
      i++
      continue
    }

    result += char
  }
  return result
}

function normalizeJsonQuotes(source) {
  let insideString = false
  let stringChar = ''
  let isEscaped = false
  let result = ''

  for (let i = 0; i < source.length; i++) {
    const char = source[i]

    if (insideString) {
      if (stringChar === "'") {
        if (isEscaped) {
          if (char === "'") {
            result = result.slice(0, -1) + "'"
          } else {
            result += char
          }
          isEscaped = false
        } else if (char === '\\') {
          isEscaped = true
          result += char
        } else if (char === '"') {
          result += '\\"'
        } else if (char === "'") {
          insideString = false
          result += '"'
        } else if (char === '\n') {
          result += '\\n'
        } else if (char === '\r') {
          result += '\\r'
        } else if (char === '\t') {
          result += '\\t'
        } else {
          result += char
        }
      } else {
        if (isEscaped) {
          isEscaped = false
          result += char
        } else if (char === '\\') {
          isEscaped = true
          result += char
        } else if (char === '"') {
          insideString = false
          result += '"'
        } else if (char === '\n') {
          result += '\\n'
        } else if (char === '\r') {
          result += '\\r'
        } else if (char === '\t') {
          result += '\\t'
        } else {
          result += char
        }
      }
      continue
    }

    if (char === "'") {
      insideString = true
      stringChar = "'"
      result += '"'
      continue
    } else if (char === '"') {
      insideString = true
      stringChar = '"'
      result += '"'
      continue
    }

    result += char
  }
  return result
}

function removeJsonTrailingCommas(source) {
  let insideString = false
  let isEscaped = false
  let result = ''

  for (let i = 0; i < source.length; i++) {
    const char = source[i]

    if (insideString) {
      result += char
      if (isEscaped) {
        isEscaped = false
      } else if (char === '\\') {
        isEscaped = true
      } else if (char === '"') {
        insideString = false
      }
      continue
    }

    if (char === '"') {
      insideString = true
      result += char
      continue
    }

    if (char === ',') {
      let nextIdx = i + 1
      while (nextIdx < source.length && /\s/.test(source[nextIdx])) {
        nextIdx++
      }
      if (nextIdx < source.length && (source[nextIdx] === '}' || source[nextIdx] === ']')) {
        continue
      }
    }

    result += char
  }
  return result
}

function quoteJsonKeys(source) {
  return source.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":')
}

export function sanitizeJsonText(text) {
  let str = text
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")

  str = stripJsonComments(str)
  str = quoteJsonKeys(str)
  str = normalizeJsonQuotes(str)
  str = removeJsonTrailingCommas(str)
  return str
}

export function parseJsonInput(text) {
  if (typeof text !== 'string') {
    throw new Error('O conteúdo fornecido não é um texto válido.')
  }

  let cleaned = text
    .replace(/[\uFEFF\u200B-\u200D\u200E\u200F\u2028\u2029]/g, '')
    .replace(/[\u00A0\u202F\u2000-\u200A]/g, ' ')
    .trim()

  if (!cleaned) {
    throw new Error('Nenhum conteúdo informado para importação.')
  }

  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim()
  } else {
    const firstBrace = cleaned.indexOf('{')
    const firstBracket = cleaned.indexOf('[')
    let startIdx = -1
    if (firstBrace !== -1 && firstBracket !== -1) {
      startIdx = Math.min(firstBrace, firstBracket)
    } else if (firstBrace !== -1) {
      startIdx = firstBrace
    } else if (firstBracket !== -1) {
      startIdx = firstBracket
    }

    const lastBrace = cleaned.lastIndexOf('}')
    const lastBracket = cleaned.lastIndexOf(']')
    const endIdx = Math.max(lastBrace, lastBracket)

    if (startIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.slice(startIdx, endIdx + 1).trim()
    }
  }

  try {
    return JSON.parse(cleaned)
  } catch {
    // Continue with sanitization
  }

  const sanitized = sanitizeJsonText(cleaned)

  try {
    return JSON.parse(sanitized)
  } catch (err) {
    throw new Error(`Erro ao interpretar o JSON: verifique a formatação do texto colado (${err.message})`)
  }
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

export function normalizeProductVariants(variants = []) {
  return (variants || []).map((variant) => {
    if (typeof variant === 'object' && variant) {
      const normalized = { packageSize: 1, packageUnit: 'un', variety: '', brand: '', barcode: '', ...variant, id: variant.id || uid() }
      if (!normalized.variety && normalized.flavor) normalized.variety = normalized.flavor
      return normalized
    }
    const [brand = '', packageSize = '1', packageUnit = 'un'] = String(variant || '').split('|')
    return { id: uid(), variety: '', brand, packageSize: Number(packageSize) || 1, packageUnit: packageUnit || 'un', barcode: '', createdAt: nowIso() }
  })
}

export function buildReceiptPrompt(products = [], options = {}) {
  const { includeCatalog = true } = options
  let prompt = RECEIPT_PROMPT

  if (includeCatalog && Array.isArray(products) && products.length > 0) {
    const catalog = products
      .map((p) => {
        const variants = normalizeProductVariants(p.variants || [])
        const varieties = [...new Set(variants.map((v) => (v.variety || '').trim()).filter(Boolean))]
        const brands = [...new Set([
          ...(p.brands || []).map((b) => String(b || '').trim()),
          ...variants.map((v) => (v.brand || '').trim()),
        ].filter(Boolean))]

        const entry = {
          produto: p.name,
          categoria: p.category || 'Outros',
        }
        if (varieties.length > 0) entry.variedades = varieties
        if (brands.length > 0) entry.marcas = brands
        return entry
      })
      .filter((p) => Boolean(p.produto && p.produto.trim()))
      .sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR'))

    if (catalog.length > 0) {
      prompt += `\n\n---\nCatálogo de produtos e variações já existentes:\nSempre que um item da nota corresponder a um produto ou variedade abaixo, use EXATAMENTE a mesma grafia para os campos "produto", "variedade", "marca" e "categoria" para manter o catálogo padronizado. Caso o item não exista nesta lista, crie um novo nome legível e padronizado.\n\n\`\`\`json\n${JSON.stringify(catalog, null, 2)}\n\`\`\``
    }
  }

  return prompt
}

export function parseNfceHtml(htmlString) {
  if (!htmlString || typeof htmlString !== 'string') {
    throw new Error('Conteúdo HTML da nota fiscal não informado.')
  }

  const clean = (str) => String(str || '').replace(/\s+/g, ' ').trim()
  const parseNum = (str) => {
    if (!str) return 0
    const cleaned = String(str).replace(/[^\d,.-]/g, '').replace(',', '.')
    return Number(cleaned) || 0
  }

  // 1. Extrair Estabelecimento / Mercado
  let marketName = ''
  const u20Match = htmlString.match(/id=["']u20["'][^>]*>([^<]+)</i) || htmlString.match(/class=["']txtTopo["'][^>]*>([^<]+)</i)
  if (u20Match) marketName = clean(u20Match[1])

  let cnpj = ''
  const cnpjMatch = htmlString.match(/CNPJ[:\s]*([0-9.\-/]+)/i)
  if (cnpjMatch) cnpj = onlyDigits(cnpjMatch[1])

  let address = ''
  const addressMatch = htmlString.match(/CNPJ[^<]*<\/div>\s*<div class=["']text["'][^>]*>([\s\S]*?)<\/div>/i)
  if (addressMatch) {
    address = clean(addressMatch[1].replace(/<br\s*\/?>/gi, ', ').replace(/\s*,\s*/g, ', '))
  }

  // 2. Extrair Informações Gerais (Data, Número, Chave)
  let emissionDateStr = ''
  const dateMatch = htmlString.match(/Emiss[aã]o[:\s]*(?:<\/strong>)?\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4}\s+[0-9]{2}:[0-9]{2}(?::[0-9]{2})?)/i)
    || htmlString.match(/([0-9]{2}\/[0-9]{2}\/[0-9]{4}\s+[0-9]{2}:[0-9]{2}:[0-9]{2})/i)
  if (dateMatch) {
    const parts = dateMatch[1].split(/[/\s:]/)
    if (parts.length >= 5) {
      const [d, m, y, h, min, s = '00'] = parts
      emissionDateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}:${s.padStart(2, '0')}`
    }
  }

  let docNumber = ''
  const docMatch = htmlString.match(/N[úu]mero[:\s]*(?:<\/strong>)?\s*(\d+)/i)
  if (docMatch) docNumber = docMatch[1]

  let totalDeclared = 0
  const totalMatch = htmlString.match(/Valor a pagar R\$:[^<]*<\/label>\s*<span[^>]*class=["'][^"']*totalNumb[^"']*["'][^>]*>([^<]+)<\/span>/i)
    || htmlString.match(/class=["'][^"']*totalNumb txtMax[^"']*["'][^>]*>([^<]+)<\/span>/i)
  if (totalMatch) totalDeclared = parseNum(totalMatch[1])

  // 3. Extrair Itens da Tabela
  const items = []
  const itemBlocks = htmlString.split(/<tr\s+id=["']Item/i).slice(1)

  for (const block of itemBlocks) {
    const titMatch = block.match(/class=["']txtTit["'][^>]*>([^<]+)<\/span>/i)
    const rawDesc = titMatch ? clean(titMatch[1]) : ''
    if (!rawDesc) continue

    const codMatch = block.match(/class=["']RCod["'][^>]*>\s*\(C[óo]digo[:\s]*(\d+)\s*\)/i)
    const itemCode = codMatch ? codMatch[1].trim() : ''

    const qtdMatch = block.match(/class=["']Rqtd["'][^>]*>(?:<strong>[^<]*<\/strong>)?\s*([0-9,.]+)/i)
    const quantity = qtdMatch ? parseNum(qtdMatch[1]) : 1

    const unMatch = block.match(/class=["']RUN["'][^>]*>(?:<strong>[^<]*<\/strong>)?\s*([A-Za-z0-9]+)/i)
    const unitRaw = unMatch ? clean(unMatch[1]).toLowerCase() : 'un'
    const packageUnit = unitRaw === 'kg' ? 'kg' : unitRaw === 'g' || unitRaw === 'gr' ? 'g' : unitRaw === 'l' || unitRaw === 'lt' ? 'L' : unitRaw === 'ml' ? 'ml' : 'un'

    const vlUnitMatch = block.match(/class=["']RvlUnit["'][^>]*>(?:<strong>[^<]*<\/strong>)?\s*([0-9,.]+)/i)
    const unitPrice = vlUnitMatch ? parseNum(vlUnitMatch[1]) : 0

    const totalItemMatch = block.match(/class=["']valor["'][^>]*>([^<]+)<\/span>/i)
    const totalPrice = totalItemMatch ? parseNum(totalItemMatch[1]) : (quantity * unitPrice)

    items.push({
      id: uid(),
      descricaoOriginal: rawDesc,
      produto: rawDesc,
      variedade: '',
      marca: '',
      quantidadeComprada: quantity,
      conteudoEmbalagem: packageUnit === 'kg' ? quantity : 1,
      unidadeConteudo: packageUnit,
      precoUnitario: unitPrice,
      precoTotal: totalPrice,
      codigoBarras: itemCode,
      categoria: 'Outros',
      problemasPossiveis: [],
    })
  }

  if (items.length === 0) {
    throw new Error('Não foi possível identificar os produtos na página da nota fiscal.')
  }

  return {
    mercado: {
      nome: marketName || 'Mercado não identificado',
      razaoSocial: marketName,
      cnpj,
      endereco: address,
    },
    compra: {
      data: emissionDateStr || nowIso(),
      numeroDocumento: docNumber,
      valorTotal: totalDeclared || items.reduce((acc, it) => acc + it.precoTotal, 0),
    },
    itens: items,
  }
}

export async function fetchNfceFromUrl(url) {
  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
    throw new Error('Informe uma URL válida da NFC-e.')
  }

  const cleanUrl = url.trim()

  // 1. Tentar proxy interno (/api/proxy-nfce) caso esteja rodando com Vite dev server
  try {
    const localRes = await fetch(`/api/proxy-nfce?url=${encodeURIComponent(cleanUrl)}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    })
    if (localRes.ok) {
      const html = await localRes.text()
      if (html && (html.includes('DOCUMENTO AUXILIAR') || html.includes('NFC-e') || html.includes('tabResult') || html.includes('txtTit') || html.length > 500)) {
        return html
      }
    }
  } catch {}

  // 2. Tentar AllOrigins JSON format (formato JSON que não falha com certificado da SEFAZ)
  try {
    const allOriginsRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    })
    if (allOriginsRes.ok) {
      const data = await allOriginsRes.json()
      if (data?.contents && (data.contents.includes('DOCUMENTO AUXILIAR') || data.contents.includes('NFC-e') || data.contents.includes('tabResult') || data.contents.length > 500)) {
        return data.contents
      }
    }
  } catch {}

  // 3. Tentar CodeTabs proxy
  try {
    const codetabsRes = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    })
    if (codetabsRes.ok) {
      const html = await codetabsRes.text()
      if (html && (html.includes('DOCUMENTO AUXILIAR') || html.includes('NFC-e') || html.includes('tabResult') || html.length > 500)) {
        return html
      }
    }
  } catch {}

  // 4. Tentar CorsProxy.io
  try {
    const corsProxyRes = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(cleanUrl)}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    })
    if (corsProxyRes.ok) {
      const html = await corsProxyRes.text()
      if (html && (html.includes('DOCUMENTO AUXILIAR') || html.includes('NFC-e') || html.includes('tabResult') || html.length > 500)) {
        return html
      }
    }
  } catch {}

  throw new Error('Não foi possível carregar os dados da SEFAZ. Verifique sua conexão ou se a URL está correta.')
}

export function buildReceiptPromptFromNfce(nfcePayload, products = [], options = {}) {
  const { includeCatalog = true } = options
  let prompt = `Analise os dados extraídos desta nota fiscal brasileira e formate-os em JSON padronizado conforme o catálogo.\n\nDados da Nota Fiscal:\n\`\`\`json\n${JSON.stringify(nfcePayload, null, 2)}\n\`\`\`\n\nResponda SOMENTE com JSON válido, sem markdown e sem explicações, seguindo a estrutura:\n{\n  "mercado": {\n    "nome": "${nfcePayload?.mercado?.nome || ''}",\n    "razaoSocial": "${nfcePayload?.mercado?.razaoSocial || ''}",\n    "cnpj": "${nfcePayload?.mercado?.cnpj || ''}",\n    "endereco": "${nfcePayload?.mercado?.endereco || ''}"\n  },\n  "compra": {\n    "data": "${nfcePayload?.compra?.data || ''}",\n    "numeroDocumento": "${nfcePayload?.compra?.numeroDocumento || ''}",\n    "valorTotal": ${Number(nfcePayload?.compra?.valorTotal || 0)}\n  },\n  "itens": [\n    {\n      "descricaoOriginal": "descrição original",\n      "produto": "nome genérico e limpo do produto",\n      "variedade": "sabor/tipo se aplicável ou vazio",\n      "marca": "marca se identificável ou vazio",\n      "categoria": "Hortifruti, Mercearia, Frios, Carnes, Bebidas, Limpeza, Higiene ou Outros",\n      "quantidadeComprada": 1,\n      "conteudoEmbalagem": 1,\n      "unidadeConteudo": "un, kg, g, L ou ml",\n      "precoUnitario": 0.00,\n      "precoTotal": 0.00,\n      "codigoBarras": "código se houver"\n    }\n  ]\n}`

  if (includeCatalog && Array.isArray(products) && products.length > 0) {
    const catalog = products
      .map((p) => {
        const variants = normalizeProductVariants(p.variants || [])
        const varieties = [...new Set(variants.map((v) => (v.variety || '').trim()).filter(Boolean))]
        const brands = [...new Set([
          ...(p.brands || []).map((b) => String(b || '').trim()),
          ...variants.map((v) => (v.brand || '').trim()),
        ].filter(Boolean))]

        const entry = {
          produto: p.name,
          categoria: p.category || 'Outros',
        }
        if (varieties.length > 0) entry.variedades = varieties
        if (brands.length > 0) entry.marcas = brands
        return entry
      })
      .filter((p) => Boolean(p.produto && p.produto.trim()))
      .sort((a, b) => a.produto.localeCompare(b.produto, 'pt-BR'))

    if (catalog.length > 0) {
      prompt += `\n\n---\nCatálogo de produtos e variações já existentes:\nSempre que um item da nota corresponder a um produto ou variedade abaixo, use EXATAMENTE a mesma grafia para os campos "produto", "variedade", "marca" e "categoria" para manter o catálogo padronizado.\n\n\`\`\`json\n${JSON.stringify(catalog, null, 2)}\n\`\`\``
    }
  }

  return prompt
}

export function variantMatchesItem(variant, item) {
  return (
    normalizeText(variant.variety) === normalizeText(item.variety) &&
    normalizeText(variant.brand) === normalizeText(item.brand) &&
    Number(variant.packageSize || 1) === Number(item.packageSize || 1) &&
    (variant.packageUnit || 'un') === (item.packageUnit || 'un')
  )
}

export function findMatchingVariant(product, item) {
  if (!product || !item) return undefined
  const variants = normalizeProductVariants(product.variants)
  return (
    variants.find((variant) => variant.id && variant.id === item.variantId) ||
    variants.find((variant) => variantMatchesItem(variant, item)) ||
    undefined
  )
}

export function itemBelongsToProduct(state, item, product) {
  if (item.productId === product.id) return true
  const hasValidProductId = item.productId && state.products.some((saved) => saved.id === item.productId)
  const names = new Set([product.name, ...(product.aliases || [])].map(normalizeText).filter(Boolean))
  return !hasValidProductId && names.has(normalizeText(item.productName || item.name))
}

export function refreshPurchaseMetadata(state) {
  const purchases = [...state.purchases].sort(
    (first, second) => new Date(second.purchasedAt || 0) - new Date(first.purchasedAt || 0)
  )
  const products = state.products.map((product) => {
    const variants = normalizeProductVariants(product.variants).map((variant) => {
      let latest = null
      for (const purchase of purchases) {
        const item = purchase.items.find(
          (saved) =>
            saved.variantId === variant.id ||
            (saved.productId === product.id && variantMatchesItem(variant, saved))
        )
        if (item) {
          latest = { purchase, item }
          break
        }
      }
      if (!latest) {
        const { lastPrice: _lastPrice, lastPurchasedAt: _lastPurchasedAt, lastMarketName: _lastMarketName, ...withoutHistory } = variant
        return withoutHistory
      }
      return {
        ...variant,
        lastPrice:
          Number(latest.item.unitPrice) ||
          Number(latest.item.totalPrice) / (Number(latest.item.quantity) || 1),
        lastPurchasedAt: latest.purchase.purchasedAt,
        lastMarketName: latest.purchase.marketName,
      }
    })
    return {
      ...product,
      variants,
      brands: [...new Set(variants.map((variant) => variant.brand).filter(Boolean))],
    }
  })
  return { ...state, products }
}

export function suggestNewProductName(productName = '', variant = {}) {
  const variety = String(variant?.variety || '').trim()
  const pName = String(productName || '').trim()
  if (!variety) return pName ? `${pName} (${variant?.brand || 'Novo'})` : 'Novo produto'
  const normP = normalizeText(pName)
  const normV = normalizeText(variety)
  if (normP.includes(normV)) return pName
  if (normV.startsWith(normP)) return variety
  return `${pName} ${variety}`
}

export function mergeProductVariants(state, plan) {
  const product = state.products.find((p) => p.id === plan.productId)
  if (!product) return state
  const variants = normalizeProductVariants(product.variants)
  const sourceVariant = variants.find((v) => v.id === plan.sourceVariantId)
  const targetVariant = variants.find((v) => v.id === plan.targetVariantId)
  if (!sourceVariant || !targetVariant || sourceVariant.id === targetVariant.id) return state

  const updatedTargetVariant = {
    ...targetVariant,
    ...(plan.targetOverrides || {}),
    variety: (plan.targetOverrides?.variety !== undefined ? plan.targetOverrides.variety : targetVariant.variety || '').trim(),
    brand: (plan.targetOverrides?.brand !== undefined ? plan.targetOverrides.brand : targetVariant.brand || '').trim(),
    packageSize: Math.max(0.001, Number(plan.targetOverrides?.packageSize ?? targetVariant.packageSize) || 1),
    packageUnit: plan.targetOverrides?.packageUnit || targetVariant.packageUnit || 'un',
    barcode: (plan.targetOverrides?.barcode !== undefined ? plan.targetOverrides.barcode : targetVariant.barcode || '').trim(),
    updatedAt: nowIso(),
  }

  const updatedVariants = variants
    .filter((v) => v.id !== sourceVariant.id)
    .map((v) => (v.id === targetVariant.id ? updatedTargetVariant : v))

  const updatedProduct = {
    ...product,
    variants: updatedVariants,
    brands: [...new Set(updatedVariants.map((v) => v.brand).filter(Boolean))],
    updatedAt: nowIso(),
  }

  const isSourceItem = (item) => {
    if (!itemBelongsToProduct(state, item, product)) return false
    return item.variantId === sourceVariant.id || (!item.variantId && variantMatchesItem(sourceVariant, item))
  }

  const redirectPurchaseItem = (item) => {
    if (!isSourceItem(item)) {
      if (
        itemBelongsToProduct(state, item, product) &&
        (item.variantId === targetVariant.id || (!item.variantId && variantMatchesItem(targetVariant, item)))
      ) {
        return {
          ...item,
          variantId: updatedTargetVariant.id,
          variety: updatedTargetVariant.variety,
          brand: updatedTargetVariant.brand || item.brand,
          packageSize: updatedTargetVariant.packageSize,
          packageUnit: updatedTargetVariant.packageUnit,
        }
      }
      return item
    }
    return {
      ...item,
      variantId: updatedTargetVariant.id,
      variety: updatedTargetVariant.variety,
      brand: updatedTargetVariant.brand || item.brand,
      packageSize: updatedTargetVariant.packageSize,
      packageUnit: updatedTargetVariant.packageUnit,
    }
  }

  const redirectListItem = (item) => {
    if (!isSourceItem(item)) {
      if (
        itemBelongsToProduct(state, item, product) &&
        (item.variantId === targetVariant.id || (!item.variantId && variantMatchesItem(targetVariant, item)))
      ) {
        return {
          ...item,
          variantId: updatedTargetVariant.id,
          variety: updatedTargetVariant.variety,
          brand: updatedTargetVariant.brand || item.brand,
          packageSize: updatedTargetVariant.packageSize,
          packageUnit: updatedTargetVariant.packageUnit,
        }
      }
      return item
    }
    return {
      ...item,
      variantId: updatedTargetVariant.id,
      variety: updatedTargetVariant.variety,
      brand: updatedTargetVariant.brand || item.brand,
      packageSize: updatedTargetVariant.packageSize,
      packageUnit: updatedTargetVariant.packageUnit,
    }
  }

  const updatedPurchases = state.purchases.map((purchase) => ({
    ...purchase,
    items: purchase.items.map(redirectPurchaseItem),
  }))

  const updatedLists = state.lists.map((list) => ({
    ...list,
    items: list.items.map(redirectListItem),
  }))

  const updatedMappings = (state.productMappings || []).map((mapping) => {
    if (mapping.productId === product.id && mapping.variantId === sourceVariant.id) {
      return { ...mapping, variantId: updatedTargetVariant.id, updatedAt: nowIso() }
    }
    return mapping
  })

  const updatedProducts = state.products.map((p) => (p.id === product.id ? updatedProduct : p))

  return refreshPurchaseMetadata({
    ...state,
    products: updatedProducts,
    purchases: updatedPurchases,
    lists: updatedLists,
    productMappings: updatedMappings,
  })
}

export function promoteVariantToProduct(state, plan) {
  const sourceProduct = state.products.find((p) => p.id === plan.sourceProductId)
  if (!sourceProduct) return state
  const variants = normalizeProductVariants(sourceProduct.variants)
  const variant = variants.find((v) => v.id === plan.variantId)
  if (!variant) return state

  const newProductId = uid()
  const newVariantId = uid()
  const newVariant = {
    ...variant,
    id: newVariantId,
    variety: (plan.newProduct.variantVariety !== undefined ? plan.newProduct.variantVariety : '').trim(),
    updatedAt: nowIso(),
  }

  const createdProduct = {
    id: newProductId,
    name: plan.newProduct.name.trim(),
    category: plan.newProduct.category || sourceProduct.category || 'Outros',
    defaultUnit: plan.newProduct.defaultUnit || variant.packageUnit || sourceProduct.defaultUnit || 'un',
    brands: [newVariant.brand].filter(Boolean),
    variants: [newVariant],
    recurrenceDays: null,
    aliases: [],
    archivedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }

  const remainingVariants = variants.filter((v) => v.id !== variant.id)
  const updatedSourceProduct = {
    ...sourceProduct,
    variants: remainingVariants,
    brands: [...new Set(remainingVariants.map((v) => v.brand).filter(Boolean))],
    updatedAt: nowIso(),
  }

  const isTargetItem = (item) => {
    if (!itemBelongsToProduct(state, item, sourceProduct)) return false
    return item.variantId === variant.id || (!item.variantId && variantMatchesItem(variant, item))
  }

  const redirectPurchaseItem = (item) => {
    if (!isTargetItem(item)) return item
    return {
      ...item,
      productId: createdProduct.id,
      productName: createdProduct.name,
      category: createdProduct.category,
      variantId: newVariant.id,
      variety: newVariant.variety,
    }
  }

  const redirectListItem = (item) => {
    if (!isTargetItem(item)) return item
    return {
      ...item,
      productId: createdProduct.id,
      name: createdProduct.name,
      category: createdProduct.category,
      unit: createdProduct.defaultUnit || item.unit,
      variantId: newVariant.id,
      variety: newVariant.variety,
    }
  }

  const updatedPurchases = state.purchases.map((purchase) => ({
    ...purchase,
    items: purchase.items.map(redirectPurchaseItem),
  }))

  const updatedLists = state.lists.map((list) => ({
    ...list,
    items: list.items.map(redirectListItem),
  }))

  const updatedMappings = (state.productMappings || []).map((mapping) => {
    if (mapping.productId === sourceProduct.id && mapping.variantId === variant.id) {
      return { ...mapping, productId: createdProduct.id, variantId: newVariant.id, updatedAt: nowIso() }
    }
    return mapping
  })

  const updatedProducts = state.products
    .map((p) => (p.id === sourceProduct.id ? updatedSourceProduct : p))
    .concat(createdProduct)

  return refreshPurchaseMetadata({
    ...state,
    products: updatedProducts,
    purchases: updatedPurchases,
    lists: updatedLists,
    productMappings: updatedMappings,
  })
}

export function updatePurchaseItem(state, payload) {
  const { purchaseId, itemId, targetProductId, targetVariantId, itemData = {}, createVariantInProduct = true } = payload
  const purchase = state.purchases.find((p) => p.id === purchaseId)
  if (!purchase) return state

  const oldItem = purchase.items.find((item) => item.id === itemId)
  if (!oldItem) return state

  const quantity = Math.max(0.001, Number(itemData.quantity) || 1)
  const packageSize = Math.max(0.001, Number(itemData.packageSize) || 1)
  const packageUnit = itemData.packageUnit || 'un'
  const unitPrice = Number(itemData.unitPrice) || (Number(itemData.totalPrice) / quantity) || 0
  const totalPrice = Number.isFinite(Number(itemData.totalPrice))
    ? Number(itemData.totalPrice)
    : unitPrice * quantity
  const variety = (itemData.variety || '').trim()
  const brand = (itemData.brand || '').trim()
  const category = itemData.category || oldItem.category || 'Outros'
  const barcode = (itemData.barcode || '').trim()
  const productName = (itemData.productName || oldItem.productName || '').trim()

  let updatedProducts = state.products
  let finalProductId = ''
  let finalProductName = productName
  let finalCategory = category
  let finalVariantId = ''

  if (targetProductId === 'new') {
    finalProductId = uid()
    finalVariantId = uid()
    const newVariant = {
      id: finalVariantId,
      variety,
      brand,
      packageSize,
      packageUnit,
      barcode,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    const newProduct = {
      id: finalProductId,
      name: productName || 'Novo produto',
      category,
      defaultUnit: defaultUnitForProduct(productName, category),
      brands: [brand].filter(Boolean),
      variants: [newVariant],
      recurrenceDays: null,
      aliases: [],
      archivedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    updatedProducts = [...state.products, newProduct]
    finalProductName = newProduct.name
    finalCategory = newProduct.category
  } else {
    let targetProduct = state.products.find((p) => p.id === targetProductId)
    if (!targetProduct && productName) {
      targetProduct = state.products.find((p) => normalizeText(p.name) === normalizeText(productName))
    }

    if (targetProduct) {
      finalProductId = targetProduct.id
      finalProductName = targetProduct.name
      finalCategory = targetProduct.category || category
      const variants = normalizeProductVariants(targetProduct.variants)

      if (targetVariantId && targetVariantId !== 'new') {
        const foundVariant = variants.find((v) => v.id === targetVariantId)
        if (foundVariant) {
          finalVariantId = foundVariant.id
        }
      }

      if (!finalVariantId) {
        const existingMatch = variants.find((v) =>
          variantMatchesItem(v, { variety, brand, packageSize, packageUnit })
        )
        if (existingMatch) {
          finalVariantId = existingMatch.id
        } else if (createVariantInProduct) {
          const newVariant = {
            id: uid(),
            variety,
            brand,
            packageSize,
            packageUnit,
            barcode,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          }
          const updatedVariants = [...variants, newVariant]
          const updatedProduct = {
            ...targetProduct,
            variants: updatedVariants,
            brands: [...new Set(updatedVariants.map((v) => v.brand).filter(Boolean))],
            updatedAt: nowIso(),
          }
          updatedProducts = state.products.map((p) => (p.id === targetProduct.id ? updatedProduct : p))
          finalVariantId = newVariant.id
        }
      }
    } else {
      finalProductId = uid()
      finalVariantId = uid()
      const newVariant = {
        id: finalVariantId,
        variety,
        brand,
        packageSize,
        packageUnit,
        barcode,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      const newProduct = {
        id: finalProductId,
        name: productName || 'Novo produto',
        category,
        defaultUnit: defaultUnitForProduct(productName, category),
        brands: [brand].filter(Boolean),
        variants: [newVariant],
        recurrenceDays: null,
        aliases: [],
        archivedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      }
      updatedProducts = [...state.products, newProduct]
      finalProductName = newProduct.name
      finalCategory = newProduct.category
    }
  }

  const updatedItem = {
    ...oldItem,
    productId: finalProductId,
    productName: finalProductName,
    category: finalCategory,
    variantId: finalVariantId || '',
    variety,
    brand,
    packageSize,
    packageUnit,
    quantity,
    unitPrice,
    totalPrice,
    barcode,
  }

  const updatedPurchases = state.purchases.map((p) => {
    if (p.id !== purchaseId) return p
    const updatedItems = p.items.map((item) => (item.id === itemId ? updatedItem : item))
    const updatedTotal = updatedItems.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)
    return { ...p, items: updatedItems, total: updatedTotal }
  })

  const originalKey = oldItem.originalDescription || oldItem.importedProductName
  let updatedMappings = state.productMappings || []
  if (originalKey) {
    const normOriginal = normalizeText(originalKey)
    const existingIndex = updatedMappings.findIndex(
      (m) => normalizeText(m.importedDescription || m.description || '') === normOriginal
    )
    const newMapping = {
      id: existingIndex >= 0 ? updatedMappings[existingIndex].id : uid(),
      importedDescription: originalKey,
      productId: finalProductId,
      variantId: finalVariantId || '',
      productName: finalProductName,
      category: finalCategory,
      updatedAt: nowIso(),
    }
    if (existingIndex >= 0) {
      updatedMappings = updatedMappings.map((m, idx) => (idx === existingIndex ? newMapping : m))
    } else {
      updatedMappings = [newMapping, ...updatedMappings]
    }
  }

  return refreshPurchaseMetadata({
    ...state,
    products: updatedProducts,
    purchases: updatedPurchases,
    productMappings: updatedMappings,
  })
}

export function levenshteinDistance(str1 = '', str2 = '') {
  const s1 = String(str1 || '')
  const s2 = String(str2 || '')
  const m = s1.length
  const n = s2.length
  if (!m) return n
  if (!n) return m

  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) d[i][0] = i
  for (let j = 0; j <= n; j++) d[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      )
    }
  }
  return d[m][n]
}

const STOP_WORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'com', 'para', 'por', 'sem', 'ao', 'aos',
  'un', 'und', 'kg', 'g', 'gr', 'l', 'lt', 'ml', 'pct', 'cx', 'pc', 'pacote', 'caixa', 'unidade'
])

export function tokenizeProductName(name = '') {
  return normalizeText(name)
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
}

export function findDuplicateProductSuggestions(products = [], options = {}) {
  const { dismissedPairIds = new Set() } = options
  const activeProducts = products.filter((p) => p && !p.archivedAt)
  const suggestions = []

  for (let i = 0; i < activeProducts.length; i++) {
    for (let j = i + 1; j < activeProducts.length; j++) {
      const p1 = activeProducts[i]
      const p2 = activeProducts[j]

      const pairId = [p1.id, p2.id].sort().join('::')
      if (dismissedPairIds.has(pairId)) continue

      const n1 = normalizeText(p1.name)
      const n2 = normalizeText(p2.name)
      if (!n1 || !n2) continue

      let match = null

      // 1. Barcode check
      const b1 = (p1.variants || []).map((v) => onlyDigits(v.barcode)).filter((b) => b && b.length >= 6)
      const b2 = (p2.variants || []).map((v) => onlyDigits(v.barcode)).filter((b) => b && b.length >= 6)
      const sharedBarcode = b1.find((b) => b2.includes(b))
      if (sharedBarcode) {
        match = {
          score: 1.0,
          confidence: 'high',
          reason: `Código de barras compartilhado (${sharedBarcode})`,
          type: 'barcode',
        }
      }

      // 2. Exact or normalized name match
      if (!match && n1 === n2) {
        match = {
          score: 0.99,
          confidence: 'high',
          reason: 'Nomes idênticos no catálogo',
          type: 'identical',
        }
      }

      // 3. Aliases match
      if (!match) {
        const a1 = (p1.aliases || []).map(normalizeText)
        const a2 = (p2.aliases || []).map(normalizeText)
        if (a1.includes(n2) || a2.includes(n1)) {
          match = {
            score: 0.95,
            confidence: 'high',
            reason: 'Um dos nomes está cadastrado como apelido/sinônimo',
            type: 'alias',
          }
        }
      }

      // 4. Minor typo / Levenshtein distance
      if (!match) {
        const dist = levenshteinDistance(n1, n2)
        const maxLen = Math.max(n1.length, n2.length)
        if (maxLen >= 4 && dist === 1) {
          match = {
            score: 0.92,
            confidence: 'high',
            reason: 'Nomes quase idênticos (diferença de 1 letra)',
            type: 'fuzzy',
          }
        } else if (maxLen >= 7 && dist === 2) {
          match = {
            score: 0.82,
            confidence: 'high',
            reason: 'Nomes muito parecidos (possível erro de digitação)',
            type: 'fuzzy',
          }
        }
      }

      // 5. Containment match (e.g. "Café Pilão" vs "Café" or "Leite Integral" vs "Leite")
      if (!match) {
        const p1ContainsP2 = n1.startsWith(n2 + ' ') || n1.endsWith(' ' + n2) || n1.includes(' ' + n2 + ' ')
        const p2ContainsP1 = n2.startsWith(n1 + ' ') || n2.endsWith(' ' + n1) || n2.includes(' ' + n1 + ' ')
        if (p1ContainsP2 || p2ContainsP1) {
          const shorterName = n1.length <= n2.length ? p1.name : p2.name
          const longerName = n1.length <= n2.length ? p2.name : p1.name
          const shorterNorm = n1.length <= n2.length ? n1 : n2
          const sameCategory = p1.category === p2.category || p1.category === 'Outros' || p2.category === 'Outros'

          if (shorterNorm.length >= 3 && sameCategory) {
            match = {
              score: 0.85,
              confidence: 'high',
              reason: `"${longerName}" contém "${shorterName}" (possível marca ou sabor)`,
              type: 'containment',
            }
          }
        }
      }

      // 6. Token similarity
      if (!match) {
        const t1 = tokenizeProductName(p1.name)
        const t2 = tokenizeProductName(p2.name)
        if (t1.length > 0 && t2.length > 0) {
          const sharedTokens = t1.filter((t) => t2.includes(t))
          if (sharedTokens.length > 0) {
            const dice = (2 * sharedTokens.length) / (t1.length + t2.length)
            const sameCategory = p1.category === p2.category
            const oneIsOutros = p1.category === 'Outros' || p2.category === 'Outros'
            let finalScore = dice * 0.85 + (sameCategory ? 0.1 : oneIsOutros ? 0 : -0.2)

            if (finalScore >= 0.65) {
              match = {
                score: Math.min(0.92, Math.max(0.65, Number(finalScore.toFixed(2)))),
                confidence: finalScore >= 0.8 ? 'high' : 'medium',
                reason: `Termos em comum: ${sharedTokens.join(', ')}`,
                type: 'tokens',
              }
            }
          }
        }
      }

      if (match) {
        // Determine primary (left) vs secondary (right)
        // Prefer product with shorter base name, starter product, or more variants
        const v1Count = (p1.variants || []).length
        const v2Count = (p2.variants || []).length
        let left = p1
        let right = p2

        if (n2.length < n1.length && (n1.includes(n2) || v2Count >= v1Count)) {
          left = p2
          right = p1
        } else if (v2Count > v1Count) {
          left = p2
          right = p1
        } else if (p2.starter && !p1.starter) {
          left = p2
          right = p1
        }

        suggestions.push({
          id: pairId,
          products: [left, right],
          score: match.score,
          confidence: match.confidence,
          reason: match.reason,
          type: match.type,
        })
      }
    }
  }

  return suggestions.sort((a, b) => b.score - a.score)
}
