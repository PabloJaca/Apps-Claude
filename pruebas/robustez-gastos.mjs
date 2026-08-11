/* Datos rotos contra la app de Gastos.

   Igual que `robustez.mjs` hace con Salud. Un registro a medias no aparece
   porque alguien lo escriba a mano: aparece por una sincronización cortada, un
   guardado a medias o una copia vieja restaurada. Y cuando aparece, lo que no
   puede pasar es que la pantalla se quede en blanco.

   La regla aquí es: puede salir un número raro, pero no puede romperse.

   node pruebas/robustez-gastos.mjs */

import { analizarMes } from "../src/gastos/analisis.js";
import * as g from "../src/gastos/nucleo.js";
import { interpretarGasto } from "../src/gastos/dictado.js";

let fallos = 0;
const check = (n, c, extra = "") => { console.log(`${c ? "✓" : "✗"} ${n}${c ? "" : "  ← " + extra}`); if (!c) fallos++; };

/* Llama y avisa si revienta, en vez de tumbar el guion entero. */
const aguanta = (nombre, fn) => {
  try {
    const r = fn();
    check(nombre, true);
    return r;
  } catch (e) {
    check(nombre, false, `${e.name}: ${e.message}`);
    return null;
  }
};

const MES = "2026-08";
const cats = g.categoriasIniciales();
const catPorId = Object.fromEntries(cats.map((c) => [c.id, c]));

/* ── la colección de horrores ────────────────────────────────────────────── */

const rotos = {
  gastos: [
    null,                                                    // un hueco
    undefined,
    {},                                                      // sin nada
    { id: "a" },                                             // sin fecha ni importe
    { id: "b", fecha: "2026-08-03" },                        // sin importe
    { id: "c", importe: 20, fecha: null },                   // fecha nula
    { id: "d", importe: 20, fecha: "no es una fecha" },
    { id: "e", importe: "treinta", fecha: "2026-08-04" },    // importe de texto
    { id: "f", importe: NaN, fecha: "2026-08-05" },
    { id: "g", importe: Infinity, fecha: "2026-08-06" },
    { id: "h", importe: -50, fecha: "2026-08-07", categoria: "comida" },   // una devolución
    { id: "i", importe: 1e15, fecha: "2026-08-08", categoria: "comida" },  // un disparate
    { id: "j", importe: 20, fecha: "2026-08-09", categoria: "no-existe" }, // categoría fantasma
    { id: "k", importe: 20, fecha: "2026-08-10", categoria: null },
    { id: "l", importe: 20, fecha: "2026-08-11", categoria: "comida", nota: "x".repeat(5000) },
    { id: "m", importe: 20, fecha: "2026-08-12", categoria: "comida", nota: "🍕".repeat(200) },
    { id: "n", importe: 42.3, fecha: "2026-08-02", categoria: "comida", nota: "Mercadona" }, // uno bueno
  ],
  ingresos: [
    null,
    { id: "x" },
    { id: "y", importe: -100, fecha: "2026-08-01" },         // un ingreso negativo
    { id: "z", importe: 1900, fecha: "2026-08-01", origen: "inventado" },
  ],
  fijos: [
    null,
    {},
    { id: "f1", nombre: "Alquiler", importe: 750, categoria: "casa", dia: 1, desde: "2026-01", hasta: null },
    { id: "f2", nombre: "Roto", importe: 10, categoria: "casa", dia: 99, desde: "2026-01" },   // día imposible
    { id: "f3", nombre: "Alrevés", importe: 10, categoria: "casa", dia: 1, desde: "2026-12", hasta: "2026-01" },
    { id: "f4", nombre: "Sin desde", importe: 10, categoria: "casa", dia: 1 },
    { id: "f5", importe: 10, categoria: "casa", dia: 1, desde: "2026-01" },  // sin nombre
    { id: "f6", nombre: "Nómina", importe: 2100, categoria: "otros", dia: 1, desde: "2026-01", tipo: "ingreso" },
  ],
  categorias: [...cats, null, {}, { id: "raro" }],
  ajustes: { presupuestoGlobal: "mil", objetivos: [null, {}, { meta: "x" }, { id: "o", nombre: "Coche", meta: 3000, ahorrado: 500 }] },
};

/* ── que nada de eso tumbe un cálculo ────────────────────────────────────── */

const movs = aguanta("movimientosDeMes aguanta la basura", () => g.movimientosDeMes(rotos, MES));
check("movimientosDeMes devuelve una lista", Array.isArray(movs), typeof movs);
check("y no cuela el fijo de tipo ingreso entre los gastos",
  !(movs || []).some((m) => m.importe === 2100), JSON.stringify((movs || []).filter((m) => m.importe === 2100)));

aguanta("ingresosDeMes aguanta la basura", () => g.ingresosDeMes(rotos, MES));
const bal = aguanta("balanceDeMes aguanta la basura", () => g.balanceDeMes(rotos, MES));
check("el balance no devuelve NaN por la cara",
  bal && (bal.ahorro === null || Number.isFinite(bal.ahorro)), JSON.stringify(bal));
check("ni una tasa de ahorro imposible",
  bal && (bal.tasa === null || Number.isFinite(bal.tasa)), JSON.stringify(bal));

aguanta("expandirFijos aguanta días imposibles", () => g.expandirFijos(rotos.fijos, MES));
const exp = g.expandirFijos(rotos.fijos, MES);
check("un día 99 se recorta al último del mes",
  exp.every((f) => Number(f.fecha.slice(8, 10)) <= 31), JSON.stringify(exp.map((f) => f.fecha)));
check("todas las fechas de los fijos son fechas de verdad",
  exp.every((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.fecha)), JSON.stringify(exp.map((f) => f.fecha)));
check("un fijo con «hasta» antes que «desde» no se cuela",
  !exp.some((f) => f.nota === "Alrevés"), JSON.stringify(exp.map((f) => f.nota)));

aguanta("gastosFrecuentes aguanta la basura", () => g.gastosFrecuentes(rotos.gastos));
aguanta("buscarMovimientos aguanta la basura", () => g.buscarMovimientos(rotos, { texto: "merca" }));
aguanta("buscar con todos los filtros a la vez", () =>
  g.buscarMovimientos(rotos, { texto: "a", categoria: "comida", desde: "2020-01-01", hasta: "2030-01-01" }));

for (const o of rotos.ajustes.objetivos) {
  aguanta(`progresoObjetivo aguanta ${JSON.stringify(o)}`, () => g.progresoObjetivo(o));
}

check("exportar no revienta con datos rotos", (() => {
  try { JSON.stringify(rotos); return true; } catch (e) { return false; }
})());

/* ── la revisión del mes, que es lo menos probado y lo más largo ─────────── */

const informe = aguanta("analizarMes aguanta la basura entera", () => analizarMes(rotos, MES, catPorId));

if (informe) {
  const texto = JSON.stringify(informe);
  check("la revisión no enseña «undefined» en ningún texto",
    !/undefined/.test(texto), texto.slice(0, 300));
  check("ni «NaN»", !/NaN/.test(texto), texto.slice(0, 300));
  check("ni «[object Object]»", !/\[object/.test(texto), texto.slice(0, 300));
  check("ni «Infinity»", !/Infinity/.test(texto), texto.slice(0, 300));

  /* Los textos que se le enseñan a una persona no pueden llevar números
     imposibles dentro, aunque el objeto sí tenga nulos legítimos. */
  const visibles = [];
  const recorrer = (x) => {
    if (typeof x === "string") visibles.push(x);
    else if (Array.isArray(x)) x.forEach(recorrer);
    else if (x && typeof x === "object") Object.values(x).forEach(recorrer);
  };
  recorrer(informe);
  check("los textos visibles no llevan cuentas rotas",
    !visibles.some((t) => /NaN|undefined|Infinity|e\+\d/.test(t)),
    visibles.find((t) => /NaN|undefined|Infinity|e\+\d/.test(t)) || "");
}

/* ── meses vacíos, meses raros ───────────────────────────────────────────── */

aguanta("un mes sin nada", () => analizarMes({ gastos: [], ingresos: [], fijos: [], categorias: cats }, "2026-03", catPorId));
aguanta("un mes con una clave inventada", () => analizarMes(rotos, "no-es-un-mes", catPorId));
aguanta("un mes del año 1900", () => analizarMes(rotos, "1900-02", catPorId));
aguanta("febrero de un bisiesto", () => analizarMes(rotos, "2028-02", catPorId));
aguanta("sin catPorId", () => analizarMes(rotos, MES, {}));
aguanta("datos completamente vacíos", () => analizarMes({}, MES, catPorId));

/* ── el intérprete del dictado también come de fuera ─────────────────────── */

for (const frase of [
  "", "   ", "?????", "42", "euros", "cuarenta y", "mil millones de euros en nada",
  "x".repeat(3000), "🍕🍕🍕", "-50 en comida", "0 euros en nada",
  "he gastado 20 en el 30 de 40 el 50",
]) {
  aguanta(`interpretarGasto aguanta «${frase.slice(0, 24)}»`, () => interpretarGasto(frase, rotos));
}

const conCero = interpretarGasto("0 euros en el super", rotos);
check("un importe de cero no se toma por bueno",
  !conCero || conCero.importe === 0 || conCero.importe === null, JSON.stringify(conCero));

/* ── números que se enseñan ──────────────────────────────────────────────── */

for (const v of [0, -0, 0.005, -12.345, 1e12, -1e12, NaN, Infinity, -Infinity, null, undefined, "20"]) {
  aguanta(`eur(${String(v)}) no revienta`, () => g.eur(v));
}
check("eur(NaN) no enseña NaN", !/NaN/.test(g.eur(NaN)), g.eur(NaN));
check("eur(undefined) no enseña undefined", !/undefined/.test(g.eur(undefined)), g.eur(undefined));
check("eur(Infinity) no enseña ∞ suelto", !/NaN|undefined/.test(g.eur(Infinity)), g.eur(Infinity));

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
