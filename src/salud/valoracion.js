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
  ENTRENOS_SEMANA, KCAL_POR_KILO, cerrado, desdeIso, detalleTramo,
  diasTranscurridos, enTramo, etiquetaTramo, miles, num, pesosFiables,
  plural, rangoMes, rangoSemana,
} from "./nucleo.js";
import { calcularBalance, valorarDia } from "./estimador.js";

const TIPOS_ENTRENO = { fuerza: "fuerza", cardio: "cardio", equipo: "equipo", otro: "otro" };

const listar = (arr) =>
  arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} y ${arr[arr.length - 1]}`;

/** Pendiente por mínimos cuadrados: kilos por semana. */
function tendenciaPeso(serie) {
  if (serie.length < 3) return null;
  const t0 = serie[0].t;
  const xs = serie.map((p) => (p.t - t0) / 86400000);
  const ys = serie.map((p) => p.kg);
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let arriba = 0;
  let abajo = 0;
  for (let i = 0; i < n; i++) {
    arriba += (xs[i] - mx) * (ys[i] - my);
    abajo += (xs[i] - mx) ** 2;
  }
  if (abajo === 0) return null;
  const kgSemana = (arriba / abajo) * 7;
  // Más de 2 kg reales por semana no existe: si sale eso, es ruido de báscula.
  return Math.abs(kgSemana) > 2 ? null : kgSemana;
}

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

export function valorarPeriodo(datos, energia, periodo, offset) {
  const tramo = periodo === "semana" ? rangoSemana(offset) : rangoMes(offset);
  const etiqueta = etiquetaTramo(periodo, offset);
  const detalle = detalleTramo(periodo, offset);
  const estaCerrado = cerrado(tramo);
  const diasPasados = diasTranscurridos(tramo);
  const diasTotales = Math.round((tramo[1] - tramo[0]) / 86400000) + 1;

  const pesosTramo = datos.pesos
    .filter((p) => enTramo(p.fecha, tramo))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const entrenos = datos.entrenos.filter((e) => enTramo(e.fecha, tramo));
  const comidas = datos.comidas.filter((c) => enTramo(c.fecha, tramo));

  if (!pesosTramo.length && !entrenos.length && !comidas.length) {
    return { hayDatos: false, etiqueta, detalle, motivo: "No hay nada apuntado en este periodo." };
  }

  /* ── peso, apartando los saltos que no se sostienen ─────────────────── */
  const { fiables, sospechosos } = pesosFiables(pesosTramo);
  const primero = fiables.length ? fiables[0].kg : null;
  const ultimo = fiables.length ? fiables[fiables.length - 1].kg : null;
  const diferencia = fiables.length > 1 ? Number((ultimo - primero).toFixed(2)) : null;
  const pendiente = tendenciaPeso(fiables.map((p) => ({ t: desdeIso(p.fecha).getTime(), kg: p.kg })));

  /* ── entrenos ───────────────────────────────────────────────────────── */
  const minutos = entrenos.reduce((s, e) => s + (e.minutos || 0), 0);
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
      texto: `Cero entrenos en ${plural(diasPasados, "día")}. Deberían haber sido ${objetivoEntrenos}.`,
    });
  } else if (diasEntrenados < objetivoEntrenos) {
    const faltan = objetivoEntrenos - diasEntrenados;
    avisos.push({
      area: "Entrenos",
      tono: diasEntrenados < objetivoEntrenos / 2 ? "mal" : "regular",
      texto: `Has entrenado ${diasEntrenados} ${diasEntrenados === 1 ? "día" : "días"} de ${diasPasados}. Te ${faltan === 1 ? "falta uno" : `faltan ${faltan}`} para llegar a ${objetivoEntrenos}.`,
    });
  } else {
    avisos.push({
      area: "Entrenos",
      tono: "bien",
      texto: `${plural(diasEntrenados, "día entrenado", "días entrenados")} y ${plural(minutos, "minuto")}. Ahí no hay nada que corregir.`,
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
        texto: `Comes ${miles(kcalMedia)} kcal de media y tu diana son ${miles(energia.diana)}. Te pasas ${miles(desviacion)} al día: así no se baja.`,
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
        texto: `${miles(kcalMedia)} kcal de media, con la diana en ${miles(energia.diana)}. Ahí vas fino.`,
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
    const vaBien =
      (objetivo === "bajar" && diferencia < -0.1) ||
      (objetivo === "subir" && diferencia > 0.1) ||
      (objetivo === "mantener" && Math.abs(diferencia) <= 0.5);
    avisos.push({
      area: "Peso",
      tono: vaBien ? "bien" : "mal",
      texto: vaBien
        ? `${diferencia > 0 ? "+" : "−"}${num(Math.abs(diferencia))} kg en ${plural(diasPasados, "día")}. Va hacia donde quieres.`
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
    veredicto = { texto: `${malos.length} cosas mal esta ${periodo === "semana" ? "semana" : "vez"}`, tono: "mal" };
  } else if (malos.length) {
    veredicto = { texto: `Falla ${listar(malos.map((a) => a.area.toLowerCase()))}`, tono: "mal" };
  } else if (buenos.length >= 3) {
    veredicto = { texto: "Periodo redondo, nada que corregir", tono: "bien" };
  } else {
    veredicto = { texto: "Va bien, sin nada grave", tono: "bien" };
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
    cifras: {
      peso: { registros: pesosTramo.length, fiables: fiables.length, sospechosos: sospechosos.length, primero, ultimo, diferencia, pendiente },
      entrenos: { sesiones: entrenos.length, minutos, diasEntrenados, objetivo: objetivoEntrenos, porTipo },
      comidas: { diasConRegistro: dias.length, notaMedia, kcalMedia, balance, diana: energia ? energia.diana : null },
      contraste,
    },
    dias,
  };
}
