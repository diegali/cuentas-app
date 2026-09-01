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

**Disponible diario** (`extra.js`): input fecha próximo cobro
(`users/{uid}/config/diaCobro`). Fórmula: `(totalCuentasActual -
totalAhorroActual - totalVencimientos + totalLau) / diasRestantes`.

**CAMBIO IMPORTANTE (sesión de hoy) — período real vs. mes calendario:**
el usuario cobra el sueldo un día de la primera semana del mes, no el
día 1. Antes del cobro, los vencimientos/deudas que "cuentan" para el
disponible siguen siendo los del período anterior (aunque el calendario
ya haya rodado al mes nuevo), no los del mes calendario actual. Por eso
`totalVencimientos` y `totalLau` YA NO se calculan por mes calendario:
ahora ambos filtran por **fecha real de vencimiento ≤ fecha de "Próximo
cobro"** cargada por el usuario, recorriendo los meses que hagan falta
(desde hoy hasta el mes de la fecha de cobro, máx. 3 meses de margen).
- `totalVencimientos` viene de `calcularTotalVencimientosHasta(uid,
  fechaCobro)` (vencimientos.js) — REEMPLAZÓ a `calcularTotalVencimientosMes`
  (la vieja función por mes calendario, ya no se usa desde extra.js pero
  se dejó en el archivo por si sirve de referencia)
- `totalLau` viene de `calcularTotalLauPendienteHasta(uid, fechaCobro)`
  (deudalau.js) — REEMPLAZÓ a `calcularTotalLauPendiente` (misma
  situación, vieja función por mes calendario ya no usada desde extra.js)
- Ambas funciones nuevas: arman un array de `{mes, anio}` iterando desde
  hoy hasta el mes de `fechaCobro` (por si el cobro cae en el mes
  siguiente), y para cada mes chequean la fecha real (`vencimiento` en
  impuestosServicios, `fechaVencimiento` en tarjetasPeriodos) contra
  `fechaCobro`, no contra el mes calendario del documento
- `calcularTotalLauPendienteHasta` importa `TARJETAS` de utils.js (lo
  necesita para iterar tarjetasPeriodos, antes esa función no la
  necesitaba porque solo miraba por mes calendario)
- Se recalcula ante cambios en cuentas, ahorro, fecha de cobro, o el
  checkbox "Pagado" de Debe Lau (sin cambios en esta parte)

**Vencimientos del mes** (`vencimientos.js`): combina ítems no pagados de impuestosServicios (monto BRUTO, sin restar Lau) + vencimientos de tarjetas no pagadas (monto bruto + sello/comisión/IVA si aplica), ordenado por fecha. Mismo resaltado rojo/celeste que impserv. Tiempo real completo (ver bug resuelto arriba: ahora también escucha altas en `tarjetas`). Exporta `calcularTotalVencimientosMes(uid, mes, anio)` — versión sin DOM para reusar en Disponible diario, debe usar monto BRUTO (`total += item.monto`), nunca restar montoLau ahí.

**Debe Lau** (`deudalau.js`): junta ítems con `montoLau ≠ 0` (positivos = te
debe Lau; negativos = devoluciones/ajustes a favor de Lau, ambos se
muestran y se suman) de impuestosServicios + tarjetas. Un solo checkbox
"pagado" por mes (no por ítem), en `users/{uid}/lauPeriodos/{mes}_{anio}`.
Al pagar, la lista se atenúa y tacha. Exporta
`calcularTotalLauPendiente(uid, mes, anio)`. Ítems de tarjetas muestran
la cuota entre paréntesis cuando corresponde (`cuotaActual/cuotaTotal`),
igual que en Tarjetas.

**Botón "Ver mes que viene" (Debe Lau)**: permite espiar los ítems de
Lau del mes siguiente (útil para cargar una devolución/gasto que ya
corresponde al próximo período antes de que llegue el mes calendario),
SIN cambiar el concepto de "mes actual" en el resto de la app (Panel
sigue atado al mes calendario real en todos los demás sub-módulos;
cambiar eso a "período entre cobro y cobro" se evaluó y se descartó por
ahora por ser un cambio grande y riesgoso).
- Variable módulo `viendoMesSiguiente` (boolean, arranca en `false`)
- `mesYAnioAMostrar()`: devuelve `{mes, anio}` de hoy, o del mes siguiente
  si `viendoMesSiguiente` es `true`
- `escucharTodo()` e `idPeriodoLau()` usan `mesYAnioAMostrar()` en vez de
  fechas fijas de hoy — así todo el módulo (listado Y el checkbox
  "pagado", que son independientes por período) responde al toggle
- Botón `#ld-ver-siguiente`, togglea el texto ("Ver mes que viene ▶" /
  "◀ Ver mes actual") y vuelve a llamar `escucharTodo()` +
  `escucharPeriodoLau()` al click
- Este patrón (mes "espiado" aparte del mes real de la app) queda
  disponible como referencia si en el futuro hace falta algo similar en
  Vencimientos

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
- Nuevo índice compuesto creado hoy en Firestore: colección
  `impuestosServicios`, campos `pagado` + `vencimiento` (para las queries
  de `calcularTotalVencimientosHasta`/`calcularTotalLauPendienteHasta`
  que filtran por fecha real, no por mes/año). Si Firebase pide crear un
  índice nuevo, usar SIEMPRE el link exacto de la consola del navegador
  (F12), no la pantalla general de "Índices" de Firebase, para no crear
  un índice con campos equivocados por error
- Cuando una función se reemplaza por una versión nueva con otro nombre
  (ej. `calcularTotalVencimientosMes` → `calcularTotalVencimientosHasta`),
  revisar que el import viejo se haya cambiado en TODOS los archivos que
  la usan, no solo agregar el nuevo — quedan imports/variables sin uso
  marcados en gris por el editor, señal para limpiarlos (pasó con
  `updateDoc`, `mesActual`, `anioActual` en deudalau.js, ya sin uso
  después de este cambio)
- **Concepto de fondo (puede volver a aparecer en otros módulos):** el
  usuario piensa en "período hasta el próximo cobro de sueldo", no en
  mes calendario. La mayoría de los módulos SÍ usan mes calendario
  (Tarjetas, Imp. y Servicios, Debe Lau al navegar, Total) porque ahí
  tiene sentido para cargar/organizar datos. Pero cualquier CÁLCULO que
  alimente "cuánta plata tengo disponible ahora" debe filtrar por FECHA
  REAL (`vencimiento`/`fechaVencimiento`) comparada contra la fecha de
  cobro, no por el campo `mes`/`anio` del documento — si en el futuro se
  agrega otro cálculo de este tipo, aplicar el mismo criterio de entrada

## Cambios de la sesión de hoy (después del refactor de utils.js)

**Tipografía:** se cambió de `'Segoe UI'` a `'Inter'` (Google Fonts, pesos 400-800), cargada en `index.html` y `app.html`. `font-family` en `css/styles.css` ahora es `'Inter', 'Segoe UI', sans-serif`.

**Disponible diario destacado:** el bloque se movió al principio del tab Panel/Extra (antes de "Saldos por cuenta"), envuelto en `<section class="bloque-disponible-destacado">` con fondo dorado tenue, borde `--accent` y el número de "Disponible por día" agrandado (24px). Es lo que el usuario más mira a diario.

**Bug resuelto — Disponible diario no se actualizaba en vivo:** en `extra.js`, `calcularDisponibleDiario()` solo se disparaba con cambios en cuentas/ahorro/fecha de cobro/Debe Lau, pero no cuando cambiaba `totalVencimientos` (que depende de `impuestosServicios` y `tarjetas`/`tarjetasPeriodos`). Se agregaron listeners `onSnapshot` sobre `impuestosServicios` (mes/año), sobre `tarjetas` (mes/año) y sobre cada doc de `tarjetasPeriodos` (uno por tarjeta), todos disparando `calcularDisponibleDiario()`. De paso se sacó un listener duplicado de `lauPeriodos` que había quedado pegado dos veces en `iniciarModulo()`.
**Patrón para recordar (ya estaba anotado, se repitió):** cualquier total/cálculo derivado necesita listener propio sobre TODAS las colecciones/docs de los que depende, no solo lectura puntual.

**Tarjetas — bloqueo de período pagado:** cuando se tilda "pagado" en el período de una tarjeta, ahora se bloquea tanto el alta de gastos como la edición/borrado de ítems ya cargados:
- Variable módulo `periodoPagadoActual` en `tarjetas.js`, seteada en el listener de `escucharFechasPeriodo()`.
- Guardia en `guardarGasto()`: `if (periodoPagadoActual) return;` al principio.
- Se togglea clase `.form-bloqueado` (opacity 0.4 + `pointer-events: none`) sobre `#form-tarjeta` y sobre `#lista-tarjeta`, y se deshabilitan (`disabled`) todos los inputs/botones del form salvo el checkbox de débito automático.

**Módulo nuevo: Metas de ahorro** — separado a propósito de "Ahorro a guardar" (que es plata ya comprometida para gastos del próximo período, no ahorro real). Pensado para metas compartidas con Lau (ej. vacaciones), en pesos o dólares.
- Archivo nuevo `js/metas.js`, mismo patrón standalone que `deudalau.js`/`vencimientos.js` (su propio `onAuthStateChanged` + `iniciarModulo()`)
- Firestore: `users/{uid}/metasAhorro` → `{nombre, moneda: "ARS"|"USD", montoPropio, montoLau}`
- Cada ítem muestra aporte propio y de Lau por separado (editables), y el total combinado de la fila
- Totales separados por moneda al pie ("Total en pesos" / "Total en dólares"), sin mezclarlos entre sí ni sumarlos al cálculo de Disponible diario (ese sigue usando solo "Ahorro a guardar")
- Se sumaron a `utils.js`: `formatearUSD(valor)` (formato `US$ 1,234.56`, para no confundir con el `$` de pesos) y `parsearMonto(texto)` (antes solo vivía duplicado suelto en varios módulos; este archivo nuevo ya arrancó importándolo de utils en vez de sumar una copia más)
- Sección nueva en `app.html` dentro de tab-extra, debajo de "Ahorro a guardar"; script `js/metas.js` agregado junto a los demás `<script type="module">`

## Preferencias de trabajo del usuario
- Modo "principiante": indicar directamente qué cambiar, mínima explicación, un cambio a la vez, paso a paso
- Fragmento a cambiar, no el archivo completo (salvo archivo nuevo)
- Trabaja en español
- Ya tiene experiencia con este stack (Firebase + vanilla JS + GitHub Pages) en otros proyectos propios (JOOLI CateringDesk, Redeterminaciones 800/16)

## Próximos pasos posibles
- Terminar limpieza CSS: variables `--input-bg` y `--hoy` (pospuesto a la próxima sesión de estética)
- Revisar si `parsearMonto` conviene unificarse en `utils.js` en el resto de los módulos (hoy solo `metas.js` la importa de ahí; los demás siguen con su copia local) — mismo criterio que se usó con `formatearMonto`
- Cambios estéticos generales (pendiente, próxima etapa)
- Selector de año en Total (hoy fijo al año actual) — mejora futura, no urgente
