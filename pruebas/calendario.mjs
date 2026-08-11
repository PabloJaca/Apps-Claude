/* Los días que no son como los demás.

   Casi todo lo que calculan estas dos apps es aritmética de fechas, y la
   aritmética de fechas miente cuatro veces al año: los domingos del cambio de
   hora tienen 23 o 25 horas, febrero cambia de largo, y el día 31 no existe en
   la mitad de los meses.

   Aquí se comprueban esos días concretos, no una fecha cualquiera.

   node pruebas/calendario.mjs */

import * as g from "../src/gastos/nucleo.js";
import * as s from "../src/salud/nucleo.js";
import { leerFecha, trocear } from "../src/comun/lengua.js";

let fallos = 0;
const check = (n, c, extra = "") => { console.log(`${c ? "✓" : "✗"} ${n}${c ? "" : "  ← " + extra}`); if (!c) fallos++; };

/* ── el día que dura 23 horas ────────────────────────────────────────────── */

/* En España el reloj se adelanta el último domingo de marzo (2026: el 29) y se
   atrasa el último de octubre (2026: el 25). Restar «un día» en milisegundos
   se queda corto o se pasa justo ahí. */

const dias = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

check("marzo: del 28 al 29 hay un día aunque falte una hora", dias("2026-03-28", "2026-03-29") === 1,
  String(dias("2026-03-28", "2026-03-29")));
check("marzo: del 29 al 30 también", dias("2026-03-29", "2026-03-30") === 1);
check("octubre: del 24 al 25 hay un día aunque sobre una hora", dias("2026-10-24", "2026-10-25") === 1);
check("octubre: del 25 al 26 también", dias("2026-10-25", "2026-10-26") === 1);

/* La ausencia se mide con esa resta, así que se comprueba donde se usa. */
const gastoEn = (f) => [{ id: "x", importe: 10, categoria: "comida", fecha: f, nota: "X" }];
check("ausencia: el cambio de hora de marzo no inventa ni pierde un día",
  g.ausenciaGastos(gastoEn("2026-03-27"), "2026-03-30").dias === 3,
  String(g.ausenciaGastos(gastoEn("2026-03-27"), "2026-03-30").dias));
check("ausencia: ni el de octubre",
  g.ausenciaGastos(gastoEn("2026-10-23"), "2026-10-26").dias === 3,
  String(g.ausenciaGastos(gastoEn("2026-10-23"), "2026-10-26").dias));

const pesoEn = (f) => ({ pesos: [{ id: "p", fecha: f, kg: 80 }], entrenos: [], comidas: [] });
check("ausencia de salud: tampoco se descuadra en marzo",
  s.ausencia(pesoEn("2026-03-27"), "2026-03-30").dias === 3,
  String(s.ausencia(pesoEn("2026-03-27"), "2026-03-30").dias));

/* Y la racha, que cuenta días seguidos uno a uno. */
const seguidos = (desde, n) => {
  const out = [];
  const d = new Date(desde);
  for (let i = 0; i < n; i++) {
    out.push({ id: `p${i}`, fecha: s.iso(d), kg: 80 });
    d.setDate(d.getDate() + 1);
  }
  return { pesos: out, entrenos: [], comidas: [] };
};
check("racha: cinco días seguidos cruzando el cambio de marzo",
  s.racha(seguidos("2026-03-27", 5), "2026-03-31").dias === 5,
  JSON.stringify(s.racha(seguidos("2026-03-27", 5), "2026-03-31")));
check("racha: y cruzando el de octubre",
  s.racha(seguidos("2026-10-23", 5), "2026-10-27").dias === 5,
  JSON.stringify(s.racha(seguidos("2026-10-23", 5), "2026-10-27")));

/* ── febrero, que cambia de largo ────────────────────────────────────────── */

check("febrero de 2026 tiene 28 días", g.diasDelMes(2026, 1) === 28);
check("febrero de 2028 tiene 29", g.diasDelMes(2028, 1) === 29);
check("2100 no es bisiesto aunque acabe en 00", g.diasDelMes(2100, 1) === 28);
check("2000 sí lo era", g.diasDelMes(2000, 1) === 29);

/* Un fijo del día 31 en un mes que no lo tiene. */
const fijo31 = [{ id: "f", nombre: "Cuota", importe: 50, categoria: "casa", dia: 31, desde: "2026-01", hasta: null }];
for (const [mes, esperado] of [["2026-01", "2026-01-31"], ["2026-02", "2026-02-28"], ["2026-04", "2026-04-30"], ["2028-02", "2028-02-29"]]) {
  const f = g.expandirFijos(fijo31, mes)[0];
  check(`fijo del 31 en ${mes} cae el ${esperado.slice(8)}`, f && f.fecha === esperado, f && f.fecha);
}

check("y el 29 de febrero de un año normal se recorta",
  g.expandirFijos([{ ...fijo31[0], dia: 29 }], "2026-02")[0].fecha === "2026-02-28",
  g.expandirFijos([{ ...fijo31[0], dia: 29 }], "2026-02")[0].fecha);

/* ── el filo de los meses y los años ─────────────────────────────────────── */

check("31 de diciembre: el mes anterior es noviembre",
  JSON.stringify(g.restarMeses(2026, 11, 1)) === JSON.stringify({ y: 2026, m: 10 }),
  JSON.stringify(g.restarMeses(2026, 11, 1)));
check("enero: el mes anterior es diciembre del año pasado",
  JSON.stringify(g.restarMeses(2026, 0, 1)) === JSON.stringify({ y: 2025, m: 11 }),
  JSON.stringify(g.restarMeses(2026, 0, 1)));
check("y tres meses antes de enero es octubre del año pasado",
  JSON.stringify(g.restarMeses(2026, 0, 3)) === JSON.stringify({ y: 2025, m: 9 }),
  JSON.stringify(g.restarMeses(2026, 0, 3)));

/* El año, con un fijo que empezó antes y acabó a mitad. */
{
  const datos = {
    gastos: [{ id: "a", importe: 100, categoria: "comida", fecha: "2026-03-15", nota: "X" }],
    ingresos: [],
    fijos: [{ id: "f", nombre: "Alquiler", importe: 700, categoria: "casa", dia: 1, desde: "2025-06", hasta: "2026-04" }],
    categorias: g.categoriasIniciales(),
    ajustes: {},
  };
  const a = g.resumenAnual(datos, 2026, "2026-08-12");
  const conFijo = a.meses.filter((m) => m.gastos >= 700).map((m) => m.etiqueta);
  check("año: el fijo dado de baja en abril deja de contar en mayo",
    conFijo.join(",") === "ene,feb,mar,abr", conFijo.join(","));
  check("año: y el mes en que se dio de baja sí cuenta", conFijo.includes("abr"));
}

/* ── el dictado entendiendo días raros ───────────────────────────────────── */

const fecha = (frase, hoy) => {
  const r = leerFecha(trocear(frase).limpios, hoy);
  return r && r.fecha;
};

check("dictado: «ayer» el 1 de enero es el 31 de diciembre",
  fecha("ayer", "2026-01-01") === "2025-12-31", String(fecha("ayer", "2026-01-01")));
check("dictado: «ayer» el 1 de marzo de un bisiesto es el 29 de febrero",
  fecha("ayer", "2028-03-01") === "2028-02-29", String(fecha("ayer", "2028-03-01")));
check("dictado: «hace tres días» cruzando el cambio de hora",
  fecha("hace tres días", "2026-03-30") === "2026-03-27", String(fecha("hace tres días", "2026-03-30")));
check("dictado: «el lunes» dicho un domingo es el de hace seis días",
  fecha("el lunes", "2026-08-16") === "2026-08-10", String(fecha("el lunes", "2026-08-16")));
check("dictado: «el 31» estando a día 1 es el 31 del mes pasado",
  fecha("el 31", "2026-08-01") === "2026-07-31", String(fecha("el 31", "2026-08-01")));
/* Aquí había un fallo de verdad: `new Date(2026, 3, 31)` es el 1 de mayo,
   así que «el 31» dicho un 1 de mayo devolvía el 1 de mayo —hoy— en vez de
   una fecha del mes pasado. Ahora se recorta al último día que exista. */
check("dictado: «el 31» en un mes de 30 se recorta, no desborda al siguiente",
  fecha("el 31", "2026-05-01") === "2026-04-30", String(fecha("el 31", "2026-05-01")));
check("dictado: «el 30» en febrero se recorta al 28",
  fecha("el 30", "2026-03-01") === "2026-02-28", String(fecha("el 30", "2026-03-01")));
check("dictado: «el 30» en febrero de un bisiesto, al 29",
  fecha("el 30", "2028-03-01") === "2028-02-29", String(fecha("el 30", "2028-03-01")));
check("dictado: «el 31 de febrero» tampoco se va a marzo",
  fecha("el 31 de febrero", "2026-08-12") === "2026-02-28", String(fecha("el 31 de febrero", "2026-08-12")));
check("dictado: y un día que sí existe no se toca",
  fecha("el 15", "2026-08-20") === "2026-08-15", String(fecha("el 15", "2026-08-20")));

/* ── semanas que cruzan el año ───────────────────────────────────────────── */

check("racha: del 30 de diciembre al 2 de enero son cuatro días seguidos",
  s.racha(seguidos("2025-12-30", 4), "2026-01-02").dias === 4,
  JSON.stringify(s.racha(seguidos("2025-12-30", 4), "2026-01-02")));

check("media móvil: no se descuadra en el cambio de hora",
  s.mediaMovil(seguidos("2026-03-26", 8).pesos).every((p) => p.media === null || p.media === 80),
  JSON.stringify(s.mediaMovil(seguidos("2026-03-26", 8).pesos).map((p) => p.media)));

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
