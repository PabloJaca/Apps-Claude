/* ─────────────────────────────────────────────────────────────────────────
   Salud · núcleo: modelo, fechas, perfil energético y migración.
   ───────────────────────────────────────────────────────────────────────── */

import { nuevoId } from "../comun/id.js";

/** Colecciones de Firestore que usa esta app: usuarios/{uid}/<nombre>/{id}. */
export const COLECCIONES = ["pesos", "entrenos", "comidas"];

export const PERFIL_VACIO = { altura: "", edad: "", sexo: "", actividad: "", objetivo: "" };

/** Lo que la app espera tener en pantalla mientras Firestore aún no ha hablado. */
export const VACIO = { perfil: PERFIL_VACIO, pesos: [], entrenos: [], comidas: [] };

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

/* Cuánta comida había en el plato. Sustituye al viejo poco / normal / mucho:
   con cinco escalones el multiplicador es mucho más fino. */
export const VOLUMENES = [
  { n: 1, label: "Muy poco", desc: "Un picoteo", factor: 0.5 },
  { n: 2, label: "Poco", desc: "Menos de lo normal", factor: 0.75 },
  { n: 3, label: "Normal", desc: "Tu ración de siempre", factor: 1 },
  { n: 4, label: "Bastante", desc: "Repetiste o ración grande", factor: 1.35 },
  { n: 5, label: "Mucho", desc: "Hasta arriba", factor: 1.75 },
];
export const volumenDe = (n) => VOLUMENES.find((v) => v.n === n) || VOLUMENES[2];

/* Cómo te dejó. Es la segunda opinión: si el texto dice una cosa y el cuerpo
   dice otra, la estimación se corrige y el rango se abre o se cierra. */
export const SACIEDADES = [
  { n: 1, label: "Con hambre", desc: "Te quedaste corto" },
  { n: 2, label: "Justo", desc: "Ni hambre ni lleno" },
  { n: 3, label: "Lleno", desc: "Saciado del todo" },
  { n: 4, label: "Muy lleno", desc: "Te costó levantarte" },
];
export const saciedadDe = (n) => SACIEDADES.find((s) => s.n === n) || null;

export const DURACIONES = [20, 30, 45, 60, 90];

/* Un kilo de grasa son unas 7.700 kcal: sirve para traducir déficit en peso. */
export const KCAL_POR_KILO = 7700;

/* Objetivo de entrenos por semana con el que se juzga el periodo. */
export const ENTRENOS_SEMANA = 4;

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

/* ── báscula: saltos que no se sostienen ─────────────────────────────────── */

/**
 * Lo máximo que el peso puede moverse de verdad entre dos pesajes.
 * De un día para otro se mueven fácil 1-2 kg de agua y comida en tránsito,
 * pero de grasa no se pierde ni se gana casi nada. Pasar de 92 a 95 en un día
 * es agua, la báscula mal puesta o un dedo torcido al teclear: no es peso.
 */
export function toleranciaPeso(kg, dias = 1) {
  const base = Math.max(1.8, (Number(kg) || 75) * 0.022);
  return Math.min(9, base + 0.32 * Math.max(0, dias - 1));
}

/** Revisa un pesaje contra el anterior. Avisa, nunca bloquea. */
export function revisarPeso(kg, fecha, pesos) {
  const valor = Number(kg);
  if (!(valor > 0)) return { ok: false, motivo: "El peso tiene que ser un número mayor que cero." };
  if (valor < 25 || valor > 300) {
    return { ok: false, motivo: `${num(valor)} kg no parece un peso real. ¿Te has dejado un número?` };
  }

  const previos = (pesos || [])
    .filter((p) => p.fecha < fecha)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ref = previos[previos.length - 1];
  if (!ref) return { ok: true };

  const dias = Math.max(1, Math.round((desdeIso(fecha) - desdeIso(ref.fecha)) / 86400000));
  const salto = valor - ref.kg;
  const tope = toleranciaPeso(ref.kg, dias);
  if (Math.abs(salto) <= tope) return { ok: true };

  return {
    ok: false,
    salto,
    dias,
    referencia: ref,
    motivo:
      dias === 1
        ? `De ${num(ref.kg)} a ${num(valor)} kg en un día son ${num(Math.abs(salto))} kg. Eso no es peso real: será agua o un error al teclear.`
        : `De ${num(ref.kg)} a ${num(valor)} kg en ${dias} días son ${num(Math.abs(salto))} kg. Es mucho para ese tiempo.`,
  };
}

/**
 * Separa los pesajes que se sostienen de los picos sueltos.
 * Un salto solo cuenta como error si el siguiente pesaje vuelve al nivel de
 * antes: si el cambio se mantiene, es que el peso cambió de verdad.
 */
export function pesosFiables(pesos) {
  const serie = [...(pesos || [])].sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (serie.length < 3) return { fiables: serie, sospechosos: [] };

  const fiables = [serie[0]];
  const sospechosos = [];

  for (let i = 1; i < serie.length; i++) {
    const previo = fiables[fiables.length - 1];
    const actual = serie[i];
    const dias = Math.max(1, Math.round((desdeIso(actual.fecha) - desdeIso(previo.fecha)) / 86400000));
    const tope = toleranciaPeso(previo.kg, dias);

    if (Math.abs(actual.kg - previo.kg) <= tope) {
      fiables.push(actual);
      continue;
    }

    const siguiente = serie[i + 1];
    const vuelve = siguiente && Math.abs(siguiente.kg - previo.kg) < Math.abs(actual.kg - previo.kg) / 2;
    if (vuelve) sospechosos.push(actual);
    else fiables.push(actual); // el cambio se mantiene: era real
  }

  return { fiables, sospechosos };
}

/* ── normalizar lo que venga de fuera ────────────────────────────────────── */

/* poco / normal / mucho → escalón de volumen equivalente */
const VOLUMEN_DESDE_CANTIDAD = { poco: 2, normal: 3, mucho: 4 };

const entre = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Convierte una lista guardada por cualquier versión anterior en registros
 * válidos para Firestore: con `id` propio y sin los campos del viejo motor de
 * fusión (`mod`), que ya no existe porque cada registro es su propio documento.
 */
function normalizar(lista, arreglar) {
  return (lista || [])
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const { mod, ...resto } = x;
      const limpio = { ...resto, id: x.id || nuevoId() };
      return arreglar ? arreglar(limpio) : limpio;
    });
}

/* Las comidas viejas traen `cantidad`; se traduce a volumen y se quedan sin
   saciedad, que es un dato que entonces no se pedía. El estimador sabe
   apañarse sin él. */
const arreglarComida = (c) => {
  const { cantidad, ...resto } = c;
  return {
    ...resto,
    volumen: entre(c.volumen || VOLUMEN_DESDE_CANTIDAD[cantidad] || 3, 1, 5),
    saciedad: c.saciedad != null ? entre(c.saciedad, 1, 4) : null,
  };
};

/** Reparte un objeto tipo `{perfil, pesos, entrenos, comidas}` en colecciones. */
export function repartir(d) {
  return {
    porColeccion: {
      pesos: normalizar(d.pesos),
      entrenos: normalizar(d.entrenos),
      comidas: normalizar(d.comidas, arreglarComida),
    },
    campos: { perfil: { ...PERFIL_VACIO, ...(d.perfil || {}) } },
  };
}

/* ── datos que dejó la versión anterior en este dispositivo ──────────────── */

/* La versión anterior guardaba en el propio navegador, sin saber de quién era.
   Eso es justo lo que se ha quitado: ahora todo cuelga del usuario. Lo que
   quedara guardado no se toca ni se sube solo; se ofrece en la pantalla de
   cuenta para que su dueño decida, y solo entonces se importa. */

export const CLAVE_LEGADO = "salud-app-v2";
const CLAVE_LEGADO_VISTO = "salud-legado-descartado";

const cuantos = (n, uno, muchos) => (n === 1 ? `1 ${uno}` : `${n} ${muchos}`);

export function leerLegado(almacen) {
  const ls = almacen || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!ls) return null;

  let crudo;
  try {
    if (ls.getItem(CLAVE_LEGADO_VISTO)) return null;
    crudo = ls.getItem(CLAVE_LEGADO);
  } catch (e) {
    return null;
  }
  if (!crudo) return null;

  let d;
  try {
    d = JSON.parse(crudo);
  } catch (e) {
    return null;
  }
  if (!d || typeof d !== "object") return null;

  const { porColeccion, campos } = repartir(d);
  const partes = [];
  if (porColeccion.pesos.length) partes.push(cuantos(porColeccion.pesos.length, "pesaje", "pesajes"));
  if (porColeccion.entrenos.length) partes.push(cuantos(porColeccion.entrenos.length, "entreno", "entrenos"));
  if (porColeccion.comidas.length) partes.push(cuantos(porColeccion.comidas.length, "comida", "comidas"));
  if (!partes.length) return null;

  return { porColeccion, campos, resumen: partes.join(", ") };
}

/** Se llama cuando ya se han importado (o el usuario ha dicho que no son suyos). */
export function olvidarLegado(almacen) {
  const ls = almacen || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!ls) return;
  try {
    ls.setItem(CLAVE_LEGADO_VISTO, String(Date.now()));
    ls.removeItem(CLAVE_LEGADO);
  } catch (e) {
    /* si el navegador no deja escribir, tampoco pasa nada grave */
  }
}

/* ── copia de seguridad ──────────────────────────────────────────────────── */

export function exportar(datos) {
  const blob = new Blob([JSON.stringify({ app: "salud", version: 4, fecha: new Date().toISOString(), datos }, null, 2)], {
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

/** Lee un archivo de copia y lo deja listo para escribirlo en la cuenta. */
export function importar(archivo) {
  return new Promise((res, rej) => {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const j = JSON.parse(lector.result);
        const d = j && j.datos ? j.datos : j && j.data ? j.data : j;
        if (!d || !Array.isArray(d.pesos)) throw new Error("formato");
        res(repartir(d));
      } catch (e) {
        rej(e);
      }
    };
    lector.onerror = () => rej(new Error("lectura"));
    lector.readAsText(archivo);
  });
}
