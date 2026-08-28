/* ─────────────────────────────────────────────────────────────────────────
   Dictado: el envoltorio.

   Lo único que hace esto es convertir voz en texto. Entender ese texto es
   trabajo de `dictado.js` en cada app, y funciona igual si la frase se
   escribe a mano — por eso la hoja siempre deja el texto editable antes de
   usarlo, y por eso sirve también en los navegadores sin micrófono.

   Se apoya en la Web Speech API, que traen Chrome y Safari. No es gratis en
   el sentido de «no cuesta nada»: para transcribir, el navegador manda el
   audio a los servidores de Google o de Apple. Ningún dato de la aplicación
   sale de aquí, pero lo que se dicta pasa por ahí, y eso se dice en la propia
   hoja en vez de esconderlo.
   ───────────────────────────────────────────────────────────────────────── */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader, Mic, MicOff, Pencil, X } from "lucide-react";

const Motor = () =>
  (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

/** Si el navegador sabe escuchar. Sin esto, la hoja se queda en escribir. */
export const hayDictado = () => Boolean(Motor());

const MENSAJES = {
  "not-allowed": "No me has dado permiso para usar el micrófono. Puedes escribirlo aquí abajo.",
  "service-not-allowed": "Este navegador no deja usar el micrófono aquí. Escríbelo y funciona igual.",
  "no-speech": "No he oído nada. Prueba otra vez o escríbelo.",
  "audio-capture": "No encuentro ningún micrófono.",
  network: "Para dictar hace falta conexión. Sin ella, escríbelo y va igual.",
};

/**
 * Escuchar una frase.
 *
 * `continuous` va en falso a propósito: se dicta una cosa y se para. Dejarlo
 * abierto llena el campo de ruido de fondo y gasta batería.
 */
export function useDictado({ lang = "es-ES", onFinal } = {}) {
  const ref = useRef(null);
  const vivo = useRef(false);
  const [estado, setEstado] = useState("inactivo");   // inactivo | escuchando | error
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState(null);

  const parar = useCallback(() => {
    vivo.current = false;
    try { ref.current && ref.current.stop(); } catch (e) { /* ya estaba parado */ }
  }, []);

  const empezar = useCallback(() => {
    const M = Motor();
    if (!M) { setError("Este navegador no sabe escuchar."); setEstado("error"); return; }

    parar();
    setParcial("");
    setError(null);

    const r = new M();
    r.lang = lang;
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 3;

    r.onresult = (ev) => {
      let texto = "";
      let definitivo = false;
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        texto += ev.results[i][0].transcript;
        if (ev.results[i].isFinal) definitivo = true;
      }
      setParcial(texto.trim());
      if (definitivo && texto.trim()) {
        vivo.current = false;
        onFinal && onFinal(texto.trim());
      }
    };

    r.onerror = (ev) => {
      vivo.current = false;
      // «aborted» es lo que pasa al cerrar la hoja: no es un fallo que contar.
      if (ev.error === "aborted") return;
      setError(MENSAJES[ev.error] || "No he podido escuchar. Escríbelo y funciona igual.");
      setEstado("error");
    };

    r.onend = () => {
      if (vivo.current) { vivo.current = false; setEstado("inactivo"); }
      else setEstado((e) => (e === "escuchando" ? "inactivo" : e));
    };

    ref.current = r;
    vivo.current = true;
    setEstado("escuchando");
    try {
      r.start();
    } catch (e) {
      vivo.current = false;
      setEstado("inactivo");
    }
  }, [lang, onFinal, parar]);

  useEffect(() => () => { vivo.current = false; try { ref.current && ref.current.abort(); } catch (e) {} }, []);

  return { estado, parcial, error, empezar, parar, soportado: hayDictado() };
}

/* ─────────────────────────────  LA HOJA  ───────────────────────────── */

/**
 * Habla, mira lo que ha entendido, corrige si hace falta y dale a usar.
 *
 * Nunca guarda: `onTexto` devuelve la frase y cada app la interpreta y abre su
 * formulario relleno. Un fallo del intérprete cuesta un toque, no un dato malo.
 */
export function HojaDictado({ paleta, titulo = "Dilo y ya", ejemplos = [], onTexto, onCerrar }) {
  const p = paleta;
  const [texto, setTexto] = useState("");
  const areaRef = useRef(null);

  const { estado, parcial, error, empezar, parar, soportado } = useDictado({
    onFinal: (t) => setTexto((previo) => (previo ? `${previo} ${t}` : t)),
  });

  /* Se abre escuchando: la hoja ya se ha abierto de un toque, pedir otro para
     empezar a hablar sobra. Si el navegador no puede, se ve el aviso y el
     campo de escribir, que hace exactamente lo mismo. */
  useEffect(() => {
    if (soportado) empezar();
    else areaRef.current && areaRef.current.focus();
    // Solo al abrir.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const alPulsar = (e) => { if (e.key === "Escape") { parar(); onCerrar(); } };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar, parar]);

  const enMarcha = estado === "escuchando";
  const enPantalla = (texto ? `${texto} ` : "") + (enMarcha ? parcial : "");
  const puedeUsar = enPantalla.trim().length > 1;

  const usar = () => {
    parar();
    const t = enPantalla.trim();
    if (t.length > 1) onTexto(t);
  };

  const boton = {
    border: "none", cursor: "pointer", fontFamily: p.body, fontWeight: 600,
    fontSize: 14, borderRadius: 14, padding: "13px 18px",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  };

  return (
    <div
      onClick={() => { parar(); onCerrar(); }}
      style={{
        position: "absolute", inset: 0, zIndex: 90, background: "rgba(21,41,60,.42)",
        backdropFilter: "blur(2px)", display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520, background: p.bg, borderRadius: "24px 24px 0 0",
          padding: "10px 18px 20px", paddingBottom: "max(20px, env(safe-area-inset-bottom))",
          maxHeight: "94%", overflowY: "auto", fontFamily: p.body, color: p.ink,
        }}
      >
        {/* El asidero de la hoja: gris claro cosido a mano se perdía en oscuro. */}
        <div style={{ width: 38, height: 4, background: p.line, borderRadius: 99, margin: "0 auto 14px" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontFamily: p.display, fontWeight: 700, fontSize: 17, margin: 0 }}>{titulo}</h2>
          <button
            onClick={() => { parar(); onCerrar(); }}
            aria-label="Cerrar"
            style={{ ...boton, width: 34, height: 34, padding: 0, borderRadius: 99, background: p.card, color: p.mid, boxShadow: p.sombra }}
          >
            <X size={19} />
          </button>
        </div>

        {/* El micrófono, que además es el indicador de si está escuchando. */}
        {soportado && (
          <button
            onClick={enMarcha ? parar : empezar}
            aria-label={enMarcha ? "Parar de escuchar" : "Empezar a escuchar"}
            style={{
              ...boton, width: "100%", padding: "22px 18px", marginBottom: 14,
              background: enMarcha ? p.acento : p.card,
              color: enMarcha ? p.sobreAcento : p.ink,
              boxShadow: enMarcha ? "0 6px 22px rgba(15,158,142,.35)" : p.sombra,
              flexDirection: "column", gap: 10,
            }}
          >
            <span
              className={enMarcha ? "latido" : undefined}
              style={{
                width: 56, height: 56, borderRadius: 99, display: "inline-flex",
                alignItems: "center", justifyContent: "center",
                background: enMarcha ? "rgba(0,0,0,.16)" : p.acentoSuave,
                color: enMarcha ? p.sobreAcento : p.acento,
              }}
            >
              {enMarcha ? <Mic size={26} strokeWidth={2.2} /> : <Mic size={26} strokeWidth={2.2} />}
            </span>
            <span style={{ fontSize: 14.5 }}>
              {enMarcha ? "Te escucho… habla" : texto ? "Añadir algo más" : "Toca y habla"}
            </span>
          </button>
        )}

        {!soportado && (
          <div style={{
            background: p.card, borderRadius: 16, padding: "13px 15px", marginBottom: 14,
            display: "flex", gap: 11, alignItems: "flex-start", boxShadow: p.sombra,
          }}>
            <MicOff size={18} style={{ color: p.faint, flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 12.5, color: p.mid, lineHeight: 1.5 }}>
              Este navegador no sabe escuchar, pero el teclado de tu móvil sí: toca el campo de
              abajo y usa su micrófono. Lo que se entiende es exactamente lo mismo.
            </p>
          </div>
        )}

        {error && (
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: p.coral, lineHeight: 1.5 }}>{error}</p>
        )}

        {/* Siempre editable: el dictado se equivoca con los nombres propios y
            corregir una palabra es más rápido que repetirlo todo. */}
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{
            fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase",
            color: p.faint, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, marginBottom: 7,
          }}>
            <Pencil size={12} /> Lo que he entendido
          </span>
          <textarea
            ref={areaRef}
            value={enPantalla}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            placeholder={ejemplos[0] ? `Por ejemplo: ${ejemplos[0]}` : "Escríbelo aquí"}
            style={{
              width: "100%", boxSizing: "border-box", background: p.card, color: p.ink,
              border: `1.5px solid ${p.line}`, borderRadius: 14, padding: "12px 14px",
              fontSize: 15, fontFamily: p.body, lineHeight: 1.5, resize: "vertical", outline: "none",
            }}
          />
        </label>

        {ejemplos.length > 0 && !enPantalla.trim() && (
          <div style={{ marginBottom: 14 }}>
            <span style={{
              fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase",
              color: p.faint, fontWeight: 600, display: "block", marginBottom: 8,
            }}>
              Puedes decir
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {ejemplos.map((ej) => (
                <button
                  key={ej}
                  onClick={() => setTexto(ej)}
                  style={{
                    ...boton, justifyContent: "flex-start", textAlign: "left",
                    background: p.card, color: p.mid, boxShadow: p.sombra,
                    fontSize: 13, fontWeight: 500, padding: "11px 14px",
                  }}
                >
                  «{ej}»
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={usar}
          disabled={!puedeUsar}
          style={{
            ...boton, width: "100%", background: p.acento, color: p.sobreAcento,
            opacity: puedeUsar ? 1 : 0.4, cursor: puedeUsar ? "pointer" : "default",
            boxShadow: puedeUsar ? "0 3px 12px rgba(15,158,142,.3)" : "none",
          }}
        >
          {enMarcha ? <Loader size={17} className="spin" /> : <Check size={17} />} Usar esto
        </button>

        <p style={{ margin: "12px 0 0", fontSize: 11.5, color: p.faint, lineHeight: 1.5, textAlign: "center" }}>
          {soportado
            ? "Para transcribir, tu navegador manda el audio a Google o a Apple. Nada de lo que ya hay en la app sale de tu cuenta."
            : "Lo que escribes se interpreta aquí mismo, sin salir de tu dispositivo."}
        </p>
      </div>
    </div>
  );
}

/* El latido del micrófono mientras escucha. Va aquí para que las dos apps lo
   tengan sin tener que tocar sus hojas de estilo. */
export const CSS_VOZ = `
@keyframes latidoVoz { 0%,100% { transform:scale(1); } 50% { transform:scale(1.09); } }
.latido { animation:latidoVoz 1.25s ease-in-out infinite; }
@media (prefers-reduced-motion:reduce) { .latido { animation:none; } }
`;
