import { auth, db } from "./firebase-config.js";
import { formatearMonto, TARJETAS, obtenerHoyISO, armarIdPeriodo } from "./utils.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, deleteDoc, doc, updateDoc, setDoc, getDoc,
  query, where, onSnapshot, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

const hoy = new Date();
let mesActual = hoy.getMonth();
let anioActual = hoy.getFullYear();
let tarjetaActual = TARJETAS[0];

let unsubscribe = null;
let uid = null;
let yaIniciado = false;
let ultimoItemsSnapshot = [];
let comisionActual = 0;
let ivaActual = 0;
let selloManual = null;

onAuthStateChanged(auth, (user) => {
  if (user && !yaIniciado) {
    yaIniciado = true;
    uid = user.uid;
    iniciarModulo();
  }
});

function idPeriodo() {
  return armarIdPeriodo(tarjetaActual, mesActual, anioActual);
}

function escucharFechasPeriodo() {
  const ref = doc(db, "users", uid, "tarjetasPeriodos", idPeriodo());
  onSnapshot(ref, (snap) => {
    const data = snap.data() || {};
    document.getElementById("tj-fecha-cierre").value = data.fechaCierre || "";
    document.getElementById("tj-fecha-vencimiento").value = data.fechaVencimiento || "";
    actualizarEstadoPeriodo(data.fechaCierre, data.fechaVencimiento);
    document.getElementById("tj-pagado").checked = data.pagado || false;
    document.querySelector(".periodo-fechas").classList.toggle("periodo-pagado", data.pagado || false);
    document.getElementById("tj-pagado-texto").textContent = data.pagado ? "PAGADO" : "";

    comisionActual = data.comision || 0;
    ivaActual = data.iva || 0;
    selloManual = (data.sello !== undefined && data.sello !== null) ? data.sello : null;
    renderListaYTotales();
  });
}

async function guardarFechaPeriodo(campo, valor) {
  const ref = doc(db, "users", uid, "tarjetasPeriodos", idPeriodo());
  await setDoc(ref, { [campo]: valor }, { merge: true });
}

function actualizarEstadoPeriodo(fechaCierre, fechaVencimiento) {
  const hoyStr = obtenerHoyISO();
  const inputCierre = document.getElementById("tj-fecha-cierre");
  const inputVenc = document.getElementById("tj-fecha-vencimiento");

  inputCierre.classList.toggle("fecha-pasada", fechaCierre && fechaCierre <= hoyStr);
  inputVenc.classList.toggle("fecha-pasada", fechaVencimiento && fechaVencimiento <= hoyStr);
  inputVenc.classList.toggle("fecha-hoy", fechaVencimiento === hoyStr);
}

function iniciarModulo() {
  renderSelectorTarjetas();
  actualizarLabelMes();
  escucharDatos();

  document.getElementById("tj-mes-anterior").addEventListener("click", () => cambiarMes(-1));
  document.getElementById("tj-mes-siguiente").addEventListener("click", () => cambiarMes(1));
  document.getElementById("form-tarjeta").addEventListener("submit", guardarGasto);
  escucharFechasPeriodo();
  document.getElementById("tj-fecha-cierre").addEventListener("change", (e) => {
    guardarFechaPeriodo("fechaCierre", e.target.value);
  });
  document.getElementById("tj-fecha-vencimiento").addEventListener("change", (e) => {
    guardarFechaPeriodo("fechaVencimiento", e.target.value);
  });
  document.getElementById("tj-pagado").addEventListener("change", (e) => {
    guardarFechaPeriodo("pagado", e.target.checked);
    document.getElementById("tj-pagado-texto").textContent = e.target.checked ? "PAGADO" : "";
  });
}

function renderSelectorTarjetas() {
  const cont = document.getElementById("tarjeta-selector");
  cont.innerHTML = "";
  TARJETAS.forEach(t => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-tarjeta" + (t === tarjetaActual ? " active" : "");
    btn.textContent = t;
    btn.addEventListener("click", () => {
      tarjetaActual = t;
      renderSelectorTarjetas();
      escucharDatos();
      escucharFechasPeriodo();
    });
    cont.appendChild(btn);
  });
}

function cambiarMes(delta) {
  mesActual += delta;
  if (mesActual < 0) { mesActual = 11; anioActual--; }
  if (mesActual > 11) { mesActual = 0; anioActual++; }
  actualizarLabelMes();
  escucharDatos();
  escucharFechasPeriodo();
}

function actualizarLabelMes() {
  document.getElementById("tj-mes-actual-label").textContent = `${MESES[mesActual]} ${anioActual}`;
}

async function guardarGasto(e) {
  e.preventDefault();
  const descripcion = document.getElementById("tj-descripcion").value.trim().toUpperCase();
  const monto = parseFloat(document.getElementById("tj-monto").value);
  const cuotaActual = parseInt(document.getElementById("tj-cuota-actual").value) || null;
  const cuotaTotal = parseInt(document.getElementById("tj-cuota-total").value) || null;
  const montoLau = parseFloat(document.getElementById("tj-monto-lau").value) || 0;
  const debitoAutomatico = document.getElementById("tj-debito-automatico").checked;

  let mes = mesActual;
  let anio = anioActual;
  let cuota = cuotaActual;

  const MESES_DEBITO_AUTOMATICO = 24; // cuántos meses adelante generar

  const cantidadAGenerar = debitoAutomatico
    ? MESES_DEBITO_AUTOMATICO
    : (cuotaActual && cuotaTotal)
      ? (cuotaTotal - cuotaActual + 1)
      : 1;

  for (let i = 0; i < cantidadAGenerar; i++) {
    await addDoc(collection(db, "users", uid, "tarjetas"), {
      tarjeta: tarjetaActual,
      descripcion,
      monto,
      montoLau,
      cuotaActual: cuota,
      cuotaTotal,
      mes,
      anio,
      debitoAutomatico
    });

    mes++;
    if (mes > 11) { mes = 0; anio++; }
    if (cuota) cuota++;
  }

  e.target.reset();
}

function escucharDatos() {
  if (unsubscribe) unsubscribe();

  const q = query(
    collection(db, "users", uid, "tarjetas"),
    where("tarjeta", "==", tarjetaActual),
    where("mes", "==", mesActual),
    where("anio", "==", anioActual),
    orderBy("descripcion")
  );

  unsubscribe = onSnapshot(q, (snapshot) => {
    ultimoItemsSnapshot = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderListaYTotales();
  });
}

function renderListaYTotales() {
  const lista = document.getElementById("lista-tarjeta");
  lista.innerHTML = "";
  let total = 0;
  let totalLau = 0;
  let totalGross = 0;

  ultimoItemsSnapshot.forEach(item => {
    const lau = item.montoLau || 0;
    total += item.monto - lau;
    totalLau += lau;
    totalGross += item.monto;
    lista.appendChild(crearItemHTML(item.id, item));
  });

  if (tarjetaActual === "CORDOBESA") {
    const selloAutomatico = totalGross * 0.015;
    const sello = selloManual !== null ? selloManual : selloAutomatico;
    total += sello + comisionActual + ivaActual;

    lista.appendChild(crearItemFijoHTML("IMPUESTO AL SELLO", sello, "sello"));
    lista.appendChild(crearItemFijoHTML("IVA", ivaActual, "iva"));
    lista.appendChild(crearItemFijoHTML("COMISIÓN DE MANTENIMIENTO", comisionActual, "comision"));

  } else if (tarjetaActual === "MC MERCADO PAGO") {
    const selloAutomatico = totalGross * 0.015;
    const sello = selloManual !== null ? selloManual : selloAutomatico;
    total += sello;

    lista.appendChild(crearItemFijoHTML("IMPUESTO AL SELLO", sello, "sello"));
  }

  document.getElementById("total-tarjeta").textContent =
    formatearMonto(total);
  document.getElementById("total-tarjeta-lau").textContent =
    formatearMonto(totalLau);
  document.getElementById("total-tarjeta-general").textContent =
    formatearMonto(total + totalLau);
}

function crearItemHTML(id, item) {
  const li = document.createElement("li");
  li.className = "item-fila";

  const cuotaTexto = (item.cuotaActual && item.cuotaTotal)
    ? `${item.cuotaActual}/${item.cuotaTotal}`
    : "-";

  li.innerHTML = `
    <span class="item-nombre">${item.descripcion} <span class="item-cuota">(${cuotaTexto})</span></span>
    <input type="text" inputmode="decimal" class="item-monto-input" value="${formatearMonto(item.monto)}">
    ${item.montoLau ? `<input type="text" inputmode="decimal" class="item-lau-input" placeholder="Lau" value="${formatearMonto(item.montoLau)}">` : ""}
    <button class="btn-borrar">🗑</button>
  `;

  function manejarMonto(input, campo) {
    input.addEventListener("focus", (e) => {
      e.target.value = item[campo] || 0;
      e.target.select();
    });
    input.addEventListener("blur", async (e) => {
      let texto = e.target.value.replace(/[^0-9.,]/g, "");
      const ultimoSeparador = Math.max(texto.lastIndexOf(","), texto.lastIndexOf("."));
      let valor;
      if (ultimoSeparador === -1) {
        valor = parseFloat(texto) || 0;
      } else {
        const entero = texto.slice(0, ultimoSeparador).replace(/[.,]/g, "");
        const decimal = texto.slice(ultimoSeparador + 1);
        valor = parseFloat(entero + "." + decimal) || 0;
      }
      e.target.value = formatearMonto(valor);
      await updateDoc(doc(db, "users", uid, "tarjetas", id), { [campo]: valor });
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.target.blur();
    });
  }

  manejarMonto(li.querySelector(".item-monto-input"), "monto");

  const inputLauExistente = li.querySelector(".item-lau-input");
  if (inputLauExistente) manejarMonto(inputLauExistente, "montoLau");

  li.querySelector(".btn-borrar").addEventListener("click", async () => {
    if (confirm(`¿Borrar "${item.descripcion}"?`)) {
      await deleteDoc(doc(db, "users", uid, "tarjetas", id));
    }
  });

  return li;
}

function crearItemFijoHTML(nombre, monto, campo) {
  const li = document.createElement("li");
  li.className = "item-fila item-fijo";

  if (campo === null) {
    li.innerHTML = `
      <span class="item-nombre">${nombre}</span>
      <span class="item-monto">${formatearMonto(monto)}</span>
    `;
    return li;
  }

  li.innerHTML = `
    <span class="item-nombre">${nombre}</span>
    <input type="text" inputmode="decimal" class="item-monto-input" value="${formatearMonto(monto)}">
  `;

  const input = li.querySelector(".item-monto-input");
  input.addEventListener("focus", (e) => {
    e.target.value = campo === "comision" ? comisionActual : campo === "iva" ? ivaActual : monto;
    e.target.select();
  });
  input.addEventListener("blur", async (e) => {
    let texto = e.target.value.replace(/[^0-9.,]/g, "");
    const ultimoSeparador = Math.max(texto.lastIndexOf(","), texto.lastIndexOf("."));
    let valor;
    if (ultimoSeparador === -1) {
      valor = parseFloat(texto) || 0;
    } else {
      const entero = texto.slice(0, ultimoSeparador).replace(/[.,]/g, "");
      const decimal = texto.slice(ultimoSeparador + 1);
      valor = parseFloat(entero + "." + decimal) || 0;
    }
    e.target.value = formatearMonto(valor);
    await guardarFechaPeriodo(campo, valor);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.target.blur();
  });

  return li;
}
