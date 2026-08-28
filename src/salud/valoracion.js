/* ─────────────────────────────────────────────────────────────────────────
   Salud · valoración de la semana o del mes.

   Directa y corta a propósito: cuatro avisos como mucho, cada uno con su
   número y su veredicto. Si has entrenado poco, lo dice. Si comes por encima
   de tu diana un día sí y otro también, lo dice. Sin rodeos ni ánimos de coach.

   Lo que no hace es soltar cifras imposibles: los saltos de báscula que no se
   sostienen se apartan antes de calcular nada, porque de 92 a 95 kg en un día
   no se engorda, se retiene agua.
   ───────────────────────────────────────────────────────────────────────── */

import {
  ENTRENOS_SEMANA, KCAL_POR_KILO, cerrado, detalleTramo,
  conFecha, diasTranscurridos, enTramo, etiquetaTramo, miles, num, pendienteSemanal,
  pesosFiables, plural, porFecha, rangoMes, rangoSemana,
} from "./nucleo.js";
import { calcularBalance, valorarDia } from "./estimador.js";

const TIPOS_ENTRENO = { fuerza: "fuerza", cardio: "cardio", equipo: "equipo", otro: "otro" };

const listar = (arr) =>
  arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} y ${arr[arr.length - 1]}`;

function diasValorados(comidas, energia) {
  const porDia = {};
  for (const c of comidas) (porDia[c.fecha] = porDia[c.fecha] || []).push(c);
  return Object.keys(porDia)
    .sort()
    .map((fecha) => {
      const lista = porDia[fecha].sort((a, b) => (a.ts || 0) - (b.ts || 0));
      const v = valorarDia(lista, energia);
      return { fecha, lista, ...v, balance: calcularBalance(energia, v.kcalMin, v.kcalMax) };
    });
}

/**
 * Los cuatro números de un tramo, sin opinar sobre ellos.
 *
 * Vive aparte para poder medir también el periodo ANTERIOR y comparar. Un
 * «has entrenado 3 días» no dice nada por sí solo: contra el objetivo dice si
 * cumples, pero contra las 5 de la semana pasada dice hacia dónde vas, que es
 * lo que de verdad se quiere saber.
 */
function medirTramo(datos, energia, tramo, diasPasados) {
  const pesos = conFecha(datos.pesos).filter((p) => enTramo(p.fecha, tramo)).sort(porFecha);
  const entrenos = conFecha(datos.entrenos).filter((e) => enTramo(e.fecha, tramo));
  const comidas = conFecha(datos.comidas).filter((c) => enTramo(c.fecha, tramo));

  const { fiables } = pesosFiables(pesos);
  const dias = diasValorados(comidas, energia);
  const kcal = dias.length
    ? dias.reduce((s, d) => s + (d.kcalMin + d.kcalMax) / 2, 0) / dias.length
    : null;

  return {
    hay: Boolean(pesos.length || entrenos.length || comidas.length),
    diasEntrenados: new Set(entrenos.map((e) => e.fecha)).size,
    sesiones: entrenos.length,
    /* Solo los apuntados. En pesas nadie mira el reloj, así que sumar una
       estimación aquí daba un «minutos de entreno» que parecía medido. */
    minutos: entrenos.reduce((s, e) => s + (Number(e.minutos) > 0 ? Number(e.minutos) : 0), 0),
    kcalMedia: kcal,
    diasApuntados: dias.length,
    cobertura: diasPasados > 0 ? dias.length / diasPasados : 0,
    diferenciaPeso: fiables.length > 1
      ? Number((fiables[fiables.length - 1].kg - fiables[0].kg).toFixed(2))
      : null,
  };
}

/** «2 más», «1 menos», «igual». Sin número cuando no hay con qué comparar. */
function compara(ahora, antes, { uno = "más", otro = "menos" } = {}) {
  if (antes === null || antes === undefined || ahora === null || ahora === undefined) return null;
  const d = Number((ahora - antes).toFixed(2));
  if (d === 0) return { d: 0, texto: "igual que antes" };
  return { d, texto: `${Math.abs(d) % 1 === 0 ? Math.abs(d) : num(Math.abs(d))} ${d > 0 ? uno : otro}` };
}

export function valorarPeriodo(datos, energia, periodo, offset) {
  const tramo = periodo === "semana" ? rangoSemana(offset) : rangoMes(offset);
  const etiqueta = etiquetaTramo(periodo, offset);
  const detalle = detalleTramo(periodo, offset);
  const estaCerrado = cerrado(tramo);
  const diasPasados = diasTranscurridos(tramo);
  const diasTotales = Math.round((tramo[1] - tramo[0]) / 86400000) + 1;

  /* Se filtra lo que no tiene fecha antes de nada: sin ella no se puede decir
     si cae en el tramo, y romper aquí dejaría la valoración en blanco. */
  const pesosTramo = conFecha(datos.pesos).filter((p) => enTramo(p.fecha, tramo)).sort(porFecha);
  const entrenos = conFecha(datos.entrenos).filter((e) => enTramo(e.fecha, tramo));
  const comidas = conFecha(datos.comidas).filter((c) => enTramo(c.fecha, tramo));

  if (!pesosTramo.length && !entrenos.length && !comidas.length) {
    return { hayDatos: false, etiqueta, detalle, motivo: "No hay nada apuntado en este periodo." };
  }

  /* El tramo anterior, medido sobre los MISMOS días transcurridos: comparar
     media semana contra una semana entera diría que has entrenado menos
     cuando lo único que pasa es que aún no ha terminado. */
  const tramoPrevio = periodo === "semana" ? rangoSemana(offset + 1) : rangoMes(offset + 1);
  const previo = medirTramo(datos, energia, tramoPrevio, diasPasados);

  /* ── peso, apartando los saltos que no se sostienen ─────────────────── */
  const { fiables, sospechosos } = pesosFiables(pesosTramo);
  const primero = fiables.length ? fiables[0].kg : null;
  const ultimo = fiables.length ? fiables[fiables.length - 1].kg : null;
  const diferencia = fiables.length > 1 ? Number((ultimo - primero).toFixed(2)) : null;
  const pendiente = pendienteSemanal(fiables);

  /* ── entrenos ───────────────────────────────────────────────────────── */
  const minutos = entrenos.reduce((s, e) => s + (Number(e.minutos) > 0 ? Number(e.minutos) : 0), 0);
  const diasEntrenados = new Set(entrenos.map((e) => e.fecha)).size;
  const objetivoEntrenos = Math.max(1, Math.round((ENTRENOS_SEMANA * diasPasados) / 7));
  const porTipo = {};
  for (const e of entrenos) {
    const l = TIPOS_ENTRENO[e.tipo] || "otro";
    porTipo[l] = (porTipo[l] || 0) + 1;
  }

  /* ── comidas ────────────────────────────────────────────────────────── */
  const dias = diasValorados(comidas, energia);
  const notas = dias.map((d) => d.nota).filter((n) => typeof n === "number");
  const notaMedia = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null;
  const kcalMedia = dias.length
    ? dias.reduce((s, d) => s + (d.kcalMin + d.kcalMax) / 2, 0) / dias.length
    : null;

  const balance = { encima: 0, linea: 0, debajo: 0 };
  for (const d of dias) if (d.balance) balance[d.balance.estado] += 1;

  const objetivo = energia ? energia.objetivo.id : null;
  const difDiaria = energia && kcalMedia ? kcalMedia - energia.diana : null;
  /* Si la báscula acompaña al objetivo. Se decide en el aviso del peso y se
     vuelve a usar en el veredicto, así que vive fuera de los dos. */
  let vaBien = false;

  /* Las tres comparaciones que de verdad dicen algo. `null` cuando el periodo
     anterior está vacío: comparar contra la nada es inventarse una tendencia. */
  const vs = previo.hay
    ? {
        entrenos: compara(diasEntrenados, previo.diasEntrenados, { uno: "más", otro: "menos" }),
        kcal: kcalMedia !== null && previo.kcalMedia !== null
          ? Math.round(kcalMedia - previo.kcalMedia) : null,
        peso: diferencia !== null && previo.diferenciaPeso !== null
          ? Number((diferencia - previo.diferenciaPeso).toFixed(2)) : null,
        apuntados: compara(dias.length, previo.diasApuntados),
      }
    : null;
  const antes = periodo === "semana" ? "la semana pasada" : "el mes pasado";

  /* ── avisos: cortos, con número y sin anestesia ─────────────────────── */
  const avisos = [];

  /* 1 · el registro manda: si está a medias, lo demás no se sostiene */
  const cobertura = dias.length / diasPasados;
  if (!dias.length) {
    avisos.push({
      area: "Registro",
      tono: "mal",
      texto: `No has apuntado ni una comida en ${plural(diasPasados, "día")}. Sin eso no hay nada que valorar.`,
    });
  } else if (cobertura < 0.6) {
    avisos.push({
      area: "Registro",
      tono: "mal",
      texto: `Solo ${plural(dias.length, "día apuntado", "días apuntados")} de ${diasPasados}. Con el registro a medias, las cifras de abajo valen poco.`,
    });
  } else if (cobertura < 0.9) {
    avisos.push({
      area: "Registro",
      tono: "regular",
      texto: `Te ${diasPasados - dias.length === 1 ? "falta" : "faltan"} ${plural(diasPasados - dias.length, "día")} por apuntar de ${diasPasados}.`,
    });
  }

  /* 2 · entrenos */
  if (!entrenos.length) {
    avisos.push({
      area: "Entrenos",
      tono: "mal",
      texto: previo.hay && previo.diasEntrenados > 0
        ? `Cero entrenos en ${plural(diasPasados, "día")}, y ${antes} fueron ${previo.diasEntrenados}. Eso no es un bajón, es haberlo dejado.`
        : `Cero entrenos en ${plural(diasPasados, "día")}. Deberían haber sido ${objetivoEntrenos}.`,
    });
  } else if (diasEntrenados < objetivoEntrenos) {
    const faltan = objetivoEntrenos - diasEntrenados;
    avisos.push({
      area: "Entrenos",
      tono: diasEntrenados < objetivoEntrenos / 2 ? "mal" : "regular",
      texto: vs && vs.entrenos && vs.entrenos.d < 0
        ? `${plural(diasEntrenados, "día entrenado", "días entrenados")}: ${vs.entrenos.texto} que ${antes}. Vas hacia abajo, no hacia arriba.`
        : vs && vs.entrenos && vs.entrenos.d > 0
          ? `${plural(diasEntrenados, "día entrenado", "días entrenados")}, ${vs.entrenos.texto} que ${antes}. Aún te ${faltan === 1 ? "falta uno" : `faltan ${faltan}`}, pero la dirección es la buena.`
          : `Has entrenado ${diasEntrenados} ${diasEntrenados === 1 ? "día" : "días"} de ${diasPasados}. Te ${faltan === 1 ? "falta uno" : `faltan ${faltan}`} para llegar a ${objetivoEntrenos}.`,
    });
  } else {
    avisos.push({
      area: "Entrenos",
      tono: "bien",
      texto: vs && vs.entrenos && vs.entrenos.d > 0
        ? `${plural(diasEntrenados, "día entrenado", "días entrenados")}, ${vs.entrenos.texto} que ${antes}. Ahí no hay nada que corregir.`
        : `${plural(diasEntrenados, "día entrenado", "días entrenados")} y ${plural(minutos, "minuto")}. Ahí no hay nada que corregir.`,
    });
  }

  /* 3 · comidas contra la diana.
     Con el registro a medias no se dan medias por buenas: dos días apuntados
     de siete darían un «comes 600 kcal» que no significa nada. */
  if (energia && dias.length && cobertura < 0.6) {
    avisos.push({
      area: "Comidas",
      tono: "regular",
      texto: `Con ${dias.length} ${dias.length === 1 ? "día apuntado" : "días apuntados"} no puedo decirte si comes de más o de menos. La media saldría falseada.`,
    });
  } else if (energia && dias.length) {
    const desviacion = Math.round(difDiaria);
    const pasarse = objetivo === "bajar" && desviacion > 120;
    const quedarse = objetivo === "subir" && desviacion < -120;
    const corto = objetivo === "bajar" && desviacion < -450;

    if (pasarse) {
      avisos.push({
        area: "Comidas",
        tono: "mal",
        texto: vs && vs.kcal !== null && Math.abs(vs.kcal) >= 100
          ? `Te pasas ${miles(desviacion)} kcal al día de tu diana, y comes ${miles(Math.abs(vs.kcal))} ${vs.kcal > 0 ? "MÁS" : "menos"} que ${antes}. ${vs.kcal > 0 ? "Vas a peor." : "Menos que antes, pero todavía no baja."}`
          : `Comes ${miles(kcalMedia)} kcal de media y tu diana son ${miles(energia.diana)}. Te pasas ${miles(desviacion)} al día: así no se baja.`,
      });
    } else if (quedarse) {
      avisos.push({
        area: "Comidas",
        tono: "mal",
        texto: `Comes ${miles(kcalMedia)} kcal de media y tu diana son ${miles(energia.diana)}. Te faltan ${miles(-desviacion)} al día para subir.`,
      });
    } else if (corto) {
      avisos.push({
        area: "Comidas",
        tono: "regular",
        texto: `Comes ${miles(kcalMedia)} kcal, ${miles(-desviacion)} por debajo de tu diana. Bajar así de rápido se paga en músculo y en hambre.`,
      });
    } else {
      avisos.push({
        area: "Comidas",
        tono: "bien",
        texto: vs && vs.kcal !== null && Math.abs(vs.kcal) >= 150
          ? `En la diana, y ${miles(Math.abs(vs.kcal))} kcal ${vs.kcal > 0 ? "por encima" : "por debajo"} de ${antes}. Ahí vas fino.`
          : `${miles(kcalMedia)} kcal de media, con la diana en ${miles(energia.diana)}. Ahí vas fino.`,
      });
    }

    if (balance.encima > balance.debajo + balance.linea && objetivo === "bajar") {
      avisos.push({
        area: "Comidas",
        tono: "mal",
        texto: `${plural(balance.encima, "día")} por encima de la diana y solo ${balance.debajo} por debajo. Es al revés de lo que hace falta.`,
      });
    }
  } else if (!energia && dias.length) {
    avisos.push({
      area: "Comidas",
      tono: "regular",
      texto: "Sin perfil completo no puedo decirte si comes de más o de menos. Rellénalo y esto cambia.",
    });
  }

  /* 4 · peso */
  if (sospechosos.length) {
    const s = sospechosos[0];
    avisos.push({
      area: "Peso",
      tono: "mal",
      texto: `${sospechosos.length === 1 ? "Hay un pesaje que no me creo" : `Hay ${sospechosos.length} pesajes que no me creo`}: ${num(s.kg)} kg suelto entre valores muy distintos. Eso es agua o un error, no peso, así que lo he apartado.`,
    });
  }

  if (fiables.length < 2) {
    avisos.push({
      area: "Peso",
      tono: fiables.length ? "regular" : "mal",
      texto: fiables.length
        ? "Un solo pesaje en todo el periodo. Con uno no se ve nada: pésate al menos dos o tres veces por semana."
        : "No te has pesado ni un día. Sin báscula esto es adivinar.",
    });
  } else if (objetivo) {
    vaBien =
      (objetivo === "bajar" && diferencia < -0.1) ||
      (objetivo === "subir" && diferencia > 0.1) ||
      (objetivo === "mantener" && Math.abs(diferencia) <= 0.5);
    avisos.push({
      area: "Peso",
      tono: vaBien ? "bien" : "mal",
      texto: vaBien
        ? vs && vs.peso !== null && Math.abs(vs.peso) >= 0.3
          ? `${diferencia > 0 ? "+" : "−"}${num(Math.abs(diferencia))} kg, contra ${previo.diferenciaPeso > 0 ? "+" : "−"}${num(Math.abs(previo.diferenciaPeso))} de ${antes}. Va hacia donde quieres y ${Math.abs(diferencia) > Math.abs(previo.diferenciaPeso) ? "más rápido" : "más despacio"}.`
          : `${diferencia > 0 ? "+" : "−"}${num(Math.abs(diferencia))} kg en ${plural(diasPasados, "día")}. Va hacia donde quieres.`
        : Math.abs(diferencia) < 0.15
        ? `El peso no se mueve: ${num(primero)} a ${num(ultimo)} kg. Con tu objetivo de ${energia.objetivo.verbo}, eso es no avanzar.`
        : `${diferencia > 0 ? "+" : "−"}${num(Math.abs(diferencia))} kg y tu objetivo es ${energia.objetivo.verbo}. Va al revés.`,
    });
  }

  /* ── veredicto: lo más gordo de todo lo anterior ────────────────────── */
  const malos = avisos.filter((a) => a.tono === "mal");
  const buenos = avisos.filter((a) => a.tono === "bien");

  let veredicto;
  if (!dias.length && !entrenos.length) {
    veredicto = { texto: "Sin datos suficientes para decirte nada", tono: "regular" };
  } else if (malos.length >= 3) {
    veredicto = {
      texto: vs && vs.entrenos && vs.entrenos.d < 0
        ? `Peor que ${antes}, y en ${malos.length} cosas a la vez`
        : `${malos.length} cosas mal esta ${periodo === "semana" ? "semana" : "vez"}`,
      tono: "mal",
    };
  } else if (malos.length) {
    veredicto = { texto: `Falla ${listar(malos.map((a) => a.area.toLowerCase()))}`, tono: "mal" };
  } else {
    /* Cuando algo va mal se dice con su cifra; cuando va bien, también. «Va
       bien, sin nada grave» no se lo cree nadie y no sabe a nada: se nombra
       lo que de verdad has hecho, que es lo que da ganas de repetirlo. */
    const logros = [];
    if (cobertura >= 0.9) {
      logros.push(
        dias.length >= diasPasados
          ? `${plural(dias.length, "día")} apuntados sin fallar uno`
          : `${plural(dias.length, "día")} apuntados de ${diasPasados}`
      );
    }
    if (diasEntrenados >= objetivoEntrenos) logros.push(plural(diasEntrenados, "entreno"));
    if (diferencia !== null && vaBien) {
      logros.push(`${diferencia > 0 ? "+" : "−"}${num(Math.abs(diferencia))} kg`);
    }

    /*
     * Un titular de «buena semana» no puede convivir con un aviso que dice
     * que entrenas menos que antes. Sin esto la valoración se contradecía a sí
     * misma: arriba felicitaba y dos líneas más abajo avisaba de que vas a
     * menos, y de las dos la que se lee es la de arriba.
     *
     * Que no haya nada catalogado como «mal» no significa que la cosa vaya
     * bien: ir a menos sin llegar a estar mal sigue siendo ir a menos.
     */
    const aMenos = vs && vs.entrenos && vs.entrenos.d < 0;

    if (aMenos) {
      veredicto = {
        texto: `Nada grave, pero ${vs.entrenos.texto} que ${antes}`,
        tono: "regular",
      };
    } else {
      const cabecera = buenos.length >= 3 || logros.length >= 3
        ? periodo === "semana" ? "Semana redonda" : "Mes redondo"
        : periodo === "semana" ? "Buena semana" : "Buen mes";

      /* Cuando además se mejora lo anterior, se dice: es el dato que más
         empuja a repetir, y es el que el usuario no puede ver de un vistazo. */
      const mejora = vs && vs.entrenos && vs.entrenos.d > 0 ? `${vs.entrenos.texto} que ${antes}` : null;

      veredicto = {
        texto: logros.length
          ? `${cabecera}: ${listar(mejora ? [...logros, mejora] : logros)}`
          : `${cabecera}, nada que corregir`,
        tono: "bien",
      };
    }
  }

  /* ── cierre: una sola cosa que hacer ────────────────────────────────── */
  /* Por orden de lo que más manda: sin registro no hay nada; luego la comida,
     que es lo que mueve el peso; luego los entrenos; y la báscula la última,
     que es medir, no hacer. */
  const PRIORIDAD = ["Registro", "Comidas", "Entrenos", "Peso"];
  const peor = [...malos].sort((a, b) => PRIORIDAD.indexOf(a.area) - PRIORIDAD.indexOf(b.area))[0];

  let cierre;
  if (!dias.length && !entrenos.length) {
    cierre = "Apunta una semana entera y vuelve. Con el registro vacío no hay nada que analizar.";
  } else if (peor && peor.area === "Registro") {
    cierre = "Apunta todos los días de la próxima semana, aunque sea a medias. Es lo único que hace falta ahora.";
  } else if (peor && peor.area === "Entrenos") {
    cierre = `Mete ${Math.max(1, objetivoEntrenos - diasEntrenados)} ${objetivoEntrenos - diasEntrenados === 1 ? "sesión más" : "sesiones más"} en el próximo periodo. No hace falta nada más.`;
  } else if (peor && peor.area === "Comidas") {
    /* Nunca se pide un recorte imposible: si te pasas 2.000 kcal, decirte que
       quites 2.000 de golpe no sirve de nada. Se pide un primer paso. */
    const exceso = Math.round(difDiaria || 200);
    const recorte = Math.min(500, Math.max(150, exceso));
    cierre =
      objetivo === "bajar"
        ? exceso > 600
          ? `Te pasas ${miles(exceso)} kcal al día, que es mucho para arreglarlo de una. Empieza quitando ${miles(recorte)} y ya veremos la semana que viene.`
          : `Quita unas ${miles(recorte)} kcal al día y el resto se arregla solo.`
        : "Ajusta las raciones a tu diana y deja que pasen dos semanas.";
  } else if (peor && peor.area === "Peso") {
    cierre = "Pésate en ayunas, siempre a la misma hora y con la misma ropa. Si no, la báscula no sirve para nada.";
  } else {
    cierre = "Sigue igual y vuelve dentro de una semana.";
  }

  /* ── datos crudos, por si la pantalla quiere enseñarlos ─────────────── */
  let contraste = null;
  if (energia && kcalMedia && fiables.length > 1 && diasPasados >= 5) {
    const balanceDiario = kcalMedia - energia.gasto;
    const esperadoKg = (balanceDiario * diasPasados) / KCAL_POR_KILO;
    contraste = {
      balanceDiario: Math.round(balanceDiario),
      esperadoKg: Number(esperadoKg.toFixed(2)),
      realKg: diferencia,
      desvio: Number((diferencia - esperadoKg).toFixed(2)),
      coherente: Math.abs(diferencia - esperadoKg) < 0.7,
    };
  }

  return {
    hayDatos: true,
    etiqueta,
    detalle,
    estaCerrado,
    diasPasados,
    diasTotales,
    veredicto,
    avisos,
    cierre,
    /* Lo de antes, para que la pantalla pueda enseñar el «vs.» sin recalcular. */
    comparacion: previo.hay ? { previo, vs, etiqueta: antes } : null,
    cifras: {
      peso: { registros: pesosTramo.length, fiables: fiables.length, sospechosos: sospechosos.length, primero, ultimo, diferencia, pendiente },
      entrenos: { sesiones: entrenos.length, minutos, diasEntrenados, objetivo: objetivoEntrenos, porTipo },
      comidas: { diasConRegistro: dias.length, notaMedia, kcalMedia, balance, diana: energia ? energia.diana : null },
      contraste,
    },
    dias,
  };
}
