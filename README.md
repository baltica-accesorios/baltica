# Báltica Accesorios · tienda online + panel de gestión

Reemplazo de la tienda de Empretienda ([balticaaccesorios.com.ar](https://balticaaccesorios.com.ar)) por un
sistema propio: la **misma tienda de cara al público**, con **cobro por Mercado Pago**, y un **panel de
administración** con stock unificado online + mostrador, punto de venta con lector de códigos de barras,
costos y ganancias, estadísticas, compras (con lectura de facturas por foto opcional), etiquetas
diseñables y migración asistida desde Empretienda.

## Qué hace

**Tienda (lo que ve el cliente)**
- Misma plantilla, menú, categorías y URLs que la tienda de Empretienda (no se pierde posicionamiento en Google).
- Ofertas con cartel **"20% OFF"**, precio tachado y **fecha de fin**: al vencer, vuelve sola al precio normal.
- Franja de aviso arriba de todo ("¡Sólo por hoy domingo! -20%…"), editable desde el panel.
- Botón **Comprar** en cada producto, carrito lateral, checkout con envíos configurables.
- Pagos: **transferencia** (con los datos e instrucciones de siempre), **Mercado Pago** y efectivo al retirar (los dos últimos se activan cuando quieran).
- Talles con stock propio (los agotados aparecen tachados), cupones de descuento, envío calculado por código postal.
- Cuentas de clientes con historial de pedidos y cuentas mayoristas con precios mayoristas.
- Formulario de contacto, botón de arrepentimiento, WhatsApp, Google Analytics con el mismo ID que Empretienda.

**Panel (`/admin`)**
- **Vender en mostrador** con lector de códigos, cámara del celular o búsqueda. Mismo stock que la tienda.
- **Ventas** online y de mostrador juntas, con estados y aviso de pedidos "a resolver".
- **Productos** con costo, margen y código de barras; aumento masivo de precios y **ofertas masivas con fecha de fin**.
- **Stock** con alertas, cobertura en días, movimientos trazables y conteo físico.
- **Compras y facturas**: carga manual, repetir una compra, o lectura por foto con Claude (opcional).
- **Etiquetas**: editor visual para diseñar cada plantilla a gusto (tamaño, logo, qué lleva, orden, tamaños de letra, alto de barras), con vista previa en tamaño real y aviso si algo no entra.
- **Cupones**: crear, pausar y ver cuántas veces se usó cada uno.
- **Clientes**: compras de cada cliente, aprobación de cuentas mayoristas, mensajes de contacto y pedidos de arrepentimiento.
- **Estadísticas**, **migración desde Empretienda**, **configuración** (pagos, envíos, aviso, usuarios, copia de seguridad).

## Documentación

- **Poner la tienda en internet:** [`docs/PUESTA-EN-MARCHA.md`](docs/PUESTA-EN-MARCHA.md) (paso a paso, sin conocimientos técnicos)
- Arquitectura, concurrencia de stock y decisiones: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
- Qué mirar del sistema: [`docs/DEMO.md`](docs/DEMO.md)

## Stack

Elegido para que no haya servidores que mantener ni costos fijos, y para que cualquier desarrollador
pueda tomarlo después sin sorpresas.

| Capa | Elección |
|---|---|
| App (tienda + panel + API) | **Next.js 16** (App Router) + React 19 + TypeScript |
| Base de datos | **PostgreSQL** (Neon en producción) con **Drizzle ORM** y migraciones versionadas en `drizzle/` |
| Fotos | Guardadas en la misma base y servidas por `/img/[id]` con caché de CDN: un solo lugar para respaldar |
| Pagos | **Mercado Pago Checkout Pro** + webhook firmado (`/api/mercadopago/webhook`) |
| Hosting | **Netlify** (plan gratuito, permite uso comercial). El código no depende de Netlify: corre en cualquier lugar con Node |
| Login | Sesiones propias en la base (cookie httpOnly, contraseñas con scrypt). Roles: dueña / vendedora |
| IA (opcional) | Claude, con la cuenta de Anthropic de Báltica (clave en Configuración) |
| Estilos | CSS propio que replica la plantilla de Empretienda (tienda) + Tailwind 4 (panel) |

## Desarrollo local

```bash
cp .env.example .env
docker compose up -d        # Postgres local en el puerto 5433
pnpm install
pnpm db:migrate             # crea las tablas
pnpm db:seed --demo         # productos reales + 120 días de ventas ficticias (sin --demo: sólo productos)
pnpm dev                    # http://localhost:3000  ·  panel en /admin (el primer ingreso crea la cuenta de la dueña)
```

Para probar Mercado Pago en local alcanza con `MP_ACCESS_TOKEN=TEST-...` en `.env`: al volver del pago,
la página `/checkout/resultado` consulta el pago y concilia la venta aunque el webhook no llegue a localhost.

Cambios en la base: editar `src/db/schema.ts`, correr `pnpm db:generate` y commitear el SQL generado en `drizzle/`.
Netlify aplica las migraciones en cada deploy.

## Estructura

```
src/
  app/
    (tienda)/            Rutas públicas. Mismas URLs que Empretienda ([...slug] resuelve info / categoría / producto)
    admin/(panel)/       Panel (requiere sesión). admin/login: ingreso y alta de la primera cuenta
    api/mercadopago/     Webhook de pagos
    img/[id]/            Fotos guardadas en la base
  storefront/            Componentes y páginas de la tienda, carrito (en el navegador) y acción de checkout
  admin/                 Pantallas del panel, contexto de datos y server actions (actions.ts, migration-actions.ts)
  lib/
    stock.ts             Núcleo del stock unificado: toda venta/ajuste pasa por acá, en transacción
    mercadopago.ts       Preferencias, validación del webhook y conciliación idempotente de pagos
    data.ts              Lecturas de la base → tipos del dominio
    ai.ts                Lectura de facturas y mapeo de columnas con Claude (opcional)
    auth.ts, metrics.ts, sheets.ts, format.ts, types.ts
  db/                    Esquema Drizzle y conexión
  data/categories.ts     Árbol de categorías y banners de la tienda
drizzle/                 Migraciones SQL
scripts/seed.ts          Carga inicial (productos actuales) y datos de demo
```

## Paridad con la tienda de Empretienda

Comparado contra balticaaccesorios.com.ar el 25/10/2026.

| Función de Empretienda | Estado |
|---|---|
| Plantilla, menú, categorías, URLs, banners, grilla del inicio, sección "Ingresos" | ✅ |
| Ofertas con % OFF, precio tachado y fecha de fin | ✅ |
| Franja de aviso superior | ✅ |
| Botón "Comprar" en el listado | ✅ |
| Transferencia con datos e instrucciones (sin descuento, como hoy) | ✅ |
| Filtro por atributo y orden por precio/fecha | ✅ |
| **Stock por variante** (cada talle con su propio stock) | ✅ |
| **Cupones de descuento** (%, monto fijo o envío gratis; mínimo, vencimiento y usos máximos) | ✅ |
| **Cuentas de clientes** (registro, ingreso, recuperar contraseña, historial de pedidos) | ✅ |
| **Cuentas mayoristas** (solicitud, aprobación en el panel, precio mayorista por producto) | ✅ |
| **Envío por código postal** (zonas por CP + cotización en vivo de Correo Argentino si se cargan credenciales MiCorreo) | ✅ |
| **Formulario de contacto y botón de arrepentimiento** (con código de solicitud, Res. 424/2020) | ✅ |
| Emails de confirmación de pedido y avisos a la tienda | ✅ (con Resend, opcional) |
| WhatsApp, redes, páginas de información | ✅ |
| Google Analytics | ✅ mismo ID |

## Reglas de stock (resumen)

- Mostrador descuenta al cobrar. Transferencia/efectivo online reservan al confirmar el pedido. Mercado Pago descuenta al aprobarse el pago.
- `UPDATE ... SET stock = stock - n WHERE stock >= n`: nunca queda negativo y dos cobros simultáneos de la última unidad no pueden pasar los dos.
- Cada cambio de stock deja un movimiento (quién, cuándo, por qué). Cancelar una venta devuelve lo descontado, una sola vez.
- Si Mercado Pago aprueba un pago cuyo stock ya se vendió en el local, la venta queda **a resolver** y se avisa en el inicio del panel.
