import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ShoppingCart, ScanBarcode, Camera, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { PageHeader, Stat, Card, btnPrimary, btnGhost } from '../components/AdminLayout'
import { inRange, summary, byDay, topProducts, coverageDays } from '../../lib/metrics'
import { money, moneyShort, pct, timeAR } from '../../lib/format'

export function Dashboard() {
  const { sales, products, settings } = useStore()
  const now = new Date()
  const start = (d: number) => { const x = new Date(now); x.setDate(now.getDate() - d); x.setHours(0, 0, 0, 0); return x }
  const today = summary(inRange(sales, start(0), now))
  const month = summary(inRange(sales, start(29), now))
  const prevMonth = summary(inRange(sales, start(59), start(30)))
  const delta = prevMonth.revenue ? (month.revenue - prevMonth.revenue) / prevMonth.revenue : 0
  const series = byDay(sales, 30)
  const low = products.filter(p => p.stock <= (p.minStock ?? settings.lowStockThreshold)).sort((a, b) => a.stock - b.stock)
  const top = topProducts(inRange(sales, start(29), now), products, 5)
  const recent = [...sales].reverse().slice(0, 6)
  const runningOut = products.filter(p => p.stock > 0).map(p => ({ p, d: coverageDays(p, sales) })).filter(x => x.d < 14).sort((a, b) => a.d - b.d).slice(0, 5)

  return (
    <>
      <PageHeader title={`Hola, Sol 👋`} subtitle={`${now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}. Así va el negocio.`}>
        <Link to="/admin/pos" className={btnPrimary}><ShoppingCart size={16} /> Nueva venta en mostrador</Link>
        <Link to="/admin/escaner" className={btnGhost}><ScanBarcode size={16} /> Escanear</Link>
        <Link to="/admin/compras/nueva" className={btnGhost}><Camera size={16} /> Cargar factura</Link>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Vendido hoy" value={moneyShort(today.revenue)} sub={`${today.count} ventas · ganancia ${moneyShort(today.profit)}`} />
        <Stat label="Últimos 30 días" value={moneyShort(month.revenue)} sub={`${delta >= 0 ? '▲' : '▼'} ${pct(Math.abs(delta))} vs. 30 días anteriores`} tone={delta >= 0 ? 'good' : 'bad'} />
        <Stat label="Ganancia 30 días" value={moneyShort(month.profit)} sub={`margen ${pct(month.margin)} · ticket prom. ${moneyShort(month.ticket)}`} tone="good" />
        <Stat label="Stock bajo" value={String(low.length)} sub={low.length ? `${low.filter(p => p.stock === 0).length} sin stock` : 'todo en orden'} tone={low.length ? 'warn' : 'good'} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2" title="Ventas de los últimos 30 días" action={<Link to="/admin/estadisticas" className="text-sm text-stone-500 hover:underline flex items-center gap-1">Ver estadísticas <ArrowRight size={14} /></Link>}>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1c1917" stopOpacity={.25} /><stop offset="100%" stopColor="#1c1917" stopOpacity={0} /></linearGradient>
                  <linearGradient id="go" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d97706" stopOpacity={.3} /><stop offset="100%" stopColor="#d97706" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#eee" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={4} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(v) => money(Number(v))} labelStyle={{ fontWeight: 600 }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="local" name="Mostrador" stackId="1" stroke="#1c1917" fill="url(#gl)" strokeWidth={2} />
                <Area type="monotone" dataKey="online" name="Tienda online" stackId="1" stroke="#d97706" fill="url(#go)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 text-xs text-stone-500 mt-2"><span className="flex items-center gap-1"><i className="w-3 h-0.5 bg-stone-900 inline-block" />Mostrador</span><span className="flex items-center gap-1"><i className="w-3 h-0.5 bg-amber-600 inline-block" />Tienda online</span></div>
        </Card>
        <Card title="Se está por acabar" action={<Link to="/admin/stock" className="text-sm text-stone-500 hover:underline">Ver stock</Link>}>
          <p className="text-xs text-stone-500 mb-3">Según el ritmo de venta de los últimos 30 días.</p>
          <ul className="divide-y">
            {runningOut.map(({ p, d }) => (
              <li key={p.id} className="py-2 flex items-center gap-3"><img src={p.image} className="w-9 h-9 rounded object-cover" alt="" /><div className="min-w-0 flex-1"><div className="text-sm truncate">{p.name}</div><div className="text-xs text-stone-500">quedan {p.stock} · ~{Math.ceil(d)} días</div></div><TrendingDown size={16} className="text-red-500" /></li>
            ))}
            {runningOut.length === 0 && <li className="py-2 text-sm text-stone-500">Nada urgente.</li>}
          </ul>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Últimas ventas" action={<Link to="/admin/ventas" className="text-sm text-stone-500 hover:underline">Ver todas</Link>}>
          <table className="w-full text-sm">
            <tbody className="divide-y">{recent.map(s => (
              <tr key={s.id}><td className="py-2 text-stone-500 w-16">{timeAR(s.createdAt)}</td><td className="py-2"><span className={`text-[10px] px-1.5 py-0.5 rounded-full mr-2 ${s.channel === 'local' ? 'bg-stone-900 text-white' : 'bg-amber-100 text-amber-800'}`}>{s.channel === 'local' ? 'MOSTRADOR' : 'ONLINE'}</span>{s.items.map(i => i.name).join(', ')}</td><td className="py-2 text-right font-medium">{moneyShort(s.total)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
        <Card title="Lo más vendido (30 días)">
          <ul className="divide-y">{top.map((t, i) => (
            <li key={t.product!.id} className="py-2 flex items-center gap-3"><span className="text-stone-400 w-4 text-sm">{i + 1}</span><img src={t.product!.image} className="w-9 h-9 rounded object-cover" alt="" /><div className="flex-1 min-w-0"><div className="text-sm truncate">{t.product!.name}</div><div className="text-xs text-stone-500">{t.qty} u. · ganancia {moneyShort(t.profit)}</div></div><TrendingUp size={16} className="text-emerald-500" /></li>
          ))}</ul>
        </Card>
      </div>
    </>
  )
}
