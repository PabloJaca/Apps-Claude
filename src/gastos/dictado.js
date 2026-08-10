/* ─────────────────────────────────────────────────────────────────────────
   De una frase suelta a un apunte.

       «cuarenta y dos con treinta en el Mercadona»
        → 42,30 · Comida · «Mercadona» · hoy

   Esto no es un modelo de lenguaje ni lo pretende: es un intérprete de un
   dominio muy pequeño. Lo que lo hace funcionar de verdad no es el
   diccionario, es tu propio historial. Si «Mercadona» lo has apuntado doce
   veces en Comida, la categoría no se adivina: se sabe. Y eso mejora solo con
   el uso, sin nada montado por detrás.

   Nunca guarda: devuelve un borrador para que la hoja se abra rellenada y se
   confirme. Un fallo aquí tiene que costar un toque, no un dato malo.
   ───────────────────────────────────────────────────────────────────────── */

import {
  buscarNumeros, capitalizar, leerFecha, restar, sinTildes, trocear,
} from "../comun/lengua.js";
import { adivinarIcono, hoyISO, huella, ORIGENES } from "./nucleo.js";

/* Palabras que no dicen nada del apunte y solo estorban en el concepto. */
const RELLENO = new Set([
  "he", "ha", "han", "me", "se", "de", "del", "en", "el", "la", "los", "las",
  "un", "una", "unos", "unas", "al", "por", "para", "y", "que", "es", "son",
  "gastado", "gastar", "gaste", "gasto", "pagado", "pagar", "pague",
  "comprado", "comprar", "compre", "costado", "costar", "puesto",
  "ingresado", "ingresar", "cobrado", "cobrar", "cobre", "entrado",
  "euros", "euro", "pavos", "eur", "apunta", "apuntar", "apunte", "anota",
  "cuesta", "salido", "llevado", "dejado", "sido", "fue",
]);

/* Lo que convierte la frase en un ingreso en vez de en un gasto. Ojo con
   «me han pagado», que es lo contrario de «he pagado»: manda el pronombre. */
const SENAS_INGRESO = [
  /\bme han (ingresado|pagado|devuelto|abonado)\b/,
  /\bme (ingresaron|pagaron|devolvieron|han hecho)\b/,
  /\bhe (cobrado|ingresado)\b/,
  /\b(cobre|ingrese)\b/,
  /\b(nomina|paga extra|devolucion|hacienda|reembolso)\b/,
  /\bingreso de\b/,
];

const ORIGEN_POR_SENA = [
  [/\bnomina|sueldo|salario|paga\b/, "nomina"],
  [/\bdevolucion|devuelto|hacienda|reembolso|abono\b/, "devolucion"],
  [/\bextra|bonus|regalo|vendido|venta\b/, "extra"],
];

/**
 * De qué categoría es esto.
 *
 * En este orden, y el orden es lo importante:
 *   1. Lo que hiciste otras veces con ese mismo concepto.
 *   2. El nombre de una de tus categorías, dicho tal cual.
 *   3. El diccionario de pistas, que ya existía para elegir iconos.
 *
 * El paso 3 tiene una vuelta de tuerca: las pistas dan un icono, no una
 * categoría, así que se busca la categoría que use ese icono. Así respeta tus
 * categorías propias en vez de imponer unas fijas.
 */
export function adivinarCategoria(texto, datos) {
  const cats = (datos && datos.categorias) || [];
  if (!cats.length) return null;
  const clave = huella(texto);
  if (!clave) return null;

  // 1. Tu historial: gana el concepto que más veces hayas apuntado igual.
  const votos = new Map();
  for (const g of (datos && datos.gastos) || []) {
    if (!g || !g.nota || !g.categoria) continue;
    const h = huella(g.nota);
    if (!h) continue;
    if (h === clave || clave.includes(h) || h.includes(clave)) {
      const exacto = h === clave;
      votos.set(g.categoria, (votos.get(g.categoria) || 0) + (exacto ? 3 : 1));
    }
  }
  if (votos.size) {
    const [mejor] = [...votos.entries()].sort((a, b) => b[1] - a[1]);
    if (cats.some((c) => c.id === mejor[0])) return mejor[0];
  }

  // 2. El nombre de una categoría tuya, dicho en la frase.
  for (const c of cats) {
    const h = huella(c.nombre);
    if (h && clave.split(" ").includes(h)) return c.id;
  }

  // 3. Las pistas de siempre, traducidas a través del icono.
  const icono = adivinarIcono(texto);
  if (icono && icono !== "package") {
    const porIcono = cats.find((c) => c.icono === icono);
    if (porIcono) return porIcono.id;
  }

  return null;
}

/**
 * La frase entera, repartida.
 *
 * `confianza` no es una probabilidad: dice cuántas de las tres piezas
 * (importe, categoría, concepto) han salido de algo y no de un valor por
 * defecto. Sirve para decidir si la hoja se abre con un aviso o sin él.
 */
export function interpretarGasto(frase, datos, hoy = hoyISO()) {
  const { brutos, limpios } = trocear(frase);
  const plano = limpios.join(" ");
  if (!plano) return null;

  const esIngreso = SENAS_INGRESO.some((re) => re.test(plano));

  const fecha = leerFecha(limpios, hoy);
  const rangos = fecha ? [fecha] : [];

  /* El importe es el número más grande que no sea el día del mes: en «42,30 el
     3» el gasto son 42,30, no 3. Como el día ya se ha sacado antes, aquí basta
     con coger el mayor de los que quedan. */
  const dentroDeFecha = (n) => fecha && n.desde >= fecha.desde && n.fin <= fecha.fin;
  const numeros = buscarNumeros(limpios).filter((n) => !dentroDeFecha(n));
  const importe = numeros.length
    ? numeros.reduce((a, b) => (b.valor > a.valor ? b : a))
    : null;
  if (importe) rangos.push(importe);

  const concepto = restar(brutos, rangos, RELLENO);
  const categoria = esIngreso ? null : adivinarCategoria(concepto || plano, datos);

  let origen = null;
  if (esIngreso) {
    for (const [re, id] of ORIGEN_POR_SENA) if (re.test(plano)) { origen = id; break; }
    if (!origen) origen = ORIGENES[0].id;
  }

  const piezas = [importe ? 1 : 0, categoria || origen ? 1 : 0, concepto ? 1 : 0];

  return {
    tipo: esIngreso ? "ingreso" : "gasto",
    importe: importe ? importe.valor : null,
    categoria,
    origen,
    nota: capitalizar(concepto),
    fecha: fecha ? fecha.fecha : hoy,
    dijoFecha: Boolean(fecha),
    confianza: piezas.reduce((a, b) => a + b, 0),
  };
}

/* Ejemplos que se enseñan en la hoja de dictado. Van aquí y no en la pantalla
   porque son parte del contrato: si dejaran de funcionar, las pruebas caen. */
export const EJEMPLOS_GASTOS = [
  "42,30 en el Mercadona",
  "he gastado veinte euros de gasolina ayer",
  "me han ingresado la nómina, 2.100",
];
