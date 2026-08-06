import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection, doc, updateDoc, getDoc, setDoc, getDocs, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const MESES = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
];

const hoy = new Date();
let mesActual = hoy.getMonth();
let anioActual = hoy.getFullYear();
let uid = null;
let yaIniciado = false;
let unsubscribeImp = null;
let unsubscribeTarj = null;
let ultimoImp = [];
let ultimoTarj = [];
let periodoPagadoActual = false;

onAuthStateChanged(auth, (user) => {
    if (user && !yaIniciado) {
        yaIniciado = true;
        uid = user.uid;
        iniciarModulo();
    }
});

function iniciarModulo() {
    escucharTodo();
    escucharPeriodoLau();
    document.getElementById("ld-pagado").addEventListener("change", async (e) => {
        await setDoc(doc(db, "users", uid, "lauPeriodos", idPeriodoLau()), { pagado: e.target.checked }, { merge: true });
    });
}


function formatearMonto(valor) {
    return valor.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function escucharTodo() {
    if (unsubscribeImp) unsubscribeImp();
    if (unsubscribeTarj) unsubscribeTarj();

    const qImp = query(
        collection(db, "users", uid, "impuestosServicios"),
        where("mes", "==", mesActual), where("anio", "==", anioActual)
    );
    unsubscribeImp = onSnapshot(qImp, (snapshot) => {
        ultimoImp = snapshot.docs
            .map(d => ({ id: d.id, coleccion: "impuestosServicios", ...d.data() }))
            .filter(item => item.montoLau > 0);
        renderCombinado();
    });

    const qTarj = query(
        collection(db, "users", uid, "tarjetas"),
        where("mes", "==", mesActual), where("anio", "==", anioActual)
    );
    unsubscribeTarj = onSnapshot(qTarj, (snapshot) => {
        ultimoTarj = snapshot.docs
            .map(d => ({ id: d.id, coleccion: "tarjetas", ...d.data() }))
            .filter(item => item.montoLau > 0);
        renderCombinado();
    });
}

function renderCombinado() {
    const combinado = [...ultimoImp, ...ultimoTarj];
    const lista = document.getElementById("lista-lau");
    lista.innerHTML = "";
    let total = 0;

    combinado.forEach(item => {
        total += item.montoLau;
        const li = document.createElement("li");
        li.className = "item-fila";
        li.innerHTML = `
      <span class="item-nombre">${item.nombre || item.descripcion}</span>
      <span class="item-monto">${formatearMonto(item.montoLau)}</span>
    `;
        lista.appendChild(li);
    });

    document.getElementById("total-lau-pendiente").textContent =
        formatearMonto(periodoPagadoActual ? 0 : total);
}

export async function calcularTotalLauPendiente(uidParam, mes, anio) {
    const refPeriodo = doc(db, "users", uidParam, "lauPeriodos", `${mes}_${anio}`);
    const snapPeriodo = await getDoc(refPeriodo);
    if (snapPeriodo.exists() && snapPeriodo.data().pagado) return 0;

    let total = 0;

    const qImp = query(
        collection(db, "users", uidParam, "impuestosServicios"),
        where("mes", "==", mes), where("anio", "==", anio)
    );
    const snapImp = await getDocs(qImp);
    snapImp.forEach(d => total += d.data().montoLau || 0);

    const qTarj = query(
        collection(db, "users", uidParam, "tarjetas"),
        where("mes", "==", mes), where("anio", "==", anio)
    );
    const snapTarj = await getDocs(qTarj);
    snapTarj.forEach(d => total += d.data().montoLau || 0);

    return total;
}

function idPeriodoLau() {
    return `${mesActual}_${anioActual}`;
}

function escucharPeriodoLau() {
    const ref = doc(db, "users", uid, "lauPeriodos", idPeriodoLau());
    onSnapshot(ref, (snap) => {
        periodoPagadoActual = snap.exists() ? !!snap.data().pagado : false;
        document.getElementById("ld-pagado").checked = periodoPagadoActual;
        document.getElementById("lista-lau").classList.toggle("lista-pagada", periodoPagadoActual);
        renderCombinado();
    });
}