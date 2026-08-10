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

/* El inventario de pantallas que este guion abre vive aparte, en
   `extremo-inventario.mjs`, para que aislamiento.mjs pueda leerlo sin
   arrancar un navegador. Si añades una pantalla, ábrela aquí y anótala allí. */

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

/**
 * Un reconocedor de voz de mentira.
 *
 * No hay forma de meterle audio de verdad a un navegador sin micrófono, y
 * tampoco haría falta: lo que hay que probar es que la frase reconocida llega
 * al intérprete y de ahí al formulario. Este falso dice lo que se le mande y
 * copia el comportamiento del de verdad: parciales primero, definitivo
 * después, y el `onend` al final.
 */
const conVozDeMentira = (pag, frase) =>
  pag.addInitScript((dicho) => {
    class Falso {
      start() {
        setTimeout(() => {
          const parcial = { results: [[{ transcript: dicho.slice(0, 6) }]], resultIndex: 0 };
          parcial.results[0].isFinal = false;
          parcial.results.length = 1;
          this.onresult && this.onresult(parcial);
        }, 30);
        setTimeout(() => {
          const fin = { results: [[{ transcript: dicho }]], resultIndex: 0 };
          fin.results[0].isFinal = true;
          this.onresult && this.onresult(fin);
          this.onend && this.onend();
        }, 90);
      }
      stop() { this.onend && this.onend(); }
      abort() {}
    }
    window.SpeechRecognition = Falso;
    window.webkitSpeechRecognition = Falso;
  }, frase);

/* Apuntar un gasto en la app de Gastos, como se hace a mano: botón flotante,
   importe, concepto y guardar. */
const apuntarGasto = async (pag, importe, concepto) => {
  await pag.click(".fab");
  await pag.waitForTimeout(320);
  await pag.fill(".hoja .importeInput", String(importe));
  if (concepto) await pag.fill('.hoja .dosColumnas input:not([type="date"])', concepto);
  await pag.click('.hoja button:has-text("Añadir gasto")');
  await pag.waitForTimeout(480);
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

/* ── 3quater. Entrenos con ejercicios, series y repeticiones ─────────────── */

{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(String(e)));

  await pag.addInitScript(() => {
    if (localStorage.getItem("__servidor_de_mentira__")) return;
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dd = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); };
    /* El historial de la pestaña enseña la semana en curso y manda el resto a
       «Otros días», así que la sesión reciente tiene que caer sí o sí dentro
       de esta semana. Restar días fijos fallaba los lunes, cuando «hace tres
       días» ya es la semana pasada. */
    const enEstaSemana = (n) => { const d = new Date(); const lunes = (d.getDay() + 6) % 7; return dd(Math.min(n, lunes)); };
    const uid = "usuarios/uid_leo";
    localStorage.setItem("__servidor_de_mentira__", JSON.stringify({
      usuarios: { "leo@ejemplo.com": { clave: "secreta10", uid: "uid_leo" } },
      docs: {
        "permitidos/leo@ejemplo.com": { nombre: "Leo" },
        [uid]: { email: "leo@ejemplo.com", bienvenida: 1 },
        // Dos sesiones anteriores de press banca, subiendo.
        [`${uid}/entrenos/e1`]: { fecha: dd(7), tipo: "fuerza", minutos: 60, intensidad: "media", ts: 1,
          ejercicios: [{ nombre: "Press banca", series: [{ reps: 8, kg: 70 }, { reps: 8, kg: 70 }] }] },
        [`${uid}/entrenos/e2`]: { fecha: enEstaSemana(3), tipo: "fuerza", minutos: 60, intensidad: "media", ts: 1,
          ejercicios: [{ nombre: "Press banca", series: [{ reps: 8, kg: 75 }, { reps: 6, kg: 77.5 }] }] },
      },
    }));
    sessionStorage.setItem("__sesion_de_mentira__", JSON.stringify({ uid: "uid_leo", email: "leo@ejemplo.com" }));
  });

  await pag.goto("http://localhost:8321/salud.html");
  await pag.waitForTimeout(1600);
  await pag.click("nav >> text=Entrenos");
  await pag.waitForTimeout(700);

  const inicio = await pag.innerText("body");
  check("entrenos: el historial resume series y kilos movidos", /serie/.test(inicio), inicio.slice(0, 300));
  check("entrenos: se ofrece repetir la última sesión", /Repetir el entreno/.test(inicio));

  /* Repetir trae los ejercicios con sus pesos, listos para guardar. */
  await pag.click("text=Repetir el entreno");
  await pag.waitForTimeout(600);
  const repetido = await pag.innerText("body");
  check("repetir: aparece el ejercicio de la última vez", /Press banca/.test(repetido));
  check("repetir: con los pesos de aquel día", /77,5×6|75×8/.test(repetido), repetido.slice(0, 400));

  await pag.click("text=Guardar entreno");
  await pag.waitForTimeout(1000);
  const guardado = await pag.evaluate(() => {
    const docs = window.__espia.verServidor().docs;
    return Object.entries(docs).filter(([r]) => /\/entrenos\//.test(r)).map(([, d]) => d);
  });
  check("repetir: se guarda un tercer entreno", guardado.length === 3, String(guardado.length));
  const nuevo = guardado.find((e) => (e.ejercicios || []).length && e.fecha === new Date().toISOString().slice(0, 10));
  check("repetir: con sus ejercicios y series dentro del documento",
    nuevo && nuevo.ejercicios[0].series.length === 2, JSON.stringify(nuevo && nuevo.ejercicios));

  /* Añadir un ejercicio a mano, con sus series. */
  await pag.click('button:has-text("Fuerza")');
  await pag.waitForTimeout(400);
  await pag.click("text=+ Añadir ejercicio");
  await pag.waitForTimeout(500);
  check("añadir ejercicio: se abre la hoja", /Añadir ejercicio/.test(await pag.innerText("body")));
  check("añadir ejercicio: sugiere ejercicios para no teclear a pelo",
    (await pag.$$eval(".rise button", (bs) => bs.map((b) => b.textContent.trim()))).includes("Sentadilla"));

  await pag.click('.rise button:has-text("Sentadilla")');
  await pag.waitForTimeout(400);
  await pag.fill('.rise input[aria-label="Repeticiones de la serie 1"]', "5");
  await pag.fill('.rise input[aria-label="Kilos de la serie 1"]', "100");
  await pag.click("text=+ Añadir serie");
  await pag.waitForTimeout(300);
  check("añadir ejercicio: la serie nueva copia la anterior",
    (await pag.inputValue('.rise input[aria-label="Kilos de la serie 2"]')) === "100");
  await pag.click("text=Añadir al entreno");
  await pag.waitForTimeout(500);
  const conSentadilla = await pag.innerText("body");
  check("añadir ejercicio: queda en la lista del entreno", /Sentadilla/.test(conSentadilla));
  check("añadir ejercicio: y se resume lo levantado", /kg movidos/.test(conSentadilla), conSentadilla.slice(0, 400));
  check("los kilos se escriben como se dicen: «75×8», no «75,0×8»",
    /75×8/.test(conSentadilla) && !/75,0×/.test(conSentadilla));

  /* Ficha de progresión. */
  await pag.click("text=Cancelar");
  await pag.waitForTimeout(400);
  // Ojo: el botón de repetir también dice «Press banca» en su subtítulo; el del
  // historial es el que lleva las series al lado.
  await pag.click('button:has-text("77,5×6")');
  await pag.waitForTimeout(700);
  const ficha = await pag.innerText("body");
  check("ficha: se abre la progresión del ejercicio", /Tu mejor serie|Progresión/i.test(ficha), ficha.slice(0, 250));
  check("ficha: enseña el récord", /récord|mejor serie/i.test(ficha));
  check("ficha: y cuántas sesiones lleva", /sesion/i.test(ficha));

  check("entrenos: nada se sale de la pantalla a lo ancho",
    await pag.evaluate(() => document.body.scrollWidth <= window.innerWidth + 1),
    JSON.stringify(await pag.evaluate(() => {
      const w = document.documentElement.clientWidth; const malos = [];
      document.querySelectorAll("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > w + 1) malos.push({ tag: el.tagName, cls: String(el.className || "").slice(0, 24), w: Math.round(r.width), txt: (el.textContent || "").trim().slice(0, 40) });
      });
      return malos.slice(0, 4);
    })));
  check("entrenos: ningún error de JavaScript", errores.length === 0, errores.join(" | "));
  await ctx.close();
}

/* ── 3quinquies. Un registro corrupto no puede dejar la pantalla en blanco ── */

{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(String(e)));

  /* Registros rotos de todas las formas que se me ocurren, mezclados con unos
     buenos. La app tiene que enseñar los buenos y no caerse por los otros. */
  await pag.addInitScript(() => {
    if (localStorage.getItem("__servidor_de_mentira__")) return;
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dd = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); };
    const uid = "usuarios/uid_mara";
    localStorage.setItem("__servidor_de_mentira__", JSON.stringify({
      usuarios: { "mara@ejemplo.com": { clave: "secreta11", uid: "uid_mara" } },
      docs: {
        "permitidos/mara@ejemplo.com": { nombre: "Mara" },
        [uid]: { email: "mara@ejemplo.com", bienvenida: 1, perfil: { altura: "170", edad: "29", sexo: "mujer", actividad: "ligera", objetivo: "bajar" } },

        [`${uid}/pesos/bueno`]: { fecha: dd(1), kg: 64.2, nota: "" },
        [`${uid}/pesos/sinFecha`]: { kg: 63 },
        [`${uid}/pesos/sinKg`]: { fecha: dd(2) },
        [`${uid}/pesos/fechaRara`]: { fecha: "ayer por la tarde", kg: 64 },
        [`${uid}/pesos/kgTexto`]: { fecha: dd(3), kg: "sesenta" },

        [`${uid}/entrenos/bueno`]: { fecha: dd(1), tipo: "fuerza", minutos: 45, intensidad: "media", ts: 1 },
        [`${uid}/entrenos/sinTipo`]: { fecha: dd(2), minutos: 30 },
        [`${uid}/entrenos/ejSinSeries`]: { fecha: dd(2), tipo: "fuerza", ts: 1, ejercicios: [{ nombre: "Sentadilla" }] },
        [`${uid}/entrenos/ejSinNombre`]: { fecha: dd(3), tipo: "fuerza", ts: 1, ejercicios: [{ series: [{ reps: 8, kg: 40 }] }] },
        [`${uid}/entrenos/ejRaros`]: { fecha: dd(3), tipo: "fuerza", ts: 2, ejercicios: [{ nombre: "Prensa", series: [{ reps: "ocho", kg: "cuarenta" }] }] },

        [`${uid}/comidas/buena`]: { fecha: dd(1), texto: "Ensalada y pollo", momento: "comida", volumen: 3, saciedad: 3, ts: 1 },
        [`${uid}/comidas/sinTexto`]: { fecha: dd(1), momento: "cena", volumen: 3, ts: 2 },
        [`${uid}/comidas/sinVolumen`]: { fecha: dd(2), texto: "Tostada", momento: "desayuno", ts: 1 },
        [`${uid}/comidas/emojis`]: { fecha: dd(2), texto: "🍕🍺🎂", momento: "cena", volumen: 5, ts: 2 },
        [`${uid}/comidas/larguisima`]: { fecha: dd(2), texto: "arroz ".repeat(200), momento: "comida", volumen: 3, ts: 3 },
      },
    }));
    sessionStorage.setItem("__sesion_de_mentira__", JSON.stringify({ uid: "uid_mara", email: "mara@ejemplo.com" }));
  });

  await pag.goto("http://localhost:8321/salud.html");
  await pag.waitForTimeout(1800);

  const hayApp = async () => /Peso|Entrenos|Comidas/.test(await pag.innerText("body"));
  check("datos rotos: la app arranca igual", await hayApp(), (await pag.innerText("body")).slice(0, 200));
  check("datos rotos: se ve el pesaje bueno", /64,2/.test(await pag.innerText("body")));

  for (const t of ["Entrenos", "Comidas"]) {
    await pag.click(`nav >> text=${t}`);
    await pag.waitForTimeout(800);
    check(`datos rotos: la pestaña de ${t} se pinta`, await hayApp(), (await pag.innerText("body")).slice(0, 160));
    check(`datos rotos: ${t} no enseña «undefined» ni «NaN»`,
      !/undefined|NaN/.test(await pag.innerText("body")),
      (await pag.innerText("body")).replace(/\n+/g, " | ").slice(0, 240));
    check(`datos rotos: ${t} no se sale de la pantalla`,
      await pag.evaluate(() => document.body.scrollWidth <= window.innerWidth + 1),
      String(await pag.evaluate(() => document.body.scrollWidth)));
  }

  // Y la valoración, que es la que más cuentas echa.
  await pag.click("text=Valorar mi semana");
  await pag.waitForTimeout(1200);
  const val = await pag.innerText("body");
  check("datos rotos: la valoración se genera", /Cómo va todo/i.test(val), val.slice(0, 200));
  check("datos rotos: la valoración no enseña «undefined» ni «NaN»", !/undefined|NaN/.test(val), val.replace(/\n+/g, " | ").slice(0, 260));

  /* El perfil es la última pantalla de Salud que quedaba sin abrir en ninguna
     prueba, que es exactamente como se cuela un fallo hasta producción. */
  await pag.click('[aria-label="Cerrar"]');
  await pag.waitForTimeout(400);
  await pag.click('button[aria-label="Perfil"]');
  await pag.waitForTimeout(600);
  const perfil = await pag.innerText("body");
  check("datos rotos: el perfil se abre", /Altura|Objetivo/i.test(perfil), perfil.slice(0, 220));
  check("datos rotos: y no enseña «undefined» ni «NaN»", !/undefined|NaN/.test(perfil), perfil.slice(0, 260));

  check("datos rotos: ni un solo error de JavaScript en todo el recorrido", errores.length === 0, errores.join(" | "));
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

  /* ── la bienvenida deja el mes montado ─────────────────────────────────── */

  /* Los rótulos van en versalitas por CSS, así que `innerText` los devuelve
     en mayúsculas: las comparaciones de texto van sin distinguir. */
  check("gastos: una cuenta nueva aterriza en la bienvenida", /1 de 3/i.test(await texto(pag)));

  await pag.fill(".importeInput", "2000");
  await pag.click('button:has-text("Seguir")');
  await pag.waitForTimeout(300);
  await pag.fill(".importeInput", "700");
  await pag.click('button:has-text("Seguir")');
  await pag.waitForTimeout(300);

  /* 2000 que entran menos el 15% redondeado a decenas = 1700 de tope, y por
     tanto 300 que sobran. Si esa cuenta cambia, este número canta. */
  check("gastos: el tercer paso sugiere un tope y dice lo que sobra",
    /sobrarían/.test(await texto(pag)) && /300/.test(await texto(pag)), await texto(pag));

  await pag.click('button:has-text("Empezar")');
  await pag.waitForTimeout(1000);

  check("gastos: tras la bienvenida se ve el mes", /Resumen|Análisis|Ajustes/.test(await texto(pag)));
  check("gastos: y con la nómina apuntada la cifra grande es lo que queda",
    /Te queda este mes/i.test(await texto(pag)), (await texto(pag)).slice(0, 200));

  const trasBienvenida = await pag.evaluate(() => window.__espia.verServidor());
  const fijosCreados = Object.entries(trasBienvenida.docs)
    .filter(([r]) => /\/fijos\//.test(r))
    .map(([, d]) => d);
  check("gastos: la bienvenida crea la nómina como ingreso fijo",
    fijosCreados.some((f) => f.tipo === "ingreso" && f.importe === 2000),
    JSON.stringify(fijosCreados));
  check("gastos: y el gasto fijo como gasto",
    fijosCreados.some((f) => f.tipo === "gasto" && f.importe === 700),
    JSON.stringify(fijosCreados));
  check("gastos: el tope queda guardado en la cuenta",
    trasBienvenida.docs["usuarios/uid_carla_ejemplo_com"]?.ajustes?.presupuestoGlobal === 1700,
    JSON.stringify(trasBienvenida.docs["usuarios/uid_carla_ejemplo_com"]?.ajustes));

  /* ── la tarjeta de revisión no aparece con el mes recién empezado ──────── */

  check("gastos: sin apenas movimientos no se ofrece revisar el mes",
    (await pag.locator(".tarjetaRevision").count()) === 0);

  await apuntarGasto(pag, 42.3, "Mercadona");
  await apuntarGasto(pag, 18, "Gasolina");
  check("gastos: con tres movimientos ya sí",
    (await pag.locator(".tarjetaRevision").count()) === 1);

  const servidor = await pag.evaluate(() => window.__espia.verServidor());
  const cats = Object.keys(servidor.docs).filter((r) => /\/categorias\//.test(r));
  check("gastos: una cuenta nueva arranca con sus categorías", cats.length >= 9, String(cats.length));
  check(
    "gastos: las categorías se siembran dentro de su usuario",
    cats.every((r) => r.startsWith("usuarios/uid_carla_ejemplo_com/categorias/"))
  );

  // El orden pensado tiene que sobrevivir a que Firestore ordene por id.
  await pag.click('.pestana:has-text("Ajustes")');
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

  /* Los botones con identidad propia tienen que conservarla. El reset
     `.gx button` llegó a pesar más que `.fab` o `.tarjetaRevision` y les
     borraba el fondo: la app entera salía en blanco y el subtítulo de la
     tarjeta de revisión quedaba en blanco sobre blanco, ilegible. */
  const pintura = await pag.evaluate(() => {
    const luz = (c) => {
      const [r, g, b] = c.match(/\d+/g).map(Number).map((v) => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const fondoReal = (el) => {
      let n = el, bg = "rgba(0, 0, 0, 0)";
      while (n && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement; }
      return bg;
    };
    const salida = {};
    for (const sel of [".fab", ".tarjetaRevision", ".revisionPie"]) {
      const el = document.querySelector(sel);
      if (!el) { salida[sel] = null; continue; }
      const fg = getComputedStyle(el).color;
      const bg = fondoReal(el);
      const [a, b] = [luz(fg), luz(bg)];
      salida[sel] = { fondo: getComputedStyle(el).backgroundColor, contraste: Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 10) / 10 };
    }
    return salida;
  });

  const transparente = (c) => !c || c === "rgba(0, 0, 0, 0)" || c === "transparent";
  check("gastos: el botón de añadir conserva su color",
    pintura[".fab"] && !transparente(pintura[".fab"].fondo), JSON.stringify(pintura[".fab"]));
  check("gastos: la tarjeta de revisión sigue siendo la oscura",
    pintura[".tarjetaRevision"] && !transparente(pintura[".tarjetaRevision"].fondo), JSON.stringify(pintura[".tarjetaRevision"]));
  check("gastos: y su subtítulo se lee (contraste ≥ 4,5)",
    pintura[".revisionPie"] && pintura[".revisionPie"].contraste >= 4.5, JSON.stringify(pintura[".revisionPie"]));

  /* ── lo que se repite: pantalla propia y hoja que no revienta ──────────── */

  /* Esto es lo que faltaba: la hoja del gasto fijo no se abría en ninguna
     prueba, y llegó a producción llamando a variables que no existían en su
     ámbito. Se abre ReferenceError en mano y se lleva la pantalla entera. */
  await pag.click('.pestana:has-text("Ajustes")');
  await pag.waitForTimeout(400);
  await pag.click(".filaAjuste");
  await pag.waitForTimeout(500);

  const enFijos = await texto(pag);
  check("gastos: los fijos tienen pantalla propia", /Lo que entra/.test(enFijos) && /Lo que sale/.test(enFijos), enFijos.slice(0, 300));
  check("gastos: y separan la nómina del alquiler",
    /Nómina/.test(enFijos) && /Alquiler/.test(enFijos), enFijos.slice(0, 300));

  await pag.click('.listaFijos button:has-text("Alquiler")');
  await pag.waitForTimeout(450);
  check("gastos: la hoja del gasto fijo se abre sin romperse",
    /Gasto fijo/.test(await texto(pag)) && errores.length === 0, errores.join(" | "));
  await pag.click('.hoja button[aria-label="Cerrar"]');
  await pag.waitForTimeout(300);

  await pag.click('.listaFijos button:has-text("Nómina")');
  await pag.waitForTimeout(450);
  const enHojaIngreso = await texto(pag);
  check("gastos: y la de la nómina se abre como ingreso",
    /Ingreso fijo/.test(enHojaIngreso) && /DE DÓNDE VIENE/i.test(enHojaIngreso), enHojaIngreso.slice(0, 300));
  await pag.click('.hoja button[aria-label="Cerrar"]');
  await pag.waitForTimeout(300);

  await pag.click('.pantallaCompleta button[aria-label="Cerrar"]');
  await pag.waitForTimeout(400);

  /* ── el presupuesto se cambia desde donde se ve ────────────────────────── */

  await pag.click('.pestana:has-text("Resumen")');
  await pag.waitForTimeout(400);
  await pag.click(".barraPres.pulsable");
  await pag.waitForTimeout(320);
  await pag.fill(".filaEditor input", "1500");
  await pag.click('.filaEditor button:has-text("Guardar")');
  await pag.waitForTimeout(700);

  const trasTope = await pag.evaluate(() => window.__espia.verServidor());
  check("gastos: el tope se edita desde el Resumen",
    trasTope.docs["usuarios/uid_carla_ejemplo_com"]?.ajustes?.presupuestoGlobal === 1500,
    JSON.stringify(trasTope.docs["usuarios/uid_carla_ejemplo_com"]?.ajustes));

  /* ── el buscador filtra por fecha, no solo por texto ───────────────────── */

  await pag.click('button[aria-label="Buscar movimientos"]');
  await pag.waitForTimeout(450);
  /* Solo lo que hay dentro del buscador: la lista del Resumen sigue detrás,
     en el DOM, y miraría por él. */
  const enBuscador = () => pag.innerText(".pantallaCompleta");

  await pag.fill(".pantallaCaja .campoAncho", "mercadona");
  await pag.waitForTimeout(350);
  check("gastos: el buscador encuentra por concepto",
    /Mercadona/.test(await enBuscador()) && !/Gasolina/.test(await enBuscador()),
    (await enBuscador()).slice(0, 300));

  await pag.fill(".pantallaCaja .campoAncho", "");
  await pag.click('.chips button:has-text("Este año")');
  await pag.waitForTimeout(350);
  check("gastos: y el tramo «este año» deja pasar lo de este mes",
    /Mercadona/.test(await enBuscador()) && /Gasolina/.test(await enBuscador()),
    (await enBuscador()).slice(0, 300));

  /* Un rango que no contiene nada tiene que vaciar la lista, no ignorarse. */
  await pag.fill('.pantallaCaja input[type="date"] >> nth=0', "2001-01-01");
  await pag.fill('.pantallaCaja input[type="date"] >> nth=1', "2001-12-31");
  await pag.waitForTimeout(350);
  check("gastos: un rango de fechas vacío no devuelve nada",
    /Nada coincide/.test(await enBuscador()) && !/Mercadona/.test(await enBuscador()),
    (await enBuscador()).slice(0, 300));
  await pag.click('.pantallaCaja button[aria-label="Cerrar"]');
  await pag.waitForTimeout(350);

  /* ── objetivos de ahorro: hay que poder crear el primero ───────────────── */

  /* La tarjeta de objetivos del Resumen solo sale cuando ya hay alguno: sin
     una puerta en Ajustes no había forma de crear el primero. */
  await pag.click('.pestana:has-text("Ajustes")');
  await pag.waitForTimeout(400);
  await pag.click('.filaAjuste:has-text("Objetivos")');
  await pag.waitForTimeout(450);
  check("gastos: se llega a los objetivos sin tener ninguno",
    /Objetivos de ahorro/i.test(await pag.innerText(".pantallaCompleta")));

  await pag.click('.pantallaCaja button:has-text("Añadir objetivo")');
  await pag.waitForTimeout(300);
  await pag.fill('.pantallaCaja input[placeholder="Un coche"]', "Un coche");
  await pag.fill('.pantallaCaja input[placeholder="3000"]', "3000");
  await pag.fill('.pantallaCaja input[placeholder="0"]', "600");
  await pag.click('.pantallaCaja button:has-text("Guardar")');
  await pag.waitForTimeout(800);

  await pag.click('.pestana:has-text("Resumen")');
  await pag.waitForTimeout(500);
  const conObjetivo = await pag.innerText("main");
  check("gastos: el objetivo aparece en el Resumen con su avance",
    /Un coche/.test(conObjetivo) && /20%/.test(conObjetivo), conObjetivo.slice(0, 400));

  /* ── la revisión del mes ───────────────────────────────────────────────── */

  await pag.click(".tarjetaRevision");
  await pag.waitForTimeout(700);
  const revision = await pag.innerText(".pantallaCompleta");
  check("gastos: la revisión del mes se abre y dice algo", revision.length > 80, revision.slice(0, 200));
  check("gastos: y no enseña ni un «undefined» ni un «null»",
    !/undefined|NaN|\[object/.test(revision), revision.slice(0, 400));
  await pag.click('.pantallaCaja button[aria-label="Cerrar"]');
  await pag.waitForTimeout(350);

  /* ── la pantalla de cuenta ─────────────────────────────────────────────── */

  await pag.click('button[aria-label^="Cuenta"]');
  await pag.waitForTimeout(600);
  check("gastos: la pantalla de cuenta se abre", /carla@ejemplo.com/.test(await texto(pag)));
  await pag.click('.pantallaCompleta button[aria-label="Cerrar"], [aria-label="Cerrar"] >> nth=0');
  await pag.waitForTimeout(400);

  check("gastos: ningún error de JavaScript en todo el recorrido", errores.length === 0, errores.join(" | "));
  await ctx.close();
}

/* ── 5bis. Gastos: apuntar hablando ──────────────────────────────────────── */

{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(String(e)));

  await pag.addInitScript(() => {
    if (localStorage.getItem("__servidor_de_mentira__")) return;
    localStorage.setItem("__servidor_de_mentira__", JSON.stringify({
      usuarios: {}, docs: { "permitidos/eva@ejemplo.com": { nombre: "Eva" } },
    }));
  });
  await conVozDeMentira(pag, "cuarenta y dos con treinta en el Mercadona");

  await pag.goto("http://localhost:8321/gastos.html");
  await pag.waitForTimeout(400);
  await acceder(pag, "eva@ejemplo.com", "secreta5", { registrar: true });
  await pag.waitForTimeout(900);
  await saltarBienvenida(pag);

  await pag.click(".fabVoz");
  await pag.waitForTimeout(700);

  const oido = await pag.inputValue("textarea");
  check("voz: lo dictado llega al campo", /Mercadona/.test(oido), oido);

  await pag.click('button:has-text("Usar esto")');
  await pag.waitForTimeout(700);

  check("voz: se abre la hoja del gasto, no se guarda a la brava",
    (await pag.locator(".hoja").count()) === 1);
  check("voz: con el importe puesto",
    (await pag.inputValue(".hoja .importeInput")) === "42.3", await pag.inputValue(".hoja .importeInput"));
  check("voz: y con el concepto",
    (await pag.inputValue('.hoja .dosColumnas input:not([type="date"])')) === "Mercadona",
    await pag.inputValue('.hoja .dosColumnas input:not([type="date"])'));

  /* Hasta que no se confirma, en la cuenta no hay nada. */
  const antes = await pag.evaluate(() => window.__espia.verServidor());
  check("voz: dictar no ha escrito nada todavía",
    !Object.keys(antes.docs).some((r) => /\/gastos\//.test(r)), Object.keys(antes.docs).join(" "));

  await pag.click('.hoja button:has-text("Añadir gasto")');
  await pag.waitForTimeout(700);
  const despues = await pag.evaluate(() => window.__espia.verServidor());
  const guardado = Object.entries(despues.docs).find(([r]) => /\/gastos\//.test(r));
  check("voz: al confirmar sí se guarda", Boolean(guardado), Object.keys(despues.docs).join(" "));
  check("voz: y guarda lo que se dijo",
    guardado && guardado[1].importe === 42.3 && guardado[1].nota === "Mercadona", JSON.stringify(guardado && guardado[1]));

  /* Sin micrófono la hoja tiene que seguir sirviendo: es el mismo intérprete. */
  await pag.evaluate(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  await pag.click(".fabVoz");
  await pag.waitForTimeout(500);
  check("voz: sin micrófono se ofrece escribirlo", /no sabe escuchar/i.test(await texto(pag)),
    (await texto(pag)).slice(0, 300));
  await pag.fill("textarea", "me han ingresado la nómina, 2.100");
  await pag.click('button:has-text("Usar esto")');
  await pag.waitForTimeout(700);
  check("voz: escrito a mano funciona igual, y sabe que es un ingreso",
    /Nuevo ingreso/i.test(await texto(pag)), (await texto(pag)).slice(0, 200));

  check("voz: ningún error de JavaScript", errores.length === 0, errores.join(" | "));
  await ctx.close();
}

/* ── 5ter. Salud: apuntar hablando ───────────────────────────────────────── */

{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(String(e)));

  await pag.addInitScript(() => {
    if (localStorage.getItem("__servidor_de_mentira__")) return;
    localStorage.setItem("__servidor_de_mentira__", JSON.stringify({
      usuarios: {}, docs: { "permitidos/gala@ejemplo.com": { nombre: "Gala" } },
    }));
  });
  await conVozDeMentira(pag, "press banca 80 por 8 y 80 por 6");

  await pag.goto("http://localhost:8321/salud.html");
  await pag.waitForTimeout(400);
  await acceder(pag, "gala@ejemplo.com", "secreta6", { registrar: true });
  await pag.waitForTimeout(900);
  await saltarBienvenida(pag);

  await pag.click('button[aria-label="Apuntar hablando"]');
  await pag.waitForTimeout(700);
  check("voz salud: lo dictado llega al campo", /press banca/i.test(await pag.inputValue("textarea")),
    await pag.inputValue("textarea"));

  await pag.click('button:has-text("Usar esto")');
  await pag.waitForTimeout(800);

  const enHoja = await pag.innerText(".rise");
  check("voz salud: abre la hoja en Entreno", /Entreno/i.test(enHoja), enHoja.slice(0, 200));
  check("voz salud: enseña lo que ha entendido antes de guardar",
    /Press banca/i.test(enHoja) && /80×8/.test(enHoja), enHoja.slice(0, 400));

  await pag.click('.rise button:has-text("Guardar")');
  await pag.waitForTimeout(800);
  const srv = await pag.evaluate(() => window.__espia.verServidor());
  const entreno = Object.entries(srv.docs).find(([r]) => /\/entrenos\//.test(r));
  check("voz salud: se guarda el entreno", Boolean(entreno), Object.keys(srv.docs).join(" "));
  check("voz salud: con sus ejercicios y series",
    entreno && entreno[1].ejercicios && entreno[1].ejercicios[0].series.length === 2,
    JSON.stringify(entreno && entreno[1].ejercicios));

  check("voz salud: ningún error de JavaScript", errores.length === 0, errores.join(" | "));
  await ctx.close();
}

/* ── 6. Gastos: Análisis con la cuenta vacía y justo después con datos ────── */

/* El día que se apunta el primer gasto estando en Análisis, la pestaña pasa de
   «no hay nada» a tener contenido sin desmontarse. Si algún `useState` vive
   por debajo de ese return, React ve aparecer un hook y tumba la pantalla. */
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const pag = await ctx.newPage();
  const errores = [];
  pag.on("pageerror", (e) => errores.push(String(e)));

  await pag.addInitScript(() => {
    if (localStorage.getItem("__servidor_de_mentira__")) return;
    localStorage.setItem("__servidor_de_mentira__", JSON.stringify({
      usuarios: {}, docs: { "permitidos/diego@ejemplo.com": { nombre: "Diego" } },
    }));
  });

  await pag.goto("http://localhost:8321/gastos.html");
  await pag.waitForTimeout(400);
  await acceder(pag, "diego@ejemplo.com", "secreta4", { registrar: true });
  await pag.waitForTimeout(900);
  await saltarBienvenida(pag);

  await pag.click('.pestana:has-text("Análisis")');
  await pag.waitForTimeout(500);
  const vacio = await texto(pag);
  check("gastos: Análisis vacío explica qué se verá aquí", /en qué se te va el dinero/.test(vacio), vacio.slice(0, 300));
  check("gastos: y ofrece apuntar el primero", /Apuntar el primero/.test(vacio));

  await apuntarGasto(pag, 25, "Cena");
  await pag.waitForTimeout(600);

  const conDatos = await texto(pag);
  check("gastos: apuntar desde Análisis no tumba la pestaña",
    /Dónde se va el dinero/.test(conDatos), conDatos.slice(0, 300));
  check("gastos: el gráfico diario vive ahora en Análisis", /Día a día/.test(conDatos));
  await pag.click('.pestana:has-text("Resumen")');
  await pag.waitForTimeout(500);
  check("gastos: y ya no está en el Resumen", (await pag.locator(".pulsoBarras").count()) === 0);

  check("gastos: ningún error de JavaScript al pasar de vacío a lleno", errores.length === 0, errores.join(" | "));
  await ctx.close();
}

await nav.close();
srv.close();
await rm(dir, { recursive: true, force: true });

console.log(fallos ? `\n${fallos} fallos` : "\nTodo correcto");
process.exit(fallos ? 1 : 0);
