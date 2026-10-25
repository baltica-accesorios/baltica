export type Channel = 'online' | 'local'

export interface Variant { attr: string; options: string[] }

export interface Product {
  id: string
  slug: string
  name: string
  category: string
  subcategory?: string | null
  material: string
  price: number          // precio de venta al público
  offerPrice?: number | null
  wholesalePrice?: number | null
  cost: number           // costo de reposición (último costo de compra)
  stock: number
  minStock?: number | null
  markupPct?: number | null // % de ganancia propio del producto (si no, usa el de configuración)
  sku: string
  barcode: string        // EAN-13 generado por el sistema (o el del proveedor)
  image: string
  images?: string[]
  description?: string | null
  variants?: Variant | null
  createdAt: string
  active?: boolean
}

// Lo que ve la tienda pública: sin costo ni datos internos
export type PublicProduct = Pick<Product, 'id' | 'slug' | 'name' | 'category' | 'subcategory' | 'price' | 'offerPrice' | 'stock' | 'image' | 'images' | 'description' | 'variants' | 'createdAt'>

export interface SaleItem {
  productId: string
  name: string
  qty: number
  unitPrice: number      // precio al momento de la venta
  unitCost: number       // costo al momento de la venta (para ganancia real)
  variant?: string | null
}

export interface Customer { name: string; email?: string; phone?: string; city?: string; address?: string; zip?: string }

export type PaymentMethod = 'efectivo' | 'transferencia' | 'debito' | 'credito' | 'mercadopago' | 'qr'
// a_resolver: se cobró por Mercado Pago pero el stock ya no alcanzaba (lo vendieron en el mostrador mientras pagaba)
export type SaleStatus = 'pagada' | 'pendiente' | 'enviada' | 'entregada' | 'cancelada' | 'a_resolver'

export interface Sale {
  id: string
  number: number
  channel: Channel
  createdAt: string
  items: SaleItem[]
  subtotal: number
  discount: number
  shipping?: number
  total: number
  payment: PaymentMethod
  status: SaleStatus
  customer?: Customer | null
  shippingMethod?: string | null
  note?: string | null
  seller?: string | null
  stockApplied?: boolean
  mpPaymentId?: string | null
}

export type MovementReason = 'venta_online' | 'venta_local' | 'compra' | 'ajuste' | 'devolucion' | 'migracion' | 'rotura'

export interface StockMovement {
  id: string
  productId: string
  delta: number
  reason: MovementReason
  ref?: string | null   // id de venta / compra
  createdAt: string
  by: string
}

export interface PurchaseLine { productId?: string; description: string; qty: number; unitCost: number; matched: boolean; markupPct: number; suggestedPrice: number; barcode?: string }
export interface Purchase {
  id: string
  supplier: string
  date: string
  invoiceNumber?: string | null
  lines: PurchaseLine[]
  total: number
  status: 'borrador' | 'confirmada'
  source: 'foto' | 'manual' | 'repetida'
}

export interface LabelTemplate {
  id: string
  name: string
  widthMm: number
  heightMm: number
  cols: number
  showPrice: boolean
  showName: boolean
  showSku: boolean
  description: string
}

export interface ShippingOption { id: string; name: string; price: number; description: string }

export interface Settings {
  storeName: string
  defaultMarkup: number     // % de ganancia sobre el costo para sugerir precio
  roundTo: number           // redondeo de precio sugerido
  lowStockThreshold: number
  sellers: string[]
  aiInvoices: boolean       // lectura de facturas por foto con IA (opcional, con la cuenta de Claude de Báltica)
  transferDiscountPct: number
  transferInfo: string      // alias / CBU que ve el cliente al elegir transferencia
  cashOnPickup: boolean     // permitir "efectivo al retirar"
  shippingOptions: ShippingOption[]
  whatsapp: string
  email: string
  instagram: string
}

export interface User { id: number; name: string; email: string; role: 'duena' | 'vendedora' }
