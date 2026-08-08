/* Service worker generado por build.mjs. No editar a mano: se reescribe en cada compilación.

   Estrategia: la red primero para el HTML y para config.js (así una versión nueva
   o un cambio de configuración se ven enseguida) y caché primero con refresco en
   segundo plano para lo pesado. Sin conexión, tira de lo guardado.

   Los datos NO pasan por aquí: viven en Firestore, dentro de la cuenta de cada
   persona. Este archivo solo guarda la aplicación, nunca lo que apuntas.

   El alcance se saca de `self.registration.scope`, así que el sitio funciona
   igual colgado en la raíz del dominio que en un subdirectorio. */

const CACHE = "gastos-27b44118";
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

  if (esDocumento(req) || resto === "config.js") {
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
