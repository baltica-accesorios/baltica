import Link from 'next/link'

export const INFO: Record<string, { title: string; body: string }> = {
  'talles-anillos': { title: 'Talles anillos', body: 'Medí el diámetro interno de un anillo que te quede bien con una regla. Los talles disponibles van de 1.5cm a 2.1cm.' },
  'cambios': { title: 'Cambios', body: 'Tenés 30 días para realizar cambios presentando el ticket. El producto debe estar sin uso y con su packaging original.' },
  'cuidados-y-limpieza': { title: 'Cuidados y limpieza', body: 'Evitá el contacto con perfumes, cremas y agua salada. Limpiá tus accesorios con un paño suave y seco.' },
  'mayoristas': { title: 'Mayoristas', body: 'Para comprar por mayor escribinos por WhatsApp o a nuestro email y te pasamos la lista de precios mayoristas.' },
  'contacto': { title: 'Contacto', body: 'Escribinos a baltica.sn@gmail.com o por WhatsApp al 3364349507. Showroom en San Nicolás de los Arroyos.' },
  'arrepentimiento': { title: 'Botón de arrepentimiento', body: 'Podés revocar tu compra dentro de los 10 días corridos desde que recibiste el producto (Ley 24.240, art. 34). Escribinos a baltica.sn@gmail.com o por WhatsApp al 3364349507 indicando tu número de pedido y te respondemos en menos de 24 horas con los pasos para la devolución.' },
}

export function InfoPage({ page }: { page: string }) {
  const info = INFO[page]
  return (
    <div className="container sf-page">
      <nav className="sf-bc"><Link href="/">Inicio</Link><span className="sep">/</span><span>{info.title}</span></nav>
      <h1><span>{info.title}</span></h1>
      <p style={{ maxWidth: 700, margin: '0 auto 80px', lineHeight: 1.7, textAlign: 'center' }}>{info.body}</p>
    </div>
  )
}
