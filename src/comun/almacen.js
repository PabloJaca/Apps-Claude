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
 * Decide qué hacer con lo que llega de la nube.
 *
 * Está fuera del hook y sin efectos secundarios a propósito: es la parte
 * delicada de toda la sincronización y así se puede probar sin navegador.
 *
 * @returns {{guardar: object|null, subir: object|null, alDia: boolean}}
 */
export function reconciliar({ local, remoto, deCache, esquema }) {
  if (!remoto) {
    /* «No hay documento» solo vale si lo dice el servidor: la caché de un
       dispositivo recién estrenado también responde que no hay nada, y sembrar
       ahí borraría en la nube lo que haya subido el otro dispositivo. */
    if (deCache) return { guardar: null, subir: null, alDia: false };
    return { guardar: null, subir: local, alDia: true };
  }

  const fusionado = fusionar(local, remoto, esquema);
  const jFusion = JSON.stringify(fusionado);
  const cambiaAqui = jFusion !== JSON.stringify(local);
  const faltaArriba = jFusion !== JSON.stringify(remoto);

  return {
    guardar: cambiaAqui ? fusionado : null,
    subir: faltaArriba ? fusionado : null,
    alDia: !faltaArriba,
  };
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
      (remoto, meta) => {
        if (!vivo) return;

        const plan = reconciliar({
          local: ref.current,
          remoto,
          deCache: Boolean(meta && meta.deCache),
          esquema,
        });

        if (plan.guardar) {
          ref.current = plan.guardar;
          ponDatos(plan.guardar);
          escribirLocal(clave, plan.guardar);
        }

        if (plan.subir) {
          /* Se limpia la marca de lo último publicado: lo que hay arriba ya no
             es lo que creíamos, así que este envío no puede darse por repetido. */
          publicado.current = "";
          subir(plan.subir);
        } else if (plan.alDia) {
          publicado.current = JSON.stringify(ref.current);
          setEstado("al-dia");
        } else {
          setEstado("sincronizando");
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
