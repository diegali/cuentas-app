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

export function formatearUSD(valor) {
    return "US$ " + valor.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parsearMonto(texto) {
    texto = texto.replace(/[^0-9.,]/g, "");
    const ultimoSeparador = Math.max(texto.lastIndexOf(","), texto.lastIndexOf("."));
    if (ultimoSeparador === -1) return parseFloat(texto) || 0;
    const entero = texto.slice(0, ultimoSeparador).replace(/[.,]/g, "");
    const decimal = texto.slice(ultimoSeparador + 1);
    return parseFloat(entero + "." + decimal) || 0;
}