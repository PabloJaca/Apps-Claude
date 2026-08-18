/* ─────────────────────────────────────────────────────────────────────────
   De una frase suelta a un registro de Salud.

   Aquí hay un problema que en Gastos no existe: además de repartir los
   campos, primero hay que acertar de qué se está hablando. «Ochenta y dos» a
   secas es un peso; «press banca ochenta por ocho» es un entreno; «pasta con
   pollo» es una comida.

   Se decide por señas, no por adivinación: cada tipo tiene sus palabras y sus
   formas. Si no hay ninguna seña clara, se mira si lo que queda parece un
   peso, y si no, se manda a comidas, que es lo que más se apunta.

   Como en Gastos: esto no guarda nada, devuelve un borrador para confirmar.
   ───────────────────────────────────────────────────────────────────────── */

import {
  buscarNumeros, capitalizar, leerFecha, restar, sinTildes, trocear,
} from "../comun/lengua.js";
import { EJERCICIOS_SUGERIDOS, ejerciciosUsados, hoy as hoyISO, mismoEjercicio } from "./nucleo.js";
import { buscarPlantilla, entrenoDesdePlantilla, ultimaDePlantilla } from "./plantillas.js";

/* ── a qué pestaña va ────────────────────────────────────────────────────── */

const SENAS_PESO = [
  /\b(peso|peso hoy|me he pesado|me pese|estoy en|la bascula|bascula|pesaje)\b/,
  /\b(he|estoy) (bajado|subido) a\b/,
];

const SENAS_ENTRENO = [
  /\b(entren|he entrenado|gimnasio|gym|pesas|series?|repeticion|repes)\b/,
  /\b(he |)(corrido|correr|nadado|nadar|pedaleado|caminado|andado|montado)\b/,
  /\b(cardio|fuerza|piernas|pecho|espalda|biceps|triceps|hombro|gluteo)\b/,
  /\b(padel|futbol|baloncesto|tenis|escalada|yoga|pilates|spinning|crossfit)\b/,
  /\b(bici|bicicleta|cinta|eliptica|natacion|piscina|senderismo|caminata|paseo)\b/,
  /\b\d+\s*(x|por)\s*\d+\b/,
];

const SENAS_COMIDA = [
  /\b(he |me he |)(comido|desayunado|almorzado|cenado|merendado|tomado|picado|zampado)\b/,
  /\b(desayuno|almuerzo|comida|cena|merienda|snack|picoteo)\b/,
  /\bde (comer|cenar|desayunar)\b/,
];

/* ── comidas ─────────────────────────────────────────────────────────────── */

const MOMENTO_POR_SENA = [
  [/\bdesayun/, "desayuno"],
  [/\b(almuerzo|almorzado|de comer|la comida|he comido)\b/, "comida"],
  [/\b(merend|merienda|snack|picoteo|picado)\b/, "snack"],
  [/\b(cen[aoé]|cenado|de cenar)\b/, "cena"],
];

/* De menos a más. Se recorre entero y gana la última que encaje, para que
   «muy poco» no se quede en el «poco». */
const VOLUMEN_POR_SENA = [
  [/\b(un poco|poco|poquito|ligero|ligera|algo de)\b/, 2],
  [/\b(muy poco|casi nada|un picoteo|una miga|dos bocados)\b/, 1],
  [/\b(normal|lo de siempre|mi racion|racion normal)\b/, 3],
  [/\b(bastante|racion grande|he repetido|repeti|generos[oa]|abundante)\b/, 4],
  [/\b(mucho|much[ií]simo|un mont[oó]n|hasta arriba|me he puesto (morado|hasta arriba))\b/, 5],
];

const SACIEDAD_POR_SENA = [
  [/\b(con hambre|me he quedado (corto|con hambre)|sin llenarme|corto)\b/, 1],
  [/\b(justo|ni hambre ni|normal de saciedad|bien)\b/, 2],
  [/\b(lleno|llena|saciado|saciada|satisfech[oa])\b/, 3],
  [/\b(muy lleno|muy llena|reventado|reventada|no puedo mas|empachad[oa])\b/, 4],
];

/* Palabras que sobran en el texto de la comida. */
const RELLENO_COMIDA = new Set([
  "he", "me", "he", "de", "del", "en", "el", "la", "los", "las", "un", "una",
  "unos", "unas", "y", "que", "con", "para", "al",
  "comido", "comer", "desayunado", "desayunar", "cenado", "cenar",
  "almorzado", "almorzar", "merendado", "merendar", "tomado", "tomar",
  "picado", "picar", "zampado", "apunta", "anota", "hoy",
]);

/* ── entrenos ────────────────────────────────────────────────────────────── */

const TIPO_POR_SENA = [
  [/\b(corrido|correr|carrera|nadado|nadar|bici|pedaleado|caminado|andado|cinta|eliptica|remo ergometro|spinning)\b/, "cardio"],
  [/\b(padel|futbol|baloncesto|tenis|voley|balonmano|partido)\b/, "equipo"],
  [/\b(yoga|pilates|estiramientos|movilidad)\b/, "otro"],
  [/\b(pesas|fuerza|gimnasio|gym|series?|repeticion|repes|press|sentadilla|dominadas|curl|remo|peso muerto)\b/, "fuerza"],
];

const INTENSIDAD_POR_SENA = [
  [/\b(suave|flojo|tranquil[oa]|regenerativo|de recuperacion)\b/, "suave"],
  [/\b(media|normal|moderad[oa])\b/, "media"],
  [/\b(fuerte|duro|intens[oa]|a tope|al fallo|brutal)\b/, "fuerte"],
];

/**
 * Las series de un ejercicio, que en voz alta siempre suenan igual:
 * «ochenta por ocho», «80x8», «3 series de 10 con 60».
 *
 * El primer número son los kilos y el segundo las repeticiones, salvo en la
 * forma «N series de R», donde el orden es al revés y los kilos van detrás.
 */
function leerSeries(limpios, desde, hasta) {
  const series = [];
  const usados = [];
  let i = desde;

  while (i < hasta) {
    /* «3 series de 10 con 60» / «3 series de 10 a 60 kilos».
       Los números se leen de uno en uno a propósito: leídos de corrido, el
       «con» de «10 con 60» es el mismo que separa decimales y salían diez
       repeticiones con sesenta céntimos. */
    if (limpios[i] === "series" || limpios[i] === "serie") {
      const sueltos = (a, b) => {
        const out = [];
        for (let k = Math.max(desde, a); k < Math.min(hasta, b); k++) {
          const v = buscarNumeros([limpios[k]])[0];
          if (v) out.push(v.valor);
        }
        return out;
      };
      const cuantas = sueltos(i - 2, i);
      const tras = sueltos(i + 1, i + 7);
      if (cuantas.length && tras.length) {
        const n = Math.min(12, Math.max(1, Math.round(cuantas[cuantas.length - 1])));
        const reps = Math.round(tras[0]);
        const kg = tras.length > 1 ? tras[1] : null;
        for (let s = 0; s < n; s++) series.push({ kg, reps });
        usados.push({ desde: Math.max(desde, i - 2), fin: Math.min(hasta, i + 7) });
        i = Math.min(hasta, i + 7);
        continue;
      }
    }

    // «80 por 8» / «80x8»
    const a = buscarNumeros([limpios[i]])[0];
    if (a) {
      const enlace = limpios[i + 1];
      if (enlace === "por" || enlace === "x") {
        const b = buscarNumeros([limpios[i + 2]])[0];
        if (b) {
          series.push({ kg: a.valor, reps: Math.round(b.valor) });
          usados.push({ desde: i, fin: i + 3 });
          i += 3;
          continue;
        }
      }
      const juntos = String(limpios[i]).match(/^(\d+(?:[.,]\d+)?)x(\d+)$/);
      if (juntos) {
        series.push({ kg: parseFloat(juntos[1].replace(",", ".")), reps: Number(juntos[2]) });
        usados.push({ desde: i, fin: i + 1 });
        i += 1;
        continue;
      }
    }
    i++;
  }

  return { series, usados };
}

/** El ejercicio del que se habla: primero los tuyos, luego la lista de siempre. */
export function reconocerEjercicio(texto, entrenos) {
  const limpio = sinTildes(texto).trim();
  if (!limpio) return null;

  const mios = ejerciciosUsados(entrenos || []).map((e) => e.nombre);
  for (const lista of [mios, EJERCICIOS_SUGERIDOS]) {
    // El nombre más largo que encaje gana: «press inclinado» antes que «press».
    const encaja = lista
      .filter((n) => limpio.includes(sinTildes(n)) || mismoEjercicio(n, texto))
      .sort((a, b) => b.length - a.length);
    if (encaja.length) return encaja[0];
  }
  return null;
}

function interpretarEntreno(brutos, limpios, plano, fecha, datos, plantilla) {
  let tipo = "fuerza";
  for (const [re, id] of TIPO_POR_SENA) if (re.test(plano)) { tipo = id; break; }

  let intensidad = null;
  for (const [re, id] of INTENSIDAD_POR_SENA) if (re.test(plano)) intensidad = id;

  const numeros = buscarNumeros(limpios);

  /* La unidad puede caer justo detrás del número («5 km») o quedar dentro de
     él («una hora y media» se lee entero como 1,5), así que se busca en todo
     el tramo que ocupa el número y en la palabra siguiente. */
  const unidadDe = (n) => {
    for (let k = n.desde; k <= n.fin && k < limpios.length; k++) {
      const p = limpios[k] || "";
      if (/^(km|kilometro)/.test(p)) return "km";
      if (/^min/.test(p)) return "min";
      if (/^hora/.test(p)) return "hora";
    }
    return null;
  };

  const km = numeros.find((n) => unidadDe(n) === "km");
  const minutos = numeros.find((n) => unidadDe(n) === "min");

  const salida = {
    seccion: "entrenos",
    fecha,
    tipo,
    minutos: minutos ? Math.round(minutos.valor) : null,
    intensidad: intensidad || "media",
    km: km ? km.valor : null,
    ejercicios: [],
  };

  /* «una hora y media» también es una duración. */
  if (!salida.minutos) {
    const horas = numeros.find((n) => unidadDe(n) === "hora");
    if (horas) salida.minutos = Math.round(horas.valor * 60);
  }

  /* Si la frase nombra una plantilla, ella pone el entreno entero y la frase
     solo manda en lo que haya dicho de verdad: «he hecho empuje 45 minutos
     suave» son los ejercicios de siempre con esos dos cambios. */
  if (plantilla) {
    const base = entrenoDesdePlantilla(
      plantilla, fecha, ultimaDePlantilla(datos && datos.entrenos, plantilla.id)
    );
    if (salida.minutos) base.minutos = salida.minutos;
    if (intensidad) base.intensidad = intensidad;
    if (salida.km) base.km = salida.km;
    return base;
  }

  if (tipo === "fuerza") {
    /* La frase se parte por comas y por «y»: cada trozo suele ser un
       ejercicio con sus series. */
    const cortes = [0];
    for (let i = 0; i < brutos.length; i++) {
      if (/,$/.test(brutos[i]) || limpios[i] === "luego" || limpios[i] === "despues") cortes.push(i + 1);
    }
    cortes.push(brutos.length);

    for (let c = 0; c < cortes.length - 1; c++) {
      const desde = cortes[c];
      const hasta = cortes[c + 1];
      if (hasta <= desde) continue;

      const trozo = limpios.slice(desde, hasta).join(" ");
      const nombre = reconocerEjercicio(trozo, datos && datos.entrenos);
      const { series, usados } = leerSeries(limpios, desde, hasta);
      if (!nombre && !series.length) continue;

      salida.ejercicios.push({
        nombre: nombre || capitalizar(restar(brutos.slice(desde, hasta), usados.map((u) => ({ desde: u.desde - desde, fin: u.fin - desde })), new Set(["de", "con", "a", "el", "la", "he", "hecho"]))) || "Ejercicio",
        series: series.length ? series : [{ kg: null, reps: null }],
      });
    }
  }

  return salida;
}

function interpretarComida(brutos, limpios, plano, fecha, ahora) {
  let momento = null;
  for (const [re, id] of MOMENTO_POR_SENA) if (re.test(plano)) { momento = id; break; }
  if (!momento) {
    const h = ahora;
    momento = h < 11 ? "desayuno" : h < 16.5 ? "comida" : h < 20 ? "snack" : "cena";
  }

  let volumen = null;
  for (const [re, n] of VOLUMEN_POR_SENA) if (re.test(plano)) volumen = n;

  let saciedad = null;
  for (const [re, n] of SACIEDAD_POR_SENA) if (re.test(plano)) saciedad = n;

  /* Del texto se quitan los verbos y las palabras que ya han dado el volumen o
     la saciedad: lo que queda es lo que se comió. */
  const fuera = new Set(RELLENO_COMIDA);
  for (const lista of [VOLUMEN_POR_SENA, SACIEDAD_POR_SENA, MOMENTO_POR_SENA]) {
    for (const [re] of lista) {
      const m = plano.match(re);
      if (m) for (const p of m[0].split(" ")) fuera.add(p);
    }
  }

  return {
    seccion: "comidas",
    fecha,
    texto: capitalizar(restar(brutos, [], fuera)),
    volumen: volumen || 3,
    saciedad,
    momento,
    dijoVolumen: volumen != null,
  };
}

/**
 * La frase entera, repartida y con su pestaña.
 *
 * `ahora` es la hora del día en decimal (14,5 son las dos y media) y solo se
 * usa para adivinar el momento de una comida que no lo diga.
 */
export function interpretarSalud(frase, datos, opciones = {}) {
  const hoyIso = opciones.hoy || hoyISO();
  const ahora = opciones.ahora != null ? opciones.ahora : new Date().getHours() + new Date().getMinutes() / 60;

  const { brutos, limpios } = trocear(frase);
  const plano = limpios.join(" ");
  if (!plano) return null;

  const conFecha = leerFecha(limpios, hoyIso);
  const fecha = conFecha ? conFecha.fecha : hoyIso;
  const sinCuando = conFecha
    ? { brutos: brutos.filter((_, i) => i < conFecha.desde || i >= conFecha.fin),
        limpios: limpios.filter((_, i) => i < conFecha.desde || i >= conFecha.fin) }
    : { brutos, limpios };
  const plano2 = sinCuando.limpios.join(" ");

  /* El nombre de una plantilla es una seña de entreno tan buena como
     «gimnasio»: quien tiene una plantilla llamada «Empuje» dice «he hecho
     empuje», sin más pistas. */
  const plantilla = buscarPlantilla(datos && datos.plantillas, plano2);

  const esPeso = SENAS_PESO.some((re) => re.test(plano2));
  const esEntreno = Boolean(plantilla) || SENAS_ENTRENO.some((re) => re.test(plano2));
  const esComida = SENAS_COMIDA.some((re) => re.test(plano2));

  /* El peso gana al resto cuando lo dice explícitamente: «peso 82 después de
     entrenar» es un pesaje, no un entreno. */
  if (esPeso || (!esEntreno && !esComida && pareceSoloUnPeso(sinCuando.limpios))) {
    const n = buscarNumeros(sinCuando.limpios).find((x) => x.valor >= 20 && x.valor <= 400);
    if (n) {
      return {
        seccion: "peso",
        fecha,
        kg: n.valor,
        nota: capitalizar(restar(sinCuando.brutos, [n], new Set([
          "peso", "peso", "hoy", "me", "he", "pesado", "estoy", "en", "la", "bascula",
          "kilos", "kilo", "kg", "kgs", "y", "de",
        ]))),
        dijoFecha: Boolean(conFecha),
      };
    }
  }

  if (esEntreno) {
    return {
      ...interpretarEntreno(sinCuando.brutos, sinCuando.limpios, plano2, fecha, datos, plantilla),
      dijoFecha: Boolean(conFecha),
    };
  }

  return { ...interpretarComida(sinCuando.brutos, sinCuando.limpios, plano2, fecha, ahora), dijoFecha: Boolean(conFecha) };
}

/* Un número solo, con o sin «kilos», y poco más alrededor. */
function pareceSoloUnPeso(limpios) {
  const numeros = buscarNumeros(limpios);
  if (numeros.length !== 1) return false;
  const n = numeros[0];
  if (!(n.valor >= 20 && n.valor <= 400)) return false;
  const resto = limpios.filter((_, i) => i < n.desde || i >= n.fin);
  return resto.every((p) => ["kilos", "kilo", "kg", "kgs", "hoy", "y", "medio"].includes(p));
}

export const EJEMPLOS_SALUD = [
  "peso ochenta y dos kilos y medio",
  "he comido pasta con pollo, bastante lleno",
  "press banca 80 por 8 y 80 por 6",
  "he corrido cinco kilómetros en veinticinco minutos",
];
