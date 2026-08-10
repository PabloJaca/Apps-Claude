/* Lo que entiende la app de Gastos cuando le dictas una frase.

   El corpus es lo importante de este archivo: son frases como se dicen, no
   como convendría que se dijeran.

   node pruebas/dictado-gastos.mjs */

import { EJEMPLOS_GASTOS, adivinarCategoria, interpretarGasto } from "../src/gastos/dictado.js";
import { categoriasIniciales } from "../src/gastos/nucleo.js";

let fallos = 0;
const check = (n, c, extra = "") => { console.log(`${c ? "✓" : "✗"} ${n}${c ? "" : "  ← " + extra}`); if (!c) fallos++; };

const HOY = "2026-08-12";

/* Un historial pequeño pero con costumbres, que es de donde sale la gracia. */
const datos = {
  categorias: categoriasIniciales(),
  gastos: [
    { id: "1", importe: 40, categoria: "comida", fecha: "2026-08-01", nota: "Mercadona" },
    { id: "2", importe: 52, categoria: "comida", fecha: "2026-08-06", nota: "Mercadona" },
    { id: "3", importe: 18, categoria: "transporte", fecha: "2026-08-04", nota: "Gasolina" },
    { id: "4", importe: 9, categoria: "ocio", fecha: "2026-08-05", nota: "Cine" },
    { id: "5", importe: 30, categoria: "salud", fecha: "2026-07-30", nota: "Fisio" },
  ],
  ingresos: [], fijos: [],
};

const i = (f) => interpretarGasto(f, datos, HOY);

/* ── el caso de todos los días ───────────────────────────────────────────── */

{
  const r = i("42,30 en el Mercadona");
  check("básico: saca el importe", r.importe === 42.3, JSON.stringify(r));
  check("básico: saca el concepto", r.nota === "Mercadona", JSON.stringify(r));
  check("básico: es un gasto", r.tipo === "gasto");
  check("básico: sin fecha dicha, hoy", r.fecha === HOY && r.dijoFecha === false);
  check("básico: la categoría sale de tu historial", r.categoria === "comida", JSON.stringify(r));
}

{
  const r = i("cuarenta y dos con treinta en el mercadona");
  check("dictado en palabras: mismo resultado", r.importe === 42.3 && r.categoria === "comida", JSON.stringify(r));
}

{
  const r = i("he gastado veinte euros de gasolina ayer");
  check("con verbo y fecha: importe", r.importe === 20, JSON.stringify(r));
  check("con verbo y fecha: ayer", r.fecha === "2026-08-11", JSON.stringify(r));
  check("con verbo y fecha: concepto limpio de relleno", r.nota === "Gasolina", JSON.stringify(r));
  check("con verbo y fecha: categoría", r.categoria === "transporte", JSON.stringify(r));
}

/* ── ingresos ────────────────────────────────────────────────────────────── */

{
  const r = i("me han ingresado la nómina, 2.100");
  check("ingreso: lo reconoce", r.tipo === "ingreso", JSON.stringify(r));
  check("ingreso: importe con punto de miles", r.importe === 2100, JSON.stringify(r));
  check("ingreso: origen nómina", r.origen === "nomina", JSON.stringify(r));
  check("ingreso: no le pone categoría de gasto", r.categoria === null);
}

check("ingreso: «me han pagado» entra", i("me han pagado 300").tipo === "ingreso");
check("gasto: «he pagado» sale", i("he pagado 300 del dentista").tipo === "gasto",
  JSON.stringify(i("he pagado 300 del dentista")));
check("ingreso: la devolución de Hacienda", i("devolución de hacienda 180").origen === "devolucion",
  JSON.stringify(i("devolución de hacienda 180")));

/* ── categorías ──────────────────────────────────────────────────────────── */

check("categoría: por el nombre de la categoría dicho tal cual",
  i("30 euros en ropa").categoria === "ropa", JSON.stringify(i("30 euros en ropa")));
check("categoría: por el diccionario cuando es la primera vez",
  i("25 en el dentista").categoria === "salud", JSON.stringify(i("25 en el dentista")));
check("categoría: el historial manda sobre el diccionario",
  i("9 en el cine").categoria === "ocio", JSON.stringify(i("9 en el cine")));
check("categoría: si no hay ni idea, se deja sin poner",
  i("15 en zzzquux").categoria === null, JSON.stringify(i("15 en zzzquux")));
check("categoría: sin categorías no revienta",
  adivinarCategoria("mercadona", { categorias: [], gastos: [] }) === null);

/* ── números y fechas juntos, que es donde se lía ────────────────────────── */

{
  const r = i("42,30 en el Mercadona el 3");
  check("mezcla: el día no se confunde con el importe", r.importe === 42.3, JSON.stringify(r));
  check("mezcla: y la fecha se entiende", r.fecha === "2026-08-03", JSON.stringify(r));
}

{
  const r = i("tres cañas, 12 euros");
  check("mezcla: «tres cañas» no es el día tres", r.fecha === HOY, JSON.stringify(r));
  check("mezcla: el importe es el mayor de los dos", r.importe === 12, JSON.stringify(r));
}

/* ── frases que no dan para nada ─────────────────────────────────────────── */

check("vacío: una frase vacía no devuelve nada", i("") === null);
check("vacío: solo ruido no inventa importe", i("pues no sé").importe === null, JSON.stringify(i("pues no sé")));
check("vacío: y la confianza lo dice", i("pues no sé").confianza <= 1, JSON.stringify(i("pues no sé")));
check("confianza: una frase completa puntúa alto", i("42,30 en el Mercadona").confianza === 3);

/* ── los ejemplos que se enseñan tienen que funcionar ────────────────────── */

for (const ej of EJEMPLOS_GASTOS) {
  const r = i(ej);
  check(`ejemplo: «${ej}» se entiende`, r && r.importe > 0 && r.confianza >= 2, JSON.stringify(r));
}

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
