import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, ReferenceLine,
} from "recharts";
import {
  UtensilsCrossed, Pizza, Coffee, Beer, ShoppingCart, PartyPopper, Music, Film,
  Gamepad2, Bus, Car, TrainFront, Bike, Plane, Fuel, Home, Zap, Droplet, Wifi,
  Smartphone, HeartPulse, Pill, Stethoscope, Shirt, Scissors, Dumbbell, BookOpen,
  GraduationCap, Gift, Dog, Baby, Wrench, CreditCard, PiggyBank, Package, Sparkles,
  ChevronLeft, ChevronRight, X, Plus, Trash2, Copy, Check, Wallet, Settings,
  PieChart as IcAnalisis, Repeat, ArrowUpRight, ArrowDownRight, Target, CalendarDays,
  Download, Upload, TrendingUp, Lightbulb, AlertTriangle, ThumbsUp, Search, Undo2, Mic,
} from "lucide-react";

import { useDatos } from "../comun/datos.js";
import { Puerta } from "../comun/sesion.jsx";
import { PantallaCuenta, PastillaSync } from "../comun/cuenta.jsx";
import { CSS_VOZ, HojaDictado, hayDictado } from "../comun/voz.jsx";
import { analizarMes } from "./analisis.js";
import { EJEMPLOS_GASTOS, interpretarGasto } from "./dictado.js";
import { CSS, TEMAS } from "./estilos.js";
import { TEMAS_ELEGIBLES, aplicarTema, guardarTema, instalarTema, temaGuardado } from "../comun/tema.js";
import {
  AJUSTES_VACIO, COLECCIONES, MESES, PALETA,
  adivinarIcono, categoriasIniciales, categoriasSanas, claveMes, conFecha, diaDeISO, diasDelMes, fijosSanos,
  ORIGENES, balanceDeMes, buscarMovimientos, eur, exportar, gastosFrecuentes, plural,
  anosConDatos, ausenciaGastos, hoyISO, importar, ingresosDeMes, leerLegado, mesActualClave, movimientosDeMes,
  nombreMesClave, olvidarLegado, origenDe, porOrden, presupuestoValido, progresoObjetivo, resumenAnual,
  restarMeses, suma, topeSugerido, uid,
} from "./nucleo.js";

/* ─────────────────────────────  ICONOS  ───────────────────────────── */

const ICONOS = {
  utensils: UtensilsCrossed, pizza: Pizza, coffee: Coffee, beer: Beer,
  cart: ShoppingCart, party: PartyPopper, music: Music, film: Film,
  gamepad: Gamepad2, bus: Bus, car: Car, train: TrainFront, bike: Bike,
  plane: Plane, fuel: Fuel, home: Home, zap: Zap, droplet: Droplet,
  wifi: Wifi, phone: Smartphone, heart: HeartPulse, pill: Pill,
  stethoscope: Stethoscope, shirt: Shirt, scissors: Scissors,
  dumbbell: Dumbbell, book: BookOpen, graduation: GraduationCap, gift: Gift,
  dog: Dog, baby: Baby, wrench: Wrench, card: CreditCard, piggy: PiggyBank,
  package: Package, sparkles: Sparkles, repeat: Repeat,
  // Los dos de los ingresos: sin ellos la nómina salía con la caja genérica.
  wallet: Wallet, undo: Undo2,
};
const CLAVES_ICONO = Object.keys(ICONOS);

/**
 * Envoltorio de las gráficas.
 *
 * Recharts mide su contenedor en el primer pintado, cuando la columna todavía
 * no tiene su ancho definitivo: los ejes se recalculan al recibirlo, pero las
 * barras no, y salen de un píxel o no salen. Esperar un fotograma basta.
 * A cambio hay que desactivar la animación de entrada, que si no se queda sin
 * disparar por montarse dentro del propio fotograma.
 */
function Grafica({ alto, style, children }) {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setListo(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div style={{ height: alto, width: "100%", ...style }}>
      {listo && <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>}
    </div>
  );
}

function Icono({ nombre, size = 18, className, style }) {
  const C = ICONOS[nombre] || Package;
  return <C size={size} strokeWidth={2} className={className} style={style} />;
}

const ICONO_BLOQUE = {
  wallet: Wallet, target: Target, pie: IcAnalisis, calendar: CalendarDays, repeat: Repeat,
};

/* Antes de dibujar nada: la puerta de acceso y el candado usan esta paleta. */
if (typeof document !== "undefined") instalarTema(TEMAS);

const PALETA_CUENTA = {
  /* Igual que en Salud: nombres, no colores. Los rellena el tema. */
  bg: "var(--paper)", card: "var(--card)", suave: "var(--suave2)", ink: "var(--ink)",
  mid: "var(--soft)", faint: "var(--tenue)", line: "var(--line)",
  acento: "var(--accent)", acentoSuave: "var(--accentSoft)",
  coral: "var(--coral)", mint: "var(--mint)",
  sombra: "var(--sombra)",
  display: "'Bricolage Grotesque', system-ui, sans-serif",
  body: "'Instrument Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
};

/* ─────────────────────────────  APP  ───────────────────────────── */

export default function AppGastos() {
  return (
    <Puerta
      paleta={PALETA_CUENTA}
      titulo="Gastos"
      descripcion="Lleva la cuenta del mes. Entra con tu correo y lo tendrás en todos tus dispositivos."
    >
      {(sesion) => <Aplicacion sesion={sesion} />}
    </Puerta>
  );
}

function Aplicacion({ sesion }) {
  const {
    registros, usuario, listo, error, estado,
    guardar, borrar, guardarUsuario, importar: importarDatos, vaciar,
  } = useDatos({ uid: sesion.uid, colecciones: COLECCIONES });

  /* La pantalla ve un único objeto `datos`, pero no es estado propio: es lo que
     hay ahora mismo en Firestore. Aquí no se escribe nunca. */
  /* Esta es la frontera: lo que entra de Firestore puede venir a medias —una
     sincronización cortada, una copia vieja restaurada— y un solo documento
     roto tumbaba la pantalla entera. Se descarta aquí, en un único sitio. */
  const datos = useMemo(
    () => ({
      gastos: conFecha(registros.gastos),
      ingresos: conFecha(registros.ingresos),
      // Firestore devuelve los documentos por identificador, así que el orden
      // que ve la persona se decide aquí, no en la base de datos.
      fijos: fijosSanos(registros.fijos).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es")),
      categorias: categoriasSanas(registros.categorias).sort(porOrden),
      ajustes: { ...AJUSTES_VACIO, ...(usuario.ajustes || {}) },
    }),
    [registros.gastos, registros.ingresos, registros.fijos, registros.categorias, usuario.ajustes]
  );

  /* Cuenta recién creada: se siembran las categorías de partida una sola vez.
     Los IDs son fijos, así que aunque dos dispositivos entren a la vez escriben
     lo mismo y no se duplica nada. */
  useEffect(() => {
    if (!listo || usuario.sembrado || registros.categorias.length) return;
    importarDatos({ categorias: categoriasIniciales() }, { sembrado: true });
  }, [listo, usuario.sembrado, registros.categorias.length, importarDatos]);

  const [vista, setVista] = useState("resumen");
  const ahora = new Date();
  const [cursor, setCursor] = useState({ y: ahora.getFullYear(), m: ahora.getMonth() });
  const [hoja, setHoja] = useState(null);
  const [hojaFijo, setHojaFijo] = useState(null);
  const [pantalla, setPantalla] = useState(null);

  const catPorId = useMemo(() => {
    const m = {};
    for (const c of datos.categorias || []) m[c.id] = c;
    return m;
  }, [datos.categorias]);

  const mesKey = claveMes(cursor.y, cursor.m);
  const esMesEnCurso = mesKey === mesActualClave();

  const movimientos = useMemo(
    () => movimientosDeMes(datos, mesKey).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)),
    [datos, mesKey]
  );

  const fijosMes = useMemo(() => movimientos.filter((g) => g.esFijo), [movimientos]);
  const variablesMes = useMemo(() => movimientos.filter((g) => !g.esFijo), [movimientos]);
  const totalMes = useMemo(() => suma(movimientos), [movimientos]);
  const totalFijos = useMemo(() => suma(fijosMes), [fijosMes]);
  const totalVariable = useMemo(() => suma(variablesMes), [variablesMes]);

  const balance = useMemo(() => balanceDeMes(datos, mesKey), [datos, mesKey]);
  const ingresosMes = useMemo(() => ingresosDeMes(datos, mesKey), [datos, mesKey]);
  const frecuentes = useMemo(() => gastosFrecuentes(datos.gastos), [datos.gastos]);
  const objetivos = useMemo(
    () => (datos.ajustes.objetivos || []).map(progresoObjetivo).filter(Boolean),
    [datos.ajustes.objetivos]
  );

  const mesAnteriorKey = useMemo(() => {
    const p = restarMeses(cursor.y, cursor.m, 1);
    return claveMes(p.y, p.m);
  }, [cursor]);
  const totalMesAnterior = useMemo(() => suma(movimientosDeMes(datos, mesAnteriorKey)), [datos, mesAnteriorKey]);

  const porCategoria = useMemo(() => {
    const m = {};
    // Se guarda aparte lo variable para poder mirar solo eso, que es lo único
    // sobre lo que se puede decidir algo a mitad de mes.
    for (const g of movimientos) {
      const e = (m[g.categoria] = m[g.categoria] || { total: 0, variable: 0 });
      e.total += g.importe;
      if (!g.esFijo) e.variable += g.importe;
    }
    return Object.entries(m)
      .map(([id, { total, variable }]) => ({
        id, total, variable,
        nombre: catPorId[id]?.nombre || "Sin categoría",
        color: catPorId[id]?.color || "var(--soft)",
        icono: catPorId[id]?.icono || "package",
        presupuesto: catPorId[id]?.presupuesto || null,
      }))
      .sort((a, b) => b.total - a.total);
  }, [movimientos, catPorId]);

  const porDiaVariable = useMemo(() => {
    const n = diasDelMes(cursor.y, cursor.m);
    const arr = Array.from({ length: n }, () => 0);
    for (const g of variablesMes) arr[diaDeISO(g.fecha) - 1] += g.importe;
    return arr;
  }, [variablesMes, cursor]);

  const ultimosMeses = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const p = restarMeses(cursor.y, cursor.m, i);
      const k = claveMes(p.y, p.m);
      out.push({
        clave: k,
        etiqueta: MESES[p.m].slice(0, 3),
        total: Math.round(suma(movimientosDeMes(datos, k)) * 100) / 100,
        actual: k === mesKey,
      });
    }
    return out;
  }, [datos, cursor, mesKey]);

  const ranking = useMemo(() => {
    const previos = [1, 2, 3].map((i) => {
      const p = restarMeses(cursor.y, cursor.m, i);
      return claveMes(p.y, p.m);
    });
    const conDatos = previos.filter((k) => movimientosDeMes(datos, k).length > 0);
    if (!conDatos.length) return [];

    const mediaPrev = {};
    for (const k of conDatos) {
      for (const g of movimientosDeMes(datos, k)) mediaPrev[g.categoria] = (mediaPrev[g.categoria] || 0) + g.importe;
    }
    for (const id of Object.keys(mediaPrev)) mediaPrev[id] /= conDatos.length;

    const ids = new Set([...porCategoria.map((c) => c.id), ...Object.keys(mediaPrev)]);
    return [...ids]
      .map((id) => {
        const actual = porCategoria.find((c) => c.id === id)?.total || 0;
        const previa = mediaPrev[id] || 0;
        return {
          id,
          nombre: catPorId[id]?.nombre || "Sin categoría",
          color: catPorId[id]?.color || "var(--soft)",
          icono: catPorId[id]?.icono || "package",
          actual, previa, delta: actual - previa,
        };
      })
      .filter((r) => r.actual > 0 || r.previa > 0)
      .sort((a, b) => b.delta - a.delta);
  }, [datos, cursor, porCategoria, catPorId]);

  const nDias = diasDelMes(cursor.y, cursor.m);
  const diasTranscurridos = esMesEnCurso ? ahora.getDate() : nDias;
  const proyeccion = diasTranscurridos > 0 ? totalFijos + (totalVariable / diasTranscurridos) * nDias : totalFijos;
  const presupuesto = presupuestoValido(datos.ajustes && datos.ajustes.presupuestoGlobal);

  /* Lo que queda para el día a día una vez pagados los fijos, repartido entre
     los días del mes. Es la línea de puntos del gráfico diario. */
  const margenVariable = presupuesto ? presupuesto - totalFijos : null;
  const ritmoDiario = margenVariable && margenVariable > 0 ? margenVariable / nDias : null;

  /* Categorías que se están comiendo su tope. Solo en el mes en curso: en un
     mes ya cerrado esto no es un aviso, es historia, y para eso está Análisis. */
  const avisosTope = useMemo(() => {
    if (!esMesEnCurso) return [];
    return porCategoria
      .filter((c) => c.presupuesto > 0 && c.total / c.presupuesto >= 0.8)
      .map((c) => ({ ...c, ratio: c.total / c.presupuesto }))
      .sort((a, b) => b.ratio - a.ratio);
  }, [porCategoria, esMesEnCurso]);

  /* Días sin apuntar nada. Solo se mira estando en el mes en curso: en un mes
     pasado no se ha «dejado de apuntar», es que ya se cerró. */
  const ausencia = useMemo(
    () => (esMesEnCurso ? ausenciaGastos(datos.gastos) : null),
    [datos.gastos, esMesEnCurso]
  );

  /* Cuenta recién estrenada: ni un gasto, ni un ingreso, ni un fijo. Se
     pregunta una sola vez y queda constancia, igual que en Salud, para no dar
     la brasa a quien la saltó. */
  const primeraVez =
    listo && !usuario.bienvenida &&
    !datos.gastos.length && !datos.ingresos.length && !datos.fijos.length;

  /* ── acciones ────────────────────────────────────────────────────────── */

  /* Cada acción escribe en Firestore al momento. La lista no se toca a mano:
     se repinta sola cuando Firestore devuelve el cambio. */
  const guardarGasto = (g) => { guardar("gastos", g); setHoja(null); };
  const borrarGasto = (id) => { borrar("gastos", id); setHoja(null); };
  const guardarFijo = (f) => { guardar("fijos", f); setHojaFijo(null); };
  const eliminarFijo = (id) => { borrar("fijos", id); setHojaFijo(null); };

  const guardarIngreso = (i) => { guardar("ingresos", i); setHoja(null); };
  const borrarIngreso = (id) => { borrar("ingresos", id); setHoja(null); };

  /* Repetir un gasto de los de siempre: se abre la hoja con todo puesto para
     poder cambiar el importe, que es lo único que suele variar. */
  const repetirGasto = (g) =>
    setHoja({ modo: "nuevo", gasto: { importe: g.importe, categoria: g.categoria, nota: g.nota, fecha: hoyISO() } });

  /* Lo dictado abre la hoja rellenada; guardar sigue siendo cosa tuya. Que el
     intérprete se equivoque tiene que costar un toque, no un dato malo. */
  const usarDictado = (frase) => {
    const r = interpretarGasto(frase, datos);
    setPantalla(null);
    if (!r) return setHoja({ modo: "nuevo" });
    setHoja({
      modo: "nuevo",
      tipo: r.tipo,
      gasto: {
        importe: r.importe ?? undefined,
        categoria: r.categoria || undefined,
        origen: r.origen || undefined,
        nota: r.nota,
        fecha: r.fecha,
      },
    });
  };

  const guardarObjetivos = (lista) =>
    guardarUsuario({ ajustes: { ...datos.ajustes, objetivos: lista } });

  const ponPresupuesto = (valor) =>
    guardarUsuario({ ajustes: { ...datos.ajustes, presupuestoGlobal: valor } });

  /* La bienvenida deja el mes montado de una vez: la nómina, el gasto fijo más
     gordo y el tope. Lo que se haya rellenado se guarda; lo que no, se salta. */
  const cerrarBienvenida = useCallback(
    (inicial) => {
      if (!inicial) return guardarUsuario({ bienvenida: Date.now() });
      for (const f of inicial.fijos) guardar("fijos", f);
      guardarUsuario({
        bienvenida: Date.now(),
        ajustes: { ...AJUSTES_VACIO, presupuestoGlobal: inicial.presupuesto ?? null },
      });
    },
    [guardar, guardarUsuario]
  );

  const restaurar = useCallback(
    (archivo) => importar(archivo).then(({ porColeccion, campos }) => importarDatos(porColeccion, campos)),
    [importarDatos]
  );

  const abrirMovimiento = (g) => {
    if (g.esFijo) {
      const def = (datos.fijos || []).find((f) => f.id === g.fijoId);
      if (def) setHojaFijo({ modo: "editar", fijo: def, mesVisto: mesKey });
    } else {
      setHoja({ modo: "editar", gasto: g });
    }
  };

  const moverMes = useCallback((dir) => {
    setCursor((c) => {
      const d = new Date(c.y, c.m + dir, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }, []);

  /* Teclado en el ordenador: flechas para cambiar de mes, N para un gasto nuevo. */
  useEffect(() => {
    const alPulsar = (e) => {
      if (e.target.matches("input, textarea, select")) return;
      if (hoja || hojaFijo || pantalla) {
        if (e.key === "Escape") { setHoja(null); setHojaFijo(null); setPantalla(null); }
        return;
      }
      if (e.key === "ArrowLeft") moverMes(-1);
      if (e.key === "ArrowRight" && !esMesEnCurso) moverMes(1);
      if (e.key === "n" || e.key === "N") { e.preventDefault(); setHoja({ modo: "nuevo" }); }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [moverMes, esMesEnCurso, hoja, hojaFijo, pantalla]);

  /* Los dos returns de abajo van después de todos los hooks a propósito: se
     ejecutan igual, lo único que cambia es lo que se dibuja. */
  if (!listo && !error) {
    return (
      <div className="gx">
        <style>{CSS}</style>
        <div className="cargando"><div className="spinner" /><p>Abriendo tus cuentas…</p></div>
      </div>
    );
  }

  if (primeraVez) {
    return <Bienvenida onTerminar={cerrarBienvenida} onSaltar={() => cerrarBienvenida(null)} />;
  }

  return (
    <div className="gx">
      <style>{CSS + CSS_VOZ}</style>

      <header className="cabecera">
        <button className="flecha" onClick={() => moverMes(-1)} aria-label="Mes anterior">
          <ChevronLeft size={20} />
        </button>
        {/* El título abre el año: es donde uno mira cuando quiere ver más
            allá del mes, y así no hace falta otro botón en la barra. */}
        <button className="mesTitulo" onClick={() => setPantalla("anual")} aria-label={`Ver el año ${cursor.y}`}>
          <span className="mesNombre">{MESES[cursor.m]}</span>
          <span className="mesAno">{cursor.y}</span>
          <ChevronRight size={15} className="hIcono" />
        </button>
        <div className="cabeceraDerecha">
          {/* Arriba y no en la barra de abajo: metido entre las pestañas
              parecía una pestaña más y no lo encontraba nadie. Aquí está
              donde está el de Salud, que es donde se busca. */}
          <button className="flecha voz" onClick={() => setPantalla("dictado")} aria-label="Apuntar hablando" title="Apuntar hablando">
            <Mic size={19} strokeWidth={2.3} />
          </button>
          <button className="flecha" onClick={() => setPantalla("buscar")} aria-label="Buscar movimientos">
            <Search size={18} />
          </button>
          <PastillaSync estado={estado} paleta={PALETA_CUENTA} onAbrir={() => setPantalla("cuenta")} />
          <button className="flecha" onClick={() => moverMes(1)} aria-label="Mes siguiente" disabled={esMesEnCurso}>
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {error && <div className="aviso">{error}</div>}

      <main className="lienzo">
        {vista === "resumen" && (
          <Resumen
            total={totalMes} totalFijos={totalFijos} totalVariable={totalVariable}
            totalAnterior={totalMesAnterior}
            nDias={nDias} diasTranscurridos={diasTranscurridos} esMesEnCurso={esMesEnCurso}
            proyeccion={proyeccion} presupuesto={presupuesto} margenVariable={margenVariable}
            balance={balance} avisosTope={avisosTope} ausencia={ausencia}
            frecuentes={frecuentes} objetivos={objetivos}
            movimientos={movimientos} nFijos={fijosMes.length} catPorId={catPorId}
            onAbrir={abrirMovimiento}
            onNuevo={() => setHoja({ modo: "nuevo" })}
            onNuevoIngreso={() => setHoja({ modo: "nuevo", tipo: "ingreso" })}
            onRepetir={repetirGasto}
            onNuevoFijo={() => setHojaFijo({ modo: "nuevo", mesVisto: mesKey })}
            onRevisar={() => setPantalla("revision")}
            onObjetivos={() => setPantalla("objetivos")}
            onPresupuesto={ponPresupuesto}
            onVerTopes={() => setVista("analisis")}
          />
        )}

        {vista === "analisis" && (
          <Analisis
            porCategoria={porCategoria} total={totalMes} ultimosMeses={ultimosMeses}
            ranking={ranking} presupuestoGlobal={presupuesto}
            porDiaVariable={porDiaVariable} nDias={nDias}
            diasTranscurridos={diasTranscurridos} esMesEnCurso={esMesEnCurso}
            ritmoDiario={ritmoDiario} totalVariable={totalVariable}
            onRevisar={() => setPantalla("revision")}
            onNuevo={() => setHoja({ modo: "nuevo" })}
          />
        )}

        {vista === "ajustes" && (
          <Ajustes
            datos={datos} catPorId={catPorId} mesKey={mesKey}
            guardar={guardar} borrar={borrar} guardarUsuario={guardarUsuario}
            onRestaurar={restaurar} onVaciar={vaciar}
            onFijos={() => setPantalla("fijos")}
            onObjetivos={() => setPantalla("objetivos")}
            onCuenta={() => setPantalla("cuenta")}
            sesion={sesion}
          />
        )}
      </main>

      <nav className="barra">
        {[
          ["resumen", "Resumen", Wallet],
          ["analisis", "Análisis", IcAnalisis],
          ["ajustes", "Ajustes", Settings],
        ].map(([id, txt, Ic]) => (
          <button key={id} className={`pestana ${vista === id ? "activa" : ""}`} onClick={() => setVista(id)}>
            <Ic size={19} strokeWidth={2.1} />
            <span>{txt}</span>
          </button>
        ))}
        <button className="fab" onClick={() => setHoja({ modo: "nuevo" })} aria-label="Añadir gasto" title="Añadir gasto (N)">
          <Plus size={24} strokeWidth={2.6} />
        </button>
      </nav>

      {hoja && (
        <HojaGasto
          modo={hoja.modo} gasto={hoja.gasto} tipo={hoja.tipo || "gasto"} categorias={datos.categorias}
          onGuardar={hoja.tipo === "ingreso" ? guardarIngreso : guardarGasto}
          onBorrar={hoja.tipo === "ingreso" ? borrarIngreso : borrarGasto}
          onCerrar={() => setHoja(null)}
        />
      )}

      {hojaFijo && (
        <HojaFijo
          modo={hojaFijo.modo} fijo={hojaFijo.fijo} tipo={hojaFijo.tipo || "gasto"}
          mesVisto={hojaFijo.mesVisto}
          categorias={datos.categorias} onGuardar={guardarFijo} onEliminar={eliminarFijo}
          onCerrar={() => setHojaFijo(null)}
        />
      )}

      {pantalla === "fijos" && (
        <PantallaFijos
          fijos={datos.fijos} catPorId={catPorId} mesKey={mesKey}
          onEditar={(f) => setHojaFijo({ modo: "editar", fijo: f, mesVisto: mesKey })}
          onNuevo={(tipo) => setHojaFijo({ modo: "nuevo", tipo, mesVisto: mesKey })}
          onCerrar={() => setPantalla(null)}
        />
      )}

      {pantalla === "revision" && (
        <Revision
          datos={datos} catPorId={catPorId} mesKey={mesKey}
          onMover={moverMes} esMesEnCurso={esMesEnCurso} onCerrar={() => setPantalla(null)}
        />
      )}

      {pantalla === "buscar" && (
        <PantallaBuscar datos={datos} catPorId={catPorId} onAbrir={abrirMovimiento} onCerrar={() => setPantalla(null)} />
      )}

      {pantalla === "anual" && (
        <PantallaAnual datos={datos} catPorId={catPorId} anoInicial={cursor.y} onCerrar={() => setPantalla(null)} />
      )}

      {pantalla === "dictado" && (
        <HojaDictado
          paleta={PALETA_CUENTA}
          titulo="Apunta hablando"
          ejemplos={EJEMPLOS_GASTOS}
          onTexto={usarDictado}
          onCerrar={() => setPantalla(null)}
        />
      )}

      {pantalla === "objetivos" && (
        <PantallaObjetivos objetivos={datos.ajustes.objetivos || []} onGuardar={guardarObjetivos} onCerrar={() => setPantalla(null)} />
      )}

      {pantalla === "cuenta" && (
        <PantallaCuenta
          paleta={PALETA_CUENTA}
          sesion={sesion}
          estado={estado}
          error={error}
          legado={leerLegado}
          onImportar={(l) => importarDatos(l.porColeccion, l.campos).then(() => olvidarLegado())}
          onDescartarLegado={olvidarLegado}
          onExportar={() => exportar(datos)}
          onRestaurar={restaurar}
          onVaciar={vaciar}
          onCerrar={() => setPantalla(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────  BIENVENIDA  ───────────────────────────── */

/**
 * Tres preguntas al entrar por primera vez.
 *
 * Antes se aterrizaba en un mes vacío con nueve categorías que nadie había
 * elegido, y la app solo sabía restar. Estas tres preguntas dejan el mes
 * montado: lo que entra, lo que sale sí o sí, y el tope. El tercer paso
 * termina enseñando lo que sobra, que es el momento en el que se entiende
 * para qué sirve todo esto.
 *
 * Se puede saltar en cualquier momento; lo que se haya rellenado se guarda.
 */
function Bienvenida({ onTerminar, onSaltar }) {
  const [paso, setPaso] = useState(0);
  const [nomina, setNomina] = useState("");
  const [fijoNombre, setFijoNombre] = useState("Alquiler");
  const [fijoImporte, setFijoImporte] = useState("");
  const [tope, setTope] = useState("");

  const num = (v) => {
    const n = Number(String(v).replace(",", "."));
    return n > 0 ? Math.round(n * 100) / 100 : 0;
  };
  const entra = num(nomina);
  const sale = num(fijoImporte);
  const mes = mesActualClave();

  const sugerido = topeSugerido(entra, sale);
  const topeFinal = num(tope) || sugerido;
  const libre = entra > 0 && topeFinal > 0 ? entra - topeFinal : null;

  const PASOS = [
    { titulo: "¿Cuánto te entra al mes?", pie: "La nómina, la beca, lo que sea. Sin esto la app solo puede decirte lo que gastas, no lo que te queda.", puede: entra > 0 },
    { titulo: "¿Y lo que pagas sí o sí?", pie: "El alquiler, o el recibo más gordo que tengas. Los demás los añades luego en dos toques.", puede: true },
    { titulo: "¿Cuánto quieres gastar como mucho?", pie: "Un tope mensual, fijos incluidos. Es la barra que verás en la pantalla principal.", puede: true },
  ];
  const actual = PASOS[paso];

  const terminar = () => {
    const fijos = [];
    if (entra > 0) {
      fijos.push({
        id: uid(), tipo: "ingreso", nombre: "Nómina", importe: entra,
        categoria: "otros", origen: "nomina", dia: 1, desde: mes, hasta: null,
      });
    }
    if (sale > 0 && fijoNombre.trim()) {
      fijos.push({
        id: uid(), tipo: "gasto", nombre: fijoNombre.trim().slice(0, 40), importe: sale,
        categoria: "casa", origen: null, dia: 1, desde: mes, hasta: null,
      });
    }
    onTerminar({ fijos, presupuesto: topeFinal > 0 ? topeFinal : null });
  };

  const siguiente = () => {
    if (!actual.puede) return;
    if (paso < 2) {
      // Al llegar al tope se deja escrita la sugerencia: un número en gris de
      // marcador se lee como «no hay nada puesto» y se acaba escribiendo otro.
      if (paso === 1 && !tope && sugerido > 0) setTope(String(sugerido));
      return setPaso(paso + 1);
    }
    terminar();
  };

  return (
    <div className="gx">
      <style>{CSS}</style>
      <div className="lienzo bienvenida">
        <div className="filaCabecera" style={{ marginTop: 14 }}>
          <span className="etiqueta">{paso + 1} de 3</span>
          <button className="botonTexto" onClick={onSaltar}>Ahora no</button>
        </div>

        <div>
          <h1 className="tituloBienvenida">{actual.titulo}</h1>
          <p className="pie" style={{ marginTop: 6 }}>{actual.pie}</p>
        </div>

        <section className="tarjeta">
          {paso === 0 && (
            <div className="importeZona compacta">
              <input className="importeInput mono" type="number" inputMode="decimal" step="0.01"
                placeholder="0" value={nomina} autoFocus
                onChange={(e) => setNomina(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && siguiente()} />
              <span className="importeMoneda">€</span>
              <span className="porMes">al mes</span>
            </div>
          )}

          {paso === 1 && (
            <>
              <div className="bloque">
                <span className="etiquetaCampo">Concepto</span>
                <input className="campoAncho" maxLength={40} placeholder="Alquiler"
                  value={fijoNombre} onChange={(e) => setFijoNombre(e.target.value)} />
              </div>
              <div className="importeZona compacta">
                <input className="importeInput mono" type="number" inputMode="decimal" step="0.01"
                  placeholder="0" value={fijoImporte} autoFocus
                  onChange={(e) => setFijoImporte(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && siguiente()} />
                <span className="importeMoneda">€</span>
                <span className="porMes">al mes</span>
              </div>
            </>
          )}

          {paso === 2 && (
            <>
              <div className="importeZona compacta">
                <input className="importeInput mono" type="number" inputMode="decimal" step="0.01"
                  placeholder={sugerido ? String(sugerido) : "0"} value={tope} autoFocus
                  onChange={(e) => setTope(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && siguiente()} />
                <span className="importeMoneda">€</span>
              </div>
              {libre !== null && (
                <p className="pie sup" style={{ textAlign: "center", margin: 0 }}>
                  {libre > 0 ? (
                    <>Gastando eso te sobrarían <strong className="txtVerde mono">{eur(libre)}</strong> al mes.</>
                  ) : (
                    <>Con ese tope no te sobraría nada: gastarías todo lo que entra.</>
                  )}
                </p>
              )}
            </>
          )}
        </section>

        {/* Sin `ancho`: ese `flex:1` sirve para repartir una fila, pero aquí la
            columna es vertical y estiraba el botón hasta el final de la
            pantalla. En la columna ya sale a todo lo ancho por sí solo. */}
        <button className="botonPrincipal" disabled={!actual.puede} onClick={siguiente}>
          {paso < 2 ? <>Seguir <ChevronRight size={17} /></> : <><Check size={17} /> Empezar</>}
        </button>

        {paso === 1 && sale === 0 && (
          <button className="botonTexto" onClick={() => setPaso(2)}>No tengo ninguno fijo</button>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────  RESUMEN  ───────────────────────────── */

function Resumen({
  total, totalFijos, totalVariable, totalAnterior,
  nDias, diasTranscurridos, esMesEnCurso, proyeccion, presupuesto, margenVariable,
  balance, avisosTope, ausencia, frecuentes, objetivos, movimientos, nFijos, catPorId,
  onAbrir, onNuevo, onNuevoFijo, onNuevoIngreso, onRepetir, onRevisar, onObjetivos,
  onPresupuesto, onVerTopes,
}) {
  const diff = total - totalAnterior;
  const pct = totalAnterior > 0 ? (diff / totalAnterior) * 100 : null;

  return (
    <>
      <section className="hero anchoCompleto">
        {/* Lo primero es lo que se quiere saber: qué queda. Lo gastado es el
            camino, no el destino, y va debajo con el resto del desglose. */}
        {balance.hayIngresos ? (
          <>
            <span className="etiqueta">Te queda este mes</span>
            <div className={`cifraGrande ${balance.ahorro < 0 ? "enRojo" : ""}`}>{eur(balance.ahorro)}</div>
            <div className="filaResumen">
              <span className="trozo"><ArrowDownRight size={13} /> <b className="mono">{eur(balance.ingresos, false)}</b> entra</span>
              <span className="trozo"><ArrowUpRight size={13} /> <b className="mono">{eur(total, false)}</b> sale</span>
              {balance.tasa !== null && (
                <span className={`delta ${balance.tasa >= 0 ? "baja" : "sube"}`}>
                  <span className="mono">{balance.tasa}%</span> ahorrado
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="etiqueta">Gastado este mes</span>
            <div className="cifraGrande">{eur(total)}</div>
          </>
        )}

        <div className="filaResumen">
          {/* La comparación con el mes pasado solo cuando no hay balance: con
              él ya van tres cifras arriba y una cuarta sobra. Lo que cambió
              respecto al mes anterior lo cuenta la revisión, con su porqué. */}
          {totalAnterior > 0 && !balance.hayIngresos && (
            <span className={`delta ${diff > 0 ? "sube" : diff < 0 ? "baja" : ""}`}>
              {diff > 0 ? <ArrowUpRight size={14} strokeWidth={2.6} /> : diff < 0 ? <ArrowDownRight size={14} strokeWidth={2.6} /> : null}
              <span className="mono">{eur(Math.abs(diff), false)}</span>
              {pct !== null && <span className="mono">{Math.abs(pct).toFixed(0)}%</span>}
            </span>
          )}
          {totalFijos > 0 && (
            <span className="trozo"><Repeat size={13} /> <b className="mono">{eur(totalFijos, false)}</b> fijos</span>
          )}
          <span className="trozo"><Wallet size={13} /> <b className="mono">{eur(totalVariable, false)}</b> variable</span>
        </div>
      </section>

      {/* Días sin apuntar. Va lo primero porque cuanto antes se diga, menos
          gastos se pierden: los del sábado ya no se recuerdan el martes. */}
      {ausencia && (
        <button className="filaAviso" onClick={onNuevo}>
          <span className="insignia" style={{ background: "var(--amberSoft)", color: "var(--amberTexto)" }}>
            <CalendarDays size={17} />
          </span>
          <span className="itemTexto">
            <span className="itemCat">{plural(ausencia.dias, "día")} sin apuntar nada</span>
            <span className="itemNota">Lo último fue el {ausencia.ultimo.slice(8, 10)}/{ausencia.ultimo.slice(5, 7)}</span>
          </span>
          <span className="botonTexto">Apuntar</span>
        </button>
      )}

      {/* Con el mes recién empezado no hay nada que revisar, y la tarjeta negra
          es lo más llamativo de la pantalla: prometía un informe vacío. */}
      {movimientos.length >= 3 && <BotonRevision onRevisar={onRevisar} />}

      {/* Una categoría a punto de reventar su tope es lo único que hay que
          mirar hoy: va arriba, y solo cuando de verdad está pasando. */}
      {avisosTope.length > 0 && (
        <section className="tarjeta avisoTopes">
          <div className="filaCabecera">
            <h2><AlertTriangle size={15} className="hIcono" /> Ojo con estos topes</h2>
            <button className="botonTexto" onClick={onVerTopes}>Ver todos</button>
          </div>
          <ul className="listaAvisos">
            {avisosTope.map((c) => (
              <li key={c.id}>
                <span className="insignia mini" style={{ background: `${c.color}1F`, color: c.color }}>
                  <Icono nombre={c.icono} size={14} />
                </span>
                <span className="avisoTexto">
                  <span className="avisoNombre">{c.nombre}</span>
                  <span className="avisoPie">
                    {c.ratio >= 1
                      ? `te has pasado ${eur(c.total - c.presupuesto, false)}`
                      : `quedan ${eur(c.presupuesto - c.total, false)} de ${eur(c.presupuesto, false)}`}
                  </span>
                </span>
                <span className={`chip ${c.ratio >= 1 ? "chipRojo" : "chipAmbar"}`}>{Math.round(c.ratio * 100)}%</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TarjetaPresupuesto
        presupuesto={presupuesto} total={total} totalFijos={totalFijos}
        margenVariable={margenVariable} nDias={nDias} diasTranscurridos={diasTranscurridos}
        esMesEnCurso={esMesEnCurso} proyeccion={proyeccion} onPresupuesto={onPresupuesto}
      />

      {/* Lo que apuntas una y otra vez, a un toque. Es el atajo que convierte
          «apuntar los gastos» en algo que se hace de verdad todos los días. */}
      {frecuentes.length > 0 && (
        <section className="tarjeta">
          <div className="filaCabecera"><h2>De siempre</h2></div>
          {frecuentes.map((g) => {
            const c = catPorId[g.categoria];
            return (
              <button key={g.nota} className="chipRepetir" onClick={() => onRepetir(g)}>
                <span className="insignia mini" style={{ background: `color-mix(in srgb, ${c?.color || "var(--soft)"} var(--tinte), transparent)`, color: c?.color || "#7C93A8" }}>
                  <Icono nombre={c?.icono} size={14} />
                </span>
                <span className="nom">{g.nota}</span>
                <span className="imp">{eur(g.importe)}</span>
              </button>
            );
          })}
        </section>
      )}

      {objetivos.length > 0 && (
        <section className="tarjeta">
          <div className="filaCabecera">
            <h2><Target size={15} className="hIcono" /> Objetivos</h2>
            <button className="botonTexto" onClick={onObjetivos}>Editar</button>
          </div>
          {objetivos.map((o) => (
            <div key={o.id} style={{ marginBottom: 10 }}>
              <div className="filaCabecera" style={{ marginBottom: 0 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{o.nombre}</span>
                <span className="etiquetaValor mono">{o.porcentaje}%</span>
              </div>
              <div className="barraObj"><div style={{ width: `${o.porcentaje}%` }} /></div>
              <p className="pie">
                {o.conseguido ? "¡Conseguido!" : `${eur(o.ahorrado, false)} de ${eur(o.meta, false)} · faltan ${eur(o.restante, false)}`}
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="tarjeta">
        <div className="filaCabecera">
          <h2>Movimientos</h2>
          <span className="etiquetaValor mono">{movimientos.length}{nFijos > 0 && ` · ${nFijos} fijos`}</span>
        </div>

        {movimientos.length === 0 ? (
          <div className="vacio">
            <div className="vacioIcono"><Wallet size={26} strokeWidth={1.7} /></div>
            <p>Todavía no hay nada apuntado en este mes.</p>
            <div className="vacioBotones">
              <button className="botonPrincipal" onClick={onNuevo}><Plus size={17} /> Añadir un gasto</button>
            <button className="botonSecundario espaciado" onClick={onNuevoIngreso}>
              <ArrowDownRight size={16} /> Apuntar un ingreso
            </button>
              <button className="botonSecundario" onClick={onNuevoFijo}><Repeat size={16} /> Crear un gasto fijo</button>
            </div>
          </div>
        ) : (
          <ul className="lista">
            {movimientos.map((g) => {
              const c = catPorId[g.categoria];
              const color = c?.color || "var(--soft)";
              return (
                <li key={g.id}>
                  <button className="itemGasto" onClick={() => onAbrir(g)}>
                    <span className="insignia" style={{ background: `${color}1F`, color }}>
                      <Icono nombre={c?.icono} size={17} />
                    </span>
                    <span className="itemTexto">
                      {/* El concepto manda: «Mercadona» dice mucho más que
                          «Comida», que ya se ve en el color y en el icono. */}
                      <span className="itemCat">
                        {g.nota || c?.nombre || "Sin categoría"}
                        {g.esFijo && <span className="marcaFijo"><Repeat size={9} strokeWidth={2.6} />fijo</span>}
                      </span>
                      <span className="itemNota">{g.nota ? c?.nombre || "Sin categoría" : ""}</span>
                    </span>
                    <span className="itemDerecha">
                      <span className="itemImporte mono">{eur(g.importe)}</span>
                      <span className="itemFecha mono">{g.fecha.slice(8, 10)}/{g.fecha.slice(5, 7)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function BotonRevision({ onRevisar }) {
  return (
    <button className="tarjetaRevision" onClick={onRevisar}>
      <span className="revisionIcono"><Sparkles size={19} strokeWidth={2.3} /></span>
      <span className="revisionTexto">
        <span className="revisionTitulo">Revisar el mes</span>
        <span className="revisionPie">Qué se ha movido, dónde y qué esperar</span>
      </span>
      <ChevronRight size={19} />
    </button>
  );
}

/**
 * El presupuesto, y el sitio donde se cambia.
 *
 * Estaba enterrado en Ajustes, que es el último sitio donde alguien mira: es
 * el número que da sentido a toda la pantalla principal, así que se edita
 * donde se ve. Se guarda al confirmar y no en cada tecla, que si no cada
 * dígito sería una escritura en la nube.
 */
function TarjetaPresupuesto({
  presupuesto, total, totalFijos, margenVariable, nDias, diasTranscurridos,
  esMesEnCurso, proyeccion, onPresupuesto,
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState("");

  const abrir = () => { setBorrador(presupuesto ? String(presupuesto) : ""); setEditando(true); };
  const confirmar = () => {
    const n = Number(String(borrador).replace(",", "."));
    onPresupuesto(borrador === "" || !(n > 0) ? null : Math.round(n * 100) / 100);
    setEditando(false);
  };

  if (editando) {
    return (
      <section className="tarjeta">
        <div className="filaCabecera"><h2><Wallet size={15} className="hIcono" /> Presupuesto del mes</h2></div>
        <div className="filaEditor">
          <div className="inputEuro">
            <input type="number" inputMode="decimal" placeholder="Sin límite" autoFocus
              value={borrador} onChange={(e) => setBorrador(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmar(); if (e.key === "Escape") setEditando(false); }} />
            <span>€</span>
          </div>
          <button className="botonPrincipal" onClick={confirmar}><Check size={16} /> Guardar</button>
        </div>
        <p className="pie">
          Incluye los gastos fijos, que ya suman {eur(totalFijos, false)}. Déjalo vacío para quitarlo.
        </p>
      </section>
    );
  }

  if (!presupuesto) {
    if (!esMesEnCurso || total === 0) return null;
    return (
      <section className="tarjeta">
        <div className="filaCabecera"><h2>Proyección</h2></div>
        <p className="pie sup">
          A este ritmo cerrarás el mes en <strong>{eur(proyeccion)}</strong>. Con un tope sabrás si eso
          es mucho o poco.
        </p>
        <button className="botonSecundario" onClick={abrir}><Target size={16} /> Poner un presupuesto</button>
      </section>
    );
  }

  const usado = total / presupuesto;
  return (
    <section className="tarjeta">
      <div className="filaCabecera">
        <h2>Presupuesto del mes</h2>
        <button className="botonTexto mono" onClick={abrir}>{eur(presupuesto)} · Editar</button>
      </div>
      <button className="barraPres pulsable" onClick={abrir} aria-label="Cambiar el presupuesto">
        {totalFijos > 0 && (
          <div className="barraPresFijos" style={{ width: `${Math.min(100, (totalFijos / presupuesto) * 100)}%` }} />
        )}
        <div
          className={`barraPresRelleno ${usado > 1 ? "rojo" : usado > 0.85 ? "ambar" : ""}`}
          style={{ width: `${Math.min(100, usado * 100)}%` }}
        />
        {esMesEnCurso && (
          <div className="barraPresMarca" style={{ left: `${Math.min(100, (diasTranscurridos / nDias) * 100)}%` }} />
        )}
      </button>
      <p className="pie">
        {usado > 1 ? (
          <>Te has pasado {eur(total - presupuesto)}.</>
        ) : margenVariable !== null && margenVariable <= 0 ? (
          <>Tus gastos fijos ya se comen el presupuesto entero.</>
        ) : (
          <>Quedan {eur(presupuesto - total)} para {Math.max(0, nDias - diasTranscurridos)} días{totalFijos > 0 && <> (fijos ya descontados)</>}.</>
        )}
        {esMesEnCurso && (
          <> A este ritmo cerrarás en{" "}
            <strong className={proyeccion > presupuesto ? "txtRojo" : "txtVerde"}>{eur(proyeccion)}</strong>.
          </>
        )}
      </p>
    </section>
  );
}

/**
 * El gasto variable, día a día.
 *
 * Vivía en la pantalla principal, donde competía con la cifra grande sin
 * responder a ninguna pregunta urgente. Aquí, en Análisis, está entre sus
 * iguales y la principal respira.
 */
function PulsoDiario({ porDiaVariable, nDias, diasTranscurridos, esMesEnCurso, ritmoDiario, totalVariable }) {
  const maxDia = Math.max(...porDiaVariable, 1);
  const media = diasTranscurridos > 0 ? totalVariable / diasTranscurridos : 0;

  return (
    <section className="tarjeta">
      <div className="filaCabecera">
        <h2><CalendarDays size={15} className="hIcono" /> Día a día</h2>
        <span className="etiquetaValor mono">{eur(media)}/día</span>
      </div>
      <div className="pulso enTarjeta">
        <div className="pulsoBarras">
          {ritmoDiario && ritmoDiario < maxDia && (
            <div className="pulsoRitmo" style={{ bottom: `${Math.min(96, (ritmoDiario / maxDia) * 100)}%` }}>
              <span>ritmo {eur(ritmoDiario)}/día</span>
            </div>
          )}
          {porDiaVariable.map((v, i) => {
            const futuro = esMesEnCurso && i + 1 > diasTranscurridos;
            const esHoy = esMesEnCurso && i + 1 === diasTranscurridos;
            const alto = v > 0 ? Math.max(4, (v / maxDia) * 100) : 3;
            const pasado = ritmoDiario && v > ritmoDiario;
            return (
              <div
                key={i}
                className={`pulsoBarra ${futuro ? "futuro" : ""} ${pasado ? "excede" : ""} ${esHoy ? "hoy" : ""}`}
                style={{ height: `${alto}%` }}
                title={`Día ${i + 1}: ${eur(v)}`}
              />
            );
          })}
        </div>
        <div className="pulsoEje">
          <span>gasto variable por día</span>
          <span className="mono">{nDias} días</span>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────  ANÁLISIS  ───────────────────────────── */

function Analisis({
  porCategoria, total, ultimosMeses, ranking, presupuestoGlobal,
  porDiaVariable, nDias, diasTranscurridos, esMesEnCurso, ritmoDiario, totalVariable,
  onRevisar, onNuevo,
}) {
  /* Este `useState` va arriba del todo por obligación: si se declarase después
     del return de abajo, el día que aparece el primer gasto React pasaría de
     cero hooks a uno y se caería la pestaña entera. */
  const [soloVariable, setSoloVariable] = useState(true);

  if (total === 0 && ultimosMeses.every((m) => m.total === 0)) {
    return (
      <section className="tarjeta">
        <div className="vacio">
          <div className="vacioIcono"><IcAnalisis size={26} strokeWidth={1.7} /></div>
          <p>
            Aquí verás en qué se te va el dinero, cómo va cada tope y qué se ha disparado
            respecto a tus meses anteriores. Necesito unos cuantos gastos apuntados.
          </p>
          <div className="vacioBotones">
            <button className="botonPrincipal" onClick={onNuevo}><Plus size={17} /> Apuntar el primero</button>
          </div>
        </div>
      </section>
    );
  }

  const conPresupuesto = porCategoria.filter((c) => c.presupuesto > 0);
  const lista = soloVariable ? porCategoria.filter((c) => c.variable > 0).map((c) => ({ ...c, total: c.variable })) : porCategoria;
  const totalLista = lista.reduce((s, c) => s + c.total, 0);
  const totalFijosCat = porCategoria.reduce((s, c) => s + (c.total - (c.variable || 0)), 0);

  return (
    <>
      {total > 0 && <BotonRevision onRevisar={onRevisar} />}

      <section className="tarjeta">
        <div className="filaCabecera">
          <h2>Dónde se va el dinero</h2>
          {/* Los fijos no se pueden cambiar este mes: el alquiler se lleva el
              70% y aplasta todo lo demás. Lo interesante es lo variable, que
              es sobre lo que se puede decidir algo. */}
          <div className="conmutador">
            <button className={soloVariable ? "sel" : ""} onClick={() => setSoloVariable(true)}>Variable</button>
            <button className={soloVariable ? "" : "sel"} onClick={() => setSoloVariable(false)}>Todo</button>
          </div>
        </div>
        {lista.length === 0 ? (
          <p className="pie">{soloVariable ? "Sin gastos variables este mes." : "Sin gastos en este mes."}</p>
        ) : (
          <>
            <p className="pie sup">
              <b className="mono">{eur(totalLista, false)}</b> en {plural(lista.length, "categoría", "categorías")}
              {soloVariable && totalFijosCat > 0 && ` · ${eur(totalFijosCat, false)} más en fijos`}
            </p>
            <ul className="leyenda">
              {lista.map((c) => (
                <li key={c.id}>
                  <span className="insignia mini" style={{ background: `${c.color}1F`, color: c.color }}>
                    <Icono nombre={c.icono} size={14} />
                  </span>
                  <span className="leyNombre">{c.nombre}</span>
                  {/* La barra se mide contra lo que hay en la lista, no contra
                      el total del mes: en «Variable» el alquiler no está y
                      todas las barras salían diminutas. */}
                  <span className="leyBarra"><i style={{ width: `${(c.total / (totalLista || 1)) * 100}%`, background: c.color }} /></span>
                  <span className="leyImporte mono">{eur(c.total)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <PulsoDiario
        porDiaVariable={porDiaVariable} nDias={nDias} diasTranscurridos={diasTranscurridos}
        esMesEnCurso={esMesEnCurso} ritmoDiario={ritmoDiario} totalVariable={totalVariable}
      />

      <section className="tarjeta">
        <div className="filaCabecera"><h2>Últimos seis meses</h2></div>
        <Grafica alto={190} style={{ marginLeft: -8 }}>
            <BarChart data={ultimosMeses} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <XAxis dataKey="etiqueta" tickLine={false} axisLine={false}
                tick={{ fill: "var(--soft)", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }} />
              <Tooltip content={<TipMes />} cursor={{ fill: "var(--accent)", fillOpacity: 0.09 }} />
              {presupuestoGlobal > 0 && (
                <ReferenceLine y={presupuestoGlobal} stroke="var(--coral)" strokeDasharray="4 4" strokeWidth={1.5} />
              )}
              <Bar dataKey="total" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {ultimosMeses.map((m) => <Cell key={m.clave} fill={m.actual ? "var(--accent)" : "var(--futuro)"} />)}
              </Bar>
            </BarChart>
        </Grafica>
        {presupuestoGlobal > 0 && <p className="pie">La línea roja marca tu presupuesto de {eur(presupuestoGlobal)}.</p>}
      </section>

      {conPresupuesto.length > 0 && (
        <section className="tarjeta">
          <div className="filaCabecera"><h2>Presupuesto por categoría</h2></div>
          <ul className="listaPres">
            {conPresupuesto.map((c) => {
              const lim = c.presupuesto;
              const r = c.total / lim;
              return (
                <li key={c.id}>
                  <div className="presFila">
                    <span className="presNombre">
                      <span className="insignia mini" style={{ background: `${c.color}1F`, color: c.color }}>
                        <Icono nombre={c.icono} size={14} />
                      </span>
                      {c.nombre}
                    </span>
                    <span className={`presCifra mono ${r > 1 ? "txtRojo" : ""}`}>{eur(c.total)} / {eur(lim, false)}</span>
                  </div>
                  <div className="barraPres pequena">
                    <div className={`barraPresRelleno ${r > 1 ? "rojo" : r > 0.85 ? "ambar" : ""}`}
                      style={{ width: `${Math.min(100, r * 100)}%`, background: r <= 0.85 ? c.color : undefined }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="tarjeta">
        <div className="filaCabecera"><h2>Qué se ha disparado</h2></div>
        {ranking.length === 0 ? (
          <p className="pie">Necesito al menos un mes anterior con gastos para poder comparar.</p>
        ) : (
          <>
            <p className="pie sup">Comparado con tu media de los meses anteriores.</p>
            <ul className="listaRank">
              {ranking.map((r) => (
                <li key={r.id}>
                  <span className="insignia mini" style={{ background: `${r.color}1F`, color: r.color }}>
                    <Icono nombre={r.icono} size={14} />
                  </span>
                  <span className="rankTexto">
                    <span className="rankNombre">{r.nombre}</span>
                    <span className="rankMedia mono">media {eur(r.previa, false)}</span>
                  </span>
                  <span className={`chip ${r.delta > 0 ? "chipRojo" : r.delta < 0 ? "chipVerde" : ""}`}>
                    {r.delta > 0 ? "+" : ""}{eur(r.delta, false)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

function TipMes({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="tip">
      <strong>{label}</strong>
      <span className="mono">{eur(payload[0].value)}</span>
    </div>
  );
}

/* ─────────────────────────────  REVISIÓN DEL MES  ───────────────────────────── */

const ICONO_HALLAZGO = { ojo: AlertTriangle, bien: ThumbsUp, consejo: Lightbulb, neutro: TrendingUp };

function Revision({ datos, catPorId, mesKey, onMover, esMesEnCurso, onCerrar }) {
  const informe = useMemo(() => analizarMes(datos, mesKey, catPorId), [datos, mesKey, catPorId]);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  const copiar = async () => {
    if (!informe.hayDatos) return;
    const texto = [
      `Revisión de ${informe.titulo} — nota ${informe.nota}/10`,
      informe.titular,
      "",
      ...informe.bloques.map((b) => `${b.area}: ${b.texto}`),
      "",
      ...informe.hallazgos.map((h) => `· ${h.titulo}: ${h.texto}`),
      "",
      informe.cierre,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch (e) { /* sin portapapeles, no pasa nada */ }
  };

  return (
    <div className="pantallaCompleta">
      <div className="pantallaCaja">
        <div className="pantallaCabecera">
          <div>
            <span className="etiqueta">Revisión</span>
            <h2 className="pantallaTitulo">Cómo va el mes</h2>
          </div>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={19} /></button>
        </div>

        <div className="navMes">
          <button className="flecha" onClick={() => onMover(-1)} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
          <span className="navMesTitulo">{informe.titulo}</span>
          <button className="flecha" onClick={() => onMover(1)} aria-label="Mes siguiente" disabled={esMesEnCurso}>
            <ChevronRight size={18} />
          </button>
        </div>

        {!informe.hayDatos ? (
          <section className="tarjeta">
            <div className="vacio">
              <div className="vacioIcono"><Sparkles size={26} strokeWidth={1.7} /></div>
              <p>{informe.motivo}</p>
            </div>
          </section>
        ) : (
          <>
            <section className={`tarjeta notaMes ${informe.tono}`}>
              <div className="notaFila">
                <span className="notaCifra mono">{informe.nota}</span>
                <span className="notaSobre">/ 10</span>
                {informe.esActual && <span className="notaParcial">mes en curso</span>}
              </div>
              <p className="notaTitular">{informe.titular}</p>
              <p className="notaPie">
                Calculado con tus propios números: {informe.cifras.nMovimientos} movimientos
                {informe.cifras.mesesComparados > 0 && ` comparados con tus ${informe.cifras.mesesComparados} meses anteriores`}.
              </p>
            </section>

            {informe.bloques.map((b) => {
              const Ic = ICONO_BLOQUE[b.icono] || Sparkles;
              return (
                <section className="tarjeta" key={b.area}>
                  <div className="filaCabecera">
                    <h2>
                      <span className="insignia mini" style={{ background: `${b.color}1F`, color: b.color }}>
                        <Ic size={14} strokeWidth={2.3} />
                      </span>
                      {b.area}
                    </h2>
                  </div>
                  <p className="parrafo">{b.texto}</p>
                </section>
              );
            })}

            {informe.hallazgos.length > 0 && (
              <section className="tarjeta">
                <div className="filaCabecera"><h2>Detalles que se ven en los números</h2></div>
                <ul className="listaHallazgos">
                  {informe.hallazgos.map((h) => {
                    const Ic = ICONO_HALLAZGO[h.tono] || TrendingUp;
                    return (
                      <li key={h.clave} className={`hallazgo ${h.tono}`}>
                        <span className="hallazgoIcono"><Ic size={15} strokeWidth={2.3} /></span>
                        <div>
                          <p className="hallazgoTitulo">{h.titulo}</p>
                          <p className="hallazgoTexto">{h.texto}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section className="tarjeta cierre">
              <p>{informe.cierre}</p>
            </section>

            <button className="botonSecundario" onClick={copiar}>
              {copiado ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar la revisión</>}
            </button>
            <p className="pie" style={{ textAlign: "center" }}>
              Todo esto se calcula en tu dispositivo, al instante y sin conexión.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────  BUSCAR  ───────────────────────────── */

/**
 * Buscar en todo el historial, no solo en el mes que se está mirando.
 *
 * Era lo que faltaba para poder responder «¿cuánto llevo en el dentista?».
 * Se filtra en el cliente porque los datos ya están todos en memoria: pedirle
 * esto a Firestore costaría índices y no aportaría nada.
 */
function PantallaBuscar({ datos, catPorId, onAbrir, onCerrar }) {
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const refBusca = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => refBusca.current?.focus(), 120);
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => { clearTimeout(t); window.removeEventListener("keydown", alPulsar); };
  }, [onCerrar]);

  /* Los tres tramos que se piden de verdad. Escribir dos fechas a mano en el
     móvil para preguntar «¿cuánto llevo este año?» no lo hace nadie. */
  const hoy = hoyISO();
  const TRAMOS = [
    { id: "todo", label: "Todo", desde: "", hasta: "" },
    { id: "ano", label: "Este año", desde: `${hoy.slice(0, 4)}-01-01`, hasta: "" },
    { id: "12m", label: "12 meses", desde: `${Number(hoy.slice(0, 4)) - 1}${hoy.slice(4)}`, hasta: "" },
  ];
  const tramoActivo = TRAMOS.find((t) => t.desde === desde && t.hasta === hasta);

  const resultados = useMemo(
    () => buscarMovimientos(datos, { texto, categoria, desde: desde || null, hasta: hasta || null }),
    [datos, texto, categoria, desde, hasta]
  );
  const gastado = resultados.filter((m) => m.tipo === "gasto").reduce((s, m) => s + m.importe, 0);
  const ingresado = resultados.filter((m) => m.tipo === "ingreso").reduce((s, m) => s + m.importe, 0);
  const hayFiltro = texto.trim() || categoria || desde || hasta;

  return (
    <div className="pantallaCompleta">
      <div className="pantallaCaja">
        <div className="hojaCabecera">
          <h2>Buscar</h2>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={19} /></button>
        </div>

        <div className="bloque">
          <input ref={refBusca} className="campoAncho" placeholder="Mercadona, gasolina, dentista…"
            value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>

        <div className="chipsCat" style={{ marginBottom: 14 }}>
          <button className={`chipCat ${!categoria ? "sel" : ""}`} onClick={() => setCategoria(null)}>Todas</button>
          {datos.categorias.map((c) => (
            <button key={c.id} className={`chipCat ${categoria === c.id ? "sel" : ""}`}
              style={categoria === c.id ? { background: c.color, borderColor: c.color, color: "var(--sobreAcento)" } : undefined}
              onClick={() => setCategoria(categoria === c.id ? null : c.id)}>
              <Icono nombre={c.icono} size={15} /> {c.nombre}
            </button>
          ))}
        </div>

        <div className="bloque">
          <span className="etiquetaCampo">Cuándo</span>
          <div className="chips" style={{ marginBottom: 10 }}>
            {TRAMOS.map((t) => (
              <button key={t.id} className={`chipCat ${tramoActivo?.id === t.id ? "sel" : ""}`}
                style={tramoActivo?.id === t.id ? { background: "var(--accent)", borderColor: "var(--accent)", color: "var(--sobreAcento)" } : undefined}
                onClick={() => { setDesde(t.desde); setHasta(t.hasta); }}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="dosColumnas">
            <label className="campo">
              <span>Desde</span>
              <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} />
            </label>
            <label className="campo">
              <span>Hasta</span>
              <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} />
            </label>
          </div>
        </div>

        {hayFiltro && (
          <section className="tarjeta">
            <p className="pie">
              <b className="mono">{plural(resultados.length, "movimiento")}</b>
              {gastado > 0 && ` · ${eur(gastado)} gastados`}
              {ingresado > 0 && ` · ${eur(ingresado)} ingresados`}
            </p>
          </section>
        )}

        <section className="tarjeta">
          {resultados.length === 0 ? (
            <div className="vacio">
              <div className="vacioIcono"><Search size={26} strokeWidth={1.7} /></div>
              <p>{hayFiltro ? "Nada coincide con eso." : "Escribe para buscar en todo tu historial."}</p>
            </div>
          ) : (
            <ul className="listaGastos">
              {resultados.slice(0, 120).map((m) => {
                const c = catPorId[m.categoria];
                const esIngreso = m.tipo === "ingreso";
                const color = esIngreso ? "var(--mint)" : c?.color || "var(--soft)";
                return (
                  <li key={`${m.tipo}:${m.id}`}>
                    <button className="itemGasto" onClick={() => !esIngreso && onAbrir(m)}>
                      <span className="insignia" style={{ background: `${color}1F`, color }}>
                        <Icono nombre={esIngreso ? origenDe(m.origen).icono : c?.icono} size={17} />
                      </span>
                      <span className="itemTexto">
                        <span className="itemCat">{m.nota || (esIngreso ? origenDe(m.origen).label : c?.nombre)}</span>
                        <span className="itemNota">{esIngreso ? "Ingreso" : c?.nombre || "Sin categoría"}</span>
                      </span>
                      <span className="itemDerecha">
                        <span className="itemImporte mono" style={esIngreso ? { color: "var(--mint)" } : undefined}>
                          {esIngreso ? "+" : ""}{eur(m.importe)}
                        </span>
                        <span className="itemFecha mono">{m.fecha.slice(8, 10)}/{m.fecha.slice(5, 7)}/{m.fecha.slice(2, 4)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ─────────────────────────────  OBJETIVOS  ───────────────────────────── */

/**
 * Objetivos de ahorro. Viven dentro de `ajustes`, no en su propia colección:
 * son dos o tres, se editan de uno en uno y no merecen la complicación.
 */
function PantallaObjetivos({ objetivos, onGuardar, onCerrar }) {
  const [lista, setLista] = useState(() => objetivos.map((o) => ({ ...o })));

  useEffect(() => {
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  const cambiar = (i, campo, valor) =>
    setLista((l) => l.map((o, j) => (j === i ? { ...o, [campo]: valor } : o)));

  const guardar = () => {
    const limpia = lista
      .filter((o) => String(o.nombre || "").trim() && Number(o.meta) > 0)
      .map((o) => ({
        id: o.id || uid(),
        nombre: String(o.nombre).trim().slice(0, 40),
        meta: Math.round(Number(o.meta) * 100) / 100,
        ahorrado: Math.round((Number(o.ahorrado) || 0) * 100) / 100,
      }));
    onGuardar(limpia);
    onCerrar();
  };

  return (
    <div className="pantallaCompleta">
      <div className="pantallaCaja">
        <div className="hojaCabecera">
          <h2><Target size={16} className="hIcono" /> Objetivos de ahorro</h2>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={19} /></button>
        </div>

        <p className="pie sup">
          Un objetivo concreto —«3.000 € para el coche»— convierte «ahorrar» en algo que se puede
          medir. Ve subiendo lo ahorrado a mano cuando apartes dinero.
        </p>

        {lista.map((o, i) => {
          const p = progresoObjetivo(o);
          return (
            <section key={i} className="tarjeta">
              <div className="bloque">
                <span className="etiquetaCampo">Para qué</span>
                <input className="campoAncho" placeholder="Un coche" maxLength={40}
                  value={o.nombre || ""} onChange={(e) => cambiar(i, "nombre", e.target.value)} />
              </div>
              <div className="bloque dosColumnas">
                <label>
                  <span>Objetivo (€)</span>
                  <input type="number" inputMode="decimal" placeholder="3000"
                    value={o.meta ?? ""} onChange={(e) => cambiar(i, "meta", e.target.value)} />
                </label>
                <label>
                  <span>Ya ahorrado (€)</span>
                  <input type="number" inputMode="decimal" placeholder="0"
                    value={o.ahorrado ?? ""} onChange={(e) => cambiar(i, "ahorrado", e.target.value)} />
                </label>
              </div>
              {p && (
                <>
                  <div className="barraObj"><div style={{ width: `${p.porcentaje}%` }} /></div>
                  <p className="pie">
                    {p.conseguido ? "¡Conseguido!" : `${p.porcentaje}% · faltan ${eur(p.restante, false)}`}
                  </p>
                </>
              )}
              <button className="botonPeligro" onClick={() => setLista((l) => l.filter((_, j) => j !== i))}>
                <Trash2 size={16} /> Quitar
              </button>
            </section>
          );
        })}

        <button className="botonSecundario" onClick={() => setLista((l) => [...l, { id: uid(), nombre: "", meta: "", ahorrado: "" }])}>
          <Plus size={16} /> Añadir objetivo
        </button>
        <button className="botonPrincipal ancho espaciado" onClick={guardar}>Guardar</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────  EL AÑO  ───────────────────────────── */

/**
 * Los doce meses de un año, y lo que queda al final.
 *
 * La app sabía contar meses y nada más largo, así que «¿cuánto he ahorrado
 * este año?» no tenía dónde responderse. Los meses que aún no han llegado se
 * dibujan en gris y no suman: presumir de un ahorro de diciembre en agosto
 * sería mentir con buena letra.
 */
function PantallaAnual({ datos, catPorId, anoInicial, onCerrar }) {
  const [ano, setAno] = useState(anoInicial);
  const anos = useMemo(() => anosConDatos(datos), [datos]);
  const a = useMemo(() => resumenAnual(datos, ano), [datos, ano]);

  useEffect(() => {
    const alPulsar = (e) => {
      if (e.key === "Escape") onCerrar();
      if (e.key === "ArrowLeft") setAno((x) => Math.max(Math.min(...anos), x - 1));
      if (e.key === "ArrowRight") setAno((x) => Math.min(Math.max(...anos), x + 1));
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar, anos]);

  const maxMes = Math.max(...a.meses.map((m) => Math.max(m.gastos, m.ingresos)), 1);
  const primero = Math.min(...anos);
  const ultimo = Math.max(...anos);

  return (
    <div className="pantallaCompleta">
      <div className="pantallaCaja">
        <div className="hojaCabecera">
          <h2><CalendarDays size={16} className="hIcono" /> El año</h2>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={19} /></button>
        </div>

        <div className="navMes">
          <button className="flecha" onClick={() => setAno(ano - 1)} disabled={ano <= primero} aria-label="Año anterior">
            <ChevronLeft size={19} />
          </button>
          <span className="navMesTitulo mono">{ano}</span>
          <button className="flecha" onClick={() => setAno(ano + 1)} disabled={ano >= ultimo} aria-label="Año siguiente">
            <ChevronRight size={19} />
          </button>
        </div>

        {!a.hayDatos ? (
          <section className="tarjeta">
            <div className="vacio">
              <div className="vacioIcono"><CalendarDays size={26} strokeWidth={1.7} /></div>
              <p>En {ano} no hay nada apuntado.</p>
            </div>
          </section>
        ) : (
          <>
            <section className="hero anchoCompleto">
              {a.ahorrado !== null ? (
                <>
                  <span className="etiqueta">{a.ahorrado >= 0 ? "Ahorrado en el año" : "Te has pasado en el año"}</span>
                  <div className={`cifraGrande ${a.ahorrado < 0 ? "enRojo" : ""}`}>{eur(Math.abs(a.ahorrado))}</div>
                  <div className="filaResumen">
                    <span className="trozo"><ArrowDownRight size={13} /> <b className="mono">{eur(a.ingresado, false)}</b> entra</span>
                    <span className="trozo"><ArrowUpRight size={13} /> <b className="mono">{eur(a.gastado, false)}</b> sale</span>
                    {a.tasa !== null && (
                      <span className={`delta ${a.tasa >= 0 ? "baja" : "sube"}`}>
                        <span className="mono">{a.tasa}%</span> ahorrado
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span className="etiqueta">Gastado en el año</span>
                  <div className="cifraGrande">{eur(a.gastado)}</div>
                  <p className="pie">Apunta lo que entra y aquí verás lo que ahorras, no solo lo que gastas.</p>
                </>
              )}
            </section>

            <section className="tarjeta anchoCompleto">
              <div className="filaCabecera">
                <h2>Mes a mes</h2>
                <span className="etiquetaValor mono">{eur(a.media, false)}/mes de media</span>
              </div>
              <div className="anoBarras">
                {a.meses.map((m) => {
                  const alto = m.gastos > 0 ? Math.max(3, (m.gastos / maxMes) * 100) : 2;
                  const altoIn = m.ingresos > 0 ? Math.max(3, (m.ingresos / maxMes) * 100) : 0;
                  return (
                    <div key={m.clave} className="anoMes">
                      <div className="anoColumna" title={`${m.etiqueta}: ${eur(m.gastos)}`}>
                        {altoIn > 0 && <div className="anoIngreso" style={{ height: `${altoIn}%` }} />}
                        <div className={`anoGasto ${m.futuro ? "futuro" : ""} ${m.enCurso ? "enCurso" : ""}`}
                          style={{ height: `${alto}%` }} />
                      </div>
                      <span className={`anoEtiqueta ${m.enCurso ? "enCurso" : ""}`}>{m.etiqueta}</span>
                    </div>
                  );
                })}
              </div>
              <p className="pie">
                La barra clara de detrás es lo que entró.
                {a.caro && <> El mes más caro fue <strong>{MESES[a.caro.mes]}</strong>, con {eur(a.caro.gastos, false)}</>}
                {a.barato && <>, y el más barato <strong>{MESES[a.barato.mes]}</strong>, con {eur(a.barato.gastos, false)}</>}
                {a.caro && "."}
              </p>
            </section>

            <section className="tarjeta">
              <div className="filaCabecera">
                <h2>Dónde se fue el año</h2>
                <span className="etiquetaValor mono">{plural(a.categorias.length, "categoría", "categorías")}</span>
              </div>
              <ul className="leyenda">
                {a.categorias.slice(0, 8).map((c) => {
                  const cat = catPorId[c.id];
                  const color = cat?.color || "var(--soft)";
                  return (
                    <li key={c.id}>
                      <span className="insignia mini" style={{ background: `${color}1F`, color }}>
                        <Icono nombre={cat?.icono} size={14} />
                      </span>
                      <span className="leyNombre">{cat?.nombre || "Sin categoría"}</span>
                      <span className="leyBarra"><i style={{ width: `${(c.total / a.categorias[0].total) * 100}%`, background: color }} /></span>
                      <span className="leyImporte mono">{eur(c.total, false)}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="pie">
                Son {plural(a.mesesConDatos, "mes", "meses")} con algo apuntado, no el año entero.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────  LO QUE SE REPITE  ───────────────────────────── */

/**
 * Nómina, alquiler y suscripciones, en su propia pantalla.
 *
 * Estaban dentro de Ajustes, que medía dos pantallas de scroll y los mezclaba
 * con las copias de seguridad. No son un ajuste: son la parte del mes que ya
 * está decidida antes de empezar, y de ellos sale lo que de verdad te queda.
 */
function PantallaFijos({ fijos, catPorId, mesKey, onEditar, onNuevo, onCerrar }) {
  useEffect(() => {
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  const activos = fijos.filter((f) => !f.hasta || mesKey <= f.hasta);
  const dadosDeBaja = fijos.filter((f) => f.hasta && mesKey > f.hasta);
  const ingresos = activos.filter((f) => f.tipo === "ingreso");
  const gastos = activos.filter((f) => f.tipo !== "ingreso");
  const enCurso = (l) => l.filter((f) => f.desde <= mesKey).reduce((s, f) => s + f.importe, 0);
  const entra = enCurso(ingresos);
  const sale = enCurso(gastos);

  const Fila = ({ f, apagado }) => {
    const esIngreso = f.tipo === "ingreso";
    const c = catPorId[f.categoria];
    const color = apagado ? "var(--tenue)" : esIngreso ? "var(--mint)" : c?.color || "var(--soft)";
    const pendiente = f.desde > mesKey;
    return (
      <li>
        <button className="itemGasto" onClick={() => onEditar(f)}>
          <span className="insignia" style={{ background: apagado ? "var(--suave)" : `color-mix(in srgb, ${color} var(--tinte), transparent)`, color }}>
            <Icono nombre={esIngreso ? origenDe(f.origen).icono : c?.icono} size={17} />
          </span>
          <span className="itemTexto">
            <span className="itemCat">{f.nombre}</span>
            <span className="itemNota">
              día {f.dia}
              {/* Con la nómina llamada «Nómina», repetir el origen debajo no
                  añade nada: solo se dice cuando aporta algo. */}
              {(() => {
                const et = esIngreso ? origenDe(f.origen).label : c?.nombre || "Sin categoría";
                return et.toLowerCase() === f.nombre.trim().toLowerCase() ? "" : ` · ${et}`;
              })()}
              {pendiente && ` · desde ${nombreMesClave(f.desde)}`}
              {f.hasta && ` · hasta ${nombreMesClave(f.hasta)}`}
            </span>
          </span>
          <span className="itemImporte mono" style={esIngreso && !apagado ? { color: "var(--mint)" } : undefined}>
            {esIngreso ? "+" : ""}{eur(f.importe)}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="pantallaCompleta">
      <div className="pantallaCaja">
        <div className="hojaCabecera">
          <h2><Repeat size={16} className="hIcono" /> Cada mes</h2>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={19} /></button>
        </div>

        {fijos.length === 0 ? (
          <section className="tarjeta">
            <div className="vacio">
              <div className="vacioIcono"><Repeat size={26} strokeWidth={1.7} /></div>
              <p>
                Lo que entra y sale sin que tengas que apuntarlo: la nómina, el alquiler, las
                suscripciones. Se ponen una vez y aparecen solos todos los meses.
              </p>
              <div className="vacioBotones">
                <button className="botonPrincipal" onClick={() => onNuevo("ingreso")}>
                  <ArrowDownRight size={17} /> Añadir la nómina
                </button>
                <button className="botonSecundario" onClick={() => onNuevo("gasto")}>
                  <Plus size={16} /> Añadir un gasto fijo
                </button>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="tarjeta">
              <div className="filaCabecera">
                <h2><ArrowDownRight size={15} className="hIcono" /> Lo que entra</h2>
                {entra > 0 && <span className="etiquetaValor mono">{eur(entra, false)}/mes</span>}
              </div>
              {ingresos.length === 0 ? (
                <p className="pie sup">
                  Sin la nómina apuntada, la app solo puede decirte lo que gastas, no lo que te queda.
                </p>
              ) : (
                <ul className="listaFijos">{ingresos.map((f) => <Fila key={f.id} f={f} />)}</ul>
              )}
              <button className="botonSecundario espaciado" onClick={() => onNuevo("ingreso")}>
                <Plus size={16} /> Añadir un ingreso fijo
              </button>
            </section>

            <section className="tarjeta">
              <div className="filaCabecera">
                <h2><ArrowUpRight size={15} className="hIcono" /> Lo que sale</h2>
                {sale > 0 && <span className="etiquetaValor mono">{eur(sale, false)}/mes</span>}
              </div>
              {gastos.length === 0 ? (
                <p className="pie sup">El alquiler, la luz, el gimnasio: lo que se paga sí o sí.</p>
              ) : (
                <ul className="listaFijos">{gastos.map((f) => <Fila key={f.id} f={f} />)}</ul>
              )}
              <button className="botonSecundario espaciado" onClick={() => onNuevo("gasto")}>
                <Plus size={16} /> Añadir un gasto fijo
              </button>
            </section>

            {dadosDeBaja.length > 0 && (
              <section className="tarjeta">
                <div className="filaCabecera"><h2>Ya no activos</h2></div>
                <ul className="listaFijos apagada">
                  {dadosDeBaja.map((f) => <Fila key={f.id} f={f} apagado />)}
                </ul>
                <p className="pie">
                  Siguen contando en los meses anteriores, así que tu historial no cambia.
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────  AJUSTES  ───────────────────────────── */

function Ajustes({
  datos, catPorId, mesKey, guardar, borrar, guardarUsuario, onRestaurar, onVaciar,
  onFijos, onObjetivos, onCuenta, sesion,
}) {
  const [nuevaCat, setNuevaCat] = useState("");
  const [colorCat, setColorCat] = useState(PALETA[0]);
  const [iconoCat, setIconoCat] = useState("package");
  const [copiado, setCopiado] = useState(false);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const [editandoIcono, setEditandoIcono] = useState(null);
  const [avisoCopia, setAvisoCopia] = useState(null);
  const [tema, setTema] = useState(() => temaGuardado());
  const refArchivo = useRef(null);

  /* Preferencia de esta pantalla, no de la cuenta: se aplica y se guarda a la
     vez para que el cambio se vea sin recargar. */
  const cambiarTema = (id) => { setTema(id); aplicarTema(id); guardarTema(id); };

  const fijos = datos.fijos || [];
  const activos = fijos.filter((f) => !f.hasta || mesKey <= f.hasta);
  const enCurso = activos.filter((f) => f.desde <= mesKey);
  const totalFijosActivos = enCurso.filter((f) => f.tipo !== "ingreso").reduce((s, f) => s + f.importe, 0);
  const totalIngresosFijos = enCurso.filter((f) => f.tipo === "ingreso").reduce((s, f) => s + f.importe, 0);
  const presupuesto = presupuestoValido(datos.ajustes && datos.ajustes.presupuestoGlobal);
  const objetivos = datos.ajustes?.objetivos || [];

  const anadirCategoria = () => {
    const nombre = nuevaCat.trim();
    if (!nombre) return;
    // Al final de la lista, como hacía la versión anterior al añadirla al array.
    const orden = Math.max(-1, ...datos.categorias.map((c) => c.orden ?? -1)) + 1;
    guardar("categorias", { id: uid(), nombre, color: colorCat, icono: iconoCat, presupuesto: null, orden });
    setNuevaCat("");
    setIconoCat("package");
    setColorCat(PALETA[(PALETA.indexOf(colorCat) + 1) % PALETA.length]);
  };

  const borrarCategoria = (id) => {
    const gastosAfectados = datos.gastos.filter((g) => g.categoria === id);
    const fijosAfectados = fijos.filter((f) => f.categoria === id);
    const usados = gastosAfectados.length + fijosAfectados.length;
    if (usados > 0 && !window.confirm(`${usados} apunte(s) usan esta categoría. Se moverán a otra. ¿Sigo?`)) return;

    const destino =
      datos.categorias.find((c) => c.id === "otros")?.id || datos.categorias.find((c) => c.id !== id)?.id;
    if (!destino) return;

    // Primero se mudan los apuntes, y solo entonces desaparece la categoría:
    // así no queda ni un instante con gastos apuntando a algo que ya no existe.
    for (const g of gastosAfectados) guardar("gastos", { ...g, categoria: destino });
    for (const f of fijosAfectados) guardar("fijos", { ...f, categoria: destino });
    borrar("categorias", id);
  };

  const cambiarCat = (id, campos) => {
    const c = (datos.categorias || []).find((x) => x.id === id);
    if (c) guardar("categorias", { ...c, ...campos });
  };

  const ponPresupuesto = (valor) =>
    guardarUsuario({ ajustes: { ...datos.ajustes, presupuestoGlobal: valor } });

  const copiarPortapapeles = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(datos));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) { setCopiado(false); }
  };

  const alElegirArchivo = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      await onRestaurar(f);
      setAvisoCopia({ ok: true, texto: "Copia restaurada en tu cuenta" });
    } catch (err) {
      setAvisoCopia({ ok: false, texto: "Ese archivo no parece una copia válida" });
    }
    e.target.value = "";
    setTimeout(() => setAvisoCopia(null), 3500);
  };

  return (
    <>
      {/* Los fijos no son un ajuste: son la mitad de tu mes. Tienen pantalla
          propia, y aquí solo queda la puerta para entrar. */}
      <button className="filaAjuste" onClick={onFijos}>
        <span className="insignia" style={{ background: "var(--accentSoft)", color: "var(--accent)" }}>
          <Repeat size={17} />
        </span>
        <span className="itemTexto">
          <span className="itemCat">Lo que se repite cada mes</span>
          <span className="itemNota">
            {fijos.length === 0
              ? "Nómina, alquiler, suscripciones…"
              : `${plural(enCurso.length, "apunte")}` +
                (totalIngresosFijos > 0 ? ` · +${eur(totalIngresosFijos, false)}` : "") +
                (totalFijosActivos > 0 ? ` · −${eur(totalFijosActivos, false)}` : "")}
          </span>
        </span>
        <ChevronRight size={19} className="hIcono" />
      </button>

      {/* La tarjeta de objetivos del Resumen solo aparece cuando ya hay
          alguno, así que sin esta fila no había forma de crear el primero. */}
      <button className="filaAjuste" onClick={onObjetivos}>
        <span className="insignia" style={{ background: "var(--mintSoft)", color: "var(--mint)" }}>
          <Target size={17} />
        </span>
        <span className="itemTexto">
          <span className="itemCat">Objetivos de ahorro</span>
          <span className="itemNota">
            {objetivos.length === 0
              ? "«3.000 € para el coche», y ver cuánto llevas"
              : plural(objetivos.length, "objetivo")}
          </span>
        </span>
        <ChevronRight size={19} className="hIcono" />
      </button>

      <section className="tarjeta">
        <div className="filaCabecera"><h2><Sparkles size={15} className="hIcono" /> Aspecto</h2></div>
        <p className="nota" style={{ marginBottom: 10 }}>
          «Automático» sigue lo que tenga puesto el móvil. Se guarda en este dispositivo.
        </p>
        <div className="conmutador">
          {TEMAS_ELEGIBLES.map((t) => (
            <button key={t.id} className={tema === t.id ? "sel" : ""} aria-pressed={tema === t.id}
              onClick={() => cambiarTema(t.id)} style={{ flex: 1, minHeight: 40 }}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="tarjeta">
        <div className="filaCabecera"><h2><Wallet size={15} className="hIcono" /> Presupuesto mensual</h2></div>
        <label className="campo">
          <span>Límite global</span>
          <div className="inputEuro">
            <input type="number" inputMode="decimal" placeholder="Sin límite"
              value={presupuesto ?? ""}
              onChange={(e) => ponPresupuesto(e.target.value === "" ? null : Number(e.target.value))} />
            <span>€</span>
          </div>
        </label>
        <p className="pie">
          Incluye los gastos fijos. Con {eur(totalFijosActivos, false)} de fijos,
          {presupuesto
            ? ` te quedan ${eur(Math.max(0, presupuesto - totalFijosActivos), false)} para el resto.`
            : " ponle un tope y verás cuánto te queda libre."}
          {" "}También se puede cambiar tocando la barra del Resumen.
        </p>
      </section>

      <section className="tarjeta">
        <div className="filaCabecera">
          <h2><Package size={15} className="hIcono" /> Categorías</h2>
          <span className="etiquetaValor mono">{datos.categorias.length}</span>
        </div>

        <ul className="listaCat">
          {datos.categorias.map((c) => (
            <li key={c.id}>
              <div className="catFila">
                <button className="insignia pulsable" style={{ background: `${c.color}1F`, color: c.color }}
                  onClick={() => setEditandoIcono(editandoIcono === c.id ? null : c.id)}
                  aria-label={`Cambiar icono de ${c.nombre}`}>
                  <Icono nombre={c.icono} size={17} />
                </button>
                <input className="catNombre" value={c.nombre}
                  onChange={(e) => cambiarCat(c.id, { nombre: e.target.value })} />
                <div className="inputEuro mini">
                  <input type="number" inputMode="decimal" placeholder="—"
                    value={c.presupuesto ?? ""}
                    onChange={(e) => cambiarCat(c.id, { presupuesto: e.target.value === "" ? null : Number(e.target.value) })} />
                  <span>€</span>
                </div>
                <button className="borrarCat" onClick={() => borrarCategoria(c.id)} aria-label={`Eliminar ${c.nombre}`}>
                  <Trash2 size={15} />
                </button>
              </div>

              {editandoIcono === c.id && (
                <div className="editorIcono">
                  <div className="rejillaIconos">
                    {CLAVES_ICONO.map((k) => (
                      <button key={k} className={`opIcono ${c.icono === k ? "sel" : ""}`}
                        style={c.icono === k ? { background: c.color, color: "var(--sobreAcento)" } : undefined}
                        onClick={() => cambiarCat(c.id, { icono: k })} aria-label={k}>
                        <Icono nombre={k} size={16} />
                      </button>
                    ))}
                  </div>
                  <div className="colores">
                    {PALETA.map((col) => (
                      <button key={col} className={`swatch ${c.color === col ? "elegido" : ""}`}
                        style={{ background: col }} onClick={() => cambiarCat(c.id, { color: col })}
                        aria-label={`Color ${col}`} />
                    ))}
                  </div>
                  <button className="botonSecundario" onClick={() => setEditandoIcono(null)}>
                    <Check size={16} /> Hecho
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="anadirCat">
          <div className="anadirFila">
            <span className="insignia" style={{ background: `${colorCat}1F`, color: colorCat }}>
              <Icono nombre={iconoCat} size={17} />
            </span>
            <input placeholder="Nueva categoría" value={nuevaCat}
              onChange={(e) => { setNuevaCat(e.target.value); setIconoCat(adivinarIcono(e.target.value)); }}
              onKeyDown={(e) => e.key === "Enter" && anadirCategoria()} />
            <button className="botonPrincipal" onClick={anadirCategoria}>Añadir</button>
          </div>
          <div className="colores separadas">
            {PALETA.map((col) => (
              <button key={col} className={`swatch ${colorCat === col ? "elegido" : ""}`}
                style={{ background: col }} onClick={() => setColorCat(col)} aria-label={`Color ${col}`} />
            ))}
          </div>
        </div>
        <p className="pie">Toca el icono de cualquier categoría para cambiarlo. El campo pequeño es su tope mensual.</p>
      </section>

      <section className="tarjeta">
        <div className="filaCabecera">
          <h2><Sparkles size={15} className="hIcono" /> Sincronización</h2>
        </div>
        <p className="pie sup">
          Conectado como {sesion.email}. Todo se guarda en tu cuenta al momento, así que lo que
          apuntes aquí aparece también en tus otros dispositivos.
        </p>
        <button className="botonSecundario" onClick={onCuenta}>Ver mi cuenta</button>
      </section>

      <section className="tarjeta">
        <div className="filaCabecera">
          <h2><PiggyBank size={15} className="hIcono" /> Tus datos</h2>
          <span className="etiquetaValor mono">{datos.gastos.length} · {fijos.length} fijos</span>
        </div>
        <div className="filaBotones">
          <button className="botonSecundario" onClick={() => exportar(datos)}>
            <Download size={16} /> Guardar copia
          </button>
          <button className="botonSecundario" onClick={() => refArchivo.current?.click()}>
            <Upload size={16} /> Restaurar
          </button>
        </div>
        <input ref={refArchivo} type="file" accept="application/json,.json" onChange={alElegirArchivo} style={{ display: "none" }} />
        {avisoCopia && <p className={`pie ${avisoCopia.ok ? "txtVerde" : "txtRojo"}`}>{avisoCopia.texto}</p>}

        <button className="botonSecundario espaciado" onClick={copiarPortapapeles}>
          {copiado ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar al portapapeles</>}
        </button>
        <p className="pie">El archivo lleva todo: gastos, fijos, categorías y presupuestos.</p>

        {!confirmarReset ? (
          <button className="botonPeligro" onClick={() => setConfirmarReset(true)}><Trash2 size={16} /> Borrar todo</button>
        ) : (
          <div className="confirmar">
            <p>
              Esto borra de tu cuenta tus {datos.gastos.length} gastos y {fijos.length} fijos, en
              todos tus dispositivos y para siempre. Las categorías vuelven a las de partida.
            </p>
            <div className="confirmarBotones">
              <button className="botonSecundario" onClick={() => setConfirmarReset(false)}>Cancelar</button>
              <button className="botonPeligro" onClick={() => { onVaciar(); setConfirmarReset(false); }}>
                Sí, borrar todo
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

/* ─────────────────────────────  HOJA: GASTO PUNTUAL  ───────────────────────────── */

/**
 * La misma hoja sirve para lo que sale y para lo que entra.
 *
 * Cambian tres cosas: el color, si se elige categoría o procedencia, y el
 * verbo. Todo lo demás —importe, concepto, fecha— es idéntico, y tener dos
 * hojas casi iguales solo garantizaba que una se quedaría atrás.
 */
function HojaGasto({ modo, gasto, tipo = "gasto", categorias, onGuardar, onBorrar, onCerrar }) {
  const esIngreso = tipo === "ingreso";
  const [importe, setImporte] = useState(gasto && gasto.importe != null ? String(gasto.importe) : "");
  const [categoria, setCategoria] = useState(gasto ? gasto.categoria : categorias[0]?.id || "");
  const [origen, setOrigen] = useState((gasto && gasto.origen) || "nomina");
  const [fecha, setFecha] = useState(gasto && gasto.fecha ? gasto.fecha : hoyISO());
  const [nota, setNota] = useState(gasto?.nota || "");
  const refImporte = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => refImporte.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const valido = Number(importe) > 0 && (esIngreso || categoria);

  const enviar = () => {
    if (!valido) return;
    const base = {
      id: gasto?.id,
      importe: Math.round(Number(importe) * 100) / 100,
      fecha,
      nota: nota.trim(),
    };
    onGuardar(esIngreso ? { ...base, origen } : { ...base, categoria });
  };

  return (
    <div className="velo" onClick={onCerrar}>
      <div className="hoja" onClick={(e) => e.stopPropagation()}>
        <div className="tirador" />
        <div className="hojaCabecera">
          <h2>{esIngreso
            ? (modo === "editar" ? "Editar ingreso" : "Nuevo ingreso")
            : (modo === "editar" ? "Editar gasto" : "Nuevo gasto")}</h2>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={19} /></button>
        </div>

        <div className="importeZona">
          <input ref={refImporte} className="importeInput mono" type="number" inputMode="decimal"
            step="0.01" placeholder="0" value={importe}
            onChange={(e) => setImporte(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviar()} />
          <span className="importeMoneda">€</span>
        </div>

        <div className="bloque">
          <span className="etiquetaCampo">{esIngreso ? "De dónde viene" : "Categoría"}</span>
          <div className="chips">
            {esIngreso && ORIGENES.map((o) => (
              <button key={o.id} className={`chipCat ${origen === o.id ? "sel" : ""}`}
                style={origen === o.id ? { background: "var(--mint)", borderColor: "var(--mint)", color: "var(--sobreAcento)" } : undefined}
                onClick={() => setOrigen(o.id)}>
                <Icono nombre={o.icono} size={15} /> {o.label}
              </button>
            ))}
            {!esIngreso && categorias.map((c) => (
              <button key={c.id} className={`chipCat ${categoria === c.id ? "sel" : ""}`}
                style={categoria === c.id
                  ? { background: c.color, borderColor: c.color }
                  : { borderColor: `${c.color}55`, color: c.color }}
                onClick={() => setCategoria(c.id)}>
                <Icono nombre={c.icono} size={15} /> {c.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="bloque dosColumnas">
          <label className="campo">
            <span>Fecha</span>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </label>
          <label className="campo">
            <span>Concepto</span>
            <input placeholder={esIngreso ? "Nómina de agosto" : "Mercadona"} value={nota} onChange={(e) => setNota(e.target.value)} maxLength={60} />
          </label>
        </div>

        <div className="hojaAcciones">
          {modo === "editar" && (
            <button className="botonPeligro" onClick={() => onBorrar(gasto.id)} aria-label="Borrar gasto"><Trash2 size={16} /></button>
          )}
          <button className="botonPrincipal ancho" disabled={!valido} onClick={enviar}>
            <Check size={17} /> {modo === "editar" ? "Guardar cambios" : "Añadir gasto"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────  HOJA: GASTO FIJO  ───────────────────────────── */

function HojaFijo({ modo, fijo, tipo = "gasto", mesVisto, categorias, onGuardar, onEliminar, onCerrar }) {
  /* El tipo se lee del propio apunte cuando se está editando: si no, abrir una
     nómina desde la lista la convertiría en gasto al guardar. */
  const esIngreso = (fijo ? fijo.tipo : tipo) === "ingreso";
  const [nombre, setNombre] = useState(fijo?.nombre || "");
  const [importe, setImporte] = useState(fijo ? String(fijo.importe) : "");
  const [categoria, setCategoria] = useState(fijo ? fijo.categoria : categorias[0]?.id || "");
  const [origen, setOrigen] = useState(fijo?.origen || "nomina");
  const [dia, setDia] = useState(fijo ? String(fijo.dia) : "1");
  const [desde, setDesde] = useState(fijo?.desde || mesVisto);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const refNombre = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => refNombre.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const dadoDeBaja = Boolean(fijo?.hasta);
  const valido = nombre.trim() && Number(importe) > 0 && categoria && desde;

  /* `categoria` va siempre, también en los ingresos: las reglas la exigen y
     tener el campo relleno cuesta menos que abrirles una excepción. Lo que
     distingue una nómina de un recibo es `tipo`, y eso es lo que mira
     `expandirFijos`. */
  const construir = (extra = {}) => ({
    id: fijo?.id,
    tipo: esIngreso ? "ingreso" : "gasto",
    nombre: nombre.trim(),
    importe: Math.round(Number(importe) * 100) / 100,
    categoria,
    origen: esIngreso ? origen : null,
    dia: Math.min(31, Math.max(1, parseInt(dia, 10) || 1)),
    desde,
    hasta: fijo?.hasta ?? null,
    ...extra,
  });

  return (
    <div className="velo" onClick={onCerrar}>
      <div className="hoja" onClick={(e) => e.stopPropagation()}>
        <div className="tirador" />
        <div className="hojaCabecera">
          <h2><Repeat size={16} className="hIcono" /> {esIngreso
            ? (modo === "editar" ? "Ingreso fijo" : "Nuevo ingreso fijo")
            : (modo === "editar" ? "Gasto fijo" : "Nuevo gasto fijo")}</h2>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={19} /></button>
        </div>

        <div className="bloque">
          <span className="etiquetaCampo">Concepto</span>
          <input ref={refNombre} className="campoAncho"
            placeholder={esIngreso ? "Nómina, alquiler que cobro…" : "Alquiler, Netflix, gimnasio…"}
            value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} />
        </div>

        <div className="importeZona compacta">
          <input className="importeInput mono" type="number" inputMode="decimal" step="0.01"
            placeholder="0" value={importe} onChange={(e) => setImporte(e.target.value)} />
          <span className="importeMoneda">€</span>
          <span className="porMes">al mes</span>
        </div>

        <div className="bloque">
          <span className="etiquetaCampo">{esIngreso ? "De dónde viene" : "Categoría"}</span>
          <div className="chips">
            {esIngreso && ORIGENES.map((o) => (
              <button key={o.id} className={`chipCat ${origen === o.id ? "sel" : ""}`}
                style={origen === o.id ? { background: "var(--mint)", borderColor: "var(--mint)", color: "var(--sobreAcento)" } : undefined}
                onClick={() => setOrigen(o.id)}>
                <Icono nombre={o.icono} size={15} /> {o.label}
              </button>
            ))}
            {!esIngreso && categorias.map((c) => (
              <button key={c.id} className={`chipCat ${categoria === c.id ? "sel" : ""}`}
                style={categoria === c.id
                  ? { background: c.color, borderColor: c.color }
                  : { borderColor: `${c.color}55`, color: c.color }}
                onClick={() => setCategoria(c.id)}>
                <Icono nombre={c.icono} size={15} /> {c.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="bloque dosColumnas">
          <label className="campo">
            <span>Día del mes</span>
            <input type="number" inputMode="numeric" min="1" max="31" value={dia}
              onChange={(e) => setDia(e.target.value)} />
          </label>
          <label className="campo">
            <span>Empieza en</span>
            <input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
        </div>

        {dadoDeBaja && (
          <div className="nota">Dado de baja: dejó de contar después de {nombreMesClave(fijo.hasta)}.</div>
        )}

        <div className="hojaAcciones">
          <button className="botonPrincipal ancho" disabled={!valido} onClick={() => onGuardar(construir())}>
            <Check size={17} /> {modo === "editar"
              ? "Guardar cambios"
              : esIngreso ? "Crear ingreso fijo" : "Crear gasto fijo"}
          </button>
        </div>

        {modo === "editar" && (
          <div className="accionesSecundarias">
            {dadoDeBaja ? (
              <button className="botonSecundario" onClick={() => onGuardar(construir({ hasta: null }))}>
                <Repeat size={16} /> Volver a activarlo
              </button>
            ) : (
              <button className="botonSecundario" onClick={() => onGuardar(construir({ hasta: mesVisto }))}>
                Dar de baja después de {nombreMesClave(mesVisto)}
              </button>
            )}

            {!confirmarBorrado ? (
              <button className="botonPeligro" onClick={() => setConfirmarBorrado(true)}>
                <Trash2 size={16} /> Eliminar de todo el historial
              </button>
            ) : (
              <div className="confirmar">
                <p>Esto lo borra también de los meses pasados, como si nunca hubiera existido. Si solo quieres dejar de pagarlo, usa «Dar de baja».</p>
                <div className="confirmarBotones">
                  <button className="botonSecundario" onClick={() => setConfirmarBorrado(false)}>Cancelar</button>
                  <button className="botonPeligro" onClick={() => onEliminar(fijo.id)}>Sí, eliminar</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
