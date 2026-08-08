/* Pruebas de la app de Gastos: ingresos, balance, repetir, buscar y objetivos.
   node pruebas/gastos.mjs */

import * as g from "../src/gastos/nucleo.js";

let fallos = 0;
const check = (n, c, extra = "") => { console.log(`${c ? "✓" : "✗"} ${n}${c ? "" : "  ← " + extra}`); if (!c) fallos++; };

const MES = "2026-08";
const datos = {
  gastos: [
    { id: "a", importe: 42.3, categoria: "comida", fecha: "2026-08-03", nota: "Mercadona" },
    { id: "b", importe: 51.2, categoria: "comida", fecha: "2026-08-10", nota: "mercadona" },
    { id: "c", importe: 38, categoria: "ocio", fecha: "2026-08-05", nota: "Cena con Marta" },
    { id: "d", importe: 60, categoria: "comida", fecha: "2026-07-04", nota: "Mercadona" },
  ],
  ingresos: [
    { id: "i1", importe: 1900, fecha: "2026-08-01", origen: "nomina", nota: "Nómina" },
    { id: "i2", importe: 120, fecha: "2026-08-12", origen: "devolucion", nota: "Devolución Hacienda" },
    { id: "i3", importe: 1900, fecha: "2026-07-01", origen: "nomina", nota: "Nómina" },
  ],
  fijos: [
    { id: "f1", nombre: "Alquiler", importe: 750, categoria: "casa", dia: 1, desde: "2026-01", hasta: null },
    { id: "f2", nombre: "Nómina", importe: 100, categoria: "otros", dia: 25, desde: "2026-01", hasta: null, tipo: "ingreso" },
  ],
  categorias: g.categoriasIniciales(),
  ajustes: { presupuestoGlobal: 1400, objetivos: [] },
};

/* ── ingresos y balance ──────────────────────────────────────────────────── */

const entran = g.ingresosDeMes(datos, MES);
check("ingresos: se cogen los del mes y no los de otro", entran.filter((i) => !i.esFijo).length === 2, String(entran.length));
check("ingresos: los fijos de tipo ingreso también entran", entran.some((i) => i.esFijo && i.importe === 100));
check("ingresos: un fijo de gasto NO cuenta como ingreso", !entran.some((i) => i.importe === 750));

const salen = g.movimientosDeMes(datos, MES);
check("gastos: el fijo de gasto sigue apareciendo", salen.some((m) => m.esFijo && m.importe === 750));
check("gastos: el fijo de ingreso NO se cuela entre los gastos", !salen.some((m) => m.importe === 100));

const b = g.balanceDeMes(datos, MES);
check("balance: suma bien lo que entra", b.ingresos === 2120, String(b.ingresos));
check("balance: suma bien lo que sale", Math.round(b.gastos * 100) / 100 === 881.5, String(b.gastos));
check("balance: el ahorro es la resta", Math.round(b.ahorro * 100) / 100 === 1238.5, String(b.ahorro));
check("balance: la tasa de ahorro es un porcentaje", b.tasa === 58, String(b.tasa));

const sinIngresos = g.balanceDeMes({ ...datos, ingresos: [], fijos: [datos.fijos[0]] }, MES);
check("balance: sin ingresos NO se inventa un ahorro negativo", sinIngresos.ahorro === null, JSON.stringify(sinIngresos));
check("balance: y lo dice", sinIngresos.hayIngresos === false);
check("balance: pero sí sabe lo gastado", sinIngresos.gastos === 881.5, String(sinIngresos.gastos));

/* ── repetir gastos frecuentes ───────────────────────────────────────────── */

const frec = g.gastosFrecuentes(datos.gastos, 3, "2026-08-15");
check("frecuentes: «Mercadona» y «mercadona» son el mismo", frec.length === 1, JSON.stringify(frec.map((f) => f.nota)));
check("frecuentes: ofrece el importe de la última vez", frec[0].importe === 51.2, String(frec[0] && frec[0].importe));
check("frecuentes: conserva la categoría", frec[0].categoria === "comida");
check("frecuentes: dice cuántas veces", frec[0].veces === 3, String(frec[0] && frec[0].veces));
check("frecuentes: lo apuntado una sola vez no sale", !frec.some((f) => /Cena/.test(f.nota)));
check("frecuentes: sin gastos no revienta", g.gastosFrecuentes([]).length === 0);

/* ── buscar ──────────────────────────────────────────────────────────────── */

check("buscar: encuentra por texto sin tildes ni mayúsculas",
  g.buscarMovimientos(datos, { texto: "MERCADONA" }).length === 3,
  String(g.buscarMovimientos(datos, { texto: "MERCADONA" }).length));
check("buscar: filtra por categoría", g.buscarMovimientos(datos, { categoria: "ocio" }).length === 1);
check("buscar: filtra por fechas",
  g.buscarMovimientos(datos, { desde: "2026-08-01", hasta: "2026-08-31" }).filter((m) => m.tipo === "gasto").length === 3);
check("buscar: sale lo más reciente primero",
  g.buscarMovimientos(datos, {})[0].fecha === "2026-08-12");
check("buscar: distingue ingresos de gastos",
  g.buscarMovimientos(datos, { texto: "nomina" }).every((m) => m.tipo === "ingreso"));
check("buscar: sin filtros devuelve todo", g.buscarMovimientos(datos, {}).length === 7,
  String(g.buscarMovimientos(datos, {}).length));
check("buscar: algo que no existe devuelve nada", g.buscarMovimientos(datos, { texto: "zzzz" }).length === 0);
check("buscar: un rango abierto por abajo coge todo lo posterior",
  g.buscarMovimientos(datos, { desde: "2026-08-01" }).length === 5,
  String(g.buscarMovimientos(datos, { desde: "2026-08-01" }).length));
check("buscar: y abierto por arriba, todo lo anterior",
  g.buscarMovimientos(datos, { hasta: "2026-07-31" }).length === 2,
  String(g.buscarMovimientos(datos, { hasta: "2026-07-31" }).length));
check("buscar: un rango sin nada dentro no devuelve nada",
  g.buscarMovimientos(datos, { desde: "2001-01-01", hasta: "2001-12-31" }).length === 0);
check("buscar: los extremos del rango entran",
  g.buscarMovimientos(datos, { desde: "2026-08-03", hasta: "2026-08-03" }).length === 1);
check("buscar: fecha y texto se combinan, no se pisan",
  g.buscarMovimientos(datos, { texto: "mercadona", desde: "2026-08-01" }).length === 2,
  String(g.buscarMovimientos(datos, { texto: "mercadona", desde: "2026-08-01" }).length));

/* ── el tope que propone la bienvenida ───────────────────────────────────── */

check("tope: propone el 85% redondeado a decenas", g.topeSugerido(2000, 700) === 1700, String(g.topeSugerido(2000, 700)));
check("tope: nunca por debajo de los fijos", g.topeSugerido(1000, 900) === 900, String(g.topeSugerido(1000, 900)));
check("tope: sin ingresos no propone nada", g.topeSugerido(0, 500) === 0);
check("tope: sin fijos también funciona", g.topeSugerido(1200) === 1020, String(g.topeSugerido(1200)));
check("tope: un texto vacío no lo vuelve NaN", g.topeSugerido("", "") === 0);

/* ── objetivos de ahorro ─────────────────────────────────────────────────── */

const o = g.progresoObjetivo({ id: "x", nombre: "Coche", meta: 3000, ahorrado: 1850 });
check("objetivo: calcula el porcentaje", o.porcentaje === 62, String(o.porcentaje));
check("objetivo: dice lo que falta", o.restante === 1150, String(o.restante));
check("objetivo: aún no está conseguido", o.conseguido === false);
check("objetivo: al llegar lo dice", g.progresoObjetivo({ meta: 100, ahorrado: 100 }).conseguido === true);
check("objetivo: pasarse no supera el 100%", g.progresoObjetivo({ meta: 100, ahorrado: 250 }).porcentaje === 100);
check("objetivo: sin meta no devuelve nada", g.progresoObjetivo({ nombre: "x" }) === null);
check("objetivo: meta cero no divide por cero", g.progresoObjetivo({ meta: 0, ahorrado: 10 }) === null);
check("objetivo: sin nada ahorrado va a cero", g.progresoObjetivo({ meta: 500 }).porcentaje === 0);

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
