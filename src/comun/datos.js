/* ─────────────────────────────────────────────────────────────────────────
   El puente entre Firestore y la pantalla.

   Regla de la casa: la pantalla no guarda nada, solo dibuja lo que le llega
   de Firestore. Cuando apuntas algo se escribe en Firestore y es la propia
   Firestore la que devuelve el cambio y repinta. No hay copia paralela en
   memoria que pueda quedarse desincronizada, ni caché local propia, ni estado
   que sobreviva a un cambio de cuenta.

   Todo cuelga del UID. Si el UID cambia, este hook tira lo que tenía y vuelve
   a preguntar desde cero.
   ───────────────────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nuevoId } from "./id.js";
import {
  borrarRegistro,
  borrarTodo,
  escucharColeccion,
  escucharUsuario,
  guardarCampos,
  guardarLote,
  guardarRegistro,
} from "./nube.js";

const vacias = (colecciones) => Object.fromEntries(colecciones.map((c) => [c, []]));

/**
 * @param {object} opciones
 * @param {string} opciones.uid          usuario autenticado
 * @param {string[]} opciones.colecciones  qué colecciones necesita esta app
 */
export function useDatos({ uid, colecciones }) {
  const nombres = useMemo(() => [...colecciones], [colecciones.join("|")]);

  const [registros, setRegistros] = useState(() => vacias(nombres));
  const [usuario, setUsuario] = useState({});
  const [listo, setListo] = useState(false);
  const [error, setError] = useState(null);
  const [estado, setEstado] = useState("conectando");

  const pendientes = useRef(0);

  useEffect(() => {
    /* Cambio de usuario (o de sesión a ninguna): lo primero es vaciar. Nada de
       lo que hubiera en pantalla pertenece ya a quien está ahora. */
    setRegistros(vacias(nombres));
    setUsuario({});
    setListo(false);
    setError(null);
    setEstado(uid ? "conectando" : "sin-sesion");

    if (!uid) return;

    let vivo = true;
    const faltan = new Set(["usuario", ...nombres]);

    const yaEsta = (que) => {
      faltan.delete(que);
      if (vivo && faltan.size === 0) setListo(true);
    };

    /* Lo que llega de Firestore no puede pisar un "guardando" en curso ni un
       error: solo confirma que lo que se ve ya está en el servidor. */
    const llegoDelServidor = (deCache) => {
      if (deCache) return;
      setEstado((e) => (e === "error" || e === "guardando" ? e : "al-dia"));
    };

    /*
     * Una colección que falla no puede llevarse por delante a las demás.
     *
     * `listo` esperaba a que TODAS contestaran, así que si una sola era
     * rechazada —una colección nueva cuyas reglas aún no se han publicado, por
     * ejemplo— la aplicación entera se quedaba en «Cargando tus datos…» para
     * siempre, con el peso y las comidas ya descargados y sin poder verlos.
     *
     * Ahora la que falla se da por contestada con la lista vacía: se pierde
     * esa colección, no la aplicación. El error se sigue enseñando arriba, que
     * para eso está, y en cuanto se arregle lo de fuera vuelve sola.
     */
    const fallo = (que) => (e) => {
      if (!vivo) return;
      setError(
        e && e.code === "permission-denied"
          ? "Firestore está rechazando la lectura. Revisa las reglas de seguridad."
          : "No se ha podido conectar con la base de datos."
      );
      setEstado("error");
      if (que) yaEsta(que);
    };

    const paradas = [
      escucharUsuario(
        uid,
        (datos, meta) => {
          if (!vivo) return;
          setUsuario(datos);
          llegoDelServidor(meta.deCache);
          yaEsta("usuario");
        },
        fallo("usuario")
      ),
      ...nombres.map((nombre) =>
        escucharColeccion(
          uid,
          nombre,
          (lista, meta) => {
            if (!vivo) return;
            setRegistros((previo) => ({ ...previo, [nombre]: lista }));
            llegoDelServidor(meta.deCache);
            yaEsta(nombre);
          },
          fallo(nombre)
        )
      ),
    ];

    return () => {
      vivo = false;
      for (const parar of paradas) parar();
    };
  }, [uid, nombres]);

  /* ── escrituras: directas a Firestore, sin pasar por la pantalla ───────── */

  /* Con la caché persistente activada, `setDoc` no resuelve hasta que el
     servidor confirma. Sin conexión el cambio se ve al momento (Firestore lo
     aplica en local y lo reenvía luego), pero el aviso sigue diciendo
     "Guardando…", que es la verdad: aún no está a salvo en la cuenta. */
  const conAviso = useCallback(async (tarea) => {
    pendientes.current += 1;
    setEstado("guardando");
    let salioMal = false;
    try {
      await tarea();
    } catch (e) {
      console.warn(e);
      salioMal = true;
      setError(
        e && e.code === "permission-denied"
          ? "Firestore ha rechazado el guardado. Revisa las reglas de seguridad."
          : "No se ha podido guardar. Se reintentará solo al recuperar la conexión."
      );
    } finally {
      // Nunca por debajo de cero: si se cambia de cuenta con algo a medias,
      // el contador tiene que poder volver a cuadrar y no quedarse encallado.
      pendientes.current = Math.max(0, pendientes.current - 1);
      // "Guardado" solo cuando no queda nada en el aire.
      if (pendientes.current === 0) {
        if (salioMal) setEstado("error");
        else { setError(null); setEstado("al-dia"); }
      }
    }
  }, []);

  const guardar = useCallback(
    (coleccion, registro) => {
      if (!uid) return null;
      const id = registro.id || nuevoId();
      conAviso(() => guardarRegistro(uid, coleccion, id, { ...registro, id }));
      return id;
    },
    [uid, conAviso]
  );

  const borrar = useCallback(
    (coleccion, id) => {
      if (!uid || !id) return;
      conAviso(() => borrarRegistro(uid, coleccion, id));
    },
    [uid, conAviso]
  );

  const guardarUsuario = useCallback(
    (campos) => {
      if (!uid) return;
      conAviso(() => guardarCampos(uid, campos));
    },
    [uid, conAviso]
  );

  const importar = useCallback(
    (porColeccion, campos) =>
      new Promise((res, rej) => {
        if (!uid) return rej(new Error("Sin usuario"));
        conAviso(async () => {
          await guardarLote(uid, porColeccion);
          if (campos) await guardarCampos(uid, campos);
        }).then(res, rej);
      }),
    [uid, conAviso]
  );

  /** Borra todo lo del usuario. `campos` deja los del documento como se pida. */
  const vaciar = useCallback(
    (campos) =>
      new Promise((res, rej) => {
        if (!uid) return rej(new Error("Sin usuario"));
        conAviso(async () => {
          await borrarTodo(uid, nombres);
          await guardarCampos(uid, { perfil: null, ajustes: null, sembrado: null, ...campos });
        }).then(res, rej);
      }),
    [uid, nombres, conAviso]
  );

  return { registros, usuario, listo, error, estado, guardar, borrar, guardarUsuario, importar, vaciar };
}
