import { auth, db } from "./firebase-config.js";
import { formatearMonto } from "./utils.js";
import { onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection, doc, setDoc, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MESES = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

const anioActual = new Date().getFullYear();
let uid = null;
let yaIniciado = false;

let totalesTarjetas = Array(12).fill(0);
let totalesImpserv = Array(12).fill(0);
let ingresos = Array(12).fill(0);

onAuthStateChanged(auth, (user) => {
    if (user && !yaIniciado) {
        yaIniciado = true;
        uid = user.uid;
        iniciarModulo();
    }
});

function iniciarModulo() {
    renderTabla();
    escucharTarjetas();
    escucharImpserv();
    escucharIngresos();
    document.getElementById("anio-total-label").textContent = anioActual;
}

function parsearMonto(texto) {
    texto = texto.replace(/[^0-9.,]/g, "");
    const ultimoSeparador = Math.max(texto.lastIndexOf(","), texto.lastIndexOf("."));
    if (ultimoSeparador === -1) return parseFloat(texto) || 0;
    const entero = texto.slice(0, ultimoSeparador).replace(/[.,]/g, "");
    const decimal = texto.slice(ultimoSeparador + 1);
    return parseFloat(entero + "." + decimal) || 0;
}

function escucharTarjetas() {
    const q = query(collection(db, "users", uid, "tarjetas"), where("anio", "==", anioActual));
    onSnapshot(q, (snapshot) => {
        totalesTarjetas = Array(12).fill(0);
        snapshot.forEach(d => {
            const item = d.data();
            totalesTarjetas[item.mes] += item.monto - (item.montoLau || 0);
        });
        renderTabla();
    });
}

function escucharImpserv() {
    const q = query(collection(db, "users", uid, "impuestosServicios"), where("anio", "==", anioActual));
    onSnapshot(q, (snapshot) => {
        totalesImpserv = Array(12).fill(0);
        snapshot.forEach(d => {
            const item = d.data();
            totalesImpserv[item.mes] += item.monto - (item.montoLau || 0);
        });
        renderTabla();
    });
}

function escucharIngresos() {
    const q = query(collection(db, "users", uid, "ingresos"), where("anio", "==", anioActual));
    onSnapshot(q, (snapshot) => {
        ingresos = Array(12).fill(0);
        snapshot.forEach(d => {
            const item = d.data();
            ingresos[item.mes] = item.monto;
        });
        renderTabla();
    });
}

function renderTabla() {
    const cont = document.getElementById("grilla-total");
    cont.innerHTML = "";
    const hoy = new Date();

    for (let mes = 0; mes < 12; mes++) {
        const diferencia = ingresos[mes] - totalesTarjetas[mes] - totalesImpserv[mes];
        const esMesActual = mes === hoy.getMonth() && anioActual === hoy.getFullYear();

        const card = document.createElement("div");
        card.className = "card-mes-total" + (esMesActual ? " mes-actual" : "");
        card.innerHTML = `
      <h4>${MESES[mes]}</h4>
      <div class="fila-dato">
        <span>Ingreso</span>
        <input type="text" inputmode="decimal" class="input-ingreso" data-mes="${mes}" value="${formatearMonto(ingresos[mes])}">
      </div>
      <div class="fila-dato"><span>Tarjetas</span><span>${formatearMonto(totalesTarjetas[mes])}</span></div>
      <div class="fila-dato"><span>Imp./Serv.</span><span>${formatearMonto(totalesImpserv[mes])}</span></div>
      <div class="fila-dato fila-diferencia ${diferencia < 0 ? 'diferencia-negativa' : 'diferencia-positiva'}">
        <span>Diferencia</span><span>${formatearMonto(diferencia)}</span>
      </div>
    `;
        cont.appendChild(card);
    }

    cont.querySelectorAll(".input-ingreso").forEach(input => {
        input.addEventListener("focus", (e) => {
            const mes = parseInt(e.target.dataset.mes);
            e.target.value = ingresos[mes] || "";
            e.target.select();
        });
        input.addEventListener("blur", async (e) => {
            const mes = parseInt(e.target.dataset.mes);
            const valor = parsearMonto(e.target.value);
            await setDoc(doc(db, "users", uid, "ingresos", `${mes}_${anioActual}`), { mes, anio: anioActual, monto: valor }, { merge: true });
        });
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") e.target.blur();
        });
    });
}