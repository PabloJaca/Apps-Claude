/* ─────────────────────────────────────────────────────────────────────────
   Pantalla de cuenta, compartida por las dos apps.

   Va con estilos en línea y recibe la paleta de cada app, así encaja tanto
   en Gastos (verde azulado) como en Salud sin duplicar componentes.
   ───────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw, Check, X, LogOut, Smartphone } from "lucide-react";
import { entrar, hayNube, recuperar, registrar, salir, nombreDispositivo } from "./nube.js";

export const TEXTO_ESTADO = {
  "sin-nube": "Solo en este dispositivo",
  local: "Sin sincronizar",
  conectando: "Conectando…",
  sincronizando: "Sincronizando…",
  "al-dia": "Sincronizado",
  error: "Sin conexión",
};

/* En la cabecera no cabe la frase entera, así que ahí va la versión corta.
   La larga se queda en el title y en la pantalla de cuenta. */
const ETIQUETA_CORTA = {
  "sin-nube": "Local",
  local: "Sin cuenta",
  conectando: "…",
  sincronizando: "…",
  "al-dia": "Al día",
  error: "Sin red",
};

export function PastillaSync({ estado, onAbrir, paleta }) {
  const p = paleta;
  const girando = estado === "sincronizando" || estado === "conectando";
  const bien = estado === "al-dia";
  const Icono = bien ? Cloud : girando ? RefreshCw : CloudOff;
  const color = bien ? p.acento : estado === "error" ? p.coral : p.faint;

  return (
    <button
      onClick={onAbrir}
      title={TEXTO_ESTADO[estado]}
      aria-label={`Cuenta y copia de seguridad. Estado: ${TEXTO_ESTADO[estado]}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, border: "none",
        cursor: "pointer", background: p.card, boxShadow: p.sombra,
        borderRadius: 999, padding: "8px 11px", color, flexShrink: 0,
        fontFamily: p.body, fontSize: 12, fontWeight: 600,
      }}
    >
      <Icono size={15} strokeWidth={2.4} className={girando ? "spin" : undefined} />
      <span className="etiquetaSync" style={{ whiteSpace: "nowrap" }}>{ETIQUETA_CORTA[estado]}</span>
    </button>
  );
}

export function PantallaCuenta({ paleta, sesion, estado, onCerrar, extra }) {
  const p = paleta;
  const [modo, setModo] = useState("entrar");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  const campo = {
    width: "100%", border: `1.5px solid ${p.line}`, background: p.suave,
    borderRadius: 14, padding: "13px 14px", fontSize: 16, color: p.ink,
    fontFamily: p.body, outline: "none",
  };
  const boton = {
    width: "100%", border: "none", borderRadius: 16, padding: "14px 0",
    background: p.acento, color: "#fff", fontFamily: p.display, fontWeight: 700,
    fontSize: 15.5, cursor: "pointer", marginTop: 12,
  };
  const enlace = {
    background: "none", border: "none", color: p.acento, fontFamily: p.body,
    fontWeight: 600, fontSize: 13.5, cursor: "pointer", padding: "10px 0",
  };
  const tarjeta = {
    background: p.card, borderRadius: 24, boxShadow: p.sombra, padding: 20,
    marginBottom: 14,
  };
  const parrafo = { fontFamily: p.body, fontSize: 13.5, color: p.mid, lineHeight: 1.55, margin: 0 };
  const titulo = { fontFamily: p.display, fontWeight: 700, fontSize: 17, color: p.ink, margin: "0 0 6px" };

  const enviar = async () => {
    setError(null);
    setAviso(null);
    if (!email.trim() || clave.length < 6) {
      setError("Necesito un correo y una contraseña de 6 caracteres o más.");
      return;
    }
    setOcupado(true);
    try {
      if (modo === "entrar") await entrar(email, clave);
      else await registrar(email, clave);
      setClave("");
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const olvidada = async () => {
    setError(null);
    setAviso(null);
    if (!email.trim()) {
      setError("Escribe tu correo y vuelvo a mandarte el enlace.");
      return;
    }
    try {
      await recuperar(email);
      setAviso("Te he mandado un correo para cambiar la contraseña.");
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div
      className="fade"
      style={{
        position: "fixed", inset: 0, zIndex: 90, background: p.bg,
        overflowY: "auto", fontFamily: p.body,
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "22px 16px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <p style={{ fontFamily: p.mono, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: p.faint, fontWeight: 500, margin: 0 }}>
              Tus datos
            </p>
            <h2 style={{ fontFamily: p.display, fontWeight: 800, fontSize: 27, color: p.ink, letterSpacing: -0.6, margin: 0 }}>
              Cuenta y copia
            </h2>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{ border: "none", background: p.card, padding: 10, borderRadius: 14, boxShadow: p.sombra, cursor: "pointer" }}
          >
            <X size={19} color={p.mid} />
          </button>
        </div>

        {!hayNube() && (
          <div style={tarjeta}>
            <h3 style={titulo}>Sincronización sin configurar</h3>
            <p style={parrafo}>
              Ahora mismo los datos viven solo en este dispositivo. Para verlos también en el
              ordenador hay que rellenar <code style={{ fontFamily: p.mono, fontSize: 12.5 }}>config.js</code> con
              los datos de un proyecto de Firebase. Está explicado paso a paso en el
              archivo <code style={{ fontFamily: p.mono, fontSize: 12.5 }}>README.md</code> del proyecto: son cinco minutos y
              el plan gratuito sobra de largo.
            </p>
          </div>
        )}

        {hayNube() && !sesion && (
          <div style={tarjeta}>
            <h3 style={titulo}>{modo === "entrar" ? "Entra en tu cuenta" : "Crea tu cuenta"}</h3>
            <p style={{ ...parrafo, marginBottom: 16 }}>
              Con la misma cuenta en el móvil y en el ordenador verás los mismos datos en los dos
              sitios. Lo que ya tienes apuntado aquí no se pierde: se junta con lo que haya en la nube.
            </p>

            <input
              type="email" inputMode="email" autoComplete="email" placeholder="tu@correo.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ ...campo, marginBottom: 10 }}
            />
            <input
              type="password" autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              placeholder="Contraseña" value={clave} onChange={(e) => setClave(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar()}
              style={campo}
            />

            {error && <p style={{ ...parrafo, color: p.coral, marginTop: 10 }}>{error}</p>}
            {aviso && <p style={{ ...parrafo, color: p.acento, marginTop: 10 }}>{aviso}</p>}

            <button onClick={enviar} disabled={ocupado} style={{ ...boton, opacity: ocupado ? 0.6 : 1 }}>
              {ocupado ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear cuenta"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <button style={enlace} onClick={() => { setModo(modo === "entrar" ? "registrar" : "entrar"); setError(null); }}>
                {modo === "entrar" ? "No tengo cuenta" : "Ya tengo cuenta"}
              </button>
              {modo === "entrar" && <button style={{ ...enlace, color: p.faint }} onClick={olvidada}>Olvidé la contraseña</button>}
            </div>
          </div>
        )}

        {hayNube() && sesion && (
          <div style={tarjeta}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 14, background: p.acentoSuave, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {estado === "al-dia" ? <Check size={19} color={p.acento} strokeWidth={2.8} /> : <RefreshCw size={18} color={p.acento} className={estado === "sincronizando" ? "spin" : undefined} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: p.body, fontWeight: 600, fontSize: 14.5, color: p.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {sesion.email}
                </p>
                <p style={{ ...parrafo, fontSize: 12.5 }}>{TEXTO_ESTADO[estado]}</p>
              </div>
            </div>
            <p style={parrafo}>
              Todo lo que apuntes se guarda aquí y en la nube. Si abres la app sin internet sigue
              funcionando y se sube sola en cuanto haya cobertura.
            </p>
            <p style={{ ...parrafo, display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 12.5, color: p.faint }}>
              <Smartphone size={13} /> Estás en: {nombreDispositivo()}
            </p>
            <button
              onClick={() => salir()}
              style={{
                width: "100%", marginTop: 16, border: `1.5px solid ${p.line}`, background: "transparent",
                borderRadius: 14, padding: "12px 0", color: p.mid, fontFamily: p.body, fontWeight: 600,
                fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              <LogOut size={15} /> Cerrar sesión en este dispositivo
            </button>
            <p style={{ ...parrafo, fontSize: 12, color: p.faint, marginTop: 8 }}>
              Al cerrar sesión los datos siguen guardados en este dispositivo y en la nube.
            </p>
          </div>
        )}

        {extra}
      </div>
    </div>
  );
}
