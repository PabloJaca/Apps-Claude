# Mis Apps — Gastos y Salud

Dos aplicaciones web personales (PWA) que se instalan en el móvil y se usan igual en el
ordenador, con los mismos datos en los dos sitios.

- **Gastos** — gastos del día a día, gastos fijos, presupuestos y una revisión mensual.
- **Salud** — peso, entrenos y comidas, con estimación de calorías y valoración semanal o mensual.

Las dos funcionan **sin ninguna clave de API**: todos los análisis se calculan en el
propio dispositivo. Los datos, en cambio, no viven en el dispositivo: viven en tu cuenta,
así que están igual en el móvil, en el ordenador y en el móvil nuevo del año que viene.

---

## Lo que hay en este repositorio

```
src/            código fuente
  comun/        acceso (sesion.jsx), datos (datos.js), Firebase (nube.js), pantalla de cuenta
  gastos/       app de gastos + motor de análisis mensual
  salud/        app de salud + tabla de alimentos, estimador y valoración
  plantillas/   plantilla del service worker
pruebas/        pruebas; falso/ es un Firebase de mentira para probar en un navegador
sitio/          EL SITIO YA COMPILADO — esto es lo que se sube al hosting
build.mjs       compilación (esbuild)
servidor.mjs    servidor local para probar
firestore.rules reglas de seguridad de la base de datos
mis-apps.zip    el contenido de /sitio comprimido, por comodidad
```

## Compilar

```bash
npm install
npm run build             # deja el resultado en /sitio
npm run dev               # recompila al guardar
npm run zip               # compila y regenera mis-apps.zip
npm run servir            # compila y sirve en http://localhost:4173
npm run probar            # aislamiento entre cuentas, migración y valoración
npm run probar-navegador  # abre las dos apps con dos cuentas y comprueba que no se mezclan
```

## Publicar

Hay dos formas, y no hace falta usar las dos.

**Automática (GitHub Pages).** Cada vez que se actualiza `main`, el flujo de trabajo
`.github/workflows/publicar.yml` compila, pasa las pruebas y publica `sitio/`. Para
activarlo, una sola vez: **Settings → Pages → Source → GitHub Actions**. La dirección
queda en `https://<usuario>.github.io/<repositorio>/`.

**A mano.** Subir **todo el contenido de `sitio/`** al hosting que sea, o descomprimir
allí `mis-apps.zip`. Son archivos estáticos: vale cualquier servidor, y funciona igual
colgado en la raíz del dominio que en un subdirectorio.

En los dos casos hay que añadir el dominio en **Firebase → Authentication →
Configuración → Dominios autorizados**, o el inicio de sesión fallará.

---

## Dónde viven los datos

En **tu cuenta**, y en ningún otro sitio. Las dos apps usan **Firebase**: acceso con
correo y contraseña, y **Cloud Firestore** como única fuente de verdad. El plan gratuito
sobra de largo para un uso personal.

**No se entra, no se ve nada.** Sin sesión iniciada no se dibuja ni una pantalla: ni
pestañas, ni listas, ni un resto de quien usara el aparato antes. La aplicación solo se
monta cuando hay un usuario de verdad.

Todo cuelga del identificador de la cuenta, y **un registro es un documento**:

```
usuarios/{uid}                     correo, perfil y ajustes
usuarios/{uid}/pesos/{id}
usuarios/{uid}/entrenos/{id}
usuarios/{uid}/comidas/{id}
usuarios/{uid}/gastos/{id}
usuarios/{uid}/fijos/{id}
usuarios/{uid}/categorias/{id}
```

Las consecuencias importan:

- **Cada cosa que apuntas se escribe al momento** en tu cuenta. La pantalla no guarda
  nada por su cuenta: escribe en Firestore, y se repinta cuando Firestore le devuelve el
  cambio. No hay una copia paralela en memoria que pueda quedarse desfasada.
- **Nadie pisa a nadie.** Dos móviles apuntando cosas distintas escriben en documentos
  distintos, así que no hay nada que fusionar: los conflictos los resuelve Firestore sola.
- **Al cerrar sesión no queda rastro.** Se cierra la conexión, se borra la caché del
  navegador y se recarga la página. Y al entrar otra persona, la aplicación entera se
  vuelve a construir desde cero con su identificador.
- **Cambias de móvil, lo formateas o borras el navegador y da igual**: entras con tu
  correo y está todo.
- **Sin cobertura sigue funcionando**: lo que apuntes se ve al momento y sube solo al
  recuperar la conexión. Mientras tanto el aviso de la cabecera dice «Guardando…», que es
  la verdad — todavía no está a salvo en tu cuenta.

> Si venías de una versión anterior, lo que guardó en este dispositivo **no se sube
> solo**: la pantalla de cuenta te lo ofrece para que decidas, precisamente porque puede
> ser de otra persona que usara el mismo aparato.

### Puesta en marcha (unos cinco minutos)

1. Entra en <https://console.firebase.google.com> y crea un proyecto. Puedes decir que no
   a Google Analytics.
2. Dentro del proyecto, pulsa el botón **`</>` (Web)** para registrar una aplicación web.
   Al terminar te enseña un bloque `firebaseConfig` con seis valores.
3. Copia esos seis valores en **`sitio/config.js`**, sustituyendo los `PON_AQUI_…`.
4. Menú **Compilación → Authentication → Comenzar** y activa
   **Correo electrónico/contraseña**.
5. Menú **Compilación → Firestore Database → Crear base de datos**, en modo producción.
   Luego, en la pestaña **Reglas**, pega el contenido de `firestore.rules` y publica.
6. En **Authentication → Configuración → Dominios autorizados**, añade el dominio donde
   tengas subidas las apps.
7. Sube el sitio y abre cada app: lo primero que sale es la pantalla de acceso. Crea tu
   cuenta y entra con **la misma cuenta** en el otro dispositivo.

Los pasos 4 y 5 no son opcionales: sin base de datos y sin reglas publicadas, la
aplicación no tiene dónde guardar nada.

`config.js` se lee directamente desde el navegador, así que se puede cambiar y volver a
subir **sin recompilar nada**.

> Nota sobre la `apiKey` de Firebase: no es un secreto, va siempre en el cliente. Lo que
> protege los datos son las reglas de Firestore del paso 5, que solo dejan a cada cuenta
> leer y escribir lo suyo. Por eso publicarlas es obligatorio, no un extra.
>
> Lo que **nunca** hay que enseñar a nadie es la clave privada de *Configuración del
> proyecto → Cuentas de servicio*: esa sí abre la base de datos entera saltándose las
> reglas.

### Que una cuenta no vea la de otra

Es la garantía principal, así que está comprobada por partida triple:

- **En el servidor.** `firestore.rules` solo deja entrar a `usuarios/{uid}` cuando el
  `uid` es el de quien pide. Se comprueba en Firebase, no en el móvil, así que da igual
  lo que haga una aplicación modificada.
- **En el código.** Ninguna ruta de Firestore se construye sin identificador, y ninguna
  función de escritura acepta que falte. `pruebas/aislamiento.mjs` lo verifica archivo a
  archivo, junto con que las reglas y el código hablen de las mismas colecciones.
- **En un navegador de verdad.** `pruebas/probar-navegador` abre las dos apps con un
  Firebase de mentira, entra con una cuenta, apunta cosas, cierra sesión, entra con otra
  y comprueba que la segunda **no ve nada** de la primera — y que al volver la primera,
  lo suyo sigue intacto. Se ejecuta también antes de publicar.

---

## Los análisis, sin clave de API

Antes las dos apps llamaban a un modelo de pago con una clave que había que pegar a mano.
Se ha quitado: ya no hay clave, ni pantalla para meterla, ni coste.

**Gastos — revisión del mes** (`src/gastos/analisis.js`). Se calcula con el propio
historial:

- comparación con la media de los meses anteriores y con el mismo mes del año pasado,
  ajustada «a estas alturas del mes» cuando el mes está a medias;
- proyección de cierre y cuánto se puede gastar al día para no pasarse del presupuesto;
- categorías disparadas respecto a su media, categorías nuevas y las que llevan varios
  meses seguidos subiendo;
- costumbres: días sin gastar, rachas, fin de semana contra entre semana, día más caro;
- gasto hormiga, importes que se repiten y compras grandes que descuadran el mes;
- coste anual de los fijos y estimación de lo que costará el mes siguiente;
- una nota de 1 a 10 con el porqué.

**Salud — calorías y valoración** (`src/salud/alimentos.js`, `estimador.js`,
`valoracion.js`). Una tabla de unos 180 alimentos con raciones caseras españolas:

- reconoce lo que escribes («2 huevos», «medio plátano», «arroz integral»), suma las
  raciones y da un rango de calorías con su margen;
- cada comida se apunta con **volumen de 1 a 5** (cuánta comida había) y, opcionalmente,
  **saciedad de 1 a 4** (cómo te dejó). Son dos señales independientes: si el plato se
  leía ligero pero te dejó muy lleno, la estimación se corrige hacia arriba, y cuando las
  dos coinciden el margen se cierra. Marcando la saciedad, el rango del día se estrecha
  en torno a un 30 %;
- los márgenes de cada comida se suman **en cuadratura**, no uno detrás de otro: los
  errores de unas y otras se compensan, así que el rango del día sale realista;
- puntúa el día de 1 a 10 según lo que aparece (verdura, legumbre, pescado, integral…
  frente a fritos, bollería, ultraprocesados o alcohol), el reparto entre comidas y lo
  cerca que queda de tu diana — quedarse 600 kcal corto puntúa igual de mal que pasarse;
- en la valoración semanal o mensual cruza **las calorías apuntadas con lo que marca la
  báscula**: si el peso no se mueve como dirían esas calorías, te lo dice, que suele
  significar que falta comida por apuntar.

**Salud — la valoración va al grano.** Un veredicto, hasta cuatro avisos con su cifra y
una sola cosa que hacer. Sin ánimos de coach: si has entrenado dos días de siete, lo dice
así. Nunca pide imposibles — si te pasas 2.000 kcal al día, propone empezar por 500, no
por 2.000.

**Salud — la báscula tiene control de cordura** (`revisarPeso`, `pesosFiables`). De 92 a
95 kg en un día no se engorda: eso es agua, la báscula mal puesta o un dedo torcido al
teclear. Al guardar, avisa (nunca bloquea: se puede guardar igual). Y al analizar, los
picos sueltos se apartan de la serie — pero solo si el siguiente pesaje vuelve al nivel
de antes; si el cambio se mantiene, era real y cuenta.

Es una estimación, con su margen, y la app lo dice claramente. La anterior también
estimaba: la diferencia es que esta es instantánea, funciona sin cobertura y no cuesta
dinero.

---

## Detalles

- **Datos de la versión anterior.** Los que quedaran guardados en el navegador
  (`gastos-v1`, `salud-app-v2`) se ofrecen una sola vez desde la pantalla de cuenta, con
  el aviso de que puede que no sean tuyos. Si dices que sí, se suben a tu cuenta; si dices
  que no, se borran del dispositivo y no se vuelve a preguntar.
- **Copias de seguridad.** Las dos apps exportan e importan un `.json` con todo, desde
  Ajustes (Gastos) y Perfil (Salud), o desde la pantalla de cuenta. Al restaurar, el
  archivo se escribe en tu cuenta, no en el dispositivo.
- **Atajos en el ordenador.** En Gastos: `←` y `→` cambian de mes, `N` abre un gasto
  nuevo, `Esc` cierra.
- **Sin conexión.** Cada app tiene su service worker: la red primero para el HTML y la
  configuración, lo guardado para el resto. Si no hay internet, la app abre igual (guarda
  la aplicación, nunca tus datos: esos son de Firestore).
