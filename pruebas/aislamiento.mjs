/* Pruebas de aislamiento entre cuentas.

   Esto es lo que se rompió antes: la app guardaba en el navegador con una clave
   sin dueño, así que al entrar otra persona en el mismo aparato se mezclaban
   sus datos con los de quien lo hubiera usado antes. Estas pruebas fijan las
   garantías de la arquitectura nueva para que no pueda repetirse.

   node pruebas/aislamiento.mjs */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

let fallos = 0;
const check = (nombre, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${nombre}${cond ? "" : "  ← " + extra}`);
  if (!cond) fallos++;
};

const raiz = new URL("..", import.meta.url).pathname;
const leer = (ruta) => readFileSync(join(raiz, ruta), "utf8");

const fuentes = [];
for (const dir of ["src/comun", "src/gastos", "src/salud"]) {
  for (const f of readdirSync(join(raiz, dir))) {
    if (/\.(js|jsx)$/.test(f)) fuentes.push([`${dir}/${f}`, leer(`${dir}/${f}`)]);
  }
}

/* ── 1. Ninguna ruta de Firestore fuera del usuario ─────────────────────── */

const nube = leer("src/comun/nube.js");

const rutas = [...nube.matchAll(/(?:collection|doc)\(\s*s\.db\s*,([^)]*)\)/g)].map((m) =>
  m[1].replace(/\s+/g, " ").trim()
);
check("hay rutas de Firestore que revisar", rutas.length >= 6, String(rutas.length));
/* El uid solo puede venir de dos sitios: el que recibe la función (comprobado
   antes contra el usuario de la sesión) o el de la cuenta recién creada. */
const dueño = /^"usuarios",\s*(uid|cred\.user\.uid)\b/;
check(
  "toda ruta de Firestore empieza por usuarios/{uid}",
  rutas.every((r) => dueño.test(r)),
  rutas.find((r) => !dueño.test(r))
);

check(
  "no se puede tocar Firestore sin usuario",
  /if \(!uid\) throw new Error/.test(nube),
  "falta la comprobación de uid en nube.js"
);
check(
  "la lista de colecciones permitidas se comprueba en el código",
  /!COLECCIONES\.includes\(coleccion\)/.test(nube)
);

/* Las reglas del servidor tienen que permitir exactamente las mismas. */
const reglas = leer("firestore.rules");
const enCodigo = JSON.parse(
  nube.match(/export const COLECCIONES = (\[[^\]]*\])/)[1].replace(/'/g, '"')
);
const enReglas = [...reglas.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
check(
  "las reglas de Firestore cubren las mismas colecciones que el código",
  enCodigo.every((c) => enReglas.includes(c)) && enReglas.every((c) => enCodigo.includes(c)),
  `código: ${enCodigo} · reglas: ${enReglas}`
);
check("las reglas comprueban que el UID es el de quien pide", /request\.auth\.uid == uid/.test(reglas));
check("las reglas cierran todo lo demás", /match \/\{document=\*\*\}[\s\S]*?if false/.test(reglas));

/* ── 2. Nada de datos del usuario en el propio dispositivo ──────────────── */

/* localStorage solo puede aparecer para rescatar lo de la versión anterior,
   nunca para guardar nada nuevo. */
const usanAlmacenLocal = fuentes.filter(([, t]) => /localStorage|sessionStorage/.test(t)).map(([f]) => f);
check(
  "solo los núcleos tocan el almacén del navegador, y solo para el rescate",
  usanAlmacenLocal.every((f) => /nucleo\.js$/.test(f)),
  usanAlmacenLocal.join(", ")
);

for (const [nombre, texto] of fuentes.filter(([f]) => /nucleo\.js$/.test(f))) {
  const escrituras = [...texto.matchAll(/ls\.setItem\(([^,]+),/g)].map((m) => m[1].trim());
  check(
    `${nombre}: al navegador solo se escribe la marca de "ya visto"`,
    escrituras.every((e) => e === "CLAVE_LEGADO_VISTO"),
    escrituras.join(", ")
  );
}

check(
  "no queda ni rastro del almacén local con clave sin dueño",
  !fuentes.some(([, t]) => /useAlmacen|from "\.\.\/comun\/almacen\.js"/.test(t))
);
check("no queda ni rastro del viejo motor de fusión", !fuentes.some(([, t]) => /fusion\.js/.test(t)));

/* ── 3. Cambiar de cuenta tira el árbol entero ──────────────────────────── */

const sesion = leer("src/comun/sesion.jsx");
check(
  "los hijos llevan el UID como key, así que React los remonta al cambiar de cuenta",
  /key=\{sesion\.uid\}/.test(sesion)
);
check("sin sesión no se dibuja la aplicación", /if \(!sesion\) return <Acceso/.test(sesion));
check(
  "mientras se comprueba la sesión tampoco se dibuja nada",
  /sesion === undefined\) return <Esperando/.test(sesion)
);

const datos = leer("src/comun/datos.js");
check(
  "al cambiar de usuario lo primero es vaciar lo que hubiera en pantalla",
  /setRegistros\(vacias\(nombres\)\);\s*setUsuario\(\{\}\);/.test(datos)
);
check("el efecto que escucha depende del uid", /\}, \[uid, nombres\]\);/.test(datos));
check("sin uid no se escucha nada", /if \(!uid\) return;/.test(datos));
check(
  "ninguna escritura sale sin uid",
  ["guardar", "borrar", "guardarUsuario"].every((f) =>
    new RegExp(`const ${f} = useCallback\\([\\s\\S]{0,220}?if \\(!uid\\)`).test(datos)
  )
);

check(
  "cerrar sesión borra también la caché del navegador",
  /clearIndexedDbPersistence/.test(nube) && /window\.location\.reload\(\)/.test(nube)
);

/* ── 4. Las dos apps pasan por la puerta ────────────────────────────────── */

for (const app of ["gastos", "salud"]) {
  const texto = leer(`src/${app}/App.jsx`);
  check(`${app}: la aplicación va dentro de la puerta de sesión`, /<Puerta/.test(texto));
  check(`${app}: los datos vienen de Firestore`, /useDatos\(\{ uid: sesion\.uid/.test(texto));
  check(
    `${app}: la pantalla no guarda estado propio de los datos`,
    !/useState\((?:\(\) => )?(?:migrar|VACIO)/.test(texto)
  );
}

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
