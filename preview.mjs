/* Genera una versión de prueba de la app de Salud en un solo archivo HTML,
   con el JavaScript incrustado, para poder abrirla en cualquier sitio sin
   servidor y sin tocar los datos reales.

   No forma parte del despliegue: es solo para revisar cambios antes de subirlos.

     node preview.mjs   →   .preview/salud.html                              */

import * as esbuild from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const raiz = path.dirname(new URL(import.meta.url).pathname);
const destino = path.join(raiz, ".preview");
await mkdir(destino, { recursive: true });

await esbuild.build({
  entryPoints: [path.join(raiz, "src/salud/main.jsx")],
  outfile: path.join(destino, "salud.js"),
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020", "safari14"],
  jsx: "automatic",
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});

const js = await readFile(path.join(destino, "salud.js"), "utf8");

/* Las tipografías van incrustadas: la página de prueba no puede pedir nada
   fuera, y sin ellas la app se vería con otra letra y no valdría para juzgar. */
let fuentes = "";
try {
  fuentes = await readFile(path.join(destino, "fuentes.css"), "utf8");
} catch (e) {
  console.warn("Sin fuentes.css: la prueba usará las del sistema. Genera con node .fuentes.mjs");
}

/* Una semana de ejemplo dentro de la semana pasada, ya cerrada, para poder ver
   la valoración sin tener que apuntar nada a mano. */
const semilla = `
(function () {
  var CLAVE = "salud-app-v2";
  function iso(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  var lunes = new Date();
  lunes.setHours(0, 0, 0, 0);
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7) - 7);
  function dia(n) { var d = new Date(lunes); d.setDate(d.getDate() + n); return iso(d); }

  var MENUS = [
    ["Café con leche y dos tostadas con aceite y tomate", "desayuno", 3, 2],
    ["Lentejas con verduras y una manzana", "comida", 3, 3],
    ["Yogur griego con nueces", "snack", 2, 2],
    ["Merluza a la plancha con ensalada", "cena", 3, 3],
    ["Tortitas con plátano", "desayuno", 4, 3],
    ["Pizza y dos cervezas", "cena", 5, 4],
    ["Pollo con arroz integral y brócoli", "comida", 4, 3],
    ["Bocadillo de jamón serrano", "comida", 3, 3],
  ];

  function ejemplo() {
    var comidas = [], pesos = [], entrenos = [], n = 0;
    for (var i = 0; i < 7; i++) {
      var cuantas = i === 5 ? 2 : 3;
      for (var j = 0; j < cuantas; j++) {
        var m = MENUS[(i * 3 + j) % MENUS.length];
        comidas.push({ id: "c" + n, mod: 1, fecha: dia(i), texto: m[0], momento: m[1], volumen: m[2], saciedad: m[3], ts: j });
        n++;
      }
      if (i % 2 === 0) pesos.push({ id: "p" + i, mod: 1, fecha: dia(i), kg: Math.round((92 - i * 0.12) * 10) / 10, nota: "" });
      if (i === 0 || i === 3) entrenos.push({ id: "e" + i, mod: 1, fecha: dia(i), tipo: i ? "cardio" : "fuerza", minutos: i ? 35 : 55, intensidad: "media", ts: 1 });
    }
    // un pesaje imposible, para ver cómo lo caza
    pesos.push({ id: "px", mod: 1, fecha: dia(5), kg: 95.4, nota: "después de comer" });
    return {
      v: 4,
      perfil: { altura: "180", edad: "31", sexo: "hombre", actividad: "activa", objetivo: "bajar" },
      pesos: pesos, entrenos: entrenos, comidas: comidas, borrados: {}, sellos: {},
    };
  }

  window.cargarEjemplo = function () {
    localStorage.setItem(CLAVE, JSON.stringify(ejemplo()));
    location.reload();
  };
  window.vaciarTodo = function () {
    localStorage.removeItem(CLAVE);
    location.reload();
  };
})();
`;

const barra = `
<div id="barraPrueba">
  <span><b>Versión de prueba.</b> Los datos se quedan en esta página, no tocan tu app.</span>
  <span class="acciones">
    <button onclick="cargarEjemplo()">Cargar semana de ejemplo</button>
    <button onclick="vaciarTodo()">Empezar de cero</button>
  </span>
</div>
<style>
  #barraPrueba {
    position: sticky; top: 0; z-index: 200; background: #15303D; color: #fff;
    font: 500 12.5px/1.4 system-ui, sans-serif; padding: 10px 14px;
    display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; justify-content: space-between;
  }
  #barraPrueba b { font-weight: 700; }
  #barraPrueba .acciones { display: flex; gap: 8px; }
  #barraPrueba button {
    border: none; border-radius: 999px; padding: 7px 13px; cursor: pointer;
    background: rgba(255,255,255,.16); color: #fff; font: 600 12px system-ui, sans-serif;
  }
  #barraPrueba button:active { transform: scale(.97); }
</style>
`;

const html = `<style>${fuentes}</style>
<div id="root"></div>
${barra}
<script>${semilla}</script>
<script>${js}</script>
`;

await writeFile(path.join(destino, "salud.html"), html);
console.log(`.preview/salud.html listo (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
