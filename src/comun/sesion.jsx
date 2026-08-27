/* ─────────────────────────────────────────────────────────────────────────
   La puerta de la aplicación.

   Sin sesión no se dibuja nada más: ni pestañas, ni datos, ni un resto de la
   cuenta anterior. Los hijos solo se montan cuando hay un usuario de verdad,
   y llevan su UID como `key`, de modo que al cambiar de cuenta React tira el
   árbol entero y lo vuelve a construir desde cero.

   Va con estilos en línea porque se pinta antes que la hoja de estilos de
   cada app, y tiene que verse bien igualmente.
   ───────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useState } from "react";
import { CloudOff, Lock, LogIn, Mail } from "lucide-react";
import {
  ERROR_SIN_INVITACION, alCambiarSesion, entrar, estaInvitado, hayNube,
  recuperar, registrar, salir,
} from "./nube.js";
import { MINUTOS_GRACIA, debeBloquear, marcarVisto } from "./bloqueo.js";
import { PantallaBloqueo } from "./bloqueo.jsx";

const CSS_PUERTA = `
@keyframes puertaEntra { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes puertaGira { to { transform: rotate(360deg) } }
/* «backwards», no «both»: el relleno hacia delante deja el transform puesto y
   eso rompe el position:fixed de cualquier cosa que se abra dentro. */
.puertaCaja { animation: puertaEntra .3s cubic-bezier(.2,.8,.3,1) backwards }
.puertaGiro { animation: puertaGira .8s linear infinite }
/* En objetos de JavaScript la segunda clave pisa a la primera, así que la
   alternativa para navegadores sin dvh tiene que ir aquí, no en el estilo. */
.puertaMarco { min-height: 100vh; min-height: 100dvh }
@media (prefers-reduced-motion: reduce) { .puertaCaja, .puertaGiro { animation: none } }
`;

export function Puerta({ paleta, titulo, descripcion, children }) {
  const [sesion, setSesion] = useState(undefined); // undefined = comprobando
  const [invitado, setInvitado] = useState(undefined);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => alCambiarSesion(setSesion), []);

  /* El candado, si esta cuenta lo tiene puesto en este aparato. Al arrancar
     siempre; al volver de segundo plano, solo si se ha estado fuera un rato:
     pedirlo cada vez que sales a mirar el banco es la mejor forma de que
     acabes quitándolo. */
  useEffect(() => {
    if (!sesion) return setAbierto(false);
    setAbierto(!debeBloquear(sesion.uid, { arranque: true }));
  }, [sesion && sesion.uid]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sesion) return undefined;
    const alCambiar = () => {
      if (document.visibilityState === "hidden") {
        // Al irse se apunta la hora, que es contra la que se mide al volver.
        setAbierto((a) => { if (a) marcarVisto(sesion.uid); return a; });
        return;
      }
      if (debeBloquear(sesion.uid, { arranque: false, minutos: MINUTOS_GRACIA })) setAbierto(false);
    };
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  }, [sesion]);

  /* Comprobación de cortesía: quien decide de verdad son las reglas. Sirve
     para enseñar «esto es privado» en vez de un error de permisos. */
  useEffect(() => {
    if (!sesion) return setInvitado(undefined);
    let vivo = true;
    setInvitado(undefined);
    estaInvitado(sesion.email).then((si) => vivo && setInvitado(si));
    return () => { vivo = false; };
  }, [sesion && sesion.email]);

  if (sesion === undefined) return <Esperando paleta={paleta} />;
  if (!sesion) return <Acceso paleta={paleta} titulo={titulo} descripcion={descripcion} />;
  if (invitado === undefined) return <Esperando paleta={paleta} texto="Comprobando tu acceso…" />;
  if (!invitado) return <SinInvitacion paleta={paleta} email={sesion.email} />;
  if (!abierto) {
    return (
      <PantallaBloqueo
        paleta={paleta}
        uid={sesion.uid}
        email={sesion.email}
        onAbrir={() => setAbierto(true)}
      />
    );
  }

  /* La `key` es lo que garantiza que no queda ni un resto del usuario anterior:
     al cambiar el UID, React desmonta todo y lo monta limpio. */
  return <React.Fragment key={sesion.uid}>{children(sesion)}</React.Fragment>;
}

function Marco({ paleta, children }) {
  return (
    <div
      className="puertaMarco"
      style={{
        background: paleta.bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 18px", fontFamily: paleta.body,
      }}
    >
      <style>{CSS_PUERTA}</style>
      <div className="puertaCaja" style={{ width: "100%", maxWidth: 380 }}>
        {children}
      </div>
    </div>
  );
}

function Esperando({ paleta, texto = "Comprobando tu sesión…" }) {
  return (
    <Marco paleta={paleta}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <span
          className="puertaGiro"
          style={{
            width: 26, height: 26, borderRadius: "50%",
            border: `3px solid ${paleta.line}`, borderTopColor: paleta.acento,
          }}
        />
        <p style={{ color: paleta.mid, fontSize: 14, margin: 0 }}>{texto}</p>
      </div>
    </Marco>
  );
}

/** La cuenta existe, pero el correo no está en la lista de invitados. */
function SinInvitacion({ paleta, email }) {
  return (
    <Marco paleta={paleta}>
      <div style={{ background: paleta.card, borderRadius: 24, boxShadow: paleta.sombra, padding: 22, textAlign: "center" }}>
        <div
          style={{
            width: 48, height: 48, borderRadius: 16, background: paleta.coralSuave || paleta.acentoSuave,
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
          }}
        >
          <Lock size={22} color={paleta.coral} strokeWidth={2.2} />
        </div>
        <p style={{ fontFamily: paleta.display, fontWeight: 700, fontSize: 18, color: paleta.ink, margin: "0 0 8px" }}>
          Esta aplicación es privada
        </p>
        <p style={{ color: paleta.mid, fontSize: 13.5, lineHeight: 1.55, margin: "0 0 6px" }}>
          Tu cuenta se ha creado, pero <strong style={{ color: paleta.ink }}>{email}</strong> no está
          en la lista de personas con acceso.
        </p>
        <p style={{ color: paleta.faint, fontSize: 12.5, lineHeight: 1.55, margin: 0 }}>
          Si crees que debería estarlo, pídeselo a quien te pasó la aplicación.
        </p>
        <button
          onClick={() => salir()}
          style={{
            width: "100%", marginTop: 18, border: `1.5px solid ${paleta.line}`, borderRadius: 16,
            padding: "13px 0", background: "transparent", color: paleta.mid,
            fontFamily: paleta.body, fontWeight: 600, fontSize: 13.5, cursor: "pointer",
          }}
        >
          Salir
        </button>
      </div>
    </Marco>
  );
}

function Acceso({ paleta, titulo, descripcion }) {
  const [modo, setModo] = useState("entrar");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  if (!hayNube()) return <SinConfigurar paleta={paleta} />;

  /* `boxSizing` a mano: la puerta se pinta antes que la hoja de estilos de la
     app, así que aquí no vale ningún reset. Sin esto el relleno se suma al
     100% y los campos se salen de la tarjeta. */
  const campo = {
    width: "100%", boxSizing: "border-box",
    border: `1.5px solid ${paleta.line}`, background: paleta.suave,
    borderRadius: 14, padding: "14px 15px", fontSize: 16, color: paleta.ink,
    fontFamily: paleta.body, outline: "none",
  };

  const enviar = async () => {
    setError(null);
    setAviso(null);
    if (!email.trim()) return setError("Escribe tu correo.");
    /* Al crear la cuenta se exigen 8: seis es poquísimo y es la única vez que
       se puede pedir sin dejar fuera a quien ya tiene una más corta. */
    if (modo === "registrar" && clave.length < 8) {
      return setError("La contraseña necesita al menos 8 caracteres.");
    }
    if (!clave) return setError("Escribe tu contraseña.");

    setOcupado(true);
    try {
      if (modo === "entrar") await entrar(email, clave);
      else await registrar(email, clave);
      setClave("");
    } catch (e) {
      // Si no está en la lista, la pantalla de después ya lo explica entera.
      if (e.message !== ERROR_SIN_INVITACION) setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  const olvidada = async () => {
    setError(null);
    setAviso(null);
    if (!email.trim()) return setError("Escribe tu correo y te mando el enlace.");
    try {
      await recuperar(email);
    } catch (e) {
      return setError(e.message);
    }
    /* Se responde lo mismo exista o no la cuenta: si aquí se dijera «ese correo
       no está registrado», bastaría con probar correos para saber quién usa
       la aplicación. */
    setAviso("Si hay una cuenta con ese correo, te llegará un enlace para cambiar la contraseña.");
  };

  return (
    <Marco paleta={paleta}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div
          style={{
            width: 52, height: 52, borderRadius: 18, background: paleta.acentoSuave,
            display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
          }}
        >
          <Mail size={24} color={paleta.acento} strokeWidth={2.2} />
        </div>
        <h1
          style={{
            fontFamily: paleta.display, fontWeight: 800, fontSize: 27, color: paleta.ink,
            letterSpacing: -0.6, margin: "0 0 6px",
          }}
        >
          {titulo}
        </h1>
        <p style={{ color: paleta.mid, fontSize: 14, lineHeight: 1.5, margin: 0 }}>{descripcion}</p>
      </div>

      <div
        style={{
          background: paleta.card, borderRadius: 24, boxShadow: paleta.sombra, padding: 20,
        }}
      >
        <p
          style={{
            fontFamily: paleta.display, fontWeight: 700, fontSize: 17, color: paleta.ink,
            margin: "0 0 14px",
          }}
        >
          {modo === "entrar" ? "Entra en tu cuenta" : "Crea tu cuenta"}
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

        {error && <p style={{ color: paleta.coral, fontSize: 13.5, lineHeight: 1.5, margin: "12px 0 0" }}>{error}</p>}
        {aviso && <p style={{ color: paleta.acento, fontSize: 13.5, lineHeight: 1.5, margin: "12px 0 0" }}>{aviso}</p>}

        <button
          onClick={enviar}
          disabled={ocupado}
          style={{
            width: "100%", marginTop: 16, border: "none", borderRadius: 16, padding: "15px 0",
            background: paleta.acento, color: "#fff", fontFamily: paleta.display, fontWeight: 700,
            fontSize: 16, cursor: ocupado ? "default" : "pointer", opacity: ocupado ? 0.6 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
          }}
        >
          <LogIn size={18} strokeWidth={2.4} />
          {ocupado ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear cuenta"}
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <button
            onClick={() => { setModo(modo === "entrar" ? "registrar" : "entrar"); setError(null); setAviso(null); }}
            style={{ background: "none", border: "none", color: paleta.acento, fontFamily: paleta.body, fontWeight: 600, fontSize: 13.5, cursor: "pointer", padding: "10px 0" }}
          >
            {modo === "entrar" ? "No tengo cuenta" : "Ya tengo cuenta"}
          </button>
          {modo === "entrar" && (
            <button
              onClick={olvidada}
              style={{ background: "none", border: "none", color: paleta.faint, fontFamily: paleta.body, fontWeight: 600, fontSize: 13.5, cursor: "pointer", padding: "10px 0" }}
            >
              Olvidé la contraseña
            </button>
          )}
        </div>
      </div>

      <p style={{ color: paleta.faint, fontSize: 12, lineHeight: 1.55, textAlign: "center", margin: "18px 4px 0" }}>
        Tus datos son solo tuyos: van asociados a tu cuenta y nadie más puede verlos.
        Entra con el mismo correo en el móvil y en el ordenador para tenerlos en los dos.
      </p>
    </Marco>
  );
}

function SinConfigurar({ paleta }) {
  return (
    <Marco paleta={paleta}>
      <div style={{ background: paleta.card, borderRadius: 24, boxShadow: paleta.sombra, padding: 22, textAlign: "center" }}>
        <CloudOff size={26} color={paleta.faint} strokeWidth={2} />
        <p style={{ fontFamily: paleta.display, fontWeight: 700, fontSize: 17, color: paleta.ink, margin: "12px 0 8px" }}>
          Falta configurar Firebase
        </p>
        <p style={{ color: paleta.mid, fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>
          La aplicación guarda todo en tu cuenta, así que no puede funcionar sin ella. Rellena{" "}
          <code style={{ fontFamily: paleta.mono, fontSize: 12.5 }}>config.js</code> con los datos de tu
          proyecto de Firebase; está explicado paso a paso en el archivo{" "}
          <code style={{ fontFamily: paleta.mono, fontSize: 12.5 }}>README.md</code>.
        </p>
      </div>
    </Marco>
  );
}
