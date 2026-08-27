/* ─────────────────────────────────────────────────────────────────────────
   Plantillas de entreno.

   El problema que resuelven: los entrenos se repiten. El mismo empuje, el
   mismo partido de pádel, la misma sesión de pliometría. Apuntarlos ejercicio
   por ejercicio cada día es trabajo tirado, porque lo único que cambia de una
   semana a otra son los kilos y alguna repetición.

   Así que la plantilla dice QUÉ se hace y el historial dice CUÁNTO. Al abrir
   una plantilla se rellenan sus ejercicios con los pesos de la última vez que
   se hizo, no con los que se guardaron el día que se creó: lo que ves al
   entrar en el gimnasio es lo que moviste la vez anterior, que es justo el
   número que necesitas para decidir si subes o bajas.

   Este archivo no toca el navegador: son funciones puras y se prueban sin
   arrancar nada. El pegado masivo vive aquí por lo mismo — es la parte con
   más casos raros y es la que más falta hace poder probar a mano.
   ───────────────────────────────────────────────────────────────────────── */

import { sinTildes } from "../comun/lengua.js";
import { huellaEjercicio } from "./nucleo.js";

/** Lo que la app espera de una plantilla recién creada. */
export const PLANTILLA_VACIA = {
  nombre: "", tipo: "fuerza", minutos: 45, intensidad: "media", km: null, ejercicios: [],
};

/* Topes. Los tres primeros los exigen también las reglas de Firestore: si se
   suben aquí hay que subirlos allí, o el guardado se rechaza en el servidor. */
export const MAX_EJERCICIOS = 30;
export const MAX_SERIES = 20;
export const MAX_NOMBRE = 60;
export const MAX_PLANTILLAS = 40;

const TIPOS_VALIDOS = new Set(["fuerza", "cardio", "equipo", "otro"]);
const INTENS_VALIDAS = new Set(["suave", "media", "fuerte"]);

/*
 * Un número, o nada.
 *
 * El vacío se comprueba ANTES de convertir porque `Number(null)` y `Number("")`
 * valen cero, no NaN. Sin esta guarda, un ejercicio a peso corporal —el campo
 * de kilos en blanco— se guardaba como «0 kg», que no es lo mismo que «sin
 * peso»: uno es un dato y el otro es su ausencia.
 */
const numeroONada = (v, min, max) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};

/**
 * Una serie con la forma buena.
 *
 * Vive aquí y no repetida en tres sitios porque los campos nuevos —el rango de
 * repeticiones, el fallo y el enlace del dropset— se perdían en cada copia:
 * `plantillasSanas` los recortaba, `entrenoDesdePlantilla` los dejaba fuera y
 * `plantillaDesdeEntreno` también. Tres olvidos del mismo olvido.
 */
export const serieSana = (s) => {
  /* La plancha, el hollow o el vacío abdominal se miden en segundos, no en
     repeticiones. El número vive en el mismo campo y es `unidad` quien dice
     qué significa: así todo lo que ya sabía contar series lo sigue sabiendo, y
     lo único que hay que mirar es quién suma repeticiones. El tope sube a
     3.600 porque un minuto de plancha son 60 y hay quien encadena más. */
  const seg = s && s.unidad === "seg";
  const tope = seg ? 3600 : 999;
  const reps = numeroONada(s && s.reps, 0, tope);
  const hasta = numeroONada(s && s.repsHasta, 0, tope);
  return {
    kg: numeroONada(s && s.kg, 0, 1000),
    reps,
    /* Un «hasta» por debajo del «desde» no es un rango, es un error de
       tecleo: se descarta en vez de pintar «12-8». */
    repsHasta: hasta !== null && reps !== null && hasta > reps ? hasta : null,
    unidad: seg ? "seg" : null,
    fallo: Boolean(s && s.fallo),
    enlace: s && s.enlace === "dropset" ? "dropset" : null,
  };
};

/**
 * Plantillas con la forma que la pantalla espera.
 *
 * Misma frontera que `saneaEntrenos`: una plantilla sin nombre o con los
 * ejercicios a medias no debe dejar la pestaña en blanco, y el sitio de
 * arreglarlo es este, una vez, no cada `map` que la dibuje.
 */
export const plantillasSanas = (lista) =>
  (Array.isArray(lista) ? lista : [])
    .filter((p) => p && typeof p === "object" && String(p.nombre || "").trim())
    .map((p) => ({
      ...p,
      nombre: String(p.nombre).trim().slice(0, MAX_NOMBRE),
      tipo: TIPOS_VALIDOS.has(p.tipo) ? p.tipo : "otro",
      intensidad: INTENS_VALIDAS.has(p.intensidad) ? p.intensidad : "media",
      /* En fuerza la duración ya no se pide, así que tampoco se enseña. Las
         plantillas creadas antes del cambio llevan dentro un 45 que nadie
         escribió —era el valor por defecto del formulario— y que salía en el
         resumen como si fuera un dato. Se corta aquí, en la frontera, para no
         obligar a reeditar a mano lo que ya está guardado. */
      minutos: p.tipo === "fuerza" ? null : numeroONada(p.minutos, 1, 1440),
      km: numeroONada(p.km, 0, 1000),
      orden: numeroONada(p.orden, 0, 999) ?? 999,
      ejercicios: (Array.isArray(p.ejercicios) ? p.ejercicios : [])
        .filter((ej) => ej && typeof ej === "object")
        .slice(0, MAX_EJERCICIOS)
        .map((ej) => ({
          nombre: String(ej.nombre || "Ejercicio").slice(0, MAX_NOMBRE),
          series: (Array.isArray(ej.series) ? ej.series : [])
            .filter((s) => s && typeof s === "object")
            .slice(0, MAX_SERIES)
            .map(serieSana),
        })),
    }));

/** Orden de la lista: el que le hayas dado, y a igualdad, alfabético. */
export const porOrdenPlantilla = (a, b) =>
  (((a && a.orden) ?? 999) - ((b && b.orden) ?? 999)) ||
  String((a && a.nombre) || "").localeCompare(String((b && b.nombre) || ""), "es");

/** La última vez que se hizo esta plantilla. Es de donde salen los pesos. */
export function ultimaDePlantilla(entrenos, plantillaId) {
  if (!plantillaId) return null;
  let mejor = null;
  for (const e of entrenos || []) {
    if (!e || e.plantilla !== plantillaId) continue;
    if (!mejor
        || String(e.fecha) > String(mejor.fecha)
        || (e.fecha === mejor.fecha && (e.ts || 0) > (mejor.ts || 0))) mejor = e;
  }
  return mejor;
}

/**
 * El borrador de entreno que sale al tocar una plantilla.
 *
 * La plantilla manda en la lista de ejercicios y el último entreno manda en
 * los kilos. Se cruzan por nombre, así que un ejercicio añadido a la plantilla
 * después aparece con los pesos que tuviera guardados, y uno que se quitó no
 * vuelve a colarse por venir en el historial.
 */
export function entrenoDesdePlantilla(plantilla, fecha, ultimo) {
  if (!plantilla) return null;

  const previos = new Map();
  for (const ej of (ultimo && ultimo.ejercicios) || []) {
    if (ej && ej.nombre) previos.set(huellaEjercicio(ej.nombre), ej);
  }

  const ejercicios = (plantilla.ejercicios || []).map((ej) => {
    const prev = previos.get(huellaEjercicio(ej.nombre));
    const series = prev && Array.isArray(prev.series) && prev.series.length ? prev.series : ej.series;
    return {
      nombre: ej.nombre,
      series: (Array.isArray(series) && series.length ? series : [{ kg: null, reps: null }])
        .map(serieSana),
    };
  });

  return {
    seccion: "entrenos",
    fecha,
    tipo: plantilla.tipo || "otro",
    /* En fuerza no se arrastra ninguna duración: se estima de las series. Sin
       esto, el 45 por defecto de las plantillas viejas se seguía copiando a
       cada entreno nuevo que saliera de ellas. */
    minutos: plantilla.tipo === "fuerza" ? null : (ultimo && ultimo.minutos) || plantilla.minutos || null,
    intensidad: plantilla.intensidad || "media",
    km: (ultimo && ultimo.km) || plantilla.km || null,
    ejercicios,
    plantilla: plantilla.id || null,
    desdePlantilla: plantilla.nombre || null,
  };
}

/** Guardar un entreno ya hecho como plantilla, para no volver a teclearlo. */
export function plantillaDesdeEntreno(entreno, nombre) {
  if (!entreno) return null;
  return {
    nombre: String(nombre || "").trim().slice(0, MAX_NOMBRE),
    tipo: entreno.tipo || "otro",
    minutos: entreno.minutos || null,
    intensidad: entreno.intensidad || "media",
    km: entreno.km ?? null,
    ejercicios: (entreno.ejercicios || []).slice(0, MAX_EJERCICIOS).map((ej) => ({
      nombre: ej.nombre,
      series: (ej.series || []).slice(0, MAX_SERIES).map(serieSana),
    })),
  };
}

/** Una línea para la tarjeta: «5 ejercicios · 18 series» o «90 min · media». */
export function resumenPlantilla(p) {
  if (!p) return "";
  const trozos = [];
  const ejercicios = (p.ejercicios || []).length;
  if (ejercicios) {
    const series = (p.ejercicios || []).reduce((s, ej) => s + (ej.series || []).length, 0);
    trozos.push(`${ejercicios} ${ejercicios === 1 ? "ejercicio" : "ejercicios"}`);
    if (series) trozos.push(`${series} ${series === 1 ? "serie" : "series"}`);
  }
  if (p.km) trozos.push(`${p.km} km`);
  if (p.minutos) trozos.push(`${p.minutos} min`);
  return trozos.join(" · ");
}

/* ── encontrar una plantilla por su nombre (para el dictado) ─────────────── */

const aplanar = (s) => sinTildes(s).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * La plantilla de la que habla una frase.
 *
 * Gana el nombre más largo que aparezca dentro del texto, igual que con los
 * ejercicios: si hay una plantilla «pierna» y otra «pierna pesada», «he hecho
 * pierna pesada» tiene que dar la segunda.
 */
export function buscarPlantilla(plantillas, texto) {
  const plano = aplanar(texto);
  if (!plano) return null;

  const candidatas = (plantillas || [])
    .filter((p) => p && p.nombre && aplanar(p.nombre).length >= 3)
    .filter((p) => {
      const n = aplanar(p.nombre);
      return plano === n || plano.includes(` ${n} `) || plano.startsWith(`${n} `) || plano.endsWith(` ${n}`);
    })
    .sort((a, b) => aplanar(b.nombre).length - aplanar(a.nombre).length);

  return candidatas[0] || null;
}

/* ── pegar varias plantillas de golpe ────────────────────────────────────── */

/*
   El formato está pensado para que se pueda copiar de un Word o de un Excel
   sin reescribir nada:

       Empuje · fuerza · 60 min · fuerte
       Press banca 80x8, 80x8, 75x10
       Press militar 3x10 @40
       Fondos 3x12

       Pádel · 90 min

   La regla que decide qué es cada línea es una sola: **si la línea trae unas
   series, es un ejercicio; si no, es el nombre de una plantilla nueva.** Por
   eso «Pádel» a secas abre una plantilla y «Fondos 3x12» no.

   Y en los números:

       80x8      un número grande delante son kilos → 1 serie de 80 kg × 8
       3x12      un número pequeño delante son series → 3 series de 12, sin peso
       3x10 @40  con peso explícito siempre son series → 3 series de 10 con 40 kg

   Y las tres formas de anotar cómo se hace la serie:

       3x8-12        un rango de repeticiones: el objetivo es entre 8 y 12
       80x8 AF       al fallo («AF», «fallo» o «al fallo» valen igual)
       80x8 > 60x8   dropset: al fallo, se baja el peso y se sigue

   El umbral entre «grande» y «pequeño» es arbitrario y por tanto puede
   equivocarse; para eso el pegado enseña lo entendido antes de guardar nada.
*/

const NUM = "\\d+(?:[.,]\\d+)?";
const RE_SERIES_SUELTAS = new RegExp(`${NUM}\\s*[x×*]\\s*${NUM}`, "i");
const RE_SERIES_PALABRA = new RegExp(`${NUM}\\s*series?\\b`, "i");

/* Lo que se aguanta un rato se escribe en segundos: «plancha 45s», «hollow
   3x30 seg». La unidad va siempre pegada a un número para no comerse la ese
   de «series» ni la de cualquier nombre acabado en s. */
const UNIDAD_TIEMPO = "(?:s|seg|segs|segundos)";
const RE_TIEMPO = new RegExp(`${NUM}\\s*${UNIDAD_TIEMPO}\\b`, "i");

/* Dónde empiezan las series dentro de una línea de ejercicio: un «80x8», un
   «3 series de 10», una lista suelta tipo «10, 10, 8» o un tiempo «45s». */
const RE_INICIO_SERIES = new RegExp(
  `${NUM}\\s*(?:[x×*]|series?\\b)|${NUM}(?:\\s*,\\s*${NUM})+|${NUM}\\s*${UNIDAD_TIEMPO}\\b`, "i"
);
const RE_PESO = new RegExp(`(?:@\\s*(${NUM})|\\b(?:con|a)\\s+(${NUM})\\s*(?:kg|kilos?)?\\b|\\b(${NUM})\\s*(?:kg|kilos?)\\b)`, "i");

/* «al fallo», «fallo» o «AF» a secas. */
const RE_FALLO = /\b(?:al\s+fallo|fallo|af)\b/i;
/* Los escalones de un dropset se separan con «>»; «ds» o «dropset» también
   marcan que lo que sigue continúa la serie anterior. */
const RE_DROP = /\b(?:dropset|drop|ds)\b/i;

/** Por debajo de esto, el primer número de «AxB» se lee como número de series. */
const TOPE_SERIES = 10;

const aFloat = (s) => parseFloat(String(s).replace(",", "."));

const META = [
  { re: /\b(fuerza|pesas|gimnasio)\b/i, campo: "tipo", valor: "fuerza" },
  { re: /\b(cardio|correr|carrera|bici|nadar|natacion|natación)\b/i, campo: "tipo", valor: "cardio" },
  { re: /\b(equipo|padel|pádel|futbol|fútbol|tenis|baloncesto|partido)\b/i, campo: "tipo", valor: "equipo" },
  { re: /\b(otro|movilidad|yoga|pilates|estiramientos)\b/i, campo: "tipo", valor: "otro" },
  { re: /\b(suave|flojo|tranquilo|regenerativo)\b/i, campo: "intensidad", valor: "suave" },
  { re: /\b(media|moderad[oa]|normal)\b/i, campo: "intensidad", valor: "media" },
  { re: /\b(fuerte|duro|intens[oa]|a tope)\b/i, campo: "intensidad", valor: "fuerte" },
];

/** Saca tipo/intensidad/minutos/km de la línea del título y devuelve el resto. */
function leerCabecera(linea) {
  let resto = ` ${linea} `;
  const salida = { tipo: null, intensidad: null, minutos: null, km: null };

  const km = resto.match(new RegExp(`\\b(${NUM})\\s*(?:km|kil[oó]metros?)\\b`, "i"));
  if (km) { salida.km = aFloat(km[1]); resto = resto.replace(km[0], " "); }

  const min = resto.match(new RegExp(`\\b(${NUM})\\s*(?:min\\b|minutos?\\b|')`, "i"));
  if (min) { salida.minutos = Math.round(aFloat(min[1])); resto = resto.replace(min[0], " "); }

  if (!salida.minutos) {
    const horas = resto.match(new RegExp(`\\b(${NUM})\\s*(?:h\\b|horas?\\b)`, "i"));
    if (horas) { salida.minutos = Math.round(aFloat(horas[1]) * 60); resto = resto.replace(horas[0], " "); }
  }

  /* La palabra que da el tipo se quita del nombre solo si sobra algo después:
     una plantilla que se llama «Pádel» a secas tiene que seguir llamándose
     así, no quedarse sin nombre por haber acertado el tipo. */
  for (const m of META) {
    const encaja = resto.match(m.re);
    if (!encaja) continue;
    if (!salida[m.campo]) salida[m.campo] = m.valor;
    const sin = resto.replace(encaja[0], " ").replace(/[·|\-–—,]/g, " ").trim();
    if (sin) resto = resto.replace(encaja[0], " ");
  }

  const nombre = resto.replace(/[·|]/g, " ").replace(/\s*[-–—]\s*/g, " ").replace(/\s+/g, " ").trim();
  return { ...salida, nombre };
}

/** Las series de una línea de ejercicio, ya con los kilos repartidos. */
function leerSeriesEscritas(texto) {
  let resto = ` ${texto} `;

  /* El fallo y el dropset son de toda la línea, no de un trozo suelto: se
     leen y se quitan antes de partir, para que no estorben a los números. */
  const alFallo = RE_FALLO.test(resto);
  resto = resto.replace(new RegExp(RE_FALLO.source, "gi"), " ");
  const diceDrop = RE_DROP.test(resto);
  resto = resto.replace(new RegExp(RE_DROP.source, "gi"), " ");

  /* La unidad también es de toda la línea: se anota y se quita, para que los
     números lleguen limpios a los mismos patrones de siempre. Así «3x45s» son
     tres series de 45 segundos sin tocar nada más. */
  const enSegundos = RE_TIEMPO.test(resto);
  if (enSegundos) resto = resto.replace(new RegExp(`(${NUM})\\s*${UNIDAD_TIEMPO}\\b`, "gi"), "$1 ");

  const peso = resto.match(RE_PESO);
  const pesoGlobal = peso ? aFloat(peso[1] || peso[2] || peso[3]) : null;
  if (peso) resto = resto.replace(peso[0], " ");

  /* Un trozo, o nada. Se devuelve en vez de empujar a la lista para poder
     reintentarlo partido por comas si no ha salido nada. */
  const leerTrozo = (t, enCadena) => {
    const salida = [];

    /* «3 series de 10» y «3 series x 10», con rango opcional en las repes. */
    const conPalabra = t.match(new RegExp(`(${NUM})\\s*series?\\s*(?:de|x|×)?\\s*(${NUM})(?:\\s*[-–]\\s*(${NUM}))?`, "i"));
    if (conPalabra) {
      const n = Math.min(MAX_SERIES, Math.max(1, Math.round(aFloat(conPalabra[1]))));
      const reps = Math.round(aFloat(conPalabra[2]));
      const hasta = conPalabra[3] ? Math.round(aFloat(conPalabra[3])) : null;
      for (let i = 0; i < n; i++) salida.push({ kg: pesoGlobal, reps, repsHasta: hasta });
      return salida;
    }

    /* «80x8», «3x8-12». El guion solo separa un rango cuando va DESPUÉS de la
       equis: un «80-8» suelto no es un rango de repeticiones. */
    const par = t.match(new RegExp(`^(${NUM})\\s*[x×*]\\s*(${NUM})(?:\\s*[-–]\\s*(${NUM}))?$`, "i"));
    if (par) {
      const a = aFloat(par[1]);
      const b = Math.round(aFloat(par[2]));
      const hasta = par[3] ? Math.round(aFloat(par[3])) : null;
      /* Dentro de un dropset, «AxB» son SIEMPRE kilos por repeticiones: lo que
         se baja en cada escalón es el peso, así que cada escalón es una serie
         y nunca un número de series. Sin esto, «20x10 > 10x8» leía el último
         como diez series de ocho. */
      if (!enCadena && (pesoGlobal != null || (Number.isInteger(a) && a <= TOPE_SERIES))) {
        const n = Math.min(MAX_SERIES, Math.max(1, Math.round(a)));
        for (let i = 0; i < n; i++) salida.push({ kg: pesoGlobal, reps: b, repsHasta: hasta });
      } else {
        salida.push({ kg: a, reps: b, repsHasta: hasta });
      }
      return salida;
    }

    /* Un número suelto son repeticiones: «10, 10, 8 @60». */
    const solo = t.match(new RegExp(`^(${NUM})(?:\\s*[-–]\\s*(${NUM}))?$`));
    if (solo) {
      salida.push({
        kg: pesoGlobal,
        reps: Math.round(aFloat(solo[1])),
        repsHasta: solo[2] ? Math.round(aFloat(solo[2])) : null,
      });
    }
    return salida;
  };

  /* La coma es separador cuando lleva espacio detrás y decimal cuando no lo
     lleva: «80x8, 75x10» son dos series y «82,5x5» son ochenta y dos kilos y
     medio. Si un trozo no da nada y aún tiene comas, se reintenta partiéndolo
     por ellas, que es como se recupera «80x8,80x8» escrito sin espacios.

     El «>» es aparte: separa los escalones de un dropset, y lo que va detrás
     del primero continúa la serie anterior sin descanso. */
  const series = [];
  const bloques = resto.split(/\s*>\s*/);
  const hayCadena = bloques.length > 1;

  bloques.forEach((bloque, iBloque) => {
    const deEsteBloque = [];
    for (const trozo of bloque.split(/\s*[;/]\s*|\s*,\s+/)) {
      const t = trozo.trim();
      if (!t) continue;
      const leidas = leerTrozo(t, hayCadena);
      if (leidas.length) { deEsteBloque.push(...leidas); continue; }
      if (t.includes(",")) for (const pieza of t.split(",")) deEsteBloque.push(...leerTrozo(pieza.trim(), hayCadena));
    }
    /* Todo lo que viene tras un «>» son escalones enlazados. */
    if (iBloque > 0) for (const x of deEsteBloque) x.enlace = "dropset";
    series.push(...deEsteBloque);
  });

  /* Al fallo marca la última serie de cada bloque, que es donde se llega:
     decir «3x10 al fallo» no significa fallar en las tres. Con dropset, el
     fallo es implícito en cada escalón. */
  /* En un dropset se falla en cada escalón, el primero incluido: esa es la
     definición. Un «al fallo» suelto, en cambio, marca solo la última serie:
     decir «3x10 al fallo» no significa fallar en las tres. */
  if (hayCadena || diceDrop) {
    for (const x of series) x.fallo = true;
  } else if (alFallo && series.length) {
    series[series.length - 1].fallo = true;
  }

  if (enSegundos) for (const x of series) x.unidad = "seg";

  return series.slice(0, MAX_SERIES);
}

/* Una línea es un ejercicio si trae series de alguna de sus formas, o si
   empieza por viñeta, que es la manera de decir «esto es un ejercicio» cuando
   no se quiere escribir ningún número. */
const esLineaDeEjercicio = (linea) =>
  /^\s*[-*•]/.test(linea)
  || RE_SERIES_SUELTAS.test(linea)
  || RE_SERIES_PALABRA.test(linea)
  || RE_TIEMPO.test(linea)
  || RE_INICIO_SERIES.test(linea);

/**
 * Un texto pegado, convertido en plantillas.
 *
 * Devuelve también los avisos: lo que no se ha sabido leer se dice, no se
 * tira en silencio. La pantalla enseña las dos cosas antes de guardar.
 */
export function interpretarPlantillas(texto) {
  const lineas = String(texto || "").split(/\r?\n/);
  const plantillas = [];
  const avisos = [];
  let actual = null;

  const cerrar = () => {
    if (!actual) return;
    if (!actual.nombre) { avisos.push("Una plantilla se ha quedado sin nombre y no se ha creado."); actual = null; return; }
    /* Si tiene ejercicios es fuerza aunque no lo diga; si no los tiene, lo que
       se dijera, y a falta de todo, «otro»: un partido de pádel no son pesas. */
    if (!actual.tipo) actual.tipo = actual.ejercicios.length ? "fuerza" : "otro";
    plantillas.push(actual);
    actual = null;
  };

  for (const cruda of lineas) {
    const linea = cruda.replace(/\t+/g, " ").trim();
    if (!linea) continue;

    const forzadaCabecera = /^#+\s*/.test(linea);
    const limpia = linea.replace(/^#+\s*/, "");

    if (!forzadaCabecera && actual && esLineaDeEjercicio(limpia)) {
      const sinVinneta = limpia.replace(/^\s*[-*•]\s*/, "");

      /* El nombre es todo lo que hay DELANTE de las series, y las series solo
         lo que hay detrás: si se le pasa la línea entera al lector de series,
         «Press banca 80x8» llega con el nombre pegado al primer trozo y ese
         trozo no encaja con nada, así que se perdía la primera serie. */
      const corte = sinVinneta.search(RE_INICIO_SERIES);
      const nombre = (corte > 0 ? sinVinneta.slice(0, corte) : corte === 0 ? "" : sinVinneta)
        .replace(/[·|:]/g, " ").replace(/\s*[-–—]\s*$/, "").replace(/\s+/g, " ").trim();
      const series = corte >= 0 ? leerSeriesEscritas(sinVinneta.slice(corte)) : [];

      if (!nombre) { avisos.push(`Sin nombre de ejercicio: «${limpia}»`); continue; }
      if (actual.ejercicios.length >= MAX_EJERCICIOS) {
        avisos.push(`«${actual.nombre}» pasa de ${MAX_EJERCICIOS} ejercicios; se ha cortado ahí.`);
        continue;
      }
      /* Por `serieSana` para que salgan con TODAS las claves puestas. Sin
         esto, una serie sin dropset no traía `enlace` y quien comparaba con
         `=== null` se encontraba un `undefined`: en JSON los dos se imprimen
         igual, así que el fallo no se ve ni leyendo el volcado. */
      actual.ejercicios.push({
        nombre: nombre.slice(0, MAX_NOMBRE),
        series: (series.length ? series : [{ kg: null, reps: null }]).map(serieSana),
      });
      continue;
    }

    cerrar();
    if (plantillas.length >= MAX_PLANTILLAS) {
      avisos.push(`Solo se leen ${MAX_PLANTILLAS} plantillas de una vez; el resto se ha dejado fuera.`);
      break;
    }
    const cabecera = leerCabecera(limpia);
    actual = {
      nombre: cabecera.nombre.slice(0, MAX_NOMBRE),
      tipo: cabecera.tipo,
      intensidad: cabecera.intensidad || "media",
      minutos: cabecera.minutos,
      km: cabecera.km,
      ejercicios: [],
    };
  }
  cerrar();

  return { plantillas, avisos };
}

export const EJEMPLO_PEGADO = `Empuje · fuerza · 60 min · fuerte
Press banca 80x8, 80x8, 75x10
Press militar 3x10 @40
Fondos 3x12

Pádel · 90 min

Pliometría · 40 min
Saltos al cajón 4x8
Skipping 3x30`;
