import Link from 'next/link'

export const INFO: Record<string, { title: string; body: string }> = {
  'talles-anillos': { title: 'Talles anillos', body: 'Medí el diámetro interno de un anillo que te quede bien con una regla. Los talles disponibles van de 1.5cm a 2.1cm.' },
  'cambios': { title: 'Cambios', body: 'Tenés 30 días para realizar cambios presentando el ticket. El producto debe estar sin uso y con su packaging original.' },
  'cuidados-y-limpieza': { title: 'Cuidados y limpieza', body: 'Evitá el contacto con perfumes, cremas y agua salada. Limpiá tus accesorios con un paño suave y seco.' },
  'mayoristas': { title: 'Mayoristas', body: 'Solicitá tu cuenta mayorista desde Mi cuenta → Cuenta mayorista. Una vez aprobada vas a ver los precios mayoristas en toda la tienda.' },
}

export function InfoPage({ page }: { page: string }) {
  const info = INFO[page]
  return (
    <div className="container sf-page">
      <nav className="sf-bc"><Link href="/">Inicio</Link><span className="sep">/</span><span>{info.title}</span></nav>
      <h1><span>{info.title}</span></h1>
      <p style={{ maxWidth: 700, margin: `0 auto ${page === 'mayoristas' ? 24 : 80}px`, lineHeight: 1.7, textAlign: 'center' }}>{info.body}</p>
      {page === 'mayoristas' && <p style={{ textAlign: 'center', marginBottom: 80 }}><Link href="/cuenta/mayorista" className="sf-btn">Solicitar cuenta mayorista</Link></p>}
    </div>
  )
}
