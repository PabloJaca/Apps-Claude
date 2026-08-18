/* Plantillas de entreno: modelo, cruce con el historial y pegado masivo.

   El pegado es lo que más se prueba aquí a propósito: es la parte que recibe
   texto escrito por una persona, copiado de un Word o de un Excel, y por tanto
   la que más formas distintas tiene que aguantar sin perder una serie por el
   camino ni inventarse un peso que nadie ha escrito. */

import {
  EJEMPLO_PEGADO, MAX_EJERCICIOS, PLANTILLA_VACIA, buscarPlantilla,
  entrenoDesdePlantilla, interpretarPlantillas, plantillaDesdeEntreno,
  plantillasSanas, porOrdenPlantilla, resumenPlantilla, ultimaDePlantilla,
} from "../src/salud/plantillas.js";

let fallos = 0;
let hechas = 0;
const check = (que, ok, detalle) => {
  hechas++;
  if (ok) return;
  fallos++;
  console.error(`  ✗ ${que}${detalle === undefined ? "" : `\n      ${detalle}`}`);
};
const grupo = (t) => console.log(`\n${t}`);

const uno = (texto) => {
  const { plantillas } = interpretarPlantillas(texto);
  return plantillas[0];
};
const series = (p, i) => (p.ejercicios[i] || {}).series || [];

/* ── el texto de ejemplo, que es el contrato con quien pega ──────────────── */

grupo("Pegado: el ejemplo que enseña la pantalla");
{
  const { plantillas, avisos } = interpretarPlantillas(EJEMPLO_PEGADO);

  check("salen las tres plantillas", plantillas.length === 3,
    plantillas.map((p) => p.nombre).join(" | "));
  check("sin avisos", avisos.length === 0, avisos.join(" · "));

  const [empuje, padel, plio] = plantillas;

  check("nombre limpio de metadatos", empuje.nombre === "Empuje", empuje.nombre);
  check("tipo leído de la cabecera", empuje.tipo === "fuerza", empuje.tipo);
  check("minutos leídos", empuje.minutos === 60, String(empuje.minutos));
  check("intensidad leída", empuje.intensidad === "fuerte", empuje.intensidad);
  check("tres ejercicios", empuje.ejercicios.length === 3,
    empuje.ejercicios.map((e) => e.nombre).join(" | "));

  check("nombre sin las series pegadas", empuje.ejercicios[0].nombre === "Press banca",
    empuje.ejercicios[0].nombre);
  check("no se pierde la primera serie", series(empuje, 0).length === 3,
    JSON.stringify(series(empuje, 0)));
  check("número grande = kilos", series(empuje, 0)[0].kg === 80 && series(empuje, 0)[0].reps === 8,
    JSON.stringify(series(empuje, 0)[0]));
  check("y la última del grupo también", series(empuje, 0)[2].kg === 75 && series(empuje, 0)[2].reps === 10,
    JSON.stringify(series(empuje, 0)[2]));

  check("con @ son series y el peso se reparte", series(empuje, 1).length === 3
    && series(empuje, 1).every((s) => s.kg === 40 && s.reps === 10),
    JSON.stringify(series(empuje, 1)));

  check("número pequeño sin peso = series sin carga", series(empuje, 2).length === 3
    && series(empuje, 2).every((s) => s.kg === null && s.reps === 12),
    JSON.stringify(series(empuje, 2)));

  check("una plantilla sin ejercicios no es fuerza", padel.tipo === "equipo", padel.tipo);
  check("el nombre sobrevive aunque dé el tipo", padel.nombre === "Pádel", padel.nombre);
  check("y conserva su duración", padel.minutos === 90, String(padel.minutos));
  check("sin ejercicios", padel.ejercicios.length === 0);

  check("tilde en el nombre", plio.nombre === "Pliometría", plio.nombre);
  check("pliometría con dos ejercicios", plio.ejercicios.length === 2);
}

/* ── notaciones sueltas ──────────────────────────────────────────────────── */

grupo("Pegado: las formas de escribir unas series");
{
  const casos = [
    ["Empuje\nPress banca 80x8", 1, [{ kg: 80, reps: 8 }], "80x8"],
    ["Empuje\nPress banca 80 x 8", 1, [{ kg: 80, reps: 8 }], "con espacios"],
    ["Empuje\nPress banca 80×8", 1, [{ kg: 80, reps: 8 }], "con la × de multiplicar"],
    ["Empuje\nDominadas 3x8", 3, [{ kg: null, reps: 8 }], "series sin peso"],
    ["Empuje\nSentadilla 3x10 @100", 3, [{ kg: 100, reps: 10 }], "peso con @"],
    ["Empuje\nSentadilla 3x10 con 100", 3, [{ kg: 100, reps: 10 }], "peso con «con»"],
    ["Empuje\nSentadilla 3x10 100kg", 3, [{ kg: 100, reps: 10 }], "peso con kg pegado"],
    ["Empuje\nSentadilla 3 series de 10 con 100", 3, [{ kg: 100, reps: 10 }], "«3 series de 10»"],
    ["Empuje\nCurl 12x15", 1, [{ kg: 12, reps: 15 }], "mancuerna de 12 kg"],
    ["Empuje\nPress 82,5x5", 1, [{ kg: 82.5, reps: 5 }], "kilos con decimal"],
  ];

  for (const [texto, cuantas, esperado, etiqueta] of casos) {
    const p = uno(texto);
    const s = series(p, 0);
    check(etiqueta,
      s.length === cuantas && s.every((x) => x.kg === esperado[0].kg && x.reps === esperado[0].reps),
      JSON.stringify(s));
  }

  const lista = uno("Empuje\nPress banca 10, 10, 8 @60");
  check("lista suelta de repeticiones", series(lista, 0).length === 3
    && series(lista, 0).every((s) => s.kg === 60)
    && series(lista, 0).map((s) => s.reps).join() === "10,10,8",
    JSON.stringify(series(lista, 0)));
  check("y el nombre no se lleva los números", lista.ejercicios[0].nombre === "Press banca",
    lista.ejercicios[0].nombre);
}

/* ── decidir qué línea es qué ────────────────────────────────────────────── */

grupo("Pegado: qué es una cabecera y qué un ejercicio");
{
  const { plantillas } = interpretarPlantillas(
    "Empuje\nPress banca 80x8\nTirón\nDominadas 3x8\nRemo 60x10"
  );
  check("una línea sin series abre plantilla", plantillas.length === 2,
    plantillas.map((p) => p.nombre).join(" | "));
  check("y los ejercicios van a la suya", plantillas[1].ejercicios.length === 2,
    plantillas[1].ejercicios.map((e) => e.nombre).join(" | "));

  const conAlmohadilla = interpretarPlantillas("# 5x5 Fuerza\nSentadilla 100x5");
  check("la almohadilla fuerza una cabecera con números",
    conAlmohadilla.plantillas.length === 1 && conAlmohadilla.plantillas[0].ejercicios.length === 1,
    JSON.stringify(conAlmohadilla.plantillas.map((p) => [p.nombre, p.ejercicios.length])));

  const viñeta = uno("Movilidad\n- Plancha\n- Gato-camello");
  check("la viñeta fuerza un ejercicio aunque no traiga series",
    viñeta.ejercicios.length === 2, JSON.stringify(viñeta.ejercicios.map((e) => e.nombre)));
  check("y se queda con una serie en blanco para rellenar",
    series(viñeta, 0).length === 1 && series(viñeta, 0)[0].reps === null,
    JSON.stringify(series(viñeta, 0)));

  check("texto vacío no da plantillas", interpretarPlantillas("").plantillas.length === 0);
  check("solo líneas en blanco tampoco", interpretarPlantillas("\n\n  \n").plantillas.length === 0);
  check("null no revienta", interpretarPlantillas(null).plantillas.length === 0);

  /* Un ejercicio antes de tener plantilla no tiene dónde ir: se convierte en
     el nombre de la primera, que es lo menos malo y lo más visible. */
  const huerfano = interpretarPlantillas("Press banca 80x8");
  check("un ejercicio suelto sin cabecera no se pierde en silencio",
    huerfano.plantillas.length === 1, JSON.stringify(huerfano.plantillas));
}

grupo("Pegado: topes");
{
  const muchas = ["Bestia"];
  for (let i = 0; i < MAX_EJERCICIOS + 5; i++) muchas.push(`Ejercicio ${i} 50x10`);
  const { plantillas, avisos } = interpretarPlantillas(muchas.join("\n"));
  check("no pasa del tope de ejercicios", plantillas[0].ejercicios.length === MAX_EJERCICIOS,
    String(plantillas[0].ejercicios.length));
  check("y lo avisa en vez de callárselo", avisos.length > 0, JSON.stringify(avisos));
}

/* ── la frontera ─────────────────────────────────────────────────────────── */

grupo("Frontera: plantillas podridas");
{
  const sanas = plantillasSanas([
    null,
    { nombre: "" },
    { nombre: "   " },
    { nombre: "Buena", tipo: "inventado", intensidad: "brutal", minutos: "sesenta", km: -4 },
    { nombre: "Con basura", ejercicios: [null, 7, { nombre: "Press", series: [null, { kg: "x", reps: 8 }] }] },
    { nombre: "Sin lista", ejercicios: "no soy una lista" },
  ]);

  check("caen las que no tienen nombre", sanas.length === 3, String(sanas.length));
  check("un tipo inventado cae a «otro»", sanas[0].tipo === "otro", sanas[0].tipo);
  check("una intensidad inventada cae a «media»", sanas[0].intensidad === "media", sanas[0].intensidad);
  check("los minutos en texto se quedan en nada", sanas[0].minutos === null, String(sanas[0].minutos));
  check("un km negativo, igual", sanas[0].km === null, String(sanas[0].km));
  check("los ejercicios que no son objetos se caen", sanas[1].ejercicios.length === 1,
    JSON.stringify(sanas[1].ejercicios));
  check("y un kg que no es número se queda en nada",
    sanas[1].ejercicios[0].series.length === 1 && sanas[1].ejercicios[0].series[0].kg === null,
    JSON.stringify(sanas[1].ejercicios[0].series));
  check("una lista de ejercicios que no es lista no rompe", Array.isArray(sanas[2].ejercicios));

  check("orden estable sin campo orden",
    [{ nombre: "B" }, { nombre: "A" }].sort(porOrdenPlantilla).map((p) => p.nombre).join("") === "AB");
  check("y con él manda el número",
    [{ nombre: "A", orden: 2 }, { nombre: "B", orden: 1 }].sort(porOrdenPlantilla)
      .map((p) => p.nombre).join("") === "BA");
  check("una plantilla sin nada no rompe el orden",
    [null, { nombre: "A" }].sort(porOrdenPlantilla).length === 2);
}

/* ── el cruce con el historial, que es la gracia de todo esto ────────────── */

grupo("Abrir una plantilla: la plantilla pone el qué, el historial el cuánto");
{
  const plantilla = {
    id: "p1", nombre: "Empuje", tipo: "fuerza", minutos: 60, intensidad: "fuerte",
    ejercicios: [
      { nombre: "Press banca", series: [{ kg: 70, reps: 8 }, { kg: 70, reps: 8 }] },
      { nombre: "Fondos", series: [{ kg: null, reps: 12 }] },
    ],
  };

  const entrenos = [
    { id: "e1", fecha: "2026-08-01", plantilla: "p1", minutos: 55,
      ejercicios: [{ nombre: "press de banca", series: [{ kg: 80, reps: 8 }, { kg: 80, reps: 7 }] }] },
    { id: "e2", fecha: "2026-08-10", plantilla: "p1", minutos: 65,
      ejercicios: [{ nombre: "Press banca", series: [{ kg: 85, reps: 6 }] }] },
    { id: "e3", fecha: "2026-08-12", plantilla: "otra", ejercicios: [] },
  ];

  const ultimo = ultimaDePlantilla(entrenos, "p1");
  check("coge la última vez de ESA plantilla", ultimo.id === "e2", ultimo && ultimo.id);
  check("y no la de otra", ultimaDePlantilla(entrenos, "nadie") === null);
  check("sin id no busca nada", ultimaDePlantilla(entrenos, null) === null);

  const borrador = entrenoDesdePlantilla(plantilla, "2026-08-18", ultimo);
  check("la fecha es la que se le pide", borrador.fecha === "2026-08-18");
  check("lleva los dos ejercicios de la plantilla", borrador.ejercicios.length === 2,
    JSON.stringify(borrador.ejercicios.map((e) => e.nombre)));
  check("el peso sale de la última vez, no de la plantilla",
    borrador.ejercicios[0].series[0].kg === 85, JSON.stringify(borrador.ejercicios[0].series));
  check("el ejercicio que no se hizo la última vez conserva el de la plantilla",
    borrador.ejercicios[1].series[0].reps === 12, JSON.stringify(borrador.ejercicios[1].series));
  check("los minutos también vienen de la última vez", borrador.minutos === 65, String(borrador.minutos));
  check("y queda apuntado de qué plantilla salió", borrador.plantilla === "p1");

  /* «press de banca» y «Press banca» son el mismo ejercicio: si el cruce se
     hiciera por texto exacto, los kilos de la última vez se perderían justo
     cuando más falta hacen. */
  const soloViejo = entrenoDesdePlantilla(plantilla, "2026-08-18", entrenos[0]);
  check("el cruce aguanta un nombre escrito distinto",
    soloViejo.ejercicios[0].series[0].kg === 80, JSON.stringify(soloViejo.ejercicios[0].series));

  const sinHistorial = entrenoDesdePlantilla(plantilla, "2026-08-18", null);
  check("sin historial se usan los pesos de la plantilla",
    sinHistorial.ejercicios[0].series[0].kg === 70);
  check("una plantilla que no existe no revienta", entrenoDesdePlantilla(null, "2026-08-18", null) === null);

  const vacia = entrenoDesdePlantilla({ ...PLANTILLA_VACIA, id: "v", nombre: "Vacía" }, "2026-08-18", null);
  check("una plantilla sin ejercicios da un entreno sin ejercicios", vacia.ejercicios.length === 0);
}

grupo("Guardar un entreno hecho como plantilla");
{
  const entreno = {
    fecha: "2026-08-12", tipo: "fuerza", minutos: 50, intensidad: "media",
    ejercicios: [{ nombre: "Sentadilla", series: [{ kg: 100, reps: 5 }] }],
  };
  const p = plantillaDesdeEntreno(entreno, "  Pierna  ");
  check("el nombre viene recortado", p.nombre === "Pierna", `«${p.nombre}»`);
  check("se lleva los ejercicios", p.ejercicios[0].series[0].kg === 100);
  check("y no se lleva la fecha", !("fecha" in p), JSON.stringify(Object.keys(p)));
  check("un entreno que no existe no revienta", plantillaDesdeEntreno(null, "x") === null);
}

grupo("Encontrar la plantilla de la que habla una frase");
{
  const lista = [
    { id: "a", nombre: "Pierna" },
    { id: "b", nombre: "Pierna pesada" },
    { id: "c", nombre: "Pádel" },
    { id: "d", nombre: "AB" },
  ];
  check("gana el nombre más largo que encaje",
    buscarPlantilla(lista, "he hecho pierna pesada hoy").id === "b");
  check("el corto también se encuentra", buscarPlantilla(lista, "hoy toca pierna").id === "a");
  check("aguanta las tildes", buscarPlantilla(lista, "he jugado al padel").id === "c");
  check("la frase entera vale", buscarPlantilla(lista, "Pierna").id === "a");
  check("no inventa cuando no hay nada", buscarPlantilla(lista, "he comido lentejas") === null);
  check("no encaja a trozos de palabra", buscarPlantilla(lista, "piernas fuertes") === null);
  check("un nombre de dos letras no se busca", buscarPlantilla(lista, "voy a ab") === null);
  check("sin lista no revienta", buscarPlantilla(null, "pierna") === null);
  check("sin texto tampoco", buscarPlantilla(lista, "") === null);
}

grupo("Resumen de una tarjeta");
{
  check("fuerza cuenta ejercicios y series",
    resumenPlantilla({ ejercicios: [{ series: [1, 2] }, { series: [1] }] }) === "2 ejercicios · 3 series",
    resumenPlantilla({ ejercicios: [{ series: [1, 2] }, { series: [1] }] }));
  check("uno solo va en singular",
    resumenPlantilla({ ejercicios: [{ series: [1] }] }) === "1 ejercicio · 1 serie");
  check("cardio cuenta km y minutos",
    resumenPlantilla({ km: 5, minutos: 30 }) === "5 km · 30 min",
    resumenPlantilla({ km: 5, minutos: 30 }));
  check("y sin nada no dice nada", resumenPlantilla({}) === "");
  check("null tampoco", resumenPlantilla(null) === "");
}

console.log(`\n${fallos ? "✗" : "✓"} plantillas: ${hechas - fallos}/${hechas} comprobaciones`);
process.exit(fallos ? 1 : 0);
