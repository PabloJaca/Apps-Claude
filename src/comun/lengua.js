/* ─────────────────────────────────────────────────────────────────────────
   Entender español dicho en voz alta.

   Aquí no hay nada de audio ni de navegador: son funciones puras que reciben
   una frase y devuelven números y fechas. Eso es a propósito, y es lo que
   hace que esto se pueda probar en serio: el dictado es el envoltorio, y
   escribir la frase a mano tiene que funcionar exactamente igual.

   El dictado devuelve unas veces «42,30» y otras «cuarenta y dos con
   treinta», según el teléfono y según cómo se diga. Hay que entender las dos.
   ───────────────────────────────────────────────────────────────────────── */

export const sinTildes = (t) =>
  String(t == null ? "" : t)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/* Se parte por espacios y se quitan los signos, pero se conserva la palabra
   original: el concepto de un gasto se escribe como se dijo, con sus tildes. */
export function trocear(frase) {
  const brutos = String(frase == null ? "" : frase)
    .replace(/[¿?¡!;:()"“”]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return {
    brutos,
    limpios: brutos.map((p) => sinTildes(p).replace(/^[.,]+|[.,]+$/g, "")),
  };
}

/* ── números ─────────────────────────────────────────────────────────────── */

const UNIDAD = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4,
  cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
};

const HASTA_VEINTINUEVE = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintiun: 21, veintiuna: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29,
};

const DECENA = {
  treinta: 30, cuarenta: 40, cincuenta: 50,
  sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};

const CENTENA = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200,
  trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
  quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
};

/* Palabras que se pueden colar entre el número y su «y medio»: «ochenta y dos
   kilos y medio» es como habla la gente. */
const MEDIDAS = new Set([
  "euros", "euro", "pavos", "kilos", "kilo", "kg", "kgs", "gramos",
  "minutos", "minuto", "kilometros", "kilometro", "km", "metros", "veces",
  "hora", "horas",
]);

const esDigitos = (t) => /^\d[\d.,]*$/.test(t);

/**
 * Un número escrito en cifras, a la española: el punto separa miles y la coma
 * decimales. «2.100» son dos mil cien, no dos con uno.
 */
export function valorDigitos(t) {
  const s = String(t);
  if (s.includes(",")) return parseFloat(s.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, ""));
  return parseFloat(s);
}

const esNumeroSuelto = (t) =>
  UNIDAD[t] != null || HASTA_VEINTINUEVE[t] != null || DECENA[t] != null;

/* La parte entera. Se van sumando las piezas y «mil» y «millones» multiplican
   lo que llevamos acumulado: «dos mil quinientos» son 2000 + 500. */
function leerEntero(toks, i) {
  let total = 0;
  let actual = 0;
  let visto = false;
  let j = i;

  while (j < toks.length) {
    const t = toks[j];

    if (t === "y" && visto) {
      if (esNumeroSuelto(toks[j + 1])) { j++; continue; }
      break;
    }
    if (esDigitos(t)) {
      if (visto) break;                       // «42 30» son dos números, no uno
      const v = valorDigitos(t);
      if (!Number.isFinite(v)) break;
      actual += v; visto = true; j++; continue;
    }
    if (CENTENA[t] != null) { actual += CENTENA[t]; visto = true; j++; continue; }
    if (DECENA[t] != null) { actual += DECENA[t]; visto = true; j++; continue; }
    if (HASTA_VEINTINUEVE[t] != null) { actual += HASTA_VEINTINUEVE[t]; visto = true; j++; continue; }
    if (UNIDAD[t] != null) { actual += UNIDAD[t]; visto = true; j++; continue; }
    if (t === "mil") { actual = (actual || 1) * 1000; total += actual; actual = 0; visto = true; j++; continue; }
    if (t === "millon" || t === "millones") { actual = (actual || 1) * 1e6; total += actual; actual = 0; visto = true; j++; continue; }
    break;
  }

  return visto ? { valor: total + actual, fin: j } : null;
}

/**
 * Un número completo, con decimales.
 *
 * Lo de los decimales tiene truco: «con cincuenta» son cincuenta céntimos,
 * pero «con cinco» es medio euro, no cinco céntimos. Se decide por cuántas
 * cifras trae, que es como lo dice la gente.
 */
export function leerNumero(toks, i) {
  const ent = leerEntero(toks, i);
  if (!ent) return null;

  let valor = ent.valor;
  let fin = ent.fin;

  // «y medio», aunque haya una unidad de por medio.
  const salto = MEDIDAS.has(toks[fin]) ? fin + 1 : fin;
  if (toks[salto] === "y" && (toks[salto + 1] === "medio" || toks[salto + 1] === "media")) {
    valor += 0.5;
    fin = salto + 2;
  } else if (toks[fin] === "con" || toks[fin] === "coma" || toks[fin] === "punto") {
    if (toks[fin + 1] === "medio" || toks[fin + 1] === "media") {
      valor += 0.5;
      fin += 2;
    } else {
      const dec = leerEntero(toks, fin + 1);
      if (dec) {
        valor += dec.valor < 10 ? dec.valor / 10 : dec.valor / 100;
        fin = dec.fin;
      }
    }
  }

  return { valor: Math.round(valor * 100) / 100, desde: i, fin };
}

/** Todos los números de la frase, con dónde empieza y acaba cada uno. */
export function buscarNumeros(limpios) {
  const salida = [];
  let i = 0;
  while (i < limpios.length) {
    const n = leerNumero(limpios, i);
    if (n && Number.isFinite(n.valor)) { salida.push(n); i = n.fin; } else i++;
  }
  return salida;
}

/** Atajo para cuando solo interesa el valor: `aNumero("cuarenta y dos")`. */
export function aNumero(frase) {
  const n = buscarNumeros(trocear(frase).limpios)[0];
  return n ? n.valor : null;
}

/* ── fechas ──────────────────────────────────────────────────────────────── */

const DIAS_SEMANA = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};

const MESES_NOMBRE = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const aIso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const desdeIso = (s) => {
  const [a, m, d] = String(s).split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
};

const sumarDias = (iso, n) => {
  const d = desdeIso(iso);
  d.setDate(d.getDate() + n);
  return aIso(d);
};

/**
 * Cuándo pasó lo que se cuenta. Devuelve la fecha y qué trozo de la frase la
 * dijo, para poder quitarlo del texto que queda.
 *
 * Todo se interpreta hacia atrás: «el martes» es el martes que pasó, no el que
 * viene. Nadie apunta gastos del futuro.
 */
export function leerFecha(limpios, hoyIso) {
  for (let i = 0; i < limpios.length; i++) {
    const t = limpios[i];

    if (t === "hoy") return { fecha: hoyIso, desde: i, fin: i + 1 };
    if (t === "ayer") return { fecha: sumarDias(hoyIso, -1), desde: i, fin: i + 1 };
    if (t === "anteayer" || t === "antesdeayer") return { fecha: sumarDias(hoyIso, -2), desde: i, fin: i + 1 };

    if (t === "antes" && limpios[i + 1] === "de" && limpios[i + 2] === "ayer") {
      return { fecha: sumarDias(hoyIso, -2), desde: i, fin: i + 3 };
    }

    if (t === "hace") {
      const n = leerNumero(limpios, i + 1);
      if (n && (limpios[n.fin] === "dias" || limpios[n.fin] === "dia")) {
        return { fecha: sumarDias(hoyIso, -Math.round(n.valor)), desde: i, fin: n.fin + 1 };
      }
      if (n && (limpios[n.fin] === "semanas" || limpios[n.fin] === "semana")) {
        return { fecha: sumarDias(hoyIso, -7 * Math.round(n.valor)), desde: i, fin: n.fin + 1 };
      }
    }

    if (DIAS_SEMANA[t] != null) {
      const hoyD = desdeIso(hoyIso);
      const atras = (hoyD.getDay() - DIAS_SEMANA[t] + 7) % 7;
      const desde = i > 0 && limpios[i - 1] === "el" ? i - 1 : i;
      // «el lunes» dicho un lunes es hoy, no hace siete días.
      return { fecha: sumarDias(hoyIso, -atras), desde, fin: i + 1 };
    }

    /* «el 3» o «el 3 de agosto». Sin «el» delante no se toca: en «3 cañas»
       ese tres es una cantidad, no un día. */
    if (t === "el" || t === "day") {
      const salto = limpios[i + 1] === "dia" ? i + 2 : i + 1;
      const n = leerNumero(limpios, salto);
      if (n && n.valor >= 1 && n.valor <= 31 && Number.isInteger(n.valor)) {
        const hoyD = desdeIso(hoyIso);
        let mes = hoyD.getMonth();
        let ano = hoyD.getFullYear();
        let fin = n.fin;

        if (limpios[n.fin] === "de" && MESES_NOMBRE.indexOf(limpios[n.fin + 1]) >= 0) {
          mes = MESES_NOMBRE.indexOf(limpios[n.fin + 1]);
          fin = n.fin + 2;
          if (mes > hoyD.getMonth()) ano -= 1;
        } else if (n.valor > hoyD.getDate()) {
          // Un día que aún no ha llegado es del mes pasado.
          mes -= 1;
          if (mes < 0) { mes = 11; ano -= 1; }
        }
        return { fecha: aIso(new Date(ano, mes, n.valor)), desde: i, fin };
      }
    }
  }
  return null;
}

/* ── juntar lo que sobra ─────────────────────────────────────────────────── */

/**
 * Lo que queda de la frase después de quitarle los trozos ya entendidos.
 * De ahí sale el concepto del gasto o el texto de la comida: lo que no era ni
 * un importe, ni una fecha, ni una categoría.
 */
export function restar(brutos, rangos, sobras = new Set()) {
  const fuera = new Set();
  for (const { desde, fin } of rangos) {
    for (let i = desde; i < fin; i++) fuera.add(i);
  }
  return brutos
    .filter((_, i) => !fuera.has(i))
    .filter((p) => !sobras.has(sinTildes(p).replace(/^[.,]+|[.,]+$/g, "")))
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.]+|[\s,.]+$/g, "")
    .trim();
}

/** «mercadona» → «Mercadona». Solo la primera, que los nombres van como van. */
export const capitalizar = (t) => {
  const s = String(t || "").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "";
};
