/* ─────────────────────────────────────────────────────────────────────────
   La pantalla del PIN y el sitio donde se pone.

   Estilos en línea, como el resto de lo compartido: esto se pinta antes que
   la hoja de estilos de cada app y tiene que verse bien igual.
   ───────────────────────────────────────────────────────────────────────── */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Delete, Lock, LogOut, ShieldCheck, X } from "lucide-react";
import { salir } from "./nube.js";
import {
  LARGO_MAXIMO, LARGO_MINIMO, comprobarPin, esperaTrasFallos, hayCripto,
  marcarVisto, pinValido, ponerPin, quitarPin, tienePin,
} from "./bloqueo.js";

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "borrar"];

/** Los puntitos de lo que llevas escrito. */
function Puntos({ largo, paleta, error }) {
  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "center", margin: "26px 0 8px" }}>
      {Array.from({ length: LARGO_MAXIMO }, (_, i) => (
        <span
          key={i}
          style={{
            width: 11, height: 11, borderRadius: 99,
            background: i < largo ? (error ? paleta.coral : paleta.acento) : paleta.line,
            transition: "background .15s, transform .15s",
            transform: i < largo ? "scale(1.15)" : "none",
          }}
        />
      ))}
    </div>
  );
}

function Teclado({ paleta, onTecla, onBorrar, deshabilitado }) {
  const p = paleta;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, maxWidth: 300, margin: "0 auto" }}>
      {TECLAS.map((t, i) => {
        if (t === "") return <span key={i} />;
        const esBorrar = t === "borrar";
        return (
          <button
            key={i}
            disabled={deshabilitado}
            onClick={() => (esBorrar ? onBorrar() : onTecla(t))}
            aria-label={esBorrar ? "Borrar" : t}
            style={{
              height: 62, borderRadius: 20, border: "none",
              cursor: deshabilitado ? "default" : "pointer",
              background: esBorrar ? "transparent" : p.card,
              boxShadow: esBorrar ? "none" : p.sombra,
              color: p.ink, fontFamily: p.mono, fontSize: 24, fontWeight: 600,
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: deshabilitado ? 0.45 : 1, transition: "opacity .2s",
            }}
          >
            {esBorrar ? <Delete size={22} color={p.mid} /> : t}
          </button>
        );
      })}
    </div>
  );
}

/**
 * El candado.
 *
 * Se desbloquea solo con acertar: no hay botón de «entrar», porque a los
 * cuatro dígitos ya se sabe si vale o no y un toque de más sobra.
 */
export function PantallaBloqueo({ paleta, uid, email, onAbrir }) {
  const p = paleta;
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [fallos, setFallos] = useState(0);
  const [espera, setEspera] = useState(0);
  const temporizador = useRef(null);

  useEffect(() => () => clearInterval(temporizador.current), []);

  const bloqueadoPorFallos = espera > 0;

  const intentar = useCallback(
    async (valor) => {
      const ok = await comprobarPin(uid, valor);
      if (ok) {
        marcarVisto(uid);
        onAbrir();
        return;
      }
      const nuevos = fallos + 1;
      setFallos(nuevos);
      setError(true);
      setPin("");
      const segundos = esperaTrasFallos(nuevos);
      if (segundos > 0) {
        setEspera(segundos);
        clearInterval(temporizador.current);
        temporizador.current = setInterval(() => {
          setEspera((s) => {
            if (s <= 1) { clearInterval(temporizador.current); return 0; }
            return s - 1;
          });
        }, 1000);
      }
      /* El aviso se queda hasta que se vuelve a teclear. Antes se borraba solo
         a los 600 ms y no daba tiempo ni a leerlo. */
    },
    [uid, fallos, onAbrir]
  );

  const escribir = (d) => {
    if (bloqueadoPorFallos) return;
    setError(false);
    const siguiente = (pin + d).slice(0, LARGO_MAXIMO);
    setPin(siguiente);
    if (siguiente.length >= LARGO_MINIMO) intentar(siguiente);
  };

  /* Teclado de verdad en el ordenador: escribir el PIN con el ratón es tonto. */
  useEffect(() => {
    const alPulsar = (e) => {
      if (bloqueadoPorFallos) return;
      if (/^\d$/.test(e.key)) escribir(e.key);
      if (e.key === "Backspace") { setError(false); setPin((x) => x.slice(0, -1)); }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  });

  return (
    <div
      style={{
        /* El alto va aquí y no en una clase: `puertaMarco` vive en el estilo
           que inyecta la puerta, y esta pantalla se dibuja en su lugar, sin
           él. Sin esto el candado flotaba sobre medio fondo en blanco. */
        minHeight: "100vh", height: "100dvh",
        background: p.bg, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "28px 20px",
        fontFamily: p.body, color: p.ink,
      }}
    >
      <div className="puertaCaja" style={{ width: "100%", maxWidth: 360, textAlign: "center" }}>
        <span
          style={{
            width: 54, height: 54, borderRadius: 18, background: p.acentoSuave, color: p.acento,
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}
        >
          <Lock size={24} strokeWidth={2.2} />
        </span>

        <h1 style={{ fontFamily: p.display, fontWeight: 800, fontSize: 24, margin: 0, letterSpacing: -0.5 }}>
          Tu PIN
        </h1>
        <p style={{ fontSize: 13, color: p.mid, margin: "6px 0 0", lineHeight: 1.5 }}>
          {email}
        </p>

        <Puntos largo={pin.length} paleta={p} error={error} />

        <p style={{ fontSize: 12.5, color: error || bloqueadoPorFallos ? p.coral : p.faint, minHeight: 20, margin: "0 0 18px" }}>
          {bloqueadoPorFallos
            ? `Demasiados intentos. Espera ${espera} s.`
            : error
              ? "Ese no es."
              : " "}
        </p>

        <Teclado
          paleta={p}
          deshabilitado={bloqueadoPorFallos}
          onTecla={escribir}
          onBorrar={() => { setError(false); setPin((x) => x.slice(0, -1)); }}
        />

        {/* La salida de emergencia: el PIN es de este aparato, así que
            olvidarlo no puede dejarte fuera de tus propios datos. */}
        <button
          onClick={() => salir()}
          style={{
            marginTop: 26, border: "none", background: "none", cursor: "pointer",
            color: p.mid, fontFamily: p.body, fontSize: 13, fontWeight: 600,
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "13px 16px", minHeight: 44,     // el dedo necesita sitio
          }}
        >
          <LogOut size={15} /> Se me ha olvidado
        </button>
      </div>
    </div>
  );
}

/**
 * Poner, cambiar o quitar el PIN. Vive dentro de la pantalla de cuenta.
 *
 * Al ponerlo se pide dos veces: un PIN mal tecleado que solo se escribe una
 * vez es un PIN que no conoce nadie.
 */
export function AjustePin({ paleta, uid }) {
  const p = paleta;
  const [puesto, setPuesto] = useState(() => tienePin(uid));
  const [modo, setModo] = useState(null);           // null | "poner" | "quitar"
  const [pin, setPin] = useState("");
  const [repe, setRepe] = useState("");
  const [aviso, setAviso] = useState(null);
  const refPin = useRef(null);

  useEffect(() => { if (modo === "poner") setTimeout(() => refPin.current?.focus(), 80); }, [modo]);

  const soportado = hayCripto();

  const guardar = async () => {
    if (!pinValido(pin)) return setAviso({ mal: true, texto: `Tienen que ser entre ${LARGO_MINIMO} y ${LARGO_MAXIMO} cifras.` });
    if (pin !== repe) return setAviso({ mal: true, texto: "Los dos no coinciden." });
    const ok = await ponerPin(uid, pin);
    if (!ok) return setAviso({ mal: true, texto: "Este navegador no me deja guardarlo." });
    setPuesto(true); setModo(null); setPin(""); setRepe("");
    setAviso({ mal: false, texto: "Listo. Te lo pediré al abrir la app." });
  };

  const campo = {
    width: "100%", boxSizing: "border-box", background: p.suave || p.card, color: p.ink,
    border: `1.5px solid ${p.line}`, borderRadius: 12, padding: "12px 14px",
    fontSize: 18, fontFamily: p.mono, letterSpacing: 6, textAlign: "center", outline: "none",
  };
  const boton = {
    border: "none", cursor: "pointer", fontFamily: p.body, fontWeight: 600, fontSize: 13.5,
    borderRadius: 12, padding: "11px 16px", display: "inline-flex", alignItems: "center",
    justifyContent: "center", gap: 7, width: "100%",
  };

  return (
    /* El mismo hueco y el mismo redondeo que el resto de tarjetas de esta
       pantalla: sin el margen de abajo quedaba pegada a «Cerrar sesión» y las
       dos parecían la misma caja. */
    <section style={{ background: p.card, borderRadius: 24, padding: 20, boxShadow: p.sombra, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <ShieldCheck size={16} color={p.mid} />
        <h3 style={{ fontFamily: p.display, fontWeight: 700, fontSize: 15, margin: 0 }}>Bloqueo con PIN</h3>
        {puesto && (
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: p.acento, background: p.acentoSuave, borderRadius: 99, padding: "3px 10px" }}>
            Puesto
          </span>
        )}
      </div>

      {!soportado ? (
        <p style={{ fontSize: 12.5, color: p.mid, margin: 0, lineHeight: 1.55 }}>
          Aquí no puedo guardarlo de forma segura, así que prefiero no ofrecerlo. Pasa en conexiones
          sin cifrar; desde la dirección de siempre funciona.
        </p>
      ) : modo === "poner" ? (
        <>
          <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
            <input ref={refPin} type="password" inputMode="numeric" autoComplete="new-password"
              placeholder="PIN" maxLength={LARGO_MAXIMO} value={pin}
              onChange={(e) => { setAviso(null); setPin(e.target.value.replace(/\D/g, "")); }} style={campo} />
            <input type="password" inputMode="numeric" autoComplete="new-password"
              placeholder="Otra vez" maxLength={LARGO_MAXIMO} value={repe}
              onKeyDown={(e) => e.key === "Enter" && guardar()}
              onChange={(e) => { setAviso(null); setRepe(e.target.value.replace(/\D/g, "")); }} style={campo} />
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            <button onClick={() => { setModo(null); setPin(""); setRepe(""); setAviso(null); }}
              style={{ ...boton, background: p.suave || p.bg, color: p.mid }}>
              Cancelar
            </button>
            <button onClick={guardar} aria-label="Guardar el PIN" style={{ ...boton, background: p.acento, color: "#fff" }}>
              <Check size={16} /> Guardar
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: "grid", gap: 9 }}>
          <button
            onClick={() => setModo("poner")}
            aria-label={puesto ? "Cambiar el PIN" : "Poner un PIN"}
            style={{ ...boton, background: puesto ? (p.suave || p.bg) : p.acento, color: puesto ? p.mid : "#fff" }}
          >
            <Lock size={16} /> {puesto ? "Cambiar el PIN" : "Poner un PIN"}
          </button>
          {puesto && (
            <button
              onClick={() => { quitarPin(uid); setPuesto(false); setAviso({ mal: false, texto: "Quitado." }); }}
              aria-label="Quitar el PIN"
              style={{ ...boton, background: "#FFF5F3", color: p.coral, border: "1.5px solid #FBD9D1" }}
            >
              <X size={16} /> Quitarlo
            </button>
          )}
        </div>
      )}

      {aviso && (
        <p style={{ fontSize: 12.5, color: aviso.mal ? p.coral : p.acento, margin: "10px 0 0" }}>{aviso.texto}</p>
      )}

      {/* Lo importante, y por eso va siempre y no escondido: qué protege esto
          de verdad. Vender como caja fuerte lo que es una cortina sería peor
          que no tener nada. */}
      <p style={{ fontSize: 11.5, color: p.faint, margin: "12px 0 0", lineHeight: 1.55 }}>
        Tapa la pantalla en este aparato: sirve para el móvil que se queda encima de la mesa. No cifra
        tus datos ni sustituye a tu contraseña, que es la que de verdad los protege. Si se te olvida,
        sales y vuelves a entrar con el correo.
      </p>
    </section>
  );
}
