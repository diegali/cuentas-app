import { auth, db } from "./firebase-config.js";
import { formatearMonto, mostrarAviso } from "./utils.js";
import { TARJETAS } from "./utils.js";
import { onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    collection, doc, getDoc, setDoc, getDocs, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const hoy = new Date();
let uid = null;
let yaIniciado = false;
let unsubscribeImp = null;
let unsubscribeTarj = null;
let ultimoImp = [];
let ultimoTarj = [];
let periodoPagadoActual = false;
let viendoMesSiguiente = false;
let ultimoCombinado = [];

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
    document.getElementById("ld-enviar-whatsapp").addEventListener("click", enviarWhatsapp);
    document.getElementById("ld-ver-siguiente").addEventListener("click", () => {
        viendoMesSiguiente = !viendoMesSiguiente;
        document.getElementById("ld-ver-siguiente").textContent = viendoMesSiguiente ? "◀ Ver mes actual" : "Ver mes que viene ▶";
        escucharTodo();
        escucharPeriodoLau();
    });
}

function mesYAnioAMostrar() {
    const hoy = new Date();
    let mes = hoy.getMonth();
    let anio = hoy.getFullYear();
    if (viendoMesSiguiente) {
        mes++;
        if (mes > 11) { mes = 0; anio++; }
    }
    return { mes, anio };
}

function escucharTodo() {
    if (unsubscribeImp) unsubscribeImp();
    if (unsubscribeTarj) unsubscribeTarj();
    const { mes, anio } = mesYAnioAMostrar();

    const qImp = query(
        collection(db, "users", uid, "impuestosServicios"),
        where("mes", "==", mes), where("anio", "==", anio)
    );
    unsubscribeImp = onSnapshot(qImp, (snapshot) => {
        ultimoImp = snapshot.docs
            .map(d => ({ id: d.id, coleccion: "impuestosServicios", ...d.data() }))
            .filter(item => (item.montoLau || 0) !== 0);
        renderCombinado();
    });

    const qTarj = query(
        collection(db, "users", uid, "tarjetas"),
        where("mes", "==", mes), where("anio", "==", anio)
    );
    unsubscribeTarj = onSnapshot(qTarj, (snapshot) => {
        ultimoTarj = snapshot.docs
            .map(d => ({ id: d.id, coleccion: "tarjetas", ...d.data() }))
            .filter(item => (item.montoLau || 0) !== 0);
        renderCombinado();
    });
}

function renderCombinado() {
    const combinado = [...ultimoImp, ...ultimoTarj].sort((a, b) => {
        const nombreA = (a.nombre || a.descripcion || "").toUpperCase();
        const nombreB = (b.nombre || b.descripcion || "").toUpperCase();
        return nombreA.localeCompare(nombreB, "es");
    });
    ultimoCombinado = combinado;
    const lista = document.getElementById("lista-lau");
    lista.innerHTML = "";
    let total = 0;

    combinado.forEach(item => {
        total += item.montoLau;
        const cuotaTexto = (item.cuotaActual && item.cuotaTotal)
            ? ` (${item.cuotaActual}/${item.cuotaTotal})`
            : "";
        const li = document.createElement("li");
        li.className = "item-fila";
        li.innerHTML = `
      <span class="item-nombre">${item.nombre || item.descripcion}${cuotaTexto}</span>
      <span class="item-monto">${formatearMonto(item.montoLau)}</span>
    `;
        lista.appendChild(li);
    });

    document.getElementById("total-lau-pendiente").textContent =
        formatearMonto(periodoPagadoActual ? 0 : total);
}

export async function calcularTotalLauPendienteHasta(uidParam, fechaLimiteISO) {
    const fechaLimite = new Date(fechaLimiteISO + "T00:00:00");
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const meses = [];
    let mesIter = hoy.getMonth(), anioIter = hoy.getFullYear();
    while (true) {
        meses.push({ mes: mesIter, anio: anioIter });
        if (mesIter === fechaLimite.getMonth() && anioIter === fechaLimite.getFullYear()) break;
        mesIter++;
        if (mesIter > 11) { mesIter = 0; anioIter++; }
        if (meses.length > 3) break;
    }

    let total = 0;
    for (const { mes, anio } of meses) {
        const refPeriodo = doc(db, "users", uidParam, "lauPeriodos", `${mes}_${anio}`);
        const snapPeriodo = await getDoc(refPeriodo);
        if (snapPeriodo.exists() && snapPeriodo.data().pagado) continue;

        const qImp = query(
            collection(db, "users", uidParam, "impuestosServicios"),
            where("mes", "==", mes), where("anio", "==", anio)
        );
        const snapImp = await getDocs(qImp);
        snapImp.forEach(d => {
            const item = d.data();
            if (item.vencimiento && item.vencimiento <= fechaLimiteISO) {
                total += item.montoLau || 0;
            }
        });

        for (const tarjeta of TARJETAS) {
            const idPer = `${tarjeta.replace(/\s+/g, "_")}_${mes}_${anio}`;
            const snapPer = await getDoc(doc(db, "users", uidParam, "tarjetasPeriodos", idPer));
            if (!snapPer.exists()) continue;
            const perData = snapPer.data();
            if (!perData.fechaVencimiento || perData.fechaVencimiento > fechaLimiteISO) continue;

            const qTarj = query(
                collection(db, "users", uidParam, "tarjetas"),
                where("tarjeta", "==", tarjeta), where("mes", "==", mes), where("anio", "==", anio)
            );
            const snapTarj = await getDocs(qTarj);
            snapTarj.forEach(d => total += d.data().montoLau || 0);
        }
    }

    return total;
}

async function enviarWhatsapp() {
    if (ultimoCombinado.length === 0) {
        mostrarAviso("No hay nada pendiente con Lau en este período.");
        return;
    }

    const { mes, anio } = mesYAnioAMostrar();
    const nombreMes = new Date(anio, mes).toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    let total = 0;

    let itemsHtml = "";
    ultimoCombinado.forEach(item => {
        total += item.montoLau;
        const cuotaTexto = (item.cuotaActual && item.cuotaTotal)
            ? ` (${item.cuotaActual}/${item.cuotaTotal})`
            : "";
        itemsHtml += `
      <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #2a2d34; font-size:14px;">
        <span>${item.nombre || item.descripcion}${cuotaTexto}</span>
        <span>${formatearMonto(item.montoLau)}</span>
      </div>`;
    });

    const totalFinal = periodoPagadoActual ? 0 : total;
    const mesCapitalizado = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);

    document.getElementById("captura-lau-mes").textContent = mesCapitalizado;
    document.getElementById("captura-lau-items").innerHTML = itemsHtml;
    document.getElementById("captura-lau-total").textContent = formatearMonto(totalFinal);

    const canvas = await html2canvas(document.getElementById("captura-lau"), { backgroundColor: null, scale: 2 });

    const esMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

    canvas.toBlob(async (blob) => {
        const archivo = new File([blob], "debe-lau.png", { type: "image/png" });

        if (esMobile && navigator.canShare && navigator.canShare({ files: [archivo] })) {
            await navigator.share({ files: [archivo], title: "Debe Lau" });
        } else if (navigator.clipboard && window.ClipboardItem) {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            mostrarAviso("Imagen copiada. Abrí WhatsApp Web y pegala (Ctrl+V) en el chat de Lau.");
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "debe-lau.png";
            a.click();
            URL.revokeObjectURL(url);
            mostrarAviso("Se descargó la imagen, mandásela por WhatsApp manualmente.");
        }
    }, "image/png");
}

function idPeriodoLau() {
    const { mes, anio } = mesYAnioAMostrar();
    return `${mes}_${anio}`;
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

