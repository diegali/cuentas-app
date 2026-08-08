import { auth, db } from "./firebase-config.js";
import { formatearMonto, TARJETAS, obtenerHoyISO, clasificarFecha, armarIdPeriodo } from "./utils.js";
import { onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, query, where, onSnapshot
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
let unsubscribeImpuestos = null;
let unsubscribesPeriodos = [];
let ultimoImpuestos = [];
let unsubscribeTarjetasGastos = null;


onAuthStateChanged(auth, (user) => {
  if (user && !yaIniciado) {
    yaIniciado = true;
    uid = user.uid;
    iniciarModulo();
  }
});

function iniciarModulo() {

  escucharTodo();
}

function idPeriodoTarjeta(tarjeta) {
  return armarIdPeriodo(tarjeta, mesActual, anioActual);
}

function escucharTodo() {
  if (unsubscribeImpuestos) unsubscribeImpuestos();
  if (unsubscribeTarjetasGastos) unsubscribeTarjetasGastos();
  unsubscribesPeriodos.forEach(u => u());
  unsubscribesPeriodos = [];

  const q = query(
    collection(db, "users", uid, "impuestosServicios"),
    where("mes", "==", mesActual),
    where("anio", "==", anioActual)
  );

  unsubscribeImpuestos = onSnapshot(q, async (snapshot) => {
    ultimoImpuestos = snapshot.docs
      .map(d => d.data())
      .filter(item => !item.pagado)
      .map(item => ({
        nombre: item.nombre,
        monto: item.monto,
        vencimiento: item.vencimiento || null,
        tipo: "Impuesto/Servicio"
      }));
    await renderCombinado();
  });

  const qGastos = query(
    collection(db, "users", uid, "tarjetas"),
    where("mes", "==", mesActual),
    where("anio", "==", anioActual)
  );
  unsubscribeTarjetasGastos = onSnapshot(qGastos, async () => {
    await renderCombinado();
  });

  TARJETAS.forEach(tarjeta => {
    const ref = doc(db, "users", uid, "tarjetasPeriodos", idPeriodoTarjeta(tarjeta));
    const unsub = onSnapshot(ref, async () => {
      await renderCombinado();
    });
    unsubscribesPeriodos.push(unsub);
  });
}

async function obtenerVencimientosTarjetas() {
  const resultado = [];

  for (const tarjeta of TARJETAS) {
    const refPeriodo = doc(db, "users", uid, "tarjetasPeriodos", idPeriodoTarjeta(tarjeta));
    const snapPeriodo = await getDoc(refPeriodo);
    const dataPeriodo = snapPeriodo.exists() ? snapPeriodo.data() : {};
    if (!dataPeriodo.fechaVencimiento || dataPeriodo.pagado) continue;
    const fechaVencimiento = dataPeriodo.fechaVencimiento;

    const q = query(
      collection(db, "users", uid, "tarjetas"),
      where("tarjeta", "==", tarjeta),
      where("mes", "==", mesActual),
      where("anio", "==", anioActual)
    );
    const snapGastos = await getDocs(q);
    let total = 0;
    snapGastos.forEach(d => {
      const g = d.data();
      total += g.monto;
    });

    if (tarjeta === "CORDOBESA") {
      const selloAutomatico = total * 0.015;
      const sello = (dataPeriodo.sello !== undefined && dataPeriodo.sello !== null) ? dataPeriodo.sello : selloAutomatico;
      total += sello + (dataPeriodo.comision || 0) + (dataPeriodo.iva || 0);
    } else if (tarjeta === "MC MERCADO PAGO") {
      const selloAutomatico = total * 0.015;
      const sello = (dataPeriodo.sello !== undefined && dataPeriodo.sello !== null) ? dataPeriodo.sello : selloAutomatico;
      total += sello;
    }

    if (total > 0) {
      resultado.push({ nombre: tarjeta, monto: total, vencimiento: fechaVencimiento, tipo: "Tarjeta" });
    }
  }

  return resultado;
}

async function renderCombinado() {
  const vencimientosTarjetas = await obtenerVencimientosTarjetas();
  const combinado = [...ultimoImpuestos, ...vencimientosTarjetas];

  combinado.sort((a, b) => {
    if (!a.vencimiento) return 1;
    if (!b.vencimiento) return -1;
    return a.vencimiento.localeCompare(b.vencimiento);
  });

  const lista = document.getElementById("lista-vencimientos");
  lista.innerHTML = "";
  let total = 0;

  combinado.forEach(item => {
    total += item.monto;
    const fechaFmt = item.vencimiento
      ? new Date(item.vencimiento + "T00:00:00").toLocaleDateString("es-AR")
      : "-";

    const claseFecha = clasificarFecha(item.vencimiento, obtenerHoyISO());

    const li = document.createElement("li");
    li.className = `item-fila ${claseFecha}`;
    li.innerHTML = `
    <span class="item-nombre">${item.nombre} <span class="item-cuota">(${item.tipo})</span></span>
    <span class="item-fecha">${fechaFmt}</span>
    <span class="item-monto">${formatearMonto(item.monto)}</span>
    `;
    lista.appendChild(li);
  });

  document.getElementById("total-vencimientos").textContent = formatearMonto(total);
}

export async function calcularTotalVencimientosMes(uidParam, mes, anio) {
  let total = 0;

  const qImp = query(
    collection(db, "users", uidParam, "impuestosServicios"),
    where("mes", "==", mes), where("anio", "==", anio)
  );
  const snapImp = await getDocs(qImp);
  snapImp.forEach(d => {
    const item = d.data();
    if (!item.pagado) total += item.monto;
  });

  for (const tarjeta of TARJETAS) {
    const idPer = `${tarjeta.replace(/\s+/g, "_")}_${mes}_${anio}`;
    const snapPeriodo = await getDoc(doc(db, "users", uidParam, "tarjetasPeriodos", idPer));
    if (!snapPeriodo.exists()) continue;
    const dataPeriodo = snapPeriodo.data();
    if (!dataPeriodo.fechaVencimiento || dataPeriodo.pagado) continue;

    const qGastos = query(
      collection(db, "users", uidParam, "tarjetas"),
      where("tarjeta", "==", tarjeta), where("mes", "==", mes), where("anio", "==", anio)
    );
    const snapGastos = await getDocs(qGastos);
    let t = 0;
    snapGastos.forEach(d => t += d.data().monto);

    if (tarjeta === "CORDOBESA") {
      const sello = dataPeriodo.sello ?? t * 0.015;
      t += sello + (dataPeriodo.comision || 0) + (dataPeriodo.iva || 0);
    } else if (tarjeta === "MC MERCADO PAGO") {
      const sello = dataPeriodo.sello ?? t * 0.015;
      t += sello;
    }
    total += t;
  }

  return total;
}
