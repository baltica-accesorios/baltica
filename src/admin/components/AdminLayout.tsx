import { NavLink, Outlet, Link } from 'react-router-dom'
import { LayoutDashboard, Package, Boxes, ScanBarcode, ShoppingCart, Receipt, Camera, Tag, Database, BarChart3, Settings, Store, ExternalLink, AlertTriangle } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { LOGO } from '../../data/categories'

const NAV = [
  { to: '/admin', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/admin/pos', label: 'Vender (mostrador)', icon: ShoppingCart, hot: true },
  { to: '/admin/ventas', label: 'Ventas', icon: Receipt },
  { to: '/admin/productos', label: 'Productos', icon: Package },
  { to: '/admin/stock', label: 'Stock', icon: Boxes },
  { to: '/admin/escaner', label: 'Escáner', icon: ScanBarcode },
  { to: '/admin/compras', label: 'Compras y facturas', icon: Camera },
  { to: '/admin/etiquetas', label: 'Etiquetas', icon: Tag },
  { to: '/admin/estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { to: '/admin/migracion', label: 'Migrar Empretienda', icon: Database },
  { to: '/admin/configuracion', label: 'Configuración', icon: Settings },
]

export function AdminLayout() {
  const low = useStore(s => s.products.filter(p => p.stock <= (p.minStock ?? s.settings.lowStockThreshold)).length)
  const pending = useStore(s => s.sales.filter(x => x.status === 'pendiente').length)
  return (
    <div className="adm min-h-screen bg-stone-100 text-stone-900 flex">
      <aside className="hidden md:flex w-64 shrink-0 bg-stone-950 text-stone-300 flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-stone-800 flex items-center gap-3">
          <img src={LOGO} alt="" className="h-10 invert" />
          <div><div className="text-white font-semibold leading-tight">Báltica</div><div className="text-xs text-stone-500">Panel de gestión</div></div>
        </div>
        <nav className="flex-1 overflow-auto py-3">
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex items-center gap-3 px-5 py-2.5 text-sm transition ${isActive ? 'bg-stone-800 text-white border-r-2 border-amber-400' : 'hover:bg-stone-900 hover:text-white'} ${n.hot ? 'font-semibold text-amber-300' : ''}`}>
              <n.icon size={18} />{n.label}
              {n.to === '/admin/stock' && low > 0 && <span className="ml-auto text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5">{low}</span>}
              {n.to === '/admin/ventas' && pending > 0 && <span className="ml-auto text-[10px] bg-amber-400 text-black rounded-full px-1.5 py-0.5">{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-stone-800 text-xs">
          <Link to="/" className="flex items-center gap-2 text-stone-400 hover:text-white"><Store size={14} /> Ver tienda pública <ExternalLink size={12} /></Link>
          <div className="mt-3 text-stone-600">Prototipo frontend. Los datos viven en tu navegador.</div>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <div className="md:hidden bg-stone-950 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <span className="font-semibold">Báltica · Panel</span>
          <Link to="/admin/pos" className="text-amber-300 text-sm font-semibold">Vender</Link>
        </div>
        <nav className="md:hidden flex overflow-x-auto gap-1 bg-white border-b px-2 py-2 text-xs sticky top-12 z-10">
          {NAV.map(n => <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `px-3 py-1.5 rounded-full whitespace-nowrap ${isActive ? 'bg-stone-900 text-white' : 'bg-stone-100'}`}>{n.label}</NavLink>)}
        </nav>
        <main className="p-4 md:p-8 max-w-7xl"><Outlet /></main>
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="text-stone-500 text-sm mt-1 max-w-2xl">{subtitle}</p>}</div>
      <div className="flex gap-2 flex-wrap">{children}</div>
    </div>
  )
}
export function Card({ children, className = '', title, action }: { children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }) {
  return <section className={`bg-white rounded-xl border border-stone-200 shadow-sm ${className}`}>{title && <div className="flex items-center justify-between px-5 pt-4"><h2 className="font-semibold">{title}</h2>{action}</div>}<div className="p-5">{children}</div></section>
}
export function Hint({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" /><div>{children}</div></div>
}
export const btn = 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed'
export const btnPrimary = btn + ' bg-stone-900 text-white hover:bg-stone-700'
export const btnGhost = btn + ' bg-white border border-stone-300 hover:bg-stone-50'
export const input = 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/20'
export function Stat({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'good' | 'bad' | 'warn' }) {
  const t = { default: 'text-stone-900', good: 'text-emerald-600', bad: 'text-red-600', warn: 'text-amber-600' }[tone]
  return <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm"><div className="text-xs uppercase tracking-wide text-stone-500">{label}</div><div className={`text-2xl font-bold mt-1 ${t}`}>{value}</div>{sub && <div className="text-xs text-stone-500 mt-1">{sub}</div>}</div>
}
