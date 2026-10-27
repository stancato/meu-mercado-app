export const CATEGORIES = ['Hortifruti', 'Mercearia', 'Frios', 'Carnes', 'Bebidas', 'Limpeza', 'Higiene', 'Temperos', 'Outros']
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
  dismissedMergePairs: [],
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
      "categoria": "Hortifruti, Mercearia, Frios, Carnes, Bebidas, Limpeza, Higiene, Temperos ou Outros",
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
      .filter((p) => p && !p.archivedAt)
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

function decodeHtmlEntities(input = '') {
  const named = {
    nbsp: ' ',
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    aacute: 'á', Aacute: 'Á',
    acirc: 'â', Acirc: 'Â',
    atilde: 'ã', Atilde: 'Ã',
    agrave: 'à', Agrave: 'À',
    eacute: 'é', Eacute: 'É',
    ecirc: 'ê', Ecirc: 'Ê',
    iacute: 'í', Iacute: 'Í',
    oacute: 'ó', Oacute: 'Ó',
    ocirc: 'ô', Ocirc: 'Ô',
    otilde: 'õ', Otilde: 'Õ',
    uacute: 'ú', Uacute: 'Ú',
    ccedil: 'ç', Ccedil: 'Ç',
  }
  return String(input || '')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (full, name) => named[name] ?? full)
}

function stripHtmlTags(str = '') {
  return decodeHtmlEntities(String(str || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function mapNfceUnit(unitRaw = '') {
  const u = String(unitRaw || '').trim().toLowerCase()
  if (u === 'kg') return 'kg'
  if (u === 'g' || u === 'gr') return 'g'
  if (u === 'l' || u === 'lt') return 'L'
  if (u === 'ml') return 'ml'
  return 'un'
}

export function parseNfceHtml(rawInput) {
  if (!rawInput || typeof rawInput !== 'string' || !rawInput.trim()) {
    throw new Error('Conteúdo da nota fiscal não informado.')
  }

  const htmlString = decodeHtmlEntities(rawInput)
  const clean = (str) => stripHtmlTags(str)
  const parseNum = (str) => {
    if (!str) return 0
    let s = String(str).replace(/[^\d,.-]/g, '')
    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(',', '.')
    }
    return Number(s) || 0
  }

  // Verificar se a própria SEFAZ retornou mensagem de erro no HTML
  const sefazErrMatch = htmlString.match(/spnErro(?:Prosseguir)?Master['"]\)\.html\(['"]([\s\S]*?)['"]\)/i)
    || htmlString.match(/id=["']spnErro(?:Prosseguir)?Master["'][^>]*>([\s\S]*?)<\/span>/i)
  if (sefazErrMatch) {
    const errText = clean(sefazErrMatch[1])
    if (errText) {
      throw new Error(`A SEFAZ retornou um erro para esta nota: ${errText}`)
    }
  }

  // Texto plano com quebras de linha preservadas (usado como fallback ou quando o usuário cola o texto copiado da SEFAZ)
  const plainLines = htmlString
    .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi, ' ')
    .replace(/<(?:br|\/tr|\/div|\/p|\/li|\/h[1-6]|\/table)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const plainText = plainLines.join('\n')

  // 1. Extrair Estabelecimento / Mercado
  let marketName = ''
  const u20Match = htmlString.match(/id=["']u20["'][^>]*>([\s\S]*?)<\/div>/i)
    || htmlString.match(/class=["'][^"']*\btxtTopo\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
  if (u20Match) marketName = clean(u20Match[1])

  if (!marketName) {
    const cnpjLineIdx = plainLines.findIndex((line) => /^CNPJ[:\s]*[0-9.\-/]+/i.test(line))
    if (cnpjLineIdx > 0) {
      for (let i = cnpjLineIdx - 1; i >= 0; i--) {
        const candidate = plainLines[i]
        if (candidate && !/DOCUMENTO AUXILIAR|NOTA FISCAL|CONSUMIDOR ELETR|CHAVE DE ACESSO|CONSULTA/i.test(candidate)) {
          marketName = candidate
          break
        }
      }
    }
  }

  let cnpj = ''
  const cnpjMatch = htmlString.match(/CNPJ[:\s]*([0-9]{2}\.?[0-9]{3}\.?[0-9]{3}\/?[0-9]{4}-?[0-9]{2})/i)
    || plainText.match(/CNPJ[:\s]*([0-9.\-/]{14,18})/i)
  if (cnpjMatch) cnpj = onlyDigits(cnpjMatch[1])

  let address = ''
  const addressMatch = htmlString.match(/CNPJ[\s\S]*?<\/div>\s*<div[^>]*class=["'][^"']*\btext\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
  if (addressMatch) {
    address = clean(addressMatch[1].replace(/<br\s*\/?>/gi, ', ')).replace(/\s*,\s*/g, ', ').replace(/^,\s*|,\s*$/g, '')
  } else {
    const cnpjLineIdx = plainLines.findIndex((line) => /CNPJ[:\s]*[0-9.\-/]+/i.test(line))
    if (cnpjLineIdx !== -1 && plainLines[cnpjLineIdx + 1]) {
      const nextLine = plainLines[cnpjLineIdx + 1]
      if (!/\(C[óo]digo[:\s]|Qtde\.?[:\s]/i.test(nextLine)) {
        address = nextLine
      }
    }
  }

  // 2. Extrair Informações Gerais (Data, Número, Valor Total)
  let emissionDateStr = ''
  const dateMatch = htmlString.match(/Emiss[aã]o[:\s]*(?:<\/strong>)?\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4}\s+[0-9]{2}:[0-9]{2}(?::[0-9]{2})?)/i)
    || plainText.match(/Emiss[aã]o[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4}\s+[0-9]{2}:[0-9]{2}(?::[0-9]{2})?)/i)
    || plainText.match(/([0-9]{2}\/[0-9]{2}\/[0-9]{4}\s+[0-9]{2}:[0-9]{2}:[0-9]{2})/i)
  if (dateMatch) {
    const parts = dateMatch[1].split(/[/\s:]/)
    if (parts.length >= 5) {
      const [d, m, y, h, min, s = '00'] = parts
      emissionDateStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}:${s.padStart(2, '0')}`
    }
  }

  let docNumber = ''
  const docMatch = htmlString.match(/N[úu]mero[:\s]*(?:<\/strong>)?\s*(\d+)/i)
    || plainText.match(/N[úu]mero[:\s]*(\d+)/i)
  if (docMatch) docNumber = docMatch[1]

  let totalDeclared = 0
  const totalMatch = htmlString.match(/Valor a pagar R\$:?[\s\S]*?class=["'][^"']*\btotalNumb\b[^"']*["'][^>]*>([^<]+)<\/span>/i)
    || htmlString.match(/class=["'][^"']*\btotalNumb\s+txtMax\b[^"']*["'][^>]*>([^<]+)<\/span>/i)
    || plainText.match(/Valor a pagar(?:\s*R\$)?[:\s]*(?:R\$\s*)?([0-9.,]+)/i)
  if (totalMatch) totalDeclared = parseNum(totalMatch[1])

  // 3. Extrair Itens da Tabela HTML
  const items = []
  const rowMatches = [...htmlString.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1])
  const candidateBlocks = rowMatches.length > 0
    ? rowMatches.filter((b) => /txtTit|RCod|Rqtd/i.test(b))
    : htmlString.split(/<tr\b[^>]*id=["']?Item/i).slice(1)

  for (const block of candidateBlocks) {
    const titMatch = block.match(/class=["'][^"']*\btxtTit2?\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
    const rawDesc = titMatch ? clean(titMatch[1]) : ''
    if (!rawDesc) continue

    const codMatch = block.match(/class=["'][^"']*\bRCod\b[^"']*["'][^>]*>[\s\S]*?\(\s*C[óo]digo[:\s]*([^)]+?)\s*\)/i)
      || block.match(/\(\s*C[óo]digo[:\s]*([^)]+?)\s*\)/i)
    const itemCode = codMatch ? clean(codMatch[1]) : ''

    const qtdMatch = block.match(/class=["'][^"']*\bRqtd\b[^"']*["'][^>]*>(?:[\s\S]*?<\/strong>)?\s*([0-9.,]+)/i)
      || block.match(/Qtde\.?[:\s]*(?:<[^>]+>)*\s*([0-9.,]+)/i)
    const quantity = qtdMatch ? parseNum(qtdMatch[1]) : 1

    const unMatch = block.match(/class=["'][^"']*\bRUN\b[^"']*["'][^>]*>(?:[\s\S]*?<\/strong>)?\s*([A-Za-z0-9]+)/i)
      || block.match(/UN[:\s]*(?:<[^>]+>)*\s*([A-Za-z0-9]+)/i)
    const packageUnit = mapNfceUnit(unMatch ? clean(unMatch[1]) : 'un')

    const vlUnitMatch = block.match(/class=["'][^"']*\bRvlUnit\b[^"']*["'][^>]*>(?:[\s\S]*?<\/strong>)?\s*(?:R\$\s*)?([0-9.,]+)/i)
      || block.match(/Vl\.\s*Unit\.?[:\s]*(?:<[^>]+>)*\s*(?:R\$\s*)?([0-9.,]+)/i)
    const unitPrice = vlUnitMatch ? parseNum(vlUnitMatch[1]) : 0

    const totalItemMatch = block.match(/class=["'][^"']*\bvalor\b[^"']*["'][^>]*>\s*(?:R\$\s*)?([0-9.,]+)\s*<\/span>/i)
    const totalPrice = totalItemMatch ? parseNum(totalItemMatch[1]) : Number((quantity * unitPrice).toFixed(2))

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

  // 4. Fallback: Extrair itens do texto plano (ex.: texto copiado diretamente da página da SEFAZ no celular)
  if (items.length === 0) {
    const textItemRegex = /([^\n(]+?)\s*\(\s*C[óo]digo[:\s]*([^)]+?)\s*\)\s*Qtde\.?[:\s]*([0-9.,]+)\s*UN[:\s]*([A-Za-z0-9]+)\s*Vl\.\s*Unit\.?[:\s]*(?:R\$\s*)?([0-9.,]+)(?:\s*(?:Vl\.\s*Total[:\s]*)?(?:R\$\s*)?([0-9.,]+))?/gi
    for (const match of plainText.matchAll(textItemRegex)) {
      const rawDesc = match[1].replace(/\s+/g, ' ').trim()
      if (!rawDesc) continue
      const itemCode = match[2].trim()
      const quantity = parseNum(match[3]) || 1
      const packageUnit = mapNfceUnit(match[4])
      const unitPrice = parseNum(match[5])
      const totalPrice = match[6] ? parseNum(match[6]) : Number((quantity * unitPrice).toFixed(2))

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
  }

  if (items.length === 0) {
    if (/g-recaptcha|h-captcha|captcha|txtChaveAcesso/i.test(htmlString)) {
      throw new Error('A SEFAZ solicitou validação (Captcha) para exibir os produtos. Abra o link da nota no navegador, copie o texto da página e cole abaixo.')
    }
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
      valorTotal: totalDeclared || Number(items.reduce((acc, it) => acc + it.precoTotal, 0).toFixed(2)),
    },
    itens: items,
  }
}

export function isValidNfceHtml(html) {
  if (!html || typeof html !== 'string') return false
  // Rejeitar o próprio index.html do SPA (retornado pelo rewrite do Firebase Hosting)
  if (html.includes('<div id="root"></div>') || html.includes('/src/main.jsx')) return false
  // Rejeitar páginas de erro de proxy / Cloudflare
  if (/cf-error-details|Error 522|Oops\.\.\.\s*Request Timeout/i.test(html)) return false
  // Aceitar se contiver elementos reais de itens da NFC-e ou erro explícito da SEFAZ
  return /id=["']tabResult["']|class=["'][^"']*\btxtTit2?\b|class=["'][^"']*\bRCod\b|class=["'][^"']*\bRqtd\b|\(\s*C[óo]|C&#243;digo|C&oacute;digo|spnErro(?:Prosseguir)?Master/i.test(html)
}

export async function fetchNfceFromUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Informe uma URL válida da NFC-e.')
  }

  let cleanUrl = url.trim()
  if (/^(www\.|[a-z0-9-]+\.(fazenda|sefaz)\.)/i.test(cleanUrl)) {
    cleanUrl = `https://${cleanUrl}`
  }
  if (!cleanUrl.startsWith('http')) {
    throw new Error('Informe uma URL válida da NFC-e.')
  }
  cleanUrl = cleanUrl.replace(/^http:\/\/(www\.nfce\.fazenda\.sp\.gov\.br)/i, 'https://$1')

  let emptySefazPageSeen = false

  const checkHtml = (html) => {
    if (!html || typeof html !== 'string') return null
    if (isValidNfceHtml(html)) return html
    if (/Secretaria da Fazenda|Consulta NFC-e|NFCeConsultaPublica/i.test(html)) {
      emptySefazPageSeen = true
    }
    return null
  }

  // 1. Tentar proxy interno (/api/proxy-nfce) caso esteja rodando com Vite dev server
  try {
    const localRes = await fetch(`/api/proxy-nfce?url=${encodeURIComponent(cleanUrl)}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    })
    if (localRes.ok) {
      const valid = checkHtml(await localRes.text())
      if (valid) return valid
    }
  } catch {
    // Tentar próximo proxy
  }

  // 2. Tentar AllOrigins JSON format
  try {
    const allOriginsRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    })
    if (allOriginsRes.ok) {
      const data = await allOriginsRes.json()
      const valid = checkHtml(data?.contents)
      if (valid) return valid
    }
  } catch {
    // Tentar próximo proxy
  }

  // 3. Tentar CodeTabs proxy
  try {
    const codetabsRes = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    })
    if (codetabsRes.ok) {
      const valid = checkHtml(await codetabsRes.text())
      if (valid) return valid
    }
  } catch {
    // Tentar próximo proxy
  }

  // 4. Tentar CorsProxy.io
  try {
    const corsProxyRes = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(cleanUrl)}`, {
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    })
    if (corsProxyRes.ok) {
      const valid = checkHtml(await corsProxyRes.text())
      if (valid) return valid
    }
  } catch {
    // Falha em todos os proxies
  }

  if (emptySefazPageSeen) {
    throw new Error('A SEFAZ redirecionou a consulta sem exibir a lista de produtos (sessão ou bloqueio do portal). Abra o link da nota no navegador, copie o texto da página e cole abaixo.')
  }

  throw new Error('A SEFAZ bloqueou a leitura direta desta nota pelo aplicativo. Toque em "Abrir nota na SEFAZ", copie o texto da página e cole abaixo.')
}

export function buildReceiptPromptFromNfce(nfcePayload, products = [], options = {}) {
  const { includeCatalog = true } = options
  let prompt = `Analise os dados extraídos desta nota fiscal brasileira e formate-os em JSON padronizado conforme o catálogo.\n\nDados da Nota Fiscal:\n\`\`\`json\n${JSON.stringify(nfcePayload, null, 2)}\n\`\`\`\n\nResponda SOMENTE com JSON válido, sem markdown e sem explicações, seguindo a estrutura:\n{\n  "mercado": {\n    "nome": "${nfcePayload?.mercado?.nome || ''}",\n    "razaoSocial": "${nfcePayload?.mercado?.razaoSocial || ''}",\n    "cnpj": "${nfcePayload?.mercado?.cnpj || ''}",\n    "endereco": "${nfcePayload?.mercado?.endereco || ''}"\n  },\n  "compra": {\n    "data": "${nfcePayload?.compra?.data || ''}",\n    "numeroDocumento": "${nfcePayload?.compra?.numeroDocumento || ''}",\n    "valorTotal": ${Number(nfcePayload?.compra?.valorTotal || 0)}\n  },\n  "itens": [\n    {\n      "descricaoOriginal": "descrição original",\n      "produto": "nome genérico e limpo do produto",\n      "variedade": "sabor/tipo se aplicável ou vazio",\n      "marca": "marca se identificável ou vazio",\n      "categoria": "Hortifruti, Mercearia, Frios, Carnes, Bebidas, Limpeza, Higiene, Temperos ou Outros",\n      "quantidadeComprada": 1,\n      "conteudoEmbalagem": 1,\n      "unidadeConteudo": "un, kg, g, L ou ml",\n      "precoUnitario": 0.00,\n      "precoTotal": 0.00,\n      "codigoBarras": "código se houver"\n    }\n  ]\n}`

  if (includeCatalog && Array.isArray(products) && products.length > 0) {
    const catalog = products
      .filter((p) => p && !p.archivedAt)
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
    const barcodeDigits = onlyDigits(barcode || oldItem.barcode)
    const sourceKey = barcodeDigits ? `barcode:${barcodeDigits}` : `description:${normOriginal}`
    const existingIndex = updatedMappings.findIndex(
      (m) =>
        m.sourceKey === sourceKey ||
        normalizeText(m.importedDescription || m.sourceDescription || m.description || '') === normOriginal
    )
    const newMapping = {
      id: existingIndex >= 0 ? updatedMappings[existingIndex].id : uid(),
      sourceKey,
      sourceDescription: originalKey,
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

const DISTINCT_COMPOUND_PREFIXES = {
  leite: ['leite condensado', 'leite de coco', 'leite em po', 'leite fermentado', 'leite vegetal', 'leite de amendoa', 'leite de aveia', 'leite de soja', 'leite de arroz', 'leite ninho'],
  agua: ['agua sanitaria', 'agua de coco', 'agua oxigenada', 'agua tonica', 'agua micelar'],
  pao: ['pao de queijo', 'pao de alho', 'pao de mel'],
  batata: ['batata palha', 'batata doce', 'batata frita', 'batata congelada'],
  creme: ['creme de leite', 'creme dental', 'creme de avela', 'creme de ricota', 'creme de queijo', 'creme vegetal', 'creme capilar', 'creme de pentear'],
  papel: ['papel higienico', 'papel toalha', 'papel-toalha', 'papel aluminio', 'papel filme', 'papel manteiga', 'papel sulfite'],
  sabao: ['sabao em po', 'sabao em barra', 'sabao em pedra', 'sabao liquido', 'sabao em pasta'],
  milho: ['milho de pipoca'],
  oleo: ['oleo de coco', 'oleo essencial', 'oleo corporal'],
  farinha: ['farinha de trigo', 'farinha de rosca', 'farinha de mandioca', 'farinha de milho', 'farinha de aveia', 'farinha lactea', 'farinha panko'],
  molho: ['molho de tomate', 'molho ingles', 'molho shoyu', 'molho branco', 'molho pesto', 'molho barbecue', 'molho de pimenta', 'molho tare'],
}

function isDistinctCompoundProduct(shorterNorm, longerNorm) {
  const head = shorterNorm.split(/\s+/)[0]
  const exclusions = DISTINCT_COMPOUND_PREFIXES[shorterNorm] || DISTINCT_COMPOUND_PREFIXES[head] || []
  return exclusions.some((compound) => longerNorm === compound || longerNorm.startsWith(compound + ' '))
}

export function buildDismissedPairKey(id1, id2) {
  return [String(id1 || ''), String(id2 || '')].sort().join('::')
}

export function buildDismissedNamePairKey(name1, name2) {
  return [normalizeText(name1), normalizeText(name2)].sort().join('::')
}

export function findDuplicateProductSuggestions(products = [], options = {}) {
  const { dismissedPairIds = new Set(), dismissedMergePairs = [] } = options
  const dismissedIds = new Set(
    dismissedPairIds instanceof Set ? [...dismissedPairIds] : Array.isArray(dismissedPairIds) ? dismissedPairIds : []
  )
  const dismissedNames = new Set()

  if (Array.isArray(dismissedMergePairs)) {
    dismissedMergePairs.forEach((entry) => {
      if (!entry || entry.dismissed === false) return
      if (typeof entry === 'string') {
        dismissedIds.add(entry)
        return
      }
      if (entry.id) dismissedIds.add(String(entry.id))
      if (entry.leftId && entry.rightId) {
        dismissedIds.add(buildDismissedPairKey(entry.leftId, entry.rightId))
      }
      if (entry.leftName && entry.rightName) {
        dismissedNames.add(buildDismissedNamePairKey(entry.leftName, entry.rightName))
      }
    })
  }

  const activeProducts = products.filter((p) => p && !p.archivedAt)
  const suggestions = []

  for (let i = 0; i < activeProducts.length; i++) {
    for (let j = i + 1; j < activeProducts.length; j++) {
      const p1 = activeProducts[i]
      const p2 = activeProducts[j]

      const pairId = buildDismissedPairKey(p1.id, p2.id)
      if (dismissedIds.has(pairId)) continue

      const n1 = normalizeText(p1.name)
      const n2 = normalizeText(p2.name)
      if (!n1 || !n2) continue

      const namePairKey = buildDismissedNamePairKey(n1, n2)
      if (dismissedNames.has(namePairKey)) continue

      let match = null
      const compatibleCategory = p1.category === p2.category || p1.category === 'Outros' || p2.category === 'Outros'

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

      // 4. Minor typo / Levenshtein distance / singular-plural
      if (!match && compatibleCategory) {
        const minLen = Math.min(n1.length, n2.length)
        const maxLen = Math.max(n1.length, n2.length)
        const isPluralPair =
          minLen >= 3 &&
          (n1 === `${n2}s` || n2 === `${n1}s` || n1 === `${n2}es` || n2 === `${n1}es`)

        if (isPluralPair) {
          match = {
            score: 0.94,
            confidence: 'high',
            reason: 'Singular e plural do mesmo produto',
            type: 'fuzzy',
          }
        } else if (n1.slice(0, 2) === n2.slice(0, 2)) {
          const dist = levenshteinDistance(n1, n2)
          if (maxLen >= 5 && dist === 1) {
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
      }

      // 5. Containment match (e.g. "Café Pilão" vs "Café" or "Leite Integral" vs "Leite")
      if (!match && compatibleCategory) {
        const shorter = n1.length <= n2.length ? p1 : p2
        const longer = n1.length <= n2.length ? p2 : p1
        const shorterNorm = n1.length <= n2.length ? n1 : n2
        const longerNorm = n1.length <= n2.length ? n2 : n1

        const startsWithShorter = longerNorm.startsWith(`${shorterNorm} `)
        if (startsWithShorter && shorterNorm.length >= 3 && !isDistinctCompoundProduct(shorterNorm, longerNorm)) {
          match = {
            score: 0.85,
            confidence: 'high',
            reason: `"${longer.name}" contém "${shorter.name}" (possível marca ou sabor)`,
            type: 'containment',
          }
        }
      }

      // 6. Token similarity
      if (!match) {
        const t1 = tokenizeProductName(p1.name)
        const t2 = tokenizeProductName(p2.name)
        const shorterNorm = n1.length <= n2.length ? n1 : n2
        const longerNorm = n1.length <= n2.length ? n2 : n1

        if (t1.length > 0 && t2.length > 0 && !isDistinctCompoundProduct(shorterNorm, longerNorm)) {
          const sharedTokens = t1.filter((t) => t2.includes(t))
          const exactTokenSetMatch = sharedTokens.length === t1.length && sharedTokens.length === t2.length
          const sameHeadNoun = t1[0] === t2[0]

          if (sharedTokens.length > 0 && (exactTokenSetMatch || (sameHeadNoun && sharedTokens.length >= 2))) {
            const dice = (2 * sharedTokens.length) / (t1.length + t2.length)
            const sameCategory = p1.category === p2.category
            const oneIsOutros = p1.category === 'Outros' || p2.category === 'Outros'
            const finalScore = dice * 0.85 + (sameCategory ? 0.1 : oneIsOutros ? 0 : -0.2)

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

        if (n2.length < n1.length && (n1.startsWith(`${n2} `) || v2Count >= v1Count)) {
          left = p2
          right = p1
        } else if (n1.length < n2.length && n2.startsWith(`${n1} `)) {
          left = p1
          right = p2
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

export function inferredVariantValue(mainName, absorbedName) {
  const main = normalizeText(mainName)
  const mainWords = new Set(main.split(/\s+/).filter(Boolean))
  const words = String(absorbedName || '')
    .trim()
    .split(/\s+/)
    .filter((word) => !mainWords.has(normalizeText(word)))
  while (words.length > 0 && ['de', 'da', 'do', 'das', 'dos'].includes(normalizeText(words[0]))) {
    words.shift()
  }
  return words.join(' ').trim() || String(absorbedName || '').trim()
}

export function combineProductVariants(left, right, mode, variantValue, preview = false) {
  const variants = normalizeProductVariants(left?.variants).map((variant) => ({ ...variant }))
  const variantIdMap = {}
  const transformedById = {}
  let rightVariants = normalizeProductVariants(right?.variants)
  const fallbackUnit = right?.defaultUnit || left?.defaultUnit || 'un'
  if (mode === 'variant' && !rightVariants.length) {
    rightVariants = [
      {
        id: preview ? `preview-${right?.id || 'right'}` : uid(),
        variety: variantValue,
        brand: '',
        packageSize: 1,
        packageUnit: fallbackUnit,
        barcode: '',
        createdAt: nowIso(),
      },
    ]
  }
  rightVariants.forEach((source) => {
    const transformed = mode === 'variant' ? { ...source, variety: variantValue || source.variety || '' } : { ...source }
    transformedById[source.id] = transformed
    const existing = variants.find((variant) => variantMatchesItem(variant, transformed))
    if (existing) {
      variantIdMap[source.id] = existing.id
      if (!existing.barcode && transformed.barcode) existing.barcode = transformed.barcode
    } else {
      variants.push(transformed)
      variantIdMap[source.id] = transformed.id
    }
  })
  return { variants, variantIdMap, transformedById }
}

export function mergeCatalogProducts(state, plan) {
  const left = state.products.find((product) => product.id === plan.leftId)
  const right = state.products.find((product) => product.id === plan.rightId)
  if (!left || !right || left.id === right.id) return state

  const now = nowIso()
  const hadRightVariants = normalizeProductVariants(right.variants).length > 0
  const combined = combineProductVariants(left, right, plan.mode, plan.variantValue)
  const syntheticRightVariantId =
    !hadRightVariants && plan.mode === 'variant' ? combined.variants[combined.variants.length - 1]?.id : null
  let finalVariants = [...combined.variants]
  const usedRightPurchaseVariantIds = new Set()

  const resultName = (plan.result?.name || left.name || '').trim()
  const resultCategory = plan.result?.category || left.category || 'Outros'
  const resultDefaultUnit = plan.result?.defaultUnit || left.defaultUnit || 'un'

  const belongsTo = (item, product) => itemBelongsToProduct(state, item, product)

  const redirectPurchaseItem = (item) => {
    const fromRight = belongsTo(item, right)
    const fromLeft = belongsTo(item, left)
    if (!fromRight && !fromLeft) return item

    let redirected = {
      ...item,
      productId: left.id,
      productName: resultName,
      category: resultCategory,
    }
    if (fromRight && plan.mode === 'variant') {
      redirected = { ...redirected, variety: plan.variantValue || redirected.variety || '' }
    }
    if (fromRight && item.variantId && combined.variantIdMap[item.variantId]) {
      redirected.variantId = combined.variantIdMap[item.variantId]
    }
    let matching =
      finalVariants.find((variant) => variant.id && variant.id === redirected.variantId) ||
      finalVariants.find((variant) => variantMatchesItem(variant, redirected))

    if (!matching) {
      const createdVariant = {
        id: uid(),
        variety: redirected.variety || '',
        brand: redirected.brand || '',
        packageSize: Number(redirected.packageSize) || 1,
        packageUnit: redirected.packageUnit || resultDefaultUnit,
        barcode: redirected.barcode || '',
        createdAt: now,
        updatedAt: now,
      }
      finalVariants.push(createdVariant)
      matching = createdVariant
    } else if (!matching.barcode && redirected.barcode) {
      matching.barcode = redirected.barcode
    }

    redirected.variantId = matching.id
    if (fromRight) usedRightPurchaseVariantIds.add(matching.id)
    return redirected
  }

  const updatedPurchases = state.purchases.map((purchase) => ({
    ...purchase,
    items: purchase.items.map(redirectPurchaseItem),
  }))

  if (
    syntheticRightVariantId &&
    usedRightPurchaseVariantIds.size > 0 &&
    !usedRightPurchaseVariantIds.has(syntheticRightVariantId)
  ) {
    finalVariants = finalVariants.filter((variant) => variant.id !== syntheticRightVariantId)
  }

  const resultProduct = {
    ...left,
    ...plan.result,
    id: left.id,
    name: resultName,
    category: resultCategory,
    defaultUnit: resultDefaultUnit,
    aliases: [
      ...new Set(
        [...(left.aliases || []), ...(right.aliases || []), left.name, right.name].filter(
          (name) => normalizeText(name) !== normalizeText(resultName)
        )
      ),
    ],
    archivedAt: null,
    mergedIntoId: null,
    variants: finalVariants,
    brands: [...new Set(finalVariants.map((variant) => variant.brand).filter(Boolean))],
    updatedAt: now,
  }

  const redirectListItems = (items) =>
    items
      .map((item) => {
        const fromRight = belongsTo(item, right)
        const fromLeft = belongsTo(item, left)
        if (!fromLeft && !fromRight) return item
        const nextItem = {
          ...item,
          productId: left.id,
          name: resultProduct.name,
          category: resultProduct.category,
          unit: resultProduct.defaultUnit || item.unit,
        }
        if (fromRight && plan.mode === 'variant') {
          nextItem.variety = plan.variantValue || nextItem.variety || ''
        }
        if (fromRight && item.variantId && combined.variantIdMap[item.variantId]) {
          nextItem.variantId = combined.variantIdMap[item.variantId]
        }
        const matching =
          finalVariants.find((v) => v.id && v.id === nextItem.variantId) ||
          (nextItem.variety || nextItem.brand ? finalVariants.find((v) => variantMatchesItem(v, nextItem)) : null)
        if (matching) {
          nextItem.variantId = matching.id
        }
        return nextItem
      })
      .reduce((merged, item) => {
        const duplicate =
          item.productId === left.id
            ? merged.find(
                (saved) =>
                  saved.productId === left.id &&
                  (!saved.variantId || !item.variantId || saved.variantId === item.variantId)
              )
            : null
        if (!duplicate) return [...merged, item]
        return merged.map((saved) =>
          saved.id === duplicate.id
            ? {
                ...saved,
                variantId: saved.variantId || item.variantId || '',
                variety: saved.variety || item.variety || '',
                quantity: Number(saved.quantity || 0) + Number(item.quantity || 0),
                note: [...new Set([saved.note, item.note].filter(Boolean))].join(' · '),
              }
            : saved
        )
      }, [])

  const pairKey = buildDismissedPairKey(left.id, right.id)

  return refreshPurchaseMetadata({
    ...state,
    products: state.products.map((product) =>
      product.id === left.id
        ? resultProduct
        : product.id === right.id
          ? { ...product, archivedAt: now, mergedIntoId: left.id, updatedAt: now }
          : product
    ),
    purchases: updatedPurchases,
    lists: state.lists.map((list) => ({ ...list, items: redirectListItems(list.items) })),
    productMappings: (state.productMappings || []).map((mapping) =>
      mapping.productId === right.id
        ? {
            ...mapping,
            productId: left.id,
            productName: resultProduct.name,
            category: resultProduct.category,
            variantId: combined.variantIdMap[mapping.variantId] || mapping.variantId || '',
            updatedAt: now,
          }
        : mapping.productId === left.id
          ? {
              ...mapping,
              productName: resultProduct.name,
              category: resultProduct.category,
              updatedAt: now,
            }
          : mapping
    ),
    productNormalizations: [
      {
        id: uid(),
        leftProductId: left.id,
        rightProductId: right.id,
        leftName: left.name,
        rightName: right.name,
        resultName: resultProduct.name,
        mode: plan.mode,
        variantValue: plan.variantValue || '',
        createdAt: now,
        updatedAt: now,
      },
      ...(state.productNormalizations || []),
    ],
    dismissedMergePairs: (state.dismissedMergePairs || []).filter((entry) => entry?.id !== pairKey),
  })
}

export const PERIODICITY_OPTIONS = [
  { value: 'auto', label: 'Automática' },
  { value: '7', label: 'Semanal' },
  { value: '14', label: 'A cada 2 semanas' },
  { value: '30', label: 'Mensal' },
  { value: '60', label: 'A cada 2 meses' },
  { value: '90', label: 'A cada 3 meses' },
  { value: '0', label: 'Só quando eu quiser' },
]

export function categoryDefaultDays(category) {
  return (
    {
      Hortifruti: 7,
      Frios: 7,
      Carnes: 14,
      Mercearia: 30,
      Bebidas: 30,
      Limpeza: 60,
      Higiene: 60,
      Temperos: 60,
      Outros: 30,
    }[category] || 30
  )
}

export function nearestPeriod(days) {
  return [7, 14, 30, 60, 90].reduce(
    (best, value) => (Math.abs(value - days) < Math.abs(best - days) ? value : best),
    30
  )
}

export function periodicityLabel(days) {
  return (
    PERIODICITY_OPTIONS.find((option) => Number(option.value) === Number(days))?.label ||
    `A cada ${days} dias`
  )
}

export function purchasesForProduct(state, productOrName) {
  const product =
    typeof productOrName === 'object' && productOrName
      ? productOrName
      : (state.products || []).find(
          (p) => !p.archivedAt && normalizeText(p.name) === normalizeText(productOrName)
        ) ||
        (state.products || []).find(
          (p) => normalizeText(p.name) === normalizeText(productOrName)
        )
  const targetName = typeof productOrName === 'string' ? productOrName : product?.name || ''

  return (state.purchases || [])
    .filter((purchase) =>
      (purchase.items || []).some((item) =>
        product
          ? itemBelongsToProduct(state, item, product)
          : normalizeText(item.productName) === normalizeText(targetName)
      )
    )
    .sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt))
}

export function distinctPurchaseHistoryForProduct(state, productOrName) {
  const purchases = purchasesForProduct(state, productOrName)
  const seenDays = new Set()
  const distinct = []
  for (const purchase of purchases) {
    if (!purchase?.purchasedAt) continue
    const dateObj = new Date(purchase.purchasedAt)
    if (Number.isNaN(dateObj.getTime())) continue
    const dayKey = dateObj.toISOString().slice(0, 10)
    if (seenDays.has(dayKey)) continue
    seenDays.add(dayKey)
    distinct.push(purchase)
  }
  return distinct
}

export function calculateHistoryPeriodicity(state, product) {
  const distinctPurchases = distinctPurchaseHistoryForProduct(state, product)
  if (distinctPurchases.length < 2) return null

  const recent = distinctPurchases.slice(0, 6)
  const intervals = []
  for (let i = 0; i < recent.length - 1; i++) {
    const diffDays = Math.round(
      (new Date(recent[i].purchasedAt) - new Date(recent[i + 1].purchasedAt)) / 86400000
    )
    if (diffDays > 0) intervals.push(diffDays)
  }
  if (!intervals.length) return null

  const sorted = [...intervals].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const medianDays =
    sorted.length % 2 === 1
      ? sorted[mid]
      : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  const days = nearestPeriod(medianDays)

  return {
    days,
    label: periodicityLabel(days),
    medianDays,
    purchaseCount: distinctPurchases.length,
    latestPurchasedAt: distinctPurchases[0]?.purchasedAt || null,
  }
}

export function periodicityInfo(state, product) {
  if (product.recurrenceDays != null) {
    return {
      days: Number(product.recurrenceDays),
      label: periodicityLabel(Number(product.recurrenceDays)),
      source: 'manual',
    }
  }
  const historyCalc = calculateHistoryPeriodicity(state, product)
  if (historyCalc && product.dismissedRecurrenceSuggestion !== historyCalc.days) {
    return {
      days: historyCalc.days,
      label: historyCalc.label,
      source: 'history',
      medianDays: historyCalc.medianDays,
    }
  }
  const days = categoryDefaultDays(product.category)
  return { days, label: periodicityLabel(days), source: 'category' }
}

export function findPeriodicitySuggestions(state, options = {}) {
  const { includeDismissed = false } = options
  const suggestions = []

  for (const product of state.products || []) {
    if (!product || product.archivedAt || product.mergedIntoId) continue

    const historyCalc = calculateHistoryPeriodicity(state, product)
    if (!historyCalc) continue

    const suggestedDays = historyCalc.days
    const isAuto = product.recurrenceDays == null
    const currentDays = isAuto
      ? categoryDefaultDays(product.category)
      : Number(product.recurrenceDays)

    if (currentDays === suggestedDays) continue

    const isDismissed = Number(product.dismissedRecurrenceSuggestion) === suggestedDays
    if (isDismissed && !includeDismissed) continue

    const currentLabel = isAuto
      ? `Automática (${periodicityLabel(currentDays)})`
      : periodicityLabel(currentDays)
    const suggestedLabel = periodicityLabel(suggestedDays)

    suggestions.push({
      id: `periodicity-${product.id}`,
      product,
      productId: product.id,
      isAuto,
      currentDays,
      currentLabel,
      suggestedDays,
      suggestedLabel,
      medianDays: historyCalc.medianDays,
      purchaseCount: historyCalc.purchaseCount,
      latestPurchasedAt: historyCalc.latestPurchasedAt,
      dismissed: isDismissed,
      reason: `Comprado a cada ~${historyCalc.medianDays} ${historyCalc.medianDays === 1 ? 'dia' : 'dias'} (${historyCalc.purchaseCount} compras)`,
    })
  }

  return suggestions.sort((a, b) => {
    if (b.purchaseCount !== a.purchaseCount) return b.purchaseCount - a.purchaseCount
    return a.product.name.localeCompare(b.product.name, 'pt-BR')
  })
}

export function nextPurchaseSuggestions(state, list, now = new Date()) {
  const items = list?.items || []
  const inListNames = new Set(items.map((item) => normalizeText(item.name || item.productName)))
  const inListIds = new Set(items.map((item) => item.productId).filter(Boolean))
  const currentNow = now instanceof Date ? now : new Date(now)
  const candidates = []

  for (const product of state.products || []) {
    if (!product || product.archivedAt || product.mergedIntoId) continue
    if (inListIds.has(product.id) || inListNames.has(normalizeText(product.name))) continue

    const history = distinctPurchaseHistoryForProduct(state, product)
    if (!history.length && product.recurrenceDays == null) continue

    const frequency = periodicityInfo(state, product)
    if (frequency.days <= 0) continue

    const dueAt = history.length
      ? new Date(new Date(history[0].purchasedAt).getTime() + frequency.days * 86400000)
      : currentNow
    const daysUntil = Math.ceil((dueAt - currentNow) / 86400000)

    if (daysUntil <= 7) {
      candidates.push({
        product,
        daysUntil,
        frequency,
        lastPurchasedAt: history[0]?.purchasedAt || null,
      })
    }
  }

  return candidates
    .sort((a, b) => {
      if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil
      return a.product.name.localeCompare(b.product.name, 'pt-BR')
    })
    .map((entry) => entry.product)
}


