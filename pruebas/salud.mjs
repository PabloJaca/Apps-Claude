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


/* ── racha de días apuntados ─────────────────────────────────────────────── */

{
  const { racha, plural, comidasFrecuentes, iso } = await import("../src/salud/nucleo.js");

  const dia = (n) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return iso(d);
  };
  const soloComidas = (fechas) => ({ pesos: [], entrenos: [], comidas: fechas.map((f) => ({ fecha: f, texto: "x" })) });

  check("racha: sin nada apuntado es cero", racha({ pesos: [], entrenos: [], comidas: [] }).dias === 0);
  check("racha: hoy y ayer son dos días", racha(soloComidas([dia(0), dia(1)])).dias === 2);
  check("racha: se corta en el hueco", racha(soloComidas([dia(0), dia(1), dia(3)])).dias === 2);
  check(
    "racha: si hoy aún no has apuntado, no se rompe todavía",
    racha(soloComidas([dia(1), dia(2), dia(3)])).dias === 3
  );
  check(
    "racha: pero perder un día entero sí la rompe",
    racha(soloComidas([dia(2), dia(3)])).dias === 0
  );
  check(
    "racha: cuenta cualquier registro, no solo comidas",
    racha({ pesos: [{ fecha: dia(0) }], entrenos: [{ fecha: dia(1) }], comidas: [] }).dias === 2
  );
  check(
    "racha: dos registros el mismo día cuentan una vez",
    racha({ pesos: [{ fecha: dia(0) }], entrenos: [{ fecha: dia(0) }], comidas: [] }).dias === 1
  );
  check("racha: dice si hoy ya está apuntado", racha(soloComidas([dia(0)])).hoy === true);

  /* ── plurales ──────────────────────────────────────────────────────────── */

  check("plural: uno va en singular", plural(1, "día") === "1 día");
  check("plural: varios llevan ese", plural(5, "día") === "5 días");
  check("plural: cero va en plural", plural(0, "día") === "0 días");
  check("plural: se puede dar el plural a mano", plural(2, "día apuntado", "días apuntados") === "2 días apuntados");

  /* ── comidas de siempre ────────────────────────────────────────────────── */

  const historial = [
    { fecha: dia(1), texto: "Café con leche y tostadas", momento: "desayuno", volumen: 3, saciedad: 2 },
    { fecha: dia(2), texto: "café con leche y TOSTADAS", momento: "desayuno", volumen: 3, saciedad: 2 },
    { fecha: dia(3), texto: "Café con leche y tostadas.", momento: "desayuno", volumen: 3, saciedad: 2 },
    { fecha: dia(4), texto: "Zumo y galletas", momento: "desayuno", volumen: 2, saciedad: 1 },
    { fecha: dia(5), texto: "Zumo y galletas", momento: "desayuno", volumen: 2, saciedad: 1 },
    { fecha: dia(2), texto: "Lentejas", momento: "comida", volumen: 3, saciedad: 3 },
    { fecha: dia(3), texto: "Lentejas", momento: "comida", volumen: 3, saciedad: 3 },
    { fecha: dia(6), texto: "Algo que probé una vez", momento: "desayuno", volumen: 3 },
    { fecha: dia(200), texto: "Lo de hace medio año", momento: "desayuno", volumen: 3 },
    { fecha: dia(201), texto: "Lo de hace medio año", momento: "desayuno", volumen: 3 },
  ];

  const desayunos = comidasFrecuentes(historial, "desayuno");
  check("frecuentes: agrupa mayúsculas, tildes y puntos como la misma comida", desayunos.length === 2, JSON.stringify(desayunos.map((d) => d.texto)));
  check("frecuentes: manda lo más repetido y reciente", desayunos[0].texto === "Café con leche y tostadas", desayunos[0] && desayunos[0].texto);
  check("frecuentes: lo probado una sola vez no sale", !desayunos.some((d) => /una vez/.test(d.texto)));
  check("frecuentes: lo de hace medio año se olvida", !desayunos.some((d) => /medio año/.test(d.texto)));
  check("frecuentes: solo del momento que se pide", comidasFrecuentes(historial, "comida").every((c) => c.momento === "comida"));
  check("frecuentes: conserva volumen y saciedad", desayunos[0].volumen === 3 && desayunos[0].saciedad === 2);
  check(
    "frecuentes: no arrastra el id ni la fecha de la comida vieja",
    desayunos.every((d) => d.id === undefined && d.fecha === undefined && d.ts === undefined),
    JSON.stringify(desayunos[0])
  );
  check("frecuentes: dice cuántas veces la has comido", desayunos[0].veces === 3, String(desayunos[0].veces));
  check("frecuentes: respeta el límite", comidasFrecuentes(historial, "desayuno", 1).length === 1);
  check("frecuentes: sin historial no revienta", comidasFrecuentes([], "desayuno").length === 0);
}


/* ── el veredicto también celebra, no solo regaña ────────────────────────── */

{
  const { valorarPeriodo } = await import("../src/salud/valoracion.js");
  const { rangoSemana, iso } = await import("../src/salud/nucleo.js");

  const [lunes] = rangoSemana(1);                 // la semana pasada, ya cerrada
  const d = (n) => { const x = new Date(lunes); x.setDate(x.getDate() + n); return iso(x); };

  const energia = { gasto: 2700, diana: 2200, margen: 150, objetivo: { id: "bajar", label: "Bajar peso", verbo: "bajar" } };

  // Semana impecable: los 7 días apuntados, 4 entrenos y el peso bajando.
  const buena = { perfil: {}, pesos: [], entrenos: [], comidas: [] };
  for (let i = 0; i < 7; i++) {
    buena.pesos.push({ fecha: d(i), kg: Number((82 - i * 0.08).toFixed(2)) });
    if (i % 2 === 0) buena.entrenos.push({ fecha: d(i), tipo: "fuerza", minutos: 55, intensidad: "media", ts: 1 });
    for (const [texto, momento] of [["Tostadas con aceite y tomate", "desayuno"],
                                    ["Pollo con arroz integral y ensalada", "comida"],
                                    ["Merluza con verduras", "cena"]]) {
      buena.comidas.push({ fecha: d(i), texto, momento, volumen: 3, saciedad: 3, ts: 1 });
    }
  }

  const v = valorarPeriodo(buena, energia, "semana", 1);
  check("semana buena: el tono es bueno", v.veredicto.tono === "bien", JSON.stringify(v.veredicto));
  check("semana buena: el titular la nombra", /Semana redonda|Buena semana/.test(v.veredicto.texto), v.veredicto.texto);
  check("semana buena: dice cifras, no vaguedades", /\d/.test(v.veredicto.texto), v.veredicto.texto);
  check("semana buena: no queda el viejo «sin nada grave»", !/sin nada grave/.test(v.veredicto.texto), v.veredicto.texto);
  check("semana buena: menciona los días apuntados", /d\u00eda/.test(v.veredicto.texto), v.veredicto.texto);

  // Semana mala: sigue regañando igual de claro.
  const mala = { perfil: {}, pesos: [{ fecha: d(0), kg: 82 }], entrenos: [], comidas: [
    { fecha: d(0), texto: "Pizza entera y cerveza", momento: "cena", volumen: 5, saciedad: 4, ts: 1 },
  ] };
  const w = valorarPeriodo(mala, energia, "semana", 1);
  check("semana mala: sigue siendo dura", w.veredicto.tono === "mal", JSON.stringify(w.veredicto));
  check("semana mala: no la celebra", !/redonda|Buena/.test(w.veredicto.texto), w.veredicto.texto);
}


/* ── tendencia y media móvil del peso ────────────────────────────────────── */

{
  const { tendenciaPeso, mediaMovil, iso } = await import("../src/salud/nucleo.js");
  const d = (n) => { const x = new Date(); x.setHours(0,0,0,0); x.setDate(x.getDate() - n); return iso(x); };

  // Baja medio kilo por semana durante tres semanas.
  const bajando = [];
  for (let i = 21; i >= 0; i -= 2) bajando.push({ fecha: d(i), kg: Number((82 - (21 - i) * 0.5 / 7).toFixed(2)) });

  const t = tendenciaPeso(bajando);
  check("tendencia: detecta que el peso baja", t && t.direccion === "baja", JSON.stringify(t));
  check("tendencia: el ritmo semanal es creíble", t && Math.abs(t.kgSemana + 0.5) < 0.12, t && String(t.kgSemana));
  check("tendencia: la previsión va por debajo del peso actual", t && t.prevision < bajando[bajando.length - 1].kg);
  check("tendencia: dice sobre cuántos días la ha calculado", t && t.dias >= 10, t && String(t.dias));

  const plano = [];
  for (let i = 21; i >= 0; i -= 2) plano.push({ fecha: d(i), kg: 80 + (i % 4 === 0 ? 0.1 : -0.1) });
  const p = tendenciaPeso(plano);
  check("tendencia: un peso plano se llama estable", p && p.direccion === "estable", JSON.stringify(p));
  check("tendencia: y entonces no inventa previsión", p && p.prevision === null);

  check("tendencia: con dos pesajes no dice nada", tendenciaPeso([{ fecha: d(1), kg: 80 }, { fecha: d(0), kg: 79 }]) === null);
  check(
    "tendencia: con cuatro pesajes de tres días tampoco, es muy poco tramo",
    tendenciaPeso([{ fecha: d(3), kg: 80 }, { fecha: d(2), kg: 79.8 }, { fecha: d(1), kg: 79.6 }, { fecha: d(0), kg: 79.4 }]) === null
  );
  check("tendencia: sin pesajes no revienta", tendenciaPeso([]) === null);

  /* Un pico absurdo no puede torcer la tendencia: pesosFiables lo aparta. */
  const conPico = [...bajando];
  conPico.splice(4, 0, { fecha: d(13), kg: 95 });
  const tp = tendenciaPeso(conPico);
  check("tendencia: un pico de báscula no la tuerce", tp && tp.direccion === "baja", JSON.stringify(tp));

  const mm = mediaMovil(bajando);
  check("media móvil: sale un punto por pesaje", mm.length === bajando.length);
  check("media móvil: los primeros no tienen media", mm[0].media === null);
  check("media móvil: los últimos sí", mm[mm.length - 1].media !== null, JSON.stringify(mm[mm.length - 1]));
  check(
    "media móvil: suaviza, no copia",
    mm[mm.length - 1].media !== mm[mm.length - 1].kg,
    `${mm[mm.length - 1].media} vs ${mm[mm.length - 1].kg}`
  );
  check("media móvil: sin pesajes devuelve lista vacía", mediaMovil([]).length === 0);
}


/* ── entrenos de fuerza: ejercicios, series y progresión ─────────────────── */

{
  const n = await import("../src/salud/nucleo.js");

  check("1RM: Epley sobre 80x8 da unos 101 kg", n.unaRepeticion(80, 8) === 101.3, String(n.unaRepeticion(80, 8)));
  check("1RM: una sola repetición es el propio peso", n.unaRepeticion(100, 1) === 103.3, String(n.unaRepeticion(100, 1)));
  check("1RM: sin peso no hay estimación", n.unaRepeticion(null, 10) === null);
  check("1RM: peso corporal no se estima", n.unaRepeticion(0, 12) === null);

  const series = [{ reps: 8, kg: 80 }, { reps: 5, kg: 90 }, { reps: 12, kg: 60 }];
  check("mejor serie: gana la de más 1RM estimado, no la de más kilos",
    n.mejorSerie(series).reps === 5 && n.mejorSerie(series).kg === 90, JSON.stringify(n.mejorSerie(series)));
  check("mejor serie: sin series no revienta", n.mejorSerie([]) === null);
  check("mejor serie: solo peso corporal no da mejor serie", n.mejorSerie([{ reps: 10, kg: null }]) === null);

  const entreno = { fecha: "2026-08-05", tipo: "fuerza", ejercicios: [
    { nombre: "Press banca", series: [{ reps: 8, kg: 80 }, { reps: 8, kg: 80 }] },
    { nombre: "Dominadas", series: [{ reps: 10, kg: null }] },
  ] };
  const r = n.resumenFuerza(entreno);
  check("resumen: cuenta ejercicios, series y repeticiones", r.ejercicios === 2 && r.series === 3 && r.reps === 26, JSON.stringify(r));
  check("resumen: el volumen son kilos por repetición", r.volumen === 1280, String(r.volumen));
  check("resumen: el peso corporal no suma kilos pero sí series", r.volumen === 80 * 8 * 2);
  check("resumen: un entreno sin ejercicios da ceros", n.resumenFuerza({ fecha: "x" }).series === 0);

  /* Tres sesiones subiendo el press banca. */
  const historial = [
    { fecha: "2026-07-01", tipo: "fuerza", ejercicios: [{ nombre: "Press banca", series: [{ reps: 8, kg: 70 }] }] },
    { fecha: "2026-07-15", tipo: "fuerza", ejercicios: [{ nombre: "press de banca", series: [{ reps: 8, kg: 75 }] }] },
    { fecha: "2026-08-01", tipo: "fuerza", ejercicios: [
      { nombre: "Press banca", series: [{ reps: 8, kg: 80 }, { reps: 6, kg: 82.5 }] },
      { nombre: "Sentadilla", series: [{ reps: 5, kg: 100 }] },
    ] },
    { fecha: "2026-08-02", tipo: "cardio", minutos: 40, km: 8 },
  ];

  check("mismo ejercicio: «Press banca» y «press de banca» son el mismo", n.mismoEjercicio("Press banca", "press de banca"));
  check("mismo ejercicio: press banca y sentadilla no", !n.mismoEjercicio("Press banca", "Sentadilla"));

  const usados = n.ejerciciosUsados(historial);
  check("usados: agrupa las variantes de escritura", usados.length === 2, JSON.stringify(usados.map((u) => u.nombre)));
  check("usados: el más repetido va primero", usados[0].veces === 3, JSON.stringify(usados[0]));
  check("usados: guarda el nombre tal como lo escribiste la última vez", usados[0].nombre === "Press banca");

  const ultima = n.ultimaVezEjercicio(historial, "PRESS BANCA");
  check("última vez: coge la sesión más reciente", ultima.fecha === "2026-08-01", JSON.stringify(ultima));
  check("última vez: trae las series para poder precargarlas", ultima.series.length === 2);
  check("última vez: un ejercicio que nunca has hecho da null", n.ultimaVezEjercicio(historial, "Peso muerto") === null);

  const prog = n.progresionEjercicio(historial, "Press banca");
  check("progresión: una entrada por sesión", prog.length === 3, String(prog.length));
  check("progresión: va en orden de fecha", prog[0].fecha === "2026-07-01" && prog[2].fecha === "2026-08-01");
  check("progresión: el 1RM estimado sube", prog[0].mejor.estimado < prog[2].mejor.estimado);
  check("progresión: suma el volumen de la sesión", prog[2].volumen === 80 * 8 + 82.5 * 6, String(prog[2].volumen));

  const rec = n.recordEjercicio(historial, "Press banca");
  /* 80x8 vale más que 82,5x6 (101,3 frente a 99,0 de 1RM estimado). Levantar
     más kilos no es siempre la mejor serie, y para eso está la fórmula. */
  check("récord: gana la mejor serie, no la de más kilos",
    rec.serie.kg === 80 && rec.serie.reps === 8 && rec.serie.estimado === 101.3, JSON.stringify(rec));
  check("récord: sabe que lo acabas de batir", rec.esElUltimo === true);
  check("récord: cuenta las sesiones", rec.sesiones === 3);
  check("récord: sin historial no revienta", n.recordEjercicio([], "Press banca") === null);

  const ult = n.ultimoEntrenoConEjercicios(historial);
  check("repetir: coge el último entreno con ejercicios", ult.fecha === "2026-08-01", JSON.stringify(ult && ult.fecha));
  check("repetir: se salta el cardio, que no tiene ejercicios", ult.tipo === "fuerza");
  check("repetir: se puede excluir el día de hoy", n.ultimoEntrenoConEjercicios(historial, "2026-08-01").fecha === "2026-07-15");
  check("repetir: sin entrenos de fuerza devuelve null", n.ultimoEntrenoConEjercicios([{ fecha: "x", tipo: "cardio" }]) === null);

  check("sugerencias: hay una lista para empezar", n.EJERCICIOS_SUGERIDOS.length > 30);
  check("sugerencias: sin repetidos", new Set(n.EJERCICIOS_SUGERIDOS).size === n.EJERCICIOS_SUGERIDOS.length);
}


/* ── meta de peso ────────────────────────────────────────────────────────── */

{
  const { progresoMeta, iso } = await import("../src/salud/nucleo.js");
  const d = (n) => { const x = new Date(); x.setHours(0,0,0,0); x.setDate(x.getDate() - n); return iso(x); };

  // De 85 a 79, meta 79: va por la mitad justa.
  const serie = [];
  for (let i = 28; i >= 0; i -= 2) serie.push({ fecha: d(i), kg: Number((85 - (28 - i) * 3 / 28).toFixed(2)) });

  const p = progresoMeta(serie, { meta: 79, metaDesde: 85 });
  check("meta: calcula el porcentaje sobre el punto de partida", p.porcentaje === 50, JSON.stringify(p));
  check("meta: dice lo que falta", p.restante === 3, String(p.restante));
  check("meta: aún no está alcanzada", p.alcanzada === false);
  check("meta: estima cuándo llegarías", p.fecha && p.fecha.semanas > 0, JSON.stringify(p.fecha));

  check("meta: sin meta puesta no devuelve nada", progresoMeta(serie, {}) === null);
  check("meta: sin pesajes tampoco", progresoMeta([], { meta: 79 }) === null);

  const alcanzada = progresoMeta([...serie, { fecha: d(0), kg: 78.5 }], { meta: 79, metaDesde: 85 });
  check("meta: al llegar lo dice", alcanzada.alcanzada === true, JSON.stringify(alcanzada));
  check("meta: y la barra se llena", alcanzada.porcentaje === 100, String(alcanzada.porcentaje));

  // Subir de peso: la barra tiene que ir igual de bien al revés.
  const subiendo = [];
  for (let i = 28; i >= 0; i -= 2) subiendo.push({ fecha: d(i), kg: Number((60 + (28 - i) * 2 / 28).toFixed(2)) });
  const ps = progresoMeta(subiendo, { meta: 64, metaDesde: 60 });
  check("meta: al subir también cuenta el avance", ps.porcentaje === 50, JSON.stringify(ps));
  check("meta: y sabe que el sentido es subir", ps.sentido === "subir");

  // Yendo al revés de la meta: no se inventa una fecha.
  const alReves = [];
  for (let i = 28; i >= 0; i -= 2) alReves.push({ fecha: d(i), kg: Number((80 + (28 - i) * 2 / 28).toFixed(2)) });
  const pr = progresoMeta(alReves, { meta: 75, metaDesde: 80 });
  check("meta: si vas al revés no da fecha", pr.fecha === null, JSON.stringify(pr.fecha));
  check("meta: y el avance no baja de cero", pr.porcentaje === 0, String(pr.porcentaje));

  // Sin metaDesde se usa el primer pesaje que haya.
  const sinDesde = progresoMeta(serie, { meta: 79 });
  check("meta: sin punto de partida usa el primer pesaje", sinDesde.desde === 85, String(sinDesde.desde));
}

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
