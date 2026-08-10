/* Pruebas del trozo que entiende español: números y fechas.

   Son funciones puras, así que aquí no hay navegador ni micrófono: se les
   pasa la frase escrita y se mira lo que sacan.

   node pruebas/lengua.mjs */

import { aNumero, buscarNumeros, leerFecha, restar, trocear, valorDigitos } from "../src/comun/lengua.js";

let fallos = 0;
const check = (n, c, extra = "") => { console.log(`${c ? "✓" : "✗"} ${n}${c ? "" : "  ← " + extra}`); if (!c) fallos++; };
const num = (f) => aNumero(f);

/* ── cifras ──────────────────────────────────────────────────────────────── */

check("cifras: un entero", num("42") === 42);
check("cifras: con decimales a la española", num("42,30") === 42.3, String(num("42,30")));
check("cifras: el punto separa miles", num("2.100") === 2100, String(num("2.100")));
check("cifras: miles y decimales juntos", num("1.234,56") === 1234.56, String(num("1.234,56")));
check("cifras: un punto que no son miles es decimal", valorDigitos("42.5") === 42.5, String(valorDigitos("42.5")));

/* ── palabras ────────────────────────────────────────────────────────────── */

check("palabras: unidades", num("siete") === 7);
check("palabras: adolescentes", num("quince") === 15);
check("palabras: veintitantos", num("veinticinco") === 25);
check("palabras: decena y unidad", num("cuarenta y dos") === 42, String(num("cuarenta y dos")));
check("palabras: centenas", num("ciento veinte") === 120, String(num("ciento veinte")));
check("palabras: cien a secas", num("cien") === 100);
check("palabras: quinientos", num("quinientos") === 500);
check("palabras: miles", num("dos mil quinientos") === 2500, String(num("dos mil quinientos")));
check("palabras: mil a secas", num("mil") === 1000);
check("palabras: mil doscientos cincuenta", num("mil doscientos cincuenta") === 1250, String(num("mil doscientos cincuenta")));
check("palabras: con tildes", num("veintidós") === 22, String(num("veintidós")));

/* ── decimales dichos ────────────────────────────────────────────────────── */

check("dicho: «con treinta» son treinta céntimos", num("cuarenta y dos con treinta") === 42.3, String(num("cuarenta y dos con treinta")));
check("dicho: «con cinco» es medio, no cinco céntimos", num("cuarenta con cinco") === 40.5, String(num("cuarenta con cinco")));
check("dicho: «con cincuenta»", num("veinte con cincuenta") === 20.5, String(num("veinte con cincuenta")));
check("dicho: «y medio»", num("ochenta y dos y medio") === 82.5, String(num("ochenta y dos y medio")));
check("dicho: «y medio» con la unidad de por medio",
  num("ochenta y dos kilos y medio") === 82.5, String(num("ochenta y dos kilos y medio")));
check("dicho: «coma» también vale", num("ochenta coma cinco") === 80.5, String(num("ochenta coma cinco")));

/* ── varios números en la misma frase ────────────────────────────────────── */

const dos = buscarNumeros(trocear("press banca 80 por 8").limpios);
check("varios: se encuentran los dos", dos.length === 2, JSON.stringify(dos.map((d) => d.valor)));
check("varios: y en orden", dos[0].valor === 80 && dos[1].valor === 8, JSON.stringify(dos.map((d) => d.valor)));

const tres = buscarNumeros(trocear("he corrido cinco kilómetros en veinticinco minutos").limpios);
check("varios: mezcla de palabras y unidades", tres.length === 2 && tres[0].valor === 5 && tres[1].valor === 25,
  JSON.stringify(tres.map((d) => d.valor)));

check("varios: dos cifras seguidas no se funden en una",
  buscarNumeros(trocear("80 8").limpios).length === 2);

/* ── fechas ──────────────────────────────────────────────────────────────── */

/* 12 de agosto de 2026 es un miércoles. Todo lo de abajo se mide desde ahí. */
const HOY = "2026-08-12";
const fecha = (f) => {
  const r = leerFecha(trocear(f).limpios, HOY);
  return r && r.fecha;
};

check("fecha: hoy", fecha("42 en el mercadona hoy") === "2026-08-12", String(fecha("42 hoy")));
check("fecha: ayer", fecha("gasté 20 ayer") === "2026-08-11", String(fecha("gasté 20 ayer")));
check("fecha: anteayer", fecha("anteayer") === "2026-08-10", String(fecha("anteayer")));
check("fecha: antes de ayer", fecha("antes de ayer") === "2026-08-10", String(fecha("antes de ayer")));
check("fecha: hace tres días", fecha("hace tres días") === "2026-08-09", String(fecha("hace tres días")));
check("fecha: hace una semana", fecha("hace una semana") === "2026-08-05", String(fecha("hace una semana")));
check("fecha: el lunes es el que pasó", fecha("el lunes") === "2026-08-10", String(fecha("el lunes")));
check("fecha: el jueves de la semana pasada", fecha("el jueves") === "2026-08-06", String(fecha("el jueves")));
check("fecha: el propio miércoles es hoy", fecha("el miércoles") === "2026-08-12", String(fecha("el miércoles")));
check("fecha: el día 3 de este mes", fecha("el 3") === "2026-08-03", String(fecha("el 3")));
check("fecha: un día que aún no ha llegado es del mes pasado",
  fecha("el 28") === "2026-07-28", String(fecha("el 28")));
check("fecha: el 3 de julio", fecha("el 3 de julio") === "2026-07-03", String(fecha("el 3 de julio")));
check("fecha: sin nada que indique cuándo, no se inventa", fecha("42 en el mercadona") === null,
  String(fecha("42 en el mercadona")));

/* Este es el que importa: un número suelto no puede convertirse en un día. */
check("fecha: «tres cañas» no es el día tres", fecha("tres cañas") === null, String(fecha("tres cañas")));

/* ── lo que sobra ────────────────────────────────────────────────────────── */

const { brutos, limpios } = trocear("he gastado 42,30 en el Mercadona ayer");
const n0 = buscarNumeros(limpios)[0];
const f0 = leerFecha(limpios, HOY);
check("sobras: queda el concepto y nada más",
  restar(brutos, [n0, f0], new Set(["he", "gastado", "en", "el"])) === "Mercadona",
  restar(brutos, [n0, f0], new Set(["he", "gastado", "en", "el"])));

check("sobras: se conservan las tildes de lo que se dijo",
  restar(trocear("cena con Martín").brutos, [], new Set(["cena", "con"])) === "Martín");

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
