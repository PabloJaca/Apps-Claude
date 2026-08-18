/* ─────────────────────────────────────────────────────────────────────────
   Nube: Firebase Authentication + Cloud Firestore.

   Firestore es la única fuente de verdad. Aquí no se guarda nada por libre:
   cada registro es un documento dentro del usuario que lo creó, y toda ruta
   empieza por su UID, de modo que es imposible por construcción que dos
   cuentas se toquen.

       usuarios/{uid}                    → perfil y ajustes
       usuarios/{uid}/pesos/{id}
       usuarios/{uid}/entrenos/{id}
       usuarios/{uid}/comidas/{id}
       usuarios/{uid}/gastos/{id}
       usuarios/{uid}/fijos/{id}
       usuarios/{uid}/categorias/{id}

   Un registro por documento, no listas dentro de un documento gordo. Con eso
   los conflictos entre dispositivos los resuelve Firestore sola: dos móviles
   escribiendo cosas distintas escriben en documentos distintos y no se pisan.

   La configuración se lee de `window.MISAPPS_FIREBASE`, que pone `config.js`
   en la raíz del sitio, para poder cambiarla sin recompilar.
   ───────────────────────────────────────────────────────────────────────── */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  clearIndexedDbPersistence,
  terminate,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
} from "firebase/firestore";

const CLAVES = ["apiKey", "authDomain", "projectId", "appId"];

/** Colecciones permitidas. Sirve de red: nadie escribe fuera de esta lista. */
export const COLECCIONES = ["pesos", "entrenos", "comidas", "plantillas", "gastos", "ingresos", "fijos", "categorias"];

/** Firestore admite 500 operaciones por lote; se deja margen. */
const TOPE_LOTE = 450;

function leerConfig() {
  const c = typeof window !== "undefined" ? window.MISAPPS_FIREBASE : null;
  if (!c) return null;
  const completa = CLAVES.every((k) => typeof c[k] === "string" && c[k] && !c[k].startsWith("PON_"));
  return completa ? c : null;
}

export const hayNube = () => leerConfig() !== null;

let cache = null;

function servicios() {
  if (cache) return cache;
  const config = leerConfig();
  if (!config) return null;
  try {
    const app = initializeApp(config);
    const auth = getAuth(app);
    // La sesión sobrevive al cierre de la app: no hay que entrar cada vez.
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    const db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    cache = { app, auth, db };
    return cache;
  } catch (e) {
    console.warn("Firebase no ha podido arrancar:", e);
    return null;
  }
}

/* ── sesión ──────────────────────────────────────────────────────────────── */

export function alCambiarSesion(cb) {
  const s = servicios();
  if (!s) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(s.auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null));
}

/* Los fallos de acceso dicen todos lo mismo a propósito. Distinguir «no hay
   ninguna cuenta con ese correo» de «contraseña incorrecta» permite averiguar
   quién está registrado probando correos, que es información de la gente que
   usa la app y no tiene por qué darse. */
const CREDENCIAL = "Correo o contraseña incorrectos.";

const MENSAJES = {
  "auth/invalid-email": "Ese correo no tiene buena pinta.",
  "auth/user-not-found": CREDENCIAL,
  "auth/wrong-password": CREDENCIAL,
  "auth/invalid-credential": CREDENCIAL,
  "auth/invalid-login-credentials": CREDENCIAL,
  "auth/email-already-in-use": "No se ha podido crear la cuenta. Si ya la tienes, entra con ella.",
  "auth/weak-password": "La contraseña necesita al menos 8 caracteres.",
  "auth/too-many-requests": "Demasiados intentos. Espera un minuto y vuelve a probar.",
  "auth/network-request-failed": "Sin conexión. Comprueba la red y vuelve a intentarlo.",
  "auth/operation-not-allowed": "Falta activar el acceso por correo en la consola de Firebase.",
};

const traducir = (e) => MENSAJES[e && e.code] || "No se ha podido completar. Inténtalo otra vez.";

/** El correo es la identidad y la clave de la lista: siempre en minúsculas. */
const normalizar = (email) => String(email || "").trim().toLowerCase();

export async function entrar(email, clave) {
  const s = servicios();
  if (!s) throw new Error("Sin configuración de Firebase.");
  try {
    await signInWithEmailAndPassword(s.auth, normalizar(email), clave);
  } catch (e) {
    throw new Error(traducir(e));
  }
}

/** Se lanza cuando la cuenta existe pero el correo no está en la lista. */
export const ERROR_SIN_INVITACION = "sin-invitacion";

export async function registrar(email, clave) {
  const s = servicios();
  if (!s) throw new Error("Sin configuración de Firebase.");

  let cred;
  try {
    cred = await createUserWithEmailAndPassword(s.auth, normalizar(email), clave);
  } catch (e) {
    throw new Error(traducir(e));
  }

  /* La cuenta ya existe en Authentication, pero sin invitación no puede
     escribir nada: las reglas lo rechazan. Se avisa aquí para no dejar a nadie
     mirando un error de permisos que no significa nada para quien lo lee. */
  try {
    await setDoc(
      doc(s.db, "usuarios", cred.user.uid),
      { email: cred.user.email, creado: Date.now() },
      { merge: true }
    );
  } catch (e) {
    if (e && e.code === "permission-denied") throw new Error(ERROR_SIN_INVITACION);
    throw new Error("La cuenta se ha creado, pero no se han podido guardar tus datos.");
  }
}

/**
 * Enviar el enlace para cambiar la contraseña.
 *
 * Nunca dice si el correo existe o no: se responde igual en los dos casos.
 * Si no existiera, aquí se sabría quién tiene cuenta con solo escribir correos.
 */
export async function recuperar(email) {
  const s = servicios();
  if (!s) throw new Error("Sin configuración de Firebase.");
  try {
    await sendPasswordResetEmail(s.auth, normalizar(email));
  } catch (e) {
    const inocuo = ["auth/user-not-found", "auth/invalid-credential"];
    if (inocuo.includes(e && e.code)) return;
    throw new Error(traducir(e));
  }
}

/**
 * ¿Está este correo en la lista de invitados?
 *
 * Es solo para poder enseñar un mensaje decente: quien manda son las reglas,
 * que comprueban lo mismo en el servidor en cada lectura y cada escritura. Por
 * eso, si la comprobación falla (sin cobertura, por ejemplo), se deja pasar:
 * no se gana nada cerrando aquí una puerta que ya está cerrada por dentro.
 */
export async function estaInvitado(email) {
  const s = servicios();
  if (!s) return true;
  try {
    const snap = await getDoc(doc(s.db, "permitidos", normalizar(email)));
    return snap.exists();
  } catch (e) {
    console.warn("No se ha podido comprobar la lista de invitados:", e);
    return true;
  }
}

/**
 * Cierra sesión y deja el dispositivo sin un solo rastro del usuario anterior.
 *
 * No basta con `signOut`: Firestore mantiene una caché en el navegador y la
 * aplicación mantiene su estado en memoria. Se cierra la conexión, se borra la
 * caché y se recarga la página, que es la única forma de garantizar que no
 * queda nada de la cuenta anterior en pantalla ni en el disco.
 */
export async function salir() {
  const s = servicios();
  if (!s) return;
  try {
    await signOut(s.auth);
  } catch (e) {
    /* aunque falle, seguimos limpiando */
  }
  try {
    await terminate(s.db);
    await clearIndexedDbPersistence(s.db);
  } catch (e) {
    /* si otra pestaña la tiene abierta no se puede borrar; la recarga basta */
  }
  if (typeof window !== "undefined") window.location.reload();
}

/* ── lectura: siempre dentro del usuario ─────────────────────────────────── */

function comprobar(uid, coleccion) {
  if (!uid) throw new Error("Sin usuario: no se puede tocar Firestore.");
  if (coleccion && !COLECCIONES.includes(coleccion)) {
    throw new Error(`Colección no permitida: ${coleccion}`);
  }
}

/** Escucha una colección del usuario. Devuelve la función para dejar de oír. */
export function escucharColeccion(uid, coleccion, alRecibir, alFallar) {
  const s = servicios();
  if (!s) return () => {};
  comprobar(uid, coleccion);

  return onSnapshot(
    collection(s.db, "usuarios", uid, coleccion),
    (snap) => {
      const registros = [];
      snap.forEach((d) => registros.push({ id: d.id, ...d.data() }));
      alRecibir(registros, { deCache: snap.metadata.fromCache });
    },
    (e) => {
      console.warn(`Firestore (${coleccion}):`, e);
      if (alFallar) alFallar(e);
    }
  );
}

/** Escucha el documento del usuario, donde viven el perfil y los ajustes. */
export function escucharUsuario(uid, alRecibir, alFallar) {
  const s = servicios();
  if (!s) return () => {};
  comprobar(uid);

  return onSnapshot(
    doc(s.db, "usuarios", uid),
    (snap) => alRecibir(snap.data() || {}, { deCache: snap.metadata.fromCache }),
    (e) => {
      console.warn("Firestore (usuario):", e);
      if (alFallar) alFallar(e);
    }
  );
}

/* ── escritura: un documento por registro ────────────────────────────────── */

/**
 * Firestore rechaza `undefined` con una excepción, y un campo que a veces no
 * está (`gasto?.id` al crear uno nuevo) es de lo más normal en un formulario.
 * Se quitan aquí, de una vez, para que ninguna pantalla tenga que acordarse:
 * un campo ausente y un campo sin valor son lo mismo. `null` sí viaja, porque
 * ahí sí se está diciendo algo ("este fijo no tiene fecha de baja").
 */
function sinIndefinidos(datos) {
  const salida = {};
  for (const [clave, valor] of Object.entries(datos)) {
    if (valor === undefined) continue;
    salida[clave] =
      valor && typeof valor === "object" && !Array.isArray(valor) ? sinIndefinidos(valor) : valor;
  }
  return salida;
}

/** El id es el nombre del documento, no un campo suyo: se quita al guardar. */
function paraFirestore(datos) {
  const { id, ...resto } = datos;
  return sinIndefinidos(resto);
}

export async function guardarRegistro(uid, coleccion, id, datos) {
  const s = servicios();
  if (!s) throw new Error("Sin configuración de Firebase.");
  comprobar(uid, coleccion);
  await setDoc(doc(s.db, "usuarios", uid, coleccion, id), paraFirestore(datos));
}

export async function borrarRegistro(uid, coleccion, id) {
  const s = servicios();
  if (!s) throw new Error("Sin configuración de Firebase.");
  comprobar(uid, coleccion);
  await deleteDoc(doc(s.db, "usuarios", uid, coleccion, id));
}

/** Actualiza campos sueltos del usuario (perfil, ajustes) sin tocar el resto. */
export async function guardarCampos(uid, campos) {
  const s = servicios();
  if (!s) throw new Error("Sin configuración de Firebase.");
  comprobar(uid);
  await setDoc(
    doc(s.db, "usuarios", uid),
    { ...sinIndefinidos(campos), actualizado: Date.now() },
    { merge: true }
  );
}

/** Escribe muchos registros de golpe. Se usa al importar datos antiguos. */
export async function guardarLote(uid, porColeccion) {
  const s = servicios();
  if (!s) throw new Error("Sin configuración de Firebase.");
  comprobar(uid);

  const tareas = [];
  let lote = writeBatch(s.db);
  let cuenta = 0;

  for (const [coleccion, registros] of Object.entries(porColeccion)) {
    comprobar(uid, coleccion);
    for (const registro of registros) {
      lote.set(doc(s.db, "usuarios", uid, coleccion, registro.id), paraFirestore(registro));
      cuenta++;
      if (cuenta === TOPE_LOTE) {
        tareas.push(lote.commit());
        lote = writeBatch(s.db);
        cuenta = 0;
      }
    }
  }
  if (cuenta > 0) tareas.push(lote.commit());
  await Promise.all(tareas);
}

/**
 * Borra todo lo del usuario. Solo desde la pantalla de cuenta, con confirmación.
 *
 * Se lee con `getDocs` a propósito, no escuchando: hay que ver la lista entera
 * y de una vez. Escuchando, la primera respuesta puede venir de la caché y
 * llegar incompleta, y se quedarían registros vivos creyendo que se ha borrado
 * todo, que es la peor manera posible de fallar.
 */
export async function borrarTodo(uid, colecciones) {
  const s = servicios();
  if (!s) throw new Error("Sin configuración de Firebase.");
  comprobar(uid);

  for (const coleccion of colecciones) {
    comprobar(uid, coleccion);
    const snap = await getDocs(collection(s.db, "usuarios", uid, coleccion));

    let lote = writeBatch(s.db);
    let cuenta = 0;
    for (const d of snap.docs) {
      lote.delete(d.ref);
      cuenta++;
      if (cuenta === TOPE_LOTE) {
        await lote.commit();
        lote = writeBatch(s.db);
        cuenta = 0;
      }
    }
    if (cuenta > 0) await lote.commit();
  }
}

export function nombreDispositivo() {
  if (typeof navigator === "undefined") return "desconocido";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "otro";
}
