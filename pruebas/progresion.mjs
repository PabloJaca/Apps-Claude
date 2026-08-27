/* Progresión de fuerza: la diferencia sesión a sesión y el veredicto.
   Lo que se comprueba aquí es sobre todo que no MIENTA: que un mal día
   aislado no se cante como retroceso, que un estancamiento se llame
   estancamiento, y que bajar el peso subiendo repeticiones no parezca ir
   hacia atrás cuando no lo es. */

import {
  MINUTOS_POR_SERIE, SESIONES_ESTANCADO, diferenciasEjercicio, minutosDeEntreno,
  progresoEjercicios, progresoPlantilla, unaRepeticion,
} from "../src/salud/nucleo.js";

let fallos = 0;
let hechas = 0;
const check = (que, ok, detalle) => {
  hechas++;
  if (ok) return;
  fallos++;
  console.error(`  ✗ ${que}${detalle === undefined ? "" : `\n      ${detalle}`}`);
};
const grupo = (t) => console.log(`\n${t}`);

/** Un entreno de fuerza con un solo ejercicio y una serie. */
const sesion = (fecha, nombre, kg, reps, extra = {}) => ({
  id: `${fecha}-${nombre}`, fecha, tipo: "fuerza", ts: 1,
  ejercicios: [{ nombre, series: [{ kg, reps }] }],
  ...extra,
});

grupo("Diferencias sesión a sesión");
{
  const entrenos = [
    sesion("2026-08-01", "Press banca", 80, 8),
    sesion("2026-08-08", "Press banca", 82.5, 8),
    sesion("2026-08-15", "Press banca", 82.5, 8),
  ];
  const d = diferenciasEjercicio(entrenos, "Press banca");

  check("una entrada por sesión", d.length === 3, String(d.length));
  check("la primera no tiene contra qué compararse", d[0].delta === null, String(d[0].delta));
  check("la segunda sube", d[1].delta > 0, JSON.stringify(d[1]));
  check("y la tercera se queda igual", d[2].delta === 0, JSON.stringify(d[2]));
  check("la diferencia en kilos de barra también sale", d[1].deltaKg === 2.5, String(d[1].deltaKg));
  check("van en orden de fecha", d.map((x) => x.fecha).join() === "2026-08-01,2026-08-08,2026-08-15");

  /* Este es el caso que no puede fallar: menos peso pero más repeticiones es
     progreso, y medido a ojo parecería lo contrario. */
  const conReps = [
    sesion("2026-08-01", "Sentadilla", 100, 5),
    sesion("2026-08-08", "Sentadilla", 95, 8),
  ];
  const dr = diferenciasEjercicio(conReps, "Sentadilla");
  check("bajar el peso subiendo repeticiones NO es un retroceso",
    dr[1].delta > 0, `${JSON.stringify(dr[1])} · ${unaRepeticion(100, 5)} → ${unaRepeticion(95, 8)}`);
  check("aunque en kilos de barra sí haya bajado", dr[1].deltaKg === -5, String(dr[1].deltaKg));

  check("sin historial no revienta", diferenciasEjercicio([], "Press banca").length === 0);
  check("un ejercicio sin kilos no entra", diferenciasEjercicio([sesion("2026-08-01", "Dominadas", null, 10)], "Dominadas").length === 0);
}

grupo("El veredicto por ejercicio");
{
  const subiendo = [
    sesion("2026-08-01", "Press banca", 80, 8),
    sesion("2026-08-08", "Press banca", 82.5, 8),
  ];
  const [p] = progresoEjercicios(subiendo);
  check("dos sesiones y subiendo se llama «sube»", p.tendencia === "sube", p.tendencia);
  check("y dice cuánto contra la mejor marca anterior", p.contraMejor > 0, String(p.contraMejor));

  /* Un mal día suelto no es un retroceso: la comparación es contra la MEJOR
     marca, no contra la sesión anterior. Pero tampoco puede llamarse «sube». */
  const malDia = [
    sesion("2026-08-01", "Press banca", 80, 8),
    sesion("2026-08-08", "Press banca", 85, 8),
    sesion("2026-08-15", "Press banca", 80, 8),
  ];
  const [m] = progresoEjercicios(malDia);
  check("un mal día suelto se llama «baja», no estancamiento", m.tendencia === "baja",
    `${m.tendencia} · sinMejorar=${m.sinMejorar}`);

  const estancado = [
    sesion("2026-08-01", "Remo", 60, 10),
    sesion("2026-08-08", "Remo", 60, 10),
    sesion("2026-08-15", "Remo", 60, 10),
    sesion("2026-08-22", "Remo", 60, 10),
  ];
  const [e] = progresoEjercicios(estancado);
  check(`${SESIONES_ESTANCADO} sesiones sin tocar la marca es «estancado»`,
    e.tendencia === "estancado", `${e.tendencia} · sinMejorar=${e.sinMejorar}`);
  check("y lo cuenta bien", e.sinMejorar >= SESIONES_ESTANCADO, String(e.sinMejorar));

  const unaSola = progresoEjercicios([sesion("2026-08-01", "Curl", 12, 12)]);
  check("con una sola sesión no se opina", unaSola.length === 0, JSON.stringify(unaSola));

  check("sin entrenos no revienta", progresoEjercicios([]).length === 0);
  check("con basura tampoco", progresoEjercicios([null, {}, { ejercicios: null }]).length === 0);
}

grupo("El orden: primero lo que pide atención");
{
  const mezcla = [
    sesion("2026-08-01", "Remo", 60, 10), sesion("2026-08-08", "Remo", 60, 10),
    sesion("2026-08-15", "Remo", 60, 10), sesion("2026-08-22", "Remo", 60, 10),
    sesion("2026-08-01", "Press banca", 80, 8), sesion("2026-08-22", "Press banca", 85, 8),
  ];
  const lista = progresoEjercicios(mezcla);
  check("lo estancado va antes que lo que sube",
    lista[0].nombre === "Remo" && lista[lista.length - 1].nombre === "Press banca",
    lista.map((x) => `${x.nombre}:${x.tendencia}`).join(" | "));
}

grupo("Progresión de una plantilla entera");
{
  const entrenos = [
    { id: "a", fecha: "2026-08-01", plantilla: "p1", tipo: "fuerza",
      ejercicios: [{ nombre: "Press", series: [{ kg: 80, reps: 8 }, { kg: 80, reps: 8 }] }] },
    { id: "b", fecha: "2026-08-08", plantilla: "p1", tipo: "fuerza",
      ejercicios: [{ nombre: "Press", series: [{ kg: 85, reps: 8 }, { kg: 85, reps: 8 }] }] },
    { id: "c", fecha: "2026-08-08", plantilla: "otra", tipo: "fuerza",
      ejercicios: [{ nombre: "Press", series: [{ kg: 200, reps: 8 }] }] },
  ];
  const pr = progresoPlantilla(entrenos, "p1");
  check("solo cuenta las sesiones de esa plantilla", pr.length === 2, JSON.stringify(pr));
  check("el volumen es kilos por repeticiones", pr[0].volumen === 1280, String(pr[0].volumen));
  check("la diferencia entre sesiones sale hecha", pr[1].delta === 80, String(pr[1].delta));
  check("la primera no tiene diferencia", pr[0].delta === null);
  check("sin id no devuelve nada", progresoPlantilla(entrenos, null).length === 0);
  check("una plantilla sin sesiones tampoco", progresoPlantilla(entrenos, "nadie").length === 0);
}

grupo("Minutos de un entreno de fuerza");
{
  /* El fallo que se veía: los entrenos apuntados antes de quitar la duración
     llevan dentro el 45 por defecto del formulario, y los nuevos no llevan
     nada. La gráfica de la semana sumaba `e.minutos` a pelo, así que los
     viejos pintaban barra y los nuevos se quedaban a cero: parecía que todos
     los entrenos se habían ido al mismo día. */
  const conSeries = (n, extra) => ({
    tipo: "fuerza", ...extra,
    ejercicios: [{ nombre: "Press", series: Array.from({ length: n }, () => ({ kg: 80, reps: 8 })) }],
  });

  check("seis series son seis veces los minutos por serie",
    minutosDeEntreno(conSeries(6)) === 6 * MINUTOS_POR_SERIE,
    String(minutosDeEntreno(conSeries(6))));
  check("el 45 fantasma de una sesión vieja no pisa a las series",
    minutosDeEntreno(conSeries(6, { minutos: 45 })) === 6 * MINUTOS_POR_SERIE,
    String(minutosDeEntreno(conSeries(6, { minutos: 45 }))));
  check("así una sesión vieja y una nueva con las mismas series miden lo mismo",
    minutosDeEntreno(conSeries(21, { minutos: 45 })) === minutosDeEntreno(conSeries(21)));
  check("y ninguna de las dos se queda en cero",
    minutosDeEntreno(conSeries(21)) > 0 && minutosDeEntreno(conSeries(21, { minutos: 45 })) > 0);

  check("sin series manda lo que se apuntó: un pádel de 90 minutos",
    minutosDeEntreno({ tipo: "equipo", minutos: 90 }) === 90);
  check("y sin series ni minutos no hay nada que contar",
    minutosDeEntreno({ tipo: "fuerza" }) === 0);
  check("una sesión larguísima se corta en tres horas",
    minutosDeEntreno(conSeries(120)) === 180, String(minutosDeEntreno(conSeries(120))));
}

console.log(`\n${fallos ? "✗" : "✓"} progresión: ${hechas - fallos}/${hechas} comprobaciones`);
process.exit(fallos ? 1 : 0);
