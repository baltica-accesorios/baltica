import type { LabelTemplate, Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  storeName: 'Báltica Accesorios',
  defaultMarkup: 120,
  roundTo: 100,
  lowStockThreshold: 2,
  sellers: ['Sol', 'Nati'],
  aiInvoices: false,
  transferDiscountPct: 10,
  transferInfo: 'Alias: (completar en Configuración)',
  cashOnPickup: true,
  shippingOptions: [
    { id: 'retiro', name: 'Retiro en showroom', price: 0, description: 'San Nicolás de los Arroyos. Te avisamos por WhatsApp cuando esté listo.' },
    { id: 'cadete', name: 'Cadete en San Nicolás', price: 2500, description: 'Entrega en el día dentro de San Nicolás.' },
    { id: 'correo', name: 'Correo Argentino a domicilio', price: 7500, description: 'Envío a todo el país, de 3 a 6 días hábiles.' },
  ],
  whatsapp: '5493364349507',
  email: 'baltica.sn@gmail.com',
  instagram: 'https://instagram.com/baltica.accesorios',
}

export const DEFAULT_TEMPLATES: LabelTemplate[] = [
  { id: 't1', name: 'Joyería colgante 22×12', widthMm: 22, heightMm: 12, cols: 4, showPrice: true, showName: false, showSku: true, description: 'Etiqueta tipo "rat tail" para anillos y argollas. Código chico, precio grande.' },
  { id: 't2', name: 'Estándar 50×25', widthMm: 50, heightMm: 25, cols: 2, showPrice: true, showName: true, showSku: true, description: 'Para cajas, alhajeros y perfumeros. Nombre, precio y código.' },
  { id: 't3', name: 'Hoja A4 (65 etiquetas)', widthMm: 38, heightMm: 21, cols: 5, showPrice: true, showName: true, showSku: false, description: 'Impresora común con hoja autoadhesiva Pimaco/Avery 38×21.' },
  { id: 't4', name: 'Sin precio 30×20', widthMm: 30, heightMm: 20, cols: 3, showPrice: false, showName: true, showSku: true, description: 'Para mayoristas o cuando el precio cambia seguido.' },
]
