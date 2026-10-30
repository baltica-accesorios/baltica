import { test } from 'node:test'
import assert from 'node:assert/strict'
import ts from 'typescript'
import { readFileSync, writeFileSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
// Compile pure domain modules without needing a running Next server or database.
const dir = mkdtempSync(join(tmpdir(), 'baltica-domain-'))
for (const file of ['pricing', 'promotions', 'variants', 'metrics', 'validation']) {
  const source = readFileSync(new URL(`../src/lib/${file}.ts`, import.meta.url), 'utf8')
  writeFileSync(join(dir, `${file}.js`), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText)
}
symlinkSync(new URL('../node_modules', import.meta.url).pathname, join(dir, 'node_modules'), 'dir')
const require = createRequire(import.meta.url)
const { promotionalProduct, twoForOneDiscount, activePromotion } = require(join(dir, 'promotions.js'))
const { buildVariants, variantPrice } = require(join(dir, 'variants.js'))
const { filterSalesCategory, summary } = require(join(dir, 'metrics.js'))
const { settingsPatch, productInput } = require(join(dir, 'validation.js'))
process.on('exit', () => rmSync(dir, { recursive: true, force: true }))
const product = { id: 'p1', category: 'grabados', price: 1000 }
const pct = { id: 'p', type: 'pct', value: 20, active: true, name: '20%' }
const two = { id: 'two', type: '2x1', value: 0, active: true, name: '2x1', category: 'grabados' }
test('offer eligibility: future, expired and disabled rules do not change prices', () => {
  assert.equal(promotionalProduct(product, [{ ...pct, startsAt: '2099-01-01' }]).price, 1000)
  assert.equal(activePromotion({ ...pct, endsAt: '2000-01-01' }), false)
  assert.equal(activePromotion({ ...pct, active: false }), false)
  assert.equal(promotionalProduct(product, [{ ...pct, category: 'anillos' }]).offerPrice, undefined)
})
test('best percentage wins without overwriting a better individual offer', () => {
  assert.equal(promotionalProduct(product, [pct]).offerPrice, 800)
  assert.equal(promotionalProduct({ ...product, offerPrice: 600 }, [pct]).offerPrice, 600)
  assert.equal(promotionalProduct(product, [{ ...pct, value: 23, roundTo: 100 }]).offerPrice, 800)
})
test('2x1 works across lines and variants, free cheaper units, odd quantities and overlap', () => {
  const line = { productId: 'p1', category: 'grabados', qty: 1, price: 1000 }
  assert.equal(twoForOneDiscount([line], [two]), 0)
  assert.equal(twoForOneDiscount([{ ...line, qty: 5 }], [two]), 2000)
  assert.equal(twoForOneDiscount([line, { ...line, productId: 'p2', price: 600 }], [two]), 600)
  assert.equal(twoForOneDiscount([{ ...line, qty: 4 }], [two, { ...two, id: 'duplicate' }]), 2000)
  assert.equal(twoForOneDiscount([{ ...line, category: 'anillos', qty: 4 }], [two]), 0)
})
test('multiple attributes create deterministic stock keys and preserve variant details', () => {
  const v = buildVariants([{ attr: 'Color', options: ['Rojo', 'Azul'] }, { attr: 'Tamaño', options: ['S', 'M'] }])
  assert.deepEqual(v.options, ['Rojo / S', 'Rojo / M', 'Azul / S', 'Azul / M'])
  assert.equal(buildVariants([]), null)
  assert.equal(variantPrice({ ...product, variants: { ...v, details: { 'Rojo / S': { price: 1500 } } }, offerPrice: 800 }, 'Rojo / S'), 1200)
})
test('category metrics exclude other items and allocate order discount without shipping', () => {
  const sale = { id: 's1', number: 1, channel: 'online', status: 'pagada', createdAt: '2026-10-28T12:00:00Z', subtotal: 3000, discount: 300, shipping: 500, total: 3200, items: [{ productId: 'p1', qty: 1, unitPrice: 1000, unitCost: 400 }, { productId: 'p2', qty: 1, unitPrice: 2000, unitCost: 800 }] }
  const filtered = filterSalesCategory([sale], [product, { id: 'p2', category: 'anillos' }], 'grabados')
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].discount, 100)
  assert.equal(summary(filtered).revenue, 900)
  assert.equal(summary(filtered).profit, 500)
  assert.equal(summary(filtered).units, 1)
  assert.deepEqual(filterSalesCategory([sale], [product], 'inexistente'), [])
})

test('settings reject executable URLs, negative shipping and malformed promotions', () => {
  assert.equal(settingsPatch.safeParse({ banners: [{ image: '/img/a', href: 'javascript:alert(1)', alt: '' }] }).success, false)
  assert.equal(settingsPatch.safeParse({ banners: [{ image: '//evil.example/a', href: '/productos', alt: '' }] }).success, false)
  assert.equal(settingsPatch.safeParse({ shippingOptions: [{ id: 'cadete', name: 'Cadete', price: -1, description: '' }] }).success, false)
  assert.equal(settingsPatch.safeParse({ promotions: [{ ...pct, startsAt: '2026-12-01', endsAt: '2026-01-01' }] }).success, false)
  assert.equal(settingsPatch.safeParse({ promotions: [{ ...pct, value: 101 }] }).success, false)
  assert.equal(settingsPatch.safeParse({ announcement: 'Envíos a todo el país' }).success, true)
})
test('combination generation bounds avoid unbounded product expansion', () => {
  assert.throws(() => buildVariants(Array.from({ length: 5 }, () => ({ attr: 'A', options: Array.from({ length: 100 }, (_, i) => String(i)) }))), /500/)
})

const { matchingVariants, optionVariant, variantImages, decorateAttributes, attributesOf } = require(join(dir, 'variants.js'))
const colored = {
  stock: 5, image: '/general.jpg', images: ['/general.jpg', '/other.jpg'],
  variants: { ...buildVariants([{ attr: 'Color', options: ['Rojo', 'Azul', 'Verde'] }, { attr: 'Tamaño', options: ['S', 'M'] }]), details: { 'Azul / M': { images: ['/blue.jpg', '/blue2.jpg'] } } },
  variantStock: { 'Rojo / S': 2, 'Rojo / M': 0, 'Azul / S': 0, 'Azul / M': 3, 'Verde / S': 0, 'Verde / M': 0 },
}
test('attribute filters require stock in the same combination, with OR within one facet', () => {
  assert.deepEqual(matchingVariants(colored, { color: ['rojo'], tamano: ['m'] }), [])
  assert.deepEqual(matchingVariants(colored, { color: ['rojo', 'azul'], tamano: ['m'] }), ['Azul / M'])
  assert.deepEqual(matchingVariants(colored, { color: ['verde'] }), [])
  assert.deepEqual(matchingVariants(colored, { desconocido: ['s'] }), [])
})
test('changing color finds an available size; sold-out sizes and colors cannot be selected', () => {
  assert.equal(optionVariant(colored, 'Rojo / S', 0, 'Azul'), 'Azul / M')
  assert.equal(optionVariant(colored, 'Rojo / S', 1, 'M'), undefined)
  assert.equal(optionVariant(colored, 'Rojo / S', 0, 'Verde'), undefined)
})
test('variant galleries prioritize related photos and retain clickable general photos', () => {
  assert.deepEqual(variantImages(colored, 'Azul / M'), ['/blue.jpg', '/blue2.jpg', '/general.jpg', '/other.jpg'])
  assert.deepEqual(variantImages(colored, 'Rojo / S'), ['/general.jpg', '/other.jpg'])
})
test('legacy sizes stay usable and catalog color changes decorate existing products', () => {
  const legacy = { variants: { attr: 'Talle', options: ['16', '17'] }, stock: 2, variantStock: { '16': 0, '17': 2 } }
  assert.equal(attributesOf(legacy.variants)[0].attr, 'Talle')
  assert.deepEqual(matchingVariants(legacy, { talle: ['17'] }), ['17'])
  const updated = decorateAttributes(colored, [{ id: 'colors', name: 'Color', type: 'color', values: [{ label: 'Rojo', color: '#ff0000' }] }])
  assert.equal(updated.variants.attributes[0].colors.Rojo, '#ff0000')
  assert.deepEqual(updated.variants.options, colored.variants.options)
})
test('color definitions require safe color values and variant galleries accept local photos', () => {
  assert.equal(settingsPatch.safeParse({ attributes: [{ id: 'c', name: 'Color', type: 'color', values: [{ label: 'Rojo' }] }] }).success, false)
  assert.equal(settingsPatch.safeParse({ attributes: [{ id: 'c', name: 'Color', type: 'color', values: [{ label: 'Rojo', color: '#ff0000' }] }] }).success, true)
})

const { productStockTotal, redistributionError, variantStructureChanged } = require(join(dir, 'variants.js'))
test('redistribution preserves total and blocks both missing and excess stock', () => {
  const variants = buildVariants([{ attr: 'Color', options: ['Rojo', 'Azul'] }])
  const p = { stock: 10, variants, variantStock: { Rojo: 6, Azul: 0 } }
  assert.equal(productStockTotal(p), 6)
  assert.match(redistributionError(10, productStockTotal(p)), /4 unidades por asignar/)
  assert.equal(redistributionError(10, productStockTotal({ ...p, variantStock: { Rojo: 6, Azul: 4 } })), '')
  assert.match(redistributionError(10, 11), /1 unidades de más/)
  assert.equal(productStockTotal({ stock: 10, variants: null }), 10)
})
test('stock redistribution detects added, removed and renamed attributes but ignores option order and photos', () => {
  const before = buildVariants([{ attr: 'Color', options: ['Rojo', 'Azul'] }])
  assert.equal(variantStructureChanged(null, before), true)
  assert.equal(variantStructureChanged(before, null), true)
  assert.equal(variantStructureChanged(before, buildVariants([{ attr: 'Color', options: ['Azul', 'Rojo'] }])), false)
  assert.equal(variantStructureChanged(before, { ...before, details: { Rojo: { image: '/r.jpg' } } }), false)
  assert.equal(variantStructureChanged(before, buildVariants([{ attr: 'Diseño', options: ['Rojo', 'Azul'] }])), true)
})
