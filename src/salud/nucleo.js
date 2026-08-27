/* ─────────────────────────────────────────────────────────────────────────
   Salud · núcleo: modelo, fechas, perfil energético y migración.
   ───────────────────────────────────────────────────────────────────────── */

import { nuevoId } from "../comun/id.js";

/** Colecciones de Firestore que usa esta app: usuarios/{uid}/<nombre>/{id}. */
export const COLECCIONES = ["pesos", "entrenos", "comidas", "plantillas"];

export const PERFIL_VACIO = { altura: "", edad: "", sexo: "", actividad: "", objetivo: "" };

/** Lo que la app espera tener en pantalla mientras Firestore aún no ha hablado. */
export const VACIO = { perfil: PERFIL_VACIO, pesos: [], entrenos: [], comidas: [], plantillas: [] };

/* ── catálogos ───────────────────────────────────────────────────────────── */

export const ACTIVIDADES = [
  { id: "sedentaria", label: "Sedentaria", factor: 1.2, desc: "Trabajo sentado, poco movimiento" },
  { id: "ligera", label: "Ligera", factor: 1.375, desc: "Algo de movimiento o 1-3 entrenos" },
  { id: "activa", label: "Activa", factor: 1.55, desc: "En pie o 3-5 entrenos por semana" },
  { id: "muy_activa", label: "Muy activa", factor: 1.725, desc: "Trabajo físico o 6-7 entrenos" },
];

export const OBJETIVOS = [
  { id: "bajar", label: "Bajar peso", ajuste: -500, verbo: "bajar" },
  { id: "mantener", label: "Mantener", ajuste: 0, verbo: "mantener" },
  { id: "subir", label: "Subir peso", ajuste: 350, verbo: "subir" },
];
export const objetivoDe = (id) => OBJETIVOS.find((o) => o.id === id) || OBJETIVOS[1];

export const SEXOS = [
  { id: "hombre", label: "Hombre" },
  { id: "mujer", label: "Mujer" },
  { id: "nd", label: "Prefiero no decirlo" },
];

/* Cuánta comida había en el plato. Sustituye al viejo poco / normal / mucho:
   con cinco escalones el multiplicador es mucho más fino. */
export const VOLUMENES = [
  { n: 1, label: "Muy poco", desc: "Un picoteo", factor: 0.5 },
  { n: 2, label: "Poco", desc: "Menos de lo normal", factor: 0.75 },
  { n: 3, label: "Normal", desc: "Tu ración de siempre", factor: 1 },
  { n: 4, label: "Bastante", desc: "Repetiste o ración grande", factor: 1.35 },
  { n: 5, label: "Mucho", desc: "Hasta arriba", factor: 1.75 },
];
export const volumenDe = (n) => VOLUMENES.find((v) => v.n === n) || VOLUMENES[2];

/* Cómo te dejó. Es la segunda opinión: si el texto dice una cosa y el cuerpo
   dice otra, la estimación se corrige y el rango se abre o se cierra. */
export const SACIEDADES = [
  { n: 1, label: "Con hambre", desc: "Te quedaste corto" },
  { n: 2, label: "Justo", desc: "Ni hambre ni lleno" },
  { n: 3, label: "Lleno", desc: "Saciado del todo" },
  { n: 4, label: "Muy lleno", desc: "Te costó levantarte" },
];
export const saciedadDe = (n) => SACIEDADES.find((s) => s.n === n) || null;

export const DURACIONES = [20, 30, 45, 60, 90];

/* Un kilo de grasa son unas 7.700 kcal: sirve para traducir déficit en peso. */
export const KCAL_POR_KILO = 7700;

/* Objetivo de entrenos por semana con el que se juzga el periodo. */
export const ENTRENOS_SEMANA = 4;

/* ── fechas ──────────────────────────────────────────────────────────────── */

export const iso = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const hoy = () => iso(new Date());
export const desdeIso = (s) => {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export const fechaCorta = (s) => {
  const d = desdeIso(s);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

export const etiquetaFecha = (s) => {
  if (s === hoy()) return "Hoy";
  const a = new Date();
  a.setDate(a.getDate() - 1);
  if (s === iso(a)) return "Ayer";
  const d = desdeIso(s);
  return `${DIAS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MESES[d.getMonth()]}`;
};

export const inicioSemana = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

export const enRango = (f, desde) => desdeIso(f) >= desde;

export const rangoSemana = (offset = 0) => {
  const a = inicioSemana();
  a.setDate(a.getDate() - 7 * offset);
  const b = new Date(a);
  b.setDate(b.getDate() + 6);
  return [a, b];
};

export const rangoMes = (offset = 0) => {
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  a.setDate(1);
  a.setMonth(a.getMonth() - offset);
  const b = new Date(a);
  b.setMonth(b.getMonth() + 1);
  b.setDate(0);
  return [a, b];
};

export const enTramo = (f, [a, b]) => {
  const d = desdeIso(f);
  return d >= a && d <= b;
};

export const cerrado = ([, b]) => {
  const hoyD = new Date();
  hoyD.setHours(0, 0, 0, 0);
  return b < hoyD;
};

/** Días del tramo que ya han pasado (para no juzgar una semana a medias). */
export const diasTranscurridos = ([a, b]) => {
  const hoyD = new Date();
  hoyD.setHours(0, 0, 0, 0);
  const fin = b < hoyD ? b : hoyD;
  return Math.max(1, Math.round((fin - a) / 86400000) + 1);
};

export const etiquetaTramo = (periodo, offset) => {
  if (periodo === "semana") {
    const [a, b] = rangoSemana(offset);
    if (offset === 0) return "Esta semana";
    if (offset === 1) return "Semana pasada";
    return `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]}`;
  }
  const [a] = rangoMes(offset);
  if (offset === 0) return "Este mes";
  const nombre = MESES_LARGOS[a.getMonth()];
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}${
    a.getFullYear() !== new Date().getFullYear() ? ` ${a.getFullYear()}` : ""
  }`;
};

export const detalleTramo = (periodo, offset) => {
  const [a, b] = periodo === "semana" ? rangoSemana(offset) : rangoMes(offset);
  return `${a.getDate()} ${MESES[a.getMonth()]} – ${b.getDate()} ${MESES[b.getMonth()]}`;
};

/* ── higiene de los registros ────────────────────────────────────────────── */

/**
 * Los registros con los que se puede trabajar: los que existen y llevan fecha.
 *
 * Todo lo de esta app se ordena y se agrupa por fecha, así que un registro sin
 * ella no es que dé un resultado raro: rompe el `sort` y deja la pantalla en
 * blanco. Se filtran una vez al entrar y ya nadie más tiene que preocuparse.
 *
 * No debería llegar ninguno —las reglas de Firestore exigen la fecha—, pero
 * una pantalla en blanco es un precio demasiado alto para confiarse.
 */
export const conFecha = (lista) =>
  (lista || []).filter((r) => r && typeof r.fecha === "string" && r.fecha.length === 10);

/**
 * Pesajes con un peso de verdad.
 *
 * `conFecha` vale para comidas y entrenos, pero a un pesaje le falta lo
 * principal: que `kg` sea un número. Un «80» guardado como texto atravesaba la
 * frontera y llegaba hasta la tendencia, donde `.toFixed` de una cadena tumba
 * la pestaña entera. Lo mismo que hace Gastos con el importe.
 */
export const pesosSanos = (lista) =>
  conFecha(lista).filter((p) => Number.isFinite(Number(p.kg)) && Number(p.kg) > 0)
    .map((p) => (typeof p.kg === "number" ? p : { ...p, kg: Number(p.kg) }));

/**
 * Entrenos con la forma que la pantalla espera.
 *
 * Un ejercicio sin `series` no daba un hueco: rompía el `map` y tumbaba la
 * pestaña entera. Se normaliza aquí, una vez, en vez de poner un `|| []` en
 * cada sitio que los dibuja y confiar en no olvidarse de ninguno.
 */
export const saneaEntrenos = (lista) =>
  conFecha(lista).map((e) => {
    if (!e.ejercicios) return e;
    const ejercicios = (Array.isArray(e.ejercicios) ? e.ejercicios : [])
      .filter((ej) => ej && typeof ej === "object")
      .map((ej) => ({
        ...ej,
        nombre: String(ej.nombre || "Sin nombre"),
        series: (Array.isArray(ej.series) ? ej.series : []).filter((x) => x && typeof x === "object"),
      }));
    return { ...e, ejercicios };
  });

/** Comparador por fecha que aguanta lo que le echen. */
export const porFecha = (a, b) => String((a && a.fecha) || "").localeCompare(String((b && b.fecha) || ""));

/* ── formato ─────────────────────────────────────────────────────────────── */

/**
 * «1 días apuntados» delata que detrás hay una plantilla y no alguien
 * escribiendo. Se pasa siempre por aquí:  plural(1, "día") → "1 día".
 * El plural por defecto es añadir una ese, y se puede dar a mano cuando no.
 */
export function plural(n, singular, muchos) {
  return `${n} ${n === 1 ? singular : muchos || `${singular}s`}`;
}

export const num = (n, dec = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : Number(n).toFixed(dec).replace(".", ",");
/** Kilos como se dicen: «70», no «70,0»; pero «77,5» cuando toca. */
export const pesoCorto = (n) =>
  n === null || n === undefined || Number.isNaN(Number(n)) ? "—" : String(Number(n)).replace(".", ",");

export const miles = (n) => (n === null || n === undefined ? "—" : Math.round(n).toLocaleString("es-ES"));

/* ── energía ─────────────────────────────────────────────────────────────── */

/** Mifflin-St Jeor por el factor de actividad. Estimación de partida, no medida. */
export function calcularEnergia(perfil, pesoKg) {
  const altura = parseFloat(perfil.altura);
  const edad = parseFloat(perfil.edad);
  const act = ACTIVIDADES.find((a) => a.id === perfil.actividad);
  if (!(altura > 0) || !(edad > 0) || !act || !(pesoKg > 0) || !perfil.objetivo) return null;

  const base = 10 * pesoKg + 6.25 * altura - 5 * edad;
  const bmr = perfil.sexo === "mujer" ? base - 161 : perfil.sexo === "hombre" ? base + 5 : base - 78;
  const gasto = bmr * act.factor;

  const obj = objetivoDe(perfil.objetivo);
  const suelo = Math.max(bmr, perfil.sexo === "mujer" ? 1200 : 1500);
  const diana = Math.max(suelo, gasto + obj.ajuste);

  return {
    bmr: Math.round(bmr),
    gasto: Math.round(gasto),
    diana: Math.round(diana),
    margen: 150,
    objetivo: obj,
    ajustado: gasto + obj.ajuste < suelo,
  };
}

/* ── lo que se come el entreno ───────────────────────────────────────────── */

/**
 * Lo que quema una sesión, en METs.
 *
 * Un MET es lo que gastas parado. Correr a ritmo medio son unos 8,5: gastas
 * ocho veces y media más que sentado. La cuenta es MET × kg × horas, y para
 * saber lo que el entreno SUMA hay que restarle ese uno, porque esa hora ibas
 * a estar vivo de todas formas y ya la cuenta el gasto diario.
 */
const METS = {
  fuerza: { suave: 3.5, media: 5, fuerte: 6 },
  cardio: { suave: 6, media: 8.5, fuerte: 11 },
  equipo: { suave: 5, media: 7, fuerte: 9 },
  otro: { suave: 3, media: 4.5, fuerte: 6 },
};

/**
 * Cuánto de lo que quema el entreno hay que sumar de verdad.
 *
 * Aquí está el detalle que casi todas las apps se saltan: el nivel de
 * actividad del perfil YA incluye entrenos —«Activa» dice literalmente «3-5
 * entrenos por semana»—, así que sumar la sesión entera es contarla dos veces
 * y acabas comiendo de más creyendo que lo compensas.
 *
 * Se suma solo la parte que el multiplicador no había contado ya: casi toda si
 * te declaraste sedentario, y bastante poca si te declaraste muy activo.
 */
const DESCUENTO = { sedentaria: 1, ligera: 0.8, activa: 0.45, muy_activa: 0.25 };

export function kcalEntreno(entreno, pesoKg) {
  const kg = Number(pesoKg);
  /* Medidos si los hay; estimados a partir de las series si no. Los entrenos
     de fuerza ya no piden duración, y sin esto sumarían cero. */
  const minutos = minutosDeEntreno(entreno);
  if (!(kg > 0) || !(minutos > 0)) return 0;

  const porTipo = METS[(entreno && entreno.tipo) || "otro"] || METS.otro;
  const met = porTipo[(entreno && entreno.intensidad) || "media"] || porTipo.media;

  // El −1 es lo de estar vivo, que ya está contado en el gasto del día.
  return Math.round((met - 1) * kg * (minutos / 60));
}

/** Lo que suman todos los entrenos de un día, ya descontado el doble conteo. */
export function extraPorEntrenos(entrenos, pesoKg, actividad) {
  const bruto = (entrenos || []).reduce((s, e) => s + kcalEntreno(e, pesoKg), 0);
  if (!bruto) return { bruto: 0, extra: 0, descuento: 1 };
  const descuento = DESCUENTO[actividad] != null ? DESCUENTO[actividad] : 0.45;
  return { bruto, extra: Math.round(bruto * descuento), descuento };
}

/**
 * La diana del día, con el entreno de ese día ya sumado.
 *
 * Se devuelve por separado lo que viene del perfil y lo que viene de haber
 * entrenado, para poder enseñarlo: «2.288 + 310 por el entreno». Un número que
 * cambia solo y no dice por qué no se lo cree nadie.
 */
export function energiaDelDia(energia, entrenosDelDia, pesoKg, perfil) {
  if (!energia) return null;
  const { bruto, extra, descuento } = extraPorEntrenos(entrenosDelDia, pesoKg, perfil && perfil.actividad);
  return {
    ...energia,
    diana: energia.diana + extra,
    gasto: energia.gasto + extra,
    extraEntreno: extra,
    brutoEntreno: bruto,
    descuentoEntreno: descuento,
  };
}

/* ── entrenos de fuerza: ejercicios y series ─────────────────────────────── */

/* Sugerencias para no tener que escribir a pelo la primera vez. Viven en el
   código, no en la base de datos: son una ayuda al escribir, no datos tuyos.
   Lo que se guarda es el nombre que acabes poniendo. */
/* Los ocho que se ofrecen cuando aún no has escrito nada ni tienes historial:
   uno por patrón de movimiento, no los ocho primeros de la lista de abajo, que
   resultan ser todos de empuje. */
export const EJERCICIOS_HABITUALES = [
  "Sentadilla", "Press banca", "Peso muerto", "Dominadas",
  "Press militar", "Remo con barra", "Prensa", "Curl con barra",
];

export const EJERCICIOS_SUGERIDOS = [
  // empuje
  "Press banca", "Press inclinado", "Press militar", "Press mancuernas",
  "Fondos", "Flexiones", "Aperturas", "Extensión de tríceps", "Press francés",
  // tirón
  "Dominadas", "Jalón al pecho", "Remo con barra", "Remo con mancuerna",
  "Remo en polea", "Face pull", "Curl con barra", "Curl con mancuernas",
  "Curl martillo", "Encogimientos",
  // pierna
  "Sentadilla", "Sentadilla frontal", "Prensa", "Peso muerto",
  "Peso muerto rumano", "Zancadas", "Búlgaras", "Extensión de cuádriceps",
  "Curl femoral", "Hip thrust", "Gemelos", "Abductores",
  // core y otros
  "Plancha", "Elevación de piernas", "Rueda abdominal", "Crunch",
  "Remo al mentón", "Elevaciones laterales", "Pájaros", "Pull over",
];

/* Las palabras de relleno se caen al comparar: «Press banca» y «press de
   banca» son el mismo ejercicio y no pueden partir la progresión en dos. Lo
   que distingue de verdad —barra, mancuernas, polea, inclinado— se queda. */
const RELLENO = new Set(["de", "del", "la", "el", "los", "las", "con", "en", "a", "al", "y"]);

/* Exportada porque las plantillas cruzan sus ejercicios con los del
   historial por este mismo nombre normalizado. */
export const huellaEjercicio = (nombre) =>
  huella(nombre).split(" ").filter((p) => p && !RELLENO.has(p)).join(" ");

/** Si dos nombres se refieren al mismo ejercicio. */
export const mismoEjercicio = (a, b) => huellaEjercicio(a) === huellaEjercicio(b);

/** Estimación de tu máximo a una repetición (Epley). Sirve para comparar
    series desiguales: 80×8 y 90×5 no se pueden mirar a ojo. */
export function unaRepeticion(kg, reps) {
  if (!(kg > 0) || !(reps > 0)) return null;
  return Number((kg * (1 + reps / 30)).toFixed(1));
}

/*
 * Una serie puede ser de cuatro maneras, y todas caben en el mismo objeto:
 *
 *   { kg, reps }                     la de siempre
 *   { kg, reps, repsHasta }          un rango: «8 a 12», que es un objetivo
 *   { kg, reps, fallo: true }        llevada al fallo
 *   { kg, reps, enlace: "dropset" }  continúa la anterior sin descanso
 *   { reps, unidad: "seg" }          se aguanta un rato: plancha, hollow
 *
 * La serie por tiempo guarda los segundos en el mismo campo que las
 * repeticiones y se distingue por `unidad`. Así todo lo que contaba series
 * sigue contándolas; lo que hay que mirar es quién suma repeticiones, porque
 * 45 segundos de plancha no son 45 repeticiones, y quién estima un 1RM,
 * porque de aguantar un peso quieto no sale ninguno.
 *
 * El dropset se guarda plano, como series consecutivas enlazadas, en vez de
 * anidar una lista dentro de otra. Anidado obligaría a tocar el volumen, la
 * mejor serie, la progresión y las reglas de Firestore; plano, todo lo que ya
 * sabía sumar series lo sigue sabiendo, y lo único que cambia es cómo se pinta.
 */

/** Los escalones de un dropset son series de verdad, no adornos. */
export const esEnlazada = (s) => Boolean(s && s.enlace === "dropset");

/** Una serie que se aguanta un rato en vez de contarse a repeticiones. */
export const enTiempo = (s) => Boolean(s && s.unidad === "seg");

/** Cómo se lee una serie. Vale para la lista, para la ficha y para el resumen. */
export function textoSerie(s) {
  if (!s) return "";
  const cifra = s.repsHasta && s.repsHasta !== s.reps ? `${s.reps}-${s.repsHasta}` : `${s.reps ?? "—"}`;
  const carga = s.kg != null && s.kg !== "" ? `${pesoCorto(s.kg)}×` : "";
  return `${carga}${cifra}${enTiempo(s) ? "s" : ""}${s.fallo ? " AF" : ""}`;
}

/**
 * Minutos de un entreno, medidos o estimados.
 *
 * La duración dejó de pedirse en los entrenos de fuerza: lo que describe una
 * sesión de pesas son las series, no el rato que estuviste allí. Pero la
 * estimación de calorías del día se apoyaba en los minutos, así que sin ellos
 * un día de pesas pasaba a sumar cero y la diana de comer salía baja.
 *
 * Se estiman a partir de las series, que es el dato que sí hay. Tres minutos
 * por serie es el número redondo del gimnasio: la serie y su descanso.
 */
export const MINUTOS_POR_SERIE = 3;

export function minutosDeEntreno(entreno) {
  const dados = Number(entreno && entreno.minutos);
  if (dados > 0) return dados;

  const ejercicios = entreno && entreno.ejercicios;
  const series = (Array.isArray(ejercicios) ? ejercicios : [])
    .reduce((n, ej) => n + (Array.isArray(ej && ej.series) ? ej.series.length : 0), 0);
  if (!series) return 0;
  return Math.min(180, series * MINUTOS_POR_SERIE);
}

/** La serie que más vale de un ejercicio, medida por 1RM estimado. */
export function mejorSerie(series) {
  let mejor = null;
  for (const s of series || []) {
    // De aguantar un peso quieto no sale un máximo a una repetición.
    if (enTiempo(s)) continue;
    const e = unaRepeticion(s.kg, s.reps);
    if (e !== null && (!mejor || e > mejor.estimado)) mejor = { ...s, estimado: e };
  }
  return mejor;
}

/** Series, repeticiones y kilos movidos de un entreno. Se calcula, no se guarda. */
export function resumenFuerza(entreno) {
  let series = 0;
  let reps = 0;
  let volumen = 0;
  let segundos = 0;
  for (const ej of (entreno && entreno.ejercicios) || []) {
    for (const s of ej.series || []) {
      series++;
      /* Los segundos de plancha van a su propio contador: sumarlos a las
         repeticiones daría «21 series · 180 repeticiones» por tres minutos de
         abdominales, y multiplicarlos por los kilos inflaría el volumen. */
      if (enTiempo(s)) {
        segundos += Number(s.reps) || 0;
        continue;
      }
      reps += Number(s.reps) || 0;
      // El peso corporal no suma kilos, pero la serie y las reps sí cuentan.
      if (s.kg > 0) volumen += s.kg * (Number(s.reps) || 0);
    }
  }
  return {
    ejercicios: ((entreno && entreno.ejercicios) || []).length,
    series, reps, segundos, volumen: Math.round(volumen),
  };
}

/**
 * El resumen de un entreno de fuerza en una línea.
 *
 * Estaba escrito igual en dos pantallas, así que los segundos habrían llegado
 * a una y no a la otra. Lo que no hay no se enseña: un día solo de plancha no
 * tiene por qué decir «0 repeticiones».
 */
export function textoResumenFuerza(r) {
  if (!r || !r.series) return "";
  const trozos = [plural(r.series, "serie")];
  if (r.reps) trozos.push(plural(r.reps, "repetición", "repeticiones"));
  if (r.segundos) {
    trozos.push(r.segundos >= 120
      ? `${num(r.segundos / 60, 0)} min aguantados`
      : `${r.segundos} s aguantados`);
  }
  if (r.volumen) trozos.push(`${miles(r.volumen)} kg movidos`);
  return trozos.join(" · ");
}

/** Los ejercicios que ya has hecho, para el autocompletado y para repetirlos. */
export function ejerciciosUsados(entrenos) {
  const mapa = new Map();
  for (const e of entrenos || []) {
    if (!e || typeof e !== "object") continue;
    for (const ej of e.ejercicios || []) {
      if (!ej || typeof ej !== "object") continue;
      const clave = huellaEjercicio(ej.nombre);
      if (!clave) continue;
      const previo = mapa.get(clave);
      if (!previo) {
        mapa.set(clave, { nombre: ej.nombre, veces: 1, fecha: e.fecha, series: ej.series || [] });
      } else {
        previo.veces++;
        if (e.fecha > previo.fecha) {
          previo.fecha = e.fecha;
          previo.nombre = ej.nombre;      // como lo escribes últimamente
          previo.series = ej.series || [];
        }
      }
    }
  }
  return [...mapa.values()].sort((a, b) => b.veces - a.veces || b.fecha.localeCompare(a.fecha));
}

/** Cómo hiciste este ejercicio la última vez: sirve para precargar los pesos. */
export function ultimaVezEjercicio(entrenos, nombre) {
  const clave = huellaEjercicio(nombre);
  let mejor = null;
  for (const e of entrenos || []) {
    for (const ej of e.ejercicios || []) {
      if (huellaEjercicio(ej.nombre) !== clave) continue;
      if (!mejor || e.fecha > mejor.fecha) mejor = { fecha: e.fecha, series: ej.series || [] };
    }
  }
  return mejor;
}

/** El último entreno de fuerza con ejercicios, para poder repetirlo entero. */
export function ultimoEntrenoConEjercicios(entrenos, excluirFecha) {
  return [...(entrenos || [])]
    .filter((e) => (e.ejercicios || []).length && e.fecha !== excluirFecha)
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.ts || 0) - (a.ts || 0))[0] || null;
}

/**
 * Cómo ha ido un ejercicio en el tiempo: una entrada por día, con la mejor
 * serie y los kilos movidos. Es lo que responde «¿estoy progresando?».
 */
export function progresionEjercicio(entrenos, nombre) {
  const clave = huellaEjercicio(nombre);
  const porFecha = new Map();
  for (const e of entrenos || []) {
    for (const ej of e.ejercicios || []) {
      if (huellaEjercicio(ej.nombre) !== clave) continue;
      const mejor = mejorSerie(ej.series);
      let volumen = 0;
      for (const s of ej.series || []) if (s.kg > 0) volumen += s.kg * (Number(s.reps) || 0);
      const previo = porFecha.get(e.fecha);
      if (!previo || (mejor && (!previo.mejor || mejor.estimado > previo.mejor.estimado))) {
        porFecha.set(e.fecha, { fecha: e.fecha, mejor, volumen: Math.round(volumen + (previo ? previo.volumen : 0)) });
      } else {
        previo.volumen = Math.round(previo.volumen + volumen);
      }
    }
  }
  return [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Tu mejor marca en un ejercicio, y si la acabas de batir. */
export function recordEjercicio(entrenos, nombre) {
  const historia = progresionEjercicio(entrenos, nombre).filter((p) => p.mejor);
  if (!historia.length) return null;
  let record = historia[0];
  for (const p of historia) if (p.mejor.estimado > record.mejor.estimado) record = p;
  return {
    fecha: record.fecha,
    serie: record.mejor,
    esElUltimo: record.fecha === historia[historia.length - 1].fecha,
    sesiones: historia.length,
  };
}

/**
 * La progresión de un ejercicio, sesión a sesión y con la diferencia hecha.
 *
 * La gráfica que hacía falta no es la del peso levantado: es la de **cuánto
 * ha cambiado**. Ver «80, 80, 82,5, 82,5, 85» obliga a restar de cabeza; ver
 * «+0, +2,5, +0, +2,5» dice a la primera si hay progreso o llevas un mes
 * estancado.
 *
 * Se mide sobre el 1RM estimado y no sobre los kilos de la barra porque 80×8
 * y 90×5 no se pueden comparar a ojo: bajar el peso subiendo repeticiones no
 * es un retroceso y no debe pintarse como tal.
 */
export function diferenciasEjercicio(entrenos, nombre) {
  const historia = progresionEjercicio(entrenos, nombre).filter((p) => p.mejor);
  return historia.map((p, i) => {
    const previo = i > 0 ? historia[i - 1] : null;
    return {
      fecha: p.fecha,
      kg: p.mejor.kg,
      reps: p.mejor.reps,
      estimado: p.mejor.estimado,
      volumen: p.volumen,
      /* La primera sesión no tiene contra qué compararse: null, no cero. Un
         cero diría «no progresaste» y lo cierto es «no había antes». */
      delta: previo ? Number((p.mejor.estimado - previo.mejor.estimado).toFixed(1)) : null,
      deltaKg: previo && p.mejor.kg != null && previo.mejor.kg != null
        ? Number((p.mejor.kg - previo.mejor.kg).toFixed(1))
        : null,
    };
  });
}

/* Cuántas sesiones seguidas sin mejorar cuentan como estancamiento. */
export const SESIONES_ESTANCADO = 3;

/**
 * Cómo va cada ejercicio: la foto que contesta «¿estoy progresando?» sin
 * tener que abrir uno por uno.
 *
 * `tendencia` sale de comparar la última sesión con la mejor marca anterior,
 * no con la sesión de antes: un mal día no es un retroceso, y encadenar tres
 * sesiones sin tocar la mejor marca sí es un estancamiento.
 */
export function progresoEjercicios(entrenos, { minimoSesiones = 2 } = {}) {
  const salida = [];
  for (const { nombre } of ejerciciosUsados(entrenos || [])) {
    const historia = diferenciasEjercicio(entrenos, nombre);
    if (historia.length < minimoSesiones) continue;

    const ultima = historia[historia.length - 1];
    const previas = historia.slice(0, -1);
    const mejorPrevio = previas.reduce((m, p) => (m === null || p.estimado > m ? p.estimado : m), null);

    let sinMejorar = 0;
    let tope = -Infinity;
    for (const p of historia) {
      if (p.estimado > tope) { tope = p.estimado; sinMejorar = 0; } else sinMejorar++;
    }

    const contraMejor = mejorPrevio === null ? null : Number((ultima.estimado - mejorPrevio).toFixed(1));
    const tendencia =
      contraMejor === null ? "nuevo"
        : contraMejor > 0 ? "sube"
          : sinMejorar >= SESIONES_ESTANCADO ? "estancado"
            : contraMejor < 0 ? "baja" : "igual";

    salida.push({
      nombre,
      sesiones: historia.length,
      ultima,
      contraMejor,
      sinMejorar,
      tendencia,
      historia,
    });
  }

  /* Primero lo que pide atención: lo estancado y lo que baja. Dentro de cada
     grupo, lo más reciente, que es de lo que uno se acuerda. */
  const peso = { estancado: 0, baja: 1, igual: 2, sube: 3, nuevo: 4 };
  return salida.sort(
    (a, b) => peso[a.tendencia] - peso[b.tendencia]
      || String(b.ultima.fecha).localeCompare(String(a.ultima.fecha))
  );
}

/**
 * Lo mismo pero de una plantilla entera: los kilos movidos por sesión.
 *
 * Para un entreno completo el número honesto no es el de ningún ejercicio
 * suelto, es el volumen: si subes en press y bajas en fondos, el total dice
 * qué pasó de verdad ese día.
 */
export function progresoPlantilla(entrenos, plantillaId) {
  if (!plantillaId) return [];
  const sesiones = (entrenos || [])
    .filter((e) => e && e.plantilla === plantillaId && (e.ejercicios || []).length)
    .sort(porFecha)
    .map((e) => {
      const r = resumenFuerza(e);
      return { fecha: e.fecha, volumen: r.volumen, series: r.series, reps: r.reps };
    });
  return sesiones.map((s, i) => ({
    ...s,
    delta: i > 0 ? s.volumen - sesiones[i - 1].volumen : null,
  }));
}

/* ── tendencia del peso ──────────────────────────────────────────────────── */

/**
 * Pendiente por mínimos cuadrados, en kilos por semana.
 * Devuelve null si no hay serie suficiente o si sale una barbaridad: más de
 * 2 kg de verdad por semana no existe, así que eso es ruido de báscula.
 */
export function pendienteSemanal(serie) {
  if (!serie || serie.length < 3) return null;
  const xs = serie.map((p) => desdeIso(p.fecha).getTime() / 86400000);
  const ys = serie.map((p) => p.kg);
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let arriba = 0;
  let abajo = 0;
  for (let i = 0; i < n; i++) {
    arriba += (xs[i] - mx) * (ys[i] - my);
    abajo += (xs[i] - mx) ** 2;
  }
  if (abajo === 0) return null;
  const kgSemana = (arriba / abajo) * 7;
  return Math.abs(kgSemana) > 2 ? null : kgSemana;
}

/**
 * Media de los últimos 7 días para cada pesaje.
 *
 * El peso del día a día sube y baja por agua, sal y lo que cenaste: la línea
 * cruda asusta sin motivo. La media es la que enseña de verdad hacia dónde vas.
 * Hasta que no hay tres pesajes en la ventana no se dibuja, porque una media
 * de dos puntos no es una media.
 */
export function mediaMovil(pesos, ventana = 7) {
  const serie = conFecha(pesos).sort(porFecha);

  /* Ventana deslizante con la suma acumulada.
     Antes, cada punto recorría la serie entera y construía una fecha por cada
     comparación: con tres años de pesajes eran nueve millones de `new Date` y
     la gráfica tardaba casi un segundo en aparecer. Ahora las fechas se
     calculan una vez y el índice de la izquierda solo avanza, así que el coste
     crece con los pesajes y no con su cuadrado. */
  const t = serie.map((p) => desdeIso(p.fecha).getTime());
  const ancho = (ventana - 1) * 86400000;

  const salida = [];
  let ini = 0;
  let suma = 0;
  let dentro = 0;

  for (let i = 0; i < serie.length; i++) {
    const kg = Number(serie[i].kg);
    if (Number.isFinite(kg)) { suma += kg; dentro++; }

    while (t[ini] < t[i] - ancho) {
      const viejo = Number(serie[ini].kg);
      if (Number.isFinite(viejo)) { suma -= viejo; dentro--; }
      ini++;
    }

    // Con menos de tres pesajes dentro la media no dice nada y se deja en nulo.
    salida.push({ ...serie[i], media: dentro >= 3 ? Number((suma / dentro).toFixed(2)) : null });
  }

  return salida;
}

/**
 * Hacia dónde va el peso y dónde estarías si siguiera así.
 *
 * Se calcula sobre los pesajes que se sostienen —los picos sueltos ya se
 * apartan—, y solo si hay serie de la que fiarse: cuatro pesajes repartidos en
 * diez días como mínimo. Con menos, cualquier número que se diera sería
 * inventado, y es mejor no decir nada que decir una cifra falsa.
 */
export function tendenciaPeso(pesos, { dias = 28, semanas = 4 } = {}) {
  const { fiables } = pesosFiables(pesos);
  if (fiables.length < 4) return null;

  const corte = Date.now() - dias * 86400000;
  const recientes = fiables.filter((p) => desdeIso(p.fecha).getTime() >= corte);
  const serie = recientes.length >= 4 ? recientes : fiables.slice(-8);

  const primero = desdeIso(serie[0].fecha).getTime();
  const ultimo = desdeIso(serie[serie.length - 1].fecha).getTime();
  const abarca = Math.round((ultimo - primero) / 86400000);
  if (abarca < 10) return null;

  const kgSemana = pendienteSemanal(serie);
  if (kgSemana === null) return null;

  const actual = serie[serie.length - 1].kg;
  // Menos de 100 g por semana no es una dirección, es estar plano.
  const estable = Math.abs(kgSemana) < 0.1;

  return {
    kgSemana: Number(kgSemana.toFixed(2)),
    direccion: estable ? "estable" : kgSemana < 0 ? "baja" : "sube",
    diferencia: Number((serie[serie.length - 1].kg - serie[0].kg).toFixed(2)),
    dias: abarca,
    pesajes: serie.length,
    semanas,
    prevision: estable ? null : Number((actual + kgSemana * semanas).toFixed(1)),
  };
}

/* ── meta de peso ────────────────────────────────────────────────────────── */

/**
 * Cuánto llevas de camino hacia el peso que quieres, y cuándo llegarías.
 *
 * El punto de partida es el peso que tenías al ponerte la meta (`metaDesde`);
 * si no consta, el primero que haya. Sin eso, «llevas un 40%» no significaría
 * nada: cambiar la meta a mitad de camino recolocaría la barra sola.
 *
 * La fecha solo sale si te estás moviendo hacia la meta. Si vas al revés o
 * estás plano, no hay fecha que dar y se dice así.
 */
export function progresoMeta(pesos, perfil) {
  const meta = Number(perfil && perfil.meta);
  if (!(meta > 0)) return null;

  const { fiables } = pesosFiables(pesos);
  if (!fiables.length) return null;

  const actual = fiables[fiables.length - 1].kg;
  const desde = Number(perfil.metaDesde) > 0 ? Number(perfil.metaDesde) : fiables[0].kg;

  const total = desde - meta;              // lo que había que recorrer
  const hecho = desde - actual;            // lo recorrido
  const restante = Number((actual - meta).toFixed(1));

  // Si partías ya en la meta no hay barra que pintar, solo si sigues ahí.
  const bajando = total > 0;
  const alcanzada = bajando ? actual <= meta : total < 0 ? actual >= meta : true;

  const porcentaje = Math.abs(total) < 0.05
    ? (alcanzada ? 100 : 0)
    : Math.max(0, Math.min(100, Math.round((hecho / total) * 100)));

  let fecha = null;
  const kgSemana = pendienteSemanal(fiables.slice(-12));
  if (!alcanzada && kgSemana !== null && Math.abs(kgSemana) >= 0.1) {
    const semanas = (meta - actual) / kgSemana;
    if (semanas > 0 && semanas < 260) {          // más de cinco años no es un plan
      const d = new Date();
      d.setDate(d.getDate() + Math.round(semanas * 7));
      fecha = { iso: iso(d), semanas: Math.round(semanas) };
    }
  }

  return { meta, desde, actual, restante, porcentaje, alcanzada, fecha, sentido: bajando ? "bajar" : "subir" };
}

/* ── racha ───────────────────────────────────────────────────────────────── */

/**
 * Días seguidos apuntando algo, sea lo que sea.
 *
 * Se premia el hábito, no el resultado: lo que hace que las cifras valgan es
 * que estén todas, así que cuenta cualquier registro del día.
 *
 * Si hoy todavía no has apuntado nada la racha no se rompe —el día no ha
 * terminado—, sigue contando desde ayer. Se rompe al perder un día entero.
 */
export function racha(datos, hoyIso = hoy()) {
  const dias = new Set();
  for (const lista of [datos.pesos, datos.entrenos, datos.comidas]) {
    for (const r of lista || []) if (r && r.fecha) dias.add(r.fecha);
  }
  if (!dias.size) return { dias: 0, hoy: false };

  const hayHoy = dias.has(hoyIso);
  const cursor = desdeIso(hoyIso);
  if (!hayHoy) cursor.setDate(cursor.getDate() - 1);

  let cuenta = 0;
  while (dias.has(iso(cursor))) {
    cuenta++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { dias: cuenta, hoy: hayHoy };
}

/**
 * Cuánto llevas sin apuntar nada, y si eso rompió una racha.
 *
 * La idea no es dar la brasa: es que si dejas de apuntar tres días, la app se
 * entera y te lo dice al abrir en vez de seguir enseñando datos viejos como si
 * fueran de hoy. Por eso no devuelve nada si nunca has apuntado nada —a una
 * cuenta recién estrenada no se le reprocha— ni si apuntaste ayer, que eso no
 * es abandonar, es un martes.
 */
export function ausencia(datos, hoyIso = hoy(), minimo = 2) {
  const dias = new Set();
  for (const lista of [datos && datos.pesos, datos && datos.entrenos, datos && datos.comidas]) {
    for (const r of lista || []) if (r && typeof r.fecha === "string") dias.add(r.fecha);
  }
  if (!dias.size) return null;

  const ultimo = [...dias].sort().pop();
  const sinApuntar = Math.round((desdeIso(hoyIso) - desdeIso(ultimo)) / 86400000);
  if (!(sinApuntar >= minimo)) return null;

  /* Lo que llevabas antes de dejarlo: sin esto el aviso es un reproche, y con
     esto es «llevabas 12 días seguidos», que es otra cosa. */
  const previa = racha(datos, ultimo);

  return { dias: sinApuntar, ultimo, rachaPerdida: previa.dias >= 3 ? previa.dias : 0 };
}

/* ── comidas de siempre ──────────────────────────────────────────────────── */

/** Dos textos son la misma comida si se escriben igual salvo tildes y comas. */
const huella = (texto) =>
  String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // las tildes que suelta el normalize
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Lo que sueles comer a esta hora, para poder repetirlo de un toque.
 *
 * Manda la costumbre reciente: cada repetición cuenta, pero las de hace dos
 * meses pesan la mitad que las de esta semana, de modo que la lista se mueve
 * contigo en vez de quedarse anclada a lo que comías en enero.
 */
export function comidasFrecuentes(comidas, momento, limite = 3, hoyIso = hoy()) {
  const grupos = new Map();
  const hoyD = desdeIso(hoyIso);

  for (const c of comidas || []) {
    if (!c || !c.texto || (momento && c.momento !== momento)) continue;
    const clave = huella(c.texto);
    if (!clave) continue;

    const dias = Math.max(0, Math.round((hoyD - desdeIso(c.fecha)) / 86400000));
    if (dias > 90) continue;
    const peso = dias <= 7 ? 1 : dias <= 30 ? 0.7 : 0.5;

    const previo = grupos.get(clave);
    if (previo) {
      previo.puntos += peso;
      previo.veces++;
      // Se enseña la versión más reciente, que es como lo escribes ahora.
      if (c.fecha > previo.fecha) Object.assign(previo, { ...c, puntos: previo.puntos, veces: previo.veces });
    } else {
      grupos.set(clave, { ...c, puntos: peso, veces: 1 });
    }
  }

  return [...grupos.values()]
    .filter((g) => g.veces >= 2)     // una sola vez no es una costumbre
    .sort((a, b) => b.puntos - a.puntos || b.fecha.localeCompare(a.fecha))
    .slice(0, limite)
    .map(({ puntos, veces, id, fecha, ts, ...comida }) => ({ ...comida, veces }));
}

/* ── báscula: saltos que no se sostienen ─────────────────────────────────── */

/**
 * Lo máximo que el peso puede moverse de verdad entre dos pesajes.
 * De un día para otro se mueven fácil 1-2 kg de agua y comida en tránsito,
 * pero de grasa no se pierde ni se gana casi nada. Pasar de 92 a 95 en un día
 * es agua, la báscula mal puesta o un dedo torcido al teclear: no es peso.
 */
export function toleranciaPeso(kg, dias = 1) {
  const base = Math.max(1.8, (Number(kg) || 75) * 0.022);
  return Math.min(9, base + 0.32 * Math.max(0, dias - 1));
}

/** Revisa un pesaje contra el anterior. Avisa, nunca bloquea. */
export function revisarPeso(kg, fecha, pesos) {
  const valor = Number(kg);
  if (!(valor > 0)) return { ok: false, motivo: "El peso tiene que ser un número mayor que cero." };
  if (valor < 25 || valor > 300) {
    return { ok: false, motivo: `${num(valor)} kg no parece un peso real. ¿Te has dejado un número?` };
  }

  const previos = conFecha(pesos)
    .filter((p) => p.fecha < fecha)
    .sort(porFecha);
  const ref = previos[previos.length - 1];
  if (!ref) return { ok: true };

  const dias = Math.max(1, Math.round((desdeIso(fecha) - desdeIso(ref.fecha)) / 86400000));
  const salto = valor - ref.kg;
  const tope = toleranciaPeso(ref.kg, dias);
  if (Math.abs(salto) <= tope) return { ok: true };

  return {
    ok: false,
    salto,
    dias,
    referencia: ref,
    motivo:
      dias === 1
        ? `De ${num(ref.kg)} a ${num(valor)} kg en un día son ${num(Math.abs(salto))} kg. Eso no es peso real: será agua o un error al teclear.`
        : `De ${num(ref.kg)} a ${num(valor)} kg en ${dias} días son ${num(Math.abs(salto))} kg. Es mucho para ese tiempo.`,
  };
}

/**
 * Separa los pesajes que se sostienen de los picos sueltos.
 * Un salto solo cuenta como error si el siguiente pesaje vuelve al nivel de
 * antes: si el cambio se mantiene, es que el peso cambió de verdad.
 */
export function pesosFiables(pesos) {
  const serie = conFecha(pesos).sort(porFecha);
  if (serie.length < 3) return { fiables: serie, sospechosos: [] };

  const fiables = [serie[0]];
  const sospechosos = [];

  for (let i = 1; i < serie.length; i++) {
    const previo = fiables[fiables.length - 1];
    const actual = serie[i];
    const dias = Math.max(1, Math.round((desdeIso(actual.fecha) - desdeIso(previo.fecha)) / 86400000));
    const tope = toleranciaPeso(previo.kg, dias);

    if (Math.abs(actual.kg - previo.kg) <= tope) {
      fiables.push(actual);
      continue;
    }

    const siguiente = serie[i + 1];
    const vuelve = siguiente && Math.abs(siguiente.kg - previo.kg) < Math.abs(actual.kg - previo.kg) / 2;
    if (vuelve) sospechosos.push(actual);
    else fiables.push(actual); // el cambio se mantiene: era real
  }

  return { fiables, sospechosos };
}

/* ── normalizar lo que venga de fuera ────────────────────────────────────── */

/* poco / normal / mucho → escalón de volumen equivalente */
const VOLUMEN_DESDE_CANTIDAD = { poco: 2, normal: 3, mucho: 4 };

const entre = (n, min, max) => Math.min(max, Math.max(min, n));

/**
 * Convierte una lista guardada por cualquier versión anterior en registros
 * válidos para Firestore: con `id` propio y sin los campos del viejo motor de
 * fusión (`mod`), que ya no existe porque cada registro es su propio documento.
 */
function normalizar(lista, arreglar) {
  return (lista || [])
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const { mod, ...resto } = x;
      const limpio = { ...resto, id: x.id || nuevoId() };
      return arreglar ? arreglar(limpio) : limpio;
    });
}

/* Las comidas viejas traen `cantidad`; se traduce a volumen y se quedan sin
   saciedad, que es un dato que entonces no se pedía. El estimador sabe
   apañarse sin él. */
const arreglarComida = (c) => {
  const { cantidad, ...resto } = c;
  return {
    ...resto,
    volumen: entre(c.volumen || VOLUMEN_DESDE_CANTIDAD[cantidad] || 3, 1, 5),
    saciedad: c.saciedad != null ? entre(c.saciedad, 1, 4) : null,
  };
};

/** Reparte un objeto tipo `{perfil, pesos, entrenos, comidas}` en colecciones. */
export function repartir(d) {
  return {
    porColeccion: {
      pesos: normalizar(d.pesos),
      entrenos: normalizar(d.entrenos),
      comidas: normalizar(d.comidas, arreglarComida),
      plantillas: normalizar(d.plantillas),
    },
    campos: { perfil: { ...PERFIL_VACIO, ...(d.perfil || {}) } },
  };
}

/* ── datos que dejó la versión anterior en este dispositivo ──────────────── */

/* La versión anterior guardaba en el propio navegador, sin saber de quién era.
   Eso es justo lo que se ha quitado: ahora todo cuelga del usuario. Lo que
   quedara guardado no se toca ni se sube solo; se ofrece en la pantalla de
   cuenta para que su dueño decida, y solo entonces se importa. */

export const CLAVE_LEGADO = "salud-app-v2";
const CLAVE_LEGADO_VISTO = "salud-legado-descartado";

const cuantos = (n, uno, muchos) => (n === 1 ? `1 ${uno}` : `${n} ${muchos}`);

export function leerLegado(almacen) {
  const ls = almacen || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!ls) return null;

  let crudo;
  try {
    if (ls.getItem(CLAVE_LEGADO_VISTO)) return null;
    crudo = ls.getItem(CLAVE_LEGADO);
  } catch (e) {
    return null;
  }
  if (!crudo) return null;

  let d;
  try {
    d = JSON.parse(crudo);
  } catch (e) {
    return null;
  }
  if (!d || typeof d !== "object") return null;

  const { porColeccion, campos } = repartir(d);
  const partes = [];
  if (porColeccion.pesos.length) partes.push(cuantos(porColeccion.pesos.length, "pesaje", "pesajes"));
  if (porColeccion.entrenos.length) partes.push(cuantos(porColeccion.entrenos.length, "entreno", "entrenos"));
  if (porColeccion.comidas.length) partes.push(cuantos(porColeccion.comidas.length, "comida", "comidas"));
  if (!partes.length) return null;

  return { porColeccion, campos, resumen: partes.join(", ") };
}

/** Se llama cuando ya se han importado (o el usuario ha dicho que no son suyos). */
export function olvidarLegado(almacen) {
  const ls = almacen || (typeof localStorage !== "undefined" ? localStorage : null);
  if (!ls) return;
  try {
    ls.setItem(CLAVE_LEGADO_VISTO, String(Date.now()));
    ls.removeItem(CLAVE_LEGADO);
  } catch (e) {
    /* si el navegador no deja escribir, tampoco pasa nada grave */
  }
}

/* ── copia de seguridad ──────────────────────────────────────────────────── */

export function exportar(datos) {
  const blob = new Blob([JSON.stringify({ app: "salud", version: 4, fecha: new Date().toISOString(), datos }, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `salud-copia-${hoy()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Lee un archivo de copia y lo deja listo para escribirlo en la cuenta. */
export function importar(archivo) {
  return new Promise((res, rej) => {
    const lector = new FileReader();
    lector.onload = () => {
      try {
        const j = JSON.parse(lector.result);
        const d = j && j.datos ? j.datos : j && j.data ? j.data : j;
        if (!d || !Array.isArray(d.pesos)) throw new Error("formato");
        res(repartir(d));
      } catch (e) {
        rej(e);
      }
    };
    lector.onerror = () => rej(new Error("lectura"));
    lector.readAsText(archivo);
  });
}
