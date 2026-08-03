import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, deleteDoc, doc, updateDoc, getDoc, setDoc,
  query, where, onSnapshot, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Items fijos según tu planilla, para carga rápida
const ITEMS_FIJOS_DEFAULT = [
  "EPEC", "AGUA", "GAS", "COLE",
  "IMP. MUNI.", "INGLÉS", "CLARO TV"
];
let itemsFijos = [];

const MESES = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

const hoy = new Date();
let mesActual = hoy.getMonth(); // 0-11
let anioActual = hoy.getFullYear();

let unsubscribe = null;
let uid = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    uid = user.uid;
    iniciarModulo();
  }
});

async function iniciarModulo() {
  await cargarAccesosRapidos();
  actualizarLabelMes();
  escucharDatos();

  document.getElementById("mes-anterior").addEventListener("click", () => cambiarMes(-1));
  document.getElementById("mes-siguiente").addEventListener("click", () => cambiarMes(1));
  document.getElementById("form-impserv").addEventListener("submit", guardarItem);
  document.getElementById("form-nuevo-acceso").addEventListener("submit", agregarAccesoRapido);
}

async function cargarAccesosRapidos() {
  const ref = doc(db, "users", uid, "config", "accesosRapidos");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    itemsFijos = snap.data().items;
  } else {
    itemsFijos = ITEMS_FIJOS_DEFAULT;
    await setDoc(ref, { items: itemsFijos });
  }
  renderBotonesRapidos();
}

async function guardarAccesosRapidos() {
  await setDoc(doc(db, "users", uid, "config", "accesosRapidos"), { items: itemsFijos });
}

async function agregarAccesoRapido(e) {
  e.preventDefault();
  const input = document.getElementById("nuevo-acceso-nombre");
  const nombre = input.value.trim().toUpperCase();
  if (nombre && !itemsFijos.includes(nombre)) {
    itemsFijos.push(nombre);
    await guardarAccesosRapidos();
    renderBotonesRapidos();
  }
  input.value = "";
}

function cambiarMes(delta) {
  mesActual += delta;
  if (mesActual < 0) { mesActual = 11; anioActual--; }
  if (mesActual > 11) { mesActual = 0; anioActual++; }
  actualizarLabelMes();
  escucharDatos();
}

function actualizarLabelMes() {
  document.getElementById("mes-actual-label").textContent = `${MESES[mesActual]} ${anioActual}`;
}

function renderBotonesRapidos() {
  const cont = document.getElementById("botones-rapidos");
  cont.innerHTML = "";
  itemsFijos.forEach(nombre => {
    const wrap = document.createElement("span");
    wrap.className = "acceso-rapido-wrap";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-rapido";
    btn.textContent = nombre;
    btn.addEventListener("click", () => {
      document.getElementById("is-nombre").value = nombre;
      document.getElementById("is-monto").focus();
    });

    const x = document.createElement("button");
    x.type = "button";
    x.className = "btn-quitar-acceso";
    x.textContent = "✕";
    x.addEventListener("click", async () => {
      itemsFijos = itemsFijos.filter(n => n !== nombre);
      await guardarAccesosRapidos();
      renderBotonesRapidos();
    });

    wrap.appendChild(btn);
    wrap.appendChild(x);
    cont.appendChild(wrap);
  });
}

async function guardarItem(e) {
  e.preventDefault();
  const nombre = document.getElementById("is-nombre").value.trim().toUpperCase();
  const monto = parseFloat(document.getElementById("is-monto").value);
  const vencimiento = document.getElementById("is-vencimiento").value;
  const montoLau = parseFloat(document.getElementById("is-monto-lau").value) || 0;

  await addDoc(collection(db, "users", uid, "impuestosServicios"), {
    nombre,
    monto,
    montoLau,
    vencimiento,
    mes: mesActual,
    anio: anioActual,
    pagado: false
  });

  e.target.reset();
}

function escucharDatos() {
  if (unsubscribe) unsubscribe(); // dejar de escuchar el mes anterior

  const q = query(
    collection(db, "users", uid, "impuestosServicios"),
    where("mes", "==", mesActual),
    where("anio", "==", anioActual),
    orderBy("vencimiento")
  );

  unsubscribe = onSnapshot(q, (snapshot) => {
    const lista = document.getElementById("lista-impserv");
    lista.innerHTML = "";
    let total = 0;
    let totalLau = 0;

    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      const lau = item.montoLau || 0;
      total += item.monto - lau;
      totalLau += lau;
      lista.appendChild(crearItemHTML(docSnap.id, item));
    });

    document.getElementById("total-impserv").textContent =
      total.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
    document.getElementById("total-lau").textContent =
      totalLau.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
  });
}

function crearItemHTML(id, item) {
  const li = document.createElement("li");
  li.className = "item-fila" + (item.pagado ? " pagado" : "");

  li.innerHTML = `
  <label class="check-pagado">
    <input type="checkbox" ${item.pagado ? "checked" : ""}>
  </label>
  <span class="item-nombre">${item.nombre}</span>
  <input type="text" inputmode="decimal" class="item-monto-input" value="${item.monto.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}">
  <input type="date" class="item-fecha-input" value="${item.vencimiento || ""}">
  <input type="text" inputmode="decimal" class="item-lau-input" placeholder="Lau" value="${(item.montoLau || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}">
  <button class="btn-borrar">🗑</button>
  `;

  const inputMonto = li.querySelector(".item-monto-input");

  inputMonto.addEventListener("focus", (e) => {
    e.target.value = item.monto;
    e.target.select();
  });

  inputMonto.addEventListener("blur", async (e) => {
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
    e.target.value = valor.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
    await updateDoc(doc(db, "users", uid, "impuestosServicios", id), { monto: valor });
  });

  inputMonto.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.target.blur();
  });

  li.querySelector(".item-fecha-input").addEventListener("change", async (e) => {
    await updateDoc(doc(db, "users", uid, "impuestosServicios", id), { vencimiento: e.target.value });
  });

  li.querySelector(".btn-borrar").addEventListener("click", async () => {
    if (confirm(`¿Borrar "${item.nombre}"?`)) {
      await deleteDoc(doc(db, "users", uid, "impuestosServicios", id));
    }
  });

  li.querySelector(".check-pagado input").addEventListener("change", async (e) => {
    await updateDoc(doc(db, "users", uid, "impuestosServicios", id), { pagado: e.target.checked });
  });

  const inputLau = li.querySelector(".item-lau-input");

  inputLau.addEventListener("focus", (e) => {
    e.target.value = item.montoLau || 0;
    e.target.select();
  });

  inputLau.addEventListener("blur", async (e) => {
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
    e.target.value = valor.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
    await updateDoc(doc(db, "users", uid, "impuestosServicios", id), { montoLau: valor });
  });

  inputLau.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.target.blur();
  });

  return li;
}
