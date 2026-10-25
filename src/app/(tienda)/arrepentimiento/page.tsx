import { ContactForm } from '@/storefront/pages/Account'

export const metadata = { title: 'Botón de arrepentimiento' }

export default function Page() {
  return <ContactForm kind="arrepentimiento" title="Botón de arrepentimiento" intro={'Podés revocar tu compra dentro de los 10 días corridos desde que recibiste el producto (Ley 24.240 y Resolución 424/2020 de la Secretaría de Comercio Interior), salvo productos personalizados y los comprendidos en el art. 1116 del Código Civil y Comercial.\n\nCompletá el formulario y te mandamos por email el código de tu solicitud.'} />
}
