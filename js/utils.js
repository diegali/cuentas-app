export const TARJETAS = ["VISA HIPOTECARIO", "VISA FRANCES", "CORDOBESA", "MC MERCADO PAGO"];

export function formatearMonto(valor) {
    return valor.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

export function obtenerHoyISO() {
    return new Date().toISOString().slice(0, 10);
}

export function clasificarFecha(fechaISO, hoyISO) {
    if (!fechaISO) return "";
    if (fechaISO < hoyISO) return "fecha-pasada";
    if (fechaISO === hoyISO) return "fecha-hoy";
    return "";
}

export function armarIdPeriodo(tarjeta, mes, anio) {
    return `${tarjeta.replace(/\s+/g, "_")}_${mes}_${anio}`;
}