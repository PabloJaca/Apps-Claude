/* ─────────────────────────────────────────────────────────────────────────
   Nube: Firebase (cuenta + Firestore) para tener los mismos datos en el
   móvil y en el PC.

   La configuración NO va dentro del bundle: se lee de `window.MISAPPS_FIREBASE`,
   que pone `config.js` en la raíz del sitio. Así se puede cambiar el proyecto de
   Firebase editando un archivo suelto, sin volver a compilar nada.

   Si no hay configuración, todo esto se queda dormido y las apps siguen
   funcionando en local exactamente igual que antes.
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
  doc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";

const CLAVES = ["apiKey", "authDomain", "projectId", "appId"];

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
    // La sesión se queda guardada en el dispositivo: no hay que entrar cada vez.
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

const MENSAJES = {
  "auth/invalid-email": "Ese correo no tiene buena pinta.",
  "auth/user-not-found": "No hay ninguna cuenta con ese correo.",
  "auth/wrong-password": "Contraseña incorrecta.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Entra con ella.",
  "auth/weak-password": "La contraseña necesita al menos 6 caracteres.",
  "auth/too-many-requests": "Demasiados intentos. Espera un minuto y vuelve a probar.",
  "auth/network-request-failed": "Sin conexión. Los datos se guardan igual en este dispositivo.",
  "auth/operation-not-allowed": "Falta activar el acceso por correo en la consola de Firebase.",
};

const traducir = (e) => MENSAJES[e && e.code] || "No se ha podido completar. Inténtalo otra vez.";

export async function entrar(email, clave) {
  const s = servicios();
  if (!s) throw new Error("Sin configuración de Firebase.");
  try {
    await signInWithEmailAndPassword(s.auth, email.trim(), clave);
  } catch (e) {
    throw new Error(traducir(e));
  }
}

export async function registrar(email, clave) {
  const s = servicios();
  if (!s) throw new Error("Sin configuración de Firebase.");
  try {
    await createUserWithEmailAndPassword(s.auth, email.trim(), clave);
  } catch (e) {
    throw new Error(traducir(e));
  }
}

export async function recuperar(email) {
  const s = servicios();
  if (!s) throw new Error("Sin configuración de Firebase.");
  try {
    await sendPasswordResetEmail(s.auth, email.trim());
  } catch (e) {
    throw new Error(traducir(e));
  }
}

export async function salir() {
  const s = servicios();
  if (s) await signOut(s.auth);
}

/* ── documento de cada app ───────────────────────────────────────────────── */

const referencia = (db, uid, app) => doc(db, "usuarios", uid, "apps", app);

/** Escucha los cambios que llegan de otros dispositivos. */
export function escuchar(app, uid, alRecibir, alFallar) {
  const s = servicios();
  if (!s || !uid) return () => {};
  return onSnapshot(
    referencia(s.db, uid, app),
    { includeMetadataChanges: false },
    (snap) => {
      const d = snap.data();
      alRecibir(d && d.datos ? d.datos : null, { local: snap.metadata.hasPendingWrites });
    },
    (e) => {
      console.warn("Firestore:", e);
      if (alFallar) alFallar(e);
    }
  );
}

/** Sube el estado ya fusionado. Firestore lo encola solo si no hay red. */
export async function publicar(app, uid, datos) {
  const s = servicios();
  if (!s || !uid) return;
  await setDoc(referencia(s.db, uid, app), {
    datos,
    actualizado: Date.now(),
    dispositivo: nombreDispositivo(),
  });
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
