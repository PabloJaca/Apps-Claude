/**
 * Las pantallas y hojas que `pruebas/extremo.mjs` abre de verdad.
 *
 * Vive en su propio archivo para que `pruebas/aislamiento.mjs` pueda leerlo
 * sin arrancar un navegador entero.
 *
 * Está aquí porque una hoja que no se abre en ninguna prueba es una hoja que
 * puede llegar rota a producción, y así pasó: la del gasto fijo llamaba a
 * variables que no existían en su ámbito y nadie se enteró hasta usarla.
 * `aislamiento.mjs` compara esta lista con los componentes que hay en las dos
 * apps —y en los compartidos, que cuentan para las dos— y falla si aparece
 * uno nuevo sin abrir.
 *
 * Es un inventario a mano, no una medición: promete que la pantalla se abre,
 * no que se pruebe a fondo. Pero obliga a pasar por ella.
 */
export const PANTALLAS_ABIERTAS = {
  gastos: [
    "Bienvenida", "HojaGasto", "HojaFijo",
    "PantallaFijos", "PantallaBuscar", "PantallaObjetivos", "PantallaAnual",
    "PantallaCuenta", "HojaDictado", "PantallaBloqueo",
  ],
  salud: [
    "Bienvenida", "HojaFecha", "HojaEjercicio",
    "PantallaEjercicio", "PantallaOtrosDias", "PantallaValoracion", "PantallaPerfil",
    "PantallaPlantillas", "HojaPlantilla", "HojaPlantillaEditar", "HojaPegarPlantillas",
    "PantallaCuenta", "HojaDictado", "PantallaBloqueo",
  ],
};
