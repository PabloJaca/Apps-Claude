/* ─────────────────────────────────────────────────────────────────────────
   Bloqueo con PIN.

   QUÉ ES Y QUÉ NO ES, porque decirlo mal sería peor que no tenerlo:

   Esto tapa la pantalla. Sirve para lo que de verdad pasa —el móvil
   desbloqueado encima de una mesa, alguien que coge tu portátil un momento—
   y no sirve para nada más. Los datos siguen en Firestore igual que antes, y
   quien sepa abrir las herramientas del navegador puede saltárselo borrando
   una clave. Quien protege tus datos de verdad es tu contraseña y las reglas
   del servidor; esto es la puerta del baño, no la caja fuerte.

   Por eso el PIN vive en este aparato y no en la cuenta: es un bloqueo de
   pantalla, no una credencial. Cambiarlo aquí no te echa de tus otros
   dispositivos, y perderlo no te deja fuera de tus datos — se cierra sesión
   y se vuelve a entrar con el correo.

   Aun así se guarda con su resumen criptográfico y su sal, nunca en claro:
   que el bloqueo sea modesto no es excusa para dejar el número escrito.
   ───────────────────────────────────────────────────────────────────────── */

const CLAVE = (uid) => `misapps_bloqueo_${uid}`;
const CLAVE_VISTO = (uid) => `misapps_bloqueo_visto_${uid}`;

/** Minutos fuera de la app antes de volver a pedirlo. */
export const MINUTOS_GRACIA = 2;

export const LARGO_MINIMO = 4;
export const LARGO_MAXIMO = 8;

const almacen = () => {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch (e) {
    return null;   // navegador con el almacenamiento capado
  }
};

const leer = (clave) => {
  const ls = almacen();
  if (!ls) return null;
  try {
    const crudo = ls.getItem(clave);
    return crudo ? JSON.parse(crudo) : null;
  } catch (e) {
    return null;
  }
};

const escribir = (clave, valor) => {
  const ls = almacen();
  if (!ls) return false;
  try {
    ls.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (e) {
    return false;
  }
};

/** Hace falta `crypto.subtle`, que solo existe en https (y en localhost). */
export const hayCripto = () =>
  typeof crypto !== "undefined" && crypto.subtle && typeof crypto.getRandomValues === "function";

const aHex = (buffer) =>
  [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * El resumen del PIN.
 *
 * Con sal por aparato: sin ella, dos personas con el mismo PIN tendrían el
 * mismo resumen y bastaría una tabla de cuatro cifras para leerlos todos.
 */
async function amasar(pin, sal) {
  const datos = new TextEncoder().encode(`misapps:${sal}:${pin}`);
  return aHex(await crypto.subtle.digest("SHA-256", datos));
}

export const pinValido = (pin) =>
  typeof pin === "string" && new RegExp(`^\\d{${LARGO_MINIMO},${LARGO_MAXIMO}}$`).test(pin);

/** Si esta cuenta tiene bloqueo puesto en este aparato. */
export function tienePin(uid) {
  const g = leer(CLAVE(uid));
  return Boolean(g && g.hash && g.sal);
}

export async function ponerPin(uid, pin) {
  if (!uid || !pinValido(pin) || !hayCripto()) return false;
  const sal = aHex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await amasar(pin, sal);
  const ok = escribir(CLAVE(uid), { sal, hash, creado: Date.now() });
  if (ok) marcarVisto(uid);
  return ok;
}

export async function comprobarPin(uid, pin) {
  const g = leer(CLAVE(uid));
  if (!g || !g.hash || !hayCripto()) return false;
  const hash = await amasar(String(pin || ""), g.sal);
  /* Comparación de longitud constante: aquí el riesgo es teórico, pero
     escribir `===` en una comprobación de secreto se acaba copiando. */
  if (hash.length !== g.hash.length) return false;
  let diferencia = 0;
  for (let i = 0; i < hash.length; i++) diferencia |= hash.charCodeAt(i) ^ g.hash.charCodeAt(i);
  return diferencia === 0;
}

export function quitarPin(uid) {
  const ls = almacen();
  if (!ls) return;
  try {
    ls.removeItem(CLAVE(uid));
    ls.removeItem(CLAVE_VISTO(uid));
  } catch (e) {
    /* si no deja borrar, tampoco había podido guardar */
  }
}

/** Se apunta cuándo se desbloqueó, para no volver a pedirlo a cada rato. */
export function marcarVisto(uid) {
  escribir(CLAVE_VISTO(uid), { ts: Date.now() });
}

/**
 * Si toca pedir el PIN.
 *
 * Al abrir la aplicación de cero, siempre. Al volver de segundo plano, solo si
 * han pasado los minutos de gracia: pedirlo cada vez que sales a mirar el
 * banco es la forma más rápida de que la gente lo quite.
 */
export function debeBloquear(uid, { arranque = true, minutos = MINUTOS_GRACIA } = {}) {
  if (!tienePin(uid)) return false;
  if (arranque) return true;
  const visto = leer(CLAVE_VISTO(uid));
  if (!visto || !visto.ts) return true;
  return Date.now() - visto.ts > minutos * 60000;
}

/** Cuánto esperar tras fallar. Sube, pero no castiga de por vida. */
export function esperaTrasFallos(fallos) {
  if (fallos < 3) return 0;
  return Math.min(30, 2 ** (fallos - 2));   // 2 s, 4 s, 8 s… hasta 30
}
