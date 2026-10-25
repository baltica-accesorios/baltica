import { db, schema } from '@/db'
import { currentUser } from '@/lib/auth'

// Copia de seguridad completa (sin fotos ni contraseñas) para que la dueña la guarde donde quiera.
export async function GET() {
  const u = await currentUser()
  if (u?.role !== 'duena') return new Response('Sin permiso', { status: 403 })
  const [products, sales, saleItems, stockMovements, purchases, customers, settings, labelTemplates] = await Promise.all([
    db.select().from(schema.products), db.select().from(schema.sales), db.select().from(schema.saleItems), db.select().from(schema.stockMovements),
    db.select().from(schema.purchases), db.select().from(schema.customers), db.select({ value: schema.settings.value }).from(schema.settings), db.select().from(schema.labelTemplates),
  ])
  const body = JSON.stringify({ generado: new Date().toISOString(), products, sales, saleItems, stockMovements, purchases, customers, settings, labelTemplates })
  return new Response(body, { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="baltica-respaldo-${new Date().toISOString().slice(0, 10)}.json"` } })
}
