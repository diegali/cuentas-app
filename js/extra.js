import { auth, db } from "./firebase-config.js";
import { TARJETAS } from "./utils.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { calcularTotalLauPendienteHasta } from "./deudalau.js";
import {
  collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, getDoc, setDoc, query, where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { calcularTotalVencimientosHasta } from "./vencimientos.js";

const ICONOS_TIPO = { banco: "🏦", billetera: "📱", efectivo: "💵" };
const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

let uid = null;
let totalCuentasActual = 0;
let totalAhorroActual = 0;
let yaIniciado = false;

onAuthStateChanged(auth, (user) => {
  if (user && !yaIniciado) {
    yaIniciado = true;
    uid = user.uid;
    iniciarModulo();
  }
});

function iniciarModulo() {
  escucharCuentas();
  escucharAhorro();
  escucharDiaCobro();
  const hoy = new Date();

  onSnapshot(
    doc(db, "users", uid, "lauPeriodos", `${hoy.getMonth()}_${hoy.getFullYear()}`),
    () => calcularDisponibleDiario()
  );

  onSnapshot(
    query(
      collection(db, "users", uid, "impuestosServicios"),
      where("mes", "==", hoy.getMonth()),
      where("anio", "==", hoy.getFullYear())
    ),
    () => calcularDisponibleDiario()
  );

  onSnapshot(
    query(
      collection(db, "users", uid, "tarjetas"),
      where("mes", "==", hoy.getMonth()),
      where("anio", "==", hoy.getFullYear())
    ),
    () => calcularDisponibleDiario()
  );

  TARJETAS.forEach(tarjeta => {
    const idPeriodo = `${tarjeta.replace(/\s+/g, "_")}_${hoy.getMonth()}_${hoy.getFullYear()}`;
    onSnapshot(
      doc(db, "users", uid, "tarjetasPeriodos", idPeriodo),
      () => calcularDisponibleDiario()
    );
  });

  document.getElementById("mes-extra-label").textContent = `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`;
  document.getElementById("form-cuenta").addEventListener("submit", guardarCuenta);
  document.getElementById("form-ahorro").addEventListener("submit", guardarAhorro);
  document.getElementById("dia-cobro").addEventListener("change", guardarDiaCobro);
}

function parsearMonto(texto) {
  texto = texto.replace(/[^0-9.,]/g, "");
  const ultimoSeparador = Math.max(texto.lastIndexOf(","), texto.lastIndexOf("."));
  if (ultimoSeparador === -1) return parseFloat(texto) || 0;
  const entero = texto.slice(0, ultimoSeparador).replace(/[.,]/g, "");
  const decimal = texto.slice(ultimoSeparador + 1);
  return parseFloat(entero + "." + decimal) || 0;
}

function formatearMonto(valor) {
  return valor.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

async function guardarCuenta(e) {
  e.preventDefault();
  const nombre = document.getElementById("cuenta-nombre").value.trim().toUpperCase();
  const saldo = parsearMonto(document.getElementById("cuenta-saldo").value);
  const tipo = document.getElementById("cuenta-tipo").value;
  const logo = document.getElementById("cuenta-logo").value.trim();
  await addDoc(collection(db, "users", uid, "cuentas"), { nombre, saldo, tipo, logo });

  e.target.reset();
}

function escucharCuentas() {
  const q = collection(db, "users", uid, "cuentas");

  onSnapshot(q, (snapshot) => {
    const grupos = { billetera: [], banco: [], efectivo: [] };
    let total = 0;

    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      total += item.saldo;
      grupos[item.tipo]?.push({ id: docSnap.id, ...item });
    });

    const TITULOS = { banco: "Banco", billetera: "Billetera", efectivo: "Efectivo" };
    const cont = document.getElementById("lista-cuentas");
    cont.innerHTML = "";

    Object.keys(grupos).forEach(tipo => {
      if (grupos[tipo].length === 0) return;

      const fila = document.createElement("div");
      fila.className = "fila-tipo-cuenta";

      const titulo = document.createElement("span");
      titulo.className = "titulo-fila-cuenta";
      titulo.textContent = TITULOS[tipo];
      fila.appendChild(titulo);

      const tarjetas = document.createElement("div");
      tarjetas.className = "grupo-cuentas";
      grupos[tipo].forEach(item => tarjetas.appendChild(crearItemHTML(item.id, item)));
      fila.appendChild(tarjetas);

      cont.appendChild(fila);
    });

    document.getElementById("total-cuentas").textContent = formatearMonto(total);
    totalCuentasActual = total;
    calcularDisponibleDiario();
  });
}

function crearItemHTML(id, item) {
  const li = document.createElement("div");
  li.className = `item-fila item-cuenta ${item.tipo}`;

  li.innerHTML = `
  <button class="btn-borrar btn-borrar-cuenta">🗑</button>
  <span class="cuenta-icono">${item.logo ? `<img src="assets/logos/${item.logo}" alt="${item.nombre}">` : (ICONOS_TIPO[item.tipo] || "💰")}</span>
  <span class="item-nombre">${item.nombre}</span>
  <input type="text" inputmode="decimal" class="item-monto-input" value="${formatearMonto(item.saldo)}">
`;

  const inputSaldo = li.querySelector(".item-monto-input");
  inputSaldo.addEventListener("focus", (e) => {
    e.target.value = item.saldo;
    e.target.select();
  });
  inputSaldo.addEventListener("blur", async (e) => {
    const valor = parsearMonto(e.target.value);
    e.target.value = formatearMonto(valor);
    await updateDoc(doc(db, "users", uid, "cuentas", id), { saldo: valor });
  });
  inputSaldo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.target.blur();
  });

  li.querySelector(".btn-borrar-cuenta").addEventListener("click", async () => {
    if (confirm(`¿Borrar "${item.nombre}"?`)) {
      await deleteDoc(doc(db, "users", uid, "cuentas", id));
    }
  });

  return li;
}

async function guardarAhorro(e) {
  e.preventDefault();
  const nombre = document.getElementById("ahorro-nombre").value.trim().toUpperCase();
  const monto = parsearMonto(document.getElementById("ahorro-monto").value);

  await addDoc(collection(db, "users", uid, "ahorros"), { nombre, monto });
  e.target.reset();
}

function escucharAhorro() {
  const q = collection(db, "users", uid, "ahorros");

  onSnapshot(q, async (snapshot) => {
    const lista = document.getElementById("lista-ahorro");
    lista.innerHTML = "";
    let total = 0;

    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      total += item.monto;
      lista.appendChild(crearItemAhorroHTML(docSnap.id, item));
    });

    document.getElementById("total-ahorro").textContent = formatearMonto(total);
    totalAhorroActual = total;
    await calcularDisponibleDiario();
  });
}

function crearItemAhorroHTML(id, item) {
  const li = document.createElement("li");
  li.className = "item-fila";

  li.innerHTML = `
    <span class="item-nombre">${item.nombre}</span>
    <input type="text" inputmode="decimal" class="item-monto-input" value="${formatearMonto(item.monto)}">
    <button class="btn-borrar">🗑</button>
  `;

  const inputMonto = li.querySelector(".item-monto-input");
  inputMonto.addEventListener("focus", (e) => {
    e.target.value = item.monto;
    e.target.select();
  });
  inputMonto.addEventListener("blur", async (e) => {
    const valor = parsearMonto(e.target.value);
    e.target.value = formatearMonto(valor);
    await updateDoc(doc(db, "users", uid, "ahorros", id), { monto: valor });
  });
  inputMonto.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.target.blur();
  });

  li.querySelector(".btn-borrar").addEventListener("click", async () => {
    if (confirm(`¿Borrar "${item.nombre}"?`)) {
      await deleteDoc(doc(db, "users", uid, "ahorros", id));
    }
  });

  return li;
}

async function escucharDiaCobro() {
  const ref = doc(db, "users", uid, "config", "diaCobro");
  onSnapshot(ref, (snap) => {
    const fecha = snap.exists() ? snap.data().fecha : "";
    document.getElementById("dia-cobro").value = fecha || "";
    calcularDisponibleDiario();
  });
}

async function guardarDiaCobro(e) {
  await setDoc(doc(db, "users", uid, "config", "diaCobro"), { fecha: e.target.value }, { merge: true });
}

async function calcularDisponibleDiario() {
  const fechaCobro = document.getElementById("dia-cobro").value;
  const spanDias = document.getElementById("dias-restantes");
  const spanDisponible = document.getElementById("disponible-diario");
  if (!fechaCobro) {
    spanDias.textContent = "-";
    spanDisponible.textContent = "$0";
    return;
  }
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const cobro = new Date(fechaCobro + "T00:00:00");
  const dias = Math.max(1, Math.ceil((cobro - hoy) / (1000 * 60 * 60 * 24)));
  spanDias.textContent = dias;

  const totalVencimientos = await calcularTotalVencimientosHasta(uid, fechaCobro);
  const totalLau = await calcularTotalLauPendienteHasta(uid, fechaCobro);
  const disponible = (totalCuentasActual - totalAhorroActual - totalVencimientos + totalLau) / dias;
  spanDisponible.textContent = formatearMonto(disponible);
}
