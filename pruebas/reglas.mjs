/* ─────────────────────────────────────────────────────────────────────────
   Las reglas de Firestore, ejecutadas de verdad.

   No se comprueba que el archivo «parezca» correcto: se levanta el emulador
   de Firestore con `firestore.rules` tal cual se publica y se intentan hacer
   las cosas que no deben poder hacerse. Si una regla se afloja sin querer,
   aquí salta.

   Se lanza solo desde `npm run probar-reglas`, que arranca el emulador.
   ───────────────────────────────────────────────────────────────────────── */

import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";

let fallos = 0;
const check = async (nombre, promesa) => {
  try {
    await promesa;
    console.log(`✓ ${nombre}`);
  } catch (e) {
    console.log(`✗ ${nombre}\n    ${String(e).split("\n")[0]}`);
    fallos++;
  }
};

const entorno = await initializeTestEnvironment({
  projectId: "reglas-de-prueba",
  firestore: {
    rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
    host: "127.0.0.1",
    port: 8080,
  },
});

/* La lista de invitados la escribe la consola, no la app: se siembra saltándose
   las reglas, que es justo lo que hace una persona desde la consola. */
await entorno.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "permitidos", "ana@ejemplo.com"), { nombre: "Ana" });
  await setDoc(doc(db, "usuarios", "ana"), { email: "ana@ejemplo.com" });
  await setDoc(doc(db, "usuarios", "ana", "pesos", "p1"), { fecha: "2026-08-03", kg: 80 });
  await setDoc(doc(db, "usuarios", "colada", "pesos", "p1"), { fecha: "2026-08-03", kg: 99 });
});

const como = (uid, email) =>
  entorno.authenticatedContext(uid, email ? { email, email_verified: false } : {}).firestore();

const ana = como("ana", "ana@ejemplo.com");
const intrusa = como("intrusa", "intrusa@ejemplo.com");   // cuenta creada, sin invitación
const anonima = entorno.unauthenticatedContext().firestore();

const PESO = { fecha: "2026-08-07", kg: 79.4, nota: "en ayunas" };

/* ── 1. Sin sesión no se llega a nada ────────────────────────────────────── */

await check("sin sesión no se puede leer", assertFails(getDoc(doc(anonima, "usuarios", "ana"))));
await check("sin sesión no se puede escribir", assertFails(setDoc(doc(anonima, "usuarios", "ana", "pesos", "x"), PESO)));
await check("sin sesión no se ve la lista de invitados", assertFails(getDoc(doc(anonima, "permitidos", "ana@ejemplo.com"))));

/* ── 2. Con sesión, pero sin invitación ──────────────────────────────────── */

await check("sin invitación no se puede escribir en lo propio", assertFails(setDoc(doc(intrusa, "usuarios", "intrusa", "pesos", "x"), PESO)));
await check("sin invitación no se puede leer lo propio", assertFails(getDoc(doc(intrusa, "usuarios", "intrusa"))));
await check("sin invitación tampoco se crea el documento de usuario", assertFails(setDoc(doc(intrusa, "usuarios", "intrusa"), { email: "intrusa@ejemplo.com" })));
await check("cada cual puede consultar su propia entrada de la lista", assertSucceeds(getDoc(doc(intrusa, "permitidos", "intrusa@ejemplo.com"))));
await check("pero no la de otra persona", assertFails(getDoc(doc(intrusa, "permitidos", "ana@ejemplo.com"))));
await check("ni darse de alta a sí misma", assertFails(setDoc(doc(intrusa, "permitidos", "intrusa@ejemplo.com"), { nombre: "yo" })));

/* ── 3. Invitada: lo suyo sí, lo de otra persona no ──────────────────────── */

await check("invitada: escribe en lo suyo", assertSucceeds(setDoc(doc(ana, "usuarios", "ana", "pesos", "p2"), PESO)));
await check("invitada: lee lo suyo", assertSucceeds(getDoc(doc(ana, "usuarios", "ana", "pesos", "p1"))));
await check("invitada: lista lo suyo", assertSucceeds(getDocs(collection(ana, "usuarios", "ana", "pesos"))));
await check("invitada: borra lo suyo", assertSucceeds(deleteDoc(doc(ana, "usuarios", "ana", "pesos", "p2"))));

await check("NO puede leer la carpeta de otra cuenta", assertFails(getDoc(doc(ana, "usuarios", "colada", "pesos", "p1"))));
await check("NO puede listar la carpeta de otra cuenta", assertFails(getDocs(collection(ana, "usuarios", "colada", "pesos"))));
await check("NO puede escribir en la carpeta de otra cuenta", assertFails(setDoc(doc(ana, "usuarios", "colada", "pesos", "x"), PESO)));
await check("NO puede borrar en la carpeta de otra cuenta", assertFails(deleteDoc(doc(ana, "usuarios", "colada", "pesos", "p1"))));
await check("NO puede borrar su documento de usuario entero", assertFails(deleteDoc(doc(ana, "usuarios", "ana"))));

/* ── 4. Validación: forma y tamaño de lo que se escribe ──────────────────── */

const guarda = (col, datos) => setDoc(doc(ana, "usuarios", "ana", col, "v"), datos);

await check("peso: rechaza un valor imposible", assertFails(guarda("pesos", { fecha: "2026-08-07", kg: 5000 })));
await check("peso: rechaza kg que no es número", assertFails(guarda("pesos", { fecha: "2026-08-07", kg: "mucho" })));
await check("peso: rechaza sin fecha", assertFails(guarda("pesos", { kg: 80 })));
await check("peso: rechaza una fecha con mala pinta", assertFails(guarda("pesos", { fecha: "7 de agosto", kg: 80 })));
await check("peso: rechaza una nota kilométrica", assertFails(guarda("pesos", { fecha: "2026-08-07", kg: 80, nota: "x".repeat(500) })));
await check("peso: acepta uno normal", assertSucceeds(guarda("pesos", PESO)));

await check("comida: rechaza un texto de 10.000 caracteres", assertFails(guarda("comidas", { fecha: "2026-08-07", texto: "x".repeat(10000), volumen: 3 })));
await check("comida: rechaza un volumen fuera de escala", assertFails(guarda("comidas", { fecha: "2026-08-07", texto: "arroz", volumen: 99 })));
await check("comida: acepta una normal", assertSucceeds(guarda("comidas", { fecha: "2026-08-07", texto: "arroz con pollo", volumen: 3, saciedad: 2, momento: "comida", ts: 1 })));
await check("comida: acepta que falte la saciedad", assertSucceeds(guarda("comidas", { fecha: "2026-08-07", texto: "arroz", volumen: 3, saciedad: null, momento: "cena", ts: 2 })));

await check("entreno: rechaza 40 horas de gimnasio", assertFails(guarda("entrenos", { fecha: "2026-08-07", tipo: "fuerza", minutos: 2400 })));
await check("entreno: acepta uno normal", assertSucceeds(guarda("entrenos", { fecha: "2026-08-07", tipo: "fuerza", minutos: 60, intensidad: "media", ts: 1 })));
await check("entreno: acepta uno sin minutos, si trae ejercicios", assertSucceeds(guarda("entrenos", {
  fecha: "2026-08-07", tipo: "fuerza", ts: 1,
  ejercicios: [{ nombre: "Press banca", series: [{ reps: 8, kg: 80, rir: 2 }, { reps: 6, kg: 82.5 }] },
               { nombre: "Dominadas", series: [{ reps: 10, kg: null }] }],
})));
await check("entreno: acepta cardio con distancia", assertSucceeds(guarda("entrenos", { fecha: "2026-08-07", tipo: "cardio", minutos: 45, km: 8.2, ts: 1 })));
await check("entreno: rechaza una distancia absurda", assertFails(guarda("entrenos", { fecha: "2026-08-07", tipo: "cardio", minutos: 45, km: 99999 })));
await check("entreno: rechaza treinta y pico ejercicios", assertFails(guarda("entrenos", {
  fecha: "2026-08-07", tipo: "fuerza", ts: 1,
  ejercicios: Array.from({ length: 40 }, (_, i) => ({ nombre: `E${i}`, series: [{ reps: 8, kg: 20 }] })),
})));
await check("entreno: rechaza ejercicios que no son una lista", assertFails(guarda("entrenos", {
  fecha: "2026-08-07", tipo: "fuerza", ts: 1, ejercicios: "press banca",
})));

await check("entreno: acepta que venga de una plantilla", assertSucceeds(guarda("entrenos", {
  fecha: "2026-08-07", tipo: "fuerza", minutos: 60, intensidad: "media", ts: 1, plantilla: "p1",
  ejercicios: [{ nombre: "Press banca", series: [{ reps: 8, kg: 80 }] }],
})));
await check("entreno: rechaza una plantilla que sea una parrafada", assertFails(guarda("entrenos", {
  fecha: "2026-08-07", tipo: "fuerza", minutos: 60, plantilla: "x".repeat(400),
})));

/* Un entreno que no es de pesas también puede llevar ejercicios: un día de
   pádel con core detrás. Las reglas no miran el tipo para decidir si acepta
   `ejercicios`, y esta prueba fija que siga siendo así. */
await check("entreno: acepta ejercicios sueltos en un entreno de equipo", assertSucceeds(guarda("entrenos", {
  fecha: "2026-08-07", tipo: "equipo", minutos: 90, intensidad: "media", ts: 1, plantilla: "p2",
  ejercicios: [{ nombre: "Plancha", series: [{ reps: 60, kg: null }] }],
})));
await check("entreno: y en uno de cardio con distancia", assertSucceeds(guarda("entrenos", {
  fecha: "2026-08-07", tipo: "cardio", minutos: 45, km: 8, intensidad: "alta", ts: 1, plantilla: "p3",
  ejercicios: [{ nombre: "Abdominales", series: [{ reps: 20, kg: null }] }],
})));

/* Las plantillas son la única colección sin fecha: no se hicieron ningún día.
   Por eso tienen su propia función en las reglas y no reaprovechan `entrenoOk`. */
await check("plantilla: acepta una de fuerza", assertSucceeds(guarda("plantillas", {
  nombre: "Empuje", tipo: "fuerza", minutos: 60, intensidad: "fuerte", km: null, orden: 0,
  ejercicios: [{ nombre: "Press banca", series: [{ reps: 8, kg: 80 }] }],
})));
await check("plantilla: acepta una sin ejercicios (un partido de pádel)", assertSucceeds(guarda("plantillas", {
  nombre: "Pádel", tipo: "equipo", minutos: 90, intensidad: "media", km: null, orden: 1, ejercicios: [],
})));
await check("plantilla: rechaza una sin nombre", assertFails(guarda("plantillas", { tipo: "fuerza", minutos: 60 })));
await check("plantilla: rechaza un nombre de 500 caracteres", assertFails(guarda("plantillas", { nombre: "x".repeat(500), tipo: "fuerza" })));
await check("plantilla: rechaza 40 horas de duración", assertFails(guarda("plantillas", { nombre: "X", tipo: "fuerza", minutos: 2400 })));
await check("plantilla: rechaza treinta y pico ejercicios", assertFails(guarda("plantillas", {
  nombre: "Bestia", tipo: "fuerza",
  ejercicios: Array.from({ length: 40 }, (_, i) => ({ nombre: `E${i}`, series: [{ reps: 8, kg: 20 }] })),
})));
await check("plantilla: rechaza ejercicios que no son una lista", assertFails(guarda("plantillas", {
  nombre: "X", tipo: "fuerza", ejercicios: "press banca",
})));
await check("plantilla: rechaza un orden absurdo", assertFails(guarda("plantillas", { nombre: "X", tipo: "fuerza", orden: 99999 })));

await check("gasto: rechaza un importe desorbitado", assertFails(guarda("gastos", { fecha: "2026-08-07", importe: 99999999, categoria: "comida" })));
await check("gasto: acepta uno normal", assertSucceeds(guarda("gastos", { fecha: "2026-08-07", importe: 23.5, categoria: "comida", nota: "cena" })));

await check("categoría: acepta una normal", assertSucceeds(guarda("categorias", { nombre: "Comida", color: "#F4614E", icono: "utensils", presupuesto: null, orden: 0 })));
await check("fijo: acepta uno normal", assertSucceeds(guarda("fijos", { nombre: "Alquiler", importe: 750, categoria: "casa", dia: 1, desde: "2026-01", hasta: null })));
await check("fijo: rechaza un día de mes imposible", assertFails(guarda("fijos", { nombre: "X", importe: 10, categoria: "casa", dia: 99, desde: "2026-01" })));
await check("fijo: acepta la nómina como ingreso fijo", assertSucceeds(guarda("fijos", { tipo: "ingreso", nombre: "Nómina", importe: 2000, categoria: "otros", origen: "nomina", dia: 1, desde: "2026-01", hasta: null })));
await check("fijo: rechaza un origen que sea una parrafada", assertFails(guarda("fijos", { tipo: "ingreso", nombre: "N", importe: 10, categoria: "otros", origen: "x".repeat(400), dia: 1, desde: "2026-01" })));

await check("rechaza un documento con un montón de campos", assertFails(
  guarda("pesos", Object.fromEntries([["fecha", "2026-08-07"], ["kg", 80], ...Array.from({ length: 40 }, (_, i) => [`relleno${i}`, i])]))
));

/* ── 4bis. El documento del usuario ──────────────────────────────────────── */

const usuario = (datos) => setDoc(doc(ana, "usuarios", "ana"), datos, { merge: true });

await check("usuario: acepta el perfil", assertSucceeds(usuario({
  perfil: { altura: "180", edad: "31", sexo: "hombre", actividad: "activa", objetivo: "bajar" } })));
await check("usuario: acepta la marca de la bienvenida", assertSucceeds(usuario({ bienvenida: Date.now() })));
await check("usuario: acepta perfil y bienvenida a la vez, como al terminar el alta",
  assertSucceeds(usuario({ perfil: { altura: "180" }, bienvenida: Date.now(), actualizado: Date.now() })));
await check("usuario: acepta los ajustes de gastos", assertSucceeds(usuario({ ajustes: { presupuestoGlobal: 1400 } })));
await check("usuario: rechaza un perfil que no es un objeto", assertFails(usuario({ perfil: "alto" })));
await check("usuario: rechaza un correo kilométrico", assertFails(usuario({ email: "x".repeat(500) })));

/* ── 5. Colecciones que no existen ───────────────────────────────────────── */

await check("no se puede inventar una colección nueva", assertFails(setDoc(doc(ana, "usuarios", "ana", "loquesea", "x"), { a: 1 })));
await check("no se puede escribir en la raíz", assertFails(setDoc(doc(ana, "basura", "x"), { a: 1 })));

await entorno.cleanup();
console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
