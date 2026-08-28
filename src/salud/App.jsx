import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, BarChart, Bar, Cell } from "recharts";
import {
  Scale, Dumbbell, UtensilsCrossed, Plus, X, Trash2, Pencil, CalendarDays,
  RotateCcw, Sparkles, Users, Activity, Bike, TrendingUp, TrendingDown, Minus,
  User, Check, ChevronRight, ChevronUp, ChevronDown, Flame, Coffee, Moon, Apple,
  Download, Upload, Info, Mic, LayoutGrid,
} from "lucide-react";

import { useDatos } from "../comun/datos.js";
import { Puerta } from "../comun/sesion.jsx";
import { PantallaCuenta, PastillaSync } from "../comun/cuenta.jsx";
import { CSS_VOZ, HojaDictado } from "../comun/voz.jsx";
import { TEMAS_ELEGIBLES, aplicarTema, guardarTema, instalarTema, temaGuardado } from "../comun/tema.js";
import { EJEMPLOS_SALUD, interpretarSalud } from "./dictado.js";
import { calcularBalance, valorarDia } from "./estimador.js";
import {
  EJEMPLO_PEGADO, entrenoDesdePlantilla, interpretarPlantillas, plantillaDesdeEntreno,
  plantillasSanas, porOrdenPlantilla, resumenPlantilla, ultimaDePlantilla,
} from "./plantillas.js";
import { valorarPeriodo } from "./valoracion.js";
import {
  ACTIVIDADES, COLECCIONES, DIAS, DURACIONES, MESES_LARGOS, OBJETIVOS,
  PERFIL_VACIO, SACIEDADES,
  SEXOS, VOLUMENES, calcularEnergia, cerrado, desdeIso, detalleTramo,
  EJERCICIOS_HABITUALES, EJERCICIOS_SUGERIDOS, comidasFrecuentes, conFecha, saneaEntrenos, ejerciciosUsados, enRango, etiquetaFecha,
  etiquetaTramo, exportar, fechaCorta, mismoEjercicio, progresionEjercicio,
  recordEjercicio, resumenFuerza, textoResumenFuerza, enTiempo, ultimaVezEjercicio, ultimoEntrenoConEjercicios,
  diferenciasEjercicio, progresoEjercicios, progresoPlantilla, mejorSerie,
  textoSerie, esEnlazada, minutosDeEntreno,
  hoy, importar, inicioSemana, leerLegado, mediaMovil, miles, num, olvidarLegado,
  pesoCorto, plural, progresoMeta, racha, rangoMes, rangoSemana, revisarPeso, saciedadDe,
  tendenciaPeso, volumenDe, ausencia as calcularAusencia, energiaDelDia, pesosSanos,
} from "./nucleo.js";

/* ---------------------------------------------------------------- tokens */

/*
 * La paleta ya no son colores: son nombres.
 *
 * Cada entrada apunta a una variable CSS y los dos temas las rellenan más
 * abajo. Así el modo oscuro no obliga a tocar ni uno de los cientos de
 * `color: C.ink` repartidos por el archivo — cambia la variable y cambia todo.
 *
 * Dos pares merecen explicación porque son los que se rompen al invertir:
 *
 *   `sobreAcento`  el texto que va ENCIMA de un botón del color de acento. En
 *                  claro es blanco; en oscuro los acentos son claros, así que
 *                  encima va tinta oscura. Escribir "#fff" a pelo dejaba los
 *                  botones activos en blanco sobre turquesa claro.
 *
 *   `tarjetaOscura` / `sobreTarjetaOscura`
 *                  las tarjetas que en claro son casi negras con letra blanca
 *                  («Valorar mi semana»). En oscuro no pueden usar `ink`,
 *                  porque ahí `ink` ES el blanco: quedaría blanco sobre blanco.
 */
const C = {
  bg: "var(--bg)", soft: "var(--soft)", card: "var(--card)", ink: "var(--ink)",
  mid: "var(--mid)", faint: "var(--faint)", line: "var(--line)",
  teal: "var(--teal)", tealSoft: "var(--tealSoft)",
  mint: "var(--mint)", mintSoft: "var(--mintSoft)",
  coral: "var(--coral)", coralSoft: "var(--coralSoft)",
  amber: "var(--amber)", amberSoft: "var(--amberSoft)",
  indigo: "var(--indigo)", indigoSoft: "var(--indigoSoft)",
  sobreAcento: "var(--sobreAcento)",
  tarjetaOscura: "var(--tarjetaOscura)", sobreTarjetaOscura: "var(--sobreTarjetaOscura)",
  velo: "var(--velo)", barra: "var(--barra)",
};

const sh = "var(--sombra)";
const display = "'Bricolage Grotesque', system-ui, sans-serif";
const body = "'Instrument Sans', system-ui, sans-serif";
const mono = "'IBM Plex Mono', ui-monospace, monospace";

const PALETA_CUENTA = {
  bg: C.bg, card: C.card, suave: C.soft, ink: C.ink, mid: C.mid, faint: C.faint,
  line: C.line, acento: C.teal, acentoSuave: C.tealSoft, coral: C.coral, mint: C.mint,
  /* La tinta que va ENCIMA del acento y del coral. Sin esto los compartidos
     escribían "#fff" a pelo, y en oscuro el acento es claro: blanco sobre
     verde menta da 1,94 de contraste, la mitad de lo que hace falta. */
  sobreAcento: C.sobreAcento,
  /* Los compartidos ya pedían estos dos —el aviso rojo de la cuenta, el panel
     de «esto borra todo», el marco de «aplicación privada»— y nadie los
     servía: llegaban `undefined`, así que esos fondos salían transparentes y
     esos bordes no se pintaban. */
  coralSuave: C.coralSoft, avisoSuave: C.amberSoft,
  sombra: sh, display, body, mono,
};

/*
 * Los dos temas.
 *
 * El oscuro es el de casa: la app se mira de noche y en el gimnasio, y el
 * blanco a pantalla completa molesta. El claro sigue estando para quien lo
 * prefiera o para mirarla al sol.
 *
 * `data-tema` en el <html> lo pone un script minúsculo del index.html ANTES
 * de que cargue nada, para que no haya destello blanco al abrir. Aquí solo se
 * declaran los valores. `auto` no pinta atributo: manda el sistema.
 *
 * Los acentos del oscuro NO son los mismos colores del claro: un turquesa que
 * se lee sobre blanco es ilegible sobre casi negro. Están subidos de luz hasta
 * pasar 4,5 sobre el fondo oscuro, y los fondos «Soft» bajados hasta ser
 * tintes, no pasteles.
 */
const TEMAS = `
:root, :root[data-tema="claro"] {
  --bg: #EDF3F8; --soft: #F6FAFC; --card: #FFFFFF;
  /* Estos seis se bajaron un punto más al medirlos de verdad: el barrido de
     contraste del navegador destapó ocho combinaciones por debajo de 4,5 que
     llevaban ahí desde el principio —«faint» sobre el fondo daba 3,96, la
     menta sobre su propio tinte 3,93, y el blanco encima del ámbar 4,48—.
     Ahora las treinta y dos parejas del tema pasan con margen. */
  --ink: #15303D; --mid: #4C6675; --faint: #54707E; --line: #E3EDF3;
  --teal: #066B63; --tealSoft: #DCF5F1;
  --mint: #0B7752; --mintSoft: #E0F9ED;
  --coral: #BB3527; --coralSoft: #FFE8E4;
  --amber: #945E00; --amberSoft: #FFF2DE;
  --indigo: #5555BE; --indigoSoft: #E8EBFE;
  --sobreAcento: #FFFFFF;
  --tarjetaOscura: #15303D; --sobreTarjetaOscura: #FFFFFF;
  --velo: rgba(21,48,61,.35);
  --barra: rgba(255,255,255,.93);
  --sombra: 0 1px 2px rgba(21,48,61,.04), 0 10px 26px rgba(21,48,61,.06);
  --sombraAlta: 0 12px 34px rgba(21,48,61,.16);
  --brilloAcento: 0 6px 16px rgba(6,107,99,.30);
  --tinte: 12%;
}

:root[data-tema="oscuro"] {
  --bg: #0B1014; --soft: #19222A; --card: #121A1F;
  --ink: #E9F2F6; --mid: #A6BCC6; --faint: #8AA3AF; --line: #232F37;
  --teal: #38CFBB; --tealSoft: #10312E;
  --mint: #4ADB94; --mintSoft: #0F3125;
  --coral: #FF8877; --coralSoft: #3B1B17;
  --amber: #F2B850; --amberSoft: #3A2A11;
  --indigo: #A0A0F2; --indigoSoft: #21214A;
  /* Encima de un acento claro va tinta oscura, no blanco. */
  --sobreAcento: #06211D;
  /* En oscuro la tarjeta «negra» no puede ser más negra que el fondo: se
     resuelve al revés, como una superficie elevada. */
  --tarjetaOscura: #1F2B33; --sobreTarjetaOscura: #E9F2F6;
  --velo: rgba(0,0,0,.6);
  --barra: rgba(18,26,31,.95);
  --sombra: 0 1px 2px rgba(0,0,0,.3), 0 10px 26px rgba(0,0,0,.34);
  --sombraAlta: 0 12px 34px rgba(0,0,0,.5);
  --brilloAcento: 0 6px 16px rgba(56,207,187,.24);
  --tinte: 22%;
}

/* Sin elección guardada manda el sistema. */
@media (prefers-color-scheme: dark) {
  :root:not([data-tema="claro"]):not([data-tema="oscuro"]) {
    --bg: #0B1014; --soft: #19222A; --card: #121A1F;
    --ink: #E9F2F6; --mid: #A6BCC6; --faint: #8AA3AF; --line: #232F37;
    --teal: #38CFBB; --tealSoft: #10312E;
    --mint: #4ADB94; --mintSoft: #0F3125;
    --coral: #FF8877; --coralSoft: #3B1B17;
    --amber: #F2B850; --amberSoft: #3A2A11;
    --indigo: #A0A0F2; --indigoSoft: #21214A;
    --sobreAcento: #06211D;
    --tarjetaOscura: #1F2B33; --sobreTarjetaOscura: #E9F2F6;
    --velo: rgba(0,0,0,.6);
    --barra: rgba(18,26,31,.95);
    --sombra: 0 1px 2px rgba(0,0,0,.3), 0 10px 26px rgba(0,0,0,.34);
    --sombraAlta: 0 12px 34px rgba(0,0,0,.5);
    --brilloAcento: 0 6px 16px rgba(56,207,187,.24);
    --tinte: 22%;
  }
}

html, body { background: var(--bg); }
/* Los controles nativos —el selector de fecha, sobre todo— se pintan según
   esto. Sin ello sale un calendario blanco cegador dentro de la hoja oscura. */
:root[data-tema="oscuro"] { color-scheme: dark; }
:root[data-tema="claro"] { color-scheme: light; }
`;

/* La hoja y el tema guardado se instalan al importar el módulo, antes de que
   se dibuje la puerta de acceso, que usa esta misma paleta. */
if (typeof document !== "undefined") instalarTema(TEMAS);

const CSS = `
* { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
input, textarea, button { font-family: inherit; }
button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${C.teal}; outline-offset: 2px; }
@keyframes rise { from { transform: translateY(16px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes spin { to { transform: rotate(360deg) } }
@keyframes pop { 0% { transform: scale(.9); opacity: 0 } 100% { transform: none; opacity: 1 } }
/* «backwards» y no «both», a propósito. Con «both» el relleno hacia delante
   deja puesto para siempre el transform del último fotograma —aunque sea la
   matriz identidad—, y un elemento con transform es el marco de referencia de
   sus descendientes en position:fixed. Resultado: una hoja abierta desde
   dentro de otra hoja se colocaba respecto a la de abajo y no respecto a la
   ventana. Con «backwards» no hay parpadeo al entrar y el transform se va en
   cuanto la animación termina. */
.rise { animation: rise .26s cubic-bezier(.2,.8,.3,1) backwards }
.fade { animation: fade .2s ease both }
.pop { animation: pop .22s cubic-bezier(.2,.8,.3,1) backwards }   /* idem: toca transform */
.spin { animation: spin 1s linear infinite }
@media (prefers-reduced-motion: reduce) { .rise,.fade,.spin,.pop { animation: none } }

.contenedor { max-width: 520px; margin: 0 auto; }
/* La columna se ata al ancho disponible: una rejilla sin columnas definidas se
   dimensiona al contenido más ancho, y basta un nombre de ejercicio largo para
   que toda la pantalla se salga por la derecha. */
.rejilla { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; }

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
  .rejilla { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
  .rejilla > .ancho { grid-column: 1 / -1; }
  .barraInferior { border-radius: 22px; left: 50% !important; right: auto !important;
    transform: translateX(-50%); bottom: 18px !important; width: auto; padding: 8px 12px !important;
    box-shadow: var(--sombraAlta); border: 1px solid ${C.line}; }
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

/* Cómo se dice cada veredicto de progresión. «Estancado» es a propósito una
   palabra incómoda: si llevas tres sesiones sin mover la marca, decir «igual»
   sería suavizarlo, y para eso mejor no decir nada. */
const VEREDICTO = {
  sube: { label: "Subiendo", color: C.mint, Icon: TrendingUp },
  igual: { label: "Igual", color: C.mid, Icon: Minus },
  estancado: { label: "Estancado", color: C.amber, Icon: Minus },
  baja: { label: "Bajó", color: C.coral, Icon: TrendingDown },
  nuevo: { label: "Nuevo", color: C.indigo, Icon: Sparkles },
};

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

/**
 * Una capa que se dibuja encima de todo, colgada del `body`.
 *
 * `position: fixed` sólo se mide contra la ventana si ningún antepasado tiene
 * un `transform`. Una hoja que se abre desde dentro de otra hoja es
 * precisamente ese caso, y basta con que a alguien se le vaya la mano con una
 * animación para que la de arriba aparezca a media pantalla y con el título
 * por debajo de la de abajo. Sacándola del árbol deja de importar quién la
 * contenga.
 *
 * Los clics siguen subiendo por el árbol de React, no por el del documento,
 * así que el `stopPropagation` de la hoja de abajo sigue valiendo y tocar
 * dentro de la de arriba no cierra la de abajo.
 */
function Capa({ children, ...resto }) {
  if (typeof document === "undefined") return null;
  return createPortal(<div {...resto}>{children}</div>, document.body);
}

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
        background: activo ? color : C.soft, color: activo ? C.sobreAcento : C.mid,
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
/* 40x40 de mínimo. Un icono de 18 px con 6 de relleno son 30, y 30 es un
   objetivo incómodo con el pulgar: Apple y Google piden 44 y 48. El icono se
   sigue viendo igual de pequeño; lo que crece es la zona que responde. */
const btnBorrar = {
  background: "none", border: "none", padding: 6, cursor: "pointer", borderRadius: 10, flexShrink: 0,
  minWidth: 40, minHeight: 40, display: "inline-flex", alignItems: "center", justifyContent: "center",
};
const btnMini = {
  fontFamily: body, fontWeight: 600, fontSize: 12.5, color: C.teal, background: C.tealSoft,
  border: "none", borderRadius: 999, padding: "7px 13px", cursor: "pointer",
  /* Alto cómodo para el pulgar sin engordar la letra. */
  minHeight: 36, display: "inline-flex", alignItems: "center", justifyContent: "center",
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
                background: activo ? color : C.soft, color: activo ? C.sobreAcento : C.mid,
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

/**
 * Envoltorio de las gráficas.
 *
 * Recharts mide su contenedor en el primer pintado. Dentro de una rejilla la
 * columna todavía no tiene su ancho definitivo en ese instante: los ejes se
 * recalculan al recibirlo, pero las barras no, y salen de un píxel. Esperar un
 * fotograma basta para que la medida sea ya la buena.
 */
function Grafica({ alto, style, children }) {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setListo(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div style={{ height: alto, width: "100%", ...style }}>
      {listo && (
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      )}
    </div>
  );
}

function BotonGuardar({ onClick, disabled, children = "Guardar" }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: "100%", border: "none", borderRadius: 18, padding: "14px 0",
        background: disabled ? C.line : C.teal, color: disabled ? C.faint : C.sobreAcento,
        fontFamily: display, fontWeight: 700, fontSize: 16, cursor: disabled ? "default" : "pointer",
        boxShadow: disabled ? "none" : "var(--brilloAcento)",
      }}>
      {children}
    </button>
  );
}

const colorNota = (n) => (n >= 7 ? C.mint : n >= 5 ? C.amber : C.coral);

/** «15 de septiembre», para fechas que aún están lejos. */
const etiquetaLarga = (f) => {
  const d = desdeIso(f);
  const mes = MESES_LARGOS[d.getMonth()];
  const ano = d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : "";
  return `${d.getDate()} de ${mes}${ano}`;
};

/**
 * Los dos botones que lleva cada registro: corregirlo o quitarlo.
 * Van en su propio grupo para que se peguen entre sí y no hereden la
 * separación de la fila, que en el móvil obligaba al texto a partirse.
 */
/**
 * Editar y borrar, uno al lado del otro.
 *
 * Medían 23 píxeles de lado. Con el dedo eso es fallar el tiro, y aquí fallarlo
 * significa borrar lo que querías corregir. El icono se queda igual de discreto
 * pero la zona que responde al toque llega a 40, que es lo mínimo razonable.
 */
function Acciones({ onEditar, onBorrar, size = 15, que = "el registro" }) {
  const boton = {
    ...btnBorrar, padding: 0, width: 40, height: 40,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
  };
  return (
    <span className="flex items-center" style={{ gap: 0, marginRight: -8, flexShrink: 0 }}>
      <button onClick={onEditar} style={boton} aria-label={`Editar ${que}`} title="Editar">
        <Pencil size={size} color={C.faint} />
      </button>
      <button onClick={onBorrar} style={boton} aria-label={`Borrar ${que}`} title="Borrar">
        <Trash2 size={size} color={C.faint} />
      </button>
    </span>
  );
}

/* ─────────────────────────── historial por días ───────────────────────────

   Mientras la semana está en curso se ven sus días y ya está: son siete como
   mucho, caben sin tener que bajar media pantalla. Todo lo anterior se guarda
   detrás de «Otros días», que abre una pantalla aparte con el histórico
   entero, separado por meses.

   `elementos` son cosas con `fecha` (un pesaje, un entreno o el grupo de
   comidas de un día). `pintar` decide cómo se dibuja cada uno, que es lo único
   que cambia entre las tres secciones.                                      */

/* Los pesajes y los entrenos son filas dentro de una tarjeta; los días de
   comidas son tarjetas sueltas en una rejilla. Lo único que cambia es esto. */
const Envoltorio = ({ rejilla, children }) =>
  rejilla ? <div className="rejilla">{children}</div> : <Card style={{ padding: 8 }}>{children}</Card>;

function partirPorSemana(elementos) {
  const semana = inicioSemana();
  const deEstaSemana = [];
  const anteriores = [];
  for (const el of elementos) (enRango(el.fecha, semana) ? deEstaSemana : anteriores).push(el);
  return { deEstaSemana, anteriores };
}

function Historial({ titulo, elementos, pintar, clave, vacio, rejilla }) {
  const [abierto, setAbierto] = useState(false);
  const { deEstaSemana, anteriores } = useMemo(() => partirPorSemana(elementos), [elementos]);

  return (
    <div className={rejilla ? "ancho" : undefined}>
      <div className="flex items-center justify-between" style={{ padding: "2px 4px 8px" }}>
        <Rotulo>{titulo}</Rotulo>
        {deEstaSemana.length > 0 && (
          <span style={{ fontFamily: body, fontSize: 11.5, color: C.faint }}>Esta semana</span>
        )}
      </div>

      {!elementos.length ? (
        <Card style={{ padding: 8 }}><Vacio texto={vacio} /></Card>
      ) : !deEstaSemana.length ? (
        <Card style={{ padding: 8 }}>
          <Vacio texto="Esta semana todavía no has anotado nada aquí." />
        </Card>
      ) : (
        <Envoltorio rejilla={rejilla}>{deEstaSemana.map((el) => pintar(el))}</Envoltorio>
      )}

      {anteriores.length > 0 && (
        <button onClick={() => setAbierto(true)} className="flex items-center gap-3"
          style={{
            width: "100%", marginTop: 10, border: "none", cursor: "pointer", textAlign: "left",
            background: C.card, boxShadow: sh, borderRadius: 20, padding: "13px 15px",
          }}>
          <Badge Icon={CalendarDays} color={C.mid} soft={C.soft} size={32} />
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: C.ink, margin: 0 }}>Otros días</p>
            <p style={{ fontFamily: body, fontSize: 12.5, color: C.faint, margin: 0 }}>
              {anteriores.length} {anteriores.length === 1 ? "anterior" : "anteriores"} a esta semana
            </p>
          </div>
          <ChevronRight size={18} color={C.faint} />
        </button>
      )}

      {abierto && (
        <PantallaOtrosDias titulo={titulo} elementos={anteriores} pintar={pintar} clave={clave}
          rejilla={rejilla} onCerrar={() => setAbierto(false)} />
      )}
    </div>
  );
}

/** Agrupa por mes para poder recorrer el histórico sin perderse. */
function porMeses(elementos) {
  const grupos = [];
  for (const el of elementos) {
    const d = desdeIso(el.fecha);
    const clave = `${d.getFullYear()}-${d.getMonth()}`;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.clave === clave) ultimo.lista.push(el);
    else {
      const nombre = MESES_LARGOS[d.getMonth()];
      grupos.push({
        clave, lista: [el],
        titulo: `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)}${
          d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""
        }`,
      });
    }
  }
  return grupos;
}

function PantallaOtrosDias({ titulo, elementos, pintar, rejilla, onCerrar }) {
  const meses = useMemo(() => porMeses(elementos), [elementos]);

  useEffect(() => {
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  return (
    <div className="fade" style={{ position: "fixed", inset: 0, zIndex: 75, background: C.bg, overflowY: "auto" }}>
      <div className="contenedor" style={{ padding: "22px 16px 48px", maxWidth: 620 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
          <div>
            <Rotulo>{titulo}</Rotulo>
            <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 27, color: C.ink, letterSpacing: -0.6, margin: 0 }}>
              Otros días
            </h2>
          </div>
          <button onClick={onCerrar} style={{ ...btnBorrar, background: C.card, padding: 10, borderRadius: 14, boxShadow: sh }} aria-label="Cerrar">
            <X size={19} color={C.mid} />
          </button>
        </div>

        {meses.map((m) => (
          <div key={m.clave} style={{ marginBottom: 22 }}>
            <div style={{ padding: "0 4px 8px" }}>
              <Rotulo>{m.titulo}</Rotulo>
            </div>
            <Envoltorio rejilla={rejilla}>{m.lista.map((el) => pintar(el))}</Envoltorio>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ vista peso */

function VistaPeso({ datos, anadir, borrar, editar }) {
  const pesos = useMemo(() => [...datos.pesos].sort((a, b) => a.fecha.localeCompare(b.fecha)), [datos.pesos]);
  const historial = useMemo(() => [...pesos].reverse(), [pesos]);
  const ultimo = pesos[pesos.length - 1];
  const previo = pesos[pesos.length - 2];
  const delta = ultimo && previo ? ultimo.kg - previo.kg : null;

  /* Sin pesajes previos el campo empieza vacío: poner 70 es inventarle a
     alguien un peso que no es el suyo, y encima invita a guardarlo sin mirar. */
  const [kg, setKg] = useState(() => (ultimo ? String(ultimo.kg) : ""));
  const [nota, setNota] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState(null);
  const yaHoy = pesos.some((p) => p.fecha === hoy());

  useEffect(() => { if (ultimo) setKg(String(ultimo.kg)); }, [ultimo && ultimo.kg]);

  /* La línea cruda sube y baja por agua y sal; la media de 7 días es la que
     enseña de verdad hacia dónde va la cosa. Van las dos juntas. */
  const serie = useMemo(
    () => mediaMovil(pesos).slice(-30).map((p) => ({ x: fechaCorta(p.fecha), kg: p.kg, media: p.media })),
    [pesos]
  );
  const tendencia = useMemo(() => tendenciaPeso(datos.pesos), [datos.pesos]);
  const meta = useMemo(() => progresoMeta(datos.pesos, datos.perfil), [datos.pesos, datos.perfil]);
  const dominio = useMemo(() => {
    if (!serie.length) return [0, 1];
    const v = serie.map((s) => s.kg);
    return [Math.floor(Math.min(...v) - 1), Math.ceil(Math.max(...v) + 1)];
  }, [serie]);

  const rumbo = tendencia && {
    baja: { verbo: "Bajando", color: C.mint },
    sube: { verbo: "Subiendo", color: C.amber },
    estable: { verbo: "Estable", color: C.mid },
  }[tendencia.direccion];

  const altura = parseFloat(datos.perfil.altura);
  const imc = ultimo && altura > 0 ? ultimo.kg / Math.pow(altura / 100, 2) : null;

  const paso = (d) =>
    setKg((k) => {
      const base = parseFloat(String(k).replace(",", "."));
      return String(Math.round(((base > 0 ? base : 70) + d) * 10) / 10);
    });

  const valorKg = parseFloat(String(kg).replace(",", "."));

  const escribir = () => {
    anadir("pesos", { fecha: hoy(), kg: valorKg, nota: nota.trim() });
    setNota(""); setAbierto(false); setAviso(null);
  };

  /* Antes de guardar se comprueba contra el pesaje anterior. No bloquea nada:
     avisa, porque a veces el salto es real y a veces es un dedo torcido. */
  const guardarPeso = () => {
    const revision = revisarPeso(valorKg, hoy(), datos.pesos);
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

        {meta && (
          <div style={{ marginTop: 14 }}>
            <div className="flex items-baseline justify-between" style={{ marginBottom: 6 }}>
              <span style={{ fontFamily: body, fontSize: 12.5, fontWeight: 600, color: C.ink }}>
                {meta.alcanzada
                  ? "Meta conseguida"
                  : `Te ${Math.abs(meta.restante) === 1 ? "queda" : "quedan"} ${num(Math.abs(meta.restante))} kg`}
              </span>
              <span style={{ fontFamily: mono, fontSize: 11.5, color: C.faint }}>
                {num(meta.desde, 0)} → {num(meta.meta, 0)} kg
              </span>
            </div>
            <div style={{ height: 8, borderRadius: 999, background: "color-mix(in srgb, var(--ink) 12%, transparent)", overflow: "hidden" }}>
              <div style={{
                width: `${meta.porcentaje}%`, height: "100%", borderRadius: 999,
                background: meta.alcanzada ? C.mint : C.teal, transition: "width .4s",
              }} />
            </div>
            <p style={{ fontFamily: body, fontSize: 12, color: C.faint, margin: "6px 0 0" }}>
              {meta.alcanzada
                ? "A mantenerlo, que es la parte difícil."
                : meta.fecha
                ? `${meta.porcentaje}% del camino. A este ritmo llegas hacia el ${etiquetaLarga(meta.fecha.iso)}.`
                : `${meta.porcentaje}% del camino.`}
            </p>
          </div>
        )}

        {serie.length > 1 && (
          <Grafica alto={160} style={{ marginTop: 12, marginLeft: -10 }}>
              <LineChart data={serie} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.faint, fontFamily: mono }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={26} />
                {/* Sin decimales: con un rango de pocos kilos salían marcas
                    como «83,25», que no caben en el ancho del eje y se veían
                    cortadas por delante («3,25»). */}
                <YAxis domain={dominio} allowDecimals={false} tick={{ fontSize: 10, fill: C.faint, fontFamily: mono }} tickLine={false} axisLine={false} width={32} />
                <Tooltip contentStyle={{ borderRadius: 14, border: `1px solid ${C.line}`, background: C.card, color: C.ink, boxShadow: sh, fontFamily: mono, fontSize: 12 }} formatter={(v) => [`${num(v)} kg`, ""]} />
                <Line type="monotone" dataKey="kg" isAnimationActive={false} stroke={C.teal} strokeWidth={2} strokeOpacity={0.35}
                  dot={{ r: 2.5, fill: C.teal, fillOpacity: 0.45, strokeWidth: 0 }} activeDot={{ r: 5 }} name="pesaje" />
                <Line type="monotone" dataKey="media" isAnimationActive={false} stroke={C.teal} strokeWidth={3} dot={false}
                  connectNulls name="media de 7 días" />
              </LineChart>
            </Grafica>
        )}

        {rumbo && (
          <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 12, paddingTop: 12 }}>
            <div className="flex items-baseline gap-2">
              <span style={{ fontFamily: display, fontWeight: 700, fontSize: 17, color: rumbo.color }}>
                {rumbo.verbo}
              </span>
              {tendencia.direccion !== "estable" && (
                <span style={{ fontFamily: mono, fontSize: 13, color: C.mid }}>
                  {num(Math.abs(tendencia.kgSemana))} kg por semana
                </span>
              )}
            </div>
            <p style={{ fontFamily: body, fontSize: 12.5, color: C.faint, margin: "3px 0 0", lineHeight: 1.45 }}>
              {tendencia.direccion === "estable"
                ? `El peso apenas se mueve en los últimos ${tendencia.dias} días.`
                : `A este ritmo, en ${tendencia.semanas} semanas estarías en ${num(tendencia.prevision)} kg. Calculado con ${plural(tendencia.pesajes, "pesaje")} de los últimos ${tendencia.dias} días.`}
            </p>
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
            placeholder="—"
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
                <button onClick={() => setAviso(null)} style={{ ...botonSec, flex: 1, background: C.card }}>
                  Lo corrijo
                </button>
                <button onClick={escribir} style={{ ...botonSec, flex: 1, background: C.coral, color: C.sobreAcento }}>
                  Guardar igual
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <BotonGuardar onClick={guardarPeso} disabled={!(valorKg > 0)} />
        </div>
      </Card>

      <Historial
        titulo="Historial"
        vacio="Aún no has anotado ningún peso."
        elementos={historial}
        pintar={(p) => (
          <div key={p.id} className="flex items-center gap-3" style={{ padding: 10 }}>
            <Badge Icon={Scale} color={C.teal} soft={C.tealSoft} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: C.ink, margin: 0 }}>{etiquetaFecha(p.fecha)}</p>
              {p.nota && <p style={{ fontFamily: body, fontSize: 12.5, color: C.faint, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nota}</p>}
            </div>
            <span style={{ fontFamily: mono, fontWeight: 600, fontSize: 15, color: C.ink }}>{num(p.kg)}</span>
            <Acciones que="el pesaje" onEditar={() => editar("pesos", p)} onBorrar={() => borrar("pesos", p.id)} />
          </div>
        )}
      />
    </div>
  );
}

/* -------------------------------------------------------- vista entrenos */

function VistaEntrenos({ datos, anadir, borrar, editar, onGestionarPlantillas, onUsarPlantilla }) {
  const entrenos = useMemo(
    () => [...datos.entrenos].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.ts || 0) - (a.ts || 0)),
    [datos.entrenos]
  );
  const semana = inicioSemana();
  const deSemana = entrenos.filter((e) => enRango(e.fecha, semana));
  /* Estimados cuando no están medidos: la fuerza ya no pide duración, así que
     leer `e.minutos` a pelo dejaba cada sesión de pesas en cero. */
  /* Solo lo apuntado a mano. La estimación por series se queda donde hace
     falta —el gasto de calorías del día— y no se enseña como si fuera un
     cronómetro. */
  const minutos = deSemana.reduce((s, e) => s + (Number(e.minutos) > 0 ? Number(e.minutos) : 0), 0);

  const [tipo, setTipo] = useState(null);
  const [dur, setDur] = useState(45);
  const [inten, setInten] = useState("media");
  const [km, setKm] = useState("");
  const [ejercicios, setEjercicios] = useState([]);
  const [hojaEj, setHojaEj] = useState(null);   // { indice } o { indice: null } para uno nuevo
  const [verEj, setVerEj] = useState(null);    // ficha de progresión de un ejercicio
  const [verTodoProgreso, setVerTodoProgreso] = useState(false);
  const verEjercicio = (nombre) => setVerEj(nombre);

  const progreso = useMemo(() => progresoEjercicios(datos.entrenos), [datos.entrenos]);

  const plantillas = useMemo(() => [...(datos.plantillas || [])].sort(porOrdenPlantilla), [datos.plantillas]);

  const ultimoConEjercicios = useMemo(() => ultimoEntrenoConEjercicios(entrenos, hoy()), [entrenos]);

  const limpiar = () => {
    setTipo(null); setDur(45); setInten("media"); setKm(""); setEjercicios([]);
  };

  const guardarEjercicio = (ej) => {
    setEjercicios((lista) =>
      hojaEj.indice === null ? [...lista, ej] : lista.map((x, i) => (i === hojaEj.indice ? ej : x))
    );
    setHojaEj(null);
  };

  /* Repetir la última sesión: mismos ejercicios y mismos pesos, listos para
     subirlos o dejarlos. Es lo que se hace en el gimnasio de verdad. */
  const repetirEntreno = () => {
    if (!ultimoConEjercicios) return;
    setTipo("fuerza");
    setEjercicios(ultimoConEjercicios.ejercicios.map((e) => ({ ...e, series: e.series.map((s) => ({ ...s })) })));
    if (ultimoConEjercicios.minutos) setDur(ultimoConEjercicios.minutos);
  };

  const barras = useMemo(() => {
    /* Cuántos entrenos, no cuánto rato. Los minutos de una sesión de pesas no
       los apunta nadie, así que estaban estimados, y una barra estimada tiene
       la misma pinta que una medida sin serlo. Pádel y gimnasio el mismo día
       son dos, y eso sí es un dato. */
    const base = DIAS.map((d) => ({ x: d, n: 0 }));
    for (const e of deSemana) base[(desdeIso(e.fecha).getDay() + 6) % 7].n += 1;
    return base;
  }, [deSemana]);

  const deHoy = useMemo(() => entrenos.filter((e) => e.fecha === hoy()).sort((a, b) => (a.ts || 0) - (b.ts || 0)), [entrenos]);

  /* La tarjeta de apuntar se abre a petición. Con plantillas, chips de tipo y
     el formulario desplegado ocupaba media pantalla todos los días, y la mayor
     parte de las veces solo se entra a mirar. */
  const [abrirApuntar, setAbrirApuntar] = useState(false);

  const guardarEntreno = () => {
    /* La fuerza no lleva duración: se describe con sus series. Las calorías
       del día se estiman a partir de ellas, no del rato que estuviste. */
    const registro = { fecha: hoy(), tipo, ts: Date.now() };
    if (tipo !== "fuerza") registro.minutos = dur;
    if (tipo === "fuerza" && ejercicios.length) registro.ejercicios = ejercicios;
    const dist = parseFloat(String(km).replace(",", "."));
    if (tipo === "cardio" && dist > 0) registro.km = dist;
    anadir("entrenos", registro);
    limpiar();
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
          {/* Los minutos solo cuando son de verdad: el pádel y el cardio sí se
              apuntan por tiempo, las pesas no. Si no hay ninguno medido, no se
              enseña un hueco con un número inventado dentro. */}
          {minutos > 0 && (
            <div style={{ marginLeft: "auto", marginBottom: 8, textAlign: "right" }}>
              <span style={{ fontFamily: mono, fontSize: 17, fontWeight: 600, color: C.ink }}>{minutos}</span>
              <span style={{ fontFamily: body, fontSize: 13, color: C.mid }}> min</span>
            </div>
          )}
        </div>
        <Grafica alto={120} style={{ marginTop: 10, marginLeft: -14 }}>
            <BarChart data={barras} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="x" tick={{ fontSize: 10.5, fill: C.faint, fontFamily: body }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip cursor={{ fill: "var(--velo)", fillOpacity: 0.12 }} contentStyle={{ borderRadius: 14, border: `1px solid ${C.line}`, background: C.card, color: C.ink, boxShadow: sh, fontFamily: mono, fontSize: 12 }} formatter={(v) => [v === 1 ? "1 entreno" : `${v} entrenos`, ""]} />
              <Bar dataKey="n" fill={C.indigo} radius={[8, 8, 8, 8]} maxBarSize={24} isAnimationActive={false} />
            </BarChart>
          </Grafica>
      </Card>

      <Card>
        <button onClick={() => { setAbrirApuntar((v) => !v); if (abrirApuntar) limpiar(); }}
          aria-expanded={abrirApuntar} className="flex items-center gap-2"
          style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer",
            textAlign: "left", padding: 0, marginBottom: deHoy.length ? 10 : abrirApuntar ? 12 : 0 }}>
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: 16, color: C.ink, flex: 1 }}>
            {deHoy.length ? "Añadir otro entreno de hoy" : "¿Has entrenado hoy?"}
          </span>
          {abrirApuntar
            ? <ChevronUp size={18} color={C.mid} />
            : <ChevronDown size={18} color={C.mid} />}
        </button>

        {deHoy.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6, marginBottom: 14 }}>
            {deHoy.map((e) => {
              const t = tipoDe(e.tipo);
              return (
                <div key={e.id} className="flex items-center gap-2" style={{ background: C.soft, borderRadius: 14, padding: "8px 10px" }}>
                  <t.Icon size={15} color={t.color} strokeWidth={2.4} />
                  <span style={{ fontFamily: body, fontWeight: 600, fontSize: 13.5, color: C.ink, flex: 1 }}>{t.label}</span>
                  <span style={{ fontFamily: mono, fontSize: 12.5, color: C.mid }}>
                    {Number(e.minutos) > 0
                      ? `${e.minutos}′`
                      : (resumenFuerza(e).series ? plural(resumenFuerza(e).series, "serie") : "")}
                  </span>
                  <Acciones size={13} que="el entreno" onEditar={() => editar("entrenos", e)} onBorrar={() => borrar("entrenos", e.id)} />
                </div>
              );
            })}
          </div>
        )}
        {abrirApuntar && (
          <>
          {/* Las plantillas van lo primero y ocupan sitio: son el camino corto y
              el que se usa casi siempre. Todo lo de abajo —elegir tipo, escribir
              ejercicio a ejercicio— es para el entreno que no estaba previsto. */}
          {!tipo && (
            <div style={{ marginBottom: 14 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <Rotulo>{plantillas.length ? "Mis entrenos" : "Entrenos de siempre"}</Rotulo>
                <button onClick={onGestionarPlantillas}
                  style={{ border: "none", background: "transparent", cursor: "pointer", padding: "8px 0 8px 12px",
                    minHeight: 36, fontFamily: body, fontWeight: 600, fontSize: 12, color: C.teal }}>
                  {plantillas.length ? "Gestionar" : "Crear"}
                </button>
              </div>

              {plantillas.length === 0 ? (
                <button onClick={onGestionarPlantillas} className="flex items-center gap-2"
                  style={{ width: "100%", border: "none", cursor: "pointer", textAlign: "left",
                    background: C.tealSoft, borderRadius: 16, padding: "12px 13px" }}>
                  <LayoutGrid size={16} color={C.teal} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: body, fontWeight: 600, fontSize: 13.5, color: C.ink, margin: 0 }}>
                      Guarda los entrenos que repites
                    </p>
                    <p style={{ fontFamily: body, fontSize: 11.5, color: C.mid, margin: 0 }}>
                      Móntalos una vez y luego apuntarlos es un toque
                    </p>
                  </div>
                  <ChevronRight size={16} color={C.teal} style={{ flexShrink: 0 }} />
                </button>
              ) : (
                <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                  {plantillas.map((p) => {
                    const t = tipoDe(p.tipo);
                    return (
                      <button key={p.id} onClick={() => onUsarPlantilla(p)} className="flex items-center gap-2"
                        style={{
                          border: "none", cursor: "pointer", borderRadius: 999, padding: "11px 15px",
                          minHeight: 44, background: t.soft, color: t.color,
                          fontFamily: body, fontWeight: 700, fontSize: 13.5, maxWidth: "100%",
                        }}>
                        <t.Icon size={15} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.nombre}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Repetir la última sesión, con sus pesos: el atajo de antes de que
              hubiera plantillas. Se queda solo cuando aún no hay ninguna, para
              no ofrecer dos caminos que hacen casi lo mismo. */}
          {!tipo && !plantillas.length && ultimoConEjercicios && (
            <button onClick={repetirEntreno} className="flex items-center gap-2"
              style={{
                width: "100%", marginBottom: 12, border: "none", cursor: "pointer", textAlign: "left",
                background: C.tealSoft, borderRadius: 16, padding: "11px 13px",
              }}>
              <RotateCcw size={15} color={C.teal} strokeWidth={2.6} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: body, fontWeight: 600, fontSize: 13.5, color: C.ink, margin: 0 }}>
                  Repetir el entreno de {etiquetaFecha(ultimoConEjercicios.fecha).toLowerCase()}
                </p>
                <p style={{ fontFamily: body, fontSize: 11.5, color: C.mid, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {ultimoConEjercicios.ejercicios.map((x) => x.nombre).join(", ")}
                </p>
              </div>
              <ChevronRight size={16} color={C.teal} style={{ flexShrink: 0 }} />
            </button>
          )}

          <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
            {TIPOS.map((t) => (
              <button key={t.id} onClick={() => setTipo(tipo === t.id ? null : t.id)} className="flex items-center gap-2"
                style={{
                  border: "none", cursor: "pointer", borderRadius: 999, padding: "10px 14px",
                  fontFamily: body, fontWeight: 600, fontSize: 13.5,
                  background: tipo === t.id ? t.color : t.soft, color: tipo === t.id ? C.sobreAcento : t.color,
                }}>
                <t.Icon size={15} strokeWidth={2.4} />{t.label}
              </button>
            ))}
          </div>

          {tipo && (
            <div className="rise" style={{ marginTop: 16 }}>
              {/* La fuerza se describe por lo que levantas, no por lo que dura. */}
              {tipo === "fuerza" && (
                <div style={{ marginBottom: 16 }}>
                  <Rotulo>Ejercicios</Rotulo>
                  {ejercicios.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 7, marginTop: 8 }}>
                      {ejercicios.map((ej, i) => (
                        <FilaEjercicio key={i} ejercicio={ej}
                          onEditar={() => setHojaEj({ indice: i })}
                          onBorrar={() => setEjercicios((l) => l.filter((_, j) => j !== i))} />
                      ))}
                    </div>
                  )}
                  <button onClick={() => setHojaEj({ indice: null })}
                    style={{ ...btnMini, marginTop: ejercicios.length ? 9 : 8 }}>
                    + Añadir ejercicio
                  </button>
                  {ejercicios.length > 0 && (
                    <p style={{ fontFamily: mono, fontSize: 11.5, color: C.faint, margin: "9px 0 0" }}>
                      {(() => {
                        const r = resumenFuerza({ ejercicios });
                        return textoResumenFuerza(r);
                      })()}
                    </p>
                  )}
                </div>
              )}

              {tipo === "cardio" && (
                <div style={{ marginBottom: 16 }}>
                  <Rotulo>Distancia (opcional)</Rotulo>
                  <div className="flex items-center gap-2" style={{ marginTop: 7 }}>
                    <input type="number" inputMode="decimal" step="0.1" value={km} placeholder="—"
                      onChange={(e) => setKm(e.target.value)}
                      style={{ ...inputBase, flex: 1, fontFamily: mono, fontWeight: 600 }} />
                    <span style={{ fontFamily: body, fontSize: 14, color: C.mid }}>km</span>
                  </div>
                  {parseFloat(String(km).replace(",", ".")) > 0 && dur > 0 && (
                    <p style={{ fontFamily: body, fontSize: 12, color: C.faint, margin: "7px 0 0" }}>
                      Ritmo: {(() => {
                        const d = parseFloat(String(km).replace(",", "."));
                        const min = Math.floor(dur / d);
                        const seg = Math.round((dur / d - min) * 60);
                        return `${min}:${String(seg).padStart(2, "0")} min/km`;
                      })()}
                    </p>
                  )}
                </div>
              )}

              {tipo !== "fuerza" && (
                <>
                  <Rotulo>Duración</Rotulo>
                  <div className="flex gap-2" style={{ marginTop: 7, flexWrap: "wrap" }}>
                    {DURACIONES.map((d) => <Chip key={d} activo={dur === d} onClick={() => setDur(d)}>{d}′</Chip>)}
                  </div>
                </>
              )}
              <div style={{ marginTop: 16 }}>
                <BotonGuardar onClick={guardarEntreno}>Guardar entreno</BotonGuardar>
              </div>
              <button onClick={limpiar}
                style={{ width: "100%", marginTop: 8, border: "none", background: "transparent", color: C.mid, fontFamily: body, fontWeight: 600, fontSize: 13, padding: "8px 0", cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          )}
          </>
        )}
      </Card>

      {/* La respuesta a «¿estoy progresando?» sin tener que abrir los
          ejercicios uno por uno. Arriba lo que pide atención, no lo que va
          bien: si algo lleva tres sesiones clavado, eso es lo que hay que ver
          al entrar, no el récord de hace dos meses. */}
      {progreso.length > 0 && (
        <Card>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <Rotulo>Cómo va tu fuerza</Rotulo>
            <span style={{ fontFamily: mono, fontSize: 11, color: C.faint }}>
              {plural(progreso.length, "ejercicio")}
            </span>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {(verTodoProgreso ? progreso : progreso.slice(0, 5)).map((p) => {
              const v = VEREDICTO[p.tendencia];
              return (
                <button key={p.nombre} onClick={() => verEjercicio(p.nombre)} className="flex items-center gap-2"
                  style={{ border: "none", background: C.soft, borderRadius: 14, padding: "10px 12px",
                    cursor: "pointer", textAlign: "left", width: "100%", minHeight: 44 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: body, fontWeight: 600, fontSize: 13.5, color: C.ink, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.nombre}
                    </p>
                    <p style={{ fontFamily: mono, fontSize: 11.5, color: C.faint, margin: 0 }}>
                      {p.ultima.kg != null ? `${pesoCorto(p.ultima.kg)}×${p.ultima.reps}` : `${p.ultima.reps} rep`}
                      {" · "}{plural(p.sesiones, "sesión", "sesiones")}
                    </p>
                  </div>
                  <span className="flex items-center gap-1" style={{
                    fontFamily: body, fontSize: 11, fontWeight: 700, color: v.color, flexShrink: 0,
                    background: `color-mix(in srgb, ${v.color} var(--tinte), transparent)`,
                    borderRadius: 999, padding: "3px 9px",
                  }}>
                    <v.Icon size={11} strokeWidth={2.8} />{v.label}
                  </span>
                </button>
              );
            })}
          </div>
          {progreso.length > 5 && (
            <button onClick={() => setVerTodoProgreso((v) => !v)} style={{ ...btnMini, marginTop: 10 }}>
              {verTodoProgreso ? "Ver menos" : `Ver los ${progreso.length}`}
            </button>
          )}
        </Card>
      )}

      {verEj && (
        <PantallaEjercicio nombre={verEj} entrenos={datos.entrenos} onCerrar={() => setVerEj(null)} />
      )}

      {hojaEj && (
        <HojaEjercicio
          ejercicio={hojaEj.indice === null ? null : ejercicios[hojaEj.indice]}
          entrenos={datos.entrenos}
          onGuardar={guardarEjercicio}
          onCerrar={() => setHojaEj(null)}
        />
      )}

      <Historial
        titulo="Sesiones"
        vacio="Aún no has registrado ningún entreno."
        elementos={entrenos}
        pintar={(e) => (
          <FilaSesion key={e.id} entreno={e} onVerEjercicio={verEjercicio}
            onEditar={() => editar("entrenos", e)} onBorrar={() => borrar("entrenos", e.id)} />
        )}
      />
    </div>
  );
}

/* --------------------------------------------------------- vista comidas */

function VistaComidas({ datos, anadir, borrar, editar, energia, evaluaciones, irAPerfil }) {
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

  /* Lo que sueles comer a esta hora. Repetirlo deja el formulario listo para
     guardar: dos toques en vez de seis, que es lo que se hace cinco veces al
     día. No lo guarda solo, por si hoy quieres cambiarle algo. */
  const deSiempre = useMemo(
    () => comidasFrecuentes(datos.comidas, momento),
    [datos.comidas, momento]
  );

  const repetir = (c) => {
    setTexto(c.texto);
    setVolumen(c.volumen || 3);
    setSaciedad(c.saciedad ?? null);
  };

  return (
    <div className="rejilla">
      {/* El formulario va primero a propósito: es lo que se usa cinco veces
          al día. El resumen y la diana quedan justo debajo, que se leen una. */}
      <Card>
        <p style={{ fontFamily: display, fontWeight: 700, fontSize: 16, color: C.ink, margin: "0 0 10px" }}>
          {comidasHoy.length ? `Añadir otra comida (${comidasHoy.length} hoy)` : "¿Qué has comido?"}
        </p>

        {comidasHoy.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6, marginBottom: 12 }}>
            {comidasHoy.map((c) => {
              const m = momentoDe(c.momento);
              return (
                <div key={c.id} className="flex items-center gap-2" style={{ background: C.soft, borderRadius: 14, padding: "8px 10px" }}>
                  <m.Icon size={14} color={m.color} strokeWidth={2.4} />
                  <span style={{ fontFamily: body, fontSize: 13, color: C.ink, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.texto}
                  </span>
                  <span style={{ fontFamily: body, fontSize: 11.5, color: C.faint }}>{m.label}</span>
                  <Acciones size={13} que="la comida" onEditar={() => editar("comidas", c)} onBorrar={() => borrar("comidas", c.id)} />
                </div>
              );
            })}
          </div>
        )}

        {deSiempre.length > 0 && !texto && (
          <div style={{ marginBottom: 12 }}>
            <Rotulo>Lo de siempre</Rotulo>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6, marginTop: 7 }}>
              {deSiempre.map((c) => (
                <button key={c.texto} onClick={() => repetir(c)} className="flex items-center gap-2"
                  style={{
                    border: "none", cursor: "pointer", borderRadius: 14, padding: "10px 12px",
                    background: C.tealSoft, textAlign: "left", width: "100%",
                  }}>
                  <RotateCcw size={14} color={C.teal} strokeWidth={2.6} style={{ flexShrink: 0 }} />
                  <span style={{ fontFamily: body, fontSize: 13.5, fontWeight: 600, color: C.ink, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {c.texto}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: C.teal, flexShrink: 0 }}>×{c.veces}</span>
                </button>
              ))}
            </div>
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
                background: momento === m.id ? m.color : m.soft, color: momento === m.id ? C.sobreAcento : m.color,
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
          <Grafica alto={110} style={{ marginTop: 12, marginLeft: -14 }}>
              <BarChart data={notas} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.faint, fontFamily: mono }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={26} />
                <YAxis domain={[0, 10]} hide />
                <Tooltip cursor={{ fill: "var(--velo)", fillOpacity: 0.12 }} contentStyle={{ borderRadius: 14, border: `1px solid ${C.line}`, background: C.card, color: C.ink, boxShadow: sh, fontFamily: mono, fontSize: 12 }} formatter={(v) => [`${v} / 10`, ""]} />
                <Bar dataKey="nota" fill={C.mint} radius={[8, 8, 8, 8]} maxBarSize={20} isAnimationActive={false} />
              </BarChart>
            </Grafica>
        )}
      </Card>

      {energia ? (
        <Card>
          <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
            <Rotulo>Objetivo: {energia.objetivo.label.toLowerCase()}</Rotulo>
            <span style={{ fontFamily: mono, fontSize: 11.5, color: C.mid }}>diana ~{miles(energia.diana)} kcal</span>
          </div>

          {/* De dónde sale el número. Una diana que cambia sola y no dice por
              qué no se la cree nadie. */}
          {energia.extraEntreno > 0 && (
            <p style={{ fontFamily: body, fontSize: 12, color: C.mid, margin: "-4px 0 12px", display: "flex", alignItems: "center", gap: 6 }}>
              <Dumbbell size={13} color={C.teal} />
              <span>
                {miles(energia.diana - energia.extraEntreno)} de tu perfil{" "}
                <strong style={{ color: C.teal }}>+{miles(energia.extraEntreno)} por lo que has entrenado hoy</strong>
              </span>
            </p>
          )}
          {(() => {
            const bal = calcularBalance(energia, ev && ev.kcalMin, ev && ev.kcalMax);
            if (!bal) {
              return (
                <p style={{ fontFamily: body, fontSize: 13.5, color: C.faint, lineHeight: 1.5, margin: 0 }}>
                  Anota lo que comas hoy y aquí verás si te quedas corto, en línea o por encima de tu diana.
                </p>
              );
            }
            /* Con el día a medias no se felicita ni se regaña: se informa. El
               verde de «vas bien» a mediodía es un veredicto que nadie ha
               ganado todavía. */
            const col = bal.provisional ? C.mid : bal.bueno ? C.mint : bal.estado === "encima" ? C.coral : C.amber;
            const pct = Math.max(4, Math.min(100, (bal.medio / (energia.diana * 1.4)) * 100));
            const dianaPct = Math.min(100, 100 / 1.4);
            return (
              <div className="fade">
                <div className="flex items-baseline gap-2">
                  <span style={{ fontFamily: display, fontWeight: 800, fontSize: 26, color: col, letterSpacing: -0.6 }}>
                    {bal.provisional
                      ? `Llevas ${miles(bal.medio)}`
                      : bal.estado === "linea" ? "En línea" : bal.estado === "debajo" ? "Por debajo" : "Por encima"}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 13, color: C.mid }}>
                    {bal.provisional
                      ? `de ${miles(energia.diana)}`
                      : `${bal.dif > 0 ? "+" : ""}${miles(bal.dif)} kcal`}
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
                  {bal.provisional
                    ? `Te quedan unas ${miles(Math.abs(bal.dif))} kcal de margen. El día no ha terminado: esto es lo que llevas, no cómo ha ido.`
                    : ""}
                  {!bal.provisional && energia.objetivo.id === "bajar" && bal.estado === "debajo" && "Comiendo así se baja de peso: estás por debajo de tu gasto."}
                  {!bal.provisional && energia.objetivo.id === "bajar" && bal.estado === "linea" && "Hoy mantienes: para bajar habría que quedarse algo por debajo."}
                  {!bal.provisional && energia.objetivo.id === "bajar" && bal.estado === "encima" && "Hoy has ido por encima de tu diana. Cuenta la media de la semana, no un día suelto."}
                  {!bal.provisional && energia.objetivo.id === "mantener" && bal.estado === "linea" && "Justo en tu gasto: así se mantiene el peso."}
                  {!bal.provisional && energia.objetivo.id === "mantener" && bal.estado !== "linea" && "Hoy te has salido de tu gasto habitual, pero un día no mueve la báscula."}
                  {!bal.provisional && energia.objetivo.id === "subir" && bal.estado === "encima" && "Por encima del gasto: así se sube de peso."}
                  {!bal.provisional && energia.objetivo.id === "subir" && bal.estado !== "encima" && "Para subir hace falta quedar por encima del gasto, y hoy no llegas."}
                </p>
              </div>
            );
          })()}
          <p style={{ fontFamily: body, fontSize: 11.5, color: C.faint, marginTop: 10, lineHeight: 1.45 }}>
            Gasto estimado ~{miles(energia.gasto)} kcal a partir de tu peso, altura, edad y actividad.
            {energia.ajustado && " La diana se ha subido para no bajar de un mínimo razonable."} Son estimaciones, no medidas.
          </p>
        </Card>
      ) : null}

      <Historial
        titulo="Días"
        rejilla
        vacio="Aún no has anotado ninguna comida."
        elementos={porDia}
        pintar={(d) => {
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
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 7 }}>
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
                      <Acciones size={14} que="la comida" onEditar={() => editar("comidas", c)} onBorrar={() => borrar("comidas", c.id)} />
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        }}
      />
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

            <Card className="ancho" style={{ background: C.tarjetaOscura }}>
              <p style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase", color: C.mid, margin: "0 0 6px" }}>
                Qué hacer
              </p>
              <p style={{ fontFamily: body, fontSize: 15, color: C.sobreTarjetaOscura, lineHeight: 1.5, margin: 0 }}>{informe.cierre}</p>
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
                  ["Sesiones", plural(informe.cifras.entrenos.sesiones ?? 0, "sesión", "sesiones")],
                  ...(informe.cifras.entrenos.minutos > 0
                    ? [["Minutos apuntados", `${informe.cifras.entrenos.minutos} min`]]
                    : []),
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
                Hacen falta altura, edad, sexo, actividad, objetivo y al menos un peso registrado para calcular tu gasto.
              </p>
            )}
          </div>

          {/* Una meta concreta convierte «bajar peso» en algo que se puede medir:
              sin ella no hay barra que llenar ni fecha que estimar. */}
          {p.objetivo && p.objetivo !== "mantener" && (
            <div>
              <Rotulo>¿A qué peso quieres llegar? (opcional)</Rotulo>
              <div className="flex items-center gap-2" style={{ marginTop: 7 }}>
                <input type="number" inputMode="decimal" step="0.1" value={p.meta ?? ""}
                  placeholder={pesoActual ? String(Math.round(pesoActual + (p.objetivo === "bajar" ? -5 : 4))) : "—"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setP((x) => ({
                      ...x,
                      meta: v === "" ? null : Number(v),
                      // El punto de partida se fija al ponerla, no al llegar:
                      // si no, cambiarla a mitad recolocaría la barra sola.
                      metaDesde: v === "" ? null : x.metaDesde || pesoActual || null,
                    }));
                  }}
                  style={{ ...inputBase, flex: 1, fontFamily: mono, fontWeight: 600 }} />
                <span style={{ fontFamily: body, fontSize: 14, color: C.mid }}>kg</span>
              </div>
              {p.meta > 0 && pesoActual > 0 && (
                <p style={{ fontFamily: body, fontSize: 12.5, color: C.faint, margin: "7px 0 0", lineHeight: 1.45 }}>
                  {Math.abs(pesoActual - p.meta) < 0.1
                    ? "Ya estás ahí."
                    : `${num(Math.abs(pesoActual - p.meta))} kg desde tu peso de ahora.`}
                </p>
              )}
            </div>
          )}

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
  const [tema, setTema] = useState(() => temaGuardado());
  const fileRef = useRef(null);

  /* El tema es preferencia de pantalla, no dato de la cuenta: vive en este
     dispositivo. Se guarda y se aplica a la vez para que el cambio se vea al
     instante, sin recargar. */
  const cambiarTema = (id) => {
    setTema(id);
    aplicarTema(id);
    guardarTema(id);
  };

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
          Aspecto
        </p>
        <p style={{ fontFamily: body, fontSize: 13, color: C.mid, lineHeight: 1.5, margin: "0 0 12px" }}>
          «Automático» sigue lo que tenga puesto el móvil. Se guarda en este dispositivo,
          así que puedes tener el móvil oscuro y el ordenador claro.
        </p>
        <div className="flex gap-2">
          {TEMAS_ELEGIBLES.map((t) => (
            <button key={t.id} onClick={() => cambiarTema(t.id)}
              aria-pressed={tema === t.id}
              style={{
                ...botonSec, flex: 1, minHeight: 44,
                background: tema === t.id ? C.teal : C.soft,
                color: tema === t.id ? C.sobreAcento : C.mid,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 16 }}>
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

/**
 * La misma hoja sirve para apuntar en otra fecha y para corregir algo ya
 * apuntado: los campos son idénticos, solo cambia si al guardar se crea un
 * registro nuevo o se sobrescribe el que ya existe.
 *
 * `editando` es `{ coleccion, registro }` cuando se viene de un lápiz.
 */
function HojaFecha({ abierta, seccion, editando, borrador, pesos, entrenos = [], plantillas = [], onUsarPlantilla, onCerrar, onGuardar }) {
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
  /* Corregir un entreno de fuerza enseñaba el tipo y la fecha, y nada más: los
     ejercicios viajaban escondidos de un guardado al siguiente, así que no
     había forma de cambiar un peso ni de quitar una serie desde aquí. */
  const [ejercicios, setEjercicios] = useState([]);
  const [hojaEj, setHojaEj] = useState(null);

  const seccionDe = { pesos: "peso", entrenos: "entrenos", comidas: "comidas" };

  useEffect(() => {
    if (!abierta) return;
    setAvisoPeso(null);
    setAnadidos(0);

    if (editando) {
      const r = editando.registro;
      setSec(seccionDe[editando.coleccion]);
      setFecha(r.fecha);
      setKg(r.kg != null ? String(r.kg) : "");
      setNota(r.nota || "");
      setTipo(r.tipo || "fuerza");
      setMinutos(r.minutos != null ? String(r.minutos) : "45");
      setInten(r.intensidad || "media");
      setTexto(r.texto || "");
      setVolumen(r.volumen || 3);
      setSaciedad(r.saciedad ?? null);
      setMomento(r.momento || momentoPorHora());
      setEjercicios((r.ejercicios || []).map((e) => ({ ...e, series: (e.series || []).map((x) => ({ ...x })) })));
      return;
    }

    setSec(seccion); setFecha(hoy()); setKg(""); setNota(""); setMomento(momentoPorHora());
    setTipo("fuerza"); setMinutos("45"); setInten("media"); setTexto(""); setVolumen(3); setSaciedad(null);
    setEjercicios(borrador && borrador.ejercicios ? borrador.ejercicios.map((e) => ({ ...e, series: (e.series || []).map((x) => ({ ...x })) })) : []);

    /* Lo dictado entra por aquí: se rellena la hoja y se confirma a mano. Solo
       se pisa lo que la frase dijo de verdad; el resto se queda como estaba. */
    if (borrador) {
      setSec(borrador.seccion);
      setFecha(borrador.fecha || hoy());
      if (borrador.kg != null) setKg(String(borrador.kg));
      if (borrador.nota) setNota(borrador.nota);
      if (borrador.tipo) setTipo(borrador.tipo);
      if (borrador.minutos != null) setMinutos(String(borrador.minutos));
      if (borrador.intensidad) setInten(borrador.intensidad);
      if (borrador.texto) setTexto(borrador.texto);
      if (borrador.volumen != null) setVolumen(borrador.volumen);
      if (borrador.saciedad != null) setSaciedad(borrador.saciedad);
      if (borrador.momento) setMomento(borrador.momento);
    }
  }, [abierta, seccion, editando, borrador]);

  if (!abierta) return null;

  const valido =
    (sec === "peso" && parseFloat(String(kg).replace(",", ".")) > 0) ||
    /* Un entreno de fuerza vale sin minutos: lo que lo describe son las
       series, y apuntar «el martes hice pesas» ya es un dato. */
    (sec === "entrenos" && (tipo === "fuerza" || parseInt(minutos, 10) > 0)) ||
    (sec === "comidas" && texto.trim().length > 1);

  /* Al corregir se conserva el id, así que se sobrescribe el mismo documento
     en vez de crear otro. Y el `ts`, para que no salte de sitio en la lista.
     Los kilómetros de una tirada, que esta hoja no toca, se arrastran tal cual.

     Los ejercicios NO se arrastran: son estado de la hoja y salen de ahí. Antes
     se volvían a escribir los del documento viejo, así que al corregir un
     entreno de fuerza cualquier cambio se perdía en silencio. */
  const conIdentidad = (campos) => {
    const salida = { ...campos };
    if (sec === "entrenos" && ejercicios.length) salida.ejercicios = ejercicios;

    if (!editando) {
      /* De qué plantilla salió tiene que viajar hasta el registro: es lo que
         hace que la próxima vez se traigan estos kilos y no los del día que se
         creó la plantilla. Si se pierde aquí, la plantilla deja de aprender. */
      if (borrador && borrador.plantilla) salida.plantilla = borrador.plantilla;
      if (borrador && borrador.km != null) salida.km = borrador.km;
      return salida;
    }

    const r = editando.registro;
    salida.id = r.id;
    salida.ts = r.ts ?? campos.ts;
    if (r.plantilla) salida.plantilla = r.plantilla;
    if (r.km != null) salida.km = r.km;
    return salida;
  };

  const enviar = () => {
    if (!valido) return;
    if (sec === "peso") {
      const valor = parseFloat(String(kg).replace(",", "."));
      // Al corregir, el propio pesaje no cuenta como referencia de sí mismo.
      const otros = editando ? pesos.filter((p) => p.id !== editando.registro.id) : pesos;
      const revision = revisarPeso(valor, fecha, otros);
      if (!revision.ok && !avisoPeso) {
        setAvisoPeso(revision);
        return;
      }
      onGuardar("pesos", conIdentidad({ fecha, kg: valor, nota: nota.trim() }));
      onCerrar();
      return;
    }
    if (sec === "entrenos") {
      const campos = { fecha, tipo, ts: Date.now() };
      const mins = parseInt(minutos, 10);
      if (tipo !== "fuerza" && mins > 0) campos.minutos = mins;
      onGuardar("entrenos", conIdentidad(campos));
      if (editando) return onCerrar();
      setMinutos("45");
      setEjercicios([]);
    }
    if (sec === "comidas") {
      onGuardar("comidas", conIdentidad({ fecha, texto: texto.trim(), volumen, saciedad, momento, ts: Date.now() }));
      if (editando) return onCerrar();
      setTexto(""); setVolumen(3); setSaciedad(null);
    }
    setAnadidos((n) => n + 1);
  };

  const QUE = { peso: "el peso", entrenos: "el entreno", comidas: "la comida" };

  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 80, background: C.velo, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="rise" onClick={(e) => e.stopPropagation()}
        style={{ background: C.card, width: "100%", maxWidth: 560, borderRadius: "30px 30px 0 0", padding: "18px 18px 26px", maxHeight: "88vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h3 style={{ fontFamily: display, fontWeight: 800, fontSize: 20, color: C.ink, margin: 0 }}>
            {editando ? `Corregir ${QUE[sec]}` : borrador ? "Confirma y guarda" : "Añadir en otra fecha"}
          </h3>
          <button onClick={onCerrar} style={{ ...btnBorrar, background: C.soft }} aria-label="Cerrar"><X size={18} color={C.mid} /></button>
        </div>

        {/* Al corregir no se puede cambiar de sección: un peso no se convierte
            en una comida, se borra y se apunta lo que sea. */}
        {!editando && (
          <div className="flex gap-2" style={{ marginBottom: 18 }}>
            {[
              { id: "peso", label: "Peso", Icon: Scale },
              { id: "entrenos", label: "Entreno", Icon: Dumbbell },
              { id: "comidas", label: "Comida", Icon: UtensilsCrossed },
            ].map((s) => (
              <button key={s.id} onClick={() => setSec(s.id)} className="flex items-center justify-center gap-1.5"
                style={{
                  flex: 1, border: "none", cursor: "pointer", borderRadius: 999, padding: "10px 4px",
                  background: sec === s.id ? C.teal : C.soft, color: sec === s.id ? C.sobreAcento : C.mid,
                  fontFamily: body, fontWeight: 600, fontSize: 13,
                }}>
                <s.Icon size={15} />{s.label}
              </button>
            ))}
          </div>
        )}

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

        {/*
            Las plantillas también aquí, y no solo en la pestaña.
            «Añadir un entreno» es el botón «+», así que quien entra por ahí
            se encontraba el formulario en blanco y ni se enteraba de que
            tenía sus entrenos guardados a un toque. Un atajo que solo existe
            en un sitio es un atajo que la mitad de las veces no está.
        */}
        {sec === "entrenos" && !editando && !borrador && plantillas.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <Rotulo>Usar una de las tuyas</Rotulo>
            <div className="flex gap-2" style={{ flexWrap: "wrap", marginTop: 8 }}>
              {plantillas.map((p) => {
                const t = tipoDe(p.tipo);
                return (
                  <button key={p.id} onClick={() => onUsarPlantilla(p, fecha)} className="flex items-center gap-2"
                    style={{
                      border: "none", cursor: "pointer", borderRadius: 999, padding: "11px 15px",
                      minHeight: 44, background: t.soft, color: t.color, maxWidth: "100%",
                      fontFamily: body, fontWeight: 700, fontSize: 13.5,
                    }}>
                    <t.Icon size={15} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.nombre}
                    </span>
                  </button>
                );
              })}
            </div>
            <p style={{ fontFamily: body, fontSize: 11.5, color: C.faint, margin: "9px 0 0", lineHeight: 1.45 }}>
              Se abre con tus ejercicios y los pesos de la última vez, para revisarlos antes de guardar.
              Abajo tienes el entreno suelto, si hoy hiciste otra cosa.
            </p>
            <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 16 }} />
          </div>
        )}

        {sec === "entrenos" && borrador && borrador.ejercicios && borrador.ejercicios.length > 0 && (
          <div style={{ background: C.tealSoft, borderRadius: 16, padding: "12px 14px", marginBottom: 16 }}>
            <Rotulo>Lo que he entendido</Rotulo>
            <div style={{ marginTop: 7, display: "grid", gap: 4 }}>
              {borrador.ejercicios.map((ej, i) => (
                <p key={i} style={{ fontFamily: body, fontSize: 13.5, color: C.ink, margin: 0 }}>
                  <strong>{ej.nombre}</strong>
                  {ej.series.some((s) => s.reps) && (
                    <span style={{ fontFamily: mono, color: C.mid }}>
                      {"  "}
                      {ej.series.filter((s) => s.reps || s.fallo).map((s) => textoSerie(s)).join(", ")}
                    </span>
                  )}
                </p>
              ))}
            </div>
            <p style={{ fontFamily: body, fontSize: 11.5, color: C.mid, margin: "8px 0 0", lineHeight: 1.5 }}>
              Se guardan con el entreno. Si algo no cuadra, guarda y corrígelo desde la pestaña.
            </p>
          </div>
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
                    background: tipo === t.id ? t.color : t.soft, color: tipo === t.id ? C.sobreAcento : t.color,
                  }}>
                  <t.Icon size={14} />{t.label}
                </button>
              ))}
            </div>
            {tipo !== "fuerza" && (
              <>
                <Rotulo>Duración (min)</Rotulo>
                <input type="number" inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value)}
                  style={{ ...inputBase, marginTop: 6, marginBottom: 14, fontFamily: mono, fontSize: 20, fontWeight: 600 }} />
              </>
            )}

            {/* Los ejercicios, aquí y no solo en la hoja de plantilla: corregir
                un entreno de la semana pasada es justo el momento en que se
                quiere tocar un peso mal apuntado. */}
            <div style={{ marginBottom: 14 }}>
              <Rotulo>Ejercicios</Rotulo>
              {ejercicios.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 7, marginTop: 8 }}>
                  {ejercicios.map((ej, i) => (
                    <FilaEjercicio key={i} ejercicio={ej}
                      onEditar={() => setHojaEj({ indice: i })}
                      onBorrar={() => setEjercicios((l) => l.filter((_, j) => j !== i))} />
                  ))}
                </div>
              )}
              <button onClick={() => setHojaEj({ indice: null })}
                style={{ ...btnMini, marginTop: ejercicios.length ? 9 : 8 }}>
                + Añadir ejercicio
              </button>
              {ejercicios.length > 0 && (
                <p style={{ fontFamily: mono, fontSize: 11.5, color: C.faint, margin: "9px 0 0" }}>
                  {textoResumenFuerza(resumenFuerza({ ejercicios }))}
                </p>
              )}
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
                    background: momento === m.id ? m.color : m.soft, color: momento === m.id ? C.sobreAcento : m.color,
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

        {hojaEj && (
          <HojaEjercicio
            ejercicio={hojaEj.indice === null ? null : ejercicios[hojaEj.indice]}
            entrenos={entrenos}
            onGuardar={(ej) => {
              setEjercicios((l) => (hojaEj.indice === null ? [...l, ej] : l.map((x, i) => (i === hojaEj.indice ? ej : x))));
              setHojaEj(null);
            }}
            onCerrar={() => setHojaEj(null)}
          />
        )}

        <BotonGuardar onClick={enviar} disabled={!valido}>
          {editando ? "Guardar los cambios" : sec === "peso" ? "Guardar" : anadidos > 0 ? "Guardar otro" : "Guardar"}
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

/* ------------------------------------------------- ejercicios de fuerza */

const SERIE_VACIA = { reps: 8, kg: null, repsHasta: null, unidad: null, fallo: false, enlace: null };

/**
 * Hoja para añadir o corregir un ejercicio con sus series.
 *
 * Al elegir un ejercicio que ya has hecho, se traen las series de la última
 * vez: lo normal es repetir el mismo peso o subirlo un poco, así que partir de
 * cero cada día era hacer teclear lo que ya se sabía.
 */
function HojaEjercicio({ ejercicio, entrenos, onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState(ejercicio ? ejercicio.nombre : "");
  const [series, setSeries] = useState(() =>
    ejercicio && ejercicio.series.length ? ejercicio.series.map((s) => ({ ...s })) : [{ ...SERIE_VACIA }]
  );
  const [tocado, setTocado] = useState(!!ejercicio);
  /* El rango se enseña si el ejercicio ya lo usa: quien lo puso una vez lo
     quiere ver, y a quien no lo usa no se le llena la fila de campos. */
  const [rango, setRango] = useState(() =>
    Boolean(ejercicio && (ejercicio.series || []).some((x) => x && x.repsHasta)));
  /* La unidad es del ejercicio entero, no de cada serie: nadie hace una
     plancha de 30 segundos y luego otra de 12 repeticiones. */
  const [tiempo, setTiempo] = useState(() =>
    Boolean(ejercicio && (ejercicio.series || []).some((x) => enTiempo(x))));

  const usados = useMemo(() => ejerciciosUsados(entrenos), [entrenos]);

  /* Sugerencias: primero lo tuyo, luego el catálogo, sin repetir. */
  const sugerencias = useMemo(() => {
    const escrito = nombre.trim().toLowerCase();
    const mios = usados.map((u) => u.nombre);
    const sinRepetir = (lista) => lista.filter((e) => !mios.some((m) => mismoEjercicio(m, e)));

    // Sin escribir nada: lo tuyo primero, y se completa con los habituales.
    if (!escrito) return [...mios, ...sinRepetir(EJERCICIOS_HABITUALES)].slice(0, 8);

    // Escribiendo: se busca en todo el catálogo, no solo en los habituales.
    return [...mios, ...sinRepetir(EJERCICIOS_SUGERIDOS)]
      .filter((e) => e.toLowerCase().includes(escrito))
      .slice(0, 8);
  }, [nombre, usados]);

  const elegir = (n) => {
    setNombre(n);
    const ultima = ultimaVezEjercicio(entrenos, n);
    if (ultima && ultima.series.length && !tocado) setSeries(ultima.series.map((s) => ({ ...s })));
    setTocado(true);
  };

  const cambiar = (i, campo, valor) =>
    setSeries((ss) => ss.map((s, j) => (j === i ? { ...s, [campo]: valor } : s)));

  const anadirSerie = () =>
    setSeries((ss) => [...ss, ss.length ? { ...ss[ss.length - 1], enlace: null } : { ...SERIE_VACIA }]);

  /* Un escalón de dropset: mismo ejercicio, menos peso, sin descanso. Se
     propone un 20% menos, que es lo que se baja de verdad, y se marca al
     fallo porque un dropset es eso por definición. */
  const anadirDrop = (i) =>
    setSeries((ss) => {
      const base = ss[i] || SERIE_VACIA;
      const kg = base.kg ? Math.round(Number(base.kg) * 0.8 * 2) / 2 : null;
      const nuevo = { ...base, kg, enlace: "dropset", fallo: true };
      return [...ss.slice(0, i + 1), nuevo, ...ss.slice(i + 1)];
    });

  const alternar = (i, campo) =>
    setSeries((ss) => ss.map((x, j) => (j === i ? { ...x, [campo]: !x[campo] } : x)));

  const quitarSerie = (i) => setSeries((ss) => (ss.length > 1 ? ss.filter((_, j) => j !== i) : ss));

  const limpio = series
    .map((s) => ({
      reps: parseInt(s.reps, 10) || 0,
      repsHasta: parseInt(s.repsHasta, 10) || null,
      kg: s.kg === "" || s.kg === null || s.kg === undefined ? null : Number(String(s.kg).replace(",", ".")),
      unidad: tiempo ? "seg" : null,
      fallo: Boolean(s.fallo),
      enlace: s.enlace === "dropset" ? "dropset" : null,
    }))
    /* Una serie al fallo puede no llevar repeticiones apuntadas: se hizo lo
       que salió. Esas también cuentan, así que no se filtran por `reps`. */
    .filter((s) => s.reps > 0 || s.fallo);

  const valido = nombre.trim().length > 1 && limpio.length > 0;
  const ultima = nombre.trim() ? ultimaVezEjercicio(entrenos, nombre) : null;

  const campoNum = {
    width: "100%", boxSizing: "border-box", border: "none", background: C.soft,
    borderRadius: 12, padding: "10px 8px", fontSize: 16, color: C.ink,
    fontFamily: mono, fontWeight: 600, textAlign: "center",
  };

  return (
    <Capa onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 85, background: C.velo, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="rise" onClick={(e) => e.stopPropagation()}
        style={{ background: C.card, width: "100%", maxWidth: 560, borderRadius: "30px 30px 0 0", padding: "18px 18px 26px", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h3 style={{ fontFamily: display, fontWeight: 800, fontSize: 20, color: C.ink, margin: 0 }}>
            {ejercicio ? "Corregir ejercicio" : "Añadir ejercicio"}
          </h3>
          <button onClick={onCerrar} style={{ ...btnBorrar, background: C.soft }} aria-label="Cerrar"><X size={18} color={C.mid} /></button>
        </div>

        <Rotulo>Ejercicio</Rotulo>
        <input value={nombre} autoFocus placeholder="Press banca"
          onChange={(e) => { setNombre(e.target.value); setTocado(true); }}
          style={{ ...inputBase, marginTop: 6 }} />

        {sugerencias.length > 0 && !ejercicio && (
          <div className="flex gap-2" style={{ marginTop: 9, flexWrap: "wrap" }}>
            {sugerencias.map((sug) => (
              <button key={sug} onClick={() => elegir(sug)}
                style={{
                  border: "none", cursor: "pointer", borderRadius: 999, padding: "7px 12px",
                  background: C.soft, color: C.mid, fontFamily: body, fontWeight: 600, fontSize: 12.5,
                }}>
                {sug}
              </button>
            ))}
          </div>
        )}

        {ultima && (
          <p style={{ fontFamily: body, fontSize: 12, color: C.faint, margin: "9px 0 0" }}>
            Última vez ({etiquetaFecha(ultima.fecha)}):{" "}
            {ultima.series.map((s) => textoSerie(s)).join(" · ")}
          </p>
        )}

        <div className="flex items-center justify-between gap-2" style={{ marginTop: 18, marginBottom: 8 }}>
          <Rotulo>Series</Rotulo>
          <div className="flex gap-2">
            <button onClick={() => setTiempo((v) => !v)} aria-pressed={tiempo}
              aria-label="Medir en segundos"
              style={{ ...btnMini, background: tiempo ? C.indigo : C.soft, color: tiempo ? C.sobreAcento : C.mid,
                padding: "5px 11px", fontSize: 11.5 }}>
              {tiempo ? "En segundos" : "En reps"}
            </button>
            <button onClick={() => setRango((v) => !v)} aria-pressed={rango}
              aria-label="Usar rango"
              style={{ ...btnMini, background: rango ? C.teal : C.soft, color: rango ? C.sobreAcento : C.mid,
                padding: "5px 11px", fontSize: 11.5 }}>
              {rango ? "Fijo" : "Rango"}
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 7 }}>
          <div className="flex items-center gap-2" style={{ padding: "0 4px" }}>
            <span style={{ width: 18 }} />
            <span style={{ flex: rango ? 2 : 1, fontFamily: body, fontSize: 11, color: C.faint, textAlign: "center" }}>
              {tiempo
                ? (rango ? "Segundos (de – a)" : "Segundos")
                : (rango ? "Reps (de – a)" : "Reps")}
            </span>
            <span style={{ flex: 1, fontFamily: body, fontSize: 11, color: C.faint, textAlign: "center" }}>Kg</span>
            <span style={{ width: 74 }} />
            <span style={{ width: 26 }} />
          </div>

          {series.map((s, i) => {
            const enlazada = s.enlace === "dropset";
            return (
              <div key={i} style={{ paddingLeft: enlazada ? 16 : 0 }}>
                <div className="flex items-center gap-2">
                  <span style={{ width: 18, fontFamily: mono, fontSize: 12, color: enlazada ? C.amber : C.faint, textAlign: "center" }}>
                    {enlazada ? "↳" : i + 1 - series.slice(0, i).filter((x) => x.enlace === "dropset").length}
                  </span>

                  <div className="flex items-center gap-1" style={{ flex: rango ? 2 : 1 }}>
                    <input type="number" inputMode="numeric" value={s.reps ?? ""}
                      aria-label={`${tiempo ? "Segundos" : "Repeticiones"} de la serie ${i + 1}`}
                      onChange={(e) => cambiar(i, "reps", e.target.value)} style={{ ...campoNum, flex: 1 }} />
                    {rango && (
                      <>
                        <span style={{ fontFamily: mono, fontSize: 13, color: C.faint }}>–</span>
                        <input type="number" inputMode="numeric" value={s.repsHasta ?? ""} placeholder="—"
                          aria-label={`${tiempo ? "Segundos máximos" : "Repeticiones máximas"} de la serie ${i + 1}`}
                          onChange={(e) => cambiar(i, "repsHasta", e.target.value)} style={{ ...campoNum, flex: 1 }} />
                      </>
                    )}
                  </div>

                  <input type="number" inputMode="decimal" step="0.5" value={s.kg ?? ""} placeholder="—"
                    aria-label={`Kilos de la serie ${i + 1}`}
                    onChange={(e) => cambiar(i, "kg", e.target.value)} style={{ ...campoNum, flex: 1 }} />

                  <button onClick={() => alternar(i, "fallo")} aria-pressed={Boolean(s.fallo)}
                    aria-label={`Al fallo en la serie ${i + 1}`}
                    style={{
                      width: 74, minHeight: 40, borderRadius: 12, border: "none", cursor: "pointer",
                      fontFamily: body, fontWeight: 700, fontSize: 11.5, flexShrink: 0,
                      background: s.fallo ? C.coral : C.soft, color: s.fallo ? C.sobreAcento : C.mid,
                    }}>
                    Al fallo
                  </button>

                  <button onClick={() => quitarSerie(i)} style={{ ...btnBorrar, width: 26, minWidth: 26, padding: 4 }}
                    aria-label={`Quitar la serie ${i + 1}`} disabled={series.length === 1}>
                    <X size={14} color={series.length === 1 ? C.line : C.faint} />
                  </button>
                </div>

              </div>
            );
          })}
        </div>

        {/* Los dos botones en la misma línea, y el escalón cuelga de la última
            serie. Uno por fila costaba 26 px cada uno y hacía que la hoja
            dejara de verse entera en cuanto pasabas de cinco series, que es lo
            normal. Un dropset es la continuación de la serie que acabas de
            hacer, así que la última es la que toca. */}
        <div className="flex gap-2" style={{ marginTop: 12, flexWrap: "wrap" }}>
          <button onClick={anadirSerie} style={btnMini}>+ Añadir serie</button>
          <button onClick={() => anadirDrop(series.length - 1)}
            style={{ ...btnMini, background: C.amberSoft, color: C.amber }}>
            + Bajar peso y seguir
          </button>
        </div>

        <p style={{ fontFamily: body, fontSize: 11.5, color: C.faint, margin: "10px 0 0", lineHeight: 1.45 }}>
          Kilos vacíos = peso corporal. «Bajar peso y seguir» engancha un escalón de dropset a la última serie.
        </p>

        <div style={{ marginTop: 16 }}>
          <BotonGuardar onClick={() => valido && onGuardar({ nombre: nombre.trim(), series: limpio })} disabled={!valido}>
            {ejercicio ? "Guardar los cambios" : "Añadir al entreno"}
          </BotonGuardar>
        </div>
      </div>
    </Capa>
  );
}

/* ------------------------------------------------------------- plantillas */

/**
 * Hoja que sale al tocar una plantilla: el entreno ya montado, para confirmar.
 *
 * Viene con los ejercicios de la plantilla y con los kilos de la última vez
 * que se hizo. Ese es todo el truco: lo normal es repetir lo mismo o subir un
 * poco, así que lo que hay que teclear son dos números, no la sesión entera.
 */
function HojaPlantilla({ plantilla, plantillas, entrenos, fechaInicial, onGuardar, onCerrar }) {
  const ultimo = useMemo(() => ultimaDePlantilla(entrenos, plantilla.id), [entrenos, plantilla.id]);
  const base = useMemo(
    () => entrenoDesdePlantilla(plantilla, fechaInicial || hoy(), ultimo),
    [plantilla, fechaInicial, ultimo]
  );

  const [fecha, setFecha] = useState(base.fecha);
  const [ejercicios, setEjercicios] = useState(() => base.ejercicios.map((e) => ({ ...e, series: e.series.map((s) => ({ ...s })) })));
  const [minutos, setMinutos] = useState(base.minutos != null ? String(base.minutos) : "");
  const [inten, setInten] = useState(base.intensidad || "media");
  const [km, setKm] = useState(base.km != null ? String(base.km) : "");
  const [hojaEj, setHojaEj] = useState(null);
  const [pegando, setPegando] = useState(false);

  /* Las demás plantillas de fuerza, para poder engancharlas a este entreno.
     Solo las de fuerza: pegarle un partido de pádel a una sesión de pesas no
     quiere decir nada, y no traen ejercicios que copiar. */
  const otrasPlantillas = useMemo(
    () => (plantillas || []).filter((p) => p && p.id !== plantilla.id && p.tipo === "fuerza" && (p.ejercicios || []).length),
    [plantillas, plantilla.id]
  );

  /**
   * Engancha los ejercicios de otra plantilla a este entreno.
   *
   * Cada uno viene con los kilos de la última vez que se hizo ESA plantilla,
   * igual que si la hubieras abierto sola, así que la progresión no se pierde
   * por juntarlas. Lo que ya está no se repite: si los abdominales ya estaban
   * en la lista, engancharlos otra vez no los duplica.
   */
  const sumarPlantilla = (otra) => {
    const suyo = entrenoDesdePlantilla(otra, fecha, ultimaDePlantilla(entrenos, otra.id));
    setEjercicios((lista) => {
      const nuevos = (suyo.ejercicios || []).filter(
        (ej) => !lista.some((x) => mismoEjercicio(x.nombre, ej.nombre))
      );
      return [...lista, ...nuevos.map((e) => ({ ...e, series: e.series.map((s) => ({ ...s })) }))];
    });
    setPegando(false);
  };

  const t = tipoDe(plantilla.tipo);
  const esFuerza = plantilla.tipo === "fuerza";
  const mins = parseInt(minutos, 10);
  const valido = esFuerza ? ejercicios.length > 0 || mins > 0 : mins > 0;

  /* Con qué se compara cada ejercicio: lo que moviste la última vez que
     hiciste ESTA plantilla. La hoja se abre con esos mismos números, así que
     al principio no hay diferencia que enseñar; aparece en cuanto tocas algo,
     que es justo el momento en que quieres saber cuánto has subido. */
  const seriesPrevias = useCallback(
    (nombre) => {
      const ej = ((ultimo && ultimo.ejercicios) || []).find((x) => x && mismoEjercicio(x.nombre, nombre));
      return ej && ej.series && ej.series.length ? ej.series : null;
    },
    [ultimo]
  );

  const guardarEjercicio = (ej) => {
    setEjercicios((lista) => (hojaEj.indice === null ? [...lista, ej] : lista.map((x, i) => (i === hojaEj.indice ? ej : x))));
    setHojaEj(null);
  };

  const enviar = () => {
    if (!valido) return;
    const registro = { fecha, tipo: plantilla.tipo, plantilla: plantilla.id, ts: Date.now() };
    if (!esFuerza && mins > 0) registro.minutos = mins;
    if (ejercicios.length) registro.ejercicios = ejercicios;
    const dist = parseFloat(String(km).replace(",", "."));
    if (!esFuerza && dist > 0) registro.km = dist;
    onGuardar("entrenos", registro);
    onCerrar();
  };

  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 80, background: C.velo, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="rise" onClick={(e) => e.stopPropagation()}
        style={{ background: C.card, width: "100%", maxWidth: 560, borderRadius: "30px 30px 0 0", padding: "18px 18px 26px", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
          <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
            <t.Icon size={19} color={t.color} strokeWidth={2.5} style={{ flexShrink: 0 }} />
            <h3 style={{ fontFamily: display, fontWeight: 800, fontSize: 20, color: C.ink, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {plantilla.nombre}
            </h3>
          </div>
          <button onClick={onCerrar} style={{ ...btnBorrar, background: C.soft }} aria-label="Cerrar"><X size={18} color={C.mid} /></button>
        </div>
        <p style={{ fontFamily: body, fontSize: 12.5, color: C.faint, margin: "0 0 16px" }}>
          {ultimo
            ? `La última vez fue ${etiquetaFecha(ultimo.fecha).toLowerCase()}. Los pesos son los de ese día.`
            : "Primera vez con esta plantilla."}
        </p>

        {esFuerza && (
          <div style={{ marginBottom: 16 }}>
            <Rotulo>Ejercicios</Rotulo>
            {ejercicios.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 7, marginTop: 8 }}>
                {ejercicios.map((ej, i) => (
                  <FilaEjercicio key={i} ejercicio={ej} anterior={seriesPrevias(ej.nombre)}
                    onEditar={() => setHojaEj({ indice: i })}
                    onBorrar={() => setEjercicios((l) => l.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}
            <div className="flex gap-2" style={{ marginTop: ejercicios.length ? 9 : 8, flexWrap: "wrap" }}>
              <button onClick={() => setHojaEj({ indice: null })} style={btnMini}>
                + Añadir ejercicio
              </button>
              {otrasPlantillas.length > 0 && (
                <button onClick={() => setPegando((v) => !v)}
                  style={{ ...btnMini, background: pegando ? C.indigo : C.soft, color: pegando ? C.sobreAcento : C.mid }}>
                  + Otra plantilla
                </button>
              )}
            </div>

            {/* Una rutina corta —los abdominales, la movilidad— se guarda en su
                propia plantilla y se engancha al entreno del día en vez de
                duplicarla dentro de las cuatro plantillas grandes. */}
            {pegando && otrasPlantillas.length > 0 && (
              <div className="flex gap-2" style={{ marginTop: 9, flexWrap: "wrap" }}>
                {otrasPlantillas.map((p) => (
                  <button key={p.id} onClick={() => sumarPlantilla(p)}
                    style={{
                      border: "none", cursor: "pointer", borderRadius: 999, padding: "7px 12px",
                      background: C.soft, color: C.mid, fontFamily: body, fontWeight: 600, fontSize: 12.5,
                    }}>
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}

            {ejercicios.length > 0 && (
              <p style={{ fontFamily: mono, fontSize: 11.5, color: C.faint, margin: "9px 0 0" }}>
                {textoResumenFuerza(resumenFuerza({ ejercicios }))}
              </p>
            )}
          </div>
        )}

        {!esFuerza && (
          <div style={{ marginBottom: 16 }}>
            <Rotulo>Distancia (opcional)</Rotulo>
            <div className="flex items-center gap-2" style={{ marginTop: 7 }}>
              <input type="number" inputMode="decimal" step="0.1" value={km} placeholder="—"
                onChange={(e) => setKm(e.target.value)}
                style={{ ...inputBase, flex: 1, fontFamily: mono, fontWeight: 600 }} />
              <span style={{ fontFamily: body, fontSize: 14, color: C.mid }}>km</span>
            </div>

            {/* Un día de pádel puede llevar core detrás. El hueco está, pero no
                ocupa hasta que se usa: una plantilla que no es de pesas no
                tiene por qué enseñar una lista de ejercicios vacía. */}
            {ejercicios.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 7, marginTop: 14 }}>
                {ejercicios.map((ej, i) => (
                  <FilaEjercicio key={i} ejercicio={ej} anterior={seriesPrevias(ej.nombre)}
                    onEditar={() => setHojaEj({ indice: i })}
                    onBorrar={() => setEjercicios((l) => l.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}
            <button onClick={() => setHojaEj({ indice: null })} style={{ ...btnMini, marginTop: ejercicios.length ? 9 : 12 }}>
              {ejercicios.length ? "+ Añadir otro ejercicio" : "+ ¿Hiciste algo más?"}
            </button>
          </div>
        )}

        {/* En un entreno de fuerza la duración y la intensidad sobran: lo que
            describe la sesión son las series, y el rato que estuviste allí no
            dice nada. Se siguen pidiendo donde son el único dato —un partido,
            una tirada—, y las calorías del día se estiman de las series. */}
        {!esFuerza && (
          <>
            <Rotulo>Duración</Rotulo>
            <div className="flex gap-2" style={{ marginTop: 7, marginBottom: 14, flexWrap: "wrap" }}>
              {DURACIONES.map((d) => (
                <Chip key={d} activo={mins === d} onClick={() => setMinutos(String(d))}>{d}′</Chip>
              ))}
            </div>
          </>
        )}

        <Rotulo>Fecha</Rotulo>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
          style={{ ...inputBase, marginTop: 6, marginBottom: 16, fontFamily: mono, fontSize: 15 }} />

        <BotonGuardar onClick={enviar} disabled={!valido}>Guardar entreno</BotonGuardar>

        {hojaEj && (
          <HojaEjercicio
            ejercicio={hojaEj.indice === null ? null : ejercicios[hojaEj.indice]}
            entrenos={entrenos}
            onGuardar={guardarEjercicio}
            onCerrar={() => setHojaEj(null)}
          />
        )}
      </div>
    </div>
  );
}

/** Crear o corregir una plantilla. Es la hoja del entreno sin la fecha. */
function HojaPlantillaEditar({ plantilla, entrenos, orden, onGuardar, onCerrar }) {
  /* Una plantilla recién sacada de un entreno llega con todos los campos pero
     sin id: es nueva, aunque venga rellena. Lo que decide es el id. */
  const esCorreccion = Boolean(plantilla && plantilla.id);
  const [nombre, setNombre] = useState(plantilla ? plantilla.nombre : "");
  const [tipo, setTipo] = useState(plantilla ? plantilla.tipo : "fuerza");
  const [minutos, setMinutos] = useState(plantilla && plantilla.minutos != null ? String(plantilla.minutos) : "45");
  const [inten, setInten] = useState(plantilla ? plantilla.intensidad : "media");
  const [km, setKm] = useState(plantilla && plantilla.km != null ? String(plantilla.km) : "");
  const [ejercicios, setEjercicios] = useState(() =>
    plantilla ? (plantilla.ejercicios || []).map((e) => ({ ...e, series: (e.series || []).map((s) => ({ ...s })) })) : []
  );
  const [hojaEj, setHojaEj] = useState(null);

  const esFuerza = tipo === "fuerza";
  const valido = nombre.trim().length > 1;

  const guardarEjercicio = (ej) => {
    setEjercicios((lista) => (hojaEj.indice === null ? [...lista, ej] : lista.map((x, i) => (i === hojaEj.indice ? ej : x))));
    setHojaEj(null);
  };

  const enviar = () => {
    if (!valido) return;
    const mins = parseInt(minutos, 10);
    const dist = parseFloat(String(km).replace(",", "."));
    const salida = {
      nombre: nombre.trim(), tipo, intensidad: inten,
      /* Sin el `!esFuerza` se guardaba el 45 por defecto del formulario aunque
         el campo ni siquiera estuviera en pantalla. */
      minutos: !esFuerza && mins > 0 ? mins : null,
      km: !esFuerza && dist > 0 ? dist : null,
      ejercicios: esFuerza ? ejercicios : [],
      orden: plantilla && plantilla.orden != null ? plantilla.orden : orden,
    };
    if (plantilla && plantilla.id) salida.id = plantilla.id;
    onGuardar(salida);
    onCerrar();
  };

  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 82, background: C.velo, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="rise" onClick={(e) => e.stopPropagation()}
        style={{ background: C.card, width: "100%", maxWidth: 560, borderRadius: "30px 30px 0 0", padding: "18px 18px 26px", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <h3 style={{ fontFamily: display, fontWeight: 800, fontSize: 20, color: C.ink, margin: 0 }}>
            {esCorreccion ? "Corregir plantilla" : "Nueva plantilla"}
          </h3>
          <button onClick={onCerrar} style={{ ...btnBorrar, background: C.soft }} aria-label="Cerrar"><X size={18} color={C.mid} /></button>
        </div>

        <Rotulo>Nombre</Rotulo>
        <input value={nombre} autoFocus placeholder="Empuje, Pádel, Pliometría…"
          onChange={(e) => setNombre(e.target.value)} maxLength={60}
          style={{ ...inputBase, marginTop: 6, marginBottom: 16 }} />

        <Rotulo>Tipo</Rotulo>
        <div className="flex gap-2" style={{ marginTop: 7, marginBottom: 16, flexWrap: "wrap" }}>
          {TIPOS.map((x) => (
            <button key={x.id} onClick={() => setTipo(x.id)} className="flex items-center gap-2"
              style={{
                border: "none", cursor: "pointer", borderRadius: 999, padding: "10px 14px",
                fontFamily: body, fontWeight: 600, fontSize: 13.5,
                background: tipo === x.id ? x.color : x.soft, color: tipo === x.id ? C.sobreAcento : x.color,
              }}>
              <x.Icon size={15} strokeWidth={2.4} />{x.label}
            </button>
          ))}
        </div>

        {esFuerza && (
          <div style={{ marginBottom: 16 }}>
            <Rotulo>Ejercicios</Rotulo>
            {ejercicios.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 7, marginTop: 8 }}>
                {ejercicios.map((ej, i) => (
                  <FilaEjercicio key={i} ejercicio={ej}
                    onEditar={() => setHojaEj({ indice: i })}
                    onBorrar={() => setEjercicios((l) => l.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}
            <button onClick={() => setHojaEj({ indice: null })} style={{ ...btnMini, marginTop: ejercicios.length ? 9 : 8 }}>
              + Añadir ejercicio
            </button>
            <p style={{ fontFamily: body, fontSize: 11.5, color: C.faint, margin: "9px 0 0", lineHeight: 1.45 }}>
              Los pesos que pongas aquí son solo el punto de partida: cada vez que uses la plantilla se rellenará con los de la última sesión.
            </p>
          </div>
        )}

        {!esFuerza && (
          <div style={{ marginBottom: 16 }}>
            <Rotulo>Distancia habitual (opcional)</Rotulo>
            <div className="flex items-center gap-2" style={{ marginTop: 7 }}>
              <input type="number" inputMode="decimal" step="0.1" value={km} placeholder="—"
                onChange={(e) => setKm(e.target.value)}
                style={{ ...inputBase, flex: 1, fontFamily: mono, fontWeight: 600 }} />
              <span style={{ fontFamily: body, fontSize: 14, color: C.mid }}>km</span>
            </div>
          </div>
        )}

        {!esFuerza && (
          <>
            <Rotulo>Duración habitual</Rotulo>
            <div className="flex gap-2" style={{ marginTop: 7, marginBottom: 18, flexWrap: "wrap" }}>
              {DURACIONES.map((d) => (
                <Chip key={d} activo={parseInt(minutos, 10) === d} onClick={() => setMinutos(String(d))}>{d}′</Chip>
              ))}
            </div>
          </>
        )}

        <BotonGuardar onClick={enviar} disabled={!valido}>
          {esCorreccion ? "Guardar los cambios" : "Crear plantilla"}
        </BotonGuardar>

        {hojaEj && (
          <HojaEjercicio
            ejercicio={hojaEj.indice === null ? null : ejercicios[hojaEj.indice]}
            entrenos={entrenos}
            onGuardar={guardarEjercicio}
            onCerrar={() => setHojaEj(null)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Pegar varias plantillas de una vez, copiadas de un Word o de un Excel.
 *
 * Enseña lo entendido antes de guardar nada. El formato tiene reglas que se
 * pueden equivocar —cuándo un número son kilos y cuándo series— y la manera
 * honesta de convivir con eso es que se vea antes de escribir en la cuenta.
 */
function HojaPegarPlantillas({ desde, onGuardar, onCerrar }) {
  const [texto, setTexto] = useState("");
  const { plantillas, avisos } = useMemo(() => interpretarPlantillas(texto), [texto]);

  const enviar = () => {
    if (!plantillas.length) return;
    plantillas.forEach((p, i) => onGuardar({ ...p, orden: desde + i }));
    onCerrar();
  };

  return (
    <div onClick={onCerrar} style={{ position: "fixed", inset: 0, zIndex: 82, background: C.velo, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="rise" onClick={(e) => e.stopPropagation()}
        style={{ background: C.card, width: "100%", maxWidth: 560, borderRadius: "30px 30px 0 0", padding: "18px 18px 26px", maxHeight: "92vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
          <h3 style={{ fontFamily: display, fontWeight: 800, fontSize: 20, color: C.ink, margin: 0 }}>Pegar varias</h3>
          <button onClick={onCerrar} style={{ ...btnBorrar, background: C.soft }} aria-label="Cerrar"><X size={18} color={C.mid} /></button>
        </div>
        <p style={{ fontFamily: body, fontSize: 12.5, color: C.mid, margin: "0 0 12px", lineHeight: 1.5 }}>
          Copia tus entrenos de donde los tengas y pégalos aquí. Una línea sin series es el nombre
          de una plantilla; una línea con series es un ejercicio.
        </p>

        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} autoFocus
          placeholder={EJEMPLO_PEGADO}
          style={{ ...inputBase, fontFamily: mono, fontSize: 13, lineHeight: 1.6, resize: "vertical", minHeight: 150 }} />

        <div className="flex gap-2" style={{ marginTop: 9, flexWrap: "wrap" }}>
          <button onClick={() => setTexto(EJEMPLO_PEGADO)} style={btnMini}>Rellenar con el ejemplo</button>
          {texto && <button onClick={() => setTexto("")} style={{ ...btnMini, background: C.soft, color: C.mid }}>Vaciar</button>}
        </div>

        <div style={{ background: C.soft, borderRadius: 16, padding: "12px 14px", marginTop: 14 }}>
          <Rotulo>Cómo se leen los números</Rotulo>
          <div style={{ display: "grid", gap: 3, marginTop: 7 }}>
            {[
              ["80x8", "una serie de 80 kg × 8 repes"],
              ["3x12", "tres series de 12, sin peso"],
              ["3x10 @40", "tres series de 10 con 40 kg"],
              ["- Plancha", "un ejercicio sin series"],
            ].map(([a, b]) => (
              <p key={a} style={{ fontFamily: body, fontSize: 12, color: C.mid, margin: 0 }}>
                <span style={{ fontFamily: mono, fontWeight: 600, color: C.ink }}>{a}</span> — {b}
              </p>
            ))}
          </div>
        </div>

        {avisos.length > 0 && (
          <div style={{ background: C.amberSoft, borderRadius: 16, padding: "12px 14px", marginTop: 12 }}>
            {avisos.map((a, i) => (
              <p key={i} style={{ fontFamily: body, fontSize: 12.5, color: C.ink, margin: i ? "5px 0 0" : 0, lineHeight: 1.5 }}>{a}</p>
            ))}
          </div>
        )}

        {plantillas.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Rotulo>Lo que he entendido</Rotulo>
            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
              {plantillas.map((p, i) => {
                const t = tipoDe(p.tipo);
                return (
                  <div key={i} style={{ background: C.soft, borderRadius: 16, padding: "11px 13px" }}>
                    <div className="flex items-center gap-2">
                      <t.Icon size={14} color={t.color} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                      <span style={{ fontFamily: body, fontWeight: 700, fontSize: 14, color: C.ink, flex: 1, minWidth: 0 }}>{p.nombre}</span>
                      <span style={{ fontFamily: mono, fontSize: 11, color: C.faint }}>{resumenPlantilla(p) || t.label}</span>
                    </div>
                    {p.ejercicios.length > 0 && (
                      <div style={{ display: "grid", gap: 2, marginTop: 7 }}>
                        {p.ejercicios.map((ej, k) => (
                          <p key={k} style={{ fontFamily: body, fontSize: 12.5, color: C.mid, margin: 0 }}>
                            {ej.nombre}
                            <span style={{ fontFamily: mono, color: C.faint }}>
                              {"  "}
                              {ej.series.filter((s) => s.reps || s.fallo).map((s) => textoSerie(s)).join(" · ") || "sin series"}
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <BotonGuardar onClick={enviar} disabled={!plantillas.length}>
            {plantillas.length
              ? `Guardar ${plural(plantillas.length, "plantilla")}`
              : "Pega algo para empezar"}
          </BotonGuardar>
        </div>
      </div>
    </div>
  );
}

/** La pantalla donde se montan y se ordenan las plantillas. */
function PantallaPlantillas({ plantillas, entrenos, onGuardar, onBorrar, onCerrar }) {
  const [editando, setEditando] = useState(null);   // { plantilla } o { plantilla: null }
  const [pegando, setPegando] = useState(false);
  const [desdeEntreno, setDesdeEntreno] = useState(false);

  useEffect(() => {
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  const lista = useMemo(() => [...plantillas].sort(porOrdenPlantilla), [plantillas]);

  /* Subir y bajar en vez de arrastrar: en un móvil el arrastre pelea con el
     desplazamiento de la página y acaba moviendo lo que no toca. */
  const mover = (i, salto) => {
    const j = i + salto;
    if (j < 0 || j >= lista.length) return;
    onGuardar({ ...lista[i], orden: j });
    onGuardar({ ...lista[j], orden: i });
  };

  /* Entrenos ya hechos que valen como plantilla: los que tienen ejercicios, y
     uno por sesión distinta, del más reciente al más viejo. */
  const candidatos = useMemo(
    () => [...entrenos]
      .filter((e) => (e.ejercicios || []).length > 0)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.ts || 0) - (a.ts || 0))
      .slice(0, 12),
    [entrenos]
  );

  return (
    <div className="fade pantallaCompleta" style={{ position: "fixed", inset: 0, zIndex: 76, background: C.bg, overflowY: "auto" }}>
      <div className="contenedor" style={{ padding: "22px 16px 48px", maxWidth: 620 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
          <div>
            <Rotulo>Entrenos</Rotulo>
            <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 27, color: C.ink, letterSpacing: -0.6, margin: 0 }}>
              Mis plantillas
            </h2>
          </div>
          <button onClick={onCerrar} style={{ ...btnBorrar, background: C.card, padding: 10, borderRadius: 14, boxShadow: sh }} aria-label="Cerrar">
            <X size={19} color={C.mid} />
          </button>
        </div>

        <Card style={{ marginBottom: 14, background: C.tealSoft, boxShadow: "none" }}>
          <p style={{ fontFamily: body, fontSize: 13, color: C.ink, margin: 0, lineHeight: 1.55 }}>
            Una plantilla es un entreno que repites: los mismos ejercicios, el mismo partido, la misma sesión.
            Se monta una vez y luego apuntarlo es tocarla y confirmar. Los pesos se traen solos de la última vez.
          </p>
        </Card>

        {lista.length === 0 && <Vacio texto="Todavía no tienes ninguna plantilla." />}

        {lista.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {lista.map((p, i) => {
              const t = tipoDe(p.tipo);
              const ultimo = ultimaDePlantilla(entrenos, p.id);
              return (
                <Card key={p.id} style={{ padding: 12 }}>
                  <div className="flex items-center gap-3">
                    <Badge Icon={t.Icon} color={t.color} soft={t.soft} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: body, fontWeight: 700, fontSize: 14.5, color: C.ink, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {p.nombre}
                      </p>
                      <p style={{ fontFamily: body, fontSize: 12, color: C.faint, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {[resumenPlantilla(p) || t.label, ultimo ? `última vez ${etiquetaFecha(ultimo.fecha).toLowerCase()}` : null]
                          .filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex flex-col" style={{ gap: 2 }}>
                      <button onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir ${p.nombre}`}
                        style={{ ...btnBorrar, padding: 2, opacity: i === 0 ? 0.25 : 1 }}>
                        <ChevronUp size={15} color={C.mid} />
                      </button>
                      <button onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label={`Bajar ${p.nombre}`}
                        style={{ ...btnBorrar, padding: 2, opacity: i === lista.length - 1 ? 0.25 : 1 }}>
                        <ChevronDown size={15} color={C.mid} />
                      </button>
                    </div>
                    <Acciones que="la plantilla"
                      onEditar={() => setEditando({ plantilla: p })}
                      onBorrar={() => onBorrar("plantillas", p.id)} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <div style={{ display: "grid", gap: 8 }}>
          <button onClick={() => setEditando({ plantilla: null })} style={{ ...botonSec, background: C.teal, color: C.sobreAcento, padding: "14px 10px" }}>
            <Plus size={17} strokeWidth={2.6} /> Nueva plantilla
          </button>
          {candidatos.length > 0 && (
            <button onClick={() => setDesdeEntreno(true)} style={botonSec}>
              <RotateCcw size={16} /> Desde un entreno que ya hice
            </button>
          )}
          <button onClick={() => setPegando(true)} style={botonSec}>
            <Upload size={16} /> Pegar varias de golpe
          </button>
        </div>

        {desdeEntreno && (
          <div onClick={() => setDesdeEntreno(false)} style={{ position: "fixed", inset: 0, zIndex: 82, background: C.velo, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div className="rise" onClick={(e) => e.stopPropagation()}
              style={{ background: C.card, width: "100%", maxWidth: 560, borderRadius: "30px 30px 0 0", padding: "18px 18px 26px", maxHeight: "85vh", overflowY: "auto" }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
                <h3 style={{ fontFamily: display, fontWeight: 800, fontSize: 20, color: C.ink, margin: 0 }}>¿Cuál de ellos?</h3>
                <button onClick={() => setDesdeEntreno(false)} style={{ ...btnBorrar, background: C.soft }} aria-label="Cerrar"><X size={18} color={C.mid} /></button>
              </div>
              <div style={{ display: "grid", gap: 7 }}>
                {candidatos.map((e) => (
                  <button key={e.id} className="flex items-center gap-3"
                    onClick={() => {
                      setDesdeEntreno(false);
                      setEditando({ plantilla: { ...plantillaDesdeEntreno(e, ""), id: null } });
                    }}
                    style={{ border: "none", background: C.soft, borderRadius: 16, padding: "11px 13px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: body, fontWeight: 600, fontSize: 13.5, color: C.ink, margin: 0 }}>
                        {etiquetaFecha(e.fecha)}
                      </p>
                      <p style={{ fontFamily: body, fontSize: 12, color: C.mid, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {e.ejercicios.map((x) => x.nombre).join(", ")}
                      </p>
                    </div>
                    <ChevronRight size={16} color={C.faint} style={{ flexShrink: 0 }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {editando && (
          <HojaPlantillaEditar
            plantilla={editando.plantilla}
            entrenos={entrenos}
            orden={lista.length}
            onGuardar={(p) => onGuardar(p)}
            onCerrar={() => setEditando(null)}
          />
        )}

        {pegando && (
          <HojaPegarPlantillas desde={lista.length} onGuardar={onGuardar} onCerrar={() => setPegando(false)} />
        )}
      </div>
    </div>
  );
}

/**
 * Ficha de un ejercicio: si estás progresando o llevas meses en el mismo sitio.
 *
 * El eje es el máximo estimado a una repetición, no los kilos de la barra:
 * 80×8 vale más que 90×5 y a ojo no se ve. Así una serie de más repeticiones
 * con menos peso no parece un retroceso cuando no lo es.
 */
function PantallaEjercicio({ nombre, entrenos, onCerrar }) {
  const historia = useMemo(() => progresionEjercicio(entrenos, nombre), [entrenos, nombre]);
  const record = useMemo(() => recordEjercicio(entrenos, nombre), [entrenos, nombre]);
  const diferencias = useMemo(() => diferenciasEjercicio(entrenos, nombre), [entrenos, nombre]);
  /* La primera sesión no tiene diferencia: se queda fuera de la gráfica en vez
     de pintarse como un cero, que se leería como «no progresaste». */
  const barrasDif = useMemo(
    () => diferencias.filter((d) => d.delta !== null).map((d) => ({ x: fechaCorta(d.fecha), dif: d.delta })),
    [diferencias]
  );

  useEffect(() => {
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  const serie = historia.filter((h) => h.mejor).map((h) => ({ x: fechaCorta(h.fecha), kg: h.mejor.estimado }));
  const primero = serie.length ? serie[0].kg : null;
  const ultimo = serie.length ? serie[serie.length - 1].kg : null;
  const avance = primero !== null && serie.length > 1 ? Number((ultimo - primero).toFixed(1)) : null;

  return (
    <div className="fade" style={{ position: "fixed", inset: 0, zIndex: 78, background: C.bg, overflowY: "auto" }}>
      <div className="contenedor" style={{ padding: "22px 16px 48px", maxWidth: 560 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
          <div style={{ minWidth: 0 }}>
            <Rotulo>Ejercicio</Rotulo>
            <h2 style={{ fontFamily: display, fontWeight: 800, fontSize: 25, color: C.ink, letterSpacing: -0.6, margin: 0 }}>
              {nombre}
            </h2>
          </div>
          <button onClick={onCerrar} style={{ ...btnBorrar, background: C.card, padding: 10, borderRadius: 14, boxShadow: sh, marginLeft: 10 }} aria-label="Cerrar">
            <X size={19} color={C.mid} />
          </button>
        </div>

        {record && (
          <Card style={{ background: `linear-gradient(155deg, ${C.tealSoft} 0%, ${C.card} 60%)`, padding: 20, marginBottom: 14 }}>
            <div className="flex items-center justify-between">
              <Rotulo>Tu mejor serie</Rotulo>
              {record.esElUltimo && (
                <span style={{ fontFamily: body, fontSize: 11, fontWeight: 600, color: C.mint, background: C.card, borderRadius: 999, padding: "3px 10px" }}>
                  Récord reciente
                </span>
              )}
            </div>
            <div className="flex items-end gap-2" style={{ marginTop: 4 }}>
              <span style={{ fontFamily: display, fontWeight: 800, fontSize: 42, lineHeight: 1, color: C.ink, letterSpacing: -1.2 }}>
                {record.serie.kg ? pesoCorto(record.serie.kg) : record.serie.reps}
              </span>
              <span style={{ fontFamily: body, fontSize: 15, color: C.mid, marginBottom: 5 }}>
                {record.serie.kg ? `kg × ${record.serie.reps}` : "repeticiones"}
              </span>
            </div>
            <p style={{ fontFamily: body, fontSize: 12.5, color: C.mid, margin: "8px 0 0" }}>
              {etiquetaFecha(record.fecha)} · equivale a un máximo de ~{num(record.serie.estimado)} kg
            </p>
          </Card>
        )}

        <Card>
          <Rotulo>Progresión</Rotulo>
          {serie.length > 1 ? (
            <>
              <Grafica alto={170} style={{ marginTop: 10, marginLeft: -10 }}>
                  <LineChart data={serie} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                    <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.faint, fontFamily: mono }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={26} />
                    {/* Redondeado a mano: con `allowDecimals` no basta si el dominio se da
                        como expresión, y un «107,5» no cabe en el ancho del eje. */}
                    <YAxis domain={["dataMin - 3", "dataMax + 3"]} tickFormatter={(v) => Math.round(v)}
                      tick={{ fontSize: 10, fill: C.faint, fontFamily: mono }} tickLine={false} axisLine={false} width={38} />
                    <Tooltip contentStyle={{ borderRadius: 14, border: `1px solid ${C.line}`, background: C.card, color: C.ink, boxShadow: sh, fontFamily: mono, fontSize: 12 }} formatter={(v) => [`~${num(v)} kg`, "máximo estimado"]} />
                    <Line type="monotone" dataKey="kg" isAnimationActive={false} stroke={C.teal} strokeWidth={3} dot={{ r: 3, fill: C.teal, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </Grafica>
              {avance !== null && (
                <p style={{ fontFamily: body, fontSize: 13.5, color: C.mid, margin: "8px 0 0", lineHeight: 1.5 }}>
                  {Math.abs(avance) < 1
                    ? `Llevas ${plural(historia.length, "sesión", "sesiones")} y el máximo estimado apenas se mueve. Toca subir peso o repeticiones.`
                    : `${avance > 0 ? "+" : "−"}${num(Math.abs(avance))} kg de máximo estimado en ${plural(historia.length, "sesión", "sesiones")}.`}
                </p>
              )}
            </>
          ) : (
            <Vacio texto="Con una sola sesión no hay progresión que enseñar. Vuelve a hacerlo y aquí verás la evolución." />
          )}
        </Card>

        {/* La gráfica de arriba dice DÓNDE estás; esta dice CUÁNTO has movido
            cada día. Restar «80, 80, 82,5, 85» de cabeza para saber si progresas
            es trabajo que puede hacer la pantalla. */}
        {diferencias.length > 1 && (
          <Card style={{ marginTop: 14 }}>
            <Rotulo>Diferencia entre sesiones</Rotulo>
            <Grafica alto={150} style={{ marginTop: 10, marginLeft: -10 }}>
              <BarChart data={barrasDif} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                <XAxis dataKey="x" tick={{ fontSize: 10, fill: C.faint, fontFamily: mono }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={26} />
                <YAxis tickFormatter={(v) => (v > 0 ? `+${Math.round(v)}` : Math.round(v))}
                  tick={{ fontSize: 10, fill: C.faint, fontFamily: mono }} tickLine={false} axisLine={false} width={38} />
                <Tooltip cursor={{ fill: "var(--velo)", fillOpacity: 0.12 }}
                  contentStyle={{ borderRadius: 14, border: `1px solid ${C.line}`, background: C.card, color: C.ink, boxShadow: sh, fontFamily: mono, fontSize: 12 }}
                  formatter={(v) => [`${v > 0 ? "+" : ""}${num(v)} kg`, "respecto a la anterior"]} />
                <Bar dataKey="dif" radius={[6, 6, 6, 6]} maxBarSize={26} isAnimationActive={false}>
                  {barrasDif.map((b, i) => (
                    <Cell key={i} fill={b.dif > 0 ? C.mint : b.dif < 0 ? C.coral : C.line} />
                  ))}
                </Bar>
              </BarChart>
            </Grafica>
            <p style={{ fontFamily: body, fontSize: 12.5, color: C.faint, margin: "8px 0 0", lineHeight: 1.5 }}>
              Sobre el máximo estimado, no sobre los kilos de la barra: bajar peso subiendo
              repeticiones cuenta como subida, que es lo que es.
            </p>
          </Card>
        )}

        <div style={{ marginTop: 14 }}>
          <div style={{ padding: "2px 4px 8px" }}><Rotulo>Sesiones</Rotulo></div>
          <Card style={{ padding: 8 }}>
            {[...diferencias].reverse().map((h) => (
              <div key={h.fecha} className="flex items-center gap-3" style={{ padding: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: body, fontWeight: 600, fontSize: 13.5, color: C.ink, margin: 0 }}>{etiquetaFecha(h.fecha)}</p>
                  {h.volumen > 0 && (
                    <p style={{ fontFamily: mono, fontSize: 11.5, color: C.faint, margin: 0 }}>{miles(h.volumen)} kg movidos</p>
                  )}
                </div>
                {h.delta !== null && h.delta !== 0 && (
                  <span style={{
                    fontFamily: mono, fontSize: 11, fontWeight: 700, flexShrink: 0,
                    color: h.delta > 0 ? C.mint : C.coral,
                    background: `color-mix(in srgb, ${h.delta > 0 ? C.mint : C.coral} var(--tinte), transparent)`,
                    borderRadius: 999, padding: "2px 7px",
                  }}>
                    {h.delta > 0 ? "+" : "−"}{num(Math.abs(h.delta))}
                  </span>
                )}
                <span style={{ fontFamily: mono, fontWeight: 600, fontSize: 13, color: C.ink }}>
                  {h.kg != null ? `${pesoCorto(h.kg)}×${h.reps}` : `${h.reps} rep`}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Una línea por ejercicio dentro del entreno que se está montando. */
/**
 * Cuánto ha cambiado esto respecto a la última vez.
 *
 * Se compara por 1RM estimado, no por los kilos de la barra: bajar el peso
 * subiendo repeticiones es progreso y pintarlo en rojo sería mentir.
 */
function Delta({ actual, anterior }) {
  const a = mejorSerie(actual);
  const b = mejorSerie(anterior);
  if (!a || !b) return null;

  const dif = Number((a.estimado - b.estimado).toFixed(1));
  const kg = a.kg != null && b.kg != null ? Number((a.kg - b.kg).toFixed(1)) : null;
  if (dif === 0) {
    return (
      <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: C.faint, flexShrink: 0 }}>
        =
      </span>
    );
  }
  const color = dif > 0 ? C.mint : C.coral;
  return (
    <span title={`Antes: ${b.kg != null ? `${pesoCorto(b.kg)}×${b.reps}` : `${b.reps} rep`}`}
      className="flex items-center gap-1"
      style={{
        fontFamily: mono, fontSize: 11, fontWeight: 700, color, flexShrink: 0,
        background: `color-mix(in srgb, ${color} var(--tinte), transparent)`,
        borderRadius: 999, padding: "2px 7px",
      }}>
      {dif > 0 ? <TrendingUp size={11} strokeWidth={2.8} /> : <TrendingDown size={11} strokeWidth={2.8} />}
      {kg ? `${kg > 0 ? "+" : ""}${pesoCorto(kg)}` : `${dif > 0 ? "+" : ""}${num(dif)}`}
    </span>
  );
}

/**
 * Una sesión del historial, plegada.
 *
 * Cuatro entrenos de la semana con seis ejercicios cada uno son veinticuatro
 * líneas de números antes de llegar a nada: la pestaña se leía como un volcado.
 * Cerrada dice qué fue y cuánto; abierta, ejercicio por ejercicio.
 */
function FilaSesion({ entreno: e, onVerEjercicio, onEditar, onBorrar }) {
  const [abierto, setAbierto] = useState(false);
  const t = tipoDe(e.tipo);
  const i = INTENS.find((x) => x.id === e.intensidad);
  const r = resumenFuerza(e);
  const ejercicios = e.ejercicios || [];
  /* Corto a propósito: la fila comparte ancho con el desplegable y los dos
     botones de acción, y una lista larga se cortaba en «Hoy · 1 ejercicio ·…».
     Las series ya dicen el tamaño de la sesión; el número de ejercicios sale
     al abrirla. */
  const detalle = [
    etiquetaFecha(e.fecha),
    Number(e.minutos) > 0 ? `${e.minutos} min` : null,
    e.km ? `${num(e.km)} km` : null,
    r.series ? plural(r.series, "serie") : null,
    r.volumen ? `${miles(r.volumen)} kg` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div style={{ padding: 10 }}>
      <div className="flex items-center gap-3">
        <Badge Icon={t.Icon} color={t.color} soft={t.soft} />
        <button onClick={() => ejercicios.length && setAbierto((v) => !v)}
          aria-expanded={ejercicios.length ? abierto : undefined}
          style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", textAlign: "left",
            padding: 0, cursor: ejercicios.length ? "pointer" : "default" }}>
          <p style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: C.ink, margin: 0 }}>{t.label}</p>
          <p style={{ fontFamily: body, fontSize: 12.5, color: C.faint, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {detalle}
          </p>
        </button>
        {i && (
          <span style={{ fontFamily: body, fontSize: 11, fontWeight: 600, color: i.color, background: `color-mix(in srgb, ${i.color} var(--tinte), transparent)`, borderRadius: 999, padding: "3px 9px" }}>
            {i.label}
          </span>
        )}
        {ejercicios.length > 0 && (
          <button onClick={() => setAbierto((v) => !v)} style={{ ...btnBorrar, minWidth: 34 }}
            aria-label={abierto ? "Cerrar los ejercicios" : "Ver los ejercicios"}>
            {abierto ? <ChevronUp size={16} color={C.faint} /> : <ChevronDown size={16} color={C.faint} />}
          </button>
        )}
        <Acciones que="el entreno" onEditar={onEditar} onBorrar={onBorrar} />
      </div>

      {/* Los ejercicios, a un toque de su ficha de progresión. */}
      {abierto && ejercicios.length > 0 && (
        <div className="fade" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 4, marginTop: 8, paddingLeft: 46 }}>
          {ejercicios.map((ej, k) => (
            <button key={k} onClick={() => onVerEjercicio(ej.nombre)} className="flex items-center gap-2"
              style={{ border: "none", background: "transparent", cursor: "pointer", textAlign: "left",
                padding: "6px 0", minHeight: 34, width: "100%" }}>
              <span style={{ fontFamily: body, fontSize: 12.5, color: C.mid, flexShrink: 0 }}>{ej.nombre}</span>
              <span style={{ fontFamily: mono, fontSize: 11.5, color: C.faint, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {(ej.series || []).map((x) => textoSerie(x)).join(" · ")}
              </span>
              <ChevronRight size={13} color={C.line} style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilaEjercicio({ ejercicio, onEditar, onBorrar, anterior }) {
  return (
    <div className="flex items-center gap-2" style={{ background: C.soft, borderRadius: 14, padding: "10px 12px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: body, fontWeight: 600, fontSize: 13.5, color: C.ink, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {ejercicio.nombre}
        </p>
        <p style={{ fontFamily: mono, fontSize: 11.5, color: C.mid, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {/* El escalón de dropset se pega a la serie de la que cuelga; entre
              series distintas va el punto de siempre. */}
          {ejercicio.series.map((s, i) =>
            `${i === 0 ? "" : esEnlazada(s) ? " " : " · "}${esEnlazada(s) ? "↳ " : ""}${textoSerie(s)}`).join("")}
        </p>
      </div>
      {anterior && <Delta actual={ejercicio.series} anterior={anterior} />}
      <Acciones size={13} que="el ejercicio" onEditar={onEditar} onBorrar={onBorrar} />
    </div>
  );
}

/* ------------------------------------------------------- primera vez */

/**
 * Tres preguntas al entrar por primera vez.
 *
 * Antes se aterrizaba en un formulario vacío con dos avisos naranjas y sin
 * saber por dónde empezar. El orden va de lo fácil a lo tedioso, y el tercer
 * paso termina enseñando la diana de calorías: ese número es el momento en el
 * que se entiende para qué sirve todo esto.
 *
 * Se puede saltar en cualquier momento; lo que se haya rellenado se guarda.
 */
function Bienvenida({ onTerminar, onSaltar }) {
  const [paso, setPaso] = useState(0);
  const [kg, setKg] = useState("");
  const [p, setP] = useState(PERFIL_VACIO);
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));

  const valorKg = parseFloat(String(kg).replace(",", "."));
  const diana = useMemo(() => calcularEnergia(p, valorKg), [p, valorKg]);

  const PASOS = [
    { rotulo: "1 de 3", titulo: "¿Cuánto pesas ahora?", puede: valorKg > 20 && valorKg < 400 },
    { rotulo: "2 de 3", titulo: "¿Qué quieres conseguir?", puede: !!p.objetivo },
    { rotulo: "3 de 3", titulo: "Un par de datos más", puede: p.altura && p.edad && p.sexo && p.actividad },
  ];
  const actual = PASOS[paso];

  const siguiente = () => {
    if (!actual.puede) return;
    if (paso < 2) return setPaso(paso + 1);
    onTerminar({ perfil: p, kg: valorKg });
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: body }}>
      <style>{CSS + CSS_VOZ}</style>
      <div className="contenedor" style={{ padding: "26px 16px 40px", maxWidth: 520 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 22 }}>
          <Rotulo>{actual.rotulo}</Rotulo>
          <button onClick={onSaltar}
            style={{ background: "none", border: "none", color: C.faint, fontFamily: body, fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 6 }}>
            Ahora no
          </button>
        </div>

        <h1 style={{ fontFamily: display, fontWeight: 800, fontSize: 28, color: C.ink, letterSpacing: -0.8, margin: "0 0 6px", lineHeight: 1.15 }}>
          {actual.titulo}
        </h1>
        <p style={{ fontFamily: body, fontSize: 14, color: C.mid, lineHeight: 1.5, margin: "0 0 22px" }}>
          {paso === 0 && "Es el punto de partida. Podrás corregirlo cuando quieras."}
          {paso === 1 && "Con esto sé si tienes que comer por encima o por debajo de tu gasto."}
          {paso === 2 && "Sirven para calcular cuánta energía gastas al día."}
        </p>

        <Card style={{ display: "grid", gap: 16 }}>
          {paso === 0 && (
            <div className="flex items-center gap-3">
              <button onClick={() => setKg((k) => String(Math.round(((parseFloat(k) || 70) - 0.1) * 10) / 10))} style={stepper}>−</button>
              <input type="number" inputMode="decimal" step="0.1" value={kg} autoFocus placeholder="—"
                onChange={(e) => setKg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && siguiente()}
                style={{ ...inputBase, textAlign: "center", fontFamily: mono, fontSize: 30, fontWeight: 600, padding: "12px 4px" }} />
              <button onClick={() => setKg((k) => String(Math.round(((parseFloat(k) || 70) + 0.1) * 10) / 10))} style={stepper}>+</button>
            </div>
          )}

          {paso === 1 && (
            <div style={{ display: "grid", gap: 8 }}>
              {OBJETIVOS.map((o) => {
                const act = p.objetivo === o.id;
                return (
                  <button key={o.id} onClick={() => set("objetivo", o.id)}
                    style={{ textAlign: "left", border: "none", cursor: "pointer", borderRadius: 16, padding: "14px 16px", background: act ? C.tealSoft : C.soft }}>
                    <span style={{ fontFamily: display, fontWeight: 700, fontSize: 16, color: act ? C.teal : C.ink }}>{o.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {paso === 2 && (
            <>
              <div className="flex gap-3">
                <label style={{ flex: 1 }}>
                  <Rotulo>Altura (cm)</Rotulo>
                  <input type="number" inputMode="numeric" value={p.altura} autoFocus placeholder="178"
                    onChange={(e) => set("altura", e.target.value)}
                    style={{ ...inputBase, marginTop: 6, fontFamily: mono, fontWeight: 600 }} />
                </label>
                <label style={{ flex: 1 }}>
                  <Rotulo>Edad</Rotulo>
                  <input type="number" inputMode="numeric" value={p.edad} placeholder="34"
                    onChange={(e) => set("edad", e.target.value)}
                    style={{ ...inputBase, marginTop: 6, fontFamily: mono, fontWeight: 600 }} />
                </label>
              </div>
              <div>
                <Rotulo>Sexo</Rotulo>
                <div className="flex gap-2" style={{ marginTop: 7, flexWrap: "wrap" }}>
                  {SEXOS.map((x) => <Chip key={x.id} activo={p.sexo === x.id} onClick={() => set("sexo", x.id)}>{x.label}</Chip>)}
                </div>
              </div>
              <div>
                <Rotulo>Actividad diaria</Rotulo>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 7, marginTop: 7 }}>
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
            </>
          )}
        </Card>

        {/* El premio: el número que hace que todo lo anterior tenga sentido. */}
        {paso === 2 && diana && (
          <Card className="fade" style={{ marginTop: 12, background: C.tealSoft, boxShadow: "none" }}>
            <Rotulo>Tu diana</Rotulo>
            <div className="flex items-end gap-2" style={{ marginTop: 2 }}>
              <span style={{ fontFamily: display, fontWeight: 800, fontSize: 34, color: C.teal, lineHeight: 1, letterSpacing: -1 }}>
                {miles(diana.diana)}
              </span>
              <span style={{ fontFamily: body, fontSize: 14, color: C.mid, marginBottom: 4 }}>kcal al día</span>
            </div>
            <p style={{ fontFamily: body, fontSize: 12.5, color: C.mid, margin: "6px 0 0", lineHeight: 1.45 }}>
              Gastas unas {miles(diana.gasto)} kcal al día.{" "}
              {diana.objetivo.id === "mantener"
                ? "Comiendo esa misma cifra te mantienes."
                : `Quedándote en la de arriba vas ${diana.objetivo.id === "bajar" ? "perdiendo" : "ganando"} peso poco a poco.`}
            </p>
          </Card>
        )}

        <div style={{ marginTop: 18 }}>
          <BotonGuardar onClick={siguiente} disabled={!actual.puede}>
            {paso < 2 ? "Seguir" : "Empezar"}
          </BotonGuardar>
        </div>

        {paso > 0 && (
          <button onClick={() => setPaso(paso - 1)}
            style={{ width: "100%", marginTop: 10, border: "none", background: "transparent", color: C.mid, fontFamily: body, fontWeight: 600, fontSize: 13.5, padding: "10px 0", cursor: "pointer" }}>
            Atrás
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
  /* Se filtra aquí, en la única puerta por la que entran los datos: todo lo de
     abajo ordena y agrupa por fecha, y un registro sin ella no daría un número
     raro, dejaría la pantalla en blanco. No debería llegar ninguno —las reglas
     la exigen—, pero eso no es motivo para no ponerse a cubierto. */
  const datos = useMemo(
    () => ({
      perfil: { ...PERFIL_VACIO, ...(usuario.perfil || {}) },
      pesos: pesosSanos(registros.pesos),
      entrenos: saneaEntrenos(registros.entrenos),
      comidas: conFecha(registros.comidas),
      plantillas: plantillasSanas(registros.plantillas),
    }),
    [usuario.perfil, registros.pesos, registros.entrenos, registros.comidas, registros.plantillas]
  );

  const [tab, setTab] = useState("peso");
  const [hoja, setHoja] = useState(false);
  const [editando, setEditando] = useState(null); // { coleccion, registro }
  const [dictado, setDictado] = useState(null);   // borrador salido de una frase
  const [pantalla, setPantalla] = useState(null);
  const [usando, setUsando] = useState(null);     // { plantilla, fecha } en confirmación

  const plantillasOrdenadas = useMemo(
    () => [...datos.plantillas].sort(porOrdenPlantilla),
    [datos.plantillas]
  );

  const ultimoPeso = useMemo(() => {
    const p = [...datos.pesos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    return p.length ? p[p.length - 1].kg : null;
  }, [datos.pesos]);

  const energia = useMemo(() => calcularEnergia(datos.perfil, ultimoPeso), [datos.perfil, ultimoPeso]);

  /* Las valoraciones ya no se guardan: se calculan al vuelo cada vez que
     cambian las comidas o el perfil. Instantáneo y siempre coherente. */
  /* La diana de cada día lleva sumado lo que quemaste entrenando ESE día: un
     día de pesas y un día de sofá no piden lo mismo de comer. */
  const entrenosPorDia = useMemo(() => {
    const m = {};
    for (const e of datos.entrenos) (m[e.fecha] = m[e.fecha] || []).push(e);
    return m;
  }, [datos.entrenos]);

  const energiaDe = useCallback(
    (fecha) => energiaDelDia(energia, entrenosPorDia[fecha] || [], ultimoPeso, datos.perfil),
    [energia, entrenosPorDia, ultimoPeso, datos.perfil]
  );

  const energiaHoy = useMemo(() => energiaDe(hoy()), [energiaDe]);

  const evaluaciones = useMemo(() => {
    const porDia = {};
    for (const c of datos.comidas) (porDia[c.fecha] = porDia[c.fecha] || []).push(c);
    const salida = {};
    for (const [fecha, lista] of Object.entries(porDia)) {
      salida[fecha] = valorarDia(lista.sort((a, b) => (a.ts || 0) - (b.ts || 0)), energiaDe(fecha));
    }
    return salida;
  }, [datos.comidas, energiaDe]);

  /* Apuntar algo es escribirlo en Firestore. La lista de la pantalla no se
     toca a mano: se repinta sola cuando Firestore devuelve el cambio. */
  const anadir = useCallback((coleccion, item) => { guardar(coleccion, item); }, [guardar]);

  /* Corregir es abrir la misma hoja con los campos ya puestos. Como el
     registro conserva su id, se sobrescribe en vez de duplicarse. */
  const editar = useCallback((coleccion, registro) => {
    setEditando({ coleccion, registro });
    setHoja(true);
  }, []);

  const cerrarHoja = useCallback(() => { setHoja(false); setEditando(null); setDictado(null); }, []);

  const restaurar = useCallback(
    (archivo) => importar(archivo).then(({ porColeccion, campos }) => importarDatos(porColeccion, campos)),
    [importarDatos]
  );

  const laRacha = useMemo(() => racha(datos), [datos]);
  const sinApuntar = useMemo(() => calcularAusencia(datos), [datos]);

  /* Cuenta recién estrenada: sin perfil y sin un solo registro de ningún tipo.
     No basta con mirar los pesajes: quien solo hubiera apuntado comidas se
     volvería a encontrar la bienvenida delante. Se pregunta una vez y queda
     constancia, para no dar la brasa ni a quien la salta. */
  const primeraVez =
    listo &&
    !usuario.bienvenida &&
    !datos.perfil.altura &&
    !datos.pesos.length && !datos.entrenos.length && !datos.comidas.length;

  const cerrarBienvenida = useCallback(
    (datosIniciales) => {
      if (datosIniciales) {
        guardarUsuario({ perfil: datosIniciales.perfil, bienvenida: Date.now() });
        guardar("pesos", { fecha: hoy(), kg: datosIniciales.kg, nota: "" });
      } else {
        guardarUsuario({ bienvenida: Date.now() });
      }
    },
    [guardarUsuario, guardar]
  );

  /* Valorar una semana con un día suelto no dice nada, y el botón ocupa media
     pantalla. Aparece cuando hay tres días con algo apuntado. */
  const hayQueValorar = useMemo(() => {
    const dias = new Set();
    for (const l of [datos.pesos, datos.entrenos, datos.comidas]) for (const r of l) dias.add(r.fecha);
    return dias.size >= 3;
  }, [datos]);

  const TABS = [
    { id: "peso", label: "Peso", Icon: Scale },
    { id: "entrenos", label: "Entrenos", Icon: Dumbbell },
    { id: "comidas", label: "Comidas", Icon: UtensilsCrossed },
  ];

  const sinPerfil = !datos.perfil.altura;

  /* Va después de todos los hooks a propósito: se ejecutan igual, solo cambia
     lo que se dibuja. */
  if (primeraVez) {
    return <Bienvenida onTerminar={cerrarBienvenida} onSaltar={() => cerrarBienvenida(null)} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: body }}>
      <style>{CSS + CSS_VOZ}</style>

      <header className="contenedor" style={{ padding: "20px 16px 6px" }}>
        <div className="flex items-center justify-between">
          <div style={{ minWidth: 0 }}>
            <div className="flex items-center gap-2">
              <Rotulo>{etiquetaFecha(hoy())}</Rotulo>
              {laRacha.dias >= 2 && (
                <span
                  title={laRacha.hoy ? "Días seguidos apuntando" : "Apunta hoy para no perderla"}
                  className="flex items-center gap-1"
                  style={{
                    fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: 0,
                    color: laRacha.hoy ? C.amber : C.faint,
                    background: laRacha.hoy ? C.amberSoft : C.soft,
                    borderRadius: 999, padding: "2px 8px", flexShrink: 0,
                  }}
                >
                  <Flame size={11} strokeWidth={2.6} /> {laRacha.dias}
                </span>
              )}
            </div>
            <h1 style={{ fontFamily: display, fontWeight: 800, fontSize: 29, color: C.ink, lineHeight: 1.1, letterSpacing: -0.7, margin: 0 }}>
              {TABS.find((t) => t.id === tab).label}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* El micrófono vive aquí y no flotando abajo: como botón flotante
                se montaba encima del formulario y tapaba el «+» del peso y
                media palabra de «Guardar». */}
            <button onClick={() => setPantalla("dictado")} aria-label="Apuntar hablando"
              style={{ border: "none", background: C.card, borderRadius: 16, padding: 11, cursor: "pointer", boxShadow: sh }}>
              <Mic size={19} color={C.teal} strokeWidth={2.3} />
            </button>
            <PastillaSync estado={estado} paleta={PALETA_CUENTA} onAbrir={() => setPantalla("cuenta")} />
            <button onClick={() => setPantalla("perfil")} aria-label="Perfil"
              style={{ border: "none", background: C.card, borderRadius: 16, padding: 11, cursor: "pointer", boxShadow: sh }}>
              <User size={19} color={C.mid} />
            </button>
          </div>
        </div>
      </header>

      {/* El hueco de abajo tiene que dejar pasar el botón flotante: con 128 px la
          última fila de botones se quedaba debajo de él y no había forma de
          tocarla sin seguir bajando. */}
      <main className="contenedor" style={{ padding: "10px 16px 176px" }}>
        {!listo && !error && <Vacio texto="Cargando tus datos…" />}

        {/* Días sin apuntar. Va arriba del todo y con lo que llevabas antes de
            dejarlo: sin eso el aviso es un reproche, y con eso es un dato. */}
        {listo && sinApuntar && (
          <Card style={{ marginBottom: 14, background: C.amberSoft, boxShadow: "none",
            display: "flex", alignItems: "center", gap: 12 }}>
            <Badge Icon={CalendarDays} color={C.amber} soft={C.card} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: display, fontWeight: 700, fontSize: 15, color: C.ink, margin: 0 }}>
                {sinApuntar.dias} días sin apuntar nada
              </p>
              <p style={{ fontFamily: body, fontSize: 12.5, color: C.mid, margin: 0 }}>
                {sinApuntar.rachaPerdida
                  ? `Llevabas ${sinApuntar.rachaPerdida} días seguidos. Se retoma hoy.`
                  : "Lo de hoy todavía se puede apuntar."}
              </p>
            </div>
          </Card>
        )}

        {error && (
          <Card style={{ marginBottom: 14, background: C.coralSoft, boxShadow: "none" }}>
            <p style={{ fontFamily: body, fontSize: 13, color: C.ink, margin: 0 }}>{error}</p>
          </Card>
        )}

        {listo && sinPerfil && (
          <Card onClick={() => setPantalla("perfil")} className="flex items-center gap-3"
            style={{ marginBottom: 14, cursor: "pointer", background: C.amberSoft, boxShadow: "none" }}>
            <Badge Icon={User} color={C.amber} soft={C.card} />
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: body, fontWeight: 600, fontSize: 14, color: C.ink, margin: 0 }}>Completa tu perfil</p>
              <p style={{ fontFamily: body, fontSize: 12.5, color: C.mid, margin: 0 }}>Altura, edad y actividad afinan la valoración</p>
            </div>
            <ChevronRight size={18} color={C.amber} />
          </Card>
        )}

        {listo && tab === "peso" && <VistaPeso datos={datos} anadir={anadir} borrar={borrar} editar={editar} />}
        {listo && tab === "entrenos" && (
          <VistaEntrenos datos={datos} anadir={anadir} borrar={borrar} editar={editar}
            onGestionarPlantillas={() => setPantalla("plantillas")}
            onUsarPlantilla={(p) => setUsando({ plantilla: p, fecha: hoy() })} />
        )}
        {listo && tab === "comidas" && (
          <VistaComidas datos={datos} anadir={anadir} borrar={borrar} editar={editar} energia={energiaHoy}
            evaluaciones={evaluaciones} irAPerfil={() => setPantalla("perfil")} />
        )}

        {listo && hayQueValorar && (
          <button onClick={() => setPantalla("valoracion")} className="flex items-center gap-3"
            style={{
              width: "100%", marginTop: 16, border: "none", cursor: "pointer", textAlign: "left",
              borderRadius: 26, padding: 18, background: C.tarjetaOscura, boxShadow: sh,
            }}>
            <div style={{ width: 38, height: 38, borderRadius: 14, background: "color-mix(in srgb, var(--sobreTarjetaOscura) 14%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={19} color={C.mint} strokeWidth={2.3} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: display, fontWeight: 700, fontSize: 16, color: C.sobreTarjetaOscura, margin: 0 }}>Valorar mi semana o mes</p>
              <p style={{ fontFamily: body, fontSize: 12.5, color: C.mid, margin: 0 }}>Peso, entrenos y comidas juntos</p>
            </div>
            <ChevronRight size={19} color={C.mid} />
          </button>
        )}
      </main>

      <button onClick={() => { setEditando(null); setDictado(null); setHoja(true); }} aria-label="Añadir en otra fecha" className="botonFlotante"
        style={{
          position: "fixed", right: 20, bottom: 94, zIndex: 50, width: 56, height: 56, borderRadius: 20,
          border: "none", background: C.teal, color: C.sobreAcento, cursor: "pointer",
          boxShadow: "var(--brilloAcento)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
        <Plus size={25} strokeWidth={2.7} />
      </button>

      <nav className="barraInferior"
        style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 45,
          background: C.barra, backdropFilter: "blur(14px)",
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

      <HojaFecha abierta={hoja} seccion={tab} editando={editando} borrador={dictado} pesos={datos.pesos}
        entrenos={datos.entrenos}
        plantillas={plantillasOrdenadas}
        onUsarPlantilla={(p, fecha) => { cerrarHoja(); setUsando({ plantilla: p, fecha }); }}
        onCerrar={cerrarHoja} onGuardar={anadir} />

      {/* La hoja de plantilla vive aquí y no dentro de la pestaña: se llega a
          ella desde los dos sitios —los botones de Entrenos y el «+»— y tener
          dos copias sería tener dos comportamientos. */}
      {usando && (
        <HojaPlantilla
          plantilla={usando.plantilla}
          plantillas={plantillasOrdenadas}
          fechaInicial={usando.fecha}
          entrenos={datos.entrenos}
          onGuardar={anadir}
          onCerrar={() => setUsando(null)}
        />
      )}


      {pantalla === "dictado" && (
        <HojaDictado
          paleta={PALETA_CUENTA}
          titulo="Apunta hablando"
          ejemplos={EJEMPLOS_SALUD}
          onTexto={(frase) => {
            const r = interpretarSalud(frase, datos);
            setPantalla(null);
            setEditando(null);
            setDictado(r);
            setHoja(true);
          }}
          onCerrar={() => setPantalla(null)}
        />
      )}

      {pantalla === "plantillas" && (
        <PantallaPlantillas
          plantillas={datos.plantillas}
          entrenos={datos.entrenos}
          onGuardar={(p) => guardar("plantillas", p)}
          onBorrar={borrar}
          onCerrar={() => setPantalla(null)}
        />
      )}

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
