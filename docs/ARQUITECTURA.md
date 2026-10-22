# Arquitectura propuesta para Báltica

Este documento acompaña al prototipo frontend. Explica cómo se construiría el sistema real, cómo se
resuelve el problema central (un solo stock para la tienda online y el mostrador, sin vender lo que no
hay), dónde conviene hospedarlo sin pagar mensualidades y qué más se le puede dar al dueño de la tienda.

## 1. Qué hay hoy y qué se quiere

| Hoy | Mañana |
|---|---|
| Tienda en Empretienda (plan mensual, plantilla Eris) | Tienda propia, idéntica para el cliente, en el mismo dominio |
| Stock en Empretienda + sistema de stock aparte (Loivers, pago mensual) | **Un solo stock**, descontado por la web y por el mostrador |
| Ventas presenciales cargadas a mano o no cargadas | POS con lector de barras, 10 segundos por venta |
| Sin costos ni ganancia | Costo por producto, ganancia real por venta, estadísticas |
| Facturas de proveedor en papel | Foto → stock + costo + precio sugerido |
| Sin códigos de barras propios | EAN-13 por producto, etiquetas imprimibles |

Restricción explícita del cliente: **no pagar nada mensual** (más allá de dominio y un hosting mínimo).

## 2. Arquitectura general

```
                 balticaaccesorios.com.ar
                 ┌───────────────────────────────────────────┐
  Cliente ──────▶│  /            tienda pública (SSR/SSG)    │
  Celular/PC ───▶│  /admin       panel de gestión (SPA)      │
  Lector USB ───▶│  /api/*       backend (Node, TypeScript)  │──▶ Postgres
                 │  /webhooks/*  Mercado Pago, Correo Arg.   │──▶ Storage (imágenes)
                 └───────────────────────────────────────────┘        │
                                                                  Modelo de visión
                                                                  (facturas por foto)
```

**Un solo deploy, un solo dominio.** La tienda pública y el panel son la misma aplicación Next.js
(o Remix): las rutas públicas se renderizan en servidor para SEO y velocidad (hoy Empretienda ya
posiciona en Google; no se puede perder eso), el panel es una SPA detrás de login. El backend vive
en el mismo proyecto como rutas API. Esto simplifica el deploy, el dominio, el HTTPS y los costos.

### Stack recomendado

| Capa | Elección | Por qué |
|---|---|---|
| Frontend | **Next.js 15 + React + TypeScript** | SSR para la tienda, SPA para el panel, un solo repo. El prototipo ya está en React, se migra casi 1:1. |
| Estilos | CSS propio para la tienda (réplica Eris) + Tailwind para el panel | La tienda tiene que ser pixel-perfect con la actual; el panel necesita velocidad de desarrollo. |
| Base de datos | **PostgreSQL** | Transacciones serias para el stock, gratis, corre en cualquier lado. SQLite sería suficiente en volumen pero complica el backup y la concurrencia. |
| ORM | Drizzle o Prisma | Migraciones versionadas, tipos compartidos con el frontend. |
| Auth | Sesión con cookie httpOnly, roles `dueña` / `vendedora` | Sin servicio externo. Las vendedoras pueden vender y ajustar stock, no ver costos ni estadísticas. |
| Imágenes | Storage S3-compatible (Cloudflare R2: 10 GB gratis) | Las 163 imágenes actuales pesan < 100 MB. |
| Pagos | Mercado Pago Checkout Pro (webhook) + transferencia | Es lo que ya usan. Sin comisión extra del sistema. |
| Envíos | Correo Argentino / Andreani vía API o tabla de precios manual | Empretienda hoy calcula por CP; se replica. |
| Lectura de facturas | Modelo de visión (Claude) con el catálogo como contexto | Pago por uso: una factura cuesta centavos. No es mensual. |
| Cámara para barcode | `@zxing/browser` en el navegador | Lo que usa el prototipo. Sin app nativa, funciona en Safari/Chrome móvil con HTTPS. |

## 3. Modelo de datos (núcleo)

```
products          id, slug, name, category_id, price, offer_price, wholesale_price, cost, sku, barcode, images[], active
product_variants  id, product_id, attr, value, stock, barcode (opcional por variante)
stock_movements   id, variant_id, delta, reason, ref_type, ref_id, user_id, created_at      ← fuente de verdad
sales             id, number, channel (online|local), status, payment, subtotal, discount, total, customer_id, seller_id
sale_items        sale_id, variant_id, qty, unit_price, unit_cost                         ← costo congelado al vender
purchases         id, supplier, invoice_number, date, total, status, photo_url
purchase_lines    purchase_id, variant_id, qty, unit_cost, suggested_price
customers         id, name, email, phone, wholesale_approved
label_templates   id, name, width_mm, height_mm, cols, fields
settings          markup_pct, round_to, low_stock_threshold
```

Dos decisiones importantes:

1. **El stock es la suma de movimientos**, no un número que se edita. `product_variants.stock` es una
   columna cacheada que se actualiza en la misma transacción que inserta el movimiento. Así siempre se
   puede responder "¿por qué hay 3?" y nunca se pierde una unidad.
2. **El costo se congela en cada venta** (`sale_items.unit_cost`). Si mañana el proveedor sube el precio, la
   ganancia de las ventas de ayer no cambia. Las estadísticas de ganancia son reales, no estimadas.

## 4. Concurrencia de stock: el problema real

Escenario: queda **1** "Anillo Alma 1.6cm". A las 17:02:10 una clienta lo pone en el carrito online y
está pagando en Mercado Pago. A las 17:02:30 Sol lo escanea en el mostrador y cobra. ¿Quién se lo lleva?

### Reglas

- **El carrito no reserva.** Igual que hoy en Empretienda (y en Tiendanube, Shopify): poner algo en el
  carrito no descuenta nada. Reservar en carrito bloquea mercadería por gente que abandona.
- **El mostrador descuenta al cobrar.** Es físico: la pieza se la lleva en la mano.
- **La venta online descuenta al confirmar el pago** (webhook de Mercado Pago `payment.approved`) o al
  crear el pedido si es por transferencia (con un vencimiento: si no se paga en 48 h, se libera).
- **Primer confirmado gana.** El segundo recibe un mensaje claro y accionable.

### Implementación: una transacción con bloqueo de fila

```sql
BEGIN;
SELECT stock FROM product_variants WHERE id = $1 FOR UPDATE;   -- bloquea la fila
-- si stock < qty  →  ROLLBACK y error "sin stock"
UPDATE product_variants SET stock = stock - $2 WHERE id = $1 AND stock >= $2;
-- si UPDATE afectó 0 filas → ROLLBACK (doble chequeo, protege contra carreras)
INSERT INTO stock_movements (variant_id, delta, reason, ref_id) VALUES ($1, -$2, 'venta_local', $3);
INSERT INTO sale_items ...;
COMMIT;
```

`SELECT ... FOR UPDATE` serializa los dos cobros sobre la misma pieza: el mostrador y el webhook de
Mercado Pago se ejecutan uno después del otro, nunca a la vez. El `WHERE stock >= qty` en el UPDATE es
la red de seguridad: aunque algo se olvide del lock, el stock no puede quedar negativo. Con Postgres
esto es gratis y suficiente para el volumen de la tienda (decenas de ventas por día, no miles por segundo).

### Qué pasa en cada caso de carrera

| Caso | Resultado |
|---|---|
| Online paga primero, mostrador escanea después | El POS muestra "Sin stock: se vendió online hace 20 s (venta #1043)". Sol lo saca de la bolsa. |
| Mostrador cobra primero, online paga después | El webhook llega con stock 0. El sistema marca el pedido como **"a resolver"**, avisa por WhatsApp/email a Báltica, y propone: reponer (si hay en depósito), ofrecer alternativa, o reembolsar con un click. No se cobra dos veces porque el reembolso es automático en MP si se elige. |
| Dos pestañas del POS a la vez | Mismo lock. La segunda recibe error claro. |
| Internet cortado en el local | El POS guarda la venta en cola local (IndexedDB) y la sincroniza al volver. Como el mostrador es físico, la venta ya ocurrió; el riesgo es vender online en el medio, que se resuelve como el caso 2. Es un modo degradado, no el normal. |
| Stock en 0 en la web | El producto se muestra "Sin stock" (igual que hoy), no se oculta: sigue posicionando en Google. |

### Cómo lo refleja el prototipo

El POS y el checkout verifican stock antes de confirmar y bloquean la venta si no alcanza; cancelar una
venta devuelve stock vía un movimiento `devolucion`. Como es frontend puro, no hay lock; el documento
describe cómo se agrega en el backend sin cambiar la experiencia.

## 5. Lector de códigos de barras

- **Lector físico (USB o Bluetooth, $25k a $60k):** se comporta como un teclado. El panel escucha
  ráfagas de teclas rápidas terminadas en Enter en cualquier pantalla (ver `useKeyboardWedge`). No hace
  falta configurar nada ni instalar drivers. Recomendados: Netum, Inateck, Symcode, cualquier 1D/2D.
- **Celular:** la cámara lee EAN-13 y QR desde el navegador (`@zxing/browser`). Requiere HTTPS, que ya
  tiene el dominio. Sirve para el conteo de inventario caminando por el local y para consultar precios.
- **Códigos propios:** EAN-13 con prefijo 779 (Argentina) + número interno + dígito verificador. No hace
  falta registrarse en GS1 porque los códigos se usan sólo dentro del negocio. Si un producto ya trae
  código del proveedor, se escanea y se guarda ese.
- **Etiquetas:** impresora térmica (Niimbot B1 ~$80k, Xprinter/Zebra ~$150k a $250k) para rollos, o
  cualquier impresora con hojas A4 autoadhesivas. El panel genera el PDF con la plantilla elegida.

## 6. Dónde hospedarlo (sin mensualidad)

El criterio es: costo cero o casi cero, HTTPS, un solo lugar para todo, backups.

| Opción | Costo | Pros | Contras |
|---|---|---|---|
| **VPS chico (Hetzner CX22, DonWeb, Contabo)** | ~USD 4/mes, se puede pagar anual | Todo en una máquina: Next.js + Postgres + imágenes. Control total, sin vendor lock-in. | Hay que mantenerlo (updates, backups). Se automatiza con un script. |
| **Fly.io / Railway (plan gratuito o hobby)** | USD 0 a 5/mes | Deploy por git push, Postgres administrado, HTTPS automático. | Los planes gratis cambian; el hobby es USD 5. |
| **Vercel (front) + Neon (Postgres) + R2 (imágenes)** | USD 0 en free tier | Cero mantenimiento, escala sola, deploy automático desde GitHub. | Tres proveedores; el free tier de Neon pausa la base si no se usa (se despierta en 1 s). |
| Cloudflare Pages + D1 + R2 | USD 0 | Todo en Cloudflare. | D1 (SQLite) tiene límites y menos garantías transaccionales. |

**Recomendación:** empezar con **Vercel + Neon + R2** (costo cero, sin servidores que cuidar, HTTPS y
dominio en 5 minutos) y, si el volumen crece o se quiere independencia total, mover a un VPS: el código
es el mismo porque es Next.js + Postgres estándar. El único gasto fijo real es el dominio (~$15k/año),
que ya tienen.

Costos variables únicos: lectura de facturas por foto (~$5 a $20 por factura según el modelo) y la
comisión de Mercado Pago, que ya pagan hoy.

Backups: `pg_dump` diario a R2 (gratis) + export CSV mensual que la dueña se guarda. Las ventas y los
movimientos de stock nunca se borran físicamente.

## 7. Migración desde Empretienda

Empretienda no expone API pública. Camino probado:

1. **Productos:** export Excel desde el panel (nombre, categoría, precio, oferta, stock, SKU, variantes,
   dimensiones, URLs de imágenes). Se importa con un script idempotente (se puede correr N veces).
2. **Imágenes:** se descargan desde las URLs del CDN de Empretienda (son públicas) y se suben a R2.
3. **Clientes y mayoristas:** export de clientes. Las contraseñas no se migran (Empretienda no las
   exporta, y es correcto); los clientes reciben un email para crear una nueva. Los mayoristas aprobados
   conservan su estado.
4. **Historial de ventas:** export de ventas, para que las estadísticas tengan historia desde el día uno.
5. **URLs:** se respetan exactamente (`/anillos/anillos-acero-quirurgico/anillo-alma-acero-quirurgico`).
   Google no pierde nada. Si Empretienda cambió algún slug, se agrega un redirect 301.
6. **Día D:** última corrida del script a la mañana, cambio de DNS, ambas tiendas conviven unas horas,
   baja del plan al mes siguiente.

## 8. Funcionalidades que le simplifican la vida a la dueña (más allá del pedido)

Ordenadas por impacto/esfuerzo. Las marcadas ✅ ya están en el prototipo.

- ✅ **Cobertura en días** por producto y "cuánto reponer para 30 días" en las alertas de stock.
- ✅ **Precio sugerido** por regla de ganancia configurable; al cargar una factura, avisa qué productos
  subieron de costo y propone el nuevo precio.
- ✅ **Aumento masivo por %** (inflación): seleccionar categoría, +15 %, listo.
- ✅ **Conteo de inventario con el celular** y aplicación de diferencias con un click.
- ✅ **Ganancia real por venta** con costo congelado, y por producto, categoría, día, hora, canal.
- ✅ **Ticket imprimible** y vendedora asociada a cada venta de mostrador.
- **Cierre de caja diario:** efectivo esperado vs. contado, por vendedora. (1 día de trabajo)
- **Pedido de reposición automático:** a partir de las alertas, generar un PDF/WhatsApp al proveedor
  con lo que hay que pedir. (1 día)
- **Ventas por WhatsApp/Instagram como canal:** hoy muchas ventas "online" no pasan por la web. Un canal
  `whatsapp` en el POS las registra con dos toques y descuenta stock. (medio día)
- **Clientes frecuentes:** historial de compras por teléfono, para fidelización y para "¿qué talle usaba?".
- **Notificación de stock bajo por WhatsApp** una vez por día, con lo urgente. (medio día)
- **Apartados / señas:** reservar una pieza con seña en el mostrador, con vencimiento. (1 día)
- **Multi-depósito:** showroom vs. casa, si crecen. El modelo de movimientos ya lo soporta con un campo.
- **Permisos:** vendedoras ven precios y stock, no costos ni estadísticas. (medio día)
- **Modo offline del POS** con cola de sincronización. (2 días)
- **Facturación AFIP** (factura electrónica) vía un proveedor como Facturante/TusFacturas: integración
  por API, pago por uso. Lo pidieron a futuro, no ahora.

## 9. Plan de implementación estimado

| Fase | Contenido | Esfuerzo |
|---|---|---|
| 1 | Backend (Postgres, auth, productos, stock con transacciones, ventas) + migración de productos e imágenes | 2 semanas |
| 2 | Tienda pública en Next.js pixel-perfect + checkout con Mercado Pago + envíos | 2 semanas |
| 3 | Panel: POS, stock, escáner, etiquetas, estadísticas (el prototipo se porta casi directo) | 2 semanas |
| 4 | Facturas por foto con modelo de visión, migración de clientes/ventas, día D | 1 semana |
| 5 | Mejoras de la sección 8 según prioridad del cliente | continuo |

Total de la versión que reemplaza a Empretienda + Loivers: **~7 semanas** de una persona.
