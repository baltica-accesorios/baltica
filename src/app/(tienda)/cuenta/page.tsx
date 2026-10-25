import { sql } from 'drizzle-orm'
import { db, schema } from '@/db'
import { currentCustomer } from '@/lib/customer-auth'
import { AccountHome, AuthForms } from '@/storefront/pages/Account'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mi cuenta', robots: { index: false } }

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const me = await currentCustomer()
  if (!me) return <AuthForms next={(await searchParams).next} />
  // Pedidos online hechos con su email (también los anteriores a crear la cuenta)
  const rows = await db.execute<{ number: number; created_at: string; total: number; status: string; items: string }>(sql`
    select s.number, s.created_at, s.total, s.status, string_agg(i.qty || '× ' || i.name, ', ') as items
    from ${schema.sales} s join ${schema.saleItems} i on i.sale_number = s.number
    where s.channel = 'online' and lower(s.customer->>'email') = ${me.email}
    group by s.number order by s.created_at desc limit 50`)
  const orders = [...rows].map(r => ({ number: r.number, createdAt: new Date(r.created_at).toISOString(), total: r.total, status: r.status, items: r.items }))
  return <AccountHome me={me} orders={orders} />
}
