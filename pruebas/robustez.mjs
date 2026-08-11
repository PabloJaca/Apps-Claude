/* ─────────────────────────────────────────────────────────────────────────
   Pruebas de robustez de la app de Salud.

   Las demás comprueban que lo normal funciona. Estas van a lo otro: datos a
   medias, números en formatos raros, fechas en los bordes del calendario y
   registros escritos por versiones anteriores. Es donde una app se rompe de
   verdad, porque nadie usa una aplicación exactamente como se pensó.

   node pruebas/robustez.mjs
   ───────────────────────────────────────────────────────────────────────── */

import * as n from "../src/salud/nucleo.js";
import { valorarDia, estimarComida, calcularBalance } from "../src/salud/estimador.js";
import { valorarPeriodo } from "../src/salud/valoracion.js";

let fallos = 0;
const check = (nombre, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${nombre}${cond ? "" : "  ← " + extra}`);
  if (!cond) fallos++;
};

/** Llama a algo y dice si revienta, en vez de tumbar la tanda entera. */
const aguanta = (nombre, fn) => {
  try {
    const r = fn();
    check(nombre, true);
    return r;
  } catch (e) {
    check(nombre, false, String(e).split("\n")[0]);
    return undefined;
  }
};

const dia = (x) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - x);
  return n.iso(d);
};

/* ── 1. Nada, vacío y roto ───────────────────────────────────────────────── */

console.log("\n── datos ausentes o rotos ──");

const VACIO = { perfil: {}, pesos: [], entrenos: [], comidas: [] };

aguanta("valorarPeriodo con todo vacío", () => valorarPeriodo(VACIO, null, "semana", 0));
aguanta("valorarPeriodo del mes con todo vacío", () => valorarPeriodo(VACIO, null, "mes", 0));
aguanta("valorarDia sin comidas", () => valorarDia([], null));
aguanta("racha sin listas", () => n.racha({}));
aguanta("resumenFuerza de undefined", () => n.resumenFuerza(undefined));
aguanta("tendenciaPeso de undefined", () => n.tendenciaPeso(undefined));
aguanta("mediaMovil de undefined", () => n.mediaMovil(undefined));
aguanta("progresoMeta sin perfil", () => n.progresoMeta([], undefined));
aguanta("ejerciciosUsados de undefined", () => n.ejerciciosUsados(undefined));
aguanta("comidasFrecuentes de undefined", () => n.comidasFrecuentes(undefined, "cena"));
aguanta("calcularEnergia con perfil vacío", () => n.calcularEnergia({}, 80));
aguanta("revisarPeso sin serie previa", () => n.revisarPeso(80, dia(0), undefined));
aguanta("pesosFiables de undefined", () => n.pesosFiables(undefined));

/* Registros a medias, como los que dejaría una versión anterior o un import. */
const cojos = {
  perfil: {},
  pesos: [{ fecha: dia(2), kg: 80 }, { fecha: dia(1) }, { kg: 79 }, null],
  entrenos: [
    { fecha: dia(1), tipo: "fuerza" },                       // sin minutos
    { fecha: dia(2), tipo: "fuerza", ejercicios: [{ nombre: "Press" }] },  // sin series
    { fecha: dia(3), tipo: "fuerza", ejercicios: [{ series: [{ reps: 8, kg: 60 }] }] }, // sin nombre
    { fecha: dia(4) },                                       // sin tipo
  ],
  comidas: [
    { fecha: dia(1), texto: "arroz" },                       // sin volumen ni momento
    { fecha: dia(1), volumen: 3, momento: "cena" },           // sin texto
    { fecha: dia(2), texto: "", volumen: 3 },
  ],
};

aguanta("racha con registros a medias", () => n.racha(cojos));
aguanta("resumenFuerza con ejercicios sin series", () => n.resumenFuerza(cojos.entrenos[1]));
aguanta("ejerciciosUsados con ejercicios sin nombre", () => n.ejerciciosUsados(cojos.entrenos));
aguanta("valorarPeriodo con registros a medias", () => valorarPeriodo(cojos, null, "semana", 0));
aguanta("valorarDia con comidas sin texto", () => valorarDia(cojos.comidas, null));
aguanta("mediaMovil con pesajes sin kg", () => n.mediaMovil(cojos.pesos.filter(Boolean)));

const rf = n.resumenFuerza(cojos.entrenos[1]);
check("un ejercicio sin series cuenta como ejercicio pero sin series", rf && rf.ejercicios === 1 && rf.series === 0, JSON.stringify(rf));

/* ── 2. Números en formatos que la gente escribe de verdad ───────────────── */

console.log("\n── números raros ──");

check("peso cero se rechaza", n.revisarPeso(0, dia(0), []).ok === false);
check("peso negativo se rechaza", n.revisarPeso(-80, dia(0), []).ok === false);
check("peso como texto vacío se rechaza", n.revisarPeso("", dia(0), []).ok === false);
check("peso NaN se rechaza", n.revisarPeso(NaN, dia(0), []).ok === false);
check("peso 'ochenta' se rechaza", n.revisarPeso("ochenta", dia(0), []).ok === false);
check("peso con coma decimal se acepta como número", n.revisarPeso(80.5, dia(0), []).ok === true);

check("1RM con reps 0", n.unaRepeticion(80, 0) === null);
check("1RM con reps negativas", n.unaRepeticion(80, -5) === null);
check("1RM con kg negativos", n.unaRepeticion(-80, 8) === null);
check("1RM con texto", n.unaRepeticion("80", "8") !== null, "acepta numérico en texto");

check("pesoCorto de null", n.pesoCorto(null) === "—");
check("pesoCorto de texto", n.pesoCorto("hola") === "—", n.pesoCorto("hola"));
check("pesoCorto de entero", n.pesoCorto(70) === "70");
check("pesoCorto de decimal", n.pesoCorto(77.5) === "77,5");
check("pesoCorto de cero", n.pesoCorto(0) === "0", n.pesoCorto(0));

check("num de infinito no revienta", typeof n.num(Infinity) === "string", n.num(Infinity));
check("miles de null", n.miles(null) === "—");

check("plural con decimales", n.plural(1.5, "día") === "1,5 días" || n.plural(1.5, "día") === "1.5 días", n.plural(1.5, "día"));

/* ── 3. Fechas en los bordes ─────────────────────────────────────────────── */

console.log("\n── fechas límite ──");

check("iso y desdeIso van y vuelven", n.iso(n.desdeIso("2026-02-28")) === "2026-02-28");
check("año bisiesto", n.iso(n.desdeIso("2024-02-29")) === "2024-02-29");
check("último día del año", n.iso(n.desdeIso("2026-12-31")) === "2026-12-31");
check("primer día del año", n.iso(n.desdeIso("2026-01-01")) === "2026-01-01");
check("fecha basura no revienta desdeIso", (() => { try { n.desdeIso("nada"); return true; } catch (e) { return false; } })());

/* La racha tiene que cruzar el cambio de mes y de año. */
const cruzaAno = { pesos: [
  { fecha: "2025-12-30" }, { fecha: "2025-12-31" }, { fecha: "2026-01-01" }, { fecha: "2026-01-02" },
], entrenos: [], comidas: [] };
check("la racha cruza el cambio de año", n.racha(cruzaAno, "2026-01-02").dias === 4, JSON.stringify(n.racha(cruzaAno, "2026-01-02")));

const cruzaMes = { pesos: [{ fecha: "2026-02-27" }, { fecha: "2026-02-28" }, { fecha: "2026-03-01" }], entrenos: [], comidas: [] };
check("la racha cruza febrero", n.racha(cruzaMes, "2026-03-01").dias === 3, JSON.stringify(n.racha(cruzaMes, "2026-03-01")));

const bisiesto = { pesos: [{ fecha: "2024-02-28" }, { fecha: "2024-02-29" }, { fecha: "2024-03-01" }], entrenos: [], comidas: [] };
check("la racha cruza el 29 de febrero", n.racha(bisiesto, "2024-03-01").dias === 3, JSON.stringify(n.racha(bisiesto, "2024-03-01")));

/* ── 4. Duplicados y colisiones ──────────────────────────────────────────── */

console.log("\n── duplicados ──");

const dosMismoDia = [
  { fecha: dia(5), kg: 80 }, { fecha: dia(5), kg: 80.4 },
  { fecha: dia(3), kg: 79.8 }, { fecha: dia(1), kg: 79.5 }, { fecha: dia(0), kg: 79.2 },
];
aguanta("mediaMovil con dos pesajes el mismo día", () => n.mediaMovil(dosMismoDia));
aguanta("tendenciaPeso con dos pesajes el mismo día", () => n.tendenciaPeso(dosMismoDia));
check("dos pesajes el mismo día cuentan un día de racha",
  n.racha({ pesos: [{ fecha: dia(0) }, { fecha: dia(0) }], entrenos: [], comidas: [] }).dias === 1);

const mismaComidaDosMomentos = [
  { fecha: dia(1), texto: "Tortilla", momento: "comida", volumen: 3 },
  { fecha: dia(2), texto: "Tortilla", momento: "comida", volumen: 3 },
  { fecha: dia(1), texto: "Tortilla", momento: "cena", volumen: 2 },
  { fecha: dia(2), texto: "Tortilla", momento: "cena", volumen: 2 },
];
const fComida = n.comidasFrecuentes(mismaComidaDosMomentos, "comida");
const fCena = n.comidasFrecuentes(mismaComidaDosMomentos, "cena");
check("la misma comida en dos momentos no se mezcla",
  fComida.length === 1 && fCena.length === 1 && fComida[0].volumen === 3 && fCena[0].volumen === 2,
  JSON.stringify([fComida[0], fCena[0]]));

/* ── 5. Textos que la gente escribe ──────────────────────────────────────── */

console.log("\n── textos ──");

aguanta("estimarComida con texto vacío", () => estimarComida({ texto: "", volumen: 3 }));
aguanta("estimarComida con solo espacios", () => estimarComida({ texto: "   ", volumen: 3 }));
aguanta("estimarComida con emojis", () => estimarComida({ texto: "🍕🍕🍕", volumen: 3 }));
aguanta("estimarComida con 5.000 caracteres", () => estimarComida({ texto: "arroz ".repeat(800), volumen: 3 }));
aguanta("estimarComida sin volumen", () => estimarComida({ texto: "arroz con pollo" }));
aguanta("estimarComida con volumen fuera de escala", () => estimarComida({ texto: "arroz", volumen: 99 }));

const conTildes = n.comidasFrecuentes([
  { fecha: dia(1), texto: "Melón", momento: "snack", volumen: 2 },
  { fecha: dia(2), texto: "MELON", momento: "snack", volumen: 2 },
], "snack");
check("«Melón» y «MELON» son la misma comida", conTildes.length === 1, JSON.stringify(conTildes.map((c) => c.texto)));

check("ejercicio con tildes y mayúsculas se agrupa", n.mismoEjercicio("Elevación lateral", "elevacion LATERAL"));
check("ejercicio con guiones no se confunde", !n.mismoEjercicio("Press banca", "Press militar"));
check("un nombre vacío no casa con otro vacío por accidente", n.mismoEjercicio("", "   ") === true, "ambos quedan vacíos");

/* ── 6. Valoración con combinaciones parciales ───────────────────────────── */

console.log("\n── valoración parcial ──");

const energia = { gasto: 2700, diana: 2200, margen: 150, objetivo: { id: "bajar", label: "Bajar peso", verbo: "bajar" } };
const [lunes] = n.rangoSemana(1);
const d = (x) => { const y = new Date(lunes); y.setDate(y.getDate() + x); return n.iso(y); };

const combos = [
  ["solo pesos", { perfil: {}, pesos: [{ fecha: d(0), kg: 80 }, { fecha: d(3), kg: 79.7 }], entrenos: [], comidas: [] }],
  ["solo entrenos", { perfil: {}, pesos: [], entrenos: [{ fecha: d(1), tipo: "fuerza", minutos: 50 }], comidas: [] }],
  ["solo comidas", { perfil: {}, pesos: [], entrenos: [], comidas: [{ fecha: d(1), texto: "arroz", volumen: 3, momento: "comida" }] }],
  ["un solo pesaje", { perfil: {}, pesos: [{ fecha: d(0), kg: 80 }], entrenos: [], comidas: [] }],
];
for (const [nombre, datos] of combos) {
  const v = aguanta(`valoración con ${nombre}`, () => valorarPeriodo(datos, energia, "semana", 1));
  if (v && v.hayDatos !== false) {
    check(`  ${nombre}: hay veredicto con texto`, !!(v.veredicto && v.veredicto.texto), JSON.stringify(v.veredicto));
    check(`  ${nombre}: los avisos traen texto`, (v.avisos || []).every((a) => a.texto && a.texto.length > 5));
    /* Solo los textos que ve la persona: el objeto sí puede llevar nulos
       legítimos (una media que no se puede calcular, por ejemplo). */
    const textos = [v.veredicto && v.veredicto.texto, v.cierre, ...(v.avisos || []).map((a) => a.texto)]
      .filter(Boolean).join(" | ");
    check(`  ${nombre}: sin «undefined», «NaN» ni «null» en los textos`,
      !/undefined|NaN|\bnull\b/.test(textos), textos);
  }
}

/* Con energía pero sin nada apuntado, no puede salir una cifra inventada. */
const sinNada = valorarPeriodo({ perfil: {}, pesos: [{ fecha: d(0), kg: 80 }], entrenos: [], comidas: [] }, energia, "semana", 1);
check("sin comidas no se da una media de calorías", !/kcal de media/.test(JSON.stringify(sinNada)));

/* ── 7. Meta y tendencia en los bordes ───────────────────────────────────── */

console.log("\n── meta y tendencia ──");

const serie = [];
for (let i = 28; i >= 0; i -= 2) serie.push({ fecha: dia(i), kg: Number((85 - (28 - i) * 3 / 28).toFixed(2)) });

check("meta igual al peso actual", (() => {
  const p = n.progresoMeta(serie, { meta: serie[serie.length - 1].kg, metaDesde: 85 });
  return p && p.alcanzada === true;
})());
check("meta con valor cero se ignora", n.progresoMeta(serie, { meta: 0 }) === null);
check("meta negativa se ignora", n.progresoMeta(serie, { meta: -5 }) === null);
check("meta como texto se ignora o se entiende", (() => {
  const p = n.progresoMeta(serie, { meta: "79" });
  return p === null || p.meta === 79;
})());
check("meta igual al punto de partida no divide por cero", (() => {
  const p = n.progresoMeta(serie, { meta: 85, metaDesde: 85 });
  return p && Number.isFinite(p.porcentaje);
})(), JSON.stringify(n.progresoMeta(serie, { meta: 85, metaDesde: 85 })));

check("tendencia con todos los pesajes iguales", (() => {
  const plano = [];
  for (let i = 20; i >= 0; i -= 2) plano.push({ fecha: dia(i), kg: 80 });
  const t = n.tendenciaPeso(plano);
  return t === null || t.direccion === "estable";
})(), JSON.stringify(n.tendenciaPeso((() => { const p = []; for (let i = 20; i >= 0; i -= 2) p.push({ fecha: dia(i), kg: 80 }); return p; })())));

/* ── 8. Balance de calorías ──────────────────────────────────────────────── */

console.log("\n── balance ──");

check("balance sin energía", calcularBalance(null, 1800, 2100) === null);
check("balance sin kcal", calcularBalance(energia, null, null) === null);
check("balance con rango invertido no revienta", (() => {
  const b = calcularBalance(energia, 2100, 1800);
  return b === null || Number.isFinite(b.medio);
})());

/* ── el estimador de comidas y el dictado, que comen texto de fuera ──────── */

const { analizarTexto } = await import("../src/salud/estimador.js");
const { interpretarSalud } = await import("../src/salud/dictado.js");

for (const c of [
  null, undefined, {}, { texto: "" }, { texto: null }, { texto: 123 },
  { texto: "arroz", volumen: 0 }, { texto: "arroz", volumen: 99 },
  { texto: "arroz", volumen: "tres" }, { texto: "arroz", saciedad: -5 },
  { texto: "x".repeat(4000), volumen: 3 }, { texto: "🍕🍕🍕", volumen: 3 },
]) {
  aguanta(`estimarComida aguanta ${String(JSON.stringify(c)).slice(0, 40)}`, () => estimarComida(c));
}

aguanta("analizarTexto de nada", () => analizarTexto(undefined));
aguanta("analizarTexto de un número", () => analizarTexto(42));

for (const frase of [
  "", "   ", "?????", "peso", "80 por", "x".repeat(3000), "🍕",
  "peso 999999 kilos", "he comido -5 platos", "3 series de",
  "press banca por 8", "he corrido kilómetros en minutos",
]) {
  aguanta(`interpretarSalud aguanta «${frase.slice(0, 24)}»`, () => interpretarSalud(frase, cojos));
}
aguanta("interpretarSalud sin datos", () => interpretarSalud("peso 82", undefined));
aguanta("interpretarSalud con datos rotos", () => interpretarSalud("press banca 80 por 8", { entrenos: [null, {}] }));

/* Un peso imposible no puede colarse como pesaje bueno. */
const gordo = interpretarSalud("peso 999999 kilos", cojos);
check("un peso imposible no se toma por bueno", !gordo || gordo.seccion !== "peso" || gordo.kg <= 400,
  JSON.stringify(gordo));

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
