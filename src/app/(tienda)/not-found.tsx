import Link from 'next/link'

export default function NotFound() {
  return <div className="container sf-page"><h1><span>Página no encontrada</span></h1><p style={{ textAlign: 'center', marginBottom: 80 }}><Link href="/productos" style={{ textDecoration: 'underline' }}>Ver todos los productos</Link></p></div>
}
