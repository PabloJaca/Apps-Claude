# Mis Apps — Gastos y Salud

Dos aplicaciones web personales (PWA) que se instalan en el móvil y se usan igual en el
ordenador, con los mismos datos en los dos sitios.

- **Gastos** — gastos del día a día, gastos fijos, presupuestos y una revisión mensual.
- **Salud** — peso, entrenos y comidas, con estimación de calorías y valoración semanal o mensual.

Las dos funcionan **sin conexión** y **sin ninguna clave de API**: todos los análisis se
calculan en el propio dispositivo.

---

## Lo que hay en este repositorio

```
src/            código fuente
  comun/        sincronización con Firebase, fusión de datos, pantalla de cuenta
  gastos/       app de gastos + motor de análisis mensual
  salud/        app de salud + tabla de alimentos, estimador y valoración
  plantillas/   plantilla del service worker
sitio/          EL SITIO YA COMPILADO — esto es lo que se sube al hosting
build.mjs       compilación (esbuild)
servidor.mjs    servidor local para probar
firestore.rules reglas de seguridad de la base de datos
mis-apps.zip    el contenido de /sitio comprimido, por comodidad
```

## Compilar

```bash
npm install
npm run build      # deja el resultado en /sitio
npm run dev        # recompila al guardar
npm run zip        # compila y regenera mis-apps.zip
npm run servir     # compila y sirve en http://localhost:4173
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

## Sincronizar entre el móvil y el ordenador

La sincronización usa **Firebase** (cuenta con correo y contraseña + Firestore). El plan
gratuito sobra de largo para un uso personal.

Sin configurar nada, las apps funcionan igual que siempre: guardan en el dispositivo.
Al configurarlo, los datos que ya tengas **no se pierden**: se fusionan con los de la nube.

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
7. Sube el sitio, abre cada app, toca la pastilla de estado de la cabecera y crea tu
   cuenta. Repite el inicio de sesión con **la misma cuenta** en el otro dispositivo.

`config.js` se lee directamente desde el navegador, así que se puede cambiar y volver a
subir **sin recompilar nada**.

> Nota sobre la `apiKey` de Firebase: no es un secreto, va siempre en el cliente. Lo que
> protege los datos son las reglas de Firestore del paso 5, que solo dejan a cada cuenta
> leer y escribir lo suyo.

### Cómo se evita perder datos

No se sincroniza «el documento entero», que es la forma fácil de que un dispositivo pise
lo que hizo el otro. En su lugar:

- cada registro (gasto, peso, comida…) lleva su propia marca de tiempo;
- los borrados dejan una **lápida** con la hora, en vez de desaparecer sin más;
- al juntar dos versiones se compara **registro a registro** y gana el más reciente;
- un borrado solo se aplica si es posterior a la última edición de ese registro.

Resultado: un móvil que lleva tres semanas cerrado no puede resucitar lo que borraste en
el ordenador, ni el ordenador puede tirar lo que apuntaste ayer en el móvil. Y si no hay
internet, todo se guarda igual y se sube solo al recuperar cobertura.

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
- puntúa el día de 1 a 10 según lo que aparece (verdura, legumbre, pescado, integral…
  frente a fritos, bollería, ultraprocesados o alcohol), el reparto entre comidas y el
  encaje con tu diana;
- en la valoración semanal o mensual cruza **las calorías apuntadas con lo que marca la
  báscula**: si el peso no se mueve como dirían esas calorías, te lo dice, que suele
  significar que falta comida por apuntar.

Es una estimación, con su margen, y la app lo dice claramente. La anterior también
estimaba: la diferencia es que esta es instantánea, funciona sin cobertura y no cuesta
dinero.

---

## Detalles

- **Datos guardados.** Se siguen usando las mismas claves de siempre (`gastos-v1` y
  `salud-app-v2`), así que al actualizar no hay que volver a meter nada: al abrir la app
  se migra el formato viejo solo.
- **Copias de seguridad.** Las dos apps exportan e importan un `.json` con todo, desde
  Ajustes (Gastos) y Perfil (Salud).
- **Atajos en el ordenador.** En Gastos: `←` y `→` cambian de mes, `N` abre un gasto
  nuevo, `Esc` cierra.
- **Sin conexión.** Cada app tiene su service worker: la red primero para el HTML y la
  configuración, lo guardado para el resto. Si no hay internet, la app abre igual.
