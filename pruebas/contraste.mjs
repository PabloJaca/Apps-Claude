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
const FUENTES = {
  salud: readFileSync(path.join(raiz, "src/salud/App.jsx"), "utf8"),
  gastos: readFileSync(path.join(raiz, "src/gastos/estilos.js"), "utf8"),
};

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
function leerTema(fuente, selector) {
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

const APPS = {};
for (const [app, fuente] of Object.entries(FUENTES)) {
  const claro = leerTema(fuente, ':root, :root[data-tema="claro"]');
  const oscuro = leerTema(fuente, ':root[data-tema="oscuro"]');

  check(`${app}: se encuentra el tema claro`, claro && Object.keys(claro).length >= 12,
    claro ? String(Object.keys(claro).length) : "no encontrado");
  check(`${app}: se encuentra el tema oscuro`, oscuro && Object.keys(oscuro).length >= 12,
    oscuro ? String(Object.keys(oscuro).length) : "no encontrado");

  if (!claro || !oscuro) continue;

  check(`${app}: los dos temas declaran las mismas variables`,
    Object.keys(claro).sort().join() === Object.keys(oscuro).sort().join(),
    `solo en claro: ${Object.keys(claro).filter((k) => !(k in oscuro))} · solo en oscuro: ${Object.keys(oscuro).filter((k) => !(k in claro))}`);

  APPS[app] = { claro, oscuro };
}

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

/*
 * Cada app nombra sus variables a su manera —Salud dice «bg» y «teal»; Gastos,
 * «paper» y «accent»—, así que el mapa dice qué papel cumple cada nombre. Lo
 * que se comprueba es el papel, no la palabra.
 */
const PAPELES = {
  salud: {
    superficies: ["bg", "card", "soft"],
    textos: ["ink", "mid", "faint"],
    acentos: [["teal", "tealSoft"], ["mint", "mintSoft"], ["coral", "coralSoft"],
              ["amber", "amberSoft"], ["indigo", "indigoSoft"]],
    fondo: "bg",
  },
  gastos: {
    superficies: ["paper", "card", "suave", "suave2", "suave3"],
    textos: ["ink", "soft", "tenue"],
    /* En Gastos el color del tinte y el del texto encima no son el mismo en
       claro: el ámbar de un icono no se lee sobre su propio fondo crema. */
    acentos: [["accent", "accentSoft"], ["mintTexto", "mintSoft"],
              ["coralTexto", "coralSoft"], ["amberTexto", "amberSoft"]],
    fondo: "paper",
  },
};

for (const [app, temas] of Object.entries(APPS)) {
  const P = PAPELES[app];
  for (const [nombre, T] of [["claro", temas.claro], ["oscuro", temas.oscuro]]) {
    const bajos = [];
    const mirar = (que, a, b) => {
      if (!T[a] || !T[b]) return;
      const r = razon(T[a], T[b]);
      if (r < MINIMO) bajos.push(`${que} ${r}`);
    };

    // Los grises de texto sobre cada superficie.
    for (const sup of P.superficies) for (const t of P.textos) mirar(`${t}/${sup}`, t, sup);

    // Cada acento como texto: sobre su tinte, sobre tarjeta y sobre el fondo.
    for (const [a, tinte] of P.acentos) {
      mirar(`${a}/${tinte}`, a, tinte);
      mirar(`${a}/card`, a, "card");
      mirar(`${a}/${P.fondo}`, a, P.fondo);
    }

    // Y el texto que va ENCIMA de un acento, que es el que se rompe al invertir.
    for (const [a] of P.acentos) mirar(`sobreAcento/${a}`, "sobreAcento", a);
    mirar("sobreAcento/accent", "sobreAcento", "accent");
    mirar("sobreAcento/teal", "sobreAcento", "teal");

    // La tarjeta oscura y su texto.
    mirar("sobreTarjetaOscura/tarjetaOscura", "sobreTarjetaOscura", "tarjetaOscura");
    mirar("sobreTarjetaOscuraSuave/tarjetaOscura", "sobreTarjetaOscuraSuave", "tarjetaOscura");

    check(`${app} · ${nombre}: ninguna pareja baja de ${MINIMO}`, bajos.length === 0, bajos.join(" · "));
  }

  /* Los grises tienen que seguir siendo escalones distinguibles: si al subirles
     el contraste acaban todos iguales, se pierde la jerarquía. */
  for (const [nombre, T] of [["claro", temas.claro], ["oscuro", temas.oscuro]]) {
    const vs = P.textos.map((t) => luz(T[t]));
    const ordenados = nombre === "claro"
      ? vs.every((v, i) => i === 0 || v > vs[i - 1])
      : vs.every((v, i) => i === 0 || v < vs[i - 1]);
    check(`${app} · ${nombre}: los grises siguen siendo escalones`, ordenados,
      P.textos.map((t) => `${t}=${T[t]}`).join(" "));
  }
}

console.log(`\n${fallos ? "✗" : "✓"} contraste: ${hechas - fallos}/${hechas} comprobaciones`);
process.exit(fallos ? 1 : 0);
