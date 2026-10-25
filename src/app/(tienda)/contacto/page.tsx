import { getSettings } from '@/lib/data'
import { ContactForm } from '@/storefront/pages/Account'

export const metadata = { title: 'Contacto' }

export default async function Page() {
  const s = await getSettings()
  return <ContactForm kind="contacto" title="Contacto" intro={`Escribinos y te respondemos a la brevedad. También podés escribirnos a ${s.email} o por WhatsApp al ${s.whatsapp.replace(/^549/, '')}. Showroom en San Nicolás de los Arroyos.`} />
}
