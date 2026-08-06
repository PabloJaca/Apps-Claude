/* ─────────────────────────────────────────────────────────────────────────
   Compilación del sitio.

     node build.mjs           compila una vez
     node build.mjs --watch   recompila al guardar
     node build.mjs --zip     compila y regenera mis-apps.zip

   Deja en /sitio todo lo que hay que subir al hosting, tal cual.
   ───────────────────────────────────────────────────────────────────────── */

import * as esbuild from "esbuild";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile, stat } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

const raiz = path.dirname(new URL(import.meta.url).pathname);
const ejecutar = promisify(execFile);

const observar = process.argv.includes("--watch");
const empaquetar = process.argv.includes("--zip");

const APPS = [
  {
    nombre: "gastos",
    entrada: "src/gastos/main.jsx",
    salida: "sitio/gastos/app.js",
    archivos: ["./", "./index.html", "./app.js", "./manifest.json", "../config.js",
      "./icono-180.png", "./icono-192.png", "./icono-512.png"],
    excluir: [],
  },
  {
    nombre: "salud",
    entrada: "src/salud/main.jsx",
    salida: "sitio/salud/app.js",
    archivos: ["./", "./index.html", "./app.js", "./manifest.json", "../config.js",
      "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./favicon-32.png"],
    excluir: [],
  },
];

const HUB = {
  nombre: "hub",
  archivos: ["./", "./index.html", "./manifest.json", "./config.js",
    "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"],
  excluir: ["gastos/", "salud/"],
};

const opciones = (app) => ({
  entryPoints: [path.join(raiz, app.entrada)],
  outfile: path.join(raiz, app.salida),
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020", "safari14"],
  jsx: "automatic",
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});

async function escribirServiceWorker({ nombre, archivos, excluir }, destino, hash) {
  const plantilla = await readFile(path.join(raiz, "src/plantillas/sw.js"), "utf8");
  const contenido = plantilla
    .replace("__CACHE__", `${nombre}-${hash}`)
    .replace("__PREFIJO__", `${nombre}-`)
    .replace("__ARCHIVOS__", JSON.stringify(archivos))
    .replace("__EXCLUIR__", JSON.stringify(excluir));
  await writeFile(path.join(raiz, destino), contenido);
}

const kb = (n) => `${(n / 1024).toFixed(0)} KB`;

async function compilar() {
  const inicio = Date.now();
  const hashes = [];

  for (const app of APPS) {
    await esbuild.build(opciones(app));
    const codigo = await readFile(path.join(raiz, app.salida));
    const hash = createHash("sha256").update(codigo).digest("hex").slice(0, 8);
    hashes.push(hash);
    await escribirServiceWorker(app, `sitio/${app.nombre}/sw.js`, hash);
    console.log(`  ${app.nombre}: ${kb(codigo.length)} · caché ${app.nombre}-${hash}`);
  }

  // El hub se invalida si cambia cualquiera de las dos apps.
  const hashHub = createHash("sha256").update(hashes.join("")).digest("hex").slice(0, 8);
  await escribirServiceWorker(HUB, "sitio/sw.js", hashHub);

  console.log(`Listo en ${Date.now() - inicio} ms`);
}

async function zip() {
  const destino = path.join(raiz, "mis-apps.zip");
  await ejecutar("sh", ["-c", `cd "${path.join(raiz, "sitio")}" && rm -f "${destino}" && zip -qr "${destino}" .`]);
  const info = await stat(destino);
  console.log(`mis-apps.zip regenerado (${kb(info.size)})`);
}

if (observar) {
  const contextos = await Promise.all(APPS.map((app) => esbuild.context(opciones(app))));
  await Promise.all(contextos.map((c) => c.watch()));
  await compilar();
  console.log("Vigilando cambios… (Ctrl+C para salir)");
} else {
  await compilar();
  if (empaquetar) await zip();
}
