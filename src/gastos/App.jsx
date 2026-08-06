import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, ReferenceLine,
} from "recharts";
import {
  UtensilsCrossed, Pizza, Coffee, Beer, ShoppingCart, PartyPopper, Music, Film,
  Gamepad2, Bus, Car, TrainFront, Bike, Plane, Fuel, Home, Zap, Droplet, Wifi,
  Smartphone, HeartPulse, Pill, Stethoscope, Shirt, Scissors, Dumbbell, BookOpen,
  GraduationCap, Gift, Dog, Baby, Wrench, CreditCard, PiggyBank, Package, Sparkles,
  ChevronLeft, ChevronRight, X, Plus, Trash2, Copy, Check, Wallet, Settings,
  PieChart as IcAnalisis, Repeat, ArrowUpRight, ArrowDownRight, Target, CalendarDays,
  Download, Upload, TrendingUp, Lightbulb, AlertTriangle, ThumbsUp,
} from "lucide-react";

import { useAlmacen } from "../comun/almacen.js";
import { ponerEnColeccion, quitarDeColeccion, tocarCampo } from "../comun/fusion.js";
import { PantallaCuenta, PastillaSync } from "../comun/cuenta.jsx";
import { analizarMes } from "./analisis.js";
import { CSS } from "./estilos.js";
import {
  APP, CATEGORIAS_INICIALES, CLAVE, ESQUEMA, MESES, PALETA, VACIO,
  adivinarIcono, claveMes, desdeClaveMes, diaDeISO, diasDelMes, eur, exportar,
  hoyISO, importar, mesActualClave, migrar, movimientosDeMes, nombreMesClave,
  restarMeses, suma, uid,
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
};
const CLAVES_ICONO = Object.keys(ICONOS);

function Icono({ nombre, size = 18, className, style }) {
  const C = ICONOS[nombre] || Package;
  return <C size={size} strokeWidth={2} className={className} style={style} />;
}

const ICONO_BLOQUE = {
  wallet: Wallet, target: Target, pie: IcAnalisis, calendar: CalendarDays, repeat: Repeat,
};

const PALETA_CUENTA = {
  bg: "#F1F6FA", card: "#FFFFFF", suave: "#F7FAFC", ink: "#15293C", mid: "#5C7B8C",
  faint: "#9DB0C2", line: "#E6EDF3", acento: "#0F9E8E", acentoSuave: "#DFF3F0",
  coral: "#F4614E", mint: "#1FB47A",
  sombra: "0 1px 2px rgba(21,41,60,.04), 0 6px 20px rgba(21,41,60,.055)",
  display: "'Bricolage Grotesque', system-ui, sans-serif",
  body: "'Instrument Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
};

/* ─────────────────────────────  APP  ───────────────────────────── */

export default function AppGastos() {
  const { datos, actualizar, listo, sesion, estado, falloGuardado } = useAlmacen({
    clave: CLAVE, app: APP, vacio: VACIO, esquema: ESQUEMA, migrar,
  });

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

  const mesAnteriorKey = useMemo(() => {
    const p = restarMeses(cursor.y, cursor.m, 1);
    return claveMes(p.y, p.m);
  }, [cursor]);
  const totalMesAnterior = useMemo(() => suma(movimientosDeMes(datos, mesAnteriorKey)), [datos, mesAnteriorKey]);

  const porCategoria = useMemo(() => {
    const m = {};
    for (const g of movimientos) m[g.categoria] = (m[g.categoria] || 0) + g.importe;
    return Object.entries(m)
      .map(([id, total]) => ({
        id, total,
        nombre: catPorId[id]?.nombre || "Sin categoría",
        color: catPorId[id]?.color || "#7C93A8",
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
          color: catPorId[id]?.color || "#7C93A8",
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
  const presupuesto = datos.ajustes?.presupuestoGlobal || null;

  /* ── acciones ────────────────────────────────────────────────────────── */

  const guardarGasto = (g) => { actualizar((d) => ponerEnColeccion(d, "gastos", g)); setHoja(null); };
  const borrarGasto = (id) => { actualizar((d) => quitarDeColeccion(d, "gastos", id)); setHoja(null); };
  const guardarFijo = (f) => { actualizar((d) => ponerEnColeccion(d, "fijos", f)); setHojaFijo(null); };
  const eliminarFijo = (id) => { actualizar((d) => quitarDeColeccion(d, "fijos", id)); setHojaFijo(null); };

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

  if (!listo) {
    return (
      <div className="gx">
        <style>{CSS}</style>
        <div className="cargando"><div className="spinner" /><p>Abriendo tus cuentas…</p></div>
      </div>
    );
  }

  return (
    <div className="gx">
      <style>{CSS}</style>

      <header className="cabecera">
        <button className="flecha" onClick={() => moverMes(-1)} aria-label="Mes anterior">
          <ChevronLeft size={20} />
        </button>
        <div className="mesTitulo">
          <span className="mesNombre">{MESES[cursor.m]}</span>
          <span className="mesAno">{cursor.y}</span>
        </div>
        <div className="cabeceraDerecha">
          <PastillaSync estado={estado} paleta={PALETA_CUENTA} onAbrir={() => setPantalla("cuenta")} />
          <button className="flecha" onClick={() => moverMes(1)} aria-label="Mes siguiente" disabled={esMesEnCurso}>
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {falloGuardado && (
        <div className="aviso">No se han podido guardar los últimos cambios en este dispositivo. Haz una copia desde Ajustes.</div>
      )}

      <main className="lienzo">
        {vista === "resumen" && (
          <Resumen
            total={totalMes} totalFijos={totalFijos} totalVariable={totalVariable}
            totalAnterior={totalMesAnterior} porDiaVariable={porDiaVariable}
            nDias={nDias} diasTranscurridos={diasTranscurridos} esMesEnCurso={esMesEnCurso}
            proyeccion={proyeccion} presupuesto={presupuesto}
            movimientos={movimientos} nFijos={fijosMes.length} catPorId={catPorId}
            onAbrir={abrirMovimiento}
            onNuevo={() => setHoja({ modo: "nuevo" })}
            onNuevoFijo={() => setHojaFijo({ modo: "nuevo", mesVisto: mesKey })}
            onRevisar={() => setPantalla("revision")}
          />
        )}

        {vista === "analisis" && (
          <Analisis
            porCategoria={porCategoria} total={totalMes} ultimosMeses={ultimosMeses}
            ranking={ranking} presupuestoGlobal={presupuesto}
            onRevisar={() => setPantalla("revision")}
          />
        )}

        {vista === "ajustes" && (
          <Ajustes
            datos={datos} actualizar={actualizar} catPorId={catPorId} mesKey={mesKey}
            onEditarFijo={(f) => setHojaFijo({ modo: "editar", fijo: f, mesVisto: mesKey })}
            onNuevoFijo={() => setHojaFijo({ modo: "nuevo", mesVisto: mesKey })}
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
          modo={hoja.modo} gasto={hoja.gasto} categorias={datos.categorias}
          onGuardar={guardarGasto} onBorrar={borrarGasto} onCerrar={() => setHoja(null)}
        />
      )}

      {hojaFijo && (
        <HojaFijo
          modo={hojaFijo.modo} fijo={hojaFijo.fijo} mesVisto={hojaFijo.mesVisto}
          categorias={datos.categorias} onGuardar={guardarFijo} onEliminar={eliminarFijo}
          onCerrar={() => setHojaFijo(null)}
        />
      )}

      {pantalla === "revision" && (
        <Revision
          datos={datos} catPorId={catPorId} mesKey={mesKey}
          onMover={moverMes} esMesEnCurso={esMesEnCurso} onCerrar={() => setPantalla(null)}
        />
      )}

      {pantalla === "cuenta" && (
        <PantallaCuenta
          paleta={PALETA_CUENTA} sesion={sesion} estado={estado}
          onCerrar={() => setPantalla(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────  RESUMEN  ───────────────────────────── */

function Resumen({
  total, totalFijos, totalVariable, totalAnterior, porDiaVariable,
  nDias, diasTranscurridos, esMesEnCurso, proyeccion, presupuesto,
  movimientos, nFijos, catPorId, onAbrir, onNuevo, onNuevoFijo, onRevisar,
}) {
  const diff = total - totalAnterior;
  const pct = totalAnterior > 0 ? (diff / totalAnterior) * 100 : null;
  const maxDia = Math.max(...porDiaVariable, 1);
  const margenVariable = presupuesto ? presupuesto - totalFijos : null;
  const ritmoDiario = margenVariable && margenVariable > 0 ? margenVariable / nDias : null;
  const usado = presupuesto ? total / presupuesto : null;

  return (
    <>
      <section className="hero anchoCompleto">
        <span className="etiqueta">Gastado este mes</span>
        <div className="cifraGrande">{eur(total)}</div>

        <div className="filaResumen">
          {totalAnterior > 0 && (
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

        <div className="pulso">
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

      <BotonRevision onRevisar={onRevisar} />

      {presupuesto ? (
        <section className="tarjeta">
          <div className="filaCabecera">
            <h2>Presupuesto del mes</h2>
            <span className="etiquetaValor mono">{eur(presupuesto)}</span>
          </div>
          <div className="barraPres">
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
          </div>
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
      ) : (
        esMesEnCurso && total > 0 && (
          <section className="tarjeta">
            <div className="filaCabecera"><h2>Proyección</h2></div>
            <p className="pie">
              A este ritmo cerrarás el mes en <strong>{eur(proyeccion)}</strong>. Pon un presupuesto
              en Ajustes para saber si vas bien.
            </p>
          </section>
        )
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
              <button className="botonSecundario" onClick={onNuevoFijo}><Repeat size={16} /> Crear un gasto fijo</button>
            </div>
          </div>
        ) : (
          <ul className="lista">
            {movimientos.map((g) => {
              const c = catPorId[g.categoria];
              const color = c?.color || "#7C93A8";
              return (
                <li key={g.id}>
                  <button className="itemGasto" onClick={() => onAbrir(g)}>
                    <span className="insignia" style={{ background: `${color}1F`, color }}>
                      <Icono nombre={c?.icono} size={17} />
                    </span>
                    <span className="itemTexto">
                      <span className="itemCat">
                        {g.esFijo ? g.nota : c?.nombre || "Sin categoría"}
                        {g.esFijo && <span className="marcaFijo"><Repeat size={9} strokeWidth={2.6} />fijo</span>}
                      </span>
                      <span className="itemNota">{g.esFijo ? c?.nombre || "Sin categoría" : g.nota || ""}</span>
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

/* ─────────────────────────────  ANÁLISIS  ───────────────────────────── */

function Analisis({ porCategoria, total, ultimosMeses, ranking, presupuestoGlobal, onRevisar }) {
  if (total === 0 && ultimosMeses.every((m) => m.total === 0)) {
    return (
      <section className="tarjeta">
        <div className="vacio">
          <div className="vacioIcono"><IcAnalisis size={26} strokeWidth={1.7} /></div>
          <p>Aún no hay suficientes datos que analizar. Apunta unos cuantos gastos y vuelve.</p>
        </div>
      </section>
    );
  }

  const conPresupuesto = porCategoria.filter((c) => c.presupuesto > 0);

  return (
    <>
      <BotonRevision onRevisar={onRevisar} />

      <section className="tarjeta">
        <div className="filaCabecera"><h2>Dónde se va el dinero</h2></div>
        {porCategoria.length === 0 ? (
          <p className="pie">Sin gastos en este mes.</p>
        ) : (
          <>
            <div className="donutZona">
              <ResponsiveContainer width="100%" height={206}>
                <PieChart>
                  <Pie data={porCategoria} dataKey="total" nameKey="nombre"
                    innerRadius={62} outerRadius={92} paddingAngle={3} stroke="none" cornerRadius={5}>
                    {porCategoria.map((c) => <Cell key={c.id} fill={c.color} />)}
                  </Pie>
                  <Tooltip content={<TipCat total={total} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donutCentro">
                <span className="donutTotal mono">{eur(total, false)}</span>
                <span className="donutPie">este mes</span>
              </div>
            </div>

            <ul className="leyenda">
              {porCategoria.map((c) => (
                <li key={c.id}>
                  <span className="insignia mini" style={{ background: `${c.color}1F`, color: c.color }}>
                    <Icono nombre={c.icono} size={14} />
                  </span>
                  <span className="leyNombre">{c.nombre}</span>
                  <span className="leyBarra"><i style={{ width: `${(c.total / total) * 100}%`, background: c.color }} /></span>
                  <span className="leyImporte mono">{eur(c.total)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="tarjeta">
        <div className="filaCabecera"><h2>Últimos seis meses</h2></div>
        <div style={{ height: 190, marginLeft: -8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ultimosMeses} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <XAxis dataKey="etiqueta" tickLine={false} axisLine={false}
                tick={{ fill: "#7C93A8", fontSize: 11, fontFamily: "IBM Plex Mono, monospace" }} />
              <Tooltip content={<TipMes />} cursor={{ fill: "rgba(15,158,142,.07)" }} />
              {presupuestoGlobal > 0 && (
                <ReferenceLine y={presupuestoGlobal} stroke="#F4614E" strokeDasharray="4 4" strokeWidth={1.5} />
              )}
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {ultimosMeses.map((m) => <Cell key={m.clave} fill={m.actual ? "#0F9E8E" : "#D6E2EC"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
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

function TipCat({ active, payload, total }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tip">
      <strong>{p.nombre}</strong>
      <span className="mono">{eur(p.total)} · {((p.total / total) * 100).toFixed(0)}%</span>
    </div>
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

/* ─────────────────────────────  AJUSTES  ───────────────────────────── */

function Ajustes({ datos, actualizar, catPorId, mesKey, onEditarFijo, onNuevoFijo, onCuenta, sesion }) {
  const [nuevaCat, setNuevaCat] = useState("");
  const [colorCat, setColorCat] = useState(PALETA[0]);
  const [iconoCat, setIconoCat] = useState("package");
  const [copiado, setCopiado] = useState(false);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const [editandoIcono, setEditandoIcono] = useState(null);
  const [avisoCopia, setAvisoCopia] = useState(null);
  const refArchivo = useRef(null);

  const fijos = datos.fijos || [];
  const activos = fijos.filter((f) => !f.hasta || mesKey <= f.hasta);
  const dadosDeBaja = fijos.filter((f) => f.hasta && mesKey > f.hasta);
  const totalFijosActivos = activos.filter((f) => f.desde <= mesKey).reduce((s, f) => s + f.importe, 0);
  const presupuesto = datos.ajustes?.presupuestoGlobal ?? null;

  const anadirCategoria = () => {
    const nombre = nuevaCat.trim();
    if (!nombre) return;
    actualizar((d) => ponerEnColeccion(d, "categorias", { id: uid(), nombre, color: colorCat, icono: iconoCat, presupuesto: null }));
    setNuevaCat("");
    setIconoCat("package");
    setColorCat(PALETA[(PALETA.indexOf(colorCat) + 1) % PALETA.length]);
  };

  const borrarCategoria = (id) => {
    const usados = datos.gastos.filter((g) => g.categoria === id).length + fijos.filter((f) => f.categoria === id).length;
    if (usados > 0 && !window.confirm(`${usados} apunte(s) usan esta categoría. Se moverán a otra. ¿Sigo?`)) return;
    actualizar((d) => {
      const destino = d.categorias.find((c) => c.id === "otros")?.id || d.categorias.find((c) => c.id !== id)?.id;
      if (!destino) return d;
      let salida = quitarDeColeccion(d, "categorias", id);
      for (const g of d.gastos.filter((x) => x.categoria === id)) {
        salida = ponerEnColeccion(salida, "gastos", { ...g, categoria: destino });
      }
      for (const f of (d.fijos || []).filter((x) => x.categoria === id)) {
        salida = ponerEnColeccion(salida, "fijos", { ...f, categoria: destino });
      }
      return salida;
    });
  };

  const cambiarCat = (id, campos) =>
    actualizar((d) => {
      const c = (d.categorias || []).find((x) => x.id === id);
      return c ? ponerEnColeccion(d, "categorias", { ...c, ...campos }) : d;
    });

  const ponPresupuesto = (valor) =>
    actualizar((d) => tocarCampo(d, "ajustes", { ...(d.ajustes || {}), presupuestoGlobal: valor }));

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
      const d = await importar(f);
      actualizar(d);
      setAvisoCopia({ ok: true, texto: "Copia restaurada" });
    } catch (err) {
      setAvisoCopia({ ok: false, texto: "Ese archivo no parece una copia válida" });
    }
    e.target.value = "";
    setTimeout(() => setAvisoCopia(null), 3500);
  };

  return (
    <>
      <section className="tarjeta">
        <div className="filaCabecera">
          <h2><Repeat size={15} className="hIcono" /> Gastos fijos</h2>
          {totalFijosActivos > 0 && <span className="etiquetaValor mono">{eur(totalFijosActivos, false)}/mes</span>}
        </div>

        {fijos.length === 0 ? (
          <div className="vacio">
            <div className="vacioIcono"><Repeat size={26} strokeWidth={1.7} /></div>
            <p>Apunta aquí el alquiler, las suscripciones o cualquier cosa que se repita. Aparecerán solos cada mes.</p>
            <button className="botonPrincipal" onClick={onNuevoFijo}><Plus size={17} /> Crear gasto fijo</button>
          </div>
        ) : (
          <>
            <ul className="listaFijos">
              {activos.map((f) => {
                const c = catPorId[f.categoria];
                const color = c?.color || "#7C93A8";
                const pendiente = f.desde > mesKey;
                return (
                  <li key={f.id}>
                    <button className="itemGasto" onClick={() => onEditarFijo(f)}>
                      <span className="insignia" style={{ background: `${color}1F`, color }}>
                        <Icono nombre={c?.icono} size={17} />
                      </span>
                      <span className="itemTexto">
                        <span className="itemCat">{f.nombre}</span>
                        <span className="itemNota">
                          día {f.dia} · {c?.nombre || "Sin categoría"}
                          {pendiente && ` · desde ${nombreMesClave(f.desde)}`}
                          {f.hasta && ` · hasta ${nombreMesClave(f.hasta)}`}
                        </span>
                      </span>
                      <span className="itemImporte mono">{eur(f.importe)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {dadosDeBaja.length > 0 && (
              <>
                <p className="pie separador">Ya no activos</p>
                <ul className="listaFijos apagada">
                  {dadosDeBaja.map((f) => (
                    <li key={f.id}>
                      <button className="itemGasto" onClick={() => onEditarFijo(f)}>
                        <span className="insignia" style={{ background: "#EDF2F7", color: "#9DB0C2" }}>
                          <Icono nombre={catPorId[f.categoria]?.icono} size={17} />
                        </span>
                        <span className="itemTexto">
                          <span className="itemCat">{f.nombre}</span>
                          <span className="itemNota">hasta {nombreMesClave(f.hasta)}</span>
                        </span>
                        <span className="itemImporte mono">{eur(f.importe)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <button className="botonSecundario espaciado" onClick={onNuevoFijo}>
              <Plus size={16} /> Añadir otro gasto fijo
            </button>
            <p className="pie">Al darlos de baja siguen contando en los meses anteriores, así que tu historial no cambia.</p>
          </>
        )}
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
                        style={c.icono === k ? { background: c.color, color: "#fff" } : undefined}
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
          {sesion
            ? `Conectado como ${sesion.email}. Lo que apuntes aquí aparece también en tus otros dispositivos.`
            : "Entra con una cuenta para tener los mismos gastos en el móvil y en el ordenador."}
        </p>
        <button className="botonSecundario" onClick={onCuenta}>
          {sesion ? "Ver cuenta" : "Configurar sincronización"}
        </button>
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
            <p>Esto borra tus {datos.gastos.length} gastos y {fijos.length} fijos, y vuelve a las categorías iniciales{sesion ? ", también en tus otros dispositivos" : ""}.</p>
            <div className="confirmarBotones">
              <button className="botonSecundario" onClick={() => setConfirmarReset(false)}>Cancelar</button>
              <button className="botonPeligro" onClick={() => {
                actualizar((d) => {
                  let salida = d;
                  for (const g of d.gastos) salida = quitarDeColeccion(salida, "gastos", g.id);
                  for (const f of d.fijos || []) salida = quitarDeColeccion(salida, "fijos", f.id);
                  for (const c of d.categorias || []) salida = quitarDeColeccion(salida, "categorias", c.id);
                  for (const c of CATEGORIAS_INICIALES) salida = ponerEnColeccion(salida, "categorias", { ...c, presupuesto: null });
                  return tocarCampo(salida, "ajustes", { presupuestoGlobal: null });
                });
                setConfirmarReset(false);
              }}>
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

function HojaGasto({ modo, gasto, categorias, onGuardar, onBorrar, onCerrar }) {
  const [importe, setImporte] = useState(gasto ? String(gasto.importe) : "");
  const [categoria, setCategoria] = useState(gasto ? gasto.categoria : categorias[0]?.id || "");
  const [fecha, setFecha] = useState(gasto ? gasto.fecha : hoyISO());
  const [nota, setNota] = useState(gasto?.nota || "");
  const refImporte = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => refImporte.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const valido = Number(importe) > 0 && categoria;

  const enviar = () => {
    if (!valido) return;
    onGuardar({
      id: gasto?.id,
      importe: Math.round(Number(importe) * 100) / 100,
      categoria, fecha, nota: nota.trim(),
    });
  };

  return (
    <div className="velo" onClick={onCerrar}>
      <div className="hoja" onClick={(e) => e.stopPropagation()}>
        <div className="tirador" />
        <div className="hojaCabecera">
          <h2>{modo === "editar" ? "Editar gasto" : "Nuevo gasto"}</h2>
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
          <span className="etiquetaCampo">Categoría</span>
          <div className="chips">
            {categorias.map((c) => (
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
            <span>Nota</span>
            <input placeholder="Opcional" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={60} />
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

function HojaFijo({ modo, fijo, mesVisto, categorias, onGuardar, onEliminar, onCerrar }) {
  const [nombre, setNombre] = useState(fijo?.nombre || "");
  const [importe, setImporte] = useState(fijo ? String(fijo.importe) : "");
  const [categoria, setCategoria] = useState(fijo ? fijo.categoria : categorias[0]?.id || "");
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

  const construir = (extra = {}) => ({
    id: fijo?.id,
    nombre: nombre.trim(),
    importe: Math.round(Number(importe) * 100) / 100,
    categoria,
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
          <h2><Repeat size={16} className="hIcono" /> {modo === "editar" ? "Gasto fijo" : "Nuevo gasto fijo"}</h2>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={19} /></button>
        </div>

        <div className="bloque">
          <span className="etiquetaCampo">Concepto</span>
          <input ref={refNombre} className="campoAncho" placeholder="Alquiler, Netflix, gimnasio…"
            value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} />
        </div>

        <div className="importeZona compacta">
          <input className="importeInput mono" type="number" inputMode="decimal" step="0.01"
            placeholder="0" value={importe} onChange={(e) => setImporte(e.target.value)} />
          <span className="importeMoneda">€</span>
          <span className="porMes">al mes</span>
        </div>

        <div className="bloque">
          <span className="etiquetaCampo">Categoría</span>
          <div className="chips">
            {categorias.map((c) => (
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
            <Check size={17} /> {modo === "editar" ? "Guardar cambios" : "Crear gasto fijo"}
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
