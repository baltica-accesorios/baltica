# Ajustes de Báltica — octubre 2026

Repositorio: `/Users/sol/Personal/freelance/baltica`.
Contexto: `Downloads/transcript (5).csv` y lista de ajustes de la clienta.

## Implementación

- Tienda: productos agotados atenuados, imagen en gris y “SIN STOCK” destacado; grillas con carga progresiva de 24 tarjetas mediante IntersectionObserver, sin botón de “ver más”. Las imágenes son lazy. Por ahora el catálogo se obtiene completo del servidor; la paginación es de renderizado.
- `/admin/tienda`: editor por secciones, vista previa celular/escritorio, banners con foto/texto/enlace y orden, barra superior, título de productos, categorías y subcategorías, fotos, títulos/enlaces de imágenes y cantidad de columnas (celular 1–3, escritorio 1–4).
- `/admin/promociones`: reglas editables de porcentaje o 2×1 por categoría y/o productos, activación, inicio, fin y redondeo. Los cupones existentes siguen en `/admin/cupones`. El servidor recalcula los importes al comprar y al mostrar el resumen.
- Productos: generación de códigos internos de seis cifras (CODE128); creación de categorías, subcategorías y materiales desde el formulario; múltiples atributos con sus combinaciones, stock, foto y precio por combinación; edición rápida de precio y stock desde el listado.
- Estadísticas: filtro por categoría aplicado a todos los indicadores. Prorratea descuentos y excluye el envío de la facturación de mercadería.
- Ventas: fotos ampliables y código, edición de productos/cantidades/precios con control de cambios simultáneos; devolución y descuento de stock dentro de una transacción; filtros de estado. Pedidos online con indicadores independientes abonado/empaquetado/entregado.
- El login con email/contraseña y los usuarios ya existían. Se conservan los roles y se reutilizan para el MCP.
- Envíos: ya existían retiro, cadete configurable y cotización MiCorreo por CP. Se conservan; requieren credenciales para cotización real. Sin credenciales usa los valores fijos configurados, no una cotización en vivo.
- Etiquetas: se explicita el flujo DT01 por impresión del sistema/PDF y medidas configurables. No se implementó un protocolo Bluetooth propietario sin documentación y sin impresora física.

## MCP

Endpoint: `/api/mcp`, Streamable HTTP con respuestas JSON, sin sesiones SSE. Versiones negociadas: 2025-11-25, 2025-06-18 y 2025-03-26.

En `/admin/integraciones`, una dueña crea una clave de 90 días, mostrada una sola vez. Se almacena sólo su SHA-256. Revocar la clave o desactivar el usuario corta el acceso. El token identifica al usuario en un contexto aislado por solicitud; las herramientas llaman a las mismas acciones autenticadas del panel.

Autorización: `Authorization: Bearer <clave>`. Configurar `SITE_URL` con la dirección real de la tienda. Rechaza orígenes de navegador ajenos, pedidos de más de 8 MB y herramientas desconocidas.

Herramientas disponibles: catálogo/alta/edición/baja lógica, stock, fotos, configuración/diseño/categorías/materiales/promociones/envíos, ventas y edición, seguimiento online, cupones, estadísticas por categoría, clientes, lectura de compras, venta de mostrador, plantillas de etiquetas y gestión de usuarios. No expone SQL ni ejecución arbitraria. Las compras se consultan; su carga continúa desde el panel.

Clientes con encabezados HTTP configurables pueden usar directamente la URL. Para clientes stdio, usar el adaptador incluido (Node 22+):

```json
{
  "mcpServers": {
    "baltica": {
      "command": "node",
      "args": ["/ruta/al/repositorio/scripts/mcp-bridge.mjs"],
      "env": {
        "BALTICA_MCP_URL": "https://tu-tienda.example/api/mcp",
        "BALTICA_MCP_TOKEN": "<clave creada en el panel>"
      }
    }
  }
}
```

No se implementó OAuth. Un cliente que exija OAuth y no permita encabezados personalizados o stdio necesitará esa integración adicional. No se probó una conexión real desde un asistente externo.

## Reglas a revisar con la clienta

- Gana el mejor descuento porcentual; no se suman porcentajes.
- En 2×1, se agrupan los productos elegibles por regla, se ordenan por precio y cada par bonifica el más barato. Las reglas 2×1 no se superponen sobre una misma unidad. Se pueden combinar con porcentaje, cupón y transferencia, en ese orden.
- Editar una venta conserva el descuento en pesos y el envío. No ejecuta cobros ni reintegros externos. Una venta de Mercado Pago aún sin confirmación no se puede editar.
- Los códigos existentes se conservan. Los nuevos sugeridos tienen seis cifras y se verifica que estén libres.
- Máximo 500 combinaciones por producto. Cambiar opciones puede requerir volver a distribuir el stock entre las nuevas combinaciones.

## Migración y puesta en marcha local

La migración `0008_gestion_tienda.sql` agrega paid/packed/delivered y claves API. Inicializa abonado/entregado a partir de los estados anteriores. No ejecutada aquí: PostgreSQL no estuvo accesible.

```sh
cd /Users/sol/Personal/freelance/baltica
pnpm install --frozen-lockfile
# Crear .env desde .env.example si todavía no existe; usar la base local.
docker compose up -d
pnpm db:migrate
# Sólo en una base de desarrollo vacía:
pnpm db:seed --demo
pnpm test
pnpm typecheck
pnpm dev --hostname 127.0.0.1
```

Tienda: http://localhost:3000 — panel: http://localhost:3000/admin.
El primer ingreso permite crear la cuenta dueña. No se agregaron credenciales fijas.

## Verificación realizada y límites

- `node --test tests/*.test.mjs`: 11 pruebas aprobadas (promociones, vencimientos, variantes, métricas, validación y transporte MCP con autenticación simulada).
- `git diff --check`: aprobado.
- Se intentó typecheck, instalación normal/offline y levantar Next. No se pudo completar: el node_modules disponible pertenece al proyecto anterior y carece de Next, Drizzle y postgres; el acceso a registry.npmjs.org falla, y Docker devuelve permiso denegado. `npm run dev -- --hostname 127.0.0.1` termina con `next: command not found`.
- No se validaron build, navegador, migración ni transacciones con una base real. Antes de desplegar: instalar dependencias, migrar una base local, ejecutar typecheck/build y probar venta/edición/cancelación, combinaciones sin stock, checkout y conexión MCP real.
- No se modificó producción, ni se hizo push o despliegue. `dist/` ya estaba sin seguimiento y no se alteró.

## Referencias técnicas

- [MCP: transporte HTTP y stdio](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
- [MCP: autorización y requisitos OAuth](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).
- [Correo Argentino: documentación API MiCorreo](https://www.correoargentino.com.ar/MiCorreo/public/img/pag/apiMiCorreo.pdf).
- [Detonger: portal de controladores](https://drv.detonger.com/). No se obtuvo documentación suficiente para afirmar compatibilidad Bluetooth directa con DT01.

## Actualización de puesta en marcha — 29/10/2026

Con acceso completo se instalaron las dependencias con el lockfile y se levantó PostgreSQL en `127.0.0.1:55432` (5433 ya pertenece a otro proyecto). Se creó `.env` local, se aplicaron todas las migraciones y se cargaron 163 productos y 493 ventas de demostración.

`pnpm typecheck` y las 11 pruebas pasaron. Tienda, catálogo y login respondieron HTTP 200. Se verificaron las páginas del panel con una sesión temporal de prueba, luego eliminada; el primer ingreso sigue permitiendo crear la cuenta dueña.

Servidor de desarrollo: http://127.0.0.1:3000. No se hizo despliegue ni se modificaron bases externas. Las limitaciones de instalación de la sección anterior corresponden al intento previo sin acceso completo.

### Atributos, colores y fotos por variante (30/10)

- Nueva sección `/admin/atributos`: catálogo reutilizable de atributos de texto o color; opciones con nombre y muestra hexadecimal. También se crean desde la edición del producto, con modal propio.
- En cada producto se eligen las opciones aplicables y se generan sus combinaciones (máximo 500). Cada combinación tiene stock, precio opcional y varias fotos de la galería. Se pueden aplicar fotos a todas las combinaciones de un mismo color.
- Cambiar combinaciones con unidades existentes exige revisar la redistribución del stock. Los nombres/opciones del catálogo en uso no se pueden eliminar ni renombrar silenciosamente.
- La tienda filtra por todos los atributos disponibles. Combina atributos con AND y opciones del mismo atributo con OR, comprobando stock en una misma combinación. Muestra cantidades de productos disponibles y deshabilita opciones agotadas.
- Un filtro cambia la foto y el precio de la tarjeta al de la variante coincidente; el enlace conserva esa selección. La ficha cambia la galería al elegir color/tamaño y deshabilita combinaciones sin stock. Cambiar color selecciona un tamaño disponible cuando hace falta. Se conservan los talles antiguos.
- MCP: `list_attributes`, `save_attribute`, `delete_attribute`; `update_product` acepta atributos, stock y fotos por combinación.
- No requiere migración: catálogo en settings JSON y atributos/detalles en variants JSON.
- Referencia funcional: [Agregar productos, Empretienda](https://empretienda.helpjuice.com/agregar-productos) y [activar filtros de atributos](https://empretienda.helpjuice.com/ordenar-tus-productos-agregar-una-leyenda-activar-filtro-de-atributos). Empretienda documenta atributos/opciones, stock/precio por variante y foto asociada; el catálogo reutilizable responde a lo solicitado para Báltica.
- Validación: TypeScript sin errores y 16 tests de dominio/MCP aprobados. Prueba real en Chrome: crear catálogo, crear atributo desde producto, guardar stock/fotos, bloquear opciones agotadas, cambiar imagen y galería, agregar variante al carrito, filtrar y abrir variante desde tarjeta, y revisar ancho móvil. Datos y acceso temporales eliminados al terminar.

### Protección del stock al cambiar variantes

Se conserva el total original y se muestran las unidades pendientes de asignar. El formulario bloquea guardar si faltan o sobran unidades. La acción del servidor comprueba el total con bloqueo de la fila antes de modificar un producto con stock y estructura de variantes distinta, también para MCP. Verificado en Chrome con 10 unidades: bloquea 0, 6 y 11; permite 6 + 4 y conserva 10 en la base. Los 18 tests pasan.
