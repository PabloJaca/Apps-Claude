/* La valoración comparada con el periodo anterior.
 *
 * Lo que se vigila aquí no son los números, es que no se CONTRADIGA. Una
 * valoración que arriba pone «buena semana» y dos líneas más abajo avisa de
 * que entrenas menos que antes es peor que no decir nada: de las dos frases
 * la que se lee es el titular, y el titular estaría mintiendo.
 */

import { valorarPeriodo } from "../src/salud/valoracion.js";
import { calcularEnergia } from "../src/salud/nucleo.js";

let fallos = 0;
let hechas = 0;
const check = (que, ok, detalle) => {
  hechas++;
  if (ok) return;
  fallos++;
  console.error(`  ✗ ${que}${detalle === undefined ? "" : `\n      ${detalle}`}`);
};
const grupo = (t) => console.log(`\n${t}`);

/* El lunes de esta semana, para poder colocar los días donde hagan falta sin
   depender de qué día se ejecuten las pruebas. */
const lunes = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
})();
const iso = (base, suma) => {
  const x = new Date(base);
  x.setDate(x.getDate() + suma);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const estaSemana = (n) => iso(lunes, n);
const semanaPasada = (n) => iso(lunes, n - 7);

const perfil = { altura: "180", edad: "30", sexo: "hombre", actividad: "activa", objetivo: "bajar" };
const energia = calcularEnergia(perfil, 85);

const entreno = (fecha) => ({ fecha, tipo: "fuerza", minutos: 60, intensidad: "media" });
const comida = (fecha) => ({ fecha, texto: "arroz con pollo", volumen: 3, momento: "comida", ts: 1 });

/* Los días transcurridos de la semana en curso: solo se pueden colocar
   entrenos en días que ya han pasado, o no cuentan. */
const pasados = Math.min(7, Math.floor((Date.now() - lunes.getTime()) / 86400000) + 1);

grupo("Compara con el periodo anterior");
{
  const datos = {
    pesos: [{ fecha: estaSemana(0), kg: 85 }, { fecha: estaSemana(pasados - 1), kg: 84.6 }],
    entrenos: [entreno(estaSemana(0)), ...[0, 1, 2, 3].map((n) => entreno(semanaPasada(n)))],
    comidas: [comida(estaSemana(0)), comida(semanaPasada(0))],
  };
  const v = valorarPeriodo(datos, energia, "semana", 0);

  check("hay bloque de comparación", Boolean(v.comparacion), JSON.stringify(v.comparacion));
  check("dice contra qué compara", v.comparacion.etiqueta === "la semana pasada", v.comparacion.etiqueta);
  check("cuenta bien los entrenos de antes", v.comparacion.previo.diasEntrenados === 4,
    String(v.comparacion.previo.diasEntrenados));

  const deEntrenos = v.avisos.find((a) => a.area === "Entrenos");
  check("el aviso de entrenos menciona el periodo anterior",
    /semana pasada/.test(deEntrenos.texto), deEntrenos.texto);
  check("y dice que va a menos", /hacia abajo|no es un bajón/.test(deEntrenos.texto), deEntrenos.texto);
}

grupo("El titular no puede contradecir a los avisos");
{
  /* Registro completo y peso bajando —o sea, nada catalogado como «mal»—
     pero entrenando menos que antes. Antes esto salía como «Buena semana». */
  const datos = {
    pesos: [...Array(pasados)].map((_, i) => ({ fecha: estaSemana(i), kg: 85 - i * 0.1 })),
    entrenos: [entreno(estaSemana(0)), entreno(estaSemana(1)),
               ...[0, 1, 2, 3, 4].map((n) => entreno(semanaPasada(n)))],
    comidas: [...Array(pasados)].map((_, i) => comida(estaSemana(i)))
      .concat([...Array(7)].map((_, i) => comida(semanaPasada(i)))),
  };
  const v = valorarPeriodo(datos, energia, "semana", 0);
  const sinMalos = v.avisos.every((a) => a.tono !== "mal");

  if (sinMalos) {
    check("entrenando menos que antes NO se titula «buena semana»",
      !/Buena semana|Semana redonda/.test(v.veredicto.texto), v.veredicto.texto);
    check("el titular lo dice con todas las letras",
      /menos que la semana pasada/.test(v.veredicto.texto), v.veredicto.texto);
    check("y el tono deja de ser «bien»", v.veredicto.tono !== "bien", v.veredicto.tono);
  } else {
    /* Si algo sale «mal» el titular ya es negativo por otra vía: se comprueba
       eso mismo, que es lo que importa. */
    check("con algo mal, el titular no felicita",
      !/Buena semana|Semana redonda/.test(v.veredicto.texto), v.veredicto.texto);
    hechas += 2;
  }
}

grupo("Mejorar también se dice");
{
  const datos = {
    pesos: [...Array(pasados)].map((_, i) => ({ fecha: estaSemana(i), kg: 85 - i * 0.1 })),
    entrenos: [...Array(Math.min(pasados, 4))].map((_, i) => entreno(estaSemana(i)))
      .concat([entreno(semanaPasada(0))]),
    comidas: [...Array(pasados)].map((_, i) => comida(estaSemana(i)))
      .concat([...Array(7)].map((_, i) => comida(semanaPasada(i)))),
  };
  const v = valorarPeriodo(datos, energia, "semana", 0);
  const deEntrenos = v.avisos.find((a) => a.area === "Entrenos");
  check("cuando subes, el aviso lo reconoce",
    /más que la semana pasada/.test(deEntrenos.texto), deEntrenos.texto);
}

grupo("Sin periodo anterior no se inventa una tendencia");
{
  const datos = {
    pesos: [{ fecha: estaSemana(0), kg: 85 }],
    entrenos: [entreno(estaSemana(0))],
    comidas: [comida(estaSemana(0))],
  };
  const v = valorarPeriodo(datos, energia, "semana", 0);
  check("no hay bloque de comparación", v.comparacion === null, JSON.stringify(v.comparacion));
  check("y ningún aviso menciona la semana pasada",
    v.avisos.every((a) => !/semana pasada/.test(a.texto)),
    (v.avisos.find((a) => /semana pasada/.test(a.texto)) || {}).texto);
}

grupo("No revienta con lo de siempre");
{
  check("sin nada apuntado", valorarPeriodo({ pesos: [], entrenos: [], comidas: [] }, energia, "semana", 0).hayDatos === false);
  check("sin perfil energético",
    Boolean(valorarPeriodo(
      { pesos: [{ fecha: estaSemana(0), kg: 85 }], entrenos: [], comidas: [] }, null, "semana", 0
    ).veredicto));
  check("con registros rotos",
    Boolean(valorarPeriodo(
      { pesos: [null, { kg: 85 }], entrenos: [null], comidas: [{}] }, energia, "semana", 0
    )));
  check("y en modo mes", Boolean(valorarPeriodo(
    { pesos: [{ fecha: estaSemana(0), kg: 85 }], entrenos: [entreno(estaSemana(0))], comidas: [] },
    energia, "mes", 0
  ).veredicto));
}

console.log(`\n${fallos ? "✗" : "✓"} comparación: ${hechas - fallos}/${hechas} comprobaciones`);
process.exit(fallos ? 1 : 0);
