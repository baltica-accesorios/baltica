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
  minStock?: number
  markupPct?: number     // % de ganancia propio del producto (si no, usa el de configuración)
  sku: string
  barcode: string        // EAN-13 generado por el sistema (o el del proveedor)
  image: string
  images?: string[]
  description?: string
  variants?: Variant | null
  createdAt: string
  active?: boolean
}

export interface SaleItem {
  productId: string
  name: string
  qty: number
  unitPrice: number      // precio al momento de la venta
  unitCost: number       // costo al momento de la venta (para ganancia real)
  variant?: string
}

export type PaymentMethod = 'efectivo' | 'transferencia' | 'debito' | 'credito' | 'mercadopago' | 'qr'
export type SaleStatus = 'pagada' | 'pendiente' | 'enviada' | 'entregada' | 'cancelada'

export interface Sale {
  id: string
  number: number
  channel: Channel
  createdAt: string
  items: SaleItem[]
  subtotal: number
  discount: number
  total: number
  payment: PaymentMethod
  status: SaleStatus
  customer?: { name: string; email?: string; phone?: string; city?: string }
  note?: string
  seller?: string
}

export type MovementReason = 'venta_online' | 'venta_local' | 'compra' | 'ajuste' | 'devolucion' | 'migracion' | 'rotura'

export interface StockMovement {
  id: string
  productId: string
  delta: number
  reason: MovementReason
  ref?: string          // id de venta / compra
  createdAt: string
  by: string
}

export interface PurchaseLine { productId?: string; description: string; qty: number; unitCost: number; matched: boolean; markupPct: number; suggestedPrice: number; barcode?: string }
export interface Purchase {
  id: string
  supplier: string
  date: string
  invoiceNumber?: string
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

export interface Settings {
  storeName: string
  defaultMarkup: number     // % de ganancia sobre el costo para sugerir precio
  roundTo: number           // redondeo de precio sugerido
  lowStockThreshold: number
  sellers: string[]
  aiInvoices: boolean       // lectura de facturas por foto con IA (opcional, con la cuenta de Claude del cliente)
  anthropicKey?: string
}
