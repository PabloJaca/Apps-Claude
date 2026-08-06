/* ─────────────────────────────────────────────────────────────────────────
   Almacén: el sitio del que beben las dos apps.

   Funciona primero en local (localStorage) y, si hay cuenta iniciada, además
   sincroniza contra Firestore fusionando registro a registro. Orden de
   prioridades, en este orden:

     1. Que la app abra al instante y funcione sin internet.
     2. Que no se pierda un dato jamás.
     3. Que los dos dispositivos acaben viendo lo mismo.
   ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useRef, useState } from "react";
import { fusionar } from "./fusion.js";
import { alCambiarSesion, escuchar, hayNube, publicar } from "./nube.js";

function leerLocal(clave) {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? JSON.parse(crudo) : null;
  } catch (e) {
    return null;
  }
}

function escribirLocal(clave, datos) {
  try {
    localStorage.setItem(clave, JSON.stringify(datos));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * @param {object} opciones
 * @param {string} opciones.clave    clave de localStorage
 * @param {string} opciones.app      nombre del documento en Firestore
 * @param {object} opciones.vacio    estado inicial
 * @param {object} opciones.esquema  { colecciones: [], sellos: [] }
 * @param {function} opciones.migrar normaliza lo que había guardado antes
 */
export function useAlmacen({ clave, app, vacio, esquema, migrar }) {
  const [datos, ponDatos] = useState(vacio);
  const [listo, setListo] = useState(false);
  const [sesion, setSesion] = useState(undefined); // undefined = aún comprobando
  const [estado, setEstado] = useState(hayNube() ? "conectando" : "local");
  const [falloGuardado, setFalloGuardado] = useState(false);

  const ref = useRef(vacio);
  const publicado = useRef("");
  const temporizador = useRef(null);
  const sesionRef = useRef(null);

  /* ── arranque: lo local, ya ──────────────────────────────────────────── */
  useEffect(() => {
    const guardado = migrar(leerLocal(clave));
    ref.current = guardado;
    ponDatos(guardado);
    setListo(true);
  }, [clave, migrar]);

  /* ── sesión ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!hayNube()) {
      setSesion(null);
      return;
    }
    return alCambiarSesion((u) => {
      sesionRef.current = u;
      setSesion(u);
      setEstado(u ? "sincronizando" : "local");
    });
  }, []);

  const subir = useCallback(
    async (valor) => {
      const u = sesionRef.current;
      if (!u) return;
      const json = JSON.stringify(valor);
      if (json === publicado.current) return;
      publicado.current = json;
      try {
        await publicar(app, u.uid, valor);
        setEstado("al-dia");
      } catch (e) {
        publicado.current = "";
        setEstado("error");
      }
    },
    [app]
  );

  /* ── lo que llega de otros dispositivos ──────────────────────────────── */
  useEffect(() => {
    if (!listo || !sesion) return;
    let vivo = true;

    const parar = escuchar(
      app,
      sesion.uid,
      (remoto) => {
        if (!vivo) return;
        if (!remoto) {
          // Documento nuevo: este dispositivo siembra lo que tenga.
          subir(ref.current);
          setEstado("al-dia");
          return;
        }
        const fusionado = fusionar(ref.current, remoto, esquema);
        const jFusion = JSON.stringify(fusionado);

        if (jFusion !== JSON.stringify(ref.current)) {
          ref.current = fusionado;
          ponDatos(fusionado);
          escribirLocal(clave, fusionado);
        }
        if (jFusion !== JSON.stringify(remoto)) {
          // Teníamos cosas que allí no estaban: las devolvemos.
          subir(fusionado);
        } else {
          publicado.current = jFusion;
          setEstado("al-dia");
        }
      },
      () => vivo && setEstado("error")
    );

    return () => {
      vivo = false;
      parar();
    };
  }, [listo, sesion, app, clave, esquema, subir]);

  /* ── cambios locales: guardar y publicar ─────────────────────────────── */
  const actualizar = useCallback(
    (cambio) => {
      ponDatos((previo) => {
        const nuevo = typeof cambio === "function" ? cambio(previo) : cambio;
        ref.current = nuevo;

        setFalloGuardado(!escribirLocal(clave, nuevo));

        clearTimeout(temporizador.current);
        if (sesionRef.current) {
          setEstado("sincronizando");
          temporizador.current = setTimeout(() => subir(nuevo), 500);
        }
        return nuevo;
      });
    },
    [clave, subir]
  );

  useEffect(() => () => clearTimeout(temporizador.current), []);

  return {
    datos,
    actualizar,
    listo,
    sesion,
    estado: sesion ? estado : hayNube() ? "local" : "sin-nube",
    falloGuardado,
    reemplazar: actualizar,
  };
}
