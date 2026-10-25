# Recorrido del sistema (5 minutos)

Con datos de demo (`pnpm db:seed --demo`) o con los datos reales ya migrados.

1. **Tienda** (`/`): la misma tienda de hoy. Entrá a *Anillos → acero quirúrgico*, filtrá por diámetro, abrí un
   producto, agregalo al carrito y finalizá la compra eligiendo envío y medio de pago (Mercado Pago,
   transferencia con descuento o efectivo al retirar). Con transferencia el pedido reserva stock y muestra el alias.
2. **Panel** (`/admin`): el primer ingreso crea la cuenta de la dueña. El inicio muestra ventas de hoy, los
   últimos 30 días contra los 30 anteriores, ganancia, lo que se está por acabar y avisos de pedidos pendientes.
3. **Vender (mostrador)**: escaneá con el lector, con la cámara o escribí "anillo" y Enter. Probá agregar más
   unidades de las que hay. Cobrá. El stock baja también en la tienda.
4. **Ventas**: online y mostrador juntas. Abrí una venta online: datos del cliente, envío, botón para escribirle por
   WhatsApp, y cambio de estado (cancelar devuelve el stock).
5. **Stock**: alertas con cobertura en días y cuánto reponer, movimientos con trazabilidad, conteo físico escaneando.
6. **Compras y facturas**: cargá una compra a mano o repetí una anterior. Con la clave de Claude de Báltica en
   Configuración, aparece "Cargar factura por foto".
7. **Etiquetas**: elegí plantilla, agregá productos e imprimí.
8. **Estadísticas**: 7 / 30 / 90 días.
9. **Migrar Empretienda**: subí los Excel exportados de Empretienda (productos, clientes, ventas) y copiá las fotos.
10. **Configuración**: precios, envíos, alias para transferencias, usuarios de las vendedoras, Claude y copia de seguridad.
