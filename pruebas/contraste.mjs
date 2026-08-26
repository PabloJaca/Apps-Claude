/* Contraste de los dos temas, leído de la propia paleta.
 *
 * El barrido del navegador (`extremo.mjs`) mide lo que hay en pantalla, que es
 * la prueba de verdad pero tarda minutos y solo ve los colores que le tocó
 * pintar. Esto es lo contrario: no abre nada, lee las variables del archivo y
 * comprueba TODAS las parejas que la app puede llegar a formar, incluidas las
 * de pantallas por las que la prueba de navegador no pasó.
 *
 * Salieron ocho parejas por debajo del mínimo el día que se midió por primera
 * vez, todas en el tema claro y todas de antes del modo oscuro. Nadie las
 * había visto porque a ojo un gris flojo sobre blanco parece «suave», no
 * «ilegible».
 */

import { readFileSync } from "node:fs";
import path from "node:path";

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const fuente = readFileSync(path.join(raiz, "src/salud/App.jsx"), "utf8");

let fallos = 0;
let hechas = 0;
const check = (que, ok, detalle) => {
  hechas++;
  if (ok) return;
  fallos++;
  console.error(`  ✗ ${que}${detalle === undefined ? "" : `\n      ${detalle}`}`);
};

/* ── leer la paleta del archivo, no repetirla aquí ───────────────────────── */

/** Las variables de un bloque `:root...{ ... }` con el selector que se pida. */
function leerTema(selector) {
  const i = fuente.indexOf(selector);
  if (i === -1) return null;
  const abre = fuente.indexOf("{", i);
  const cierra = fuente.indexOf("\n}", abre);
  const cuerpo = fuente.slice(abre, cierra);
  const vars = {};
  for (const [, nombre, valor] of cuerpo.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    const v = valor.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) vars[nombre] = v;
  }
  return vars;
}

const claro = leerTema(':root, :root[data-tema="claro"]');
const oscuro = leerTema(':root[data-tema="oscuro"]');

check("se encuentra el tema claro en la hoja", claro && Object.keys(claro).length >= 15,
  claro ? String(Object.keys(claro).length) : "no encontrado");
check("se encuentra el tema oscuro en la hoja", oscuro && Object.keys(oscuro).length >= 15,
  oscuro ? String(Object.keys(oscuro).length) : "no encontrado");

if (!claro || !oscuro) {
  console.log("\n✗ contraste: no se ha podido leer la paleta");
  process.exit(1);
}

check("los dos temas declaran exactamente las mismas variables",
  Object.keys(claro).sort().join() === Object.keys(oscuro).sort().join(),
  `solo en claro: ${Object.keys(claro).filter((k) => !(k in oscuro))} · solo en oscuro: ${Object.keys(oscuro).filter((k) => !(k in claro))}`);

/* ── la cuenta ───────────────────────────────────────────────────────────── */

const luz = (hex) => {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const razon = (a, b) => {
  const [x, y] = [luz(a), luz(b)];
  return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100;
};

const MINIMO = 4.5;          // texto normal, AA
const SUPERFICIES = ["bg", "card", "soft"];
const TEXTOS = ["ink", "mid", "faint"];
const ACENTOS = ["teal", "mint", "coral", "amber", "indigo"];

for (const [nombre, T] of [["claro", claro], ["oscuro", oscuro]]) {
  const bajos = [];
  const mirar = (que, a, b) => {
    if (!T[a] || !T[b]) return;
    const r = razon(T[a], T[b]);
    if (r < MINIMO) bajos.push(`${que} ${r}`);
  };

  // Los tres grises de texto sobre las tres superficies.
  for (const s of SUPERFICIES) for (const t of TEXTOS) mirar(`${t}/${s}`, t, s);

  // Cada acento como texto: sobre su propio tinte, sobre tarjeta y sobre fondo.
  for (const a of ACENTOS) {
    mirar(`${a}/${a}Soft`, a, `${a}Soft`);
    mirar(`${a}/card`, a, "card");
    mirar(`${a}/bg`, a, "bg");
  }

  // Y el texto que va ENCIMA de un acento, que es el que se rompe al invertir.
  for (const a of ACENTOS) mirar(`sobreAcento/${a}`, "sobreAcento", a);

  // La tarjeta oscura y su texto.
  mirar("sobreTarjetaOscura/tarjetaOscura", "sobreTarjetaOscura", "tarjetaOscura");

  check(`tema ${nombre}: ninguna pareja baja de ${MINIMO}`, bajos.length === 0, bajos.join(" · "));
}

/* Los grises tienen que seguir siendo tres escalones distinguibles: si al
   subirles el contraste acaban todos iguales, se pierde la jerarquía. */
for (const [nombre, T] of [["claro", claro], ["oscuro", oscuro]]) {
  const [a, b, c] = TEXTOS.map((t) => luz(T[t]));
  const ordenados = nombre === "claro" ? a < b && b < c : a > b && b > c;
  check(`tema ${nombre}: los tres grises siguen siendo tres escalones`, ordenados,
    TEXTOS.map((t) => `${t}=${T[t]}`).join(" "));
}

console.log(`\n${fallos ? "✗" : "✓"} contraste: ${hechas - fallos}/${hechas} comprobaciones`);
process.exit(fallos ? 1 : 0);
