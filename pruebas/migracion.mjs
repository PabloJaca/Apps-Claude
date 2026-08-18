/* Pruebas de migración: lo que la versión anterior dejó guardado en el móvil
   tiene que poder subirse entero a la cuenta, sin perder nada y sin arrastrar
   los restos del viejo motor de fusión.      node pruebas/migracion.mjs */

import {
  leerLegado as legadoGastos,
  olvidarLegado as olvidarGastos,
  repartir as repartirGastos,
  movimientosDeMes,
  suma,
} from "../src/gastos/nucleo.js";
import {
  leerLegado as legadoSalud,
  olvidarLegado as olvidarSalud,
  repartir as repartirSalud,
} from "../src/salud/nucleo.js";
import { analizarMes } from "../src/gastos/analisis.js";
import { valorarPeriodo } from "../src/salud/valoracion.js";
import { valorarDia } from "../src/salud/estimador.js";

let fallos = 0;
const check = (nombre, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${nombre}${cond ? "" : "  ← " + extra}`);
  if (!cond) fallos++;
};

/** localStorage de mentira, para poder probar el rescate sin navegador. */
const almacenFalso = (inicial = {}) => {
  const m = new Map(Object.entries(inicial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    tiene: (k) => m.has(k),
  };
};

/* ── Gastos: formato v1 tal cual lo guardaba la versión anterior ───────── */

const gastosV1 = {
  gastos: [
    { id: "g1", mod: 17, importe: 23.5, categoria: "comida", fecha: "2026-07-03", nota: "Cena" },
    { id: "g2", mod: 17, importe: 4.2, categoria: "comida", fecha: "2026-07-04", nota: "Café" },
    { id: "g3", mod: 17, importe: 61.9, categoria: "casa", fecha: "2026-07-10", nota: "Ferretería" },
  ],
  fijos: [
    { id: "f1", nombre: "Alquiler", importe: 750, categoria: "casa", dia: 1, desde: "2026-01", hasta: null },
    { id: "f2", nombre: "Netflix", importe: 12.99, categoria: "suscripciones", dia: 5, desde: "2026-01", hasta: null },
  ],
  categorias: [
    { id: "comida", nombre: "Comida", color: "#E2543F" },     // color viejo, sin icono
    { id: "casa", nombre: "Casa", color: "#1D6B66" },
    { id: "suscripciones", nombre: "Suscripciones", color: "#E0A130" },
    { id: "otros", nombre: "Otros", color: "#5B7078" },
  ],
  presupuestoGlobal: 1400,
  presupuestosCat: { comida: 300, casa: 900 },
  borrados: { gastos: { viejo: 5 } },
  sellos: { ajustes: 9 },
};

const { porColeccion: G, campos: campoG } = repartirGastos(gastosV1);

check("gastos: no se pierde ningún apunte", G.gastos.length === 3);
check("gastos: no se pierde ningún fijo", G.fijos.length === 2);
check("gastos: los importes se respetan", suma(G.gastos) === 89.6, String(suma(G.gastos)));
check("gastos: el presupuesto global se conserva", campoG.ajustes.presupuestoGlobal === 1400);
check(
  "gastos: los topes por categoría pasan a la propia categoría",
  G.categorias.find((c) => c.id === "comida").presupuesto === 300 &&
    G.categorias.find((c) => c.id === "casa").presupuesto === 900
);
check("gastos: los colores viejos se remapean", G.categorias.find((c) => c.id === "comida").color === "#F4614E");
check("gastos: se rellenan los iconos que faltaban", G.categorias.every((c) => typeof c.icono === "string" && c.icono));
check("gastos: se añade Deporte si no estaba", G.categorias.some((c) => c.id === "deporte"));
check("gastos: todo registro sale con id propio", [...G.gastos, ...G.fijos, ...G.categorias].every((x) => x.id));
check(
  "gastos: se tira el rastro del viejo motor de fusión",
  [...G.gastos, ...G.fijos, ...G.categorias].every((x) => x.mod === undefined)
);
check(
  "gastos: no se cuela nada fuera de sus colecciones",
  Object.keys(G).sort().join(",") === "categorias,fijos,gastos,ingresos",
  Object.keys(G).sort().join(",")
);
check("gastos: una copia sin ingresos no los inventa", G.ingresos.length === 0);

const comoDatos = { ...G, ajustes: campoG.ajustes };
const julio = movimientosDeMes(comoDatos, "2026-07");
check("gastos: los fijos siguen expandiéndose por mes", julio.length === 5, String(julio.length));
check("gastos: el total del mes cuadra", Math.round(suma(julio) * 100) / 100 === 852.59, String(suma(julio)));

// Repartir dos veces no debe cambiar nada: se llama al importar y al restaurar.
check(
  "gastos: repartir es idempotente",
  JSON.stringify(repartirGastos(comoDatos).porColeccion) === JSON.stringify(G)
);

const informe = analizarMes(comoDatos, "2026-07", Object.fromEntries(G.categorias.map((c) => [c.id, c])));
check("gastos: la revisión se genera sin datos previos", informe.hayDatos && informe.nota >= 1 && informe.nota <= 10);
check("gastos: la revisión trae texto en todos los bloques", informe.bloques.every((b) => b.texto.length > 20));

/* ── Gastos: rescate de lo que quedó en el navegador ───────────────────── */

const lsG = almacenFalso({ "gastos-v1": JSON.stringify(gastosV1) });
const rescateG = legadoGastos(lsG);
check("gastos: se detecta lo que dejó la versión anterior", !!rescateG);
check("gastos: el resumen dice lo que hay", rescateG.resumen === "3 gastos, 2 gastos fijos", rescateG.resumen);
check("gastos: el rescate no se sube solo, solo se ofrece", lsG.tiene("gastos-v1"));

olvidarGastos(lsG);
check("gastos: al descartarlo desaparece del navegador", !lsG.tiene("gastos-v1"));
check("gastos: y no se vuelve a ofrecer", legadoGastos(lsG) === null);

check("gastos: sin nada guardado no se ofrece nada", legadoGastos(almacenFalso()) === null);
check("gastos: un guardado corrupto no revienta", legadoGastos(almacenFalso({ "gastos-v1": "{no json" })) === null);
check(
  "gastos: un guardado vacío no molesta con una tarjeta",
  legadoGastos(almacenFalso({ "gastos-v1": JSON.stringify({ gastos: [], fijos: [] }) })) === null
);

/* ── Salud: formato v2, con las valoraciones que guardaba la IA ────────── */

const saludV2 = {
  perfil: { altura: "180", edad: "31", sexo: "hombre", actividad: "activa", objetivo: "bajar" },
  pesos: [
    { id: "p1", mod: 4, fecha: "2026-07-01", kg: 80.2, nota: "En ayunas" },
    { id: "p2", mod: 4, fecha: "2026-07-08", kg: 79.6, nota: "" },
    { id: "p3", mod: 4, fecha: "2026-07-15", kg: 79.1, nota: "" },
  ],
  entrenos: [
    { id: "e1", fecha: "2026-07-02", tipo: "fuerza", minutos: 60, intensidad: "media", ts: 1 },
    { id: "e2", fecha: "2026-07-05", tipo: "cardio", minutos: 40, intensidad: "alta", ts: 2 },
  ],
  comidas: [
    { id: "c1", fecha: "2026-07-02", texto: "Lentejas con verduras", cantidad: "normal", momento: "comida", ts: 1 },
    { id: "c2", fecha: "2026-07-02", texto: "Yogur y nueces", cantidad: "poco", momento: "snack", ts: 2 },
    { id: "c3", fecha: "2026-07-02", texto: "Pizza entera", cantidad: "mucho", momento: "cena", ts: 3 },
  ],
  dias: { "2026-07-02": { nota: 8, etiqueta: "Equilibrado", comentario: "…", kcalMin: 1800, kcalMax: 2100 } },
  valoraciones: { "semana|1|x": { titular: "algo" } },
};

const { porColeccion: S, campos: campoS } = repartirSalud(saludV2);

check("salud: no se pierde ningún peso", S.pesos.length === 3);
check("salud: no se pierde ningún entreno", S.entrenos.length === 2);
check("salud: no se pierde ninguna comida", S.comidas.length === 3);
check(
  "salud: poco/normal/mucho se traducen a volumen 2/3/4",
  S.comidas.map((c) => c.volumen).join(",") === "3,2,4",
  S.comidas.map((c) => c.volumen).join(",")
);
check("salud: las comidas viejas quedan sin saciedad, no inventada", S.comidas.every((c) => c.saciedad === null));
check("salud: el campo cantidad desaparece", S.comidas.every((c) => c.cantidad === undefined));
check("salud: el perfil se conserva entero", campoS.perfil.altura === "180" && campoS.perfil.objetivo === "bajar");
check(
  "salud: se tira el rastro del viejo motor de fusión",
  [...S.pesos, ...S.entrenos, ...S.comidas].every((x) => x.mod === undefined)
);
check(
  "salud: la caché de valoraciones de pago no viaja a Firestore",
  Object.keys(S).sort().join(",") === "comidas,entrenos,pesos,plantillas" &&
    Object.keys(campoS).join(",") === "perfil",
  `${Object.keys(S).sort().join(",")} · ${Object.keys(campoS).join(",")}`
);
check(
  "salud: repartir es idempotente",
  JSON.stringify(repartirSalud({ ...S, perfil: campoS.perfil }).porColeccion) === JSON.stringify(S)
);

const dia = valorarDia(S.comidas, null);
check("salud: el día se vuelve a valorar en local", dia && dia.nota >= 1 && dia.nota <= 10 && dia.kcalMin > 0);

const energia = { gasto: 2700, diana: 2200, margen: 150, objetivo: { id: "bajar", label: "Bajar peso", verbo: "bajar" } };
const periodo = valorarPeriodo({ ...S, perfil: campoS.perfil }, energia, "mes", 0);
check("salud: la valoración de periodo no revienta sin datos del mes actual", typeof periodo.hayDatos === "boolean");

/* ── Salud: rescate de lo que quedó en el navegador ────────────────────── */

const lsS = almacenFalso({ "salud-app-v2": JSON.stringify(saludV2) });
const rescateS = legadoSalud(lsS);
check("salud: se detecta lo que dejó la versión anterior", !!rescateS);
check("salud: el resumen dice lo que hay", rescateS.resumen === "3 pesajes, 2 entrenos, 3 comidas", rescateS.resumen);
olvidarSalud(lsS);
check("salud: al descartarlo desaparece y no vuelve", !lsS.tiene("salud-app-v2") && legadoSalud(lsS) === null);

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
