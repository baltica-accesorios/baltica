# Puesta en marcha: guía paso a paso

Esta guía es para dejar la tienda funcionando en internet. No hace falta saber programar: son
cuentas que se crean una sola vez y datos que se copian y pegan. Lleva más o menos una hora.

**Costo fijo mensual: $0.** Sólo se paga el dominio (que ya tienen), la comisión de Mercado Pago
por cada venta (la misma de siempre) y, si se activa, la lectura de facturas con Claude (centavos
por factura, a la cuenta de Báltica).

| Servicio | Para qué | Plan |
|---|---|---|
| **GitHub** (`github.com/baltica-accesorios`) | Guarda el código | Gratis |
| **Neon** (`neon.tech`) | La base de datos: productos, ventas, stock, fotos | Gratis (0,5 GB, sobra) |
| **Netlify** (`netlify.com`) | Publica la tienda y el panel en internet | Gratis, permite uso comercial |
| **Mercado Pago** | Cobrar online | Comisión por venta |
| **Claude** (`console.anthropic.com`), opcional | Leer facturas por foto, ayudar en la migración | Pago por uso |

> Todas las cuentas conviene crearlas con el mail de Báltica (baltica.sn@gmail.com), así quedan a
> nombre del negocio y no de una persona.

---

## 1. Base de datos (Neon)

1. Entrar a **neon.tech** → *Sign up* con la cuenta de Google de Báltica.
2. *Create project*: nombre `baltica`, región **AWS São Paulo (sa-east-1)** (la más cercana), Postgres 17.
3. En el panel del proyecto, botón **Connect**. Activar **Connection pooling** y copiar la dirección
   que empieza con `postgresql://...` . Esa es la `DATABASE_URL`. Guardarla en un lugar seguro.

## 2. Publicar la tienda (Netlify)

1. Entrar a **netlify.com** → *Sign up* → **con GitHub** (la cuenta que es dueña de la organización `baltica-accesorios`).
2. *Add new site* → *Import an existing project* → GitHub → elegir el repositorio **baltica-accesorios/baltica**.
3. Netlify detecta todo solo (lee el archivo `netlify.toml`). Antes de publicar, en
   **Environment variables** agregar:

   | Nombre | Valor |
   |---|---|
   | `DATABASE_URL` | la dirección de Neon del paso 1 |
   | `SITE_URL` | por ahora la dirección que da Netlify, ej. `https://baltica.netlify.app` (después se cambia por el dominio) |

4. *Deploy*. En 2–3 minutos la tienda está en línea. En cada publicación, Netlify prepara la base
   de datos solo (corre las "migraciones").
5. **Cargar los productos actuales** (una sola vez): desde una compu con el proyecto, o pidiéndoselo a
   quien mantiene el sistema, correr `DATABASE_URL=... pnpm db:seed`. Carga configuración, plantillas de
   etiquetas y los 163 productos de hoy. (Si van a usar la migración del panel con el Excel de
   Empretienda, este paso se puede saltear.)

## 3. Primer ingreso al panel

1. Entrar a `https://<la-dirección>/admin`.
2. Como es la primera vez, pide **crear la cuenta de la dueña**: nombre, email y contraseña.
3. En **Configuración** completar: alias/CBU para transferencias, precios de envío, WhatsApp, y crear
   los usuarios de las vendedoras (ellas pueden vender y ver stock, pero no costos ni ganancias).

## 4. Mercado Pago

1. Entrar a **mercadopago.com.ar/developers** con la cuenta de Mercado Pago de Báltica → *Tus integraciones* → *Crear aplicación*.
   - Nombre: `Tienda Báltica`. Tipo: **Pagos online** → **Checkout Pro**. Plataforma: *No uso plataforma*.
2. En la aplicación, **Credenciales de prueba** → copiar el **Access Token** (empieza con `TEST-`).
3. En **Webhooks** → *Configurar notificaciones*:
   - URL de producción: `https://<la-dirección>/api/mercadopago/webhook`
   - Evento: **Pagos**. Guardar y copiar la **Clave secreta**.
4. En Netlify → *Site configuration* → *Environment variables*, agregar:

   | Nombre | Valor |
   |---|---|
   | `MP_ACCESS_TOKEN` | el Access Token |
   | `MP_WEBHOOK_SECRET` | la clave secreta del webhook |

   y luego *Deploys* → *Trigger deploy*.
5. **Probar** con una tarjeta de prueba de Mercado Pago (en la misma página de credenciales hay
   tarjetas y usuarios de prueba). La venta tiene que aparecer en el panel como *pagada* y el stock bajar.
6. Cuando todo ande, reemplazar `MP_ACCESS_TOKEN` por el de **Credenciales de producción** (empieza con `APP_USR-`)
   y volver a publicar. En **Configuración** del panel se ve si Mercado Pago está en modo prueba o real.

Cómo funciona el stock con Mercado Pago: el pedido no reserva stock mientras el cliente paga; se
descuenta cuando Mercado Pago confirma el pago. Si justo en ese minuto vendieron la última unidad en
el local, la venta aparece en rojo como **"a resolver"** en el panel, para reponer, ofrecer otra
cosa o devolver el dinero desde Mercado Pago (la devolución vuelve a dejar todo en orden solo).

## 5. Dominio balticaaccesorios.com.ar

Hacerlo recién cuando la tienda nueva esté revisada y la migración hecha (ver *Migrar Empretienda* en el panel).

1. Netlify → *Domain management* → *Add a domain* → `balticaaccesorios.com.ar`.
2. Netlify muestra qué registros cargar. Entrar a donde está registrado el dominio (NIC Argentina /
   el proveedor DNS que usen) y cargar esos registros (o cambiar los servidores DNS por los de Netlify).
3. El certificado HTTPS se activa solo.
4. Cambiar la variable `SITE_URL` a `https://balticaaccesorios.com.ar`, la URL del webhook de Mercado
   Pago al dominio nuevo, y volver a publicar.

## 6. Claude (opcional): facturas por foto y migración asistida

1. Entrar a **console.anthropic.com** con la cuenta de Báltica, cargar una tarjeta y un saldo chico (ej. USD 5).
2. *API Keys* → *Create key* → copiar la clave (empieza con `sk-ant-`).
3. En el panel → **Configuración** → *Claude* → pegar la clave y tildar "Leer facturas por foto".

Desde ese momento en *Compras y facturas* aparece "Cargar factura por foto", y la migración reconoce
sola las columnas de los archivos de Empretienda. Cada factura cuesta centavos de dólar.

## 7. Migrar desde Empretienda

En el panel → **Migrar Empretienda**. Son 4 pasos con botón, y cada uno explica qué archivo exportar
desde Empretienda. Se puede repetir cuantas veces haga falta (el día del cambio de dominio se vuelve a
subir el Excel de productos para traer precios y stock de ese momento).

## Mantenimiento

- **No hay servidores que actualizar.** Netlify y Neon se ocupan.
- **Copias de seguridad:** Neon guarda historia automática; además, en *Configuración* hay un botón
  *Descargar copia de seguridad* para guardar una vez por mes.
- **Cambios en el sistema:** quien lo mantenga trabaja en el repositorio de GitHub; cada cambio que
  entra a `main` se publica solo.
- **Si algo falla:** Netlify → *Deploys* muestra cada publicación y permite volver a la anterior con un click (*Publish deploy*).
