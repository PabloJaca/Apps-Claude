/* Basura aleatoria dentro de los datos, contra todo lo que las dos apps
   exportan.

   La primera versión de esto llamaba a cada función con argumentos de
   cualquier tipo y sacaba 48 «fallos». Casi todos eran mentira: nadie llama a
   `racha()` sin datos ni le pasa un número donde va una lista, y endurecer
   cuarenta y ocho firmas para que aguanten llamadas que no existen es ruido
   que además esconde los fallos de verdad.

   El riesgo real de estas apps es otro, y ya ha mordido dos veces: los datos
   llegan de Firestore y pueden venir a medias. Así que aquí se llama a cada
   función con la FORMA correcta —una lista donde va una lista, el objeto de
   datos donde va el objeto de datos— y con el CONTENIDO podrido. Eso sí pasa,
   y cuando pasa es la pantalla en blanco.

   Cada función exportada tiene que estar clasificada abajo. Si aparece una
   nueva sin clasificar, esta prueba falla: es la misma idea que el inventario
   de pantallas, obligar a pensar en lo nuevo.

   node pruebas/fuzz.mjs [semilla] */

import * as gastos from "../src/gastos/nucleo.js";
import * as analisis from "../src/gastos/analisis.js";
import * as dictadoG from "../src/gastos/dictado.js";
import * as salud from "../src/salud/nucleo.js";
import * as estimador from "../src/salud/estimador.js";
import * as valoracion from "../src/salud/valoracion.js";
import * as dictadoS from "../src/salud/dictado.js";
import * as plantillasS from "../src/salud/plantillas.js";
import * as lengua from "../src/comun/lengua.js";

let fallos = 0;
const check = (n, c, extra = "") => { console.log(`${c ? "✓" : "✗"} ${n}${c ? "" : "  ← " + extra}`); if (!c) fallos++; };

/* ── un azar que se puede repetir ────────────────────────────────────────── */

let semilla = Number(process.argv[2]) || 20260812;
const azar = () => {
  semilla = (semilla * 1103515245 + 12345) & 0x7fffffff;
  return semilla / 0x7fffffff;
};
const entre = (a, b) => a + Math.floor(azar() * (b - a + 1));
const elige = (l) => l[entre(0, l.length - 1)];

/* ── los valores podridos que van DENTRO ─────────────────────────────────── */

const BASURA = [
  null, undefined, NaN, Infinity, -Infinity, "", " ", "cero", "🍕",
  "x".repeat(400), true, false, [], {}, 0, -1, 1e308, Number.MAX_SAFE_INTEGER,
];

const FECHAS = [
  "2026-08-12", "2026-02-30", "2026-13-01", "0000-01-01", "9999-12-31",
  "2026-8-1", "12/08/2026", "2026-08-12T10:00:00Z", ...BASURA,
];

const MESES = ["2026-08", "2026-13", "0000-00", "no-es-un-mes", ...BASURA];

const valor = (buenos) => (azar() > 0.45 ? elige(buenos) : elige(BASURA));

const registro = () => {
  if (azar() > 0.88) return elige(BASURA);          // un hueco en la lista
  return {
    id: `x${entre(1, 99)}`,
    fecha: valor(["2026-08-12", "2026-08-01", "2026-07-15"]),
    importe: valor([10, 42.3, -50, 1000]),
    kg: valor([80, 82.5, 0.5]),
    categoria: valor(["comida", "casa", "no-existe"]),
    nota: valor(["Mercadona", "Café"]),
    texto: valor(["pollo con arroz", "tostadas"]),
    volumen: valor([1, 3, 5]),
    saciedad: valor([1, 2, 4]),
    momento: valor(["cena", "desayuno"]),
    tipo: valor(["fuerza", "cardio", "ingreso", "gasto"]),
    minutos: valor([30, 60]),
    intensidad: valor(["media", "fuerte"]),
    km: valor([5, 10]),
    nombre: valor(["Alquiler", "Press banca"]),
    desde: valor(["2026-01", "2025-06"]),
    hasta: valor([null, "2026-12", "2020-01"]),
    dia: valor([1, 15, 31, 99]),
    origen: valor(["nomina", "extra"]),
    orden: valor([0, 5]),
    color: valor(["#F4614E"]),
    icono: valor(["utensils"]),
    presupuesto: valor([200, null]),
    meta: valor([3000]),
    ahorrado: valor([500]),
    ts: valor([1, 2]),
    series: azar() > 0.5 ? lista(() => ({ kg: valor([80]), reps: valor([8]) }), 3) : elige(BASURA),
    ejercicios: azar() > 0.6
      ? lista(() => ({ nombre: valor(["Press banca"]), series: lista(() => ({ kg: valor([80]), reps: valor([8]) }), 3) }), 3)
      : elige(BASURA),
  };
};

function lista(hacer = registro, tope = 7) {
  const n = entre(0, tope);
  const out = [];
  for (let i = 0; i < n; i++) out.push(hacer());
  return out;
}

const datosG = () => ({
  gastos: lista(), ingresos: lista(), fijos: lista(),
  categorias: azar() > 0.4 ? gastos.categoriasIniciales() : lista(),
  ajustes: { presupuestoGlobal: valor([1700]), objetivos: lista(registro, 3) },
});

const datosS = () => ({
  pesos: lista(), entrenos: lista(), comidas: lista(),
  perfil: {
    altura: valor(["178"]), edad: valor(["34"]), sexo: valor(["hombre", "mujer"]),
    actividad: valor(["activa", "sedentaria"]), objetivo: valor(["bajar", "subir"]),
    meta: valor([76]), metaDesde: valor([84]),
  },
});

/* La app solo pasa dos cosas como «energía»: null, o lo que devuelve
   `calcularEnergia`. Nunca un texto ni un número suelto. */
const energia = () => (azar() > 0.25 ? salud.calcularEnergia(datosS().perfil, valor([80])) : null);

/* ── qué forma tiene cada argumento ──────────────────────────────────────── */

const T = {
  lista, datosG, datosS, energia, registro,
  listaG: lista, listaFijos: lista, listaCats: lista,
  listaPesos: lista, listaComidas: lista, listaEntrenos: lista,
  fecha: () => elige(FECHAS),
  mes: () => elige(MESES),
  texto: () => valor(["Mercadona", "press banca 80 por 8", "peso 82", "he comido arroz"]),
  numero: () => valor([0, 1, 3, 12, 60, 80, 2026]),
  bool: () => elige([true, false]),
  opciones: () => ({ texto: valor(["merca"]), categoria: valor(["comida"]), desde: elige(FECHAS), hasta: elige(FECHAS) }),
  opcionesSalud: () => ({ hoy: elige(FECHAS), ahora: valor([9, 14.5, 21]) }),
  periodo: () => elige(["semana", "mes"]),        // la app no pasa otra cosa
  offset: () => entre(-6, 0),
  /* Un tramo no es un objeto con desde/hasta: es el par de fechas que
     devuelven `rangoSemana` y `rangoMes`, y la app no construye otra cosa. */
  tramo: () => (azar() > 0.5 ? salud.rangoSemana(entre(0, 6)) : salud.rangoMes(entre(0, 6))),
  perfil: () => datosS().perfil,
  registroEntreno: () => salud.saneaEntrenos([registro(), registro()])[0] || { fecha: "2026-08-12", ejercicios: [] },
  rangos: () => lista(() => ({ desde: entre(0, 3), fin: entre(3, 6) }), 3),
  sobras: () => new Set(["he", "de", "en"]),
  listaPlantillas: () => lista(registro, 4),
  registroPlantilla: () => plantillasS.plantillasSanas([registro()])[0] || { nombre: "X", ejercicios: [] },
  /* Una serie tal y como sale de la frontera: la app nunca dibuja otra cosa. */
  serie: () => plantillasS.serieSana(registro()),
  /* Y el resumen se lo da siempre `resumenFuerza`, nunca un objeto a mano. */
  resumenFuerza: () => salud.resumenFuerza(salud.saneaEntrenos([registro(), registro()])[0] || {}),
};

/* Cada función exportada, con la forma de sus argumentos.
   `null` = no se prueba, y siempre con el motivo escrito al lado. */
const FORMA = {
  "gastos/nucleo": {
    adivinarIcono: ["texto"], anosConDatos: ["datosG", "fecha"], ausenciaGastos: ["listaG", "fecha", "numero"],
    balanceDeMes: ["datosG", "mes"], buscarMovimientos: ["datosG", "opciones"],
    categoriasIniciales: [], categoriasSanas: ["listaCats"], claveMes: ["numero", "numero"],
    conFecha: ["listaG"], desdeClaveMes: ["mes"], diaDeISO: ["fecha"], diaSemanaISO: ["fecha"],
    diasDelMes: ["numero", "numero"], esFechaISO: ["fecha"], eur: ["numero", "bool"],
    expandirFijos: ["listaFijos", "mes", "texto"], fijosSanos: ["listaFijos"],
    gastosFrecuentes: ["listaG", "numero", "fecha"], hoyISO: [], huella: ["texto"],
    ingresosDeMes: ["datosG", "mes"], mesActualClave: [], mesDeISO: ["fecha"],
    mesesConDatos: ["datosG"], movimientosDeMes: ["datosG", "mes"], nombreMesClave: ["mes"],
    origenDe: ["texto"], pct: ["numero", "numero"], plural: ["numero", "texto", "texto"],
    porOrden: ["registro", "registro"], presupuestoValido: ["numero"], progresoObjetivo: ["registro"],
    repartir: ["datosG"], restarMeses: ["numero", "numero", "numero"],
    resumenAnual: ["datosG", "numero", "fecha"], suma: ["listaG"], topeSugerido: ["numero", "numero"],
    uid: [],
    exportar: null,        // descarga un archivo: necesita DOM, no cálculo
    importar: null,        // lee un File del navegador
    leerLegado: null,      // toca localStorage
    olvidarLegado: null,   // idem
  },
  "gastos/analisis": { analizarMes: ["datosG", "mes", "datosG"] },
  "gastos/dictado": { adivinarCategoria: ["texto", "datosG"], interpretarGasto: ["texto", "datosG", "fecha"] },
  "salud/nucleo": {
    ausencia: ["datosS", "fecha", "numero"], calcularEnergia: ["perfil", "numero"],
    cerrado: ["tramo", "fecha"], comidasFrecuentes: ["listaComidas", "texto", "numero", "fecha"],
    conFecha: ["listaPesos"], pesosSanos: ["listaPesos"], desdeIso: ["fecha"], detalleTramo: ["periodo", "offset"], diasTranscurridos: ["tramo", "fecha"],
    diferenciasEjercicio: ["listaEntrenos", "texto"], progresoEjercicios: ["listaEntrenos", "opciones"],
    progresoPlantilla: ["listaEntrenos", "texto"],
    ejerciciosUsados: ["listaEntrenos"], energiaDelDia: ["energia", "listaEntrenos", "numero", "perfil"],
    enRango: ["fecha", "tramo"], enTramo: ["registro", "tramo"], esEnlazada: ["serie"], enTiempo: ["serie"],
    etiquetaFecha: ["fecha"],
    etiquetaTramo: ["periodo", "offset"], extraPorEntrenos: ["listaEntrenos", "numero", "texto"],
    fechaCorta: ["fecha"], hoy: [], huellaEjercicio: ["texto"], inicioSemana: ["fecha"], iso: ["fecha"],
    kcalEntreno: ["registroEntreno", "numero"], mediaMovil: ["listaPesos", "numero"], mejorSerie: ["lista"],
    miles: ["numero"], minutosDeEntreno: ["registroEntreno"], mismoEjercicio: ["texto", "texto"],
    num: ["numero"], objetivoDe: ["texto"],
    pendienteSemanal: ["listaPesos"], pesoCorto: ["numero"], pesosFiables: ["listaPesos"], plural: ["numero", "texto", "texto"],
    porFecha: ["registro", "registro"], progresionEjercicio: ["listaEntrenos", "texto"],
    progresoMeta: ["listaPesos", "perfil"], racha: ["datosS", "fecha"], rangoMes: ["numero"],
    rangoSemana: ["numero"], recordEjercicio: ["listaEntrenos", "texto"], repartir: ["datosS"],
    resumenFuerza: ["registroEntreno"], revisarPeso: ["numero", "fecha", "listaPesos"], saciedadDe: ["numero"],
    saneaEntrenos: ["listaEntrenos"], tendenciaPeso: ["listaPesos", "opciones"], textoSerie: ["serie"],
    textoResumenFuerza: ["resumenFuerza"], toleranciaPeso: ["numero"],
    ultimaVezEjercicio: ["listaEntrenos", "texto"], ultimoEntrenoConEjercicios: ["listaEntrenos", "fecha"],
    unaRepeticion: ["numero", "numero"], volumenDe: ["numero"],
    exportar: null, importar: null, leerLegado: null, olvidarLegado: null,
  },
  "salud/estimador": {
    analizarTexto: ["texto"], calcularBalance: ["energia", "numero", "numero", "numero"],
    estimarComida: ["registro"], normalizar: ["texto"], valorarDia: ["listaComidas", "energia"],
    HORA_CIERRE: null,   // es un número, no una función
  },
  "salud/valoracion": { valorarPeriodo: ["datosS", "energia", "periodo", "offset"] },
  "salud/dictado": { interpretarSalud: ["texto", "datosS", "opcionesSalud"], reconocerEjercicio: ["texto", "listaEntrenos"] },
  "salud/plantillas": {
    buscarPlantilla: ["listaPlantillas", "texto"], entrenoDesdePlantilla: ["registroPlantilla", "fecha", "registroEntreno"],
    interpretarPlantillas: ["texto"], plantillaDesdeEntreno: ["registroEntreno", "texto"],
    plantillasSanas: ["listaPlantillas"], porOrdenPlantilla: ["registro", "registro"],
    resumenPlantilla: ["registroPlantilla"], serieSana: ["registro"],
    ultimaDePlantilla: ["listaEntrenos", "texto"],
  },
  "comun/lengua": {
    aNumero: ["texto"], buscarNumeros: ["lista"], capitalizar: ["texto"], leerFecha: ["lista", "fecha"],
    leerNumero: ["lista", "numero"], restar: ["lista", "rangos", "sobras"], sinTildes: ["texto"],
    trocear: ["texto"], valorDigitos: ["texto"],
  },
};

/* Las de `lengua` trabajan sobre listas de palabras, no de registros. */
const PALABRAS = ["cuarenta", "y", "dos", "con", "treinta", "en", "el", "mercadona", "ayer", "80", "por", "8"];
const listaPalabras = () => lista(() => valor(PALABRAS), 9);

/* ── la frontera ─────────────────────────────────────────────────────────── */

/* Esto es lo que de verdad importa. Cada app filtra lo que llega de Firestore
   antes de dárselo a nadie —`conFecha`, `saneaEntrenos`, `fijosSanos`—, así
   que hay dos preguntas distintas:

     · ¿se rompe con basura cruda?  → interesante, pero puede que no pase
     · ¿se rompe DESPUÉS del filtro? → eso es la pantalla en blanco de verdad

   Se prueban las dos. Lo segundo tiene que estar a cero; lo primero mide
   cuánto trabajo está haciendo la frontera, que conviene saberlo. */

const filtrada = {
  gastos: (l) => gastos.conFecha(l),
  fijos: (l) => gastos.fijosSanos(l),
  categorias: (l) => gastos.categoriasSanas(l),
  pesos: (l) => salud.pesosSanos(l),
  comidas: (l) => salud.conFecha(l),
  entrenos: (l) => salud.saneaEntrenos(l),
};

/* Cada lista con el filtro que le toca: darle a `reconocerEjercicio` una
   lista pasada por el filtro de pesos sería mentir, porque la app le da
   entrenos y los entrenos pasan por `saneaEntrenos`. */
const limpiaCon = (cual) => () => filtrada[cual](lista());

const datosGLimpios = () => {
  const d = datosG();
  return {
    gastos: filtrada.gastos(d.gastos), ingresos: filtrada.gastos(d.ingresos),
    fijos: filtrada.fijos(d.fijos), categorias: filtrada.categorias(d.categorias),
    ajustes: d.ajustes,
  };
};

const datosSLimpios = () => {
  const d = datosS();
  return {
    perfil: d.perfil, pesos: filtrada.pesos(d.pesos),
    entrenos: filtrada.entrenos(d.entrenos), comidas: filtrada.comidas(d.comidas),
  };
};

/* Y lo que la app nunca pasa mal: la clave de mes sale siempre de `claveMes`,
   y las fechas de un registro ya filtrado son ISO de diez caracteres. */
const MESES_REALES = () => gastos.claveMes(entre(2024, 2027), entre(0, 11));
const FECHAS_REALES = () => elige(["2026-08-12", "2026-01-01", "2026-12-31", "2024-02-29"]);

const TRAS_FRONTERA = {
  ...T,
  lista: limpiaCon("pesos"),
  listaG: limpiaCon("gastos"), listaFijos: limpiaCon("fijos"), listaCats: limpiaCon("categorias"),
  listaPesos: limpiaCon("pesos"), listaComidas: limpiaCon("comidas"), listaEntrenos: limpiaCon("entrenos"),
  datosG: datosGLimpios, datosS: datosSLimpios,
  mes: MESES_REALES, fecha: FECHAS_REALES,
  registro: () => { const l = filtrada.pesos([registro(), registro(), registro()]); return l[0] || {}; },
};

/* ── a darle ─────────────────────────────────────────────────────────────── */

const MODULOS = [
  ["gastos/nucleo", gastos], ["gastos/analisis", analisis], ["gastos/dictado", dictadoG],
  ["salud/nucleo", salud], ["salud/estimador", estimador], ["salud/valoracion", valoracion],
  ["salud/dictado", dictadoS], ["salud/plantillas", plantillasS], ["comun/lengua", lengua],
];

const VUELTAS = 400;
const sinClasificar = [];

const pasada = (tipos) => {
  const rotos = new Map();
  let llamadas = 0;
  let probadas = 0;

  for (const [nombre, modulo] of MODULOS) {
    const formas = FORMA[nombre] || {};
    for (const clave of Object.keys(modulo)) {
      if (typeof modulo[clave] !== "function") continue;
      if (!(clave in formas)) { if (tipos === T) sinClasificar.push(`${nombre}.${clave}`); continue; }
      const forma = formas[clave];
      if (forma === null) continue;

      probadas++;
      for (let v = 0; v < VUELTAS; v++) {
        const args = forma.map((t) => (nombre === "comun/lengua" && t === "lista" ? listaPalabras() : tipos[t]()));
        llamadas++;
        try {
          const r = modulo[clave](...args);
          if (r && typeof r.then === "function") r.catch(() => {});
        } catch (e) {
          const donde = `${nombre}.${clave}`;
          if (!rotos.has(donde)) {
            rotos.set(donde, {
              error: `${e.name}: ${e.message}`,
              args: args.map((a) => { try { return JSON.stringify(a); } catch (x) { return String(a); } }),
            });
          }
        }
      }
    }
  }
  return { rotos, llamadas, probadas };
};

const cruda = pasada(T);
semilla = Number(process.argv[2]) || 20260812;      // misma semilla, para comparar
const limpia = pasada(TRAS_FRONTERA);

console.log(`${cruda.llamadas * 2} llamadas a ${cruda.probadas} funciones, semilla ${process.argv[2] || 20260812}\n`);

console.log(`── con basura cruda: ${cruda.rotos.size} funciones se rompen ──`);
console.log(`   (no es un fallo por sí solo: para eso está la frontera)\n`);

console.log("── DESPUÉS de la frontera de cada app ──\n");
for (const [donde, { error, args }] of limpia.rotos) {
  console.log(`✗ ${donde}  ← ${error}`);
  console.log(`    con: ${args.map((a) => String(a).slice(0, 110)).join("\n         ") || "(sin argumentos)"}\n`);
}

check("nada se rompe con lo que de verdad le llega tras el filtro",
  limpia.rotos.size === 0, `${limpia.rotos.size} funciones`);
check("y la frontera está haciendo trabajo de verdad",
  cruda.rotos.size > limpia.rotos.size,
  `cruda ${cruda.rotos.size} · filtrada ${limpia.rotos.size}`);
check("todas las funciones exportadas están clasificadas", sinClasificar.length === 0, sinClasificar.join(", "));

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
