import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts'
import { useStore } from '../../store/useStore'
import { PageHeader, Card, Stat } from '../components/AdminLayout'
import { inRange, summary, byDay, topProducts, byCategory, byWeekday, byHour, byPayment } from '../../lib/metrics'
import { money, moneyShort, pct } from '../../lib/format'
import { categoryName } from '../../data/categories'

const COLORS = ['#1c1917', '#d97706', '#78716c', '#f59e0b', '#a8a29e', '#fbbf24', '#d6d3d1', '#fde68a']

export function Stats() {
  const { sales, products } = useStore()
  const [days, setDays] = useState(30)
  const now = new Date()
  const from = useMemo(() => { const d = new Date(now); d.setDate(now.getDate() - (days - 1)); d.setHours(0, 0, 0, 0); return d }, [days])
  const cur = useMemo(() => inRange(sales, from, now), [sales, from])
  const prevFrom = new Date(from); prevFrom.setDate(from.getDate() - days)
  const prev = useMemo(() => inRange(sales, prevFrom, from), [sales, from, days])
  const s = summary(cur), ps = summary(prev)
  const d = (a: number, b: number) => b ? (a - b) / b : 0
  const series = byDay(sales, days)
  const top = topProducts(cur, products, 10)
  const cats = byCategory(cur, products)
  const wd = byWeekday(cur)
  const hrs = byHour(cur)
  const pay = byPayment(cur)
  const online = cur.filter(x => x.channel === 'online'), local = cur.filter(x => x.channel === 'local')
  const bestDay = [...series].sort((a, b) => (b.online + b.local) - (a.online + a.local))[0]
  const noSale = series.filter(x => x.count === 0).length

  return (
    <>
      <PageHeader title="Estadísticas" subtitle="Todo lo que necesitás saber del negocio, comparado con el período anterior.">
        <div className="flex bg-white border rounded-lg overflow-hidden">{[7, 30, 90].map(n => <button key={n} onClick={() => setDays(n)} className={`px-3 py-1.5 text-sm ${days === n ? 'bg-stone-900 text-white' : ''}`}>{n} días</button>)}</div>
      </PageHeader>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Stat label="Ventas totales" value={moneyShort(s.revenue)} sub={`${d(s.revenue, ps.revenue) >= 0 ? '▲' : '▼'} ${pct(Math.abs(d(s.revenue, ps.revenue)))} vs. anterior`} tone={d(s.revenue, ps.revenue) >= 0 ? 'good' : 'bad'} />
        <Stat label="Ganancia neta" value={moneyShort(s.profit)} sub={`margen ${pct(s.margin)} · costo mercadería ${moneyShort(s.cost)}`} tone="good" />
        <Stat label="Cantidad de ventas" value={String(s.count)} sub={`${s.units} unidades · ticket prom. ${moneyShort(s.ticket)}`} />
        <Stat label="Días con ventas" value={`${s.days} de ${days}`} sub={`${noSale} días sin vender · mejor día ${bestDay?.label} (${moneyShort(bestDay ? bestDay.online + bestDay.local : 0)})`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat label="Mostrador" value={moneyShort(local.reduce((a, x) => a + x.total, 0))} sub={`${local.length} ventas · ${pct(s.revenue ? local.reduce((a, x) => a + x.total, 0) / s.revenue : 0)} del total`} />
        <Stat label="Tienda online" value={moneyShort(online.reduce((a, x) => a + x.total, 0))} sub={`${online.length} ventas · ${pct(s.revenue ? online.reduce((a, x) => a + x.total, 0) / s.revenue : 0)} del total`} />
        <Stat label="Promedio por día" value={moneyShort(s.revenue / days)} sub="ventas / días del período" />
        <Stat label="Ganancia por día con ventas" value={moneyShort(s.days ? s.profit / s.days : 0)} tone="good" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2" title="Ventas y ganancia por día">
          <div className="h-72"><ResponsiveContainer><LineChart data={series} margin={{ left: 0, right: 8 }}><CartesianGrid vertical={false} stroke="#eee" /><XAxis dataKey="label" tick={{ fontSize: 11 }} interval={Math.ceil(days / 10)} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11 }} tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'} axisLine={false} tickLine={false} width={48} /><Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Legend wrapperStyle={{ fontSize: 12 }} /><Line type="monotone" dataKey="local" name="Mostrador" stroke="#1c1917" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="online" name="Online" stroke="#d97706" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="profit" name="Ganancia" stroke="#059669" strokeWidth={2} dot={false} strokeDasharray="4 3" /></LineChart></ResponsiveContainer></div>
        </Card>
        <Card title="Ventas por categoría">
          <div className="h-48"><ResponsiveContainer><PieChart><Pie data={cats.slice(0, 8)} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>{cats.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} /></PieChart></ResponsiveContainer></div>
          <ul className="text-xs space-y-1 mt-2">{cats.slice(0, 6).map((c, i) => <li key={c.name} className="flex items-center gap-2"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: COLORS[i] }} /><span className="flex-1">{categoryName(c.name)}</span><span className="font-medium">{moneyShort(c.value)}</span><span className="text-stone-400 w-10 text-right">{pct(c.value / s.revenue)}</span></li>)}</ul>
        </Card>
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Qué día de la semana se vende más"><div className="h-48"><ResponsiveContainer><BarChart data={wd}><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Bar dataKey="total" name="Ventas" fill="#1c1917" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card title="A qué hora entran las ventas"><div className="h-48"><ResponsiveContainer><BarChart data={hrs}><XAxis dataKey="h" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={1} /><Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} /><Bar dataKey="count" name="Ventas" fill="#d97706" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card title="Medios de pago"><ul className="text-sm divide-y">{pay.map(p => <li key={p.name} className="py-2 flex items-center gap-3"><span className="capitalize flex-1">{p.name}</span><div className="w-28 h-2 bg-stone-100 rounded-full overflow-hidden"><div className="h-full bg-stone-900" style={{ width: pct(p.value / s.revenue) }} /></div><span className="w-20 text-right font-medium">{moneyShort(p.value)}</span></li>)}</ul></Card>
      </div>
      <Card title="Ranking de productos">
        <table className="w-full text-sm"><thead className="text-xs uppercase text-stone-500 text-left"><tr><th className="pb-2">#</th><th className="pb-2">Producto</th><th className="pb-2 text-right">Unidades</th><th className="pb-2 text-right">Facturado</th><th className="pb-2 text-right">Ganancia</th><th className="pb-2 text-right">Margen</th><th className="pb-2 text-right">Stock</th></tr></thead>
          <tbody className="divide-y">{top.map((t, i) => <tr key={t.product!.id}><td className="py-2 text-stone-400">{i + 1}</td><td className="py-2"><div className="flex items-center gap-2"><img src={t.product!.image} className="w-8 h-8 rounded object-cover" alt="" />{t.product!.name}</div></td><td className="py-2 text-right">{t.qty}</td><td className="py-2 text-right">{moneyShort(t.revenue)}</td><td className="py-2 text-right text-emerald-700">{moneyShort(t.profit)}</td><td className="py-2 text-right">{pct(t.profit / t.revenue)}</td><td className={`py-2 text-right ${t.product!.stock <= 2 ? 'text-red-600 font-medium' : ''}`}>{t.product!.stock}</td></tr>)}</tbody></table>
      </Card>
    </>
  )
}
