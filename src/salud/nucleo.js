/* ─────────────────────────────────────────────────────────────────────────
   Salud · núcleo: modelo, fechas, perfil energético y migración.
   ───────────────────────────────────────────────────────────────────────── */

import { ahora, nuevoId } from "../comun/fusion.js";

export const CLAVE = "salud-app-v2"; // la de siempre: los datos guardados siguen valiendo
export const APP = "salud";

export const ESQUEMA = {
  colecciones: ["pesos", "entrenos", "comidas"],
  sellos: ["perfil"],
};

export const VACIO = {
  v: 3,
  perfil: { altura: "", edad: "", sexo: "", actividad: "", objetivo: "" },
  pesos: [],
  entrenos: [],
  comidas: [],
  borrados: {},
  sellos: {},
};

/* ── catálogos ───────────────────────────────────────────────────────────── */

export const ACTIVIDADES = [
  { id: "sedentaria", label: "Sedentaria", factor: 1.2, desc: "Trabajo sentado, poco movimiento" },
  { id: "ligera", label: "Ligera", factor: 1.375, desc: "Algo de movimiento o 1-3 entrenos" },
  { id: "activa", label: "Activa", factor: 1.55, desc: "En pie o 3-5 entrenos por semana" },
  { id: "muy_activa", label: "Muy activa", factor: 1.725, desc: "Trabajo físico o 6-7 entrenos" },
];

export const OBJETIVOS = [
  { id: "bajar", label: "Bajar peso", ajuste: -500, verbo: "bajar" },
  { id: "mantener", label: "Mantener", ajuste: 0, verbo: "mantener" },
  { id: "subir", label: "Subir peso", ajuste: 350, verbo: "subir" },
];
export const objetivoDe = (id) => OBJETIVOS.find((o) => o.id === id) || OBJETIVOS[1];

export const SEXOS = [
  { id: "hombre", label: "Hombre" },
  { id: "mujer", label: "Mujer" },
  { id: "nd", label: "Prefiero no decirlo" },
];

export const CANTIDADES = [
  { id: "poco", label: "Poco" },
  { id: "normal", label: "Normal" },
  { id: "mucho", label: "Mucho" },
];

export const DURACIONES = [20, 30, 45, 60, 90];

/* Un kilo de grasa son unas 7.700 kcal: sirve para traducir déficit en peso. */
export const KCAL_POR_KILO = 7700;

/* ── fechas ──────────────────────────────────────────────────────────────── */

export const iso = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const hoy = () => iso(new Date());
export const desdeIso = (s) => {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const fechaCorta = (s) => {
  const d = desdeIso(s);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

export const etiquetaFecha = (s) => {
  if (s === hoy()) return "Hoy";
  const a = new Date();
  a.setDate(a.getDate() - 1);
  if (s === iso(a)) return "Ayer";
  const d = desdeIso(s);
  return `${DIAS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MESES[d.getMonth()]}`;
};

export const inicioSemana = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

export const enRango = (f, desde) => desdeIso(f) >= desde;

export const rangoSemana = (offset = 0) => {
  const a = inicioSemana();
  a.setDate(a.getDate() - 7 * offset);
  const b = new Date(a);
  b.setDate(b.getDate() + 6);
  return [a, b];
};

export const rangoMes = (offset = 0) => {
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  a.setDate(1);
  a.setMonth(a.getMonth() - offset);
  const b = new Date(a);
  b.setMonth(b.getMonth() + 1);
  b.setDate(0);
  return [a, b];
};

export const enTramo = (f, [a, b]) => {
  const d = desdeIso(f);
  return d >= a && d <= b;
};

export const cerrado = ([, b]) => {
  const hoyD = new Date();
  hoyD.setHours(0, 0, 0, 0);
  return b < hoyD;
};

/** Días del tramo que ya han pasado (para no juzgar una semana a medias). */
export const diasTranscurridos = ([a, b]) => {
  const hoyD = new Date();
  hoyD.setHours(0, 0, 0, 0);
  const fin = b < hoyD ? b : hoyD;
  return Math.max(1, Math.round((fin - a) / 86400000) + 1);
};

export const etiquetaTramo = (periodo, offset) => {
  if (periodo === "semana") {
    const [a, b] = rangoSemana(offset);
    if (offset === 0) return "Esta semana";
    if (offset === 1) return "Semana pasada";
    return `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]}`;
  }
  const [a] = rangoMes(offset);
  if (offset === 0) return "Este mes";
  const nombre = MESES_LARGOS[a.getMonth()];
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}${
    a.getFullYear() !== new Date().getFullYear() ? ` ${a.getFullYear()}` : ""
  }`;
};

export const detalleTramo = (periodo, offset) => {
  const [a, b] = periodo === "semana" ? rangoSemana(offset) : rangoMes(offset);
  return `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]}`;
};

/* ── formato ─────────────────────────────────────────────────────────────── */

export const num = (n, dec = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : Number(n).toFixed(dec).replace(".", ",");
export const miles = (n) => (n === null || n === undefined ? "—" : Math.round(n).toLocaleString("es-ES"));

/* ── energía ─────────────────────────────────────────────────────────────── */

/** Mifflin-St Jeor por el factor de actividad. Estimación de partida, no medida. */
export function calcularEnergia(perfil, pesoKg) {
  const altura = parseFloat(perfil.altura);
  const edad = parseFloat(perfil.edad);
  const act = ACTIVIDADES.find((a) => a.id === perfil.actividad);
  if (!(altura > 0) || !(edad > 0) || !act || !(pesoKg > 0) || !perfil.objetivo) return null;

  const base = 10 * pesoKg + 6.25 * altura - 5 * edad;
  const bmr = perfil.sexo === "mujer" ? base - 161 : perfil.sexo === "hombre" ? base + 5 : base - 78;
  const gasto = bmr * act.factor;

  const obj = objetivoDe(perfil.objetivo);
  const suelo = Math.max(bmr, perfil.sexo === "mujer" ? 1200 : 1500);
  const diana = Math.max(suelo, gasto + obj.ajuste);

  return {
    bmr: Math.round(bmr),
    gasto: Math.round(gasto),
    diana: Math.round(diana),
    margen: 150,
    objetivo: obj,
    ajustado: gasto + obj.ajuste < suelo,
  };
}

/* ── migración ───────────────────────────────────────────────────────────── */

/**
 * Acepta lo guardado por cualquier versión anterior. La v2 guardaba las
 * valoraciones del día (`dias`) y una caché de análisis (`valoraciones`)
 * porque venían de una llamada de pago; ahora se recalculan al vuelo, así que
 * se descartan sin pena.
 */
export function migrar(guardado) {
  const base = { ...VACIO, ...(guardado || {}) };
  const t = 0;
  const sellar = (lista) =>
    (lista || []).map((x) => ({ ...x, id: x.id || nuevoId(), mod: x.mod || t }));

  return {
    v: 3,
    perfil: { ...VACIO.perfil, ...(base.perfil || {}) },
    pesos: sellar(base.pesos),
    entrenos: sellar(base.entrenos),
    comidas: sellar(base.comidas),
    borrados: base.borrados || {},
    sellos: base.sellos || {},
  };
}

/* ── copia de seguridad ──────────────────────────────────────────────────── */

export function exportar(datos) {
  const blob = new Blob([JSON.stringify({ app: "salud", version: 3, fecha: new Date().toISOString(), datos }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `salud-copia-${hoy()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function importar(archivo) {
  return new Promise((res, rej) => {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const j = JSON.parse(lector.result);
        const d = j && j.datos ? j.datos : j && j.data ? j.data : j;
        if (!d || !Array.isArray(d.pesos)) throw new Error("formato");
        const t = ahora();
        const sellar = (l) => (l || []).map((x) => ({ ...x, id: x.id || nuevoId(), mod: t }));
        res({
          ...migrar(d),
          pesos: sellar(d.pesos),
          entrenos: sellar(d.entrenos),
          comidas: sellar(d.comidas),
          sellos: { perfil: t },
        });
      } catch (e) {
        rej(e);
      }
    };
    lector.onerror = () => rej(new Error("lectura"));
    lector.readAsText(archivo);
  });
}
