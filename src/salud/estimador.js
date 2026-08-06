/* ─────────────────────────────────────────────────────────────────────────
   Salud · estimador de calorías y calidad del día.

   Sustituye a la llamada de pago que antes hacía este trabajo. Lee lo que
   escribe el usuario ("ensalada de lentejas y un yogur"), lo cruza con la
   tabla de alimentos y saca un rango de calorías y una nota del día.

   Es una estimación por tabla, con su margen, y la app lo dice claramente.
   La anterior también estimaba: la diferencia es que esta es instantánea,
   funciona sin cobertura y no cuesta dinero.
   ───────────────────────────────────────────────────────────────────────── */

import { ALIMENTOS, INDICE, RACION_GENERICA } from "./alimentos.js";

const LETRA = /[a-z0-9ñ]/;

export function normalizar(texto = "") {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\wñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NUMEROS = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  medio: 0.5, media: 0.5, "1/2": 0.5, doble: 2, par: 2,
};

/** Cuántas raciones hay delante del alimento: "2 huevos", "medio plátano". */
function multiplicador(texto, posicion) {
  const antes = texto.slice(Math.max(0, posicion - 14), posicion).trim();
  const palabras = antes.split(" ").filter(Boolean);
  for (let i = palabras.length - 1; i >= Math.max(0, palabras.length - 2); i--) {
    const p = palabras[i];
    if (NUMEROS[p]) return NUMEROS[p];
    const n = parseFloat(p.replace(",", "."));
    if (!Number.isNaN(n) && n > 0 && n <= 10) return n;
  }
  return 1;
}

const FACTOR_CANTIDAD = { poco: 0.72, normal: 1, mucho: 1.38 };

/**
 * Reconoce alimentos dentro de un texto libre.
 * Devuelve kcal, los grupos que aparecen y qué se ha reconocido.
 */
export function analizarTexto(texto) {
  const limpio = normalizar(texto);
  if (!limpio) return { kcal: 0, grupos: [], detectados: [], reconocido: false };

  const usado = new Array(limpio.length).fill(false);
  const detectados = [];
  let kcal = 0;

  for (const { termino, indice } of INDICE) {
    let desde = 0;
    while (desde <= limpio.length - termino.length) {
      const pos = limpio.indexOf(termino, desde);
      if (pos === -1) break;
      desde = pos + 1;

      const antes = pos > 0 ? limpio[pos - 1] : " ";
      const despues = pos + termino.length < limpio.length ? limpio[pos + termino.length] : " ";
      if (LETRA.test(antes) || LETRA.test(despues)) continue; // trozo de otra palabra
      if (usado.slice(pos, pos + termino.length).some(Boolean)) continue; // ya contado

      for (let i = pos; i < pos + termino.length; i++) usado[i] = true;
      const alimento = ALIMENTOS[indice];
      // "3 huevos" son tres huevos; "3 raciones de lasaña" no multiplica igual,
      // porque el plato ya es una ración entera. Los platos se topan en 1,5.
      const bruto = multiplicador(limpio, pos);
      const veces = alimento.u ? bruto : Math.min(bruto, 1.5);
      kcal += alimento.k * veces;
      detectados.push({ nombre: termino, kcal: alimento.k * veces, grupos: alimento.g, veces });
    }
  }

  // Cuando se enumeran muchas cosas hay solape entre platos: se compensa un poco.
  if (detectados.length >= 5) kcal *= 0.88;
  else if (detectados.length === 4) kcal *= 0.94;

  const grupos = [...new Set(detectados.flatMap((d) => d.grupos))];
  return { kcal: Math.round(kcal), grupos, detectados, reconocido: detectados.length > 0 };
}

/** Estimación de una entrada concreta, ya con su momento y su cantidad. */
export function estimarComida(comida) {
  const analisis = analizarTexto(comida.texto || "");
  const factor = FACTOR_CANTIDAD[comida.cantidad] ?? 1;

  let kcal;
  let reconocido = analisis.reconocido;

  if (analisis.reconocido && analisis.kcal > 0) {
    kcal = analisis.kcal * factor;
  } else {
    kcal = (RACION_GENERICA[comida.momento] || 400) * factor;
    reconocido = false;
  }

  // Un desayuno no se come 1.500 kcal aunque enumere media despensa.
  const techo = { desayuno: 1100, comida: 1900, snack: 900, cena: 1600 }[comida.momento] || 1600;
  kcal = Math.min(kcal, techo);

  return { kcal: Math.round(kcal), grupos: analisis.grupos, detectados: analisis.detectados, reconocido };
}

/* ── valoración del día ──────────────────────────────────────────────── */

const PESO_BUENO = {
  verdura: 1.1, fruta: 0.85, legumbre: 1, pescado: 0.7, azul: 0.35,
  integral: 0.5, proteina: 0.4, lacteo: 0.25, grasa_buena: 0.3, huevo: 0.2,
};
const PESO_MALO = {
  bolleria: -1.1, dulce: -0.75, fastfood: -1.2, frito: -0.7, procesado: -0.6,
  alcohol: -0.7, azucar: -0.5, snack_salado: -0.6, carne_roja: -0.25, salsa: -0.2,
};

const TOPE_BUENO = 2.8;
const TOPE_MALO = -3.2;

function contarGrupos(estimaciones) {
  const cuenta = {};
  for (const e of estimaciones) {
    for (const g of new Set(e.grupos)) cuenta[g] = (cuenta[g] || 0) + 1;
  }
  return cuenta;
}

function etiquetaDelDia(cuenta, momentos, balance) {
  const rasgos = [];

  if ((cuenta.bolleria || 0) + (cuenta.dulce || 0) >= 2) rasgos.push("mucho dulce");
  if ((cuenta.fastfood || 0) >= 1 && (cuenta.frito || 0) >= 1) rasgos.push("bastante frito");
  else if ((cuenta.frito || 0) >= 2) rasgos.push("bastante frito");
  if ((cuenta.alcohol || 0) >= 2) rasgos.push("con alcohol");
  if (!cuenta.verdura && !cuenta.fruta) rasgos.push("sin verdura ni fruta");
  else if (!cuenta.verdura) rasgos.push("poca verdura");
  if (!cuenta.proteina && !cuenta.huevo && !cuenta.legumbre) rasgos.push("poca proteína");
  if ((cuenta.procesado || 0) >= 3) rasgos.push("muchos procesados");

  const bueno =
    (cuenta.verdura || 0) >= 2 &&
    (cuenta.proteina || cuenta.legumbre || cuenta.huevo) &&
    !(cuenta.fastfood || (cuenta.bolleria || 0) >= 2);

  let base;
  if (bueno && momentos >= 3) base = "Día completo y variado";
  else if (bueno) base = "Buena base";
  else if (balance && balance.estado === "linea") base = "Equilibrado";
  else if (momentos <= 1) base = "Solo una toma apuntada";
  else base = "Día normal";

  if (!rasgos.length) return base;
  return `${base}, ${rasgos.slice(0, 2).join(" y ")}`;
}

/**
 * Valora el día completo: rango de calorías, nota de 1 a 10 y un comentario.
 * `energia` es lo que calcula el perfil (gasto y diana); puede venir vacío.
 */
export function valorarDia(comidas, energia) {
  if (!comidas || !comidas.length) return null;

  const estimaciones = comidas.map(estimarComida);
  const kcal = estimaciones.reduce((s, e) => s + e.kcal, 0);
  const reconocidas = estimaciones.filter((e) => e.reconocido).length;
  const confianza = reconocidas / estimaciones.length;

  // El margen se abre cuando hemos reconocido poco: ser honestos con la duda.
  // Y tira hacia arriba a propósito: el aceite, el pan o el picoteo casi nunca
  // se escriben, así que lo que falta suele sumar, no restar.
  const holgura = confianza >= 0.8 ? 0.12 : confianza >= 0.5 ? 0.18 : 0.28;
  const kcalMin = Math.round((kcal * (1 - holgura)) / 10) * 10;
  const kcalMax = Math.round((kcal * (1 + holgura + 0.1)) / 10) * 10;

  const cuenta = contarGrupos(estimaciones);
  const momentos = new Set(comidas.map((c) => c.momento)).size;

  let puntos = 5;
  let sumaBuena = 0;
  let sumaMala = 0;
  for (const [grupo, veces] of Object.entries(cuenta)) {
    if (PESO_BUENO[grupo]) sumaBuena += PESO_BUENO[grupo] * Math.min(veces, 3);
    if (PESO_MALO[grupo]) sumaMala += PESO_MALO[grupo] * Math.min(veces, 3);
  }
  puntos += Math.min(TOPE_BUENO, sumaBuena);
  puntos += Math.max(TOPE_MALO, sumaMala);

  if (momentos >= 3) puntos += 0.5;
  else if (momentos === 1 && comidas.length === 1) puntos -= 0.4;

  const balance = calcularBalance(energia, kcalMin, kcalMax);
  if (balance) {
    // Quedarse muy corto tampoco es "ir bien", aunque el objetivo sea bajar.
    const pasado = Math.abs(balance.dif) > 550;
    if (balance.bueno && !pasado) puntos += 0.8;
    else if (pasado) puntos -= 1;
    else puntos -= 0.5;
  }

  const nota = Math.max(1, Math.min(10, Math.round(puntos)));
  const etiqueta = etiquetaDelDia(cuenta, momentos, balance);

  /* comentario */
  const trozos = [];
  if (balance) {
    trozos.push(
      balance.estado === "linea"
        ? `Encaja con tu diana de ${Math.round(energia.diana)} kcal.`
        : balance.estado === "debajo"
        ? `Unas ${Math.abs(balance.dif)} kcal por debajo de tu diana.`
        : `Unas ${balance.dif} kcal por encima de tu diana.`
    );
  } else {
    trozos.push(`Entre ${kcalMin} y ${kcalMax} kcal estimadas.`);
  }

  if (cuenta.verdura >= 2) trozos.push("Buena presencia de verdura.");
  else if (!cuenta.verdura && !cuenta.fruta) trozos.push("No aparece nada de verdura ni fruta en todo el día.");
  else if (!cuenta.verdura) trozos.push("Falta verdura.");

  if ((cuenta.bolleria || 0) + (cuenta.dulce || 0) >= 2) trozos.push("El dulce se repite más de la cuenta.");
  else if (cuenta.fastfood) trozos.push("Una comida de fuera pesa bastante en el total.");
  else if (!cuenta.proteina && !cuenta.legumbre && !cuenta.huevo) trozos.push("Casi no hay proteína.");

  if (confianza < 0.5) trozos.push("Con lo escrito he tenido que estimar a bulto.");

  return {
    nota,
    etiqueta,
    comentario: trozos.slice(0, 3).join(" "),
    kcal: Math.round(kcal),
    kcalMin,
    kcalMax,
    grupos: cuenta,
    confianza,
    momentos,
    detalle: estimaciones,
  };
}

/** Compara lo comido con la diana del perfil. Igual que antes, pero local. */
export function calcularBalance(energia, kcalMin, kcalMax) {
  if (!energia || !kcalMin) return null;
  const medio = (kcalMin + kcalMax) / 2;
  const dif = medio - energia.diana;
  const estado = dif < -energia.margen ? "debajo" : dif > energia.margen ? "encima" : "linea";
  const objetivo = energia.objetivo.id;

  const bueno =
    (objetivo === "bajar" && estado !== "encima") ||
    (objetivo === "subir" && estado !== "debajo") ||
    (objetivo === "mantener" && estado === "linea");

  const texto =
    estado === "linea"
      ? "En línea con tu gasto objetivo"
      : estado === "debajo"
      ? `Unas ${Math.abs(Math.round(dif / 10) * 10)} kcal por debajo`
      : `Unas ${Math.round(dif / 10) * 10} kcal por encima`;

  return { dif: Math.round(dif), estado, bueno, texto, medio: Math.round(medio) };
}
