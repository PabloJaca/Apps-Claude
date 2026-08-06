/* Pruebas de la reconciliación con la nube: el momento en que un dispositivo
   recibe lo que hay arriba y decide qué guardar y qué subir.

   Aquí vivía un fallo feo: al entrar por primera vez en el ordenador, Firestore
   responde desde su caché vacía antes de contestar de verdad, y el ordenador
   interpretaba ese «no hay nada» como que el documento no existía. Sembraba
   entonces su estado en blanco y borraba en la nube lo del móvil.

   Ejecutar con: node pruebas/sincronizacion.mjs */

import { reconciliar } from "../src/comun/almacen.js";
import { ponerEnColeccion } from "../src/comun/fusion.js";

const ESQUEMA = { colecciones: ["pesos"], sellos: ["perfil"] };
const vacio = () => ({ pesos: [], perfil: {}, borrados: {}, sellos: {} });

let fallos = 0;
const check = (nombre, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${nombre}${cond ? "" : "  ← " + extra}`);
  if (!cond) fallos++;
};

/* El móvil lleva días apuntando cosas. */
let movil = vacio();
for (const kg of [92, 91.8, 91.5]) movil = ponerEnColeccion(movil, "pesos", { kg });

/* ── el caso que falló: ordenador nuevo, primera vez ──────────────────── */

const ordenadorNuevo = vacio();

const primeraRespuesta = reconciliar({
  local: ordenadorNuevo,
  remoto: null,          // la caché local aún no sabe nada
  deCache: true,
  esquema: ESQUEMA,
});
check(
  "un ordenador nuevo NO siembra la nube con la respuesta de su caché",
  primeraRespuesta.subir === null,
  "iba a subir su estado en blanco y borrar lo del móvil"
);
check("y mientras tanto se queda sincronizando, no «al día»", primeraRespuesta.alDia === false);

const respuestaServidor = reconciliar({
  local: ordenadorNuevo,
  remoto: movil,         // ahora sí, lo que hay de verdad arriba
  deCache: false,
  esquema: ESQUEMA,
});
check(
  "al llegar la respuesta del servidor se baja todo lo del móvil",
  respuestaServidor.guardar && respuestaServidor.guardar.pesos.length === 3,
  JSON.stringify(respuestaServidor.guardar && respuestaServidor.guardar.pesos.length)
);
check("y no hace falta devolver nada", respuestaServidor.subir === null && respuestaServidor.alDia);

/* ── primer dispositivo de verdad: ahí sí se siembra ──────────────────── */

const primeroDeTodos = reconciliar({ local: movil, remoto: null, deCache: false, esquema: ESQUEMA });
check("si el servidor confirma que no hay documento, se siembra", primeroDeTodos.subir === movil);

/* ── el ordenador tenía cosas suyas: se juntan, no se pisan ───────────── */

let ordenadorConDatos = vacio();
ordenadorConDatos = ponerEnColeccion(ordenadorConDatos, "pesos", { kg: 90.2 });

const juntando = reconciliar({ local: ordenadorConDatos, remoto: movil, deCache: false, esquema: ESQUEMA });
check("lo de los dos dispositivos se junta", juntando.guardar.pesos.length === 4, String(juntando.guardar.pesos.length));
check("y se devuelve arriba lo que allí faltaba", juntando.subir !== null);

/* ── recuperación: la nube se quedó vacía y el móvil la repuebla ──────── */

const nubeVacia = vacio();
const reponiendo = reconciliar({ local: movil, remoto: nubeVacia, deCache: false, esquema: ESQUEMA });
check(
  "si la nube se quedó en blanco, el móvil la vuelve a llenar",
  reponiendo.subir && reponiendo.subir.pesos.length === 3,
  JSON.stringify(reponiendo.subir && reponiendo.subir.pesos.length)
);
check("y no borra nada de lo suyo por el camino", reponiendo.guardar === null);

/* ── estado estable: nada que hacer ───────────────────────────────────── */

const iguales = reconciliar({ local: movil, remoto: movil, deCache: false, esquema: ESQUEMA });
check("con todo igual no se guarda ni se sube nada", iguales.guardar === null && iguales.subir === null);
check("y el estado queda «al día»", iguales.alDia === true);

/* ── una respuesta de caché con datos sí sirve para pintar ────────────── */

const cacheConDatos = reconciliar({ local: vacio(), remoto: movil, deCache: true, esquema: ESQUEMA });
check(
  "la caché con datos sí se aprovecha para enseñar algo enseguida",
  cacheConDatos.guardar && cacheConDatos.guardar.pesos.length === 3
);

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
