# Báltica Accesorios · prototipo de tienda propia + panel de gestión

Prototipo **frontend** (sin backend) para reemplazar la tienda que hoy corre en Empretienda
([balticaaccesorios.com.ar](https://balticaaccesorios.com.ar)) por un deploy propio que mantiene
**exactamente la misma tienda de cara al público** y agrega un **panel de administración** con todo lo
que el negocio pidió: stock unificado online + mostrador, lector de códigos de barras, ventas presenciales,
costos y ganancias, estadísticas, carga de facturas por foto, etiquetas y migración desde Empretienda.

- Demo: **https://solsolettidev.github.io/baltica/** (tienda) · **https://solsolettidev.github.io/baltica/admin** (panel)
- Análisis de arquitectura, concurrencia de stock y deploy: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
- Guía de qué mirar en la demo: [`docs/DEMO.md`](docs/DEMO.md)

> Todo lo que se ve funciona de verdad en el navegador (los datos se guardan en `localStorage`).
> Vender en mostrador descuenta stock que la tienda pública ve al instante, comprar online aparece en
> el panel, cancelar una venta devuelve stock, etc. Lo único simulado es la lectura de la foto de
> factura (en producción la hace un modelo de visión) y el asistente de migración.

## Cómo correrlo

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # genera dist/ (GH_PAGES=1 pnpm build para la demo en GitHub Pages)
```

## Estructura

```
src/
  storefront/      Tienda pública. Réplica de la plantilla "Eris" de Empretienda (Lato, negro/blanco, mismas URLs).
    components/    Layout (header, menú, buscador, footer, WhatsApp), CartDrawer, ProductCard
    pages/         Home, Category (listado + filtros + orden), Product, Checkout, páginas de info
  admin/           Panel de gestión en /admin (mismo dominio).
    components/    AdminLayout (sidebar), Scanner (lector USB + cámara + generador de código de barras)
    pages/         Dashboard, POS, Sales, Products, Stock, Scanner, Purchases, Labels, Stats, Migration, Settings
  store/           Estado global (zustand + persist). seed.ts genera 120 días de ventas realistas.
  data/            Árbol de categorías real de la tienda, banners, logo.
  lib/             Tipos de dominio, formato de moneda/fechas, EAN-13, métricas.
  seed_products.json   163 productos reales (nombre, imagen, precio, categoría) con costo, stock y código generados.
```

## Qué hace cada módulo del panel

| Módulo | Qué resuelve | Detalle |
|---|---|---|
| **Vender (mostrador)** | Carga de ventas presenciales en segundos | Escaneo con lector o cámara, búsqueda por nombre, variantes, descuento, medio de pago, vendedora, vuelto, ticket imprimible. Bloquea si no hay stock. |
| **Ventas** | Online + mostrador en una lista | Estados (pendiente, pagada, enviada, entregada, cancelada), ganancia por venta, exportar CSV. Cancelar devuelve stock. |
| **Productos** | ABM con costo y código de barras | Mismos campos que Empretienda + costo, stock mínimo, SKU, EAN-13. Precio sugerido por regla de ganancia. Aumento masivo por %. |
| **Stock** | Un solo stock para los dos canales | Alertas, cobertura en días, valorización a costo y a venta, historial de movimientos (quién/cuándo/por qué), conteo físico escaneando. |
| **Escáner** | Consultar un producto al instante | Ficha con precio, stock y margen. Lector USB/Bluetooth (modo teclado) o cámara del celular. |
| **Compras y facturas** | Carga de compras, con lectura por foto **opcional** | Lee renglones con Claude (modelo de visión), matchea con el catálogo entendiendo abreviaturas, actualiza costo, calcula el precio final con el % de ganancia de cada producto, suma stock. La IA usa la cuenta de Claude (Anthropic) del cliente, pago por uso; sin ella se carga a mano. |
| **Etiquetas** | Códigos de barras con precio | Plantillas por formato (rollo 22×12, 50×25, hoja A4, sin precio), editables. Impresión desde el navegador. |
| **Estadísticas** | Todas las métricas del negocio | Ventas, ganancia neta, margen, ticket, días con venta, por canal, por categoría, por día de semana, por hora, medios de pago, ranking de productos. Comparado contra el período anterior. |
| **Migrar Empretienda** | Traer productos, imágenes, clientes y ventas | Asistente en 4 pasos a partir de los exports de Empretienda. Plan del día del cambio de dominio. |
| **Configuración** | Reglas del negocio | % de ganancia por defecto, redondeo, umbral de stock bajo, vendedoras. |

## Stack

React 19 + TypeScript + Vite · react-router · zustand · Tailwind 4 (sólo en el panel; la tienda usa CSS propio que
replica la plantilla) · recharts · @zxing/browser (cámara) · jsbarcode (etiquetas).
