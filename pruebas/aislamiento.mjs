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
const reglas = leer("firestore.rules");

const rutas = [...nube.matchAll(/(?:collection|doc)\(\s*s\.db\s*,([^)]*)\)/g)].map((m) =>
  m[1].replace(/\s+/g, " ").trim()
);
check("hay rutas de Firestore que revisar", rutas.length >= 6, String(rutas.length));
/* El uid solo puede venir de dos sitios: el que recibe la función (comprobado
   antes contra el usuario de la sesión) o el de la cuenta recién creada.
   La única ruta fuera de `usuarios` es la lista de invitados, y ahí solo se
   mira la entrada del propio correo. */
const dueño = /^"usuarios",\s*(uid|cred\.user\.uid)\b/;
const listaInvitados = /^"permitidos",\s*normalizar\(email/;
check(
  "toda ruta de Firestore cuelga del usuario (salvo la lista de invitados)",
  rutas.every((r) => dueño.test(r) || listaInvitados.test(r)),
  rutas.find((r) => !dueño.test(r) && !listaInvitados.test(r))
);
check(
  "la lista de invitados solo se consulta, nunca se escribe desde la app",
  !/set(Doc|Data)\([^)]*"permitidos"/.test(nube) && /allow write: if false/.test(reglas)
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

/* Las reglas del servidor tienen que cubrir exactamente las mismas. */
const enCodigo = JSON.parse(
  nube.match(/export const COLECCIONES = (\[[^\]]*\])/)[1].replace(/'/g, '"')
);
const enReglas = [...reglas.matchAll(/match \/usuarios\/\{uid\}\/(\w+)\/\{/g)].map((m) => m[1]);
check(
  "cada colección del código tiene su bloque en las reglas",
  enCodigo.every((c) => enReglas.includes(c)),
  `faltan: ${enCodigo.filter((c) => !enReglas.includes(c))}`
);
check(
  "y las reglas no abren ninguna colección que el código no use",
  enReglas.every((c) => enCodigo.includes(c)),
  `sobran: ${enReglas.filter((c) => !enCodigo.includes(c))}`
);

check("las reglas comprueban que el UID es el de quien pide", /request\.auth\.uid == uid/.test(reglas));
check("las reglas cierran todo lo demás", /match \/\{document=\*\*\}[\s\S]*?if false/.test(reglas));

/* Toda regla de datos pasa por `puede(uid)`, que es quien junta las dos
   condiciones: eres tú y estás en la lista. */
const bloquesDatos = [...reglas.matchAll(/match \/usuarios\/\{uid\}[^{]*\{([\s\S]*?)\n    \}/g)].map((m) => m[1]);
check("hay bloques de datos que revisar", bloquesDatos.length === enCodigo.length + 1, `${bloquesDatos.length} bloques para ${enCodigo.length} colecciones`);
check(
  "ninguna regla de datos se salta la comprobación de usuario e invitación",
  bloquesDatos.every((b) =>
    b.split("\n").filter((l) => /allow/.test(l)).every((l) => /puede\(uid\)|if false/.test(l))),
  bloquesDatos.find((b) => b.split("\n").some((l) => /allow/.test(l) && !/puede\(uid\)|if false/.test(l)))
);
check(
  "la invitación se comprueba contra la lista, no contra un correo escrito a mano",
  /exists\(\/databases\/\$\(database\)\/documents\/permitidos\/\$\(correo\(\)\)\)/.test(reglas)
);

/* Escribir tiene además que pasar una validación de forma y tamaño. */
for (const col of enCodigo) {
  const bloque = reglas.match(new RegExp(`match /usuarios/\\{uid\\}/${col}/\\{[\\s\\S]*?\\n    \\}`))[0];
  check(
    `${col}: crear o modificar exige validación de contenido`,
    /allow create, update: if puede\(uid\) && \w+Ok\(\)/.test(bloque),
    bloque.replace(/\s+/g, " ")
  );
}
check("hay un tope de campos por documento", /keys\(\)\.size\(\) <= max/.test(reglas));
check("y un tope de longitud para el texto", /valor is string && valor\.size\(\) <= max/.test(reglas));

/* ── Que no se pueda averiguar quién tiene cuenta ────────────────────────── */

const mensajes = nube.match(/const MENSAJES = \{[\s\S]*?\};/)[0];
for (const codigo of ["auth/user-not-found", "auth/wrong-password", "auth/invalid-credential"]) {
  check(
    `«${codigo}» no delata si la cuenta existe`,
    new RegExp(`"${codigo}": CREDENCIAL`).test(mensajes),
    mensajes.split("\n").find((l) => l.includes(codigo))
  );
}
check(
  "recuperar la contraseña responde igual exista o no la cuenta",
  /inocuo\.includes\(e && e\.code\)\) return;/.test(nube)
);

/* ── 2. Nada de datos del usuario en el propio dispositivo ──────────────── */

/* localStorage solo puede aparecer en tres sitios: los núcleos, para rescatar
   lo de la versión anterior; el bloqueo, que es de este aparato a propósito
   —un PIN es un cierre de pantalla, no una credencial de la cuenta—; y el
   tema, que es una preferencia de esta pantalla y no un dato de la cuenta.
   Ningún dato tuyo puede acabar ahí. */
const usanAlmacenLocal = fuentes.filter(([, t]) => /localStorage|sessionStorage/.test(t)).map(([f]) => f);
check(
  "al almacén del navegador solo llegan el rescate, el bloqueo y el tema",
  usanAlmacenLocal.every((f) => /nucleo\.js$|comun\/bloqueo\.js$|comun\/tema\.js$/.test(f)),
  usanAlmacenLocal.join(", ")
);

/* ── que una versión nueva llegue de verdad ─────────────────────────────── */

/* El service worker servía `app.js` de caché primero. Consecuencia: tras cada
   publicación, el primer arranque daba la versión ANTERIOR y la nueva solo
   quedaba guardada para el siguiente. Cerrar la app del todo no arreglaba nada
   porque el problema no estaba en la pestaña, y desde fuera no había manera de
   saberlo: parecía que el despliegue no había salido. */
{
  const sw = leer("src/plantillas/sw.js");
  check(
    "el paquete de la app se pide a la red antes que a la caché",
    /esDocumento\(req\)[^{]*resto === "app\.js"/.test(sw),
    sw.split("\n").find((l) => l.includes("esDocumento(req)"))
  );
  check(
    "y sin conexión sigue habiendo respuesta desde lo guardado",
    /\.catch\(\(\) => caches\.match\(req\)/.test(sw)
  );
  check(
    "una versión nueva no espera a que se cierren las pestañas",
    /self\.skipWaiting\(\)/.test(sw) && /clients\.claim\(\)/.test(sw)
  );
}

/* ── el PIN, que es un secreto por pequeño que sea ──────────────────────── */

{
  const bloqueo = leer("src/comun/bloqueo.js");
  check("el PIN se guarda con su resumen, no en claro",
    /crypto\.subtle\.digest\("SHA-256"/.test(bloqueo) && !/setItem\([^)]*\bpin\b/.test(bloqueo));
  check("y con sal, para que dos PIN iguales no den el mismo resumen",
    /getRandomValues/.test(bloqueo) && /sal/.test(bloqueo));
  check("comprobarlo no se hace con un igual a secas",
    !/hash === g\.hash/.test(bloqueo) && /diferencia \|=/.test(bloqueo),
    "la comparación tiene que ser de tiempo constante");
  /* Se mira lo que hace, no lo que cuenta: la palabra «Firestore» sale en el
     comentario de arriba explicando justamente que el PIN no va allí. */
  check("el bloqueo no toca la nube: ni la importa ni la llama",
    !/^\s*import .*nube\.js/m.test(bloqueo) && !/\b(setDoc|getDoc|collection|doc)\s*\(/.test(bloqueo));
  check("y no se puede quedar a medias si el navegador no deja guardar",
    /catch \(e\)/.test(bloqueo) && /return false/.test(bloqueo));

  /* Que el candado esté DENTRO de la puerta y no colgado por fuera: si se
     dibujase junto a la app, la app ya estaría montada detrás. */
  const puerta = leer("src/comun/sesion.jsx");
  check("el candado se dibuja en vez de la aplicación, no encima",
    /if \(!abierto\) \{[\s\S]{0,200}?<PantallaBloqueo/.test(puerta));
  check("y va después de comprobar la invitación",
    puerta.indexOf("SinInvitacion paleta") < puerta.indexOf("<PantallaBloqueo"));
}

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
/* Una colección rechazada no puede dejar la app cargando para siempre: `listo`
   espera a que todas contesten, así que la que falla tiene que darse por
   contestada. Pasó al añadir `plantillas`: hasta publicar las reglas nuevas,
   Salud entera se quedaba en «Cargando tus datos…». */
check(
  "una colección que falla se da por contestada, para no bloquear a las demás",
  /const fallo = \(que\) => \(e\) => \{[\s\S]*?if \(que\) yaEsta\(que\);/.test(datos)
);
check(
  "y cada escucha pasa su propio nombre al manejador de fallos",
  /fallo\("usuario"\)/.test(datos) && /fallo\(nombre\)/.test(datos)
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

/* ── 3bis. Ninguna pantalla se queda sin abrir en las pruebas ───────────── */

/* Una hoja que no se abre en ninguna prueba puede llegar rota a producción.
   Pasó: la del gasto fijo se quedó llamando a variables de otro componente y
   no reventó hasta que alguien la abrió. `pruebas/extremo.mjs` lleva el
   inventario de lo que abre; aquí solo se comprueba que no falte ninguna. */
{
  const { PANTALLAS_ABIERTAS } = await import("./extremo-inventario.mjs");
  /* Las compartidas cuentan para las dos apps: cada una las abre por su lado
     y en cada una se pintan con su paleta, así que en las dos hay que verlas. */
  const compartidas = ["src/comun/cuenta.jsx", "src/comun/voz.jsx", "src/comun/bloqueo.jsx"].map(leer).join("\n");
  for (const app of ["gastos", "salud"]) {
    const texto = leer(`src/${app}/App.jsx`) + "\n" + compartidas;
    const definidas = [...texto.matchAll(/^(?:export )?function (Hoja\w+|Pantalla\w+|Bienvenida)\(/gm)].map((m) => m[1]);
    const abiertas = PANTALLAS_ABIERTAS[app] || [];
    check(
      `${app}: la prueba de navegador abre todas las pantallas y hojas`,
      definidas.every((c) => abiertas.includes(c)),
      `sin abrir: ${definidas.filter((c) => !abiertas.includes(c))}`
    );
    check(
      `${app}: y el inventario no nombra pantallas que ya no existen`,
      abiertas.every((c) => definidas.includes(c)),
      `sobran: ${abiertas.filter((c) => !definidas.includes(c))}`
    );
  }
}

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
