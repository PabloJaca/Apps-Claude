/* Pruebas de lo que decide la app de Salud: estimación de calorías con volumen
   y saciedad, control de la báscula y dureza de la valoración.
   Ejecutar con: node pruebas/salud.mjs */

import { estimarComida, valorarDia } from "../src/salud/estimador.js";
import { iso, pesosFiables, rangoSemana, revisarPeso, toleranciaPeso } from "../src/salud/nucleo.js";
import { valorarPeriodo } from "../src/salud/valoracion.js";

let fallos = 0;
const check = (nombre, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${nombre}${cond ? "" : "  ← " + extra}`);
  if (!cond) fallos++;
};

const ENERGIA = {
  gasto: 2700, diana: 2200, margen: 150,
  objetivo: { id: "bajar", label: "Bajar peso", verbo: "bajar" },
};

/* ── volumen ───────────────────────────────────────────────────────────── */

const plato = (extra) => ({ texto: "pasta con tomate", momento: "comida", volumen: 3, ...extra });
const porVolumen = [1, 2, 3, 4, 5].map((v) => estimarComida(plato({ volumen: v })).kcal);

check("el volumen escala las calorías de menos a más", porVolumen.every((k, i) => i === 0 || k > porVolumen[i - 1]), porVolumen.join(" < "));
check("volumen 1 es en torno a la mitad que volumen 3", Math.abs(porVolumen[0] / porVolumen[2] - 0.5) < 0.06, String(porVolumen[0] / porVolumen[2]));
check("volumen 5 no se dispara por encima del doble", porVolumen[4] / porVolumen[2] < 2, String(porVolumen[4] / porVolumen[2]));
check("sin volumen se asume el escalón normal", estimarComida({ texto: "pasta con tomate", momento: "comida" }).kcal === porVolumen[2]);

/* ── saciedad ──────────────────────────────────────────────────────────── */

const porSaciedad = [1, 2, 3, 4].map((s) => estimarComida(plato({ saciedad: s })).kcal);
check("más saciedad declarada sube la estimación", porSaciedad[3] > porSaciedad[0], porSaciedad.join(" "));
check("la corrección por saciedad se queda en un ajuste, no en un vuelco", porSaciedad[3] / porSaciedad[0] < 1.7, String(porSaciedad[3] / porSaciedad[0]));

const conSaciedad = estimarComida(plato({ saciedad: 2 }));
const sinSaciedad = estimarComida(plato({}));
check("declarar la saciedad estrecha el margen", conSaciedad.margen < sinSaciedad.margen, `${conSaciedad.margen} vs ${sinSaciedad.margen}`);

const aBulto = estimarComida({ texto: "lo de siempre", momento: "cena", volumen: 3 });
const aBultoConSaciedad = estimarComida({ texto: "lo de siempre", momento: "cena", volumen: 3, saciedad: 4 });
check("sin texto reconocible la saciedad pesa más", aBultoConSaciedad.kcal > aBulto.kcal * 1.15, `${aBulto.kcal} → ${aBultoConSaciedad.kcal}`);
check("lo no reconocido se marca como tal", !aBulto.reconocido && estimarComida(plato({})).reconocido);

/* ── el rango del día se estrecha ──────────────────────────────────────── */

const diaBase = [
  { texto: "café con leche y dos tostadas con aceite", momento: "desayuno" },
  { texto: "lentejas con verduras y una manzana", momento: "comida" },
  { texto: "yogur y nueces", momento: "snack" },
  { texto: "merluza a la plancha con ensalada", momento: "cena" },
];
const anchoCon = (comidas) => {
  const v = valorarDia(comidas, ENERGIA);
  return v.kcalMax - v.kcalMin;
};
const anchoSinSaciedad = anchoCon(diaBase.map((c) => ({ ...c, volumen: 3, saciedad: null })));
const anchoConSaciedad = anchoCon(diaBase.map((c, i) => ({ ...c, volumen: 3, saciedad: [2, 3, 2, 3][i] })));

check("el rango del día se estrecha al marcar la saciedad", anchoConSaciedad < anchoSinSaciedad * 0.85, `${anchoSinSaciedad} → ${anchoConSaciedad}`);
check("el rango del día no se va a cifras absurdas", anchoConSaciedad < 500, String(anchoConSaciedad));

/* ── la nota del día no premia quedarse corto ──────────────────────────── */

const notaDe = (comidas) => valorarDia(comidas, ENERGIA).nota;
const muyCorto = notaDe([{ texto: "una manzana", momento: "comida", volumen: 1, saciedad: 1 }]);
const enDiana = notaDe([
  { texto: "avena con plátano y nueces", momento: "desayuno", volumen: 3, saciedad: 3 },
  { texto: "pollo con arroz integral y ensalada", momento: "comida", volumen: 4, saciedad: 3 },
  { texto: "yogur griego", momento: "snack", volumen: 2, saciedad: 2 },
  { texto: "salmón con verduras y pan", momento: "cena", volumen: 4, saciedad: 3 },
]);
check("comer 1.800 kcal por debajo no saca buena nota", muyCorto <= 5, String(muyCorto));
check("acertar la diana con comida decente saca buena nota", enDiana >= 7, String(enDiana));

/* ── báscula: saltos imposibles ────────────────────────────────────────── */

const historial = [
  { id: "p1", fecha: "2026-08-01", kg: 92 },
  { id: "p2", fecha: "2026-08-02", kg: 92.3 },
];

check("un salto de 92 a 95 en un día se avisa", !revisarPeso(95, "2026-08-03", historial).ok);
check("una variación normal de un día no molesta", revisarPeso(93.1, "2026-08-03", historial).ok);
check("en dos semanas sí cabe un cambio grande", revisarPeso(95, "2026-08-16", historial).ok);
check("un peso imposible se rechaza", !revisarPeso(920, "2026-08-03", historial).ok);
check("un peso vacío se rechaza", !revisarPeso(0, "2026-08-03", historial).ok);
check("la tolerancia crece con los días", toleranciaPeso(92, 7) > toleranciaPeso(92, 1));

const conPico = [
  { fecha: "2026-08-01", kg: 92 },
  { fecha: "2026-08-02", kg: 91.8 },
  { fecha: "2026-08-03", kg: 95.2 }, // pico suelto
  { fecha: "2026-08-04", kg: 91.9 },
  { fecha: "2026-08-05", kg: 91.6 },
];
const filtrado = pesosFiables(conPico);
check("el pico suelto se aparta de la serie", filtrado.sospechosos.length === 1 && filtrado.sospechosos[0].kg === 95.2);

const escalon = [
  { fecha: "2026-08-01", kg: 92 },
  { fecha: "2026-08-02", kg: 91.8 },
  { fecha: "2026-08-03", kg: 95.2 },
  { fecha: "2026-08-04", kg: 95.1 }, // el cambio se mantiene: era real
  { fecha: "2026-08-05", kg: 95.3 },
];
check("un cambio que se mantiene NO se descarta", pesosFiables(escalon).sospechosos.length === 0);

/* ── la valoración dice las cosas claras ───────────────────────────────── */

/* Los datos se colocan dentro de la semana pasada, que ya está cerrada: así la
   prueba da igual el día que se ejecute. */
const [inicioPasada] = rangoSemana(1);
const dia = (n) => {
  const d = new Date(inicioPasada);
  d.setDate(d.getDate() + n);
  return iso(d);
};

const cenaFuerte = (i, momento, ts) => ({
  id: `${momento}${i}`, fecha: dia(i), texto: "pizza y dos cervezas",
  momento, volumen: 5, saciedad: 4, ts,
});

const flojo = {
  perfil: { altura: "180", edad: "31", sexo: "hombre", actividad: "activa", objetivo: "bajar" },
  pesos: [
    { id: "a", fecha: dia(0), kg: 92 },
    { id: "b", fecha: dia(3), kg: 92.4 },
    { id: "c", fecha: dia(6), kg: 92.7 },
  ],
  entrenos: [{ id: "e", fecha: dia(2), tipo: "fuerza", minutos: 45, intensidad: "media", ts: 1 }],
  comidas: [0, 1, 2, 3, 4, 5, 6].flatMap((i) => [
    cenaFuerte(i, "desayuno", 1),
    cenaFuerte(i, "comida", 2),
    cenaFuerte(i, "cena", 3),
  ]),
};

const informe = valorarPeriodo(flojo, ENERGIA, "semana", 1);
const textos = informe.avisos.map((a) => a.texto).join(" ");

check("hay veredicto y avisos", informe.hayDatos && informe.veredicto && informe.avisos.length >= 3);
check("señala que se ha entrenado poco", /entrenado 1 d|Cero entrenos/.test(textos), textos);
check("señala que se come por encima de la diana", /Te pasas|por encima de la diana/.test(textos), textos);
check("señala que el peso no acompaña", /al revés|no se mueve/.test(textos), textos);
check("el veredicto es duro cuando toca", informe.veredicto.tono === "mal", informe.veredicto.texto);
check("los avisos son cortos", informe.avisos.every((a) => a.texto.length < 190), String(Math.max(...informe.avisos.map((a) => a.texto.length))));
check("hay una única cosa que hacer al final", typeof informe.cierre === "string" && informe.cierre.length < 200);
check(
  "no pide recortes imposibles",
  !/quitando (\d\.?\d{3,})|Quita unas (\d\.?\d{3,})/.test(informe.cierre) || /Empieza quitando 500/.test(informe.cierre),
  informe.cierre
);

const bueno = {
  perfil: flojo.perfil,
  pesos: [0, 2, 4, 6].map((i) => ({ id: `p${i}`, fecha: dia(i), kg: 92 - i * 0.12 })),
  entrenos: [0, 2, 3, 5].map((i) => ({ id: `e${i}`, fecha: dia(i), tipo: "fuerza", minutos: 55, intensidad: "media", ts: i })),
  comidas: [0, 1, 2, 3, 4, 5, 6].flatMap((i) => [
    { id: `d${i}`, fecha: dia(i), texto: "avena con plátano y nueces", momento: "desayuno", volumen: 3, saciedad: 3, ts: 1 },
    { id: `m${i}`, fecha: dia(i), texto: "pollo con arroz integral y ensalada", momento: "comida", volumen: 4, saciedad: 3, ts: 2 },
    { id: `n${i}`, fecha: dia(i), texto: "salmón con verduras y pan", momento: "cena", volumen: 3, saciedad: 3, ts: 3 },
  ]),
};
const informeBueno = valorarPeriodo(bueno, ENERGIA, "semana", 1);
check("cuando todo va bien no inventa problemas", informeBueno.veredicto.tono === "bien", informeBueno.veredicto.texto + " · " + informeBueno.avisos.map((a) => `${a.area}:${a.tono}`).join(" "));

/* la báscula rota no debe contaminar el análisis */
const conBasculaRota = {
  ...bueno,
  pesos: [
    { id: "x1", fecha: dia(0), kg: 92 },
    { id: "x2", fecha: dia(1), kg: 91.9 },
    { id: "x3", fecha: dia(2), kg: 96.5 },
    { id: "x4", fecha: dia(3), kg: 91.8 },
    { id: "x5", fecha: dia(5), kg: 91.6 },
  ],
};
const informeRoto = valorarPeriodo(conBasculaRota, ENERGIA, "semana", 1);
check("avisa del pesaje que no se cree", informeRoto.avisos.some((a) => a.area === "Peso" && /no me creo/.test(a.texto)));
check("el pico no entra en el cambio de peso", Math.abs(informeRoto.cifras.peso.diferencia) < 1, String(informeRoto.cifras.peso.diferencia));
check("el ritmo semanal nunca sale disparatado", informeRoto.cifras.peso.pendiente === null || Math.abs(informeRoto.cifras.peso.pendiente) <= 2, String(informeRoto.cifras.peso.pendiente));

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
