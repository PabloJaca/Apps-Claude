import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar } from "recharts";
import {
  Scale, Dumbbell, UtensilsCrossed, Plus, X, Trash2, Sparkles, Users, Activity,
  Bike, TrendingUp, TrendingDown, Minus, User, Check, ChevronRight, Flame,
  Coffee, Moon, Apple, Download, Upload, Info,
} from "lucide-react";

import { useDatos } from "../comun/datos.js";
import { Puerta } from "../comun/sesion.jsx";
import { PantallaCuenta, PastillaSync } from "../comun/cuenta.jsx";
import { calcularBalance, valorarDia } from "./estimador.js";
import { valorarPeriodo } from "./valoracion.js";
import {
  ACTIVIDADES, COLECCIONES, DIAS, DURACIONES, OBJETIVOS, PERFIL_VACIO, SACIEDADES,
  SEXOS, VOLUMENES, calcularEnergia, cerrado, desdeIso, detalleTramo,
  enRango, etiquetaFecha, etiquetaTramo, exportar, fechaCorta, hoy, importar,
  inicioSemana, leerLegado, miles, num, olvidarLegado, rangoMes, rangoSemana,
  revisarPeso, saciedadDe, volumenDe,
} from "./nucleo.js";

/* ---------------------------------------------------------------- tokens */

const C = {
  bg: "#EDF3F8", soft: "#F6FAFC", card: "#FFFFFF", ink: "#15303D", mid: "#5C7B8C",
  faint: "#9BB2BF", line: "#E3EDF3", teal: "#10B3A3", tealSoft: "#DCF5F1",
  mint: "#3FD69A", mintSoft: "#E0F9ED", coral: "#FF7A6B", coralSoft: "#FFE8E4",
  amber: "#FFB13B", amberSoft: "#FFF2DE", indigo: "#7B8DF9", indigoSoft: "#E8EBFE",
};

const sh = "0 1px 2px rgba(21,48,61,.04), 0 10px 26px rgba(21,48,61,.06)";
const display = "'Bricolage Grotesque', system-ui, sans-serif";
const body = "'Instrument Sans', system-ui, sans-serif";
const mono = "'IBM Plex Mono', ui-monospace, monospace";

const PALETA_CUENTA = {
  bg: C.bg, card: C.card, suave: C.soft, ink: C.ink, mid: C.mid, faint: C.faint,
  line: C.line, acento: C.teal, acentoSuave: C.tealSoft, coral: C.coral, mint: C.mint,
  sombra: sh, display, body, mono,
};

const CSS = `
* { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
input, textarea, button { font-family: inherit; }
button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${C.teal}; outline-offset: 2px; }
@keyframes rise { from { transform: translateY(16px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes spin { to { transform: rotate(360deg) } }
@keyframes pop { 0% { transform: scale(.9); opacity: 0 } 100% { transform: none; opacity: 1 } }
.rise { animation: rise .26s cubic-bezier(.2,.8,.3,1) both }
.fade { animation: fade .2s ease both }
.pop { animation: pop .22s cubic-bezier(.2,.8,.3,1) both }
.spin { animation: spin 1s linear infinite }
@media (prefers-reduced-motion: reduce) { .rise,.fade,.spin,.pop { animation: none } }

.contenedor { max-width: 520px; margin: 0 auto; }
.rejilla { display: grid; gap: 14px; }

/* utilidades mínimas (sustituyen a Tailwind, que aquí no hace falta) */
.flex { display: flex } .grid { display: grid }
.flex-col { flex-direction: column }
.items-center { align-items: center } .items-end { align-items: flex-end }
.items-baseline { align-items: baseline }
.justify-center { justify-content: center } .justify-between { justify-content: space-between }
.justify-around { justify-content: space-around }
.gap-1 { gap: 4px } .gap-1\\.5 { gap: 6px } .gap-2 { gap: 8px } .gap-3 { gap: 12px } .gap-5 { gap: 20px }
.mb-3 { margin-bottom: 12px }
@media (max-width: 400px) { .etiquetaSync { display: none } }

/* En el ordenador se aprovecha el ancho en vez de dejar una columna flaca. */
@media (min-width: 960px) {
  .contenedor { max-width: 940px; }
  .rejilla { grid-template-columns: 1fr 1fr; align-items: start; }
  .rejilla > .ancho { grid-column: 1 / -1; }
  .barraInferior { border-radius: 22px; left: 50% !important; right: auto !important;
    transform: translateX(-50%); bottom: 18px !important; width: auto; padding: 8px 12px !important;
    box-shadow: 0 12px 34px rgba(21,48,61,.16); border: 1px solid ${C.line}; }
  .barraInferior button { padding: 0 14px !important; }
  .botonFlotante { right: calc(50% - 470px) !important; }
}
`;

/* ------------------------------------------------------------ constantes */

const TIPOS = [
  { id: "fuerza", label: "Fuerza", Icon: Dumbbell, color: C.teal, soft: C.tealSoft },
  { id: "cardio", label: "Cardio", Icon: Bike, color: C.coral, soft: C.coralSoft },
  { id: "equipo", label: "Equipo", Icon: Users, color: C.indigo, soft: C.indigoSoft },
  { id: "otro", label: "Otro", Icon: Activity, color: C.amber, soft: C.amberSoft },
];
const tipoDe = (id) => TIPOS.find((t) => t.id === id) || TIPOS[3];

const INTENS = [
  { id: "baja", label: "Suave", color: C.mint },
  { id: "media", label: "Media", color: C.amber },
  { id: "alta", label: "Fuerte", color: C.coral },
];

const MOMENTOS = [
  { id: "desayuno", label: "Desayuno", Icon: Coffee, color: C.amber, soft: C.amberSoft },
  { id: "comida", label: "Comida", Icon: UtensilsCrossed, color: C.teal, soft: C.tealSoft },
  { id: "snack", label: "Snack", Icon: Apple, color: C.mint, soft: C.mintSoft },
  { id: "cena", label: "Cena", Icon: Moon, color: C.indigo, soft: C.indigoSoft },
];
const momentoDe = (id) => MOMENTOS.find((m) => m.id === id) || MOMENTOS[1];
const momentoPorHora = () => {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  if (h < 11) return "desayuno";
  if (h < 16.5) return "comida";
  if (h < 20) return "snack";
  return "cena";
};

/* ------------------------------------------------------------------ base */

function Card({ children, style, className = "", onClick }) {
  return (
    <div onClick={onClick} className={className}
      style={{ background: C.card, borderRadius: 26, boxShadow: sh, padding: 18, ...style }}>
      {children}
    </div>
  );
}

function Badge({ Icon, color, soft, size = 38 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.36, background: soft,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <Icon size={size * 0.5} color={color} strokeWidth={2.3} />
    </div>
  );
}

function Chip({ activo, color = C.teal, children, onClick, style }) {
  return (
    <button onClick={onClick}
      style={{
        border: "none", cursor: "pointer", borderRadius: 999, padding: "9px 14px",
        fontFamily: body, fontWeight: 600, fontSize: 13.5,
        background: activo ? color : C.soft, color: activo ? "#fff" : C.mid,
        transition: "background .15s, color .15s", ...style,
      }}>
      {children}
    </button>
  );
}

function Rotulo({ children }) {
  return (
    <p style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: C.faint, fontWeight: 500, margin: 0 }}>
      {children}
    </p>
  );
}

function Vacio({ texto }) {
  return (
    <p style={{ fontFamily: body, fontSize: 14, color: C.faint, textAlign: "center", padding: "22px 10px", lineHeight: 1.5, margin: 0 }}>
      {texto}
    </p>
  );
}

const inputBase = {
  width: "100%", border: "none", background: C.soft, borderRadius: 16,
  padding: "13px 14px", fontSize: 16, color: C.ink, fontFamily: body,
};
const btnBorrar = { background: "none", border: "none", padding: 6, cursor: "pointer", borderRadius: 10, flexShrink: 0 };
const btnMini = {
  fontFamily: body, fontWeight: 600, fontSize: 12.5, color: C.teal, background: C.tealSoft,
  border: "none", borderRadius: 999, padding: "7px 13px", cursor: "pointer",
};
const botonSec = {
  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
  border: "none", borderRadius: 16, padding: "12px 10px", cursor: "pointer",
  background: C.soft, color: C.mid, fontFamily: body, fontWeight: 600, fontSize: 13.5,
};
const navFlecha = {
  width: 40, height: 40, borderRadius: 14, border: "none", background: C.card,
  boxShadow: sh, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
const stepper = {
  width: 46, height: 46, borderRadius: 16, border: "none", background: C.tealSoft,
  color: C.teal, fontSize: 24, fontWeight: 600, cursor: "pointer", flexShrink: 0, lineHeight: 1,
};

/**
 * Escala numérica con etiqueta debajo. Se usa para el volumen (1-5) y para la
 * saciedad (1-4): en el móvil ocupa una línea y se marca de un toque.
 */
function Escala({ titulo, opciones, valor, onChange, color = C.teal, opcional }) {
  const sel = opciones.find((o) => o.n === valor);
  return (
    <div>
      <Rotulo>{titulo}</Rotulo>
      <div className="flex gap-2" style={{ marginTop: 7 }}>
        {opciones.map((o) => {
          const activo = valor === o.n;
          return (
            <button
              key={o.n}
              onClick={() => onChange(activo && opcional ? null : o.n)}
              aria-label={`${titulo}: ${o.label}`}
              aria-pressed={activo}
              style={{
                flex: 1, border: "none", cursor: "pointer", borderRadius: 14, padding: "11px 0",
                background: activo ? color : C.soft, color: activo ? "#fff" : C.mid,
                fontFamily: mono, fontWeight: 600, fontSize: 15.5,
                transition: "background .15s, color .15s",
              }}
            >
              {o.n}
            </button>
          );
        })}
      </div>
      <p style={{ fontFamily: body, fontSize: 12, color: sel ? C.mid : C.faint, margin: "6px 0 0" }}>
        {sel ? `${sel.label} — ${sel.desc.toLowerCase()}` : "Sin marcar. Marcarlo afina bastante el cálculo."}
      </p>
    </div>
  );
}

function BotonGuardar({ onClick, disabled, children = "Guardar" }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: "100%", border: "none", borderRadius: 18, padding: "14px 0",
        background: disabled ? C.line : C.teal, color: disabled ? C.faint : "#fff",
        fontFamily: display, fontWeight: 700, fontSize: 16, cursor: disabled ? "default" : "pointer",
        boxShadow: disabled ? "none" : "0 6px 16px rgba(16,179,163,.32)",
      }}>
      {children}
    </button>
  );
}

const colorNota = (n) => (n >= 7 ? C.mint : n >= 5 ? C.amber : C.coral);

/* ------------------------------------------------------------ vista peso */

function VistaPeso({ datos, anadir, borrar }) {
  const pesos = useMemo(() => [...datos.pesos].sort((a, b) => a.fecha.localeCompare(b.fecha)), [datos.pesos]);
  const ultimo = pesos[pesos.length - 1];
  const previo = pesos[pesos.length - 2];
  const delta = ultimo && previo ? ultimo.kg - previo.kg : null;

  const [kg, setKg] = useState(() => (ultimo ? ultimo.kg : 70));
  const [nota, setNota] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState(null);
  const yaHoy = pesos.some((p) => p.fecha === hoy());

  useEffect(() => { if (ultimo) setKg(ultimo.kg); }, [ultimo && ultimo.kg]);

  const serie = pesos.slice(-30).map((p) => ({ x: fechaCorta(p.fecha), kg: p.kg }));
  const dominio = useMemo(() => {
    if (!serie.length) return [0, 1];
    const v = serie.map((s) => s.kg);
    return [Math.floor(Math.min(...v) - 1), Math.ceil(Math.max(...v) + 1)];
  }, [serie]);

  const altura = parseFloat(datos.perfil.altura);
  const imc = ultimo && altura > 0 ? ultimo.kg / Math.pow(altura / 100, 2) : null;

  const paso = (d) => setKg((k) => Math.round((Number(k) + d) * 10) / 10);

  const escribir = () => {
    anadir("pesos", { fecha: hoy(), kg: Number(kg), nota: nota.trim() });
    setNota(""); setAbierto(false); setAviso(null);
  };

  /* Antes de guardar se comprueba contra el pesaje anterior. No bloquea nada:
     avisa, porque a veces el salto es real y a veces es un dedo torcido. */
  const guardarPeso = () => {
    const revision = revisarPeso(kg, hoy(), datos.pesos);
    if (revision.ok) escribir();
    else setAviso(revision);
  };

  const Fl = delta === null || Math.abs(delta) < 0.05 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const cDelta = delta === null || Math.abs(delta) < 0.05 ? C.faint : delta > 0 ? C.amber : C.mint;

  return (
    <div className="rejilla">
      <Card className="ancho" style={{ background: `linear-gradient(155deg, ${C.tealSoft} 0%, ${C.card} 60%)`, padding: 20 }}>
        <div className="flex items-center justify-between">
          <Rotulo>Último peso</Rotulo>
          {imc && (
            <span style={{ fontFamily: mono, fontSize: 11.5, color: C.mid, background: C.card, borderRadius: 999, padding: "3px 9px" }}>
              IMC {num(imc)}
            </span>
          )}
        </div>
        <div className="flex items-end gap-2" style={{ marginTop: 4 }}>
          <span style={{ fontFamily: display, fontWeight: 800, fontSize: 52, lineHeight: 1, color: C.ink, letterSpacing: -1.5 }}>
            {ultimo ? num(ultimo.kg) : "—"}
          </span>
          <span style={{ fontFamily: body, fontSize: 16, color: C.mid, marginBottom: 7 }}>kg</span>
          {delta !== null && (
            <span className="flex items-center gap-1" style={{ marginLeft: "auto", marginBottom: 9 }}>
              <Fl size={16} color={cDelta} strokeWidth={2.6} />
              <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, color: cDelta }}>
                {delta > 0 ? "+" : ""}{num(delta)}
              </span>
            </span>
          )}
        </div>
        {ultimo && (
          <p style={{ fontFamily: body, fontSize: 13, color: C.mid, marginTop: 6 }}>
            {etiquetaFecha(ultimo.fecha)}{ultimo.nota ? ` · ${ultimo.nota}` : ""}
          </p>
        )}

        {serie.length > 1 && (
          <div style={{ height: 160, marginTop: 12, marginLeft: -10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.faint, fontFamily: mono }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={dominio} tick={{ fontSize: 10, fill: C.faint, fontFamily: mono }} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ borderRadius: 14, border: "none", boxShadow: sh, fontFamily: mono, fontSize: 12 }} formatter={(v) => [`${num(v)} kg`, ""]} />
                <Line type="monotone" dataKey="kg" stroke={C.teal} strokeWidth={3} dot={{ r: 3, fill: C.teal, strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: 16, color: C.ink }}>
            {yaHoy ? "Corregir el peso de hoy" : "Peso de hoy"}
          </span>
          {yaHoy && <Check size={17} color={C.mint} strokeWidth={3} />}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => paso(-0.1)} style={stepper} aria-label="Bajar 100 gramos">−</button>
          <input type="number" inputMode="decimal" step="0.1" value={kg}
            onChange={(e) => setKg(e.target.value)}
            style={{ ...inputBase, textAlign: "center", fontFamily: mono, fontSize: 26, fontWeight: 600, padding: "10px 4px" }} />
          <button onClick={() => paso(0.1)} style={stepper} aria-label="Subir 100 gramos">+</button>
        </div>
        {abierto ? (
          <input value={nota} onChange={(e) => setNota(e.target.value)} autoFocus
            placeholder="En ayunas, después de comer…"
            style={{ ...inputBase, marginTop: 10, fontSize: 14 }} />
        ) : (
          <button onClick={() => setAbierto(true)} style={{ ...btnMini, marginTop: 10 }}>+ Añadir nota</button>
        )}
        {aviso && (
          <div className="fade" style={{ marginTop: 12, background: C.coralSoft, borderRadius: 18, padding: 14 }}>
            <p style={{ fontFamily: body, fontSize: 13.5, color: C.ink, lineHeight: 1.5, margin: 0 }}>
              {aviso.motivo}
            </p>
            {aviso.referencia && (
              <div className="flex gap-2" style={{ marginTop: 12 }}>
                <button onClick={() => setAviso(null)} style={{ ...botonSec, flex: 1, background: "#fff" }}>
                  Lo corrijo
                </button>
                <button onClick={escribir} style={{ ...botonSec, flex: 1, background: C.coral, color: "#fff" }}>
                  Guardar igual
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <BotonGuardar onClick={guardarPeso} disabled={!(Number(kg) > 0)} />
        </div>
      </Card>

      <div>
        <div style={{ padding: "2px 4px 8px" }}><Rotulo>Historial</Rotulo></div>
        <Card style={{ padding: 8 }}>
          {!pesos.length && <Vacio texto="Aún no has anotado ningún peso." />}
          {[...pesos].reverse().slice(0, 30).map((p) => (
            <div key={p.id} className="flex items-center gap-3" style={{ padding: 10 }}>
              <Badge Icon={Scale} color={C.teal} soft={C.tealSoft} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: C.ink, margin: 0 }}>{etiquetaFecha(p.fecha)}</p>
                {p.nota && <p style={{ fontFamily: body, fontSize: 12.5, color: C.faint, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nota}</p>}
              </div>
              <span style={{ fontFamily: mono, fontWeight: 600, fontSize: 15, color: C.ink }}>{num(p.kg)}</span>
              <button onClick={() => borrar("pesos", p.id)} style={btnBorrar} aria-label="Borrar"><Trash2 size={15} color={C.faint} /></button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- vista entrenos */

function VistaEntrenos({ datos, anadir, borrar }) {
  const entrenos = useMemo(
    () => [...datos.entrenos].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.ts || 0) - (a.ts || 0)),
    [datos.entrenos]
  );
  const semana = inicioSemana();
  const deSemana = entrenos.filter((e) => enRango(e.fecha, semana));
  const minutos = deSemana.reduce((s, e) => s + (e.minutos || 0), 0);

  const [tipo, setTipo] = useState(null);
  const [dur, setDur] = useState(45);
  const [inten, setInten] = useState("media");

  const barras = useMemo(() => {
    const base = DIAS.map((d) => ({ x: d, min: 0 }));
    for (const e of deSemana) base[(desdeIso(e.fecha).getDay() + 6) % 7].min += e.minutos || 0;
    return base;
  }, [deSemana]);

  const deHoy = useMemo(() => entrenos.filter((e) => e.fecha === hoy()).sort((a, b) => (a.ts || 0) - (b.ts || 0)), [entrenos]);

  const guardarEntreno = () => {
    anadir("entrenos", { fecha: hoy(), tipo, minutos: dur, intensidad: inten, ts: Date.now() });
    setTipo(null); setDur(45); setInten("media");
  };

  return (
    <div className="rejilla">
      <Card className="ancho" style={{ background: `linear-gradient(155deg, ${C.indigoSoft} 0%, ${C.card} 60%)`, padding: 20 }}>
        <Rotulo>Esta semana</Rotulo>
        <div className="flex items-end gap-5" style={{ marginTop: 4 }}>
          <div className="flex items-end gap-2">
            <span style={{ fontFamily: display, fontWeight: 800, fontSize: 52, lineHeight: 1, color: C.ink, letterSpacing: -1.5 }}>
              {deSemana.length}
            </span>
            <span style={{ fontFamily: body, fontSize: 15, color: C.mid, marginBottom: 7 }}>
              {deSemana.length === 1 ? "sesión" : "sesiones"}
            </span>
          </div>
          <div style={{ marginLeft: "auto", marginBottom: 8, textAlign: "right" }}>
            <span style={{ fontFamily: mono, fontSize: 17, fontWeight: 600, color: C.ink }}>{minutos}</span>
            <span style={{ fontFamily: body, fontSize: 13, color: C.mid }}> min</span>
          </div>
        </div>
        <div style={{ height: 120, marginTop: 10, marginLeft: -14 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barras} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="x" tick={{ fontSize: 10.5, fill: C.faint, fontFamily: body }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip cursor={{ fill: "rgba(21,48,61,.04)" }} contentStyle={{ borderRadius: 14, border: "none", boxShadow: sh, fontFamily: mono, fontSize: 12 }} formatter={(v) => [`${v} min`, ""]} />
              <Bar dataKey="min" fill={C.indigo} radius={[8, 8, 8, 8]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <p style={{ fontFamily: display, fontWeight: 700, fontSize: 16, color: C.ink, margin: `0 0 ${deHoy.length ? 10 : 12}px` }}>
          {deHoy.length ? "Añadir otro entreno de hoy" : "¿Has entrenado hoy?"}
        </p>

        {deHoy.length > 0 && (
          <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
            {deHoy.map((e) => {
              const t = tipoDe(e.tipo);
              return (
                <div key={e.id} className="flex items-center gap-2" style={{ background: C.soft, borderRadius: 14, padding: "8px 10px" }}>
                  <t.Icon size={15} color={t.color} strokeWidth={2.4} />
                  <span style={{ fontFamily: body, fontWeight: 600, fontSize: 13.5, color: C.ink, flex: 1 }}>{t.label}</span>
                  <span style={{ fontFamily: mono, fontSize: 12.5, color: C.mid }}>{e.minutos}′</span>
                  <button onClick={() => borrar("entrenos", e.id)} style={btnBorrar} aria-label="Borrar"><Trash2 size={13} color={C.faint} /></button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          {TIPOS.map((t) => (
            <button key={t.id} onClick={() => setTipo(tipo === t.id ? null : t.id)} className="flex items-center gap-2"
              style={{
                border: "none", cursor: "pointer", borderRadius: 999, padding: "10px 14px",
                fontFamily: body, fontWeight: 600, fontSize: 13.5,
                background: tipo === t.id ? t.color : t.soft, color: tipo === t.id ? "#fff" : t.color,
              }}>
              <t.Icon size={15} strokeWidth={2.4} />{t.label}
            </button>
          ))}
        </div>

        {tipo && (
          <div className="rise" style={{ marginTop: 16 }}>
            <Rotulo>Duración</Rotulo>
            <div className="flex gap-2" style={{ marginTop: 7, flexWrap: "wrap" }}>
              {DURACIONES.map((d) => <Chip key={d} activo={dur === d} onClick={() => setDur(d)}>{d}′</Chip>)}
            </div>
            <div style={{ marginTop: 14 }}><Rotulo>Intensidad</Rotulo></div>
            <div className="flex gap-2" style={{ marginTop: 7 }}>
              {INTENS.map((i) => (
                <Chip key={i.id} activo={inten === i.id} color={i.color} onClick={() => setInten(i.id)} style={{ flex: 1 }}>
                  {i.label}
                </Chip>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <BotonGuardar onClick={guardarEntreno}>Guardar entreno</BotonGuardar>
            </div>
          </div>
        )}
      </Card>

      <div>
        <div style={{ padding: "2px 4px 8px" }}><Rotulo>Sesiones</Rotulo></div>
        <Card style={{ padding: 8 }}>
          {!entrenos.length && <Vacio texto="Aún no has registrado ningún entreno." />}
          {entrenos.slice(0, 40).map((e) => {
            const t = tipoDe(e.tipo);
            const i = INTENS.find((x) => x.id === e.intensidad);
            return (
              <div key={e.id} className="flex items-center gap-3" style={{ padding: 10 }}>
                <Badge Icon={t.Icon} color={t.color} soft={t.soft} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: C.ink, margin: 0 }}>{t.label}</p>
                  <p style={{ fontFamily: body, fontSize: 12.5, color: C.faint, margin: 0 }}>{etiquetaFecha(e.fecha)} · {e.minutos} min</p>
                </div>
                {i && (
                  <span style={{ fontFamily: body, fontSize: 11, fontWeight: 600, color: i.color, background: `${i.color}1F`, borderRadius: 999, padding: "3px 9px" }}>
                    {i.label}
                  </span>
                )}
                <button onClick={() => borrar("entrenos", e.id)} style={btnBorrar} aria-label="Borrar"><Trash2 size={15} color={C.faint} /></button>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- vista comidas */

function VistaComidas({ datos, anadir, borrar, energia, evaluaciones, irAPerfil }) {
  const [texto, setTexto] = useState("");
  const [volumen, setVolumen] = useState(3);
  const [saciedad, setSaciedad] = useState(null);
  const [momento, setMomento] = useState(() => momentoPorHora());
  const [verDetalle, setVerDetalle] = useState(false);

  const porDia = useMemo(() => {
    const map = {};
    for (const c of datos.comidas) (map[c.fecha] = map[c.fecha] || []).push(c);
    for (const l of Object.values(map)) l.sort((a, b) => (a.ts || 0) - (b.ts || 0));
    return Object.keys(map).sort((a, b) => b.localeCompare(a)).map((f) => ({ fecha: f, lista: map[f] }));
  }, [datos.comidas]);

  const ev = evaluaciones[hoy()];
  const comidasHoy = useMemo(() => {
    const d = porDia.find((x) => x.fecha === hoy());
    return d ? d.lista : [];
  }, [porDia]);

  const notas = porDia
    .filter((d) => evaluaciones[d.fecha])
    .slice(0, 14).reverse()
    .map((d) => ({ x: fechaCorta(d.fecha), nota: evaluaciones[d.fecha].nota }));

  const enviar = () => {
    if (texto.trim().length < 2) return;
    anadir("comidas", { fecha: hoy(), texto: texto.trim(), volumen, saciedad, momento, ts: Date.now() });
    setTexto(""); setVolumen(3); setSaciedad(null); setMomento(momentoPorHora());
  };

  return (
    <div className="rejilla">
      <Card className="ancho" style={{ background: `linear-gradient(155deg, ${C.mintSoft} 0%, ${C.card} 60%)`, padding: 20 }}>
        <Rotulo>Hoy</Rotulo>
        {!ev && <Vacio texto="Anota lo que comas y valoro el día entero al vuelo." />}
        {ev && (
          <div className="fade">
            <div className="flex items-end gap-2" style={{ marginTop: 4 }}>
              <span style={{ fontFamily: display, fontWeight: 800, fontSize: 52, lineHeight: 1, color: colorNota(ev.nota), letterSpacing: -1.5 }}>
                {ev.nota}
              </span>
              <span style={{ fontFamily: body, fontSize: 16, color: C.mid, marginBottom: 7 }}>/ 10</span>
              <span className="flex items-center gap-1" style={{ marginLeft: "auto", marginBottom: 8, background: C.card, borderRadius: 999, padding: "4px 10px" }}>
                <Flame size={13} color={C.amber} />
                <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: C.ink }}>
                  {miles(ev.kcalMin)}–{miles(ev.kcalMax)}
                </span>
              </span>
            </div>
            <p style={{ fontFamily: display, fontWeight: 700, fontSize: 16.5, color: C.ink, margin: "9px 0 0" }}>{ev.etiqueta}</p>
            <p style={{ fontFamily: body, fontSize: 13.5, color: C.mid, margin: "3px 0 0", lineHeight: 1.45 }}>{ev.comentario}</p>

            <button onClick={() => setVerDetalle((v) => !v)}
              style={{ ...btnMini, marginTop: 10, background: "transparent", color: C.mid, padding: "6px 0", display: "flex", alignItems: "center", gap: 6 }}>
              <Info size={13} /> {verDetalle ? "Ocultar el desglose" : "Ver de dónde salen esas calorías"}
            </button>
            {verDetalle && (
              <div className="fade" style={{ marginTop: 6, background: C.card, borderRadius: 16, padding: 12 }}>
                {ev.detalle.map((d, i) => (
                  <div key={i} className="flex items-center gap-2" style={{ padding: "3px 0" }}>
                    <span style={{ fontFamily: body, fontSize: 12.5, color: C.mid, flex: 1, minWidth: 0 }}>
                      {d.reconocido ? d.detectados.map((x) => x.nombre).join(", ") : "sin reconocer, ración media"}
                    </span>
                    <span style={{ fontFamily: mono, fontSize: 12, color: C.ink }}>{miles(d.kcal)}</span>
                  </div>
                ))}
                <p style={{ fontFamily: body, fontSize: 11.5, color: C.faint, margin: "8px 0 0", lineHeight: 1.45 }}>
                  Estimación por tabla de alimentos con raciones caseras. Cuanto más concreto escribas, más fina sale.
                </p>
              </div>
            )}
          </div>
        )}

        {notas.length > 1 && (
          <div style={{ height: 110, marginTop: 12, marginLeft: -14 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={notas} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.faint, fontFamily: mono }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 10]} hide />
                <Tooltip cursor={{ fill: "rgba(21,48,61,.04)" }} contentStyle={{ borderRadius: 14, border: "none", boxShadow: sh, fontFamily: mono, fontSize: 12 }} formatter={(v) => [`${v} / 10`, ""]} />
                <Bar dataKey="nota" fill={C.mint} radius={[8, 8, 8, 8]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {energia ? (
        <Card>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <Rotulo>Objetivo: {energia.objetivo.label.toLowerCase()}</Rotulo>
            <span style={{ fontFamily: mono, fontSize: 11.5, color: C.mid }}>diana ~{miles(energia.diana)} kcal</span>
          </div>
          {(() => {
            const bal = calcularBalance(energia, ev && ev.kcalMin, ev && ev.kcalMax);
            if (!bal) {
              return (
                <p style={{ fontFamily: body, fontSize: 13.5, color: C.faint, lineHeight: 1.5, margin: 0 }}>
                  Anota lo que comas hoy y aquí verás si te quedas corto, en línea o por encima de tu diana.
                </p>
              );
            }
            const col = bal.bueno ? C.mint : bal.estado === "encima" ? C.coral : C.amber;
            const pct = Math.max(4, Math.min(100, (bal.medio / (energia.diana * 1.4)) * 100));
            const dianaPct = Math.min(100, 100 / 1.4);
            return (
              <div className="fade">
                <div className="flex items-baseline gap-2">
                  <span style={{ fontFamily: display, fontWeight: 800, fontSize: 26, color: col, letterSpacing: -0.6 }}>
                    {bal.estado === "linea" ? "En línea" : bal.estado === "debajo" ? "Por debajo" : "Por encima"}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 13, color: C.mid }}>
                    {bal.dif > 0 ? "+" : ""}{miles(bal.dif)} kcal
                  </span>
                </div>
                <div style={{ position: "relative", height: 12, borderRadius: 999, background: C.soft, marginTop: 12 }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 999, background: col, transition: "width .3s" }} />
                  <div style={{ position: "absolute", left: `${dianaPct}%`, top: -4, bottom: -4, width: 2, background: C.ink, opacity: 0.55, borderRadius: 2 }} />
                </div>
                <div className="flex justify-between" style={{ marginTop: 6 }}>
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.faint }}>hoy ~{miles(bal.medio)}</span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.faint }}>diana {miles(energia.diana)}</span>
                </div>
                <p style={{ fontFamily: body, fontSize: 13.5, color: C.ink, marginTop: 10, lineHeight: 1.5 }}>
                  {energia.objetivo.id === "bajar" && bal.estado === "debajo" && "Comiendo así se baja de peso: estás por debajo de tu gasto."}
                  {energia.objetivo.id === "bajar" && bal.estado === "linea" && "Hoy mantienes: para bajar habría que quedarse algo por debajo."}
                  {energia.objetivo.id === "bajar" && bal.estado === "encima" && "Hoy has ido por encima de tu diana. Cuenta la media de la semana, no un día suelto."}
                  {energia.objetivo.id === "mantener" && bal.estado === "linea" && "Justo en tu gasto: así se mantiene el peso."}
                  {energia.objetivo.id === "mantener" && bal.estado !== "linea" && "Hoy te has salido de tu gasto habitual, pero un día no mueve la báscula."}
                  {energia.objetivo.id === "subir" && bal.estado === "encima" && "Por encima del gasto: así se sube de peso."}
                  {energia.objetivo.id === "subir" && bal.estado !== "encima" && "Para subir hace falta quedar por encima del gasto, y hoy no llegas."}
                </p>
              </div>
            );
          })()}
          <p style={{ fontFamily: body, fontSize: 11.5, color: C.faint, marginTop: 10, lineHeight: 1.45 }}>
            Gasto estimado ~{miles(energia.gasto)} kcal a partir de tu peso, altura, edad y actividad.
            {energia.ajustado && " La diana se ha subido para no bajar de un mínimo razonable."} Son estimaciones, no medidas.
          </p>
        </Card>
      ) : (
        <Card onClick={irAPerfil} className="flex items-center gap-3" style={{ cursor: "pointer", background: C.amberSoft, boxShadow: "none" }}>
          <Badge Icon={Flame} color={C.amber} soft="#fff" />
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: C.ink, margin: 0 }}>Elige tu objetivo</p>
            <p style={{ fontFamily: body, fontSize: 12.5, color: C.mid, margin: 0 }}>Con peso, altura, edad y actividad te digo si comes para bajar, mantener o subir</p>
          </div>
          <ChevronRight size={18} color={C.amber} />
        </Card>
      )}

      <Card>
        <p style={{ fontFamily: display, fontWeight: 700, fontSize: 16, color: C.ink, margin: "0 0 10px" }}>
          {comidasHoy.length ? `Añadir otra comida (${comidasHoy.length} hoy)` : "¿Qué has comido?"}
        </p>

        {comidasHoy.length > 0 && (
          <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            {comidasHoy.map((c) => {
              const m = momentoDe(c.momento);
              return (
                <div key={c.id} className="flex items-center gap-2" style={{ background: C.soft, borderRadius: 14, padding: "8px 10px" }}>
                  <m.Icon size={14} color={m.color} strokeWidth={2.4} />
                  <span style={{ fontFamily: body, fontSize: 13, color: C.ink, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.texto}
                  </span>
                  <span style={{ fontFamily: body, fontSize: 11.5, color: C.faint }}>{m.label}</span>
                  <button onClick={() => borrar("comidas", c.id)} style={btnBorrar} aria-label="Borrar"><Trash2 size={13} color={C.faint} /></button>
                </div>
              );
            })}
          </div>
        )}

        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2}
          placeholder="Ensalada de lentejas y un yogur"
          style={{ ...inputBase, resize: "none", lineHeight: 1.45 }} />
        <div style={{ marginTop: 12 }}><Rotulo>Momento</Rotulo></div>
        <div className="flex gap-2" style={{ marginTop: 7, flexWrap: "wrap" }}>
          {MOMENTOS.map((m) => (
            <button key={m.id} onClick={() => setMomento(m.id)} className="flex items-center gap-1.5"
              style={{
                border: "none", cursor: "pointer", borderRadius: 999, padding: "9px 13px",
                fontFamily: body, fontWeight: 600, fontSize: 13,
                background: momento === m.id ? m.color : m.soft, color: momento === m.id ? "#fff" : m.color,
              }}>
              <m.Icon size={14} strokeWidth={2.4} />{m.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <Escala titulo="Volumen de comida" opciones={VOLUMENES} valor={volumen} onChange={setVolumen} />
        </div>
        <div style={{ marginTop: 14 }}>
          <Escala titulo="Cómo te dejó" opciones={SACIEDADES} valor={saciedad} onChange={setSaciedad}
            color={C.indigo} opcional />
        </div>
        <div style={{ marginTop: 14 }}>
          <BotonGuardar onClick={enviar} disabled={texto.trim().length < 2}>Añadir comida</BotonGuardar>
        </div>
      </Card>

      <div className="ancho">
        <div style={{ padding: "2px 4px 8px" }}><Rotulo>Días</Rotulo></div>
        <div className="rejilla">
          {!porDia.length && <Card className="ancho"><Vacio texto="Aún no has anotado ninguna comida." /></Card>}
          {porDia.slice(0, 20).map((d) => {
            const e = evaluaciones[d.fecha];
            const bal = e && calcularBalance(energia, e.kcalMin, e.kcalMax);
            const col = !bal ? C.mid : bal.bueno ? C.mint : bal.estado === "encima" ? C.coral : C.amber;
            return (
              <Card key={d.fecha} style={{ padding: 15 }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                  <span style={{ fontFamily: display, fontWeight: 700, fontSize: 15, color: C.ink, flex: 1 }}>
                    {etiquetaFecha(d.fecha)}
                  </span>
                  {e && (
                    <span style={{ fontFamily: mono, fontSize: 11.5, color: col }}>
                      {miles(e.kcalMin)}–{miles(e.kcalMax)} kcal
                      {bal && bal.estado !== "linea" ? ` (${bal.dif > 0 ? "+" : ""}${miles(bal.dif)})` : ""}
                    </span>
                  )}
                  {e && (
                    <span style={{ fontFamily: mono, fontWeight: 600, fontSize: 13, color: colorNota(e.nota), background: `${colorNota(e.nota)}1F`, borderRadius: 999, padding: "3px 10px" }}>
                      {e.nota}/10
                    </span>
                  )}
                </div>
                {e && <p style={{ fontFamily: body, fontSize: 13, color: C.mid, margin: "0 0 9px" }}>{e.etiqueta}</p>}
                <div style={{ display: "grid", gap: 7 }}>
                  {d.lista.map((c) => {
                    const m = momentoDe(c.momento);
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <Badge Icon={m.Icon} color={m.color} soft={m.soft} size={30} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: body, fontSize: 13.5, color: C.ink, lineHeight: 1.35, margin: 0 }}>{c.texto}</p>
                          <p style={{ fontFamily: body, fontSize: 11.5, color: C.faint, margin: 0 }}>
                            {m.label} · {volumenDe(c.volumen).label.toLowerCase()}
                            {c.saciedad ? ` · ${saciedadDe(c.saciedad).label.toLowerCase()}` : ""}
                          </p>
                        </div>
                        <button onClick={() => borrar("comidas", c.id)} style={btnBorrar} aria-label="Borrar"><Trash2 size={14} color={C.faint} /></button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------- pantalla valoración */

function PantallaValoracion({ datos, energia, onCerrar }) {
  const hoyD = new Date();
  const offsetPorDefecto = (p) => (p === "semana" ? (hoyD.getDay() === 1 ? 1 : 0) : hoyD.getDate() <= 2 ? 1 : 0);
  const [periodo, setPeriodo] = useState("semana");
  const [offset, setOffset] = useState(() => offsetPorDefecto("semana"));

  const informe = useMemo(() => valorarPeriodo(datos, energia, periodo, offset), [datos, energia, periodo, offset]);

  const cambiarPeriodo = (p) => { setPeriodo(p); setOffset(offsetPorDefecto(p)); };

  useEffect(() => {
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  const iconArea = { Peso: Scale, Entrenos: Dumbbell, Comidas: UtensilsCrossed, Registro: Info };
  const colorTono = { mal: C.coral, regular: C.amber, bien: C.mint };
  const suaveTono = { mal: C.coralSoft, regular: C.amberSoft, bien: C.mintSoft };

  return (
    <div className="fade" style={{ position: "fixed", inset: 0, zIndex: 70, background: C.bg, overflowY: "auto" }}>
      <div className="contenedor" style={{ padding: "22px 16px 40px" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div>
            <Rotulo>Valoración</Rotulo>
            <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 27, color: C.ink, letterSpacing: -0.6, margin: 0 }}>
              Cómo va todo
            </h2>
          </div>
          <button onClick={onCerrar} style={{ ...btnBorrar, background: C.card, padding: 10, borderRadius: 14, boxShadow: sh }} aria-label="Cerrar">
            <X size={19} color={C.mid} />
          </button>
        </div>

        <div className="flex gap-2" style={{ marginBottom: 10 }}>
          {[{ id: "semana", label: "Semanal" }, { id: "mes", label: "Mensual" }].map((p) => (
            <Chip key={p.id} activo={periodo === p.id} onClick={() => cambiarPeriodo(p.id)} style={{ flex: 1, padding: "11px 0" }}>
              {p.label}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
          <button onClick={() => setOffset((o) => o + 1)} aria-label="Periodo anterior" style={navFlecha}>
            <ChevronRight size={18} color={C.mid} style={{ transform: "rotate(180deg)" }} />
          </button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ fontFamily: display, fontWeight: 700, fontSize: 15.5, color: C.ink, margin: 0 }}>
              {etiquetaTramo(periodo, offset)}
            </p>
            <p style={{ fontFamily: mono, fontSize: 11.5, color: C.faint, margin: 0 }}>{detalleTramo(periodo, offset)}</p>
          </div>
          <button onClick={() => setOffset((o) => Math.max(0, o - 1))} aria-label="Periodo siguiente" disabled={offset === 0}
            style={{ ...navFlecha, opacity: offset === 0 ? 0.35 : 1, cursor: offset === 0 ? "default" : "pointer" }}>
            <ChevronRight size={18} color={C.mid} />
          </button>
        </div>

        {offset === 0 && !cerrado(periodo === "semana" ? rangoSemana(0) : rangoMes(0)) && (
          <p style={{ fontFamily: body, fontSize: 12.5, color: C.mid, textAlign: "center", marginBottom: 12 }}>
            {periodo === "semana" ? "Esta semana no ha terminado todavía." : "Este mes no ha terminado todavía."}{" "}
            Usa la flecha para ver {periodo === "semana" ? "la semana pasada completa" : "el mes anterior completo"}.
          </p>
        )}

        {!informe.hayDatos ? (
          <Card><Vacio texto={informe.motivo} /></Card>
        ) : (
          <div className="rejilla">
            <Card className="pop ancho"
              style={{ background: suaveTono[informe.veredicto.tono], padding: 20, boxShadow: "none" }}>
              <p style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: colorTono[informe.veredicto.tono], fontWeight: 600, margin: 0 }}>
                {informe.veredicto.tono === "mal" ? "Hay que corregir" : informe.veredicto.tono === "regular" ? "A medias" : "Bien"}
              </p>
              <p style={{ fontFamily: display, fontWeight: 800, fontSize: 24, lineHeight: 1.2, color: C.ink, margin: "6px 0 0", letterSpacing: -0.5 }}>
                {informe.veredicto.texto}
              </p>
              <p style={{ fontFamily: body, fontSize: 12.5, color: C.mid, margin: "10px 0 0" }}>
                {informe.diasPasados} {informe.diasPasados === 1 ? "día" : "días"} de {informe.diasTotales} · {informe.detalle}
              </p>
            </Card>

            {informe.avisos.map((a, i) => {
              const Icon = iconArea[a.area] || Sparkles;
              return (
                <Card key={`${a.area}-${i}`} className="pop" style={{ animationDelay: `${0.04 * (i + 1)}s`, padding: 16 }}>
                  <div className="flex items-center gap-2" style={{ marginBottom: 7 }}>
                    <Badge Icon={Icon} color={colorTono[a.tono]} soft={suaveTono[a.tono]} size={30} />
                    <span style={{ fontFamily: display, fontWeight: 700, fontSize: 14.5, color: C.ink, flex: 1 }}>{a.area}</span>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: colorTono[a.tono] }} />
                  </div>
                  <p style={{ fontFamily: body, fontSize: 14.5, color: C.ink, lineHeight: 1.5, margin: 0 }}>{a.texto}</p>
                </Card>
              );
            })}

            <Card className="ancho" style={{ background: C.ink }}>
              <p style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(255,255,255,.5)", margin: "0 0 6px" }}>
                Qué hacer
              </p>
              <p style={{ fontFamily: body, fontSize: 15, color: "#fff", lineHeight: 1.5, margin: 0 }}>{informe.cierre}</p>
            </Card>

            <details className="ancho" style={{ fontFamily: body }}>
              <summary style={{ cursor: "pointer", fontSize: 12.5, color: C.mid, padding: "8px 4px" }}>
                Ver los números en crudo
              </summary>
              <Card style={{ marginTop: 8, padding: 16 }}>
                {[
                  ["Días apuntados", `${informe.cifras.comidas.diasConRegistro} de ${informe.diasPasados}`],
                  ["Media de calorías", informe.cifras.comidas.kcalMedia ? `${miles(informe.cifras.comidas.kcalMedia)} kcal` : "—"],
                  ["Tu diana", informe.cifras.comidas.diana ? `${miles(informe.cifras.comidas.diana)} kcal` : "sin perfil"],
                  ["Días entrenados", `${informe.cifras.entrenos.diasEntrenados} (objetivo ${informe.cifras.entrenos.objetivo})`],
                  ["Minutos de entreno", `${informe.cifras.entrenos.minutos} min`],
                  ["Pesajes válidos", `${informe.cifras.peso.fiables}${informe.cifras.peso.sospechosos ? ` (${informe.cifras.peso.sospechosos} descartados)` : ""}`],
                  ["Cambio de peso", informe.cifras.peso.diferencia != null ? `${informe.cifras.peso.diferencia > 0 ? "+" : "−"}${num(Math.abs(informe.cifras.peso.diferencia))} kg` : "—"],
                  ["Ritmo", informe.cifras.peso.pendiente != null ? `${informe.cifras.peso.pendiente > 0 ? "+" : "−"}${num(Math.abs(informe.cifras.peso.pendiente), 2)} kg/semana` : "sin datos suficientes"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between" style={{ padding: "5px 0" }}>
                    <span style={{ fontSize: 13, color: C.mid }}>{k}</span>
                    <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: C.ink }}>{v}</span>
                  </div>
                ))}
              </Card>
            </details>

            <p className="ancho" style={{ fontFamily: body, fontSize: 11.5, color: C.faint, textAlign: "center", lineHeight: 1.5, margin: 0 }}>
              Todo esto se calcula en tu dispositivo con tus registros. Sin conexión, al instante y sin coste.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- perfil */

function PantallaPerfil({ perfil, pesoActual, datos, onGuardar, onRestaurar, onCerrar, onCuenta, sesion, estado }) {
  const [p, setP] = useState(perfil);
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const vista = useMemo(() => calcularEnergia(p, pesoActual), [p, pesoActual]);

  useEffect(() => {
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  return (
    <div className="fade" style={{ position: "fixed", inset: 0, zIndex: 70, background: C.bg, overflowY: "auto" }}>
      <div className="contenedor" style={{ padding: "22px 16px 40px", maxWidth: 560 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <div>
            <Rotulo>Perfil</Rotulo>
            <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 27, color: C.ink, letterSpacing: -0.6, margin: 0 }}>Tus datos</h2>
          </div>
          <button onClick={onCerrar} style={{ ...btnBorrar, background: C.card, padding: 10, borderRadius: 14, boxShadow: sh }} aria-label="Cerrar">
            <X size={19} color={C.mid} />
          </button>
        </div>

        <Card style={{ display: "grid", gap: 16 }}>
          <p style={{ fontFamily: body, fontSize: 13.5, color: C.mid, lineHeight: 1.5, margin: 0 }}>
            Con estos datos la valoración puede poner el peso y los entrenos en contexto en vez de mirar solo el número.
          </p>

          <div className="flex gap-3">
            <label style={{ flex: 1 }}>
              <Rotulo>Altura (cm)</Rotulo>
              <input type="number" inputMode="numeric" value={p.altura} onChange={(e) => set("altura", e.target.value)}
                placeholder="178" style={{ ...inputBase, marginTop: 6, fontFamily: mono, fontWeight: 600 }} />
            </label>
            <label style={{ flex: 1 }}>
              <Rotulo>Edad</Rotulo>
              <input type="number" inputMode="numeric" value={p.edad} onChange={(e) => set("edad", e.target.value)}
                placeholder="34" style={{ ...inputBase, marginTop: 6, fontFamily: mono, fontWeight: 600 }} />
            </label>
          </div>

          <div>
            <Rotulo>Sexo</Rotulo>
            <div className="flex gap-2" style={{ marginTop: 7, flexWrap: "wrap" }}>
              {SEXOS.map((s) => <Chip key={s.id} activo={p.sexo === s.id} onClick={() => set("sexo", s.id)}>{s.label}</Chip>)}
            </div>
          </div>

          <div>
            <Rotulo>Actividad diaria</Rotulo>
            <div style={{ display: "grid", gap: 7, marginTop: 7 }}>
              {ACTIVIDADES.map((a) => {
                const act = p.actividad === a.id;
                return (
                  <button key={a.id} onClick={() => set("actividad", a.id)}
                    style={{ textAlign: "left", border: "none", cursor: "pointer", borderRadius: 16, padding: "11px 14px", background: act ? C.tealSoft : C.soft }}>
                    <span style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: act ? C.teal : C.ink }}>{a.label}</span>
                    <span style={{ fontFamily: body, fontSize: 12, color: C.faint, display: "block", marginTop: 1 }}>{a.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Rotulo>Qué quieres hacer</Rotulo>
            <div className="flex gap-2" style={{ marginTop: 7 }}>
              {OBJETIVOS.map((o) => (
                <Chip key={o.id} activo={p.objetivo === o.id} onClick={() => set("objetivo", o.id)} style={{ flex: 1, padding: "11px 4px" }}>
                  {o.label}
                </Chip>
              ))}
            </div>
            {vista && (
              <div style={{ marginTop: 12, background: C.soft, borderRadius: 18, padding: 14 }}>
                <p style={{ fontFamily: body, fontSize: 13, color: C.mid, lineHeight: 1.5, margin: 0 }}>
                  Con estos datos tu gasto diario estimado son unas{" "}
                  <span style={{ fontFamily: mono, fontWeight: 600, color: C.ink }}>{miles(vista.gasto)} kcal</span>. Para{" "}
                  {vista.objetivo.verbo} de peso, la diana del día queda en{" "}
                  <span style={{ fontFamily: mono, fontWeight: 600, color: C.ink }}>~{miles(vista.diana)} kcal</span>.
                </p>
                {vista.ajustado && (
                  <p style={{ fontFamily: body, fontSize: 12, color: C.amber, margin: "6px 0 0" }}>
                    La diana se ha subido para no quedar por debajo de un mínimo razonable.
                  </p>
                )}
              </div>
            )}
            {!vista && (
              <p style={{ fontFamily: body, fontSize: 12.5, color: C.faint, marginTop: 10, lineHeight: 1.45 }}>
                Necesito altura, edad, sexo, actividad, objetivo y al menos un peso registrado para calcular tu gasto.
              </p>
            )}
          </div>

          <BotonGuardar onClick={() => { onGuardar(p); onCerrar(); }}>Guardar perfil</BotonGuardar>
        </Card>

        <Ajustes datos={datos} onRestaurar={onRestaurar} onCuenta={onCuenta} sesion={sesion} estado={estado} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- ajustes */

function Ajustes({ datos, onRestaurar, onCuenta, sesion }) {
  const [aviso, setAviso] = useState(null);
  const fileRef = useRef(null);

  const alElegirArchivo = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      await onRestaurar(f);
      setAviso({ ok: true, texto: "Copia restaurada en tu cuenta" });
    } catch (err) {
      setAviso({ ok: false, texto: "El archivo no parece una copia válida" });
    }
    e.target.value = "";
    setTimeout(() => setAviso(null), 3500);
  };

  return (
    <Card style={{ marginTop: 14, display: "grid", gap: 18 }}>
      <div>
        <p style={{ fontFamily: display, fontWeight: 700, fontSize: 16.5, color: C.ink, margin: "0 0 4px" }}>
          Sincronización
        </p>
        <p style={{ fontFamily: body, fontSize: 13, color: C.mid, lineHeight: 1.5, margin: "0 0 12px" }}>
          Conectado como {sesion.email}. Todo se guarda en tu cuenta al momento: lo que apuntes en el
          móvil aparece en el ordenador y al revés.
        </p>
        <button onClick={onCuenta} style={{ ...botonSec, width: "100%", background: C.tealSoft, color: C.teal }}>
          Ver mi cuenta
        </button>
      </div>

      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
        <p style={{ fontFamily: display, fontWeight: 700, fontSize: 16.5, color: C.ink, margin: "0 0 4px" }}>
          Copia de seguridad
        </p>
        <p style={{ fontFamily: body, fontSize: 13, color: C.mid, lineHeight: 1.5, margin: "0 0 12px" }}>
          Un archivo con todo tu historial, por si algún día quieres llevártelo a otro sitio.
        </p>
        <div className="flex gap-2">
          <button onClick={() => exportar(datos)} style={{ ...botonSec, flex: 1 }}>
            <Download size={15} /> Guardar copia
          </button>
          <button onClick={() => fileRef.current && fileRef.current.click()} style={{ ...botonSec, flex: 1 }}>
            <Upload size={15} /> Restaurar
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={alElegirArchivo} style={{ display: "none" }} />
        {aviso && <p style={{ fontFamily: body, fontSize: 12.5, color: aviso.ok ? C.mint : C.coral, marginTop: 10 }}>{aviso.texto}</p>}
      </div>

      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
        <p style={{ fontFamily: display, fontWeight: 700, fontSize: 16.5, color: C.ink, margin: "0 0 4px" }}>
          Cómo se calculan las calorías
        </p>
        <p style={{ fontFamily: body, fontSize: 13, color: C.mid, lineHeight: 1.5, margin: 0 }}>
          La app lee lo que escribes y lo cruza con una tabla de alimentos con raciones caseras. Es una
          estimación con su margen, igual que calcularlas a ojo, pero instantánea, sin conexión y sin coste.
          Cuanto más concreto escribas (&laquo;pechuga de pollo con arroz integral&raquo; mejor que &laquo;comida&raquo;), más fina sale.
        </p>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------ hoja: otra fecha */

function HojaFecha({ abierta, seccion, pesos, onCerrar, onGuardar }) {
  const [sec, setSec] = useState(seccion);
  const [fecha, setFecha] = useState(hoy());
  const [kg, setKg] = useState("");
  const [nota, setNota] = useState("");
  const [tipo, setTipo] = useState("fuerza");
  const [minutos, setMinutos] = useState("45");
  const [inten, setInten] = useState("media");
  const [texto, setTexto] = useState("");
  const [volumen, setVolumen] = useState(3);
  const [saciedad, setSaciedad] = useState(null);
  const [momento, setMomento] = useState(() => momentoPorHora());
  const [anadidos, setAnadidos] = useState(0);
  const [avisoPeso, setAvisoPeso] = useState(null);

  useEffect(() => {
    if (abierta) {
      setAvisoPeso(null);
      setSec(seccion); setFecha(hoy()); setKg(""); setNota(""); setAnadidos(0); setMomento(momentoPorHora());
      setTipo("fuerza"); setMinutos("45"); setInten("media"); setTexto(""); setVolumen(3); setSaciedad(null);
    }
  }, [abierta, seccion]);

  if (!abierta) return null;

  const valido =
    (sec === "peso" && parseFloat(String(kg).replace(",", ".")) > 0) ||
    (sec === "entrenos" && parseInt(minutos, 10) > 0) ||
    (sec === "comidas" && texto.trim().length > 1);

  const enviar = () => {
    if (!valido) return;
    if (sec === "peso") {
      const valor = parseFloat(String(kg).replace(",", "."));
      const revision = revisarPeso(valor, fecha, pesos);
      if (!revision.ok && !avisoPeso) {
        setAvisoPeso(revision);
        return;
      }
      onGuardar("pesos", { fecha, kg: valor, nota: nota.trim() });
      onCerrar();
      return;
    }
    if (sec === "entrenos") {
      onGuardar("entrenos", { fecha, tipo, minutos: parseInt(minutos, 10), intensidad: inten, ts: Date.now() });
      setMinutos("45"); setInten("media");
    }
    if (sec === "comidas") {
      onGuardar("comidas", { fecha, texto: texto.trim(), volumen, saciedad, momento, ts: Date.now() });
      setTexto(""); setVolumen(3); setSaciedad(null);
    }
    setAnadidos((n) => n + 1);
  };

  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(21,48,61,.35)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="rise" onClick={(e) => e.stopPropagation()}
        style={{ background: C.card, width: "100%", maxWidth: 560, borderRadius: "30px 30px 0 0", padding: "18px 18px 26px", maxHeight: "88vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h3 style={{ fontFamily: display, fontWeight: 800, fontSize: 20, color: C.ink, margin: 0 }}>Añadir en otra fecha</h3>
          <button onClick={onCerrar} style={{ ...btnBorrar, background: C.soft }} aria-label="Cerrar"><X size={18} color={C.mid} /></button>
        </div>

        <div className="flex gap-2" style={{ marginBottom: 18 }}>
          {[
            { id: "peso", label: "Peso", Icon: Scale },
            { id: "entrenos", label: "Entreno", Icon: Dumbbell },
            { id: "comidas", label: "Comida", Icon: UtensilsCrossed },
          ].map((s) => (
            <button key={s.id} onClick={() => setSec(s.id)} className="flex items-center justify-center gap-1.5"
              style={{
                flex: 1, border: "none", cursor: "pointer", borderRadius: 999, padding: "10px 4px",
                background: sec === s.id ? C.teal : C.soft, color: sec === s.id ? "#fff" : C.mid,
                fontFamily: body, fontWeight: 600, fontSize: 13,
              }}>
              <s.Icon size={15} />{s.label}
            </button>
          ))}
        </div>

        {sec === "peso" && (
          <>
            <Rotulo>Peso (kg)</Rotulo>
            <input type="number" inputMode="decimal" step="0.1" value={kg} onChange={(e) => setKg(e.target.value)} autoFocus
              placeholder="74,8" style={{ ...inputBase, marginTop: 6, marginBottom: 14, fontFamily: mono, fontSize: 22, fontWeight: 600 }} />
            <Rotulo>Nota</Rotulo>
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="En ayunas"
              style={{ ...inputBase, marginTop: 6, marginBottom: 14 }} />
          </>
        )}

        {sec === "entrenos" && (
          <>
            <Rotulo>Tipo</Rotulo>
            <div className="flex gap-2" style={{ marginTop: 7, marginBottom: 14, flexWrap: "wrap" }}>
              {TIPOS.map((t) => (
                <button key={t.id} onClick={() => setTipo(t.id)} className="flex items-center gap-2"
                  style={{
                    border: "none", cursor: "pointer", borderRadius: 999, padding: "9px 13px",
                    fontFamily: body, fontWeight: 600, fontSize: 13,
                    background: tipo === t.id ? t.color : t.soft, color: tipo === t.id ? "#fff" : t.color,
                  }}>
                  <t.Icon size={14} />{t.label}
                </button>
              ))}
            </div>
            <Rotulo>Duración (min)</Rotulo>
            <input type="number" inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value)}
              style={{ ...inputBase, marginTop: 6, marginBottom: 14, fontFamily: mono, fontSize: 20, fontWeight: 600 }} />
            <Rotulo>Intensidad</Rotulo>
            <div className="flex gap-2" style={{ marginTop: 7, marginBottom: 14 }}>
              {INTENS.map((i) => (
                <Chip key={i.id} activo={inten === i.id} color={i.color} onClick={() => setInten(i.id)} style={{ flex: 1 }}>{i.label}</Chip>
              ))}
            </div>
          </>
        )}

        {sec === "comidas" && (
          <>
            <Rotulo>¿Qué comiste?</Rotulo>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} autoFocus
              placeholder="Ensalada de lentejas y un yogur"
              style={{ ...inputBase, marginTop: 6, marginBottom: 12, resize: "none", lineHeight: 1.45 }} />
            <Rotulo>Momento</Rotulo>
            <div className="flex gap-2" style={{ marginTop: 7, marginBottom: 12, flexWrap: "wrap" }}>
              {MOMENTOS.map((m) => (
                <button key={m.id} onClick={() => setMomento(m.id)} className="flex items-center gap-1.5"
                  style={{
                    border: "none", cursor: "pointer", borderRadius: 999, padding: "9px 13px",
                    fontFamily: body, fontWeight: 600, fontSize: 13,
                    background: momento === m.id ? m.color : m.soft, color: momento === m.id ? "#fff" : m.color,
                  }}>
                  <m.Icon size={14} strokeWidth={2.4} />{m.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 14 }}>
              <Escala titulo="Volumen de comida" opciones={VOLUMENES} valor={volumen} onChange={setVolumen} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <Escala titulo="Cómo te dejó" opciones={SACIEDADES} valor={saciedad} onChange={setSaciedad}
                color={C.indigo} opcional />
            </div>
          </>
        )}

        <Rotulo>Fecha</Rotulo>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
          style={{ ...inputBase, marginTop: 6, marginBottom: 16, fontFamily: mono, fontSize: 15 }} />

        {avisoPeso && (
          <div className="fade" style={{ background: C.coralSoft, borderRadius: 16, padding: 13, marginBottom: 12 }}>
            <p style={{ fontFamily: body, fontSize: 13, color: C.ink, lineHeight: 1.5, margin: 0 }}>
              {avisoPeso.motivo} Pulsa otra vez para guardarlo igual.
            </p>
          </div>
        )}

        {anadidos > 0 && (
          <p style={{ fontFamily: body, fontSize: 12.5, color: C.mid, marginBottom: 10, textAlign: "center" }}>
            {anadidos} {anadidos === 1 ? "registro guardado" : "registros guardados"} en {etiquetaFecha(fecha).toLowerCase()}
          </p>
        )}

        <BotonGuardar onClick={enviar} disabled={!valido}>
          {sec === "peso" ? "Guardar" : anadidos > 0 ? "Guardar otro" : "Guardar"}
        </BotonGuardar>

        {anadidos > 0 && (
          <button onClick={onCerrar}
            style={{ width: "100%", marginTop: 10, border: "none", background: "transparent", color: C.mid, fontFamily: body, fontWeight: 600, fontSize: 14, padding: "10px 0", cursor: "pointer" }}>
            Ya está, cerrar
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- app */

export default function App() {
  return (
    <Puerta
      paleta={PALETA_CUENTA}
      titulo="Salud"
      descripcion="Peso, entrenos y comidas. Entra con tu correo y lo tendrás en todos tus dispositivos."
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

  /* La pantalla sigue viendo un único objeto `datos`, pero ya no es un estado
     propio: es lo que hay ahora mismo en Firestore. No se escribe nunca aquí. */
  const datos = useMemo(
    () => ({
      perfil: { ...PERFIL_VACIO, ...(usuario.perfil || {}) },
      pesos: registros.pesos,
      entrenos: registros.entrenos,
      comidas: registros.comidas,
    }),
    [usuario.perfil, registros.pesos, registros.entrenos, registros.comidas]
  );

  const [tab, setTab] = useState("peso");
  const [hoja, setHoja] = useState(false);
  const [pantalla, setPantalla] = useState(null);

  const ultimoPeso = useMemo(() => {
    const p = [...datos.pesos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return p.length ? p[p.length - 1].kg : null;
  }, [datos.pesos]);

  const energia = useMemo(() => calcularEnergia(datos.perfil, ultimoPeso), [datos.perfil, ultimoPeso]);

  /* Las valoraciones ya no se guardan: se calculan al vuelo cada vez que
     cambian las comidas o el perfil. Instantáneo y siempre coherente. */
  const evaluaciones = useMemo(() => {
    const porDia = {};
    for (const c of datos.comidas) (porDia[c.fecha] = porDia[c.fecha] || []).push(c);
    const salida = {};
    for (const [fecha, lista] of Object.entries(porDia)) {
      salida[fecha] = valorarDia(lista.sort((a, b) => (a.ts || 0) - (b.ts || 0)), energia);
    }
    return salida;
  }, [datos.comidas, energia]);

  /* Apuntar algo es escribirlo en Firestore. La lista de la pantalla no se
     toca a mano: se repinta sola cuando Firestore devuelve el cambio. */
  const anadir = useCallback((coleccion, item) => { guardar(coleccion, item); }, [guardar]);

  const restaurar = useCallback(
    (archivo) => importar(archivo).then(({ porColeccion, campos }) => importarDatos(porColeccion, campos)),
    [importarDatos]
  );

  const TABS = [
    { id: "peso", label: "Peso", Icon: Scale },
    { id: "entrenos", label: "Entrenos", Icon: Dumbbell },
    { id: "comidas", label: "Comidas", Icon: UtensilsCrossed },
  ];

  const sinPerfil = !datos.perfil.altura;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: body }}>
      <style>{CSS}</style>

      <header className="contenedor" style={{ padding: "20px 16px 6px" }}>
        <div className="flex items-center justify-between">
          <div>
            <Rotulo>{etiquetaFecha(hoy())}</Rotulo>
            <h1 style={{ fontFamily: display, fontWeight: 800, fontSize: 29, color: C.ink, lineHeight: 1.1, letterSpacing: -0.7, margin: 0 }}>
              {TABS.find((t) => t.id === tab).label}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <PastillaSync estado={estado} paleta={PALETA_CUENTA} onAbrir={() => setPantalla("cuenta")} />
            <button onClick={() => setPantalla("perfil")} aria-label="Perfil"
              style={{ border: "none", background: C.card, borderRadius: 16, padding: 11, cursor: "pointer", boxShadow: sh }}>
              <User size={19} color={C.mid} />
            </button>
          </div>
        </div>
      </header>

      <main className="contenedor" style={{ padding: "10px 16px 128px" }}>
        {!listo && !error && <Vacio texto="Cargando tus datos…" />}

        {error && (
          <Card style={{ marginBottom: 14, background: C.coralSoft, boxShadow: "none" }}>
            <p style={{ fontFamily: body, fontSize: 13, color: C.ink, margin: 0 }}>{error}</p>
          </Card>
        )}

        {listo && sinPerfil && (
          <Card onClick={() => setPantalla("perfil")} className="flex items-center gap-3"
            style={{ marginBottom: 14, cursor: "pointer", background: C.amberSoft, boxShadow: "none" }}>
            <Badge Icon={User} color={C.amber} soft="#fff" />
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: C.ink, margin: 0 }}>Completa tu perfil</p>
              <p style={{ fontFamily: body, fontSize: 12.5, color: C.mid, margin: 0 }}>Altura, edad y actividad afinan la valoración</p>
            </div>
            <ChevronRight size={18} color={C.amber} />
          </Card>
        )}

        {listo && tab === "peso" && <VistaPeso datos={datos} anadir={anadir} borrar={borrar} />}
        {listo && tab === "entrenos" && <VistaEntrenos datos={datos} anadir={anadir} borrar={borrar} />}
        {listo && tab === "comidas" && (
          <VistaComidas datos={datos} anadir={anadir} borrar={borrar} energia={energia}
            evaluaciones={evaluaciones} irAPerfil={() => setPantalla("perfil")} />
        )}

        {listo && (
          <button onClick={() => setPantalla("valoracion")} className="flex items-center gap-3"
            style={{
              width: "100%", marginTop: 16, border: "none", cursor: "pointer", textAlign: "left",
              borderRadius: 26, padding: 18, background: C.ink, boxShadow: sh,
            }}>
            <div style={{ width: 38, height: 38, borderRadius: 14, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={19} color={C.mint} strokeWidth={2.3} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: display, fontWeight: 700, fontSize: 16, color: "#fff", margin: 0 }}>Valorar mi semana o mes</p>
              <p style={{ fontFamily: body, fontSize: 12.5, color: "rgba(255,255,255,.62)", margin: 0 }}>Peso, entrenos y comidas juntos</p>
            </div>
            <ChevronRight size={19} color="rgba(255,255,255,.6)" />
          </button>
        )}
      </main>

      <button onClick={() => setHoja(true)} aria-label="Añadir en otra fecha" className="botonFlotante"
        style={{
          position: "fixed", right: 20, bottom: 94, zIndex: 50, width: 56, height: 56, borderRadius: 20,
          border: "none", background: C.teal, color: "#fff", cursor: "pointer",
          boxShadow: "0 10px 24px rgba(16,179,163,.45)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
        <Plus size={25} strokeWidth={2.7} />
      </button>

      <nav className="barraInferior"
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 45,
          background: "rgba(255,255,255,.93)", backdropFilter: "blur(14px)",
          borderTop: `1px solid ${C.line}`, padding: "9px 8px 22px", display: "flex", justifyContent: "space-around",
        }}>
        {TABS.map((t) => {
          const activo = t.id === tab;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className="flex flex-col items-center gap-1"
              style={{ background: "none", border: "none", cursor: "pointer", flex: 1, padding: 0 }}>
              <span className="flex items-center justify-center"
                style={{ width: 46, height: 30, borderRadius: 999, background: activo ? C.tealSoft : "transparent", transition: "background .18s" }}>
                <t.Icon size={19} color={activo ? C.teal : C.faint} strokeWidth={activo ? 2.6 : 2} />
              </span>
              <span style={{ fontFamily: body, fontSize: 11, fontWeight: 600, color: activo ? C.teal : C.faint }}>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <HojaFecha abierta={hoja} seccion={tab} pesos={datos.pesos} onCerrar={() => setHoja(false)} onGuardar={anadir} />

      {pantalla === "valoracion" && (
        <PantallaValoracion datos={datos} energia={energia} onCerrar={() => setPantalla(null)} />
      )}
      {pantalla === "perfil" && (
        <PantallaPerfil
          perfil={datos.perfil} pesoActual={ultimoPeso} datos={datos}
          onGuardar={(p) => guardarUsuario({ perfil: p })}
          onRestaurar={restaurar}
          onCerrar={() => setPantalla(null)}
          onCuenta={() => setPantalla("cuenta")}
          sesion={sesion} estado={estado}
        />
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
