/* ─────────────────────────────────────────────────────────────────────────
   Gastos · núcleo: modelo de datos, migración y cálculos de mes.
   Todo lo que no es pantalla vive aquí, para poder razonarlo (y probarlo) suelto.
   ───────────────────────────────────────────────────────────────────────── */

import { ahora, nuevoId } from "../comun/fusion.js";

export const CLAVE = "gastos-v1"; // se mantiene la de siempre: no se pierde nada
export const APP = "gastos";

export const ESQUEMA = {
  colecciones: ["gastos", "fijos", "categorias"],
  sellos: ["ajustes"],
};

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

export const PALETA = [
  "#F4614E", "#FF8A3D", "#F5A524", "#7CB342",
  "#1FB47A", "#0F9E8E", "#35C4DC", "#3B9EFF",
  "#8B7BE8", "#E0567A", "#F07AA6", "#7C93A8",
];

export const CATEGORIAS_INICIALES = [
  { id: "comida", nombre: "Comida", color: "#F4614E", icono: "utensils" },
  { id: "ocio", nombre: "Ocio", color: "#8B7BE8", icono: "party" },
  { id: "transporte", nombre: "Transporte", color: "#3B9EFF", icono: "bus" },
  { id: "casa", nombre: "Casa", color: "#0F9E8E", icono: "home" },
  { id: "deporte", nombre: "Deporte", color: "#1FB47A", icono: "dumbbell" },
  { id: "salud", nombre: "Salud", color: "#F07AA6", icono: "heart" },
  { id: "ropa", nombre: "Ropa", color: "#FF8A3D", icono: "shirt" },
  { id: "suscripciones", nombre: "Suscripciones", color: "#F5A524", icono: "repeat" },
  { id: "otros", nombre: "Otros", color: "#7C93A8", icono: "package" },
];

export const VACIO = {
  v: 2,
  gastos: [],
  fijos: [],
  categorias: [],
  ajustes: { presupuestoGlobal: null },
  borrados: {},
  sellos: {},
};

/* ── formato ─────────────────────────────────────────────────────────────── */

export const eur = (n, decimales = true) => {
  const v = Number(n) || 0;
  return v.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimales && v % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: decimales ? 2 : 0,
  });
};

export const pct = (n, dec = 0) => `${(Number(n) || 0).toFixed(dec).replace(".", ",")}%`;

/* ── fechas ──────────────────────────────────────────────────────────────── */

export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const claveMes = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
export const mesDeISO = (iso) => (iso || "").slice(0, 7);
export const diaDeISO = (iso) => parseInt((iso || "").slice(8, 10), 10);
export const diasDelMes = (y, m) => new Date(y, m + 1, 0).getDate();
export const mesActualClave = () => {
  const d = new Date();
  return claveMes(d.getFullYear(), d.getMonth());
};
export const restarMeses = (y, m, n) => {
  const d = new Date(y, m - n, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};
export const desdeClaveMes = (clave) => ({
  y: parseInt(clave.slice(0, 4), 10),
  m: parseInt(clave.slice(5, 7), 10) - 1,
});
export const nombreMesClave = (clave) => {
  const { y, m } = desdeClaveMes(clave);
  return `${MESES[m]} ${y}`;
};
/** Día de la semana con el lunes en 0, que es como piensa la gente aquí. */
export const diaSemanaISO = (iso) => {
  const { y, m } = desdeClaveMes(iso);
  const d = new Date(y, m, diaDeISO(iso));
  return (d.getDay() + 6) % 7;
};

export const uid = nuevoId;

/* ── iconos por nombre ───────────────────────────────────────────────────── */

const PISTAS_ICONO = [
  [/deport|gimnas|gym|fitness|padel|p[áa]del|correr|running/i, "dumbbell"],
  [/comid|super|mercad|aliment|restaur|cena|almuerz/i, "utensils"],
  [/caf[eé]|desayun|brunch/i, "coffee"],
  [/cerve|bar|copa|fiesta|pub/i, "beer"],
  [/ocio|cine|pel[ií]cul|teatro/i, "film"],
  [/m[uú]sic|concier|spotify|disco/i, "music"],
  [/juego|videojueg|game|steam|consola/i, "gamepad"],
  [/transp|bus|metro|tren|cercan[ií]as/i, "bus"],
  [/coche|gasolin|combusti|parking|taller|itv/i, "car"],
  [/viaj|vuelo|avi[oó]n|hotel|airbnb/i, "plane"],
  [/casa|hogar|alquil|hipotec|comunidad/i, "home"],
  [/luz|electric|energ/i, "zap"],
  [/agua|gas /i, "droplet"],
  [/internet|fibra|wifi/i, "wifi"],
  [/m[oó]vil|tel[eé]fon|tarifa/i, "phone"],
  [/salud|m[eé]dic|farmac|dentist|seguro/i, "heart"],
  [/ropa|moda|zapat|calzado/i, "shirt"],
  [/pelu|est[eé]tic|barb/i, "scissors"],
  [/libro|estudi|curso|formaci|m[aá]ster/i, "book"],
  [/regal|cumple|boda/i, "gift"],
  [/mascot|perro|gato|veterin/i, "dog"],
  [/beb[eé]|ni[ñn]o|guarder|colegio/i, "baby"],
  [/repar|manteni|obra|ferreter/i, "wrench"],
  [/ahorr|invers|fondo/i, "piggy"],
  [/suscrip|cuota|mensual|netflix|prime|hbo/i, "repeat"],
];

export const adivinarIcono = (nombre = "") => {
  for (const [re, ic] of PISTAS_ICONO) if (re.test(nombre)) return ic;
  return "package";
};

/* ── migración ───────────────────────────────────────────────────────────── */

const REMAPEO_COLOR = {
  "#E2543F": "#F4614E", "#7A6FB0": "#8B7BE8", "#4A8FBF": "#3B9EFF",
  "#1D6B66": "#0F9E8E", "#3FA37B": "#1FB47A", "#C4736B": "#F07AA6",
  "#E0A130": "#F5A524", "#8A9440": "#7CB342", "#B0557E": "#E0567A",
  "#5B7078": "#7C93A8", "#D2833B": "#FF8A3D", "#2E7DA8": "#35C4DC",
};

const ICONO_POR_ID = {
  comida: "utensils", ocio: "party", transporte: "bus", casa: "home",
  salud: "heart", ropa: "shirt", suscripciones: "repeat", otros: "package",
  deporte: "dumbbell",
};

/**
 * Normaliza cualquier cosa que hubiera guardada: el formato viejo (v1, con
 * `presupuestosCat` aparte y sin marcas de tiempo) y el nuevo. Se llama en cada
 * arranque, así que tiene que ser idempotente y no perder ni un registro.
 */
export function migrar(guardado) {
  const base = { ...VACIO, ...(guardado || {}) };
  const t = 0; // los datos que ya existían llevan marca 0: cualquier edición gana

  let categorias = (base.categorias && base.categorias.length ? base.categorias : CATEGORIAS_INICIALES).map((c) => ({
    id: c.id,
    mod: c.mod || t,
    nombre: c.nombre,
    color: REMAPEO_COLOR[c.color] || c.color,
    icono: c.icono || ICONO_POR_ID[c.id] || adivinarIcono(c.nombre),
    presupuesto: c.presupuesto != null ? c.presupuesto : null,
  }));

  // v1 guardaba los topes por categoría en un mapa suelto.
  const viejos = guardado && guardado.presupuestosCat;
  if (viejos && typeof viejos === "object") {
    categorias = categorias.map((c) =>
      c.presupuesto == null && viejos[c.id] > 0 ? { ...c, presupuesto: viejos[c.id] } : c
    );
  }

  if (!categorias.some((c) => /deport|gimnas|gym|fitness/i.test(c.nombre))) {
    const iOtros = categorias.findIndex((c) => c.id === "otros");
    const nueva = { id: "deporte", mod: t, nombre: "Deporte", color: "#1FB47A", icono: "dumbbell", presupuesto: null };
    if (iOtros >= 0) categorias = [...categorias.slice(0, iOtros), nueva, ...categorias.slice(iOtros)];
    else categorias.push(nueva);
  }

  const gastos = (base.gastos || []).map((g) => ({
    id: g.id || nuevoId(),
    mod: g.mod || t,
    importe: Number(g.importe) || 0,
    categoria: g.categoria,
    fecha: g.fecha,
    nota: g.nota || "",
  }));

  const fijos = (base.fijos || []).map((f) => ({
    id: f.id || nuevoId(),
    mod: f.mod || t,
    nombre: f.nombre,
    importe: Number(f.importe) || 0,
    categoria: f.categoria,
    dia: f.dia || 1,
    desde: f.desde,
    hasta: f.hasta ?? null,
  }));

  // Ojo con el orden: `base` ya viene mezclado con VACIO, así que hay que mirar
  // lo que había guardado de verdad. Si no, el tope de v1 se perdería sin avisar.
  const ajustesGuardados = guardado && guardado.ajustes;
  const ajustes = {
    presupuestoGlobal:
      ajustesGuardados && ajustesGuardados.presupuestoGlobal !== undefined
        ? ajustesGuardados.presupuestoGlobal
        : guardado && guardado.presupuestoGlobal != null
        ? guardado.presupuestoGlobal
        : null,
  };

  return {
    v: 2,
    gastos,
    fijos,
    categorias,
    ajustes,
    borrados: base.borrados || {},
    sellos: base.sellos || {},
  };
}

/* ── cálculo de movimientos ──────────────────────────────────────────────── */

/** Convierte los fijos activos en movimientos concretos de un mes. */
export function expandirFijos(fijos, mesKey) {
  const { y, m } = desdeClaveMes(mesKey);
  const nDias = diasDelMes(y, m);
  return (fijos || [])
    .filter((f) => f.desde <= mesKey && (!f.hasta || mesKey <= f.hasta))
    .map((f) => {
      const dia = Math.min(Math.max(1, f.dia || 1), nDias);
      return {
        id: `fijo:${f.id}:${mesKey}`,
        fijoId: f.id,
        esFijo: true,
        importe: f.importe,
        categoria: f.categoria,
        fecha: `${mesKey}-${String(dia).padStart(2, "0")}`,
        nota: f.nombre,
      };
    });
}

export function movimientosDeMes(datos, mesKey) {
  const reales = (datos.gastos || []).filter((g) => mesDeISO(g.fecha) === mesKey);
  return [...reales, ...expandirFijos(datos.fijos, mesKey)];
}

export const suma = (lista) => lista.reduce((s, g) => s + (Number(g.importe) || 0), 0);

/** Meses (clave) que tienen algún movimiento, del más antiguo al más reciente. */
export function mesesConDatos(datos) {
  const claves = new Set((datos.gastos || []).map((g) => mesDeISO(g.fecha)));
  for (const f of datos.fijos || []) {
    if (!f.desde) continue;
    let { y, m } = desdeClaveMes(f.desde);
    const fin = f.hasta || mesActualClave();
    for (let i = 0; i < 120; i++) {
      const k = claveMes(y, m);
      if (k > fin) break;
      claves.add(k);
      const d = new Date(y, m + 1, 1);
      y = d.getFullYear();
      m = d.getMonth();
    }
  }
  return [...claves].filter(Boolean).sort();
}

/* ── copia de seguridad ──────────────────────────────────────────────────── */

export function exportar(datos) {
  const blob = new Blob([JSON.stringify({ app: "gastos", version: 2, fecha: new Date().toISOString(), datos }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gastos-copia-${hoyISO()}.json`;
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
        const d = j && j.datos ? j.datos : j;
        if (!d || !Array.isArray(d.gastos)) throw new Error("formato");
        // Se marca todo como recién tocado para que gane al fusionar.
        const t = ahora();
        const sellar = (l) => (l || []).map((x) => ({ ...x, mod: t }));
        res(migrar({ ...d, gastos: sellar(d.gastos), fijos: sellar(d.fijos), categorias: sellar(d.categorias) }));
      } catch (e) {
        rej(e);
      }
    };
    lector.onerror = () => rej(new Error("lectura"));
    lector.readAsText(archivo);
  });
}
