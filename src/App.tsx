import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { StoreLayout } from './storefront/components/Layout'
import { Home } from './storefront/pages/Home'
import { Category } from './storefront/pages/Category'
import { ProductPage } from './storefront/pages/Product'
import { InfoPage, Checkout, Thanks } from './storefront/pages/Misc'
import { AdminLayout } from './admin/components/AdminLayout'
import { Dashboard } from './admin/pages/Dashboard'
import { POS } from './admin/pages/POS'
import { Sales } from './admin/pages/Sales'
import { Products, ProductForm } from './admin/pages/Products'
import { Stock } from './admin/pages/Stock'
import { ScannerPage } from './admin/pages/Scanner'
import { Purchases, NewPurchase } from './admin/pages/Purchases'
import { Labels } from './admin/pages/Labels'
import { Stats } from './admin/pages/Stats'
import { Migration } from './admin/pages/Migration'
import { SettingsPage } from './admin/pages/Settings'
import { INFO_PAGES, CATEGORIES } from './data/categories'
import { useParams } from 'react-router-dom'

// Las URLs de Empretienda son planas: /talles-anillos es una página de info, /anillos una categoría,
// /anillos/anillos-plata una subcategoría y /fantasia/choker-marron un producto. Resolvemos por slug.
function ResolveOne() { const { page } = useParams(); return INFO_PAGES.some(p => p.slug === page) ? <InfoPage /> : <Category /> }
function ResolveTwo() { const { cat, sub } = useParams(); const c = CATEGORIES.find(c => c.slug === cat); return c?.children?.some(s => s.slug === sub) ? <Category /> : <ProductPage slug={sub} /> }

function ScrollTop() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0) }, [pathname]); return null }

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ScrollTop />
      <Routes>
        {/* ===== Panel de administración (mismo dominio, /admin) ===== */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="pos" element={<POS />} />
          <Route path="ventas" element={<Sales />} />
          <Route path="productos" element={<Products />} />
          <Route path="productos/nuevo" element={<ProductForm />} />
          <Route path="productos/:id" element={<ProductForm />} />
          <Route path="stock" element={<Stock />} />
          <Route path="escaner" element={<ScannerPage />} />
          <Route path="compras" element={<Purchases />} />
          <Route path="compras/nueva" element={<NewPurchase />} />
          <Route path="etiquetas" element={<Labels />} />
          <Route path="estadisticas" element={<Stats />} />
          <Route path="migracion" element={<Migration />} />
          <Route path="configuracion" element={<SettingsPage />} />
        </Route>
        {/* ===== Tienda pública: mismas URLs que hoy en Empretienda ===== */}
        <Route element={<StoreLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/productos" element={<Category all />} />
          <Route path="/buscar" element={<Category search />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/gracias/:n" element={<Thanks />} />
          <Route path="/contacto" element={<InfoPage />} />
          <Route path="/:page" element={<ResolveOne />} />
          <Route path="/:cat/:sub" element={<ResolveTwo />} />
          <Route path="/:cat/:sub/:slug" element={<ProductPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
