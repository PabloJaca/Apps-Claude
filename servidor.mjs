/* Servidor estático mínimo para probar el sitio en local:  node servidor.mjs
   No hace falta para desplegar: el sitio son archivos sueltos. */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const raiz = path.join(path.dirname(new URL(import.meta.url).pathname), "sitio");
const puerto = Number(process.env.PUERTO || 4173);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (ruta.endsWith("/")) ruta += "index.html";
    const archivo = path.join(raiz, path.normalize(ruta).replace(/^(\.\.[/\\])+/, ""));
    const cuerpo = await readFile(archivo);
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(cuerpo);
  } catch (e) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("No encontrado");
  }
}).listen(puerto, () => console.log(`Sitio en http://localhost:${puerto}`));
