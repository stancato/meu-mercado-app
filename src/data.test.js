import test from 'node:test'
import assert from 'node:assert/strict'
import { parseJsonInput } from './data.js'

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
