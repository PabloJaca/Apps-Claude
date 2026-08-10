/* Lo que entiende la app de Salud cuando le dictas una frase.

   Lo primero que tiene que acertar es la pestaña: un peso, un entreno o una
   comida. Equivocarse ahí es el fallo caro, así que es lo más probado.

   node pruebas/dictado-salud.mjs */

import { EJEMPLOS_SALUD, interpretarSalud, reconocerEjercicio } from "../src/salud/dictado.js";

let fallos = 0;
const check = (n, c, extra = "") => { console.log(`${c ? "✓" : "✗"} ${n}${c ? "" : "  ← " + extra}`); if (!c) fallos++; };

const HOY = "2026-08-12";
const datos = {
  pesos: [], comidas: [],
  entrenos: [
    { fecha: "2026-08-05", tipo: "fuerza", ejercicios: [
      { nombre: "Press banca", series: [{ kg: 80, reps: 8 }] },
      { nombre: "Jaca press", series: [{ kg: 100, reps: 5 }] },
    ] },
  ],
};

/* A media tarde, para que el momento por defecto sea «snack» y se note cuándo
   lo decide la frase y cuándo el reloj. */
const i = (f) => interpretarSalud(f, datos, { hoy: HOY, ahora: 17 });

/* ── a qué pestaña va ────────────────────────────────────────────────────── */

check("ruta: un peso dicho", i("peso 82").seccion === "peso", JSON.stringify(i("peso 82")));
check("ruta: un número suelto es un peso", i("81,5 kilos").seccion === "peso", JSON.stringify(i("81,5 kilos")));
check("ruta: un entreno", i("he entrenado pecho").seccion === "entrenos", JSON.stringify(i("he entrenado pecho")));
check("ruta: una comida", i("he comido lentejas").seccion === "comidas", JSON.stringify(i("he comido lentejas")));
check("ruta: cardio va a entrenos", i("he corrido 5 km").seccion === "entrenos", JSON.stringify(i("he corrido 5 km")));
check("ruta: «80 por 8» es un entreno aunque no diga más",
  i("press banca 80 por 8").seccion === "entrenos", JSON.stringify(i("press banca 80 por 8")));
check("ruta: el peso gana cuando se dice explícitamente",
  i("peso 82 después de entrenar").seccion === "peso", JSON.stringify(i("peso 82 después de entrenar")));
check("ruta: sin señas claras se va a comidas",
  i("tortilla de patatas").seccion === "comidas", JSON.stringify(i("tortilla de patatas")));

/* ── pesos ───────────────────────────────────────────────────────────────── */

{
  const r = i("peso ochenta y dos kilos y medio");
  check("peso: entiende el «y medio»", r.kg === 82.5, JSON.stringify(r));
  check("peso: no deja basura en la nota", r.nota === "", JSON.stringify(r));
  check("peso: fecha de hoy", r.fecha === HOY);
}
check("peso: con fecha dicha", i("ayer pesé 83").fecha === "2026-08-11", JSON.stringify(i("ayer pesé 83")));
check("peso: un número imposible no se toma por peso",
  i("peso 4").seccion !== "peso", JSON.stringify(i("peso 4")));

/* ── comidas ─────────────────────────────────────────────────────────────── */

{
  const r = i("he comido pasta con pollo, bastante lleno");
  check("comida: el texto es lo que se comió", /pasta/i.test(r.texto) && /pollo/i.test(r.texto), JSON.stringify(r));
  check("comida: «bastante» son cuatro de volumen", r.volumen === 4, JSON.stringify(r));
  check("comida: «lleno» son tres de saciedad", r.saciedad === 3, JSON.stringify(r));
  check("comida: «he comido» fija el momento", r.momento === "comida", JSON.stringify(r));
  check("comida: no se cuela «bastante» en el texto", !/bastante/i.test(r.texto), JSON.stringify(r));
}

check("comida: el desayuno se reconoce", i("he desayunado tostadas").momento === "desayuno");
check("comida: la cena también", i("he cenado sopa").momento === "cena");
check("comida: sin decirlo, lo pone el reloj", i("un yogur").momento === "snack", JSON.stringify(i("un yogur")));
check("comida: «muy poco» gana a «poco»", i("he comido muy poco").volumen === 1, JSON.stringify(i("he comido muy poco")));
check("comida: «un montón» son cinco", i("he cenado un montón").volumen === 5, JSON.stringify(i("he cenado un montón")));
check("comida: sin decir cantidad, normal", i("he comido arroz").volumen === 3);
check("comida: y se sabe que no lo dijo", i("he comido arroz").dijoVolumen === false);
check("comida: «me he quedado con hambre»", i("he cenado una ensalada, me he quedado con hambre").saciedad === 1,
  JSON.stringify(i("he cenado una ensalada, me he quedado con hambre")));

/* ── entrenos de fuerza ──────────────────────────────────────────────────── */

{
  const r = i("press banca 80 por 8 y 80 por 6");
  check("fuerza: es de fuerza", r.tipo === "fuerza", JSON.stringify(r));
  check("fuerza: un solo ejercicio", r.ejercicios.length === 1, JSON.stringify(r));
  check("fuerza: con sus dos series", r.ejercicios[0].series.length === 2, JSON.stringify(r));
  check("fuerza: kilos y repeticiones en su sitio",
    r.ejercicios[0].series[0].kg === 80 && r.ejercicios[0].series[0].reps === 8, JSON.stringify(r));
  check("fuerza: reconoce el nombre del ejercicio",
    r.ejercicios[0].nombre === "Press banca", JSON.stringify(r));
}

{
  const r = i("sentadilla 100 por 5, press militar 40 por 10");
  check("fuerza: la coma separa ejercicios", r.ejercicios.length === 2, JSON.stringify(r));
  check("fuerza: y cada uno con lo suyo",
    r.ejercicios[0].nombre === "Sentadilla" && r.ejercicios[1].nombre === "Press militar", JSON.stringify(r));
}

{
  const r = i("3 series de 10 con 60 en curl con barra");
  check("fuerza: «3 series de 10 con 60» son tres series", r.ejercicios[0].series.length === 3, JSON.stringify(r));
  check("fuerza: con sus repeticiones y sus kilos",
    r.ejercicios[0].series[0].reps === 10 && r.ejercicios[0].series[0].kg === 60, JSON.stringify(r));
}

check("fuerza: prefiere el ejercicio que ya has hecho tú",
  reconocerEjercicio("jaca press 100 por 5", datos.entrenos) === "Jaca press",
  String(reconocerEjercicio("jaca press 100 por 5", datos.entrenos)));
check("fuerza: el nombre más largo gana al más corto",
  reconocerEjercicio("press inclinado 60 por 10", []) === "Press inclinado",
  String(reconocerEjercicio("press inclinado 60 por 10", [])));
check("fuerza: lo que no conoce no lo inventa",
  reconocerEjercicio("zzzquux", []) === null);

/* ── cardio ──────────────────────────────────────────────────────────────── */

{
  const r = i("he corrido cinco kilómetros en veinticinco minutos");
  check("cardio: es de cardio", r.tipo === "cardio", JSON.stringify(r));
  check("cardio: los kilómetros", r.km === 5, JSON.stringify(r));
  check("cardio: los minutos", r.minutos === 25, JSON.stringify(r));
  check("cardio: no le inventa ejercicios", r.ejercicios.length === 0, JSON.stringify(r));
}
check("cardio: «una hora y media» son noventa minutos",
  i("he salido en bici una hora y media").minutos === 90, JSON.stringify(i("he salido en bici una hora y media")));
check("cardio: el pádel es de equipo", i("he jugado al pádel una hora").tipo === "equipo",
  JSON.stringify(i("he jugado al pádel una hora")));

/* ── intensidad y fechas ─────────────────────────────────────────────────── */

check("entreno: «a tope» es fuerte", i("he entrenado piernas a tope").intensidad === "fuerte",
  JSON.stringify(i("he entrenado piernas a tope")));
check("entreno: con fecha dicha", i("ayer entrené espalda").fecha === "2026-08-11",
  JSON.stringify(i("ayer entrené espalda")));

/* ── nada ────────────────────────────────────────────────────────────────── */

check("vacío: una frase vacía no devuelve nada", i("") === null);

/* ── los ejemplos que se enseñan ─────────────────────────────────────────── */

for (const ej of EJEMPLOS_SALUD) {
  const r = i(ej);
  const util =
    (r.seccion === "peso" && r.kg > 0) ||
    (r.seccion === "comidas" && r.texto.length > 1) ||
    (r.seccion === "entrenos" && (r.ejercicios.length > 0 || r.km > 0 || r.minutos > 0));
  check(`ejemplo: «${ej}» se entiende`, util, JSON.stringify(r));
}

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
