import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { formatearMonto, formatearUSD, parsearMonto } from "./utils.js";

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
    document.getElementById("form-meta").addEventListener("submit", guardarMeta);
    escucharMetas();
}

async function guardarMeta(e) {
    e.preventDefault();
    const nombre = document.getElementById("meta-nombre").value.trim().toUpperCase();
    const moneda = document.getElementById("meta-moneda").value;
    const montoPropio = parsearMonto(document.getElementById("meta-propio").value);
    const montoLau = parsearMonto(document.getElementById("meta-lau").value);

    await addDoc(collection(db, "users", uid, "metasAhorro"), { nombre, moneda, montoPropio, montoLau });
    e.target.reset();
}

function formatoSegunMoneda(valor, moneda) {
    return moneda === "USD" ? formatearUSD(valor) : formatearMonto(valor);
}

function escucharMetas() {
    const q = collection(db, "users", uid, "metasAhorro");

    onSnapshot(q, (snapshot) => {
        const lista = document.getElementById("lista-metas");
        lista.innerHTML = "";
        let totalARS = 0;
        let totalUSD = 0;

        snapshot.forEach(docSnap => {
            const item = docSnap.data();
            const total = item.montoPropio + item.montoLau;
            if (item.moneda === "USD") totalUSD += total;
            else totalARS += total;
            lista.appendChild(crearItemMetaHTML(docSnap.id, item));
        });

        document.getElementById("total-metas-ars").textContent = formatearMonto(totalARS);
        document.getElementById("total-metas-usd").textContent = formatearUSD(totalUSD);
    });
}

function crearItemMetaHTML(id, item) {
    const li = document.createElement("li");
    li.className = "item-fila item-meta";

    li.innerHTML = `
    <span class="item-nombre">${item.nombre} <span class="badge-moneda">${item.moneda}</span></span>
    <span class="meta-input-group"><small>Vos</small>
      <input type="text" inputmode="decimal" class="item-monto-input meta-propio" value="${formatoSegunMoneda(item.montoPropio, item.moneda)}">
    </span>
    <span class="meta-input-group"><small>Lau</small>
      <input type="text" inputmode="decimal" class="item-monto-input meta-lau" value="${formatoSegunMoneda(item.montoLau, item.moneda)}">
    </span>
    <span class="meta-total">${formatoSegunMoneda(item.montoPropio + item.montoLau, item.moneda)}</span>
    <button class="btn-borrar">🗑</button>
  `;

    const inputPropio = li.querySelector(".meta-propio");
    inputPropio.addEventListener("focus", (e) => { e.target.value = item.montoPropio; e.target.select(); });
    inputPropio.addEventListener("blur", async (e) => {
        const valor = parsearMonto(e.target.value);
        e.target.value = formatoSegunMoneda(valor, item.moneda);
        await updateDoc(doc(db, "users", uid, "metasAhorro", id), { montoPropio: valor });
    });
    inputPropio.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });

    const inputLau = li.querySelector(".meta-lau");
    inputLau.addEventListener("focus", (e) => { e.target.value = item.montoLau; e.target.select(); });
    inputLau.addEventListener("blur", async (e) => {
        const valor = parsearMonto(e.target.value);
        e.target.value = formatoSegunMoneda(valor, item.moneda);
        await updateDoc(doc(db, "users", uid, "metasAhorro", id), { montoLau: valor });
    });
    inputLau.addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });

    li.querySelector(".btn-borrar").addEventListener("click", async () => {
        if (confirm(`¿Borrar "${item.nombre}"?`)) {
            await deleteDoc(doc(db, "users", uid, "metasAhorro", id));
        }
    });

    return li;
}