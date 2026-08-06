/* ─────────────────────────────────────────────────────────────────────────
   Gastos · revisión del mes, calculada aquí mismo.

   Antes esto lo escribía un modelo de pago con la clave de API del usuario.
   Ahora sale de los propios números: comparaciones con su historial, patrones
   por día de la semana, gasto hormiga, categorías disparadas y proyecciones.
   Es instantáneo, funciona sin internet y no cuesta un céntimo.

   Nada de esto se guarda: se recalcula al abrir la pantalla, así que siempre
   está al día y no hay nada que sincronizar.
   ───────────────────────────────────────────────────────────────────────── */

import {
  DIAS_SEMANA, MESES, claveMes, desdeClaveMes, diaDeISO, diaSemanaISO,
  diasDelMes, eur, mesActualClave, mesDeISO, mesesConDatos, movimientosDeMes,
  restarMeses, suma,
} from "./nucleo.js";

const UMBRAL_HORMIGA = 15;      // por debajo de esto contamos "gasto pequeño"
const MESES_REFERENCIA = 3;     // con cuántos meses previos se compara

const redondear = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const porcentaje = (parte, total) => (total > 0 ? (parte / total) * 100 : 0);

const conSigno = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${eur(Math.abs(n), false)}`;
const listar = (arr) =>
  arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} y ${arr[arr.length - 1]}`;

/* ── piezas de cálculo ───────────────────────────────────────────────────── */

/** Total del mes contando solo hasta el día N, para comparar peras con peras. */
function totalHastaDia(datos, mesKey, dia) {
  return suma(movimientosDeMes(datos, mesKey).filter((g) => diaDeISO(g.fecha) <= dia));
}

function totalesPorCategoria(movimientos) {
  const m = {};
  for (const g of movimientos) m[g.categoria] = (m[g.categoria] || 0) + g.importe;
  return m;
}

/** Los N meses anteriores al de referencia que tienen algo apuntado. */
function mesesPrevios(datos, mesKey, cuantos) {
  return mesesConDatos(datos)
    .filter((k) => k < mesKey)
    .slice(-cuantos);
}

function mediaPorCategoria(datos, claves, soloVariable = false) {
  if (!claves.length) return {};
  const acumulado = {};
  for (const k of claves) {
    const movs = movimientosDeMes(datos, k);
    const t = totalesPorCategoria(soloVariable ? movs.filter((g) => !g.esFijo) : movs);
    for (const [id, v] of Object.entries(t)) acumulado[id] = (acumulado[id] || 0) + v;
  }
  for (const id of Object.keys(acumulado)) acumulado[id] /= claves.length;
  return acumulado;
}

/** Categorías que llevan varios meses seguidos subiendo. */
function rachasAlAlza(datos, mesKey, catPorId) {
  const claves = [...mesesPrevios(datos, mesKey, 4), mesKey];
  if (claves.length < 3) return [];
  const serie = claves.map((k) => totalesPorCategoria(movimientosDeMes(datos, k)));
  const ids = new Set(serie.flatMap((s) => Object.keys(s)));
  const salida = [];

  for (const id of ids) {
    const valores = serie.map((s) => s[id] || 0);
    let racha = 1;
    for (let i = valores.length - 1; i > 0; i--) {
      if (valores[i] > valores[i - 1] * 1.05) racha++;
      else break;
    }
    const ultimo = valores[valores.length - 1];
    if (racha >= 3 && ultimo >= 25) {
      salida.push({
        id,
        nombre: catPorId[id]?.nombre || "Sin categoría",
        color: catPorId[id]?.color,
        icono: catPorId[id]?.icono,
        meses: racha,
        desde: valores[valores.length - racha],
        hasta: ultimo,
      });
    }
  }
  return salida.sort((a, b) => b.hasta - a.hasta);
}

/** El importe que más se repite: suele delatar una costumbre. */
function importeRepetido(variables) {
  const cuenta = {};
  for (const g of variables) {
    const k = redondear(g.importe, 2).toFixed(2);
    (cuenta[k] = cuenta[k] || []).push(g);
  }
  const mejor = Object.entries(cuenta)
    .map(([k, lista]) => ({ importe: Number(k), veces: lista.length, total: lista.length * Number(k), lista }))
    .filter((x) => x.veces >= 3 && x.importe > 0)
    .sort((a, b) => b.total - a.total)[0];
  return mejor || null;
}

function analisisPorDia(variables, nDias, diasTranscurridos) {
  const porDia = Array.from({ length: nDias }, () => 0);
  for (const g of variables) {
    const d = diaDeISO(g.fecha);
    if (d >= 1 && d <= nDias) porDia[d - 1] += g.importe;
  }

  const consumidos = porDia.slice(0, diasTranscurridos);
  const diasConGasto = consumidos.filter((v) => v > 0.001).length;
  const diasEnBlanco = consumidos.length - diasConGasto;

  let rachaActual = 0;
  let rachaMaxima = 0;
  for (const v of consumidos) {
    if (v <= 0.001) {
      rachaActual++;
      rachaMaxima = Math.max(rachaMaxima, rachaActual);
    } else rachaActual = 0;
  }

  // Media por día de la semana, normalizando por cuántos de cada uno han pasado.
  const totalSemana = Array.from({ length: 7 }, () => 0);
  const cuentaSemana = Array.from({ length: 7 }, () => 0);
  const mesRef = variables.length ? mesDeISO(variables[0].fecha) : null;
  if (mesRef) {
    for (let d = 1; d <= diasTranscurridos; d++) {
      const iso = `${mesRef}-${String(d).padStart(2, "0")}`;
      const ds = diaSemanaISO(iso);
      cuentaSemana[ds]++;
      totalSemana[ds] += porDia[d - 1];
    }
  }
  const mediaSemana = totalSemana.map((t, i) => (cuentaSemana[i] ? t / cuentaSemana[i] : 0));

  const finde = [5, 6].reduce((s, i) => s + totalSemana[i], 0);
  const diasFinde = [5, 6].reduce((s, i) => s + cuentaSemana[i], 0);
  const entreSemana = [0, 1, 2, 3, 4].reduce((s, i) => s + totalSemana[i], 0);
  const diasLaborables = [0, 1, 2, 3, 4].reduce((s, i) => s + cuentaSemana[i], 0);

  const puntaIdx = porDia.indexOf(Math.max(...porDia));

  return {
    porDia,
    diasConGasto,
    diasEnBlanco,
    rachaMaxima,
    mediaSemana,
    mejorDiaSemana: mediaSemana.indexOf(Math.max(...mediaSemana)),
    mediaFinde: diasFinde ? finde / diasFinde : 0,
    mediaLaborable: diasLaborables ? entreSemana / diasLaborables : 0,
    diaPunta: { dia: puntaIdx + 1, importe: porDia[puntaIdx] || 0 },
  };
}

/* ── informe ─────────────────────────────────────────────────────────────── */

export function analizarMes(datos, mesKey, catPorId) {
  const { y, m } = desdeClaveMes(mesKey);
  const nDias = diasDelMes(y, m);
  const esActual = mesKey === mesActualClave();
  const diasTranscurridos = esActual ? Math.min(new Date().getDate(), nDias) : nDias;
  const diasRestantes = Math.max(0, nDias - diasTranscurridos);

  const movimientos = movimientosDeMes(datos, mesKey);
  const fijos = movimientos.filter((g) => g.esFijo);
  const variables = movimientos.filter((g) => !g.esFijo);

  const total = suma(movimientos);
  const totalFijos = suma(fijos);
  const totalVariable = suma(variables);

  if (!movimientos.length) {
    return {
      hayDatos: false,
      mesKey,
      titulo: `${MESES[m]} ${y}`,
      motivo: "Este mes no tiene nada apuntado todavía.",
    };
  }

  /* referencia histórica */
  const previos = mesesPrevios(datos, mesKey, MESES_REFERENCIA);
  const totalesPrevios = previos.map((k) => suma(movimientosDeMes(datos, k)));
  const mediaPrevia = totalesPrevios.length
    ? totalesPrevios.reduce((s, v) => s + v, 0) / totalesPrevios.length
    : null;

  // Para el mes en curso comparamos «a estas alturas», no el mes entero.
  const referenciaJusta = previos.length
    ? previos.map((k) => totalHastaDia(datos, k, diasTranscurridos)).reduce((s, v) => s + v, 0) / previos.length
    : null;

  const mesAnterior = previos.length ? previos[previos.length - 1] : null;
  const totalAnterior = mesAnterior ? suma(movimientosDeMes(datos, mesAnterior)) : null;

  const hace12 = claveMes(y - 1, m);
  const totalHace12 = mesesConDatos(datos).includes(hace12) ? suma(movimientosDeMes(datos, hace12)) : null;

  /* proyección */
  const ritmoVariable = diasTranscurridos > 0 ? totalVariable / diasTranscurridos : 0;
  const proyeccion = esActual ? totalFijos + ritmoVariable * nDias : total;

  /* presupuesto */
  const presupuesto = datos.ajustes?.presupuestoGlobal || null;
  const usado = presupuesto ? total / presupuesto : null;
  const proyectadoSobrePresupuesto = presupuesto ? proyeccion / presupuesto : null;

  /* categorías */
  const totalesCat = totalesPorCategoria(movimientos);
  const mediasCat = mediaPorCategoria(datos, previos);
  const categorias = Object.entries(totalesCat)
    .map(([id, valor]) => {
      const media = mediasCat[id] || 0;
      const cat = catPorId[id] || {};
      return {
        id,
        nombre: cat.nombre || "Sin categoría",
        color: cat.color || "#7C93A8",
        icono: cat.icono || "package",
        presupuesto: cat.presupuesto || null,
        total: valor,
        media,
        delta: valor - media,
        deltaPct: media > 0 ? ((valor - media) / media) * 100 : null,
        cuota: porcentaje(valor, total),
        nueva: media === 0 && previos.length >= 2,
      };
    })
    .sort((a, b) => b.total - a.total);

  // El mismo desglose contando solo lo variable: es donde se puede decidir algo.
  // No tiene sentido aconsejar «recorta en Casa» cuando eso es el alquiler.
  const totalesVariables = totalesPorCategoria(variables);
  const mediasVariables = mediaPorCategoria(datos, previos, true);
  const categoriasVariables = Object.entries(totalesVariables)
    .map(([id, valor]) => {
      const media = mediasVariables[id] || 0;
      return {
        id,
        nombre: catPorId[id]?.nombre || "Sin categoría",
        total: valor,
        media,
        delta: valor - media,
      };
    })
    .sort((a, b) => b.total - a.total);

  const subidas = categorias.filter((c) => c.delta > 5 && previos.length).sort((a, b) => b.delta - a.delta);
  const bajadas = categorias.filter((c) => c.delta < -5 && previos.length).sort((a, b) => a.delta - b.delta);
  const desviadas = categorias.filter((c) => c.presupuesto && c.total > c.presupuesto);
  const rachas = rachasAlAlza(datos, mesKey, catPorId);

  /* hábitos */
  const dias = analisisPorDia(variables, nDias, diasTranscurridos);
  const hormiga = variables.filter((g) => g.importe > 0 && g.importe <= UMBRAL_HORMIGA);
  const totalHormiga = suma(hormiga);
  const repetido = importeRepetido(variables);
  const mayores = [...variables].sort((a, b) => b.importe - a.importe).slice(0, 3);

  /* fijos */
  const fijosActivos = (datos.fijos || []).filter((f) => f.desde <= mesKey && (!f.hasta || mesKey <= f.hasta));
  const fijoCaro = [...fijosActivos].sort((a, b) => b.importe - a.importe)[0] || null;
  const costeAnualFijos = totalFijos * 12;

  /* mes que viene */
  const siguiente = (() => {
    const p = restarMeses(y, m, -1);
    const k = claveMes(p.y, p.m);
    const fijosSig = suma(
      (datos.fijos || []).filter((f) => f.desde <= k && (!f.hasta || k <= f.hasta))
    );
    const variablesPrevias = previos.map((c) => suma(movimientosDeMes(datos, c).filter((g) => !g.esFijo)));
    const mediaVar = variablesPrevias.length
      ? variablesPrevias.reduce((s, v) => s + v, 0) / variablesPrevias.length
      : totalVariable;
    return { clave: k, nombre: MESES[p.m], fijos: fijosSig, estimado: fijosSig + mediaVar };
  })();

  /* ── nota del mes ─────────────────────────────────────────────────────── */
  let puntos = 5;
  const comparable = esActual ? proyeccion : total;

  if (presupuesto) {
    const r = comparable / presupuesto;
    puntos += r <= 0.8 ? 3.5 : r <= 0.95 ? 2.5 : r <= 1.02 ? 1 : r <= 1.15 ? -1.5 : -3;
  } else if (mediaPrevia) {
    const r = comparable / mediaPrevia;
    puntos += r <= 0.85 ? 2.5 : r <= 0.98 ? 1.5 : r <= 1.05 ? 0 : r <= 1.2 ? -1.5 : -2.5;
  }

  const disparadas = categorias.filter((c) => c.media > 0 && c.delta > 30 && c.deltaPct > 50);
  puntos -= Math.min(1.5, disparadas.length * 0.5);

  if (diasTranscurridos >= 7) {
    const cuotaBlanco = dias.diasEnBlanco / diasTranscurridos;
    if (cuotaBlanco >= 0.35) puntos += 1;
    else if (cuotaBlanco >= 0.2) puntos += 0.5;
    else if (dias.diasEnBlanco === 0) puntos -= 0.5;
  }
  if (totalVariable > 0 && porcentaje(totalHormiga, totalVariable) > 30) puntos -= 0.5;

  const nota = Math.max(1, Math.min(10, Math.round(puntos)));
  const tono = nota >= 8 ? "bien" : nota >= 6 ? "ok" : nota >= 4 ? "ojo" : "mal";

  /* ── titular ──────────────────────────────────────────────────────────── */
  let titular;
  if (presupuesto && esActual) {
    const r = proyectadoSobrePresupuesto;
    titular =
      r <= 0.95
        ? `A este ritmo cierras ${MESES[m]} con ${eur(presupuesto - proyeccion, false)} de margen`
        : r <= 1.05
        ? `Vas justo en tu presupuesto: cerrarías en ${eur(proyeccion, false)}`
        : `A este ritmo te pasas ${eur(proyeccion - presupuesto, false)} del presupuesto`;
  } else if (presupuesto) {
    titular =
      total <= presupuesto
        ? `Cerraste ${MESES[m]} con ${eur(presupuesto - total, false)} sin gastar`
        : `Te pasaste ${eur(total - presupuesto, false)} del presupuesto en ${MESES[m]}`;
  } else if (referenciaJusta && esActual) {
    const d = total - referenciaJusta;
    titular =
      Math.abs(d) < referenciaJusta * 0.05
        ? `Vas al mismo ritmo de siempre a estas alturas del mes`
        : d < 0
        ? `Llevas ${eur(-d, false)} menos que de costumbre a estas alturas`
        : `Llevas ${eur(d, false)} más que de costumbre a estas alturas`;
  } else if (mediaPrevia) {
    const d = total - mediaPrevia;
    titular =
      Math.abs(d) < mediaPrevia * 0.05
        ? `${MESES[m].charAt(0).toUpperCase()}${MESES[m].slice(1)} salió clavado a tu media`
        : d < 0
        ? `${eur(-d, false)} por debajo de tu media de los últimos meses`
        : `${eur(d, false)} por encima de tu media de los últimos meses`;
  } else {
    titular = `${eur(total, false)} en ${MESES[m]}, tu primer mes con datos`;
  }

  /* ── bloques narrativos ───────────────────────────────────────────────── */
  const bloques = [];

  /* 1 · el mes */
  {
    const frases = [];
    frases.push(
      esActual
        ? `Llevas ${eur(total)} en ${diasTranscurridos} ${diasTranscurridos === 1 ? "día" : "días"} de ${MESES[m]}.`
        : `${MESES[m].charAt(0).toUpperCase()}${MESES[m].slice(1)} cerró en ${eur(total)}.`
    );
    if (totalFijos > 0) {
      frases.push(
        `${eur(totalFijos, false)} son fijos (${Math.round(porcentaje(totalFijos, total))}%) y ${eur(totalVariable, false)} lo has decidido tú sobre la marcha.`
      );
    }
    if (referenciaJusta != null && esActual) {
      const d = total - referenciaJusta;
      frases.push(
        Math.abs(d) < 10
          ? `Comparado con tus últimos ${previos.length} meses a día ${diasTranscurridos}, vas igual.`
          : `Tus últimos ${previos.length} meses, a día ${diasTranscurridos}, iban por ${eur(referenciaJusta, false)}: ${d > 0 ? "vas por encima" : "vas por debajo"}.`
      );
    } else if (mediaPrevia != null && !esActual) {
      frases.push(`Tu media de los ${previos.length} meses anteriores era ${eur(mediaPrevia, false)}.`);
    }
    if (totalHace12 != null) {
      const d = total - totalHace12;
      frases.push(
        `El mismo mes del año pasado fueron ${eur(totalHace12, false)}, ${Math.abs(d) < 5 ? "prácticamente lo mismo" : d > 0 ? `${eur(d, false)} menos que ahora` : `${eur(-d, false)} más que ahora`}.`
      );
    }
    if (esActual && diasRestantes > 0) {
      frases.push(
        `Al ritmo de ${eur(ritmoVariable)}/día en gasto variable, ${MESES[m]} cerraría sobre ${eur(proyeccion, false)}.`
      );
    }
    bloques.push({ area: "El mes", icono: "wallet", color: "#0F9E8E", texto: frases.join(" ") });
  }

  /* 2 · presupuesto */
  if (presupuesto) {
    const frases = [];
    frases.push(`Tu tope es ${eur(presupuesto, false)} y llevas gastado el ${Math.round(usado * 100)}%.`);
    if (esActual) {
      const margen = presupuesto - total;
      if (margen > 0 && diasRestantes > 0) {
        frases.push(
          `Quedan ${eur(margen, false)} para ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"}: ${eur(margen / diasRestantes)} al día para no pasarte.`
        );
      } else if (margen <= 0) {
        frases.push(`Ya lo has superado en ${eur(-margen, false)} y aún quedan ${diasRestantes} días.`);
      }
      if (proyectadoSobrePresupuesto > 1.02) {
        frases.push(`Si sigues así acabarías ${eur(proyeccion - presupuesto, false)} por encima.`);
      } else if (diasRestantes > 0) {
        frases.push(`Con el ritmo actual llegas a fin de mes sin pasarte.`);
      }
    } else {
      frases.push(total <= presupuesto ? `Te sobraron ${eur(presupuesto - total, false)}.` : `Te pasaste ${eur(total - presupuesto, false)}.`);
    }
    if (totalFijos > presupuesto * 0.6) {
      frases.push(`Ojo: los fijos ya se comen el ${Math.round(porcentaje(totalFijos, presupuesto))}% del presupuesto, así que el margen real de maniobra es pequeño.`);
    }
    bloques.push({
      area: "Presupuesto",
      icono: "target",
      color: usado > 1 ? "#F4614E" : usado > 0.85 ? "#F5A524" : "#1FB47A",
      texto: frases.join(" "),
    });
  }

  /* 3 · categorías */
  if (categorias.length) {
    const frases = [];
    const top = categorias.slice(0, 3);
    const totalTop = top.reduce((s, c) => s + c.total, 0);
    frases.push(
      top.length === 1
        ? `Todo se va en ${top[0].nombre}: ${eur(top[0].total, false)}.`
        : `Lo gordo se va en ${listar(top.map((c) => `${c.nombre} (${eur(c.total, false)})`))}: entre esas ${top.length} suman el ${Math.round(porcentaje(totalTop, total))}% de todo.`
    );
    if (subidas.length) {
      const s = subidas[0];
      frases.push(
        `Lo que más se ha movido es ${s.nombre}: ${eur(s.total, false)} frente a los ${eur(s.media, false)} que sueles gastar, ${conSigno(s.delta)}${s.deltaPct != null ? ` (${Math.round(s.deltaPct)}%)` : ""}.`
      );
    }
    const fijoPorCategoria = totalesPorCategoria(fijos);
    if (top[0] && (fijoPorCategoria[top[0].id] || 0) > top[0].total * 0.7) {
      frases.push(
        `Ojo: casi todo lo de ${top[0].nombre} son gastos fijos, así que no es algo que hayas decidido este mes.`
      );
    }
    if (bajadas.length) {
      const b = bajadas[0];
      frases.push(`En cambio en ${b.nombre} has gastado ${eur(-b.delta, false)} menos de lo habitual.`);
    }
    const nuevas = categorias.filter((c) => c.nueva && c.total > 20);
    if (nuevas.length) {
      frases.push(`${listar(nuevas.map((c) => c.nombre))} ${nuevas.length === 1 ? "aparece" : "aparecen"} este mes sin antecedentes en los meses anteriores.`);
    }
    if (desviadas.length) {
      frases.push(
        `Se han pasado de su tope: ${listar(desviadas.map((c) => `${c.nombre} (${eur(c.total - c.presupuesto, false)} de más)`))}.`
      );
    }
    bloques.push({ area: "Categorías", icono: "pie", color: "#8B7BE8", texto: frases.join(" ") });
  }

  /* 4 · costumbres */
  {
    const frases = [];
    if (diasTranscurridos >= 5) {
      frases.push(
        `Has gastado en ${dias.diasConGasto} de los ${diasTranscurridos} días que llevamos, con ${eur(totalVariable / Math.max(1, dias.diasConGasto))} de media los días que sale dinero.`
      );
      if (dias.diasEnBlanco > 0) {
        frases.push(
          `${dias.diasEnBlanco} ${dias.diasEnBlanco === 1 ? "día en blanco" : "días en blanco"}${dias.rachaMaxima >= 3 ? `, con una racha de ${dias.rachaMaxima} seguidos` : ""}.`
        );
      }
      if (dias.mediaFinde > dias.mediaLaborable * 1.35 && dias.mediaFinde > 10) {
        frases.push(
          `Los fines de semana pesan: ${eur(dias.mediaFinde)} al día frente a ${eur(dias.mediaLaborable)} entre semana.`
        );
      } else if (dias.mediaLaborable > dias.mediaFinde * 1.35 && dias.mediaLaborable > 10) {
        frases.push(`Curiosamente gastas más entre semana (${eur(dias.mediaLaborable)}/día) que en fin de semana (${eur(dias.mediaFinde)}/día).`);
      }
      if (dias.diaPunta.importe > 0) {
        frases.push(`El día más caro fue el ${dias.diaPunta.dia} con ${eur(dias.diaPunta.importe, false)}.`);
      }
    } else {
      frases.push(`Aún hay pocos días apuntados para hablar de costumbres.`);
    }
    bloques.push({ area: "Costumbres", icono: "calendar", color: "#3B9EFF", texto: frases.join(" ") });
  }

  /* 5 · fijos */
  if (totalFijos > 0) {
    const frases = [];
    frases.push(
      `Tienes ${fijosActivos.length} ${fijosActivos.length === 1 ? "gasto fijo activo" : "gastos fijos activos"} por ${eur(totalFijos, false)} al mes, que son ${eur(costeAnualFijos, false)} al año.`
    );
    if (fijoCaro) {
      frases.push(`El más caro es ${fijoCaro.nombre} con ${eur(fijoCaro.importe, false)} al mes (${eur(fijoCaro.importe * 12, false)} anuales).`);
    }
    const pequenos = fijosActivos.filter((f) => f.importe <= 20);
    if (pequenos.length >= 3) {
      const s = pequenos.reduce((a, f) => a + f.importe, 0);
      frases.push(
        `Además arrastras ${pequenos.length} fijos pequeños que por separado no duelen, pero juntos son ${eur(s, false)} al mes: ${eur(s * 12, false)} al año.`
      );
    }
    bloques.push({ area: "Fijos", icono: "repeat", color: "#F5A524", texto: frases.join(" ") });
  }

  /* ── hallazgos sueltos ────────────────────────────────────────────────── */
  const hallazgos = [];

  if (totalHormiga > 0 && hormiga.length >= 4) {
    hallazgos.push({
      clave: "hormiga",
      tono: porcentaje(totalHormiga, totalVariable) > 30 ? "ojo" : "neutro",
      titulo: "Gasto hormiga",
      texto: `${hormiga.length} gastos de menos de ${eur(UMBRAL_HORMIGA, false)} suman ${eur(totalHormiga, false)}, el ${Math.round(porcentaje(totalHormiga, totalVariable))}% de tu gasto variable. Al año serían ${eur(totalHormiga * 12, false)}.`,
    });
  }

  if (repetido && repetido.veces >= 4) {
    hallazgos.push({
      clave: "repetido",
      tono: "neutro",
      titulo: `${eur(repetido.importe)}, ${repetido.veces} veces`,
      texto: `Ese mismo importe se repite ${repetido.veces} veces este mes y suma ${eur(repetido.total, false)}. Si es algo de diario, al año son ${eur(repetido.total * 12, false)}.`,
    });
  }

  if (mayores.length && mayores[0].importe > totalVariable * 0.25 && mayores[0].importe > 40) {
    const g = mayores[0];
    hallazgos.push({
      clave: "puntual",
      tono: "neutro",
      titulo: "Una compra manda sobre el mes",
      texto: `${g.nota ? `"${g.nota}"` : catPorId[g.categoria]?.nombre || "Un gasto suelto"} de ${eur(g.importe, false)} es el ${Math.round(porcentaje(g.importe, totalVariable))}% de todo tu gasto variable. Sin ella el mes se lee muy distinto.`,
    });
  }

  for (const r of rachas.slice(0, 2)) {
    hallazgos.push({
      clave: `racha-${r.id}`,
      tono: "ojo",
      titulo: `${r.nombre} lleva ${r.meses} meses subiendo`,
      texto: `Ha pasado de ${eur(r.desde, false)} a ${eur(r.hasta, false)} sin parar. No es un mes raro: es una tendencia.`,
    });
  }

  // El consejo de ahorro mira solo lo que de verdad se decide cada día.
  const subidaVariable = previos.length
    ? categoriasVariables.filter((c) => c.media > 0 && c.delta > 40).sort((a, b) => b.delta - a.delta)[0]
    : null;
  if (subidaVariable) {
    const s = subidaVariable;
    hallazgos.push({
      clave: "ahorro",
      tono: "consejo",
      titulo: "Dónde está el dinero fácil",
      texto: `Sin contar los fijos, en ${s.nombre} llevas ${eur(s.total, false)} frente a los ${eur(s.media, false)} de tus meses anteriores. Volver a esa media son ${eur(s.delta, false)} este mes y ${eur(s.delta * 12, false)} al año.`,
    });
  } else if (categoriasVariables.length && categoriasVariables[0].total > 60) {
    const c = categoriasVariables[0];
    hallazgos.push({
      clave: "ahorro",
      tono: "consejo",
      titulo: "Dónde está el dinero fácil",
      texto: `Sin contar los fijos, donde más se te va es ${c.nombre}: ${eur(c.total, false)} este mes. Recortarle un 10% son ${eur(c.total * 0.1, false)} al mes y ${eur(c.total * 1.2, false)} al año.`,
    });
  } else if (totalFijos > totalVariable * 2 && fijoCaro) {
    hallazgos.push({
      clave: "ahorro",
      tono: "consejo",
      titulo: "El margen está en los fijos",
      texto: `Tu gasto variable (${eur(totalVariable, false)}) es pequeño al lado de los fijos (${eur(totalFijos, false)}). Aquí se ahorra renegociando ${fijoCaro.nombre} o dando de baja lo que no uses, no apretando el día a día.`,
    });
  }

  if (dias.diasEnBlanco >= diasTranscurridos * 0.4 && diasTranscurridos >= 10) {
    hallazgos.push({
      clave: "blanco",
      tono: "bien",
      titulo: "Muchos días sin gastar",
      texto: `${dias.diasEnBlanco} de ${diasTranscurridos} días sin sacar la tarjeta. Es la costumbre que más baja el total a final de mes.`,
    });
  }

  if (esActual && diasRestantes > 0) {
    hallazgos.push({
      clave: "siguiente",
      tono: "neutro",
      titulo: `Lo que te espera en ${siguiente.nombre}`,
      texto: `Ya hay ${eur(siguiente.fijos, false)} comprometidos en fijos. Con tu gasto variable habitual, ${siguiente.nombre} rondaría ${eur(siguiente.estimado, false)}.`,
    });
  }

  /* ── cierre ───────────────────────────────────────────────────────────── */
  let cierre;
  if (presupuesto && esActual && proyectadoSobrePresupuesto > 1.05) {
    const exceso = proyeccion - presupuesto;
    cierre = `Para llegar al tope tendrías que dejar el gasto variable en ${eur(Math.max(0, (presupuesto - total) / Math.max(1, diasRestantes)))} al día lo que queda de mes.`;
  } else if (subidaVariable && subidaVariable.delta > 30) {
    cierre = `Si este mes tocara una sola tecla, sería ${subidaVariable.nombre}: ahí está la diferencia con tus meses normales.`;
  } else if (totalFijos > totalVariable * 2) {
    cierre = `Tu mes lo marcan los fijos, no el día a día: el margen real está en revisarlos una vez, no en apretar cada compra.`;
  } else if (nota >= 8) {
    cierre = `Mes controlado. Lo que estés haciendo, sigue haciéndolo.`;
  } else if (totalHormiga > totalVariable * 0.3) {
    cierre = `Aquí no hay un gasto que descuadre el mes: son muchos pequeños. Se arregla mirando el día a día, no recortando una compra grande.`;
  } else {
    cierre = `Sin sobresaltos: el mes se explica por lo de siempre, sin nada raro que destaque.`;
  }

  return {
    hayDatos: true,
    mesKey,
    titulo: `${MESES[m]} ${y}`,
    esActual,
    diasTranscurridos,
    diasRestantes,
    nDias,
    nota,
    tono,
    titular,
    cierre,
    bloques,
    hallazgos: hallazgos.slice(0, 6),
    cifras: {
      total,
      totalFijos,
      totalVariable,
      mediaPrevia,
      referenciaJusta,
      totalAnterior,
      totalHace12,
      proyeccion,
      presupuesto,
      ritmoVariable,
      mediaDiaria: diasTranscurridos ? total / diasTranscurridos : 0,
      nMovimientos: movimientos.length,
      mesesComparados: previos.length,
      siguiente,
    },
    categorias,
    dias,
    mayores,
  };
}
