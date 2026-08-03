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
- app.html → shell principal con 4 tabs: Total, Tarjetas, Imp. y Servicios, Extra
- css/styles.css → tema oscuro con acento dorado. Variables reales en :root:
  --bg: #0f1115; --card: #1a1d24; --accent: #d4af37; --text: #eaeaea;
  --text-dim: #9a9a9a; --error: #e05c5c
- js/firebase-config.js → conexión a Firebase (claves reales ya cargadas, login OK)
- js/auth.js → lógica de login
- js/app.js → protección de ruta, logout, navegación de tabs
- js/impserv.js → módulo Impuestos y Servicios (COMPLETO y funcionando)

Login y navegación YA FUNCIONAN correctamente en producción (GitHub Pages).

## Módulo "Impuestos y Servicios" (tab-impserv) - TERMINADO
Funcionalidad implementada:
- Selector de mes/año (flechas ◀ ▶) para navegar entre meses
- Accesos rápidos: botones para cargar rápido ítems frecuentes (EPEC, AGUA,
  GAS, etc.), guardados en Firestore en `users/{uid}/config/accesosRapidos`
  (editable: se pueden agregar nuevos con el form "+" y quitar con "✕")
- Formulario para agregar ítem: nombre (se guarda en MAYÚSCULAS), monto, fecha
  de vencimiento
- Listado del mes con: checkbox "pagado" (tacha y atenúa la fila), nombre,
  monto editable en formato moneda ARS (foco selecciona todo, blur formatea
  y guarda, Enter quita el foco), fecha editable, botón borrar (🗑 rojo)
- Total del mes calculado en vivo (suma de Firestore vía onSnapshot)
- Datos en Firestore: colección `users/{uid}/impuestosServicios`, cada doc:
  {nombre, monto, vencimiento, mes (0-11), anio, pagado}

Reglas de Firestore ya configuradas (solo el dueño puede leer/escribir sus
propios datos, patrón `users/{userId}/{document=**}`).

Bugs ya resueltos durante el desarrollo (por si se repiten):
- Import de Firebase debe ser con URL completa de gstatic, NUNCA estilo npm
- Falta de índice compuesto en Firestore → Firebase tira un link en el error
  de consola para crearlo con un clic
- `iniciarModulo()` usa await, por lo tanto DEBE ser `async function`
- Ojo con handlers duplicados al editar código (checkbox y borrar se
  perdieron un par de veces al pegar fragmentos nuevos, hay que revisar que
  sigan estando dentro de `crearItemHTML`)

## Módulo "Tarjetas" (tab-tarjetas) - TERMINADO
Archivos: js/tarjetas.js + bloque correspondiente en app.html + estilos en
css/styles.css.

Funcionalidad implementada:
- Selector de tarjeta (VISA HIPOTECARIO, VISA FRANCES, CORDOBESA,
  MC MERCADO PAGO) con botones, mismo patrón visual que accesos rápidos
- Selector de mes/año (flechas ◀ ▶), igual que impserv
- Fecha de cierre y fecha de vencimiento por período (no por gasto):
  se guardan en `users/{uid}/tarjetasPeriodos/{tarjeta}_{mes}_{anio}`
  (doc id armado con `idPeriodo()`, reemplazando espacios de la tarjeta
  por "_"). Inputs type="date", con `color-scheme: dark` en CSS para que
  se vean bien sobre fondo oscuro. Se autocargan/autoguardan con
  onSnapshot + setDoc(merge:true) al cambiar de tarjeta o mes.
- Formulario para agregar gasto: descripción (MAYÚSCULAS), monto cuota,
  cuota actual, cuota total (ambas opcionales), monto Lau (opcional),
  checkbox "Débito automático"
- Cuotas: si se cargan cuota actual/total, `guardarGasto()` genera
  automáticamente un documento por cada cuota restante en los meses
  siguientes (incrementando mes/año y el número de cuota)
- Débito automático: si el checkbox está tildado, se generan documentos
  para los próximos 24 meses (constante `MESES_DEBITO_AUTOMATICO`,
  ajustable) con el mismo monto, marcados con `debitoAutomatico: true`
- Listado del período con: nombre + cuota (ej. "8/12"), monto editable
  en formato moneda ARS (mismo patrón foco/blur/Enter que impserv),
  monto Lau editable igual, botón borrar (🗑 rojo)
- Total del período y total Lau calculados en vivo (onSnapshot), separados
- Datos en Firestore: colección `users/{uid}/tarjetas`, cada doc:
  {tarjeta, descripcion, monto, montoLau, cuotaActual, cuotaTotal, mes
  (0-11), anio, debitoAutomatico}
- Query con `where tarjeta/mes/anio` + `orderBy descripcion` → puede pedir
  crear índice compuesto en Firestore (mismo patrón que impserv)

Notas de CSS relevantes:
- `.periodo-fechas` (contenedor de fechas cierre/vencimiento): sutil,
  `color: var(--text-dim)`, íconos 🔒 y ⏰ en vez de labels de texto,
  inputs con fondo transparente y `color-scheme: dark`
- `.check-debito`: checkbox de débito automático en su propia línea
  (`flex: 1 1 100%; order: 10;`) para no achicar los demás inputs del
  form (requiere que `.form-item` sea `display:flex; flex-wrap:wrap`)
- Marcado visual de cierre/vencimiento: `actualizarEstadoPeriodo()` compara
  con la fecha de hoy (string ISO) y agrega clases CSS a los inputs de
  fecha: `.fecha-pasada` (rojo, `--error`) si cierre o vencimiento ya
  pasaron, `.fecha-hoy` (dorado, `--accent`, negrita) si el vencimiento es
  justo hoy. Se llama desde dentro del onSnapshot de
  `escucharFechasPeriodo()` cada vez que cambian los datos del período.

## Próximo módulo a construir
Extra: por ahora el tab solo tiene un placeholder en app.html
(`<section id="tab-extra">` con un `<p>` de texto). Arrancando por
"Saldos por cuenta bancaria y efectivo" (primera parte a construir dentro
de Extra). Después queda pendiente: ahorro, días para cobrar/disponible
diario, gastos de LAU, vencimientos próximos consolidados.

### Saldos por cuenta - en construcción
- Tipos de cuenta: banco, billetera (billetera virtual), efectivo
- Formulario en app.html (tab-extra): nombre, saldo, `<select id="cuenta-tipo">`
  con esas 3 opciones (value: banco/billetera/efectivo)
- Diferenciación visual: cada `<li class="item-cuenta ${tipo}">` tiene un
  borde izquierdo de color distinto por tipo (`.banco` → var(--accent),
  `.billetera` → #7aa6c2, `.efectivo` → var(--text-dim)) + ícono según
  `ICONOS_TIPO = { banco: "🏦", billetera: "📱", efectivo: "💵" }`
  (constante definida en js/extra.js junto a las demás constantes globales)
- Archivo js/extra.js: todavía no creado, en construcción

## Pendiente para módulos futuros
- Total: resumen calculado sumando tarjetas + impuestos/servicios,
  ingreso mensual, diferencia
- Extra: resto de las partes además de saldos por cuenta (ver arriba)

## Nota de seguridad
La planilla original (IMP-SERV) tenía contraseñas y datos sensibles en
texto plano junto a los datos financieros. Esos datos NO se migran a la
app tal cual; se dejan fuera o se manejan aparte.

## Preferencias de trabajo del usuario
- Modo "principiante": indicar directamente qué parte del código cambiar
  o agregar, con mínima explicación (no hace falta justificar el porqué
  salvo que se pregunte), un cambio a la vez, paso a paso
- Trabaja en español
- Ya tiene experiencia con este mismo stack (Firebase + vanilla JS +
  GitHub Pages) en otros dos proyectos propios
