/* ─────────────────────────────────────────────────────────────────────────
   Fusión de datos entre dispositivos.

   La regla de oro: nunca se pierde nada por abrir la app en dos sitios.
   Cada registro lleva su propia marca de tiempo (`mod`) y cada borrado deja
   una lápida en `borrados`. Así, un móvil que lleva semanas cerrado no puede
   resucitar lo que borraste en el PC, ni el PC puede tirar lo que apuntaste
   ayer en el móvil. Se fusiona registro a registro, no documento entero.
   ───────────────────────────────────────────────────────────────────────── */

export const ahora = () => Date.now();

/* Las lápidas viejas se tiran para que el documento no engorde eternamente.
   Seis meses es de sobra: cualquier dispositivo que no haya abierto la app en
   ese tiempo va a sincronizar de todas formas contra un estado ya consolidado. */
const VIDA_LAPIDA = 1000 * 60 * 60 * 24 * 180;

export function nuevoId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* ── colecciones (arrays de objetos con id) ─────────────────────────────── */

function fusionarColeccion(a = [], b = [], lapidas = {}) {
  const porId = new Map();
  for (const it of a) if (it && it.id) porId.set(it.id, it);
  for (const it of b) {
    if (!it || !it.id) continue;
    const previo = porId.get(it.id);
    if (!previo || (it.mod || 0) > (previo.mod || 0)) porId.set(it.id, it);
  }
  const salida = [];
  for (const [id, it] of porId) {
    const borradoEn = lapidas[id];
    // El borrado gana solo si es posterior a la última edición del registro.
    if (borradoEn != null && borradoEn >= (it.mod || 0)) continue;
    salida.push(it);
  }
  return salida;
}

function fusionarLapidas(a = {}, b = {}, vivos = new Set()) {
  const corte = ahora() - VIDA_LAPIDA;
  const salida = {};
  for (const [id, t] of Object.entries({ ...a, ...b })) {
    const ta = a[id] || 0;
    const tb = b[id] || 0;
    const ts = Math.max(ta, tb);
    // Se conserva mientras sea reciente o mientras alguien siga trayendo el registro.
    if (ts >= corte || vivos.has(id)) salida[id] = ts;
  }
  return salida;
}

/* ── documento completo ─────────────────────────────────────────────────── */

/**
 * @param {object} local     estado de este dispositivo
 * @param {object} remoto    estado que llega de la nube
 * @param {object} esquema   { colecciones: string[], sellos: string[] }
 */
export function fusionar(local, remoto, esquema) {
  if (!remoto) return local;
  if (!local) return remoto;

  const idsVivos = new Set();
  for (const nombre of esquema.colecciones) {
    for (const it of local[nombre] || []) if (it && it.id) idsVivos.add(it.id);
    for (const it of remoto[nombre] || []) if (it && it.id) idsVivos.add(it.id);
  }

  const lapidas = fusionarLapidas(local.borrados, remoto.borrados, idsVivos);
  const salida = { ...local, ...remoto, borrados: lapidas };

  for (const nombre of esquema.colecciones) {
    salida[nombre] = fusionarColeccion(local[nombre], remoto[nombre], lapidas);
  }

  // Grupos de campos sueltos (perfil, ajustes…): gana el que se tocó más tarde.
  const sellosL = local.sellos || {};
  const sellosR = remoto.sellos || {};
  const sellos = {};
  for (const campo of esquema.sellos) {
    const tl = sellosL[campo] || 0;
    const tr = sellosR[campo] || 0;
    const marca = Math.max(tl, tr);
    /* Un campo que nadie ha tocado se queda sin marca, en vez de aparecer con
       un cero. Si no, fusionar lo mismo dos veces daría un resultado distinto
       al original y cada dispositivo se creería obligado a volver a subirlo. */
    if (marca) sellos[campo] = marca;
    salida[campo] = tr > tl ? remoto[campo] : local[campo];
  }
  salida.sellos = sellos;

  return salida;
}

/* ── ayudas para mutar el estado marcando la hora ───────────────────────── */

export function ponerEnColeccion(datos, coleccion, item) {
  const t = ahora();
  const con = { ...item, id: item.id || nuevoId(), mod: t };
  const lista = datos[coleccion] || [];
  const existe = lista.some((x) => x.id === con.id);
  return {
    ...datos,
    [coleccion]: existe ? lista.map((x) => (x.id === con.id ? con : x)) : [...lista, con],
  };
}

export function quitarDeColeccion(datos, coleccion, id) {
  return {
    ...datos,
    [coleccion]: (datos[coleccion] || []).filter((x) => x.id !== id),
    borrados: { ...(datos.borrados || {}), [id]: ahora() },
  };
}

export function tocarCampo(datos, campo, valor) {
  return {
    ...datos,
    [campo]: valor,
    sellos: { ...(datos.sellos || {}), [campo]: ahora() },
  };
}
