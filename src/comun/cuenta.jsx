/* ─────────────────────────────────────────────────────────────────────────
   Pantalla de cuenta: quién eres, cerrar sesión, copia de seguridad, y el
   rescate de los datos que quedaran guardados por la versión anterior.
   ───────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useState } from "react";
import {
  Check, Cloud, CloudOff, Download, LogOut, RefreshCw, Smartphone, Trash2, Upload, X,
} from "lucide-react";
import { nombreDispositivo, salir } from "./nube.js";

export const TEXTO_ESTADO = {
  "sin-sesion": "Sin sesión",
  conectando: "Conectando…",
  sincronizando: "Sincronizando…",
  guardando: "Guardando…",
  "al-dia": "Guardado en tu cuenta",
  error: "Error de conexión",
};

const ETIQUETA_CORTA = {
  "sin-sesion": "—",
  conectando: "…",
  sincronizando: "…",
  guardando: "…",
  "al-dia": "Guardado",
  error: "Error",
};

export function PastillaSync({ estado, onAbrir, paleta }) {
  const p = paleta;
  const girando = estado === "sincronizando" || estado === "conectando" || estado === "guardando";
  const bien = estado === "al-dia";
  const Icono = bien ? Cloud : girando ? RefreshCw : CloudOff;
  const color = bien ? p.acento : estado === "error" ? p.coral : p.faint;

  return (
    <button
      onClick={onAbrir}
      title={TEXTO_ESTADO[estado]}
      aria-label={`Cuenta. Estado: ${TEXTO_ESTADO[estado]}`}
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

export function PantallaCuenta({
  paleta, sesion, estado, error, legado,
  onImportar, onDescartarLegado, onExportar, onRestaurar, onVaciar, onCerrar,
}) {
  const p = paleta;
  const [pendiente, setPendiente] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const refArchivo = React.useRef(null);

  useEffect(() => {
    const alPulsar = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [onCerrar]);

  useEffect(() => {
    if (legado) setPendiente(legado());
  }, [legado]);

  const tarjeta = { background: p.card, borderRadius: 24, boxShadow: p.sombra, padding: 20, marginBottom: 14 };
  const parrafo = { fontFamily: p.body, fontSize: 13.5, color: p.mid, lineHeight: 1.55, margin: 0 };
  const titulo = { fontFamily: p.display, fontWeight: 700, fontSize: 17, color: p.ink, margin: "0 0 8px" };
  const boton = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    border: "none", borderRadius: 16, padding: "13px 12px", cursor: "pointer",
    background: p.suave, color: p.mid, fontFamily: p.body, fontWeight: 600, fontSize: 13.5,
    width: "100%", boxSizing: "border-box",
  };

  const importar = async () => {
    setOcupado(true);
    try {
      await onImportar(pendiente);
      setAviso({ ok: true, texto: "Datos añadidos a tu cuenta." });
      setPendiente(null);
    } catch (e) {
      setAviso({ ok: false, texto: "No se han podido importar. Inténtalo otra vez." });
    } finally {
      setOcupado(false);
    }
  };

  const alElegirArchivo = async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setOcupado(true);
    try {
      await onRestaurar(f);
      setAviso({ ok: true, texto: "Copia restaurada en tu cuenta." });
    } catch (err) {
      setAviso({ ok: false, texto: "Ese archivo no parece una copia válida." });
    } finally {
      setOcupado(false);
      e.target.value = "";
    }
  };

  const vaciar = async () => {
    setOcupado(true);
    try {
      await onVaciar();
      setAviso({ ok: true, texto: "Cuenta vaciada." });
      setConfirmando(false);
    } catch (e) {
      setAviso({ ok: false, texto: "No se ha podido borrar. Inténtalo otra vez." });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div
      className="fade"
      style={{ position: "fixed", inset: 0, zIndex: 90, background: p.bg, overflowY: "auto", fontFamily: p.body }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "22px 16px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <p style={{ fontFamily: p.mono, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: p.faint, fontWeight: 500, margin: 0 }}>
              Tu cuenta
            </p>
            <h2 style={{ fontFamily: p.display, fontWeight: 800, fontSize: 27, color: p.ink, letterSpacing: -0.6, margin: 0 }}>
              Datos y sesión
            </h2>
          </div>
          <button onClick={onCerrar} aria-label="Cerrar"
            style={{ border: "none", background: p.card, padding: 10, borderRadius: 14, boxShadow: p.sombra, cursor: "pointer" }}>
            <X size={19} color={p.mid} />
          </button>
        </div>

        {/* quién eres */}
        <div style={tarjeta}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: p.acentoSuave, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {estado === "al-dia"
                ? <Check size={20} color={p.acento} strokeWidth={2.8} />
                : <RefreshCw size={19} color={p.acento} className={estado === "error" ? undefined : "spin"} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: p.body, fontWeight: 600, fontSize: 14.5, color: p.ink, margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {sesion.email}
              </p>
              <p style={{ ...parrafo, fontSize: 12.5 }}>{TEXTO_ESTADO[estado]}</p>
            </div>
          </div>

          {error && (
            <p style={{ ...parrafo, color: p.coral, background: p.coralSuave, borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
              {error}
            </p>
          )}

          <p style={parrafo}>
            Todo lo que apuntas se guarda al momento en tu cuenta, no en este dispositivo. Entra con
            este mismo correo donde quieras y lo tendrás todo.
          </p>
          <p style={{ ...parrafo, display: "flex", alignItems: "center", gap: 7, marginTop: 10, fontSize: 12.5, color: p.faint }}>
            <Smartphone size={13} /> Estás en: {nombreDispositivo()}
          </p>
        </div>

        {/* datos de la versión anterior que quedaron en este dispositivo */}
        {pendiente && (
          <div style={{ ...tarjeta, background: p.avisoSuave || p.acentoSuave }}>
            <h3 style={titulo}>Hay datos antiguos en este dispositivo</h3>
            <p style={{ ...parrafo, marginBottom: 14 }}>
              La versión anterior guardaba en el propio dispositivo. Aquí quedan{" "}
              <strong style={{ color: p.ink }}>{pendiente.resumen}</strong>. Puedes añadirlos a esta
              cuenta, pero asegúrate de que son tuyos y no de otra persona que haya usado este mismo
              aparato.
            </p>
            <button onClick={importar} disabled={ocupado}
              style={{ ...boton, background: p.acento, color: "#fff", opacity: ocupado ? 0.6 : 1 }}>
              <Upload size={16} /> Añadirlos a {sesion.email}
            </button>
            <button
              onClick={() => { setPendiente(null); if (onDescartarLegado) onDescartarLegado(); }}
              style={{ ...boton, marginTop: 8, background: "transparent" }}
            >
              No son míos, olvídalos
            </button>
          </div>
        )}

        {/* copia de seguridad */}
        <div style={tarjeta}>
          <h3 style={titulo}>Copia de seguridad</h3>
          <p style={{ ...parrafo, marginBottom: 14 }}>
            Un archivo con todo tu historial, por si quieres guardarlo aparte o llevártelo a otro sitio.
          </p>
          <div style={{ display: "flex", gap: 9 }}>
            <button onClick={onExportar} style={{ ...boton, flex: 1 }}>
              <Download size={15} /> Guardar copia
            </button>
            <button onClick={() => refArchivo.current && refArchivo.current.click()} disabled={ocupado} style={{ ...boton, flex: 1 }}>
              <Upload size={15} /> Restaurar
            </button>
          </div>
          <input ref={refArchivo} type="file" accept="application/json,.json" onChange={alElegirArchivo} style={{ display: "none" }} />
          {aviso && (
            <p style={{ ...parrafo, color: aviso.ok ? p.acento : p.coral, marginTop: 12 }}>{aviso.texto}</p>
          )}
        </div>

        {/* salir y borrar */}
        <div style={tarjeta}>
          <button onClick={() => salir()} style={{ ...boton, border: `1.5px solid ${p.line}`, background: "transparent" }}>
            <LogOut size={15} /> Cerrar sesión
          </button>
          <p style={{ ...parrafo, fontSize: 12, color: p.faint, marginTop: 10 }}>
            Al cerrar sesión se borra de este dispositivo todo lo de tu cuenta. Tus datos siguen a
            salvo y vuelven en cuanto entres otra vez, aquí o donde sea.
          </p>

          {!confirmando ? (
            <button onClick={() => setConfirmando(true)}
              style={{ ...boton, marginTop: 14, background: "transparent", color: p.coral, border: `1.5px solid ${p.coralSuave}` }}>
              <Trash2 size={15} /> Borrar todos mis datos
            </button>
          ) : (
            <div style={{ marginTop: 14, background: p.coralSuave, borderRadius: 16, padding: 14 }}>
              <p style={{ ...parrafo, color: p.ink, marginBottom: 12 }}>
                Esto borra de tu cuenta todo lo que has apuntado, en todos tus dispositivos y para
                siempre. No hay vuelta atrás.
              </p>
              <div style={{ display: "flex", gap: 9 }}>
                <button onClick={() => setConfirmando(false)} style={{ ...boton, flex: 1, background: "#fff" }}>
                  Cancelar
                </button>
                <button onClick={vaciar} disabled={ocupado} style={{ ...boton, flex: 1, background: p.coral, color: "#fff" }}>
                  Sí, borrar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
