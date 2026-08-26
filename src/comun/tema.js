/* ─────────────────────────────────────────────────────────────────────────
   Claro u oscuro.

   Vive aparte por la misma razón que el bloqueo con PIN: toca el almacén del
   navegador, y en este proyecto eso está acotado a los pocos archivos donde
   se puede justificar. Aquí se justifica porque **no es un dato de la cuenta**:
   es una preferencia de esta pantalla. Tener el móvil en oscuro y el
   ordenador en claro es lo razonable, y guardarlo en Firestore obligaría a los
   dos a ir a la vez.

   Consecuencia: no se sincroniza, y eso es a propósito.
   ───────────────────────────────────────────────────────────────────────── */

export const CLAVE_TEMA = "misapps_tema";

export const TEMAS_ELEGIBLES = [
  { id: "oscuro", label: "Oscuro" },
  { id: "claro", label: "Claro" },
  { id: "auto", label: "Automático" },
];

/* Oscuro por defecto: la app se mira de noche y en el gimnasio, y una pantalla
   blanca entera a esas horas molesta de verdad. Quien prefiera claro lo elige
   una vez y se queda. */
export const TEMA_POR_DEFECTO = "oscuro";

const almacenPorDefecto = () => (typeof localStorage !== "undefined" ? localStorage : null);

/** Lo elegido en este dispositivo, o el de casa si nadie ha elegido nada. */
export function temaGuardado(almacen) {
  const ls = almacen === undefined ? almacenPorDefecto() : almacen;
  try {
    const v = ls && ls.getItem(CLAVE_TEMA);
    return TEMAS_ELEGIBLES.some((t) => t.id === v) ? v : TEMA_POR_DEFECTO;
  } catch (e) {
    /* Modo incógnito o almacenamiento bloqueado: se sigue pudiendo usar la
       app, simplemente el tema dura lo que la pestaña. */
    return TEMA_POR_DEFECTO;
  }
}

/** Guarda la elección. Devuelve si se ha podido dejar escrita. */
export function guardarTema(tema, almacen) {
  const ls = almacen === undefined ? almacenPorDefecto() : almacen;
  if (!TEMAS_ELEGIBLES.some((t) => t.id === tema)) return false;
  try {
    if (!ls) return false;
    ls.setItem(CLAVE_TEMA, tema);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Pinta la elección en el <html>.
 *
 * `auto` no deja atributo a propósito: sin atributo mandan las reglas de
 * `prefers-color-scheme`, que es exactamente lo que significa automático.
 */
export function aplicarTema(tema, doc) {
  const d = doc === undefined ? (typeof document !== "undefined" ? document : null) : doc;
  if (!d) return;

  const raiz = d.documentElement;
  if (tema === "auto") raiz.removeAttribute("data-tema");
  else raiz.setAttribute("data-tema", tema);

  /* La barra de estado del móvil se pinta con esto. Sin actualizarla queda una
     franja blanca cosida encima de una app oscura. Se lee el fondo ya
     resuelto, así que vale igual para «auto». */
  const meta = d.querySelector('meta[name="theme-color"]');
  if (meta && typeof getComputedStyle === "function") {
    const fondo = getComputedStyle(raiz).getPropertyValue("--bg").trim();
    if (fondo) meta.setAttribute("content", fondo);
  }
}

/**
 * Mete la hoja de estilos de los temas y aplica el guardado.
 *
 * Se llama al importar el módulo de la app, no al montar el componente: la
 * pantalla de acceso y la del PIN se dibujan antes que la aplicación y usan la
 * misma paleta. Si las variables llegaran dentro del <style> de la app, esas
 * dos saldrían con los colores sin definir.
 */
export function instalarTema(css, doc) {
  const d = doc === undefined ? (typeof document !== "undefined" ? document : null) : doc;
  if (!d) return;
  const hoja = d.createElement("style");
  hoja.textContent = css;
  d.head.appendChild(hoja);
  aplicarTema(temaGuardado());
}
