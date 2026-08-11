/* El bloqueo con PIN.

   Es un cierre de pantalla, no una caja fuerte, y las pruebas van a la altura
   de lo que promete: que el número no se guarde en claro, que no se acepte
   uno que no es, que fallar cueste esperar y que el candado sea de este
   aparato y no de la cuenta.

   node pruebas/bloqueo.mjs */

import { webcrypto } from "node:crypto";

/* Node no trae `localStorage` ni `crypto` global como el navegador: se ponen
   los dos antes de cargar el módulo, que es exactamente lo que verá allí. */
const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
  clear: () => memoria.clear(),
};
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const b = await import("../src/comun/bloqueo.js");

let fallos = 0;
const check = (n, c, extra = "") => { console.log(`${c ? "✓" : "✗"} ${n}${c ? "" : "  ← " + extra}`); if (!c) fallos++; };

const UID = "uid_pablo";
const OTRO = "uid_ana";

/* ── qué se acepta como PIN ──────────────────────────────────────────────── */

check("PIN: cuatro cifras valen", b.pinValido("1234"));
check("PIN: ocho también", b.pinValido("12345678"));
check("PIN: tres se quedan cortas", !b.pinValido("123"));
check("PIN: nueve se pasan", !b.pinValido("123456789"));
check("PIN: con letras no", !b.pinValido("12a4"));
check("PIN: vacío no", !b.pinValido(""));
check("PIN: un número no es una cadena", !b.pinValido(1234));

/* ── poner y comprobar ───────────────────────────────────────────────────── */

check("antes de ponerlo, no hay bloqueo", b.tienePin(UID) === false);
check("y no se desbloquea con nada", (await b.comprobarPin(UID, "1234")) === false);

check("se pone", (await b.ponerPin(UID, "4721")) === true);
check("y consta que está puesto", b.tienePin(UID) === true);
check("el bueno abre", (await b.comprobarPin(UID, "4721")) === true);
check("uno cualquiera no", (await b.comprobarPin(UID, "4722")) === false);
check("uno más largo tampoco", (await b.comprobarPin(UID, "47210")) === false);
check("ni el vacío", (await b.comprobarPin(UID, "")) === false);
check("ni undefined", (await b.comprobarPin(UID, undefined)) === false);

/* Lo importante: en el almacén no puede estar el número. */
const guardado = JSON.parse(memoria.get("misapps_bloqueo_" + UID));
check("no se guarda el PIN en claro", !JSON.stringify(guardado).includes("4721"), JSON.stringify(guardado));
check("se guarda un resumen de 64 caracteres", /^[0-9a-f]{64}$/.test(guardado.hash), guardado.hash);
check("y una sal", /^[0-9a-f]{32}$/.test(guardado.sal), guardado.sal);

/* Dos cuentas con el mismo PIN no pueden dar el mismo resumen. */
await b.ponerPin(OTRO, "4721");
const otroGuardado = JSON.parse(memoria.get("misapps_bloqueo_" + OTRO));
check("dos personas con el mismo PIN tienen resúmenes distintos",
  guardado.hash !== otroGuardado.hash, `${guardado.hash.slice(0, 12)} vs ${otroGuardado.hash.slice(0, 12)}`);
check("porque la sal es distinta", guardado.sal !== otroGuardado.sal);

/* ── cada cuenta con lo suyo ─────────────────────────────────────────────── */

await b.ponerPin(OTRO, "9999");
check("el PIN de una cuenta no abre la otra", (await b.comprobarPin(UID, "9999")) === false);
check("y cada una abre con el suyo",
  (await b.comprobarPin(UID, "4721")) && (await b.comprobarPin(OTRO, "9999")));

b.quitarPin(OTRO);
check("quitarlo de una no toca la otra", b.tienePin(OTRO) === false && b.tienePin(UID) === true);

/* ── cuándo se pide ──────────────────────────────────────────────────────── */

check("al arrancar siempre se pide", b.debeBloquear(UID, { arranque: true }) === true);
b.marcarVisto(UID);
check("recién desbloqueado y volviendo enseguida, no se pide",
  b.debeBloquear(UID, { arranque: false, minutos: 2 }) === false);
/* Se envejece la marca a mano en vez de esperar: si no, la prueba mide el
   reloj de la máquina y falla el día que va rápida. */
memoria.set(`misapps_bloqueo_visto_${UID}`, JSON.stringify({ ts: Date.now() - 5 * 60000 }));
check("pero volviendo cinco minutos después, sí",
  b.debeBloquear(UID, { arranque: false, minutos: 2 }) === true);
check("y con la gracia más larga que la ausencia, no",
  b.debeBloquear(UID, { arranque: false, minutos: 10 }) === false);
b.marcarVisto(UID);
check("una cuenta sin PIN nunca se bloquea",
  b.debeBloquear("uid_sin_pin", { arranque: true }) === false);

/* ── fallar cuesta ───────────────────────────────────────────────────────── */

check("los dos primeros fallos no castigan", b.esperaTrasFallos(1) === 0 && b.esperaTrasFallos(2) === 0);
check("el tercero ya espera", b.esperaTrasFallos(3) === 2, String(b.esperaTrasFallos(3)));
check("y va subiendo", b.esperaTrasFallos(4) === 4 && b.esperaTrasFallos(5) === 8);
check("pero tiene techo: no te deja fuera de por vida",
  b.esperaTrasFallos(50) === 30, String(b.esperaTrasFallos(50)));

/* ── que no se rompa sin nada de lo que necesita ─────────────────────────── */

check("sin uid no se pone", (await b.ponerPin("", "1234")) === false);
check("con un PIN inválido no se pone", (await b.ponerPin("uid_x", "12")) === false);
check("quitar algo que no existe no revienta", (() => { b.quitarPin("uid_fantasma"); return true; })());

/* Un almacén roto —modo privado de algunos navegadores— no puede tumbar nada. */
const bueno = globalThis.localStorage;
globalThis.localStorage = {
  getItem: () => { throw new Error("bloqueado"); },
  setItem: () => { throw new Error("bloqueado"); },
  removeItem: () => { throw new Error("bloqueado"); },
};
check("con el almacén capado, no hay bloqueo pero tampoco error", b.tienePin(UID) === false);
check("y guardar devuelve que no ha podido", (await b.ponerPin(UID, "1234")) === false);
globalThis.localStorage = bueno;

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
