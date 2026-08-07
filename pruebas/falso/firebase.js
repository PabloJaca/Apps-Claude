/* ─────────────────────────────────────────────────────────────────────────
   Un Firebase de mentira, en memoria, para poder probar la aplicación entera
   en un navegador sin tocar la cuenta real de nadie.

   Imita lo justo de `firebase/app`, `firebase/auth` y `firebase/firestore`
   que usa `src/comun/nube.js`. El "servidor" vive en localStorage bajo una
   clave que la aplicación no conoce, para que sobreviva a las recargas: así
   se puede cerrar sesión (que recarga la página) y entrar con otra cuenta,
   que es justo lo que hay que comprobar.

   Se enchufa con un alias de esbuild; no entra en la compilación de verdad.
   ───────────────────────────────────────────────────────────────────────── */

const SERVIDOR = "__servidor_de_mentira__";

const leerServidor = () => {
  try {
    return JSON.parse(localStorage.getItem(SERVIDOR)) || { usuarios: {}, docs: {} };
  } catch (e) {
    return { usuarios: {}, docs: {} };
  }
};
const escribirServidor = (s) => localStorage.setItem(SERVIDOR, JSON.stringify(s));

/* Registro de lo que ha pasado, para poder afirmar cosas desde las pruebas. */
if (typeof window !== "undefined") {
  window.__espia = {
    rutasLeidas: [],
    rutasEscritas: [],
    verServidor: leerServidor,
    reiniciar: () => localStorage.removeItem(SERVIDOR),
  };
}

/* ── firebase/app ────────────────────────────────────────────────────────── */

export const initializeApp = (config) => ({ config });

/* ── firebase/auth ───────────────────────────────────────────────────────── */

const SESION = "__sesion_de_mentira__";
const oyentes = new Set();

const usuarioActual = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SESION)) || null;
  } catch (e) {
    return null;
  }
};

const ponerUsuario = (u) => {
  if (u) sessionStorage.setItem(SESION, JSON.stringify(u));
  else sessionStorage.removeItem(SESION);
  for (const cb of oyentes) cb(u);
};

const fallo = (code) => Object.assign(new Error(code), { code });
const uidDe = (email) => "uid_" + email.replace(/[^a-z0-9]/gi, "_");

export const getAuth = () => ({ tipo: "auth" });
export const browserLocalPersistence = "local";
export const setPersistence = async () => {};

export function onAuthStateChanged(auth, cb) {
  oyentes.add(cb);
  // Como el de verdad: responde en otro tick, no en el mismo.
  setTimeout(() => cb(usuarioActual()), 0);
  return () => oyentes.delete(cb);
}

export async function createUserWithEmailAndPassword(auth, email, clave) {
  const s = leerServidor();
  if (s.usuarios[email]) throw fallo("auth/email-already-in-use");
  if (clave.length < 6) throw fallo("auth/weak-password");
  s.usuarios[email] = { clave, uid: uidDe(email) };
  escribirServidor(s);
  const u = { uid: uidDe(email), email };
  ponerUsuario(u);
  return { user: u };
}

export async function signInWithEmailAndPassword(auth, email, clave) {
  const s = leerServidor();
  const cuenta = s.usuarios[email];
  if (!cuenta) throw fallo("auth/user-not-found");
  if (cuenta.clave !== clave) throw fallo("auth/invalid-credential");
  const u = { uid: cuenta.uid, email };
  ponerUsuario(u);
  return { user: u };
}

export async function sendPasswordResetEmail() {}
export async function signOut() { ponerUsuario(null); }

/* ── firebase/firestore ──────────────────────────────────────────────────── */

export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const initializeFirestore = () => ({ tipo: "db" });
export const terminate = async () => {};
export const clearIndexedDbPersistence = async () => {};

/* Una ruta es la lista de tramos: doc(db,"usuarios",uid) → "usuarios/uid". */
export const doc = (db, ...tramos) => ({ tipo: "doc", ruta: tramos.join("/") });
export const collection = (db, ...tramos) => ({ tipo: "col", ruta: tramos.join("/") });

const hijosDe = (ruta) => {
  const s = leerServidor();
  const salida = [];
  for (const [clave, valor] of Object.entries(s.docs)) {
    const resto = clave.startsWith(ruta + "/") ? clave.slice(ruta.length + 1) : null;
    if (resto && !resto.includes("/")) salida.push({ id: resto, ruta: clave, datos: valor });
  }
  // El de verdad ordena por identificador de documento; esto también, para que
  // las pruebas vean el mismo orden raro que vería la aplicación publicada.
  return salida.sort((a, b) => a.id.localeCompare(b.id));
};

const avisar = () => {
  for (const cb of escuchas) cb();
};
const escuchas = new Set();

export function onSnapshot(ref, alRecibir, alFallar) {
  window.__espia.rutasLeidas.push(ref.ruta);

  const emitir = () => {
    try {
      if (ref.tipo === "col") {
        const docs = hijosDe(ref.ruta).map((d) => ({
          id: d.id,
          data: () => d.datos,
          ref: { tipo: "doc", ruta: d.ruta },
        }));
        alRecibir({
          docs,
          forEach: (f) => docs.forEach(f),
          metadata: { fromCache: false },
        });
      } else {
        const s = leerServidor();
        alRecibir({ data: () => s.docs[ref.ruta], metadata: { fromCache: false } });
      }
    } catch (e) {
      if (alFallar) alFallar(e);
    }
  };

  escuchas.add(emitir);
  setTimeout(emitir, 0);
  return () => escuchas.delete(emitir);
}

export async function getDoc(ref) {
  window.__espia.rutasLeidas.push(ref.ruta);
  if (!puede(ref.ruta)) throw denegado();
  const s = leerServidor();
  const datos = s.docs[ref.ruta];
  return { exists: () => datos !== undefined, data: () => datos, metadata: { fromCache: false } };
}

export async function getDocs(ref) {
  window.__espia.rutasLeidas.push(ref.ruta);
  if (!puede(ref.ruta)) throw denegado();
  const docs = hijosDe(ref.ruta).map((d) => ({ id: d.id, data: () => d.datos, ref: { tipo: "doc", ruta: d.ruta } }));
  return { docs, forEach: (f) => docs.forEach(f) };
}

/* La lista de invitados, igual que en las reglas de verdad: sin documento en
   `permitidos` no se llega a nada. Sin excepciones ni atajos, porque si aquí
   fuese más blando que el servidor las pruebas dejarían de valer. */
const invitado = () => {
  const u = usuarioActual();
  return !!u && !!leerServidor().docs[`permitidos/${String(u.email).toLowerCase()}`];
};

const denegado = () => Object.assign(new Error("permission-denied"), { code: "permission-denied" });

const puede = (ruta) => {
  const u = usuarioActual();
  if (!u) return false;
  if (ruta.startsWith("permitidos/")) return ruta === `permitidos/${String(u.email).toLowerCase()}`;
  return ruta === `usuarios/${u.uid}` || ruta.startsWith(`usuarios/${u.uid}/`) ? invitado() : false;
};

const comprobarValores = (datos, ruta) => {
  for (const [clave, valor] of Object.entries(datos)) {
    if (valor === undefined) throw new Error(`Firestore no admite undefined: ${ruta}.${clave}`);
    if (valor && typeof valor === "object" && !Array.isArray(valor)) comprobarValores(valor, `${ruta}.${clave}`);
  }
};

export async function setDoc(ref, datos, opciones) {
  comprobarValores(datos, ref.ruta);
  if (!puede(ref.ruta) || ref.ruta.startsWith("permitidos/")) throw denegado();
  window.__espia.rutasEscritas.push(ref.ruta);
  const s = leerServidor();
  s.docs[ref.ruta] = opciones && opciones.merge ? { ...(s.docs[ref.ruta] || {}), ...datos } : datos;
  escribirServidor(s);
  avisar();
}

export async function deleteDoc(ref) {
  if (!puede(ref.ruta)) throw denegado();
  window.__espia.rutasEscritas.push(ref.ruta);
  const s = leerServidor();
  delete s.docs[ref.ruta];
  escribirServidor(s);
  avisar();
}

export function writeBatch() {
  const tareas = [];
  return {
    set: (ref, datos) => tareas.push(() => setDoc(ref, datos)),
    delete: (ref) => tareas.push(() => deleteDoc(ref)),
    commit: async () => { for (const t of tareas) await t(); },
  };
}
