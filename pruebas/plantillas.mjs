/* Plantillas de entreno: modelo, cruce con el historial y pegado masivo.

   El pegado es lo que más se prueba aquí a propósito: es la parte que recibe
   texto escrito por una persona, copiado de un Word o de un Excel, y por tanto
   la que más formas distintas tiene que aguantar sin perder una serie por el
   camino ni inventarse un peso que nadie ha escrito. */

import {
  EJEMPLO_PEGADO, MAX_EJERCICIOS, PLANTILLA_VACIA, buscarPlantilla,
  entrenoDesdePlantilla, interpretarPlantillas, plantillaDesdeEntreno,
  plantillasSanas, porOrdenPlantilla, resumenPlantilla, serieSana, ultimaDePlantilla,
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

grupo("Pegado: rangos, fallo y dropsets");
{
  const rango = uno("E\nPress 3x8-12 @80");
  check("un rango se guarda como desde-hasta",
    series(rango, 0).length === 3 && series(rango, 0).every((s) => s.reps === 8 && s.repsHasta === 12 && s.kg === 80),
    JSON.stringify(series(rango, 0)));

  const rangoSuelto = uno("E\nPress 80x8-12");
  check("y también con una sola serie",
    series(rangoSuelto, 0)[0].repsHasta === 12, JSON.stringify(series(rangoSuelto, 0)));

  const noRango = uno("E\nPress 80x8, 75x10");
  check("un guion fuera de sitio no inventa rangos",
    series(noRango, 0).every((s) => s.repsHasta === null), JSON.stringify(series(noRango, 0)));

  for (const forma of ["Press 3x10 @80 al fallo", "Press 3x10 @80 fallo", "Press 3x10 @80 AF"]) {
    const f = uno(`E\n${forma}`);
    const ss = series(f, 0);
    check(`«${forma.split("@80 ")[1]}» marca solo la última serie`,
      ss.length === 3 && !ss[0].fallo && !ss[1].fallo && ss[2].fallo,
      JSON.stringify(ss.map((x) => x.fallo)));
  }

  const drop = uno("E\nCurl 20x10 > 15x8 > 10x8");
  check("un dropset da tres escalones", series(drop, 0).length === 3, JSON.stringify(series(drop, 0)));
  check("el primero no va enlazado y los otros sí",
    series(drop, 0)[0].enlace === null && series(drop, 0)[1].enlace === "dropset" && series(drop, 0)[2].enlace === "dropset",
    JSON.stringify(series(drop, 0).map((s) => s.enlace)));
  check("en un dropset se falla en todos los escalones",
    series(drop, 0).every((s) => s.fallo), JSON.stringify(series(drop, 0).map((s) => s.fallo)));
  check("y cada escalón son KILOS por repeticiones, no un número de series",
    series(drop, 0).map((s) => `${s.kg}x${s.reps}`).join() === "20x10,15x8,10x8",
    JSON.stringify(series(drop, 0)));

  const dropPalabra = uno("E\nCurl 20x10 dropset");
  check("la palabra «dropset» sola también marca el fallo",
    series(dropPalabra, 0)[0].fallo === true, JSON.stringify(series(dropPalabra, 0)));
}

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

grupo("Los campos nuevos no se pierden en las copias");
{
  const rica = {
    nombre: "Empuje", tipo: "fuerza", id: "p1",
    ejercicios: [{ nombre: "Curl", series: [
      { kg: 20, reps: 10, repsHasta: 12, fallo: true },
      { kg: 15, reps: 8, enlace: "dropset", fallo: true },
    ] }],
  };

  const sana = plantillasSanas([rica])[0];
  check("plantillasSanas conserva el rango", sana.ejercicios[0].series[0].repsHasta === 12);
  check("conserva el fallo", sana.ejercicios[0].series[0].fallo === true);
  check("y conserva el enlace del dropset", sana.ejercicios[0].series[1].enlace === "dropset");

  const borrador = entrenoDesdePlantilla(rica, "2026-08-20", null);
  check("al abrir la plantilla siguen ahí",
    borrador.ejercicios[0].series[0].repsHasta === 12
    && borrador.ejercicios[0].series[1].enlace === "dropset",
    JSON.stringify(borrador.ejercicios[0].series));

  const vuelta = plantillaDesdeEntreno(
    { tipo: "fuerza", ejercicios: rica.ejercicios }, "Otra"
  );
  check("y al guardar un entreno como plantilla, también",
    vuelta.ejercicios[0].series[0].fallo === true
    && vuelta.ejercicios[0].series[1].enlace === "dropset",
    JSON.stringify(vuelta.ejercicios[0].series));

  check("un «hasta» menor que el «desde» no es un rango",
    serieSana({ reps: 12, repsHasta: 8 }).repsHasta === null,
    JSON.stringify(serieSana({ reps: 12, repsHasta: 8 })));
  check("un enlace inventado se descarta",
    serieSana({ reps: 8, enlace: "loquesea" }).enlace === null);
  check("y basura no revienta", serieSana(null).reps === null);
}

/* ── series por tiempo: plancha, hollow, vacío abdominal ─────────────────── */

{
  const uno = (texto) => {
    const { plantillas } = interpretarPlantillas(`Abdominales · fuerza\n${texto}`);
    return (plantillas[0] && plantillas[0].ejercicios[0]) || null;
  };

  const suelto = uno("Plancha 45s");
  check("tiempo: «Plancha 45s» es una serie de 45 segundos",
    suelto && suelto.series.length === 1 && suelto.series[0].reps === 45
    && suelto.series[0].unidad === "seg",
    JSON.stringify(suelto));
  check("tiempo: y el nombre no se queda con los segundos dentro",
    suelto && suelto.nombre === "Plancha", suelto && suelto.nombre);

  const varias = uno("Hollow 3x30 seg");
  check("tiempo: «3x30 seg» son tres series de treinta segundos",
    varias && varias.series.length === 3 && varias.series.every((s) => s.reps === 30 && s.unidad === "seg"),
    JSON.stringify(varias && varias.series));

  const rango = uno("Vacío abdominal 3x30-45s");
  check("tiempo: y el rango también vale en segundos",
    rango && rango.series.length === 3
    && rango.series[0].reps === 30 && rango.series[0].repsHasta === 45
    && rango.series[0].unidad === "seg",
    JSON.stringify(rango && rango.series));

  const conPeso = uno("Plancha con disco 3x40s @10");
  check("tiempo: se puede aguantar con peso encima",
    conPeso && conPeso.series.length === 3 && conPeso.series[0].kg === 10
    && conPeso.series[0].reps === 40 && conPeso.series[0].unidad === "seg",
    JSON.stringify(conPeso && conPeso.series));

  /* Lo que NO debe pasar: que la ese de «series» o la de un nombre acabado en
     ese conviertan un ejercicio normal en uno de tiempo. */
  const normal = uno("Press banca 3 series de 10");
  check("tiempo: «3 series de 10» siguen siendo repeticiones",
    normal && normal.series.length === 3 && normal.series[0].reps === 10
    && normal.series[0].unidad === null,
    JSON.stringify(normal && normal.series));

  const acabadoEnEse = uno("Dominadas 3x8");
  check("tiempo: un nombre acabado en ese no lo convierte en tiempo",
    acabadoEnEse && acabadoEnEse.series[0].unidad === null && acabadoEnEse.series[0].reps === 8,
    JSON.stringify(acabadoEnEse && acabadoEnEse.series));

  check("tiempo: la unidad sobrevive a la frontera",
    plantillasSanas([{ nombre: "Abs", ejercicios: [{ nombre: "Plancha", series: [{ reps: 45, unidad: "seg" }] }] }])[0]
      .ejercicios[0].series[0].unidad === "seg");
  check("tiempo: y una unidad inventada se descarta",
    serieSana({ reps: 8, unidad: "leguas" }).unidad === null);
  check("tiempo: los segundos admiten más de 999, que 20 min de plancha caben",
    serieSana({ reps: 1200, unidad: "seg" }).reps === 1200);
  check("tiempo: pero en repeticiones se sigue cortando en 999",
    serieSana({ reps: 1200 }).reps === null);
}

console.log(`\n${fallos ? "✗" : "✓"} plantillas: ${hechas - fallos}/${hechas} comprobaciones`);
process.exit(fallos ? 1 : 0);
