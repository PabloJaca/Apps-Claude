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

/* Una cuenta recién creada aterriza en la bienvenida. Los guiones que van de
   otra cosa la saltan para llegar a la aplicación. */
const saltarBienvenida = async (pag) => {
  const boton = pag.locator("text=Ahora no");
  if (await boton.count()) {
    await boton.first().click();
    await pag.waitForTimeout(900);
  }
};

/* ── 2. Salud: dos cuentas en el mismo navegador ─────────────────────────── */

{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(String(e)));

  /* Las dos están invitadas: aquí se prueba el aislamiento, no la lista.
     Se siembra solo la primera vez: este guion corre en cada navegación, y
     cerrar sesión recarga la página. */
  await pag.addInitScript(() => {
    if (localStorage.getItem("__servidor_de_mentira__")) return;
    localStorage.setItem("__servidor_de_mentira__", JSON.stringify({
      usuarios: {},
      docs: { "permitidos/ana@ejemplo.com": { nombre: "Ana" }, "permitidos/bruno@ejemplo.com": { nombre: "Bruno" } },
    }));
  });

  await pag.goto("http://localhost:8321/salud.html");
  await pag.waitForTimeout(400);

  check("salud: sin sesión solo se ve la puerta", /Entra en tu cuenta/.test(await texto(pag)));

  await acceder(pag, "ana@ejemplo.com", "secreta1", { registrar: true });
  await saltarBienvenida(pag);
  check("salud: tras registrarse se entra en la app", /Peso|Entrenos|Comidas/.test(await texto(pag)));

  // Ana apunta un peso.
  await pag.fill('input[inputmode="decimal"], input[type="number"]', "72.4");
  await pag.click('button:has-text("Guardar")');
  await pag.waitForTimeout(600);
  check("salud: lo que apunta Ana aparece en su pantalla", /72,4/.test(await texto(pag)), await texto(pag));

  const escritas = await pag.evaluate(() => window.__espia.rutasEscritas);
  check(
    "salud: el peso se ha escrito en Firestore, dentro de su usuario",
    escritas.some((r) => /^usuarios\/uid_ana_ejemplo_com\/pesos\//.test(r)),
    escritas.join(" ")
  );
  check(
    "salud: no se ha escrito nada fuera de su carpeta",
    escritas.every((r) => r.startsWith("usuarios/uid_ana_ejemplo_com")),
    escritas.join(" ")
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
  await saltarBienvenida(pag);
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

/* ── 3. Salud: la semana en pantalla, el resto en «Otros días» ───────────── */

{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(String(e)));

  /* Tres semanas de comidas y pesajes, sembradas directamente en el servidor
     de mentira: solo las de la semana en curso deben verse de entrada. */
  await pag.addInitScript(() => {
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const lunes = new Date(); lunes.setHours(0, 0, 0, 0);
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
    const dia = (n) => { const d = new Date(lunes); d.setDate(d.getDate() + n); return iso(d); };

    /* Un día por cada jornada transcurrida de esta semana (lunes → hoy) más
       los 20 anteriores, que son los que deben quedar detrás del botón. */
    const hoyIdx = (new Date().getDay() + 6) % 7; // 0 = lunes
    const uid = "usuarios/uid_dani_ejemplo_com";
    const docs = { [uid]: { email: "dani@ejemplo.com" }, "permitidos/dani@ejemplo.com": { nombre: "Dani" } };
    for (let i = -20; i <= hoyIdx; i++) {
      docs[`${uid}/pesos/p${i + 20}`] = { fecha: dia(i), kg: 80 + i * 0.05, nota: "" };
      docs[`${uid}/comidas/c${i + 20}`] = { fecha: dia(i), texto: "Lentejas", momento: "comida", volumen: 3, saciedad: 3, ts: 1 };
    }
    if (!localStorage.getItem("__servidor_de_mentira__")) {
      localStorage.setItem("__servidor_de_mentira__", JSON.stringify({
        usuarios: { "dani@ejemplo.com": { clave: "secreta4", uid: "uid_dani_ejemplo_com" } }, docs,
      }));
    }
    sessionStorage.setItem("__sesion_de_mentira__", JSON.stringify({ uid: "uid_dani_ejemplo_com", email: "dani@ejemplo.com" }));
    window.__cuentas = { estaSemana: hoyIdx + 1, anteriores: 20 };
  });

  await pag.goto("http://localhost:8321/salud.html");
  await pag.waitForTimeout(1600);

  const { estaSemana, anteriores } = await pag.evaluate(() => window.__cuentas);

  // Pestaña de peso: filas visibles frente a las que hay guardadas.
  const filasPeso = await pag.$$eval('[aria-label="Borrar el pesaje"]', (e) => e.length);
  check(
    "salud: en Peso solo se ven los pesajes de esta semana",
    filasPeso === estaSemana,
    `visibles ${filasPeso}, de esta semana ${estaSemana} (y ${anteriores} anteriores)`
  );
  const t = await pag.innerText("body");
  check("salud: aparece la entrada a «Otros días»", /Otros días/.test(t));
  check(
    "salud: dice cuántos hay detrás",
    new RegExp(`${anteriores} anteriores a esta semana`).test(t),
    (t.match(/\d+ anteriores? a esta semana/) || ["no encontrado"])[0]
  );

  // Y ahí dentro están todos los demás.
  await pag.click("text=Otros días");
  await pag.waitForTimeout(600);
  const enOtros = await pag.$$eval('[aria-label="Borrar el pesaje"]', (e) => e.length);
  check(
    "salud: «Otros días» contiene el resto, ni uno menos",
    enOtros === filasPeso + anteriores,
    `${enOtros} botones en pantalla (los ${anteriores} del histórico + los ${filasPeso} de la página de detrás)`
  );
  check("salud: el histórico va separado por meses", /AGOSTO|JULIO|agosto|julio/i.test(await pag.innerText("body")));
  await pag.click('[aria-label="Cerrar"]');
  await pag.waitForTimeout(400);

  /* ── corregir un registro: se sobrescribe, no se duplica ── */
  const antes = await pag.evaluate(() =>
    Object.keys(window.__espia.verServidor().docs).filter((r) => /\/pesos\//.test(r)).length);

  await pag.click('[aria-label="Editar el pesaje"]');
  await pag.waitForTimeout(600);
  check("salud: la hoja se abre en modo corrección", /Corregir el peso/.test(await pag.innerText("body")));

  const guardados = () => pag.evaluate(() =>
    Object.entries(window.__espia.verServidor().docs)
      .filter(([r]) => /\/pesos\//.test(r))
      .map(([, d]) => d && d.kg));

  /* Corregir de 80,2 a 77,7 es un salto imposible en un día: el control de
     cordura tiene que seguir avisando también al corregir, no solo al apuntar.
     Dentro de la hoja, ojo: la página de detrás también tiene un campo. */
  await pag.fill('.rise input[type="number"]', "77.7");
  await pag.click("text=Guardar los cambios");
  await pag.waitForTimeout(700);
  check("salud: al corregir, un salto imposible avisa antes de guardar", /no es peso real|Es mucho para ese tiempo/.test(await pag.innerText("body")));
  check("salud: y no lo ha guardado todavía", !(await guardados()).includes(77.7));

  // Segundo toque: se guarda igual, que para eso avisa y no bloquea.
  await pag.click("text=Guardar los cambios");
  await pag.waitForTimeout(900);

  const despues = await pag.evaluate(() =>
    Object.keys(window.__espia.verServidor().docs).filter((r) => /\/pesos\//.test(r)).length);
  check("salud: corregir NO crea un registro nuevo", despues === antes, `${antes} → ${despues}`);
  check("salud: el valor corregido se ve en la lista", /77,7/.test(await pag.innerText("body")));
  check("salud: y queda escrito en Firestore", (await guardados()).includes(77.7), JSON.stringify(await guardados()));

  check("salud: ningún error de JavaScript", errores.length === 0, errores.join(" | "));
  await ctx.close();
}

/* ── 3bis. Repetir «lo de siempre» y la racha ────────────────────────────── */

{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(String(e)));

  /* Seis días seguidos con la misma cena: eso es una costumbre, y la app
     tiene que ofrecerla para repetirla. */
  await pag.addInitScript(() => {
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dd = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); };
    const uid = "usuarios/uid_gema";
    const docs = { "permitidos/gema@ejemplo.com": { nombre: "Gema" }, [uid]: { email: "gema@ejemplo.com" } };
    // Una comida en cada momento del día, para que la prueba valga a cualquier hora.
    for (let i = 0; i <= 5; i++) {
      for (const m of ["desayuno", "comida", "snack", "cena"]) {
        docs[`${uid}/comidas/c${i}${m}`] = { fecha: dd(i), texto: `Lo de siempre de ${m}`, momento: m, volumen: 4, saciedad: 3, ts: 1 };
      }
    }
    localStorage.setItem("__servidor_de_mentira__", JSON.stringify({
      usuarios: { "gema@ejemplo.com": { clave: "secreta7", uid: "uid_gema" } }, docs,
    }));
    sessionStorage.setItem("__sesion_de_mentira__", JSON.stringify({ uid: "uid_gema", email: "gema@ejemplo.com" }));
  });

  await pag.goto("http://localhost:8321/salud.html");
  await pag.waitForTimeout(1600);

  check("la racha de 6 días se ve en la cabecera", /\b6\b/.test(await pag.innerText("header")), await pag.innerText("header"));

  await pag.click("nav >> text=Comidas");
  await pag.waitForTimeout(700);

  const chips = await pag.$$eval("button", (bs) =>
    bs.map((b) => b.textContent.trim()).filter((t) => /×\d+$/.test(t)));
  check("se ofrece repetir lo que sueles comer a esta hora", chips.length > 0, JSON.stringify(chips));
  check("y dice cuántas veces lo has comido", /×6$/.test(chips[0] || ""), chips[0]);

  /* Lo que importa: repetir + guardar son dos toques, no seis. */
  const antes = await pag.evaluate(() =>
    Object.keys(window.__espia.verServidor().docs).filter((r) => /\/comidas\//.test(r)).length);
  await pag.click('button:has-text("×6")');
  await pag.waitForTimeout(300);
  await pag.click("text=Añadir comida");
  await pag.waitForTimeout(900);
  const despues = await pag.evaluate(() =>
    Object.keys(window.__espia.verServidor().docs).filter((r) => /\/comidas\//.test(r)).length);
  check("repetir y guardar apunta la comida en dos toques", despues === antes + 1, `${antes} → ${despues}`);

  check(
    "la comida repetida conserva volumen y saciedad",
    await pag.evaluate(() => Object.values(window.__espia.verServidor().docs)
      .some((d) => d && d.volumen === 4 && d.saciedad === 3))
  );

  check("nada se sale de la pantalla a lo ancho",
    await pag.evaluate(() => document.body.scrollWidth <= window.innerWidth + 1),
    String(await pag.evaluate(() => document.body.scrollWidth)));

  check("repetir comida: ningún error de JavaScript", errores.length === 0, errores.join(" | "));
  await ctx.close();
}

/* ── 3ter. La bienvenida de la primera vez ───────────────────────────────── */

{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(String(e)));

  // Cuenta recién creada: sin perfil y sin un solo registro.
  await pag.addInitScript(() => {
    if (!localStorage.getItem("__servidor_de_mentira__")) {
      localStorage.setItem("__servidor_de_mentira__", JSON.stringify({
        usuarios: { "hugo@ejemplo.com": { clave: "secreta8", uid: "uid_hugo" } },
        docs: { "permitidos/hugo@ejemplo.com": { nombre: "Hugo" }, "usuarios/uid_hugo": { email: "hugo@ejemplo.com" } },
      }));
    }
    sessionStorage.setItem("__sesion_de_mentira__", JSON.stringify({ uid: "uid_hugo", email: "hugo@ejemplo.com" }));
  });

  await pag.goto("http://localhost:8321/salud.html");
  await pag.waitForTimeout(1600);
  check("primera vez: se pregunta el peso en vez de soltar un formulario vacío",
    /Cuánto pesas ahora/.test(await pag.innerText("body")), (await pag.innerText("body")).slice(0, 150));

  await pag.fill('input[type="number"]', "82.4");
  await pag.click('button:has-text("Seguir")');
  await pag.waitForTimeout(400);
  await pag.click("text=Bajar peso");
  await pag.click('button:has-text("Seguir")');
  await pag.waitForTimeout(400);
  await pag.fill('input[placeholder="178"]', "180");
  await pag.fill('input[placeholder="34"]', "31");
  await pag.click("text=Hombre");
  await pag.click("text=Activa");
  await pag.waitForTimeout(400);

  const conDiana = await pag.innerText("body");
  check("primera vez: al final enseña la diana de calorías", /tu diana/i.test(conDiana));
  check("primera vez: y la diana queda por debajo del gasto, porque quiere bajar",
    (() => {
      const [, diana] = conDiana.match(/TU DIANA\s+([\d.]+)/i) || [];
      const [, gasto] = conDiana.match(/Gastas unas ([\d.]+)/) || [];
      return diana && gasto && Number(diana.replace(".", "")) < Number(gasto.replace(".", ""));
    })(),
    conDiana.replace(/\n+/g, " | ").slice(0, 240)
  );

  await pag.click("text=Empezar");
  await pag.waitForTimeout(1300);
  const dentro = await pag.innerText("body");
  check("primera vez: se entra en la app", /Peso|Entrenos|Comidas/.test(dentro));
  check("primera vez: el peso del primer paso queda guardado", /82,4/.test(dentro));

  await pag.reload();
  await pag.waitForTimeout(1600);
  const trasRecarga = await pag.innerText("body");
  check("primera vez: no vuelve a preguntar al recargar", !/Cuánto pesas ahora/.test(trasRecarga));
  check("primera vez: y lo apuntado sigue ahí", /82,4/.test(trasRecarga));

  check("bienvenida: ningún error de JavaScript", errores.length === 0, errores.join(" | "));
  await ctx.close();
}

/* Quien la salta tampoco vuelve a verla. */
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  await pag.addInitScript(() => {
    if (!localStorage.getItem("__servidor_de_mentira__")) {
      localStorage.setItem("__servidor_de_mentira__", JSON.stringify({
        usuarios: { "iris@ejemplo.com": { clave: "secreta9", uid: "uid_iris" } },
        docs: { "permitidos/iris@ejemplo.com": { nombre: "Iris" }, "usuarios/uid_iris": { email: "iris@ejemplo.com" } },
      }));
    }
    sessionStorage.setItem("__sesion_de_mentira__", JSON.stringify({ uid: "uid_iris", email: "iris@ejemplo.com" }));
  });
  await pag.goto("http://localhost:8321/salud.html");
  await pag.waitForTimeout(1500);
  await pag.click("text=Ahora no");
  await pag.waitForTimeout(1200);
  check("saltarse la bienvenida deja entrar en la app", /Peso|Entrenos|Comidas/.test(await pag.innerText("body")));
  await pag.reload();
  await pag.waitForTimeout(1600);
  check("y no vuelve a preguntar nunca más", !/Cuánto pesas ahora/.test(await pag.innerText("body")));
  await ctx.close();
}

/* ── 4. La lista de invitados ────────────────────────────────────────────── */

{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(String(e)));

  // Solo Eva está invitada.
  await pag.addInitScript(() => {
    if (localStorage.getItem("__servidor_de_mentira__")) return;
    localStorage.setItem("__servidor_de_mentira__", JSON.stringify({
      usuarios: {
        "eva@ejemplo.com": { clave: "secreta5", uid: "uid_eva" },
        "fran@ejemplo.com": { clave: "secreta6", uid: "uid_fran" },
      },
      docs: { "permitidos/eva@ejemplo.com": { nombre: "Eva" } },
    }));
  });

  await pag.goto("http://localhost:8321/salud.html");
  await acceder(pag, "fran@ejemplo.com", "secreta6");
  await pag.waitForTimeout(1200);
  const conFran = await texto(pag);
  check("sin invitación se explica que la app es privada", /Esta aplicación es privada/.test(conFran), conFran.slice(0, 200));
  check("y no se llega a ninguna pantalla de datos", !/Valorar mi semana/.test(conFran));

  await pag.click("text=Salir");
  await pag.waitForTimeout(1300);
  await acceder(pag, "eva@ejemplo.com", "secreta5");
  await pag.waitForTimeout(1200);
  await saltarBienvenida(pag);
  check("con invitación se entra con normalidad", /Peso|Entrenos|Comidas/.test(await texto(pag)), (await texto(pag)).slice(0, 200));

  check("lista de invitados: ningún error de JavaScript", errores.length === 0, errores.join(" | "));
  await ctx.close();
}

/* ── 5. Gastos: cuenta nueva, apunte y aislamiento ───────────────────────── */

{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(String(e)));

  await pag.addInitScript(() => {
    if (localStorage.getItem("__servidor_de_mentira__")) return;
    localStorage.setItem("__servidor_de_mentira__", JSON.stringify({
      usuarios: {}, docs: { "permitidos/carla@ejemplo.com": { nombre: "Carla" } },
    }));
  });

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
