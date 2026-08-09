# Contexto: App "Mis Cuentas" (cuentas-app)

## Qué es
PWA que reemplaza una planilla Excel de economía personal mensual.
Repo: github.com/diegali/cuentas-app (GitHub Pages, rama main, carpeta raíz)

## Stack
- HTML/CSS/JS vanilla, sin frameworks ni npm, todos los `<script>` son `type="module"`
- Firebase Auth (email/contraseña) + Firestore
- Imports de Firebase SIEMPRE con URL completa de gstatic (nunca estilo npm "firebase/app")

## Estado: los 4 módulos están COMPLETOS y en producción
- `index.html` → login
- `app.html` → shell con 4 tabs, orden: **Panel** (tab activo por defecto, `data-tab="extra"` en el código aunque el botón dice "Panel"), Total, Tarjetas, Imp. y Servicios
- `css/styles.css` → tema oscuro/dorado. Variables en `:root`: `--bg`, `--card`, `--accent` (#d4af37), `--text`, `--text-dim`, `--error`
- `js/firebase-config.js`, `js/auth.js`, `js/app.js` → login, logout, navegación de tabs
- `js/impserv.js` → Impuestos y Servicios
- `js/tarjetas.js` → Tarjetas
- `js/extra.js` + `js/vencimientos.js` + `js/deudalau.js` → sub-módulos de Panel/Extra (Saldos por cuenta, Ahorro, Disponible diario, Vencimientos del mes, Debe Lau)
- `js/total.js` → resumen anual
- `js/utils.js` → **módulo nuevo (refactor de hoy)**, ver abajo

## Refactor de hoy: `js/utils.js`
Se creó para eliminar duplicación entre módulos. Exporta:
- `formatearMonto(valor)` — antes copiada en 6 archivos
- `TARJETAS` — array `["VISA HIPOTECARIO", "VISA FRANCES", "CORDOBESA", "MC MERCADO PAGO"]`, antes declarado por separado en tarjetas.js/extra.js/vencimientos.js (esto causó bugs de desfasaje de nombres en el pasado — ahora hay una sola fuente)
- `obtenerHoyISO()` — `new Date().toISOString().slice(0,10)`
- `clasificarFecha(fechaISO, hoyISO)` — devuelve `"fecha-pasada"`/`"fecha-hoy"`/`""`, usado en impserv.js y vencimientos.js (comparación estricta `<`)
- `armarIdPeriodo(tarjeta, mes, anio)` — arma el id `tarjeta_mes_anio` reemplazando espacios por `_`, usado en tarjetas.js y vencimientos.js

**OJO — no todo se unificó:** `tarjetas.js` tiene su propia lógica de fecha en `actualizarEstadoPeriodo()` con comparación `<=` (no `<`), a propósito distinto de `clasificarFecha()` — no compartir esa función ahí. `deudalau.js` tiene su propio `idPeriodoLau()` (`mes_anio`, sin tarjeta) — es un formato distinto, no duplicación, no tocar.

## Bug resuelto hoy: Vencimientos no se actualizaba en vivo
`vencimientos.js` tenía listeners (`onSnapshot`) sobre `impuestosServicios` y sobre cada doc de `tarjetasPeriodos`, pero NO sobre la colección `tarjetas` (donde se guardan los gastos individuales). Resultado: al cargar un gasto nuevo en una tarjeta, el panel de Vencimientos quedaba desactualizado hasta hacer F5. Se agregó un tercer listener (`unsubscribeTarjetasGastos`) sobre `collection(db, "users", uid, "tarjetas")` filtrado por mes/año, que dispara `renderCombinado()`.
**Patrón general para recordar:** cualquier dato que dependa de otra colección necesita su propio `onSnapshot`; una lectura puntual (`getDocs`/`getDoc`) sin listener no se entera de cambios sin F5.

## CSS: limpieza parcial hoy
Se sacaron 3 reglas muertas/redundantes (`.form-item` duplicada, `.periodo-fechas input.fecha-pasada/.fecha-hoy` redundantes con las reglas generales `input.fecha-pasada/.fecha-hoy`) y se unificó `.btn-rapido` (estaba definida en dos bloques separados del archivo).
**Pendiente (decidido posponer para cuando se encaren cambios estéticos):** sumar variables `--input-bg` (por `#23262e`, repetido ~6 veces) y `--hoy` (por `#7aa6c2`, el celeste de "hoy"/"pagado", repetido varias veces) a `:root`, mismo criterio que `--accent`/`--error`.

## Módulo "Impuestos y Servicios" (tab-impserv)
- Selector de mes/año, botón "Copiar mes anterior" (con confirmación), accesos rápidos editables (`users/{uid}/config/accesosRapidos`)
- Alta: nombre (MAYÚSCULAS), monto, fecha de vencimiento, monto Lau (opcional)
- Listado: checkbox pagado, monto editable (foco selecciona todo, blur formatea y guarda, Enter quita foco), fecha editable, campo Lau (solo visible si `montoLau > 0`, se carga solo al crear el ítem), borrar
- Resaltado: fila roja si venció y no está pagado (`fecha-pasada`), celeste si vence hoy (`fecha-hoy`, `#7aa6c2`)
- Firestore: `users/{uid}/impuestosServicios` → `{nombre, monto, montoLau, vencimiento, mes(0-11), anio, pagado}`

## Módulo "Tarjetas" (tab-tarjetas)
- Selector de tarjeta (array `TARJETAS`, ahora en utils.js) y de mes/año
- Período por tarjeta en `users/{uid}/tarjetasPeriodos/{armarIdPeriodo()}`: `fechaCierre`, `fechaVencimiento` (autoguardado), checkbox `pagado` (resalta `.periodo-fechas` y muestra "PAGADO")
- Ítems fijos calculados y guardados en el doc de tarjetasPeriodos (NO son docs de la colección `tarjetas`):
  - CORDOBESA: sello (auto 1.5%, override manual campo `sello`), comisión (`comision`), IVA (`iva`)
  - MC MERCADO PAGO: solo sello (mismo criterio), sin comisión ni IVA
- Alta de gasto: descripción, monto, cuota actual/total (opcional, genera un doc por cuota restante), monto Lau, débito automático (genera 24 meses, constante `MESES_DEBITO_AUTOMATICO`)
- Totales en vivo: "Total del mes" (resta montoLau + suma fijos), "Te debe Lau" (suma montoLau), "Total general" (bruto)
- Firestore: `users/{uid}/tarjetas` → `{tarjeta, descripcion, monto, montoLau, cuotaActual, cuotaTotal, mes, anio, debitoAutomatico}`. Query `where tarjeta/mes/anio + orderBy descripcion` → requiere índice compuesto (ya creado)

## Módulo "Panel/Extra" (tab-extra)
Sin selector de mes propio en ninguno de los sub-módulos (se sacó a propósito): `mesActual`/`anioActual` fijos en el mes de hoy. Un solo encabezado de mes arriba de todo el tab.

**Saldos por cuenta** (`extra.js`): alta nombre/saldo/tipo (banco/billetera/efectivo), agrupadas en filas por tipo (Billetera→Banco→Efectivo), logo opcional por cuenta (campo texto con nombre de archivo, imagen subida a mano a `assets/logos/`, sin picker). Firestore: `users/{uid}/cuentas` → `{nombre, saldo, tipo, logo?}`. Total en variable global `totalCuentasActual`.

**Ahorro a guardar** (`extra.js`): lista simple nombre+monto editable. Firestore: `users/{uid}/ahorros` → `{nombre, monto}`. Total en `totalAhorroActual`.

**Disponible diario** (`extra.js`): input fecha próximo cobro (`users/{uid}/config/diaCobro`). Fórmula: `(totalCuentasActual - totalAhorroActual - totalVencimientos + totalLau) / diasRestantes`. `totalVencimientos` viene de `calcularTotalVencimientosMes()` (vencimientos.js), `totalLau` de `calcularTotalLauPendiente()` (deudalau.js). Se recalcula solo ante cambios en cuentas, ahorro, fecha de cobro, o el checkbox "Pagado" de Debe Lau.

**Vencimientos del mes** (`vencimientos.js`): combina ítems no pagados de impuestosServicios (monto BRUTO, sin restar Lau) + vencimientos de tarjetas no pagadas (monto bruto + sello/comisión/IVA si aplica), ordenado por fecha. Mismo resaltado rojo/celeste que impserv. Tiempo real completo (ver bug resuelto arriba: ahora también escucha altas en `tarjetas`). Exporta `calcularTotalVencimientosMes(uid, mes, anio)` — versión sin DOM para reusar en Disponible diario, debe usar monto BRUTO (`total += item.monto`), nunca restar montoLau ahí.

**Debe Lau** (`deudalau.js`): junta ítems con `montoLau > 0` de impuestosServicios + tarjetas. Un solo checkbox "pagado" por mes (no por ítem), en `users/{uid}/lauPeriodos/{mes}_{anio}`. Al pagar, la lista se atenúa y tacha. Exporta `calcularTotalLauPendiente(uid, mes, anio)`.

## Módulo "Total" (tab-total)
`js/total.js`. Grilla de 12 tarjetas (4x3, año fijo = actual, sin selector de año). Cada tarjeta: Ingreso (editable, guardado en `users/{uid}/ingresos/{mes}_{anio}`), Tarjetas, Imp./Servicios, Diferencia (verde/rojo). Trae todo el año de una sola vez con onSnapshot (`where anio ==`, sin filtrar mes) y agrupa en arrays de 12 posiciones. IMPORTANTE: acá los montos son NETOS (restando montoLau), a propósito distinto de Vencimientos que usa bruto. Mes actual resaltado con borde dorado.

## Reglas de Firestore
Solo el dueño lee/escribe sus propios datos, patrón `users/{userId}/{document=**}`. Ya configuradas.

## Bugs/gotchas ya resueltos (referencia rápida)
- Import de Firebase: URL completa gstatic, nunca estilo npm
- Índice compuesto: falta cuando se combina `where` + `orderBy` en campos distintos (Firebase da el link para crearlo); solo `where` con igualdades no lo necesita
- Callbacks de `onSnapshot` con `await` adentro deben ser `async (snapshot) => {...}`
- Inputs de fecha necesitan `background` claro + `color-scheme: dark`
- Botón borrar rojo se pierde sobre fila roja (`fecha-pasada`): fondo oscuro + borde blanco en ese caso
- Nombres de tarjetas: ahora centralizados en `TARJETAS` (utils.js) — ya no debería repetirse el bug de desfasaje, pero si se agrega/renombra una tarjeta, tocarlo solo ahí
- Cálculos que existen en dos versiones (ej. render en pantalla + función exportada para reusar) pueden desincronizarse si se cambia la fórmula en una sola — revisar ambas
- `${variable}` escrito directo en un `.html` es texto literal, no se evalúa — solución: `<span>` vacío + `textContent` desde JS
- IDs duplicados en el HTML rompen en silencio (el segundo elemento queda sin listener)
- Ante "no se actualiza sin F5" verificar primero si es falta de listener (onSnapshot) o versión vieja de JS cacheada en el navegador (probar Ctrl+Shift+R antes de asumir bug de lógica)

## Preferencias de trabajo del usuario
- Modo "principiante": indicar directamente qué cambiar, mínima explicación, un cambio a la vez, paso a paso
- Fragmento a cambiar, no el archivo completo (salvo archivo nuevo)
- Trabaja en español
- Ya tiene experiencia con este stack (Firebase + vanilla JS + GitHub Pages) en otros proyectos propios (JOOLI CateringDesk, Redeterminaciones 800/16)

## Próximos pasos posibles
- Terminar limpieza CSS: variables `--input-bg` y `--hoy` (pospuesto a la próxima sesión de estética)
- Cambios estéticos generales (pendiente, próxima etapa)
- Selector de año en Total (hoy fijo al año actual) — mejora futura, no urgente
