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

**Cómo está hoy** (revisado el 25/10/2026):

- El dominio está registrado en **NIC Argentina** a nombre del CUIT 27420583538 (vence el 02/09/2027).
- Los servidores DNS son los de **Empretienda** (`ns1` a `ns4.empretienda.net`): Empretienda administra todos los registros.
- El **email** de Báltica usa **Zoho Mail** y depende de esos registros. **Si se cambia el DNS sin copiarlos, se corta el correo.**

Hacerlo recién cuando la tienda nueva esté revisada y la migración hecha (ver *Migrar Empretienda* en el panel).

### Paso 1: preparar el DNS en Netlify (sin cortar nada todavía)

1. Netlify → *Domain management* → *Add a domain* → `balticaaccesorios.com.ar` → elegir **Netlify DNS**.
2. Antes de seguir, en *DNS records* cargar los registros del email, **tal cual están hoy**:

   | Tipo | Nombre | Valor | Prioridad |
   |---|---|---|---|
   | MX | `@` | `mx.zoho.com` | 10 |
   | MX | `@` | `mx2.zoho.com` | 20 |
   | MX | `@` | `mx3.zoho.com` | 50 |
   | TXT | `@` | `v=spf1 include:zohomail.com ~all` | |
   | TXT | `@` | `zoho-verification=zb10755692.zmverify.zoho.com` | |
   | TXT | `zmail._domainkey` | `v=DKIM1;k=rsa;p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC6CaxCOc2E7JkrEvrSo3s6aLMb5fzfCu0ZoiN8iVsHKFeteEFruM8NLRXwU6cTvhrLXW9hC9vJ21cSeObp9xBaD3Aq2QKAek2mlJHcIeM7Bg5oqoai+zY9ukZpApiiQpVpTLzbFk6T5Dh0uSY2rdNAMXjfTM7zXy/E5Hat25JASwIDAQAB` | |

   (Si se configuró Resend, agregar también los registros que muestra Resend.)
3. Netlify muestra **4 servidores DNS** propios (del estilo `dns1.p0X.nsone.net`). Anotarlos.

### Paso 2: el cambio (día D)

1. Entrar a **nic.ar** con la **Clave Fiscal** del titular (CUIT 27420583538) → *Mis dominios* → `balticaaccesorios.com.ar` → *Delegar*.
2. Borrar los 4 servidores de Empretienda y poner los 4 de Netlify. Confirmar.
3. La propagación tarda entre minutos y unas horas. Mientras tanto, algunos ven la tienda vieja y otros la nueva: las dos funcionan.
4. Netlify activa el certificado HTTPS solo (*Domain management* → *HTTPS*). También agregar `www.balticaaccesorios.com.ar` para que redirija al dominio principal.
5. Cambiar la variable `SITE_URL` a `https://balticaaccesorios.com.ar` y volver a publicar.
6. En Mercado Pago, cambiar la URL del webhook a `https://balticaaccesorios.com.ar/api/mercadopago/webhook`.

### Paso 3: comprobar y dar de baja

- Mandar un mail a la casilla de Báltica desde otra cuenta y responderlo: confirma que Zoho sigue andando.
- Hacer una compra de prueba en el dominio.
- Recién entonces pausar la tienda en Empretienda y dar de baja el plan.

## 6. Claude (opcional): facturas por foto y migración asistida

1. Entrar a **console.anthropic.com** con la cuenta de Báltica, cargar una tarjeta y un saldo chico (ej. USD 5).
2. *API Keys* → *Create key* → copiar la clave (empieza con `sk-ant-`).
3. En el panel → **Configuración** → *Claude* → pegar la clave y tildar "Leer facturas por foto".

Desde ese momento en *Compras y facturas* aparece "Cargar factura por foto", y la migración reconoce
sola las columnas de los archivos de Empretienda. Cada factura cuesta centavos de dólar.

## 7. Emails automáticos (opcional, recomendado)

Sirven para: confirmación de pedido al cliente, aviso de cada venta a Báltica, recuperar contraseña,
aviso de cuenta mayorista aprobada y los formularios de contacto y arrepentimiento. Sin esto todo
funciona igual y los mensajes quedan en el panel (Clientes → Mensajes).

1. Crear cuenta gratis en **resend.com** con el mail de Báltica (3.000 emails por mes gratis).
2. *Domains* → *Add domain* → `balticaaccesorios.com.ar` y cargar en el DNS los registros que muestra
   (así los mails salen de `tienda@balticaaccesorios.com.ar` y no caen en spam).
3. *API Keys* → crear una y copiarla.
4. En Netlify, agregar `RESEND_API_KEY` (la clave) y `EMAIL_FROM` = `Báltica Accesorios <tienda@balticaaccesorios.com.ar>`, y volver a publicar.
5. Los avisos de la tienda llegan al email cargado en **Configuración → Datos de contacto**.

## 8. Correo Argentino: cotización en vivo (opcional)

Sin esto, los envíos por Correo usan los precios fijos cargados en Configuración → Envíos (se pueden
limitar por código postal). Para que el precio salga calculado por código postal:

1. Tener cuenta en **MiCorreo** (correoargentino.com.ar) como empresa y pedir acceso a la **API MiCorreo**
   (Correo entrega usuario y contraseña de API, distintos para prueba y producción).
2. En Netlify cargar `CORREO_API_USER`, `CORREO_API_PASSWORD` (los de la API), `CORREO_EMAIL`, `CORREO_PASSWORD`
   (los de la cuenta MiCorreo) y `CORREO_ENV` = `test` para probar o `prod` para producción.
3. En Configuración → Envíos completar el **CP de origen** y el tamaño/peso del paquete.
   Si el Correo no responde, se usa el precio fijo: el checkout nunca se traba.

## 9. Migrar desde Empretienda

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
