/* Pruebas del motor de fusión: la garantía de que usar las apps en dos
   dispositivos no pierde datos.  Ejecutar con: node pruebas/fusion.mjs  */

import { fusionar, ponerEnColeccion, quitarDeColeccion, tocarCampo } from "../src/comun/fusion.js";

const ESQ = { colecciones: ["gastos"], sellos: ["ajustes"] };
const base = () => ({ gastos: [], ajustes: { presupuestoGlobal: null }, borrados: {}, sellos: {} });
let fallos = 0;
const check = (nombre, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${nombre}${cond ? "" : "  ← " + extra}`);
  if (!cond) fallos++;
};

// 1. Cada dispositivo añade algo distinto: deben quedar los dos.
let movil = ponerEnColeccion(base(), "gastos", { id: "a", importe: 10 });
let pc = ponerEnColeccion(base(), "gastos", { id: "b", importe: 20 });
let r = fusionar(movil, pc, ESQ);
check("dos altas en paralelo se conservan", r.gastos.length === 2, JSON.stringify(r.gastos));

// 2. Edición posterior gana sobre la anterior.
let v1 = ponerEnColeccion(base(), "gastos", { id: "a", importe: 10 });
await new Promise((s) => setTimeout(s, 5));
let v2 = ponerEnColeccion(v1, "gastos", { id: "a", importe: 99 });
r = fusionar(v1, v2, ESQ);
check("gana la edición más reciente", r.gastos[0].importe === 99);
r = fusionar(v2, v1, ESQ);
check("da igual el orden de fusión", r.gastos[0].importe === 99);

// 3. Borrado en un dispositivo se propaga y no revive.
let conDato = ponerEnColeccion(base(), "gastos", { id: "a", importe: 10 });
await new Promise((s) => setTimeout(s, 5));
let borrado = quitarDeColeccion(conDato, "gastos", "a");
r = fusionar(conDato, borrado, ESQ);
check("el borrado gana al registro viejo", r.gastos.length === 0, JSON.stringify(r.gastos));
r = fusionar(borrado, conDato, ESQ);
check("el borrado no revive al fusionar al revés", r.gastos.length === 0);

// 4. Pero si lo editas DESPUÉS de borrarlo en el otro, se queda.
await new Promise((s) => setTimeout(s, 5));
let reeditado = ponerEnColeccion(conDato, "gastos", { id: "a", importe: 55 });
r = fusionar(borrado, reeditado, ESQ);
check("una edición posterior al borrado se respeta", r.gastos.length === 1 && r.gastos[0].importe === 55);

// 5. Campos sueltos: gana el sello más reciente.
let ajA = tocarCampo(base(), "ajustes", { presupuestoGlobal: 500 });
await new Promise((s) => setTimeout(s, 5));
let ajB = tocarCampo(base(), "ajustes", { presupuestoGlobal: 900 });
r = fusionar(ajA, ajB, ESQ);
check("gana el ajuste más reciente", r.ajustes.presupuestoGlobal === 900);

// 6. Datos antiguos (mod ausente) nunca pisan a los nuevos.
const viejo = { gastos: [{ id: "a", importe: 1 }], ajustes: {}, borrados: {}, sellos: {} };
const nuevo = ponerEnColeccion(base(), "gastos", { id: "a", importe: 77 });
r = fusionar(viejo, nuevo, ESQ);
check("un registro sin marca no pisa al nuevo", r.gastos[0].importe === 77);

// 7. Idempotencia: fusionar dos veces da lo mismo.
const una = fusionar(movil, pc, ESQ);
const dos = fusionar(una, fusionar(movil, pc, ESQ), ESQ);
check("la fusión es idempotente", JSON.stringify(una.gastos.map(g=>g.id).sort()) === JSON.stringify(dos.gastos.map(g=>g.id).sort()));

// 8. Escenario largo: móvil offline una semana mientras el PC trabaja.
let comun = base();
for (const id of ["x", "y", "z"]) comun = ponerEnColeccion(comun, "gastos", { id, importe: 5 });
let movilOff = { ...comun };
let pcOn = quitarDeColeccion(ponerEnColeccion(comun, "gastos", { id: "w", importe: 8 }), "gastos", "y");
await new Promise((s) => setTimeout(s, 5));
movilOff = ponerEnColeccion(movilOff, "gastos", { id: "m", importe: 3 });
r = fusionar(movilOff, pcOn, ESQ);
const ids = r.gastos.map((g) => g.id).sort().join(",");
check("móvil offline + PC activo → nada se pierde salvo lo borrado", ids === "m,w,x,z", ids);

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
