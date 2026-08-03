import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ICONOS_TIPO = { banco: "🏦", billetera: "📱", efectivo: "💵" };

let uid = null;
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
  document.getElementById("form-cuenta").addEventListener("submit", guardarCuenta);
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

  await addDoc(collection(db, "users", uid, "cuentas"), { nombre, saldo, tipo });

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
  });
}

function crearItemHTML(id, item) {
  const li = document.createElement("div");
  li.className = `item-fila item-cuenta ${item.tipo}`;

  li.innerHTML = `
  <button class="btn-borrar btn-borrar-cuenta">🗑</button>
  <span class="cuenta-icono">${ICONOS_TIPO[item.tipo] || "💰"}</span>
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
