/* Pruebas de migración: al actualizar, lo que ya había guardado en el móvil
   tiene que seguir estando, con el mismo aspecto.  node pruebas/migracion.mjs */

import { migrar as migrarGastos, movimientosDeMes, suma } from "../src/gastos/nucleo.js";
import { migrar as migrarSalud } from "../src/salud/nucleo.js";
import { analizarMes } from "../src/gastos/analisis.js";
import { valorarPeriodo } from "../src/salud/valoracion.js";
import { valorarDia } from "../src/salud/estimador.js";

let fallos = 0;
const check = (nombre, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${nombre}${cond ? "" : "  ← " + extra}`);
  if (!cond) fallos++;
};

/* ── Gastos: formato v1 tal cual lo guardaba la versión anterior ───────── */

const gastosV1 = {
  gastos: [
    { id: "g1", importe: 23.5, categoria: "comida", fecha: "2026-07-03", nota: "Cena" },
    { id: "g2", importe: 4.2, categoria: "comida", fecha: "2026-07-04", nota: "Café" },
    { id: "g3", importe: 61.9, categoria: "casa", fecha: "2026-07-10", nota: "Ferretería" },
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
};

const g = migrarGastos(gastosV1);

check("gastos: no se pierde ningún apunte", g.gastos.length === 3);
check("gastos: no se pierde ningún fijo", g.fijos.length === 2);
check("gastos: los importes se respetan", suma(g.gastos) === 89.6, String(suma(g.gastos)));
check("gastos: el presupuesto global se conserva", g.ajustes.presupuestoGlobal === 1400);
check(
  "gastos: los topes por categoría pasan a la propia categoría",
  g.categorias.find((c) => c.id === "comida").presupuesto === 300 &&
    g.categorias.find((c) => c.id === "casa").presupuesto === 900
);
check("gastos: los colores viejos se remapean", g.categorias.find((c) => c.id === "comida").color === "#F4614E");
check("gastos: se rellenan los iconos que faltaban", g.categorias.every((c) => typeof c.icono === "string" && c.icono));
check("gastos: se añade Deporte si no estaba", g.categorias.some((c) => c.id === "deporte"));
check("gastos: todo registro sale con id y marca", [...g.gastos, ...g.fijos].every((x) => x.id && x.mod === 0));

const julio = movimientosDeMes(g, "2026-07");
check("gastos: los fijos siguen expandiéndose por mes", julio.length === 5, String(julio.length));
check("gastos: el total del mes cuadra", Math.round(suma(julio) * 100) / 100 === 852.59, String(suma(julio)));

// migrar dos veces no debe cambiar nada
check("gastos: migrar es idempotente", JSON.stringify(migrarGastos(g)) === JSON.stringify(g));

const informe = analizarMes(g, "2026-07", Object.fromEntries(g.categorias.map((c) => [c.id, c])));
check("gastos: la revisión se genera sin datos previos", informe.hayDatos && informe.nota >= 1 && informe.nota <= 10);
check("gastos: la revisión trae texto en todos los bloques", informe.bloques.every((b) => b.texto.length > 20));

/* ── Salud: formato v2, con las valoraciones que guardaba la IA ────────── */

const saludV2 = {
  perfil: { altura: "180", edad: "31", sexo: "hombre", actividad: "activa", objetivo: "bajar" },
  pesos: [
    { id: "p1", fecha: "2026-07-01", kg: 80.2, nota: "En ayunas" },
    { id: "p2", fecha: "2026-07-08", kg: 79.6, nota: "" },
    { id: "p3", fecha: "2026-07-15", kg: 79.1, nota: "" },
  ],
  entrenos: [
    { id: "e1", fecha: "2026-07-02", tipo: "fuerza", minutos: 60, intensidad: "media", ts: 1 },
    { id: "e2", fecha: "2026-07-05", tipo: "cardio", minutos: 40, intensidad: "alta", ts: 2 },
  ],
  comidas: [
    { id: "c1", fecha: "2026-07-02", texto: "Lentejas con verduras", cantidad: "normal", momento: "comida", ts: 1 },
    { id: "c2", fecha: "2026-07-02", texto: "Yogur y nueces", cantidad: "poco", momento: "snack", ts: 2 },
  ],
  dias: { "2026-07-02": { nota: 8, etiqueta: "Equilibrado", comentario: "…", kcalMin: 1800, kcalMax: 2100 } },
  valoraciones: { "semana|1|x": { titular: "algo" } },
};

const s = migrarSalud(saludV2);

check("salud: no se pierde ningún peso", s.pesos.length === 3);
check("salud: no se pierde ningún entreno", s.entrenos.length === 2);
check("salud: no se pierde ninguna comida", s.comidas.length === 2);
check("salud: el perfil se conserva entero", s.perfil.altura === "180" && s.perfil.objetivo === "bajar");
check("salud: se tira la caché de valoraciones de pago", s.dias === undefined && s.valoraciones === undefined);
check("salud: migrar es idempotente", JSON.stringify(migrarSalud(s)) === JSON.stringify(s));

const dia = valorarDia(s.comidas, null);
check("salud: el día se vuelve a valorar en local", dia && dia.nota >= 1 && dia.nota <= 10 && dia.kcalMin > 0);

const energia = { gasto: 2700, diana: 2200, margen: 150, objetivo: { id: "bajar", label: "Bajar peso", verbo: "bajar" } };
const periodo = valorarPeriodo(s, energia, "mes", 0);
check("salud: la valoración de periodo no revienta sin datos del mes actual", typeof periodo.hayDatos === "boolean");

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
