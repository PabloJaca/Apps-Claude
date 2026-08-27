/* Service worker generado por build.mjs. No editar a mano: se reescribe en cada compilación.

   Estrategia: la red primero para lo que ES la aplicación —el HTML, `app.js` y
   `config.js`—, para que una versión nueva se vea en el primer arranque y no en
   el segundo. Caché primero con refresco en segundo plano para lo que no
   cambia: iconos y manifiesto. Sin conexión, todo tira de lo guardado.

   Los datos NO pasan por aquí: viven en Firestore, dentro de la cuenta de cada
   persona. Este archivo solo guarda la aplicación, nunca lo que apuntas.

   El alcance se saca de `self.registration.scope`, así que el sitio funciona
   igual colgado en la raíz del dominio que en un subdirectorio. */

const CACHE = "gastos-339d4b99";
const PREFIJO = "gastos-";
const ARCHIVOS = ["./","./index.html","./app.js","./manifest.json","../config.js","./icono-180.png","./icono-192.png","./icono-512.png"];
const EXCLUIR = [];

const ALCANCE = new URL(self.registration.scope).pathname;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(ARCHIVOS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE && k.startsWith(PREFIJO)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const esDocumento = (req) => req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

const guardar = (req, resp) => {
  const copia = resp.clone();
  caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
  return resp;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // fuentes, Firebase… van directas
  if (!url.pathname.startsWith(ALCANCE)) return;
  const resto = url.pathname.slice(ALCANCE.length);
  if (EXCLUIR.some((carpeta) => resto.startsWith(carpeta))) return; // eso lo lleva otro service worker

  /* `app.js` va por red primero, igual que el HTML.
     Estaba en la rama de «caché primero con refresco detrás», y eso significa
     que tras cada publicación se servía la versión ANTERIOR y la nueva solo
     quedaba guardada para el arranque siguiente: la app iba siempre un
     arranque por detrás y no había forma de forzarla desde fuera. Cerrarla del
     todo no servía de nada, porque el problema no era la pestaña.
     El coste es una petición por arranque, que con ETag suele ser un 304 de
     unos pocos bytes; y sin conexión sigue tirando de lo guardado. */
  if (esDocumento(req) || resto === "config.js" || resto === "app.js") {
    e.respondWith(
      fetch(req)
        .then((resp) => guardar(req, resp))
        .catch(() => caches.match(req).then((r) => r || caches.match(`${ALCANCE}index.html`)))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((enCache) => {
      const red = fetch(req)
        .then((resp) => guardar(req, resp))
        .catch(() => enCache);
      return enCache || red;
    })
  );
});
