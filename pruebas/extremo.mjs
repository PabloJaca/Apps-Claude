/* ─────────────────────────────────────────────────────────────────────────
   Prueba de punta a punta en un navegador de verdad, con un Firebase de
   mentira (pruebas/falso/firebase.js) para no tocar la cuenta de nadie.

   Comprueba lo que el resto de pruebas no puede: que al usar la aplicación de
   verdad —entrar, apuntar cosas, cerrar sesión, entrar con otra cuenta— no
   queda ni un dato de la persona anterior en pantalla.

   Necesita playwright (ya viene en el entorno).   node pruebas/extremo.mjs
   ───────────────────────────────────────────────────────────────────────── */

import * as esbuild from "esbuild";
import http from "node:http";
import path from "node:path";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { chromium } from "playwright";

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const falso = path.join(raiz, "pruebas/falso/firebase.js");

let fallos = 0;
const check = (nombre, cond, extra = "") => {
  console.log(`${cond ? "✓" : "✗"} ${nombre}${cond ? "" : "  ← " + extra}`);
  if (!cond) fallos++;
};

/* ── 1. Compilar las dos apps contra el Firebase de mentira ──────────────── */

const dir = await mkdtemp(path.join(tmpdir(), "extremo-"));

const alias = {
  name: "firebase-de-mentira",
  setup(build) {
    build.onResolve({ filter: /^firebase\// }, () => ({ path: falso }));
  },
};

for (const app of ["gastos", "salud"]) {
  await esbuild.build({
    entryPoints: [path.join(raiz, `src/${app}/main.jsx`)],
    outfile: path.join(dir, `${app}.js`),
    bundle: true, format: "iife", target: ["es2020"], jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [alias], logLevel: "error",
  });
  // Cada app monta en un sitio distinto ("root" en salud, "raiz" en gastos):
  // se ponen los dos para no tener que llevar la cuenta aquí.
  await writeFile(
    path.join(dir, `${app}.html`),
    `<meta charset="utf-8"><div id="root"></div><div id="raiz"></div>` +
      `<script>window.MISAPPS_FIREBASE={apiKey:"x",authDomain:"x",projectId:"x",appId:"x"}</script>` +
      `<script src="${app}.js"></script>`
  );
}

const srv = http.createServer(async (req, res) => {
  const f = path.join(dir, decodeURIComponent(req.url.split("?")[0]));
  let cuerpo;
  try {
    cuerpo = await readFile(f);
  } catch (e) {
    res.writeHead(404);
    return res.end();
  }
  // El charset es obligatorio: sin él el navegador lee el paquete como latin-1
  // y revienta con los acentos de las expresiones regulares.
  const tipo = f.endsWith(".js") ? "text/javascript" : "text/html";
  res.writeHead(200, { "content-type": `${tipo}; charset=utf-8` });
  res.end(cuerpo);
});
await new Promise((r) => srv.listen(8321, r));

/* En este contenedor el navegador ya viene puesto en un sitio concreto; en
   cualquier otro sitio (y en el servidor que publica) lo busca Playwright. */
const preinstalado = "/opt/pw-browsers/chromium";
const nav = await chromium.launch(existsSync(preinstalado) ? { executablePath: preinstalado } : {});

/* ── utilidades de guion ─────────────────────────────────────────────────── */

const acceder = async (pag, email, clave, { registrar = false } = {}) => {
  await pag.waitForSelector('input[type="email"]', { timeout: 10000 });
  if (registrar) await pag.click("text=No tengo cuenta");
  await pag.fill('input[type="email"]', email);
  await pag.fill('input[type="password"]', clave);
  await pag.click(registrar ? "text=Crear cuenta" : 'button:has-text("Entrar")');
  await pag.waitForTimeout(700);
};

const texto = (pag) => pag.innerText("body");

/* ── 2. Salud: dos cuentas en el mismo navegador ─────────────────────────── */

{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(String(e)));

  await pag.goto("http://localhost:8321/salud.html");
  await pag.waitForTimeout(400);

  check("salud: sin sesión solo se ve la puerta", /Entra en tu cuenta/.test(await texto(pag)));

  await acceder(pag, "ana@ejemplo.com", "secreta1", { registrar: true });
  check("salud: tras registrarse se entra en la app", /Peso|Entrenos|Comidas/.test(await texto(pag)));

  // Ana apunta un peso.
  await pag.fill('input[inputmode="decimal"], input[type="number"]', "72.4");
  await pag.click('button:has-text("Guardar")');
  await pag.waitForTimeout(600);
  check("salud: lo que apunta Ana aparece en su pantalla", /72,4/.test(await texto(pag)), await texto(pag));

  const servidor = await pag.evaluate(() => window.__espia.verServidor());
  const rutasAna = Object.keys(servidor.docs);
  check(
    "salud: el peso se ha escrito en Firestore, dentro de su usuario",
    rutasAna.some((r) => /^usuarios\/uid_ana_ejemplo_com\/pesos\//.test(r)),
    rutasAna.join(" ")
  );
  check(
    "salud: no se ha escrito nada fuera de su carpeta",
    rutasAna.every((r) => r.startsWith("usuarios/uid_ana_ejemplo_com")),
    rutasAna.join(" ")
  );

  // Cerrar sesión: pasa por la pantalla de cuenta y recarga la página.
  await pag.click('button[aria-label^="Cuenta"]');
  await pag.waitForTimeout(400);
  await pag.click("text=Cerrar sesión");
  await pag.waitForTimeout(1200);
  check("salud: al cerrar sesión se vuelve a la puerta", /Entra en tu cuenta/.test(await texto(pag)));
  check("salud: y no queda ni el peso a la vista", !/72,4/.test(await texto(pag)));

  // Entra otra persona en el mismo aparato.
  await acceder(pag, "bruno@ejemplo.com", "secreta2", { registrar: true });
  const conBruno = await texto(pag);
  check("salud: Bruno entra en su propia app", /Peso|Entrenos|Comidas/.test(conBruno));
  check("salud: BRUNO NO VE EL PESO DE ANA", !/72,4/.test(conBruno), conBruno.slice(0, 300));

  // Y lo de Ana sigue intacto en su cuenta.
  const trasBruno = await pag.evaluate(() => window.__espia.verServidor());
  check(
    "salud: los datos de Ana siguen en su cuenta, sin tocar",
    Object.keys(trasBruno.docs).some((r) => /^usuarios\/uid_ana_ejemplo_com\/pesos\//.test(r))
  );
  check(
    "salud: y nada de Ana ha acabado en la cuenta de Bruno",
    !Object.entries(trasBruno.docs).some(
      ([r, d]) => r.startsWith("usuarios/uid_bruno") && JSON.stringify(d).includes("72.4")
    )
  );

  // Ana vuelve: lo suyo tiene que estar donde lo dejó.
  await pag.click('button[aria-label^="Cuenta"]');
  await pag.waitForTimeout(400);
  await pag.click("text=Cerrar sesión");
  await pag.waitForTimeout(1200);
  await acceder(pag, "ana@ejemplo.com", "secreta1");
  check("salud: Ana vuelve y recupera lo suyo", /72,4/.test(await texto(pag)), (await texto(pag)).slice(0, 300));

  check("salud: ningún error de JavaScript en todo el recorrido", errores.length === 0, errores.join(" | "));
  await ctx.close();
}

/* ── 3. Gastos: cuenta nueva, apunte y aislamiento ───────────────────────── */

{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(String(e)));

  await pag.goto("http://localhost:8321/gastos.html");
  await pag.waitForTimeout(400);
  await acceder(pag, "carla@ejemplo.com", "secreta3", { registrar: true });
  await pag.waitForTimeout(900);

  check("gastos: tras entrar se ve el mes", /Resumen|Análisis|Ajustes/.test(await texto(pag)));

  const servidor = await pag.evaluate(() => window.__espia.verServidor());
  const cats = Object.keys(servidor.docs).filter((r) => /\/categorias\//.test(r));
  check("gastos: una cuenta nueva arranca con sus categorías", cats.length >= 9, String(cats.length));
  check(
    "gastos: las categorías se siembran dentro de su usuario",
    cats.every((r) => r.startsWith("usuarios/uid_carla_ejemplo_com/categorias/"))
  );

  // El orden pensado tiene que sobrevivir a que Firestore ordene por id.
  await pag.click("text=Ajustes");
  await pag.waitForTimeout(500);
  const enPantalla = await pag.$$eval(".listaCat .catNombre", (els) => els.map((e) => e.value));
  check("gastos: la lista de categorías se pinta", enPantalla.length >= 9, String(enPantalla.length));
  /* Firestore las devuelve por identificador: alfabéticamente saldría Casa,
     Comida, Deporte… y Otros en medio. El orden pensado pone Comida la primera
     y Otros la última, y eso es lo que tiene que verse. */
  check(
    "gastos: el orden pensado sobrevive al orden de Firestore",
    /^Comida/.test(enPantalla[0] || "") && /^Otros/.test(enPantalla[enPantalla.length - 1] || ""),
    enPantalla.map((t) => t.split("\n")[0]).join(" · ")
  );

  // Sembrar dos veces no debe duplicar nada: se recarga y se vuelve a mirar.
  await pag.reload();
  await pag.waitForTimeout(1200);
  const tras = await pag.evaluate(() => window.__espia.verServidor());
  const cats2 = Object.keys(tras.docs).filter((r) => /\/categorias\//.test(r));
  check("gastos: recargar no duplica las categorías", cats2.length === cats.length, `${cats.length} → ${cats2.length}`);

  check("gastos: ningún error de JavaScript en todo el recorrido", errores.length === 0, errores.join(" | "));
  await ctx.close();
}

await nav.close();
srv.close();
await rm(dir, { recursive: true, force: true });

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
