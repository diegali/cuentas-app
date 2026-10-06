import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { formatearMonto, TARJETAS, obtenerHoyISO } from "./utils.js";

let uid = null;
let yaIniciado = false;
let ultimoImp = [];
let ultimoTarj = [];

onAuthStateChanged(auth, (user) => {
    if (user && !yaIniciado) {
        yaIniciado = true;
        uid = user.uid;
        iniciarModulo();
    }
});

function iniciarModulo() {
    document.getElementById("btn-campanita").addEventListener("click", togglePanel);
    document.addEventListener("click", cerrarPanelAfuera);
    escucharVencimientosHoy();
}

function togglePanel(e) {
    e.stopPropagation();
    const panel = document.getElementById("campanita-panel");
    panel.style.display = panel.style.display === "block" ? "none" : "block";
}

function cerrarPanelAfuera(e) {
    const wrap = document.querySelector(".campanita-wrap");
    if (wrap && !wrap.contains(e.target)) {
        document.getElementById("campanita-panel").style.display = "none";
    }
}

function escucharVencimientosHoy() {
    const hoy = new Date();
    const mes = hoy.getMonth();
    const anio = hoy.getFullYear();
    const hoyISO = obtenerHoyISO();

    const qImp = query(
        collection(db, "users", uid, "impuestosServicios"),
        where("mes", "==", mes), where("anio", "==", anio),
        where("pagado", "==", false), where("vencimiento", "==", hoyISO)
    );
    onSnapshot(qImp, (snapshot) => {
        ultimoImp = snapshot.docs.map(d => ({ nombre: d.data().nombre, monto: d.data().monto }));
        renderCampanita();
    });

    TARJETAS.forEach(tarjeta => {
        const idPer = `${tarjeta.replace(/\s+/g, "_")}_${mes}_${anio}`;
        onSnapshot(doc(db, "users", uid, "tarjetasPeriodos", idPer), (snap) => {
            ultimoTarj = ultimoTarj.filter(t => t.tarjeta !== tarjeta);
            if (snap.exists()) {
                const data = snap.data();
                if (!data.pagado && data.fechaVencimiento === hoyISO) {
                    ultimoTarj.push({ tarjeta, nombre: `Tarjeta ${tarjeta}` });
                }
            }
            renderCampanita();
        });
    });
}

function renderCampanita() {
    const combinado = [...ultimoImp, ...ultimoTarj];
    const badge = document.getElementById("campanita-badge");
    const panel = document.getElementById("campanita-panel");

    if (combinado.length === 0) {
        badge.style.display = "none";
    } else {
        badge.textContent = combinado.length;
        badge.style.display = "flex";
    }

    panel.innerHTML = `<p>Vencen hoy</p>` + (
        combinado.length === 0
            ? `<p class="campanita-vacio">Nada vence hoy 🎉</p>`
            : combinado.map(item => `
          <div class="campanita-item">
            <span>${item.nombre}</span>
            ${item.monto !== undefined ? `<span>${formatearMonto(item.monto)}</span>` : ""}
          </div>
        `).join("")
    );
}