# Contexto: App "Mis Cuentas" (cuentas-app)

## Qué es
App web (PWA) para reemplazar una planilla Excel de economía personal mensual.
Repo: github.com/diegali/cuentas-app (GitHub Pages)

## Stack
- HTML/CSS/JS vanilla (sin frameworks, sin npm)
- Firebase Auth (email/contraseña) + Firestore
- Imports de Firebase con URL completa de gstatic (NO usar imports estilo npm
  "firebase/app", eso rompe todo con error de module specifier)
- Hosteado en GitHub Pages, rama main, carpeta raíz

## Origen: estructura de la planilla Excel original
- Hojas HIP, FRA, COR, PAT, MP, COR LAU: gastos de tarjetas de crédito
  (compras en cuotas, organizadas por mes en bloques de columnas)
- IMP-SERV: datos de referencia (cuentas, usuarios) + impuestos/servicios
  mensuales con monto y fecha de vencimiento
- TOTAL: suma de todas las tarjetas + impuestos/servicios, ingreso mensual,
  diferencia disponible
- EXTRA: plata a guardar, saldos por cuenta bancaria y efectivo, días para
  cobrar (disponible diario), gastos de LAU, vencimientos próximos

## Decisión de simplificación (vs. planilla)
En vez de columnas por mes (como Excel), cada gasto/vencimiento es un
documento individual en Firestore. El TOTAL se calcula sumando consultas,
no con fórmulas manuales mes a mes.

## Estado actual del proyecto (archivos ya creados y funcionando)
- index.html → login (email/contraseña)
- app.html → shell principal con 4 tabs, en este ORDEN: **Panel** (antes
  llamado "Extra", es el tab activo por defecto al abrir la app —
  `data-tab="extra"` se mantuvo igual en el código, solo cambió el texto
  visible del botón a "Panel"), Total, Tarjetas, Imp. y Servicios
- css/styles.css → tema oscuro con acento dorado. Variables reales en :root:
  --bg: #0f1115; --card: #1a1d24; --accent: #d4af37; --text: #eaeaea;
  --text-dim: #9a9a9a; --error: #e05c5c
- js/firebase-config.js → conexión a Firebase (claves reales ya cargadas, login OK)
- js/auth.js → lógica de login
- js/app.js → protección de ruta, logout, navegación de tabs
- js/impserv.js → módulo Impuestos y Servicios (COMPLETO)
- js/tarjetas.js → módulo Tarjetas (COMPLETO)
- js/extra.js → módulo Extra: Saldos por cuenta + Ahorro + Disponible diario (COMPLETO)
- js/vencimientos.js → módulo Extra: Vencimientos del mes (COMPLETO)
- js/deudalau.js → módulo Extra: Debe Lau (COMPLETO)
- js/total.js → módulo Total: resumen anual comparativo (COMPLETO)

Login y navegación YA FUNCIONAN correctamente en producción (GitHub Pages).

## Módulo "Impuestos y Servicios" (tab-impserv) - COMPLETO
Funcionalidad implementada:
- Selector de mes/año (flechas ◀ ▶)
- Botón "Copiar mes anterior": trae todos los ítems del mes anterior (nombre,
  monto, montoLau) con la fecha de vencimiento vacía para completarla a mano
  (pide confirmación con la cantidad de ítems antes de copiar)
- Accesos rápidos editables: botones para cargar rápido ítems frecuentes,
  guardados en `users/{uid}/config/accesosRapidos` (agregar con form "+",
  quitar con "✕")
- Formulario para agregar ítem: nombre (MAYÚSCULAS), monto, fecha de
  vencimiento, monto Lau (opcional)
- Listado del mes con: checkbox "pagado" (`.check-pagado input`, guarda
  `pagado: true/false` con updateDoc; tacha y atenúa la fila), nombre,
  monto editable en formato moneda ARS (foco selecciona todo, blur formatea
  y guarda, Enter quita el foco), fecha editable (fondo más claro +
  color-scheme: dark), campo Lau (SOLO se muestra si el ítem tiene
  montoLau > 0, se carga únicamente desde el formulario al crear el ítem),
  botón borrar (🗑 rojo)
- Resaltado de vencimientos: si el ítem no está pagado y la fecha ya pasó,
  toda la fila (`.item-fila`) se pinta de rojo (`fecha-pasada`); si vence
  hoy, celeste/azul (`fecha-hoy`, #7aa6c2). Incluye ajustes de color de
  texto, inputs y checkbox, y botón borrar con fondo oscuro + borde blanco
  para que no se pierda contra el rojo
- Total del mes calculado en vivo (suma de Firestore vía onSnapshot)
- Datos en Firestore: colección `users/{uid}/impuestosServicios`, cada doc:
  {nombre, monto, montoLau, vencimiento, mes (0-11), anio, pagado}

Reglas de Firestore ya configuradas (solo el dueño puede leer/escribir sus
propios datos, patrón `users/{userId}/{document=**}`).

## Módulo "Tarjetas" (tab-tarjetas) - COMPLETO
Funcionalidad implementada:
- Selector de tarjeta con botones. Nombres reales confirmados en el array
  `TARJETAS`: incluye `"CORDOBESA"` (Córdobesa) y `"MC MERCADO PAGO"`
  (Mercado Pago) — OJO, no "COR" ni "MP", hubo bugs por desfasaje de
  nombres entre archivos. SIEMPRE verificar el array `TARJETAS` completo y
  actual de tarjetas.js antes de tocar algo que dependa del nombre de una
  tarjeta.
- Selector de mes/año (flechas ◀ ▶)
- Período por tarjeta (no por gasto), guardado en
  `users/{uid}/tarjetasPeriodos/{tarjeta}_{mes}_{anio}` (doc id armado con
  `idPeriodo()`, espacios reemplazados por "_"), con:
  - Fecha de cierre (`fechaCierre`) y vencimiento (`fechaVencimiento`),
    inputs dentro de `.periodo-fechas`, autoguardado vía
    `guardarFechaPeriodo(campo, valor)` → `setDoc(merge:true)`
  - Checkbox "pagado" (`tj-pagado` + span `tj-pagado-texto`): al tildarlo,
    guarda `pagado:true` en el doc de tarjetasPeriodos, el contenedor
    `.periodo-fechas` se resalta (`.periodo-pagado`, fondo celeste tenue +
    borde) y aparece el texto "PAGADO" en grande al lado del check
  - `actualizarEstadoPeriodo()` marca `.fecha-pasada`/`.fecha-hoy` en los
    inputs de cierre/vencimiento comparando con hoy (reglas CSS separadas,
    NO comparten estilo con `.item-fila` de impserv/vencimientos)
  - Ítems fijos que se agregan al final de la lista de gastos, calculados
    y guardados en el doc de tarjetasPeriodos (NO son documentos en la
    colección `tarjetas`):
    - CORDOBESA: 3 ítems — IMPUESTO AL SELLO (automático 1.5% de la suma
      de montos brutos del período, editable con override manual en
      campo `sello`), COMISIÓN DE MANTENIMIENTO (manual, campo
      `comision`), IVA (manual, campo `iva`)
    - MC MERCADO PAGO: 1 ítem — IMPUESTO AL SELLO (mismo criterio:
      automático 1.5%, override manual en campo `sello`), sin comisión ni
      IVA
    - Todos suman al total del mes de esa tarjeta. Función clave:
      `renderListaYTotales()`, variables globales `comisionActual`,
      `ivaActual`, `selloManual`. Función que arma cada fijo:
      `crearItemFijoHTML(nombre, monto, campo)` (campo =
      "sello"/"comision"/"iva"/null)
- Formulario para agregar gasto: descripción (MAYÚSCULAS), monto cuota,
  cuota actual, cuota total (opcionales), monto Lau (opcional), checkbox
  "Débito automático"
- Cuotas: si se cargan cuota actual/total, `guardarGasto()` genera
  automáticamente un doc por cada cuota restante en los meses siguientes
- Débito automático: genera documentos para los próximos 24 meses
  (constante `MESES_DEBITO_AUTOMATICO`), marcados con `debitoAutomatico: true`
- Listado del período: nombre + cuota (ej. "8/12"), monto editable, campo
  Lau (solo si montoLau > 0), botón borrar. Función que arma cada gasto:
  `crearItemHTML()`
- Totales del período, en vivo: "Total del mes" (lo que le corresponde
  pagar al usuario: resta montoLau de cada ítem + suma los fijos de la
  tarjeta si aplica), "Te debe Lau" (suma de todos los montoLau), y
  "Total general" (Total del mes + Te debe Lau = total real de la tarjeta,
  bruto)
- Datos en Firestore: colección `users/{uid}/tarjetas`, cada doc:
  {tarjeta, descripcion, monto, montoLau, cuotaActual, cuotaTotal, mes
  (0-11), anio, debitoAutomatico}
- Query con `where tarjeta/mes/anio` + `orderBy descripcion` → requiere
  índice compuesto en Firestore (ya creado). Snapshot se guarda en
  `ultimoItemsSnapshot` (variable global) y se renderiza con
  `renderListaYTotales()`, separado del listener de Firestore
  (`escucharDatos()`), para poder re-renderizar cuando cambian
  comisión/IVA/sello sin necesidad de un nuevo snapshot de gastos

## Módulo "Extra" (tab-extra) - Saldos por cuenta - COMPLETO
- Formulario: nombre, saldo (input tipo texto con formato moneda),
  `<select id="cuenta-tipo">` con: banco / billetera / efectivo
- Se muestran como tarjetas/cuadros, agrupadas en FILAS HORIZONTALES por
  tipo, orden: Billetera → Banco → Efectivo. Fila con título a la
  izquierda (`.titulo-fila-cuenta`) y tarjetas a la derecha
  (`.grupo-cuentas`, flex-wrap)
- Cada tarjeta (`.item-cuenta`): ícono según tipo (`ICONOS_TIPO`) o logo
  personalizado si el ítem tiene el campo `logo` cargado, nombre, saldo
  editable (patrón foco/blur/Enter), botón borrar arriba a la derecha
  (position: absolute)
- Logo personalizado (opcional, por cuenta): campo de texto `#cuenta-logo`
  donde se escribe solo el NOMBRE del archivo (ej. `galicia.png`, sin
  ruta). Las imágenes las sube el usuario a mano a la carpeta
  `assets/logos/` del repo (no hay picker de sistema operativo ni
  Firebase Storage, es solo texto + carpeta estática). En
  `crearItemHTML()`, si `item.logo` existe, se muestra
  `<img src="assets/logos/${item.logo}">` en vez del emoji de
  `ICONOS_TIPO` (tamaño 32x32px en CSS, `.cuenta-icono img`). OJO: el
  campo `logo` debe agregarse explícitamente al objeto del `addDoc` en
  `guardarCuenta()` — se pisó una vez sin querer, quedaba leído pero
  nunca guardado, por eso el logo no aparecía pese a estar bien escrito
- Total disponible calculado en vivo (suma de todas las cuentas), guardado
  en variable global `totalCuentasActual` (usada también por Disponible
  diario)
- Datos en Firestore: colección `users/{uid}/cuentas`, cada doc:
  {nombre, saldo, tipo}
- El elemento de cada cuenta es un `<div>` (no `<li>`), contenedor
  `#lista-cuentas` es `<div>` (no `<ul>`)

## Módulo "Extra" (tab-extra) - Ahorro a guardar - COMPLETO
- Formulario simple: nombre/motivo, monto → botón Agregar
- Listado editable (mismo patrón foco/blur/Enter para el monto), botón
  borrar
- Total a guardar en vivo, guardado en variable global `totalAhorroActual`
  (usada por Disponible diario)
- Datos en Firestore: colección `users/{uid}/ahorros`, cada doc:
  {nombre, monto}

## Módulo "Extra" (tab-extra) - Disponible diario - COMPLETO
- Un solo input de fecha (`#dia-cobro`, "Próximo cobro"), autoguardado en
  `users/{uid}/config/diaCobro` (campo `fecha`) vía `guardarDiaCobro()` +
  autocargado con onSnapshot vía `escucharDiaCobro()`
- Cálculo (`calcularDisponibleDiario()`, es `async`): días restantes =
  diferencia en días entre hoy y la fecha de cobro (mínimo 1 para evitar
  división por cero); disponible por día = (totalCuentasActual -
  totalAhorroActual - totalVencimientos) / días restantes
- `totalVencimientos` se obtiene con `calcularTotalVencimientosMes(uid,
  mesActual, anioActual)`, función definida y exportada desde
  `vencimientos.js` (mismo cálculo que usa ese módulo: impuestos/servicios
  no pagados del mes + vencimientos de tarjetas no pagados, con
  sello/comisión/IVA de CORDOBESA y MC MERCADO PAGO incluidos)
- Se recalcula automáticamente cada vez que cambian: el total de cuentas,
  el total de ahorro, o la fecha de cobro (se llama `calcularDisponibleDiario()`
  sin `await` desde esos 3 listeners `onSnapshot`, es válido en JS aunque
  la función sea async — no hace falta esperarla ahí)
- OJO: cualquier callback de `onSnapshot` que haga `await calcularDisponibleDiario()`
  (o cualquier otro await) DEBE declararse como `async (snapshot) => {...}`,
  si no tira `SyntaxError: Unexpected reserved word` (pasó en `escucharAhorro`)

## Módulo "Extra" (tab-extra) - Vencimientos del mes - COMPLETO
Archivo: js/vencimientos.js. Consolida en una sola lista, ordenada por
fecha de vencimiento ascendente:
- Ítems de Impuestos y Servicios del mes que NO están pagados (se
  filtran con `.filter(item => !item.pagado)` ANTES de mapear el array —
  esta línea se pisó sin querer una vez al agregar los listeners de
  tarjetas, ojo si se vuelve a tocar `escucharTodo()`), con nombre y monto
  BRUTO real (`item.monto`, SIN restar montoLau — antes restaba montoLau,
  se cambió para que sea consistente con Tarjetas: acá siempre se muestra
  el total real a pagar, la parte de Lau se trackea aparte en el módulo
  Debe Lau)
- Vencimientos de tarjetas del mes: para cada tarjeta del array `TARJETAS`
  (debe coincidir EXACTO con el de tarjetas.js, incluyendo "CORDOBESA" y
  "MC MERCADO PAGO"), lee el doc de tarjetasPeriodos
  (`idPeriodoTarjeta(tarjeta)`, mismo formato que `idPeriodo()` de
  tarjetas.js) y si tiene `fechaVencimiento` Y `pagado` es falso: suma el
  monto BRUTO de todos los gastos de esa tarjeta en el período (sin restar
  montoLau — acá se quiere el total general, no lo que le toca solo al
  usuario), y si la tarjeta es CORDOBESA o MC MERCADO PAGO, replica el
  mismo cálculo de sello/comisión/IVA que tarjetas.js (mismos campos del
  doc de tarjetasPeriodos: `sello`, `comision`, `iva`) para que el monto
  mostrado sea el total real a pagar de esa tarjeta, no solo la suma de
  consumos. Si `pagado` es true, se excluye de la lista.
- Sin selector de mes propio: `mesActual`/`anioActual` quedan fijos en el
  mes/año de hoy (ver sección "Extra sin navegación de mes" más abajo)
- Cada fila muestra: nombre + tipo entre paréntesis ("Impuesto/Servicio" o
  "Tarjeta"), fecha formateada, monto
- Resaltado: mismo criterio que impserv — fila completa roja si venció
  (`fecha-pasada`), celeste/azul si vence hoy (`fecha-hoy`, #7aa6c2).
  Reglas CSS compartidas con impserv.js sobre `.item-fila`
- Total general de vencimientos del mes en vivo
- TIEMPO REAL COMPLETO: usa onSnapshot tanto para impuestosServicios como
  para CADA período de tarjeta (`unsubscribesPeriodos`, un listener por
  tarjeta sobre su doc en tarjetasPeriodos). Cualquier cambio en fecha de
  vencimiento, comisión, IVA, sello o el checkbox "pagado" de cualquier
  tarjeta dispara `renderCombinado()` sin necesidad de F5. La suma de
  gastos de cada tarjeta sigue siendo una lectura puntual (`getDocs`)
  dentro de `obtenerVencimientosTarjetas()`, ejecutada cada vez que se
  llama a `renderCombinado()`
- No requiere índice compuesto extra: las queries de suma por tarjeta usan
  solo igualdades (where tarjeta/mes/anio sin orderBy)
- Exporta `calcularTotalVencimientosMes(uid, mes, anio)`: versión reusable
  del mismo cálculo (impuestos/servicios no pagados en monto BRUTO +
  tarjetas no pagadas con sello/comisión/IVA), usada por `extra.js` para
  Disponible diario, sin tocar el DOM (a diferencia de `renderCombinado()`,
  que sí lo hace). IMPORTANTE: debe usar `total += item.monto` (bruto),
  NUNCA `item.monto - item.montoLau` — hubo un bug donde esta función
  quedó desactualizada (restando montoLau) después de cambiar la lógica
  del listado en pantalla, haciendo que "Total vencimientos" mostrara un
  número distinto al usado en el cálculo de Disponible diario

## Módulo "Extra" (tab-extra) - Debe Lau - COMPLETO
Archivo: js/deudalau.js. Lista los ítems del mes (impserv + tarjetas) que
tienen `montoLau > 0`, para chequear con Lau y marcar como pagado en
bloque:
- Junta ítems de `impuestosServicios` y `tarjetas` del mes actual con
  `montoLau > 0` (dos listeners onSnapshot, `ultimoImp` + `ultimoTarj`,
  se combinan en `renderCombinado()`)
- El "pagado" es UNO SOLO por mes (no por ítem, a diferencia de lo que se
  intentó primero): checkbox único `#ld-pagado`, guardado en
  `users/{uid}/lauPeriodos/{mes}_{anio}` (campo `pagado`), vía
  `escucharPeriodoLau()` / `idPeriodoLau()`, mismo patrón que
  `tj-pagado` de tarjetas.js
- Al tildar "Pagado": el checkbox toma el mismo estilo resaltado que usa
  Tarjetas (clase `.check-periodo-pagado.periodo-pagado`, fondo celeste
  tenue + borde `#7aa6c2`) y la lista de ítems (`#lista-lau`) se atenúa y
  tacha (`.lista-pagada`: opacity 0.4 + line-through)
- Checkbox ubicado DENTRO del `<h3>Debe Lau</h3>`, al lado del título
  (no en su propia fila)
- Listado simple (sin checkbox individual): nombre + montoLau de cada
  ítem
- Total "Pendiente" en vivo (`#total-lau-pendiente`, con clase
  `.total-mes` para mismo estilo que "Total vencimientos"): si el período
  está marcado como pagado, muestra $0; si no, suma todos los montoLau
- Exporta `calcularTotalLauPendiente(uid, mes, anio)`: primero chequea si
  el período está pagado (si sí, devuelve 0 directo); si no, suma
  montoLau de impuestosServicios + tarjetas del mes. Usada por extra.js
  en Disponible diario
- Datos en Firestore: NO crea colección propia para los ítems (lee de
  impuestosServicios y tarjetas ya existentes); solo crea
  `users/{uid}/lauPeriodos/{mes}_{anio}`: {pagado}

## Módulo "Extra" (tab-extra) - Disponible diario - actualización
Se agregó `totalLau` a la fórmula (además de `totalVencimientos`, ya
documentado arriba): `calcularTotalLauPendiente(uid, mes, anio)` (desde
deudalau.js) se SUMA al disponible (es plata que Lau le va a devolver al
usuario, un crédito a favor, no un descuento). Fórmula final:
```
disponible = (totalCuentasActual - totalAhorroActual - totalVencimientos + totalLau) / dias
```
En `iniciarModulo()` de extra.js hay un listener extra para que se
recalcule solo al tildar/destildar "Pagado" en Debe Lau (si no, el
disponible queda desactualizado hasta que cambie cuentas/ahorro/fecha de
cobro):
```js
onSnapshot(
  doc(db, "users", uid, "lauPeriodos", `${hoy.getMonth()}_${hoy.getFullYear()}`),
  () => calcularDisponibleDiario()
);
```
CONFIRMADO Y VERIFICADO con console.log que el cálculo da bien: con Lau
pagado ($0 de crédito) el disponible por día coincide exacto con
`(totalCuentas - totalAhorro - totalVencimientos) / dias`.

## Extra: sin navegación de mes propia (todos los sub-módulos)
Se sacó el selector de mes/año (flechas ◀ ▶) de Vencimientos y de Debe
Lau — ya no tiene sentido navegar meses ahí, esa sección siempre debe
reflejar el mes en curso hasta que el usuario cargue la próxima fecha de
cobro. Cambios aplicados:
- Un solo encabezado de mes arriba de todo el tab (`extra.js`,
  `iniciarModulo()`): `<div class="mes-extra-header">📅 <span
  id="mes-extra-label"></span></div>`, texto tipo "AGOSTO 2026"
- En vencimientos.js y deudalau.js: se sacaron las funciones
  `actualizarLabelMes()` y `cambiarMes()`, y los listeners de los botones
  de mes (ya no existen esos elementos en el HTML). `mesActual`/
  `anioActual` quedan fijos en el mes/año de hoy desde el inicio
- Separación visual entre sub-secciones de Extra: `<hr
  class="separador-extra">` entre Saldos por cuenta / Ahorro / Disponible
  diario / Debe Lau / Vencimientos (en vez del viejo selector de mes de
  cada uno)


La mayoría de los ítems los paga el usuario completo; muy pocos se
dividen con Lau (esposa). El campo Lau:
- Se carga SOLO desde el formulario al crear el ítem (input opcional)
- En el listado, el input de Lau de un ítem SOLO aparece si ese ítem ya
  tiene `montoLau > 0`. Si no, no se muestra nada (sin botón "+ Lau")
- Dentro de cada módulo (impserv, tarjetas) el monto Lau se resta del
  total "normal" del usuario y se suma aparte en "Te debe Lau"
- En Vencimientos (Extra) es distinto a propósito: ahí se quiere ver el
  total GENERAL (bruto, sin restar Lau, en ambos tipos de ítem — impserv y
  tarjetas), porque lo que importa en esa pantalla es cuánta plata hay que
  tener disponible para pagar ese vencimiento completo, no solo la parte
  del usuario
- El módulo "Debe Lau" (Extra) es el que trackea aparte cuánto de esa
  plata ya adelantada corresponde reclamarle a Lau, mes a mes, con un
  solo checkbox "pagado" para todo el período (no ítem por ítem)

## Bugs ya resueltos durante el desarrollo (por si se repiten)
- Import de Firebase debe ser con URL completa de gstatic, NUNCA estilo npm
- Falta de índice compuesto en Firestore → Firebase tira un link en el error
  de consola para crearlo con un clic (afecta queries con where + orderBy
  combinados; queries solo con where/igualdades no lo necesitan)
- Funciones que usan `await` deben ser `async function`
- Ojo con handlers duplicados al editar/pegar fragmentos: revisar que
  sigan estando dentro de la función que arma cada ítem
- Inputs de fecha muy oscuros por defecto: siempre agregar `background`
  más claro + `color-scheme: dark`
- Botón de borrar (rojo) se mezcla si la fila también está pintada de rojo
  (fecha-pasada): requiere fondo oscuro + borde blanco en ese caso
- Desfasaje de nombres de tarjetas entre archivos (tarjetas.js usa
  "CORDOBESA"/"MC MERCADO PAGO", vencimientos.js tuvo nombres viejos
  desactualizados más de una vez) rompe en silencio las queries —
  SIEMPRE verificar que el array `TARJETAS` sea idéntico en tarjetas.js y
  vencimientos.js
- Datos que dependen de otra colección/doc (ej. vencimientos de tarjetas
  en Extra) necesitan listeners propios (onSnapshot) para actualizarse
  solos; una lectura puntual (getDocs/getDoc) sin listener requiere F5
- Cuando existen DOS versiones de un mismo cálculo (una que renderiza en
  pantalla + una exportada para reusar en otro módulo, ej.
  `renderCombinado()` vs `calcularTotalVencimientosMes()` en
  vencimientos.js), un cambio de lógica aplicado solo a una de las dos
  deja resultados inconsistentes entre pantallas — revisar SIEMPRE ambas
  cuando se cambia la fórmula de algo que se calcula en más de un lugar
- Al pegar fragmentos nuevos dentro de una función grande (ej.
  `escucharTodo()` en vencimientos.js), es fácil pisar sin querer líneas
  de lógica ya existente (pasó con el filtro `!item.pagado`) — conviene
  revisar el bloque completo después de cada cambio grande, no solo la
  parte nueva
- `getElementById` con un `id` DUPLICADO en el HTML (ej. dos elementos
  con `id="ld-pagado"` al pegar fragmentos viejos y nuevos juntos) rompe
  en silencio: siempre encuentra el primero, el segundo queda "fantasma"
  y ningún listener se le engancha correctamente
- Al iterar cambios de estilo varias veces sobre lo mismo, quedan
  reglas CSS viejas sin usar (ej. `.check-pagado-periodo`,
  `.selector-mes.periodo-pagado`) — conviene pedir que se pase el CSS
  completo de la zona de vez en cuando para limpiar lo que ya no aplica
- Un `${variable}` escrito directo en un archivo `.html` es texto LITERAL,
  no se evalúa (eso solo funciona dentro de template strings en `.js`) —
  pasó con el título de Total, mostraba `${anioActual}` tal cual en
  pantalla; la solución es un `<span>` vacío + `textContent` seteado
  desde JS

## Módulo "Total" (tab-total) - COMPLETO
Archivo: js/total.js. Grilla de 12 tarjetas (4 columnas x 3 filas fijas,
`.grilla-total`), una por mes del año actual (ENERO a DICIEMBRE, año fijo
= `new Date().getFullYear()`, sin selector de año todavía). Cada tarjeta
(`.card-mes-total`) muestra: nombre del mes, Ingreso (editable), Tarjetas,
Imp./Servicios, Diferencia — reemplazó al diseño original de tabla, que
se descartó por pedido del usuario a favor de este formato tipo card
- Tarjetas e Imp./Servicios: se traen TODO el año de una sola vez con
  onSnapshot (`where anio == anioActual`, sin filtrar por mes) y se
  agrupan en el navegador en arrays de 12 posiciones
  (`totalesTarjetas`, `totalesImpserv`, índice = mes 0-11), en vez de
  hacer 12 queries separadas
- IMPORTANTE: ambos montos son NETOS (`item.monto - (item.montoLau ||
  0)`, restando la parte de Lau), NO brutos — a propósito distinto del
  criterio de Vencimientos (Extra), que sí usa monto bruto. Acá se quiere
  ver solo lo que le corresponde pagar al usuario, mismo criterio que
  "Total del mes" en Tarjetas/Imp. y Servicios
- Ingreso: editable directo en cada tarjeta (mismo patrón foco/blur/Enter
  que el resto de la app), guardado en `users/{uid}/ingresos/{mes}_{anio}`:
  {mes, anio, monto}, vía setDoc(merge:true)
- Diferencia = Ingreso - Tarjetas - Imp./Servicios, en verde si es
  positiva (`.diferencia-positiva`) o rojo si es negativa
  (`.diferencia-negativa`)
- La tarjeta del mes actual (comparando con `new Date()`) se resalta con
  borde dorado + fondo tenue dorado (`.mes-actual`)
- Título "Resumen {año}" con el año insertado por JS en
  `#anio-total-label` (NO usar `${anioActual}` directo en el HTML, eso es
  solo texto literal ahí, no se evalúa — hay que setear el `textContent`
  desde `iniciarModulo()`)
- Se recalcula y re-renderiza toda la grilla (`renderTabla()`, nombre de
  función se mantuvo aunque ya no arma una tabla) cada vez que cambia
  cualquiera de los 3 listeners (tarjetas, impuestosServicios, ingresos)

## Próximo módulo a construir
No queda ningún módulo pendiente de los 4 tabs originales (Total,
Tarjetas, Imp. y Servicios, Panel/Extra) — los 4 están completos. Posibles
mejoras futuras a evaluar más adelante: selector de año en la pantalla
Total (hoy fijo al año actual), selector visual de logos por carpeta
(se probó y se descartó por ahora, quedó en modo texto simple).

## Nota de seguridad
La planilla original (IMP-SERV) tenía contraseñas y datos sensibles en
texto plano junto a los datos financieros. Esos datos NO se migran a la
app tal cual; se dejan fuera o se manejan aparte.

## Preferencias de trabajo del usuario
- Modo "principiante": indicar directamente qué parte del código cambiar
  o agregar, con mínima explicación, un cambio a la vez, paso a paso
- Prefiere que se le indique solo el fragmento a cambiar, NO el archivo
  completo (para ahorrar cuota), salvo que sea un archivo nuevo
- Trabaja en español
- Ya tiene experiencia con este mismo stack (Firebase + vanilla JS +
  GitHub Pages) en otros dos proyectos propios
