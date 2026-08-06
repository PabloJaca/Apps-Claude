/* ─────────────────────────────────────────────────────────────────────────
   Salud · valoración de la semana o del mes, calculada aquí.

   Lo que antes redactaba un modelo de pago ahora sale de los datos. Y en un
   punto concreto es incluso mejor que antes: cruza lo que has comido con lo
   que ha hecho la báscula. Si las calorías apuntadas dicen una cosa y el peso
   dice otra, eso se ve y se cuenta.
   ───────────────────────────────────────────────────────────────────────── */

import {
  KCAL_POR_KILO, cerrado, detalleTramo, diasTranscurridos, enTramo, etiquetaTramo,
  miles, num, rangoMes, rangoSemana,
} from "./nucleo.js";
import { calcularBalance, valorarDia } from "./estimador.js";

const TIPOS_ENTRENO = { fuerza: "Fuerza", cardio: "Cardio", equipo: "Equipo", otro: "Otro" };

const listar = (arr) =>
  arr.length <= 1 ? arr.join("") : `${arr.slice(0, -1).join(", ")} y ${arr[arr.length - 1]}`;

/** Pendiente por mínimos cuadrados: kilos por semana según toda la serie. */
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
  return (arriba / abajo) * 7; // kg por semana
}

/** Agrupa las comidas por día y las valora con el estimador local. */
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

  const pesos = datos.pesos
    .filter((p) => enTramo(p.fecha, tramo))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const entrenos = datos.entrenos.filter((e) => enTramo(e.fecha, tramo));
  const comidas = datos.comidas.filter((c) => enTramo(c.fecha, tramo));

  if (!pesos.length && !entrenos.length && !comidas.length) {
    return { hayDatos: false, etiqueta, detalle, motivo: "Todavía no hay registros en este periodo." };
  }

  /* ── periodo anterior, para comparar ────────────────────────────────── */
  const tramoPrevio = periodo === "semana" ? rangoSemana(offset + 1) : rangoMes(offset + 1);
  const entrenosPrevios = datos.entrenos.filter((e) => enTramo(e.fecha, tramoPrevio));
  const comidasPrevias = datos.comidas.filter((c) => enTramo(c.fecha, tramoPrevio));

  /* ── peso ───────────────────────────────────────────────────────────── */
  const serie = pesos.map((p) => ({ t: new Date(p.fecha).getTime(), kg: p.kg }));
  const primero = pesos.length ? pesos[0].kg : null;
  const ultimo = pesos.length ? pesos[pesos.length - 1].kg : null;
  const diferencia = pesos.length > 1 ? Number((ultimo - primero).toFixed(2)) : null;
  const pendiente = tendenciaPeso(serie);

  /* ── entrenos ───────────────────────────────────────────────────────── */
  const minutos = entrenos.reduce((s, e) => s + (e.minutos || 0), 0);
  const diasEntrenados = new Set(entrenos.map((e) => e.fecha)).size;
  const porTipo = {};
  for (const e of entrenos) {
    const l = TIPOS_ENTRENO[e.tipo] || "Otro";
    porTipo[l] = (porTipo[l] || 0) + 1;
  }
  const minutosPrevios = entrenosPrevios.reduce((s, e) => s + (e.minutos || 0), 0);

  /* ── comidas ────────────────────────────────────────────────────────── */
  const dias = diasValorados(comidas, energia);
  const notas = dias.map((d) => d.nota).filter((n) => typeof n === "number");
  const notaMedia = notas.length ? notas.reduce((s, n) => s + n, 0) / notas.length : null;
  const kcalMedia = dias.length
    ? dias.reduce((s, d) => s + (d.kcalMin + d.kcalMax) / 2, 0) / dias.length
    : null;

  const balance = { encima: 0, linea: 0, debajo: 0 };
  for (const d of dias) if (d.balance) balance[d.balance.estado] += 1;

  const diasPreviosValorados = diasValorados(comidasPrevias, energia);
  const kcalMediaPrevia = diasPreviosValorados.length
    ? diasPreviosValorados.reduce((s, d) => s + (d.kcalMin + d.kcalMax) / 2, 0) / diasPreviosValorados.length
    : null;

  const gruposTotales = {};
  for (const d of dias) {
    for (const [g, v] of Object.entries(d.grupos || {})) gruposTotales[g] = (gruposTotales[g] || 0) + v;
  }
  const diasSinVerdura = dias.filter((d) => !d.grupos?.verdura && !d.grupos?.fruta).length;

  /* ── el cruce interesante: calorías contra báscula ──────────────────── */
  let contraste = null;
  if (energia && kcalMedia && pesos.length > 1 && diasPasados >= 5) {
    const balanceDiario = kcalMedia - energia.gasto;
    const esperadoKg = (balanceDiario * diasPasados) / KCAL_POR_KILO;
    const realKg = diferencia;
    const desvio = realKg - esperadoKg;
    contraste = {
      balanceDiario: Math.round(balanceDiario),
      esperadoKg: Number(esperadoKg.toFixed(2)),
      realKg,
      desvio: Number(desvio.toFixed(2)),
      coherente: Math.abs(desvio) < 0.7,
    };
  }

  /* ── secciones ──────────────────────────────────────────────────────── */
  const secciones = [];

  /* Peso */
  {
    const f = [];
    if (!pesos.length) {
      f.push("No has pesado ni un día de este periodo, así que aquí no hay nada que mirar.");
    } else if (pesos.length === 1) {
      f.push(`Solo un pesaje: ${num(ultimo)} kg. Con uno no se ve tendencia, hacen falta al menos tres.`);
    } else {
      f.push(
        `De ${num(primero)} a ${num(ultimo)} kg en ${pesos.length} pesajes: ${
          Math.abs(diferencia) < 0.15 ? "prácticamente igual" : `${diferencia > 0 ? "+" : "−"}${num(Math.abs(diferencia))} kg`
        }.`
      );
      if (pendiente != null && Math.abs(pendiente) > 0.05) {
        f.push(
          `El ritmo de fondo es de ${pendiente > 0 ? "+" : "−"}${num(Math.abs(pendiente), 2)} kg por semana; a ese paso serían ${num(Math.abs(pendiente) * 4.3, 1)} kg al mes.`
        );
      }
      if (energia) {
        const obj = energia.objetivo.id;
        const vaBien =
          (obj === "bajar" && diferencia < -0.1) ||
          (obj === "subir" && diferencia > 0.1) ||
          (obj === "mantener" && Math.abs(diferencia) <= 0.5);
        f.push(
          vaBien
            ? `Va en la dirección de tu objetivo de ${energia.objetivo.verbo} peso.`
            : `Tu objetivo es ${energia.objetivo.verbo} peso y la báscula no acompaña en este periodo.`
        );
      }
    }
    secciones.push({ area: "Peso", texto: f.join(" ") });
  }

  /* Entrenos */
  {
    const f = [];
    if (!entrenos.length) {
      f.push(`Ni una sesión apuntada en ${periodo === "semana" ? "la semana" : "el mes"}.`);
      if (entrenosPrevios.length) f.push(`En el periodo anterior fueron ${entrenosPrevios.length}.`);
    } else {
      f.push(
        `${entrenos.length} ${entrenos.length === 1 ? "sesión" : "sesiones"} repartidas en ${diasEntrenados} ${diasEntrenados === 1 ? "día" : "días distintos"}, ${minutos} minutos en total.`
      );
      const tipos = Object.entries(porTipo).sort((a, b) => b[1] - a[1]);
      if (tipos.length) f.push(`Reparto: ${listar(tipos.map(([t, n]) => `${n} de ${t.toLowerCase()}`))}.`);
      if (minutosPrevios > 0) {
        const d = minutos - minutosPrevios;
        f.push(
          Math.abs(d) < 15
            ? "Casi los mismos minutos que el periodo anterior."
            : `${d > 0 ? `${d} minutos más` : `${-d} minutos menos`} que el periodo anterior (${minutosPrevios}).`
        );
      }
      const media = minutos / Math.max(1, diasEntrenados);
      f.push(`Sesión media de ${Math.round(media)} minutos.`);
    }
    secciones.push({ area: "Entrenos", texto: f.join(" ") });
  }

  /* Comidas */
  {
    const f = [];
    if (!dias.length) {
      f.push("No has apuntado comidas en este periodo, así que no puedo estimar nada de alimentación.");
    } else {
      f.push(
        `${dias.length} de ${diasPasados} días con comidas apuntadas${dias.length < diasPasados ? ` (faltan ${diasPasados - dias.length})` : ""}.`
      );
      if (kcalMedia) f.push(`Media estimada de ${miles(kcalMedia)} kcal al día.`);
      if (notaMedia != null) f.push(`Nota media de los días: ${num(notaMedia)}/10.`);
      if (energia && dias.length) {
        f.push(
          `Respecto a tu diana de ${miles(energia.diana)} kcal: ${balance.debajo} ${balance.debajo === 1 ? "día" : "días"} por debajo, ${balance.linea} en línea y ${balance.encima} por encima.`
        );
      }
      if (kcalMediaPrevia) {
        const d = kcalMedia - kcalMediaPrevia;
        if (Math.abs(d) > 120) {
          f.push(`Son ${miles(Math.abs(d))} kcal ${d > 0 ? "más" : "menos"} al día que el periodo anterior.`);
        }
      }
      if (diasSinVerdura > dias.length * 0.4 && dias.length >= 3) {
        f.push(`En ${diasSinVerdura} de esos días no aparece verdura ni fruta.`);
      }
    }
    secciones.push({ area: "Comidas", texto: f.join(" ") });
  }

  /* Objetivo: la sección donde se moja */
  {
    const f = [];
    if (!energia) {
      f.push("Sin perfil completo no puedo decir si esto acompaña a tu objetivo: falta altura, edad, sexo, actividad u objetivo.");
    } else if (contraste) {
      f.push(
        contraste.balanceDiario < 0
          ? `Con lo apuntado comes unas ${miles(-contraste.balanceDiario)} kcal por debajo de tu gasto cada día.`
          : `Con lo apuntado comes unas ${miles(contraste.balanceDiario)} kcal por encima de tu gasto cada día.`
      );
      f.push(
        `Eso deberían ser ${contraste.esperadoKg > 0 ? "+" : "−"}${num(Math.abs(contraste.esperadoKg), 2)} kg en estos ${diasPasados} días, y la báscula marca ${contraste.realKg > 0 ? "+" : "−"}${num(Math.abs(contraste.realKg), 2)} kg.`
      );
      if (contraste.coherente) {
        f.push("Los dos números cuadran, así que la estimación de lo que comes se sostiene.");
      } else if (contraste.desvio > 0) {
        f.push(
          "El peso baja menos (o sube más) de lo que dirían las calorías apuntadas. Lo más normal es que se esté quedando comida sin apuntar, o que las raciones sean mayores de lo estimado."
        );
      } else {
        f.push(
          "El peso se mueve más rápido de lo que dirían las calorías apuntadas. Puede ser agua, o que el gasto real sea mayor que el estimado."
        );
      }
    } else if (energia && dias.length) {
      const media = kcalMedia - energia.gasto;
      f.push(
        media < 0
          ? `Comiendo así vas unas ${miles(-media)} kcal por debajo de tu gasto al día, que es lo que hace bajar de peso.`
          : `Comiendo así vas unas ${miles(media)} kcal por encima de tu gasto al día.`
      );
      f.push("Con más pesajes en el periodo podría contrastarlo con la báscula.");
    } else {
      f.push("Faltan datos de comidas para cruzarlos con el peso.");
    }

    if (!estaCerrado) {
      f.push(`Ojo: ${periodo === "semana" ? "la semana" : "el mes"} no ha terminado, van ${diasPasados} de ${diasTotales} días.`);
    }
    secciones.push({ area: "Objetivo", texto: f.join(" ") });
  }

  /* ── titular y cierre ───────────────────────────────────────────────── */
  let titular;
  if (energia && diferencia != null && Math.abs(diferencia) >= 0.15) {
    const obj = energia.objetivo.id;
    const bien = (obj === "bajar" && diferencia < 0) || (obj === "subir" && diferencia > 0);
    titular = bien
      ? `${num(Math.abs(diferencia))} kg en la dirección buena`
      : `El peso va al revés de tu objetivo: ${diferencia > 0 ? "+" : "−"}${num(Math.abs(diferencia))} kg`;
  } else if (diferencia != null && Math.abs(diferencia) < 0.15) {
    titular = "Peso estable en todo el periodo";
  } else if (entrenos.length) {
    titular = `${entrenos.length} ${entrenos.length === 1 ? "sesión" : "sesiones"} y ${minutos} minutos de entreno`;
  } else {
    titular = "Pocos datos todavía en este periodo";
  }

  let cierre;
  if (!dias.length && !entrenos.length) {
    cierre = "Apunta aunque sea a medias: con el registro a cero no hay nada que analizar.";
  } else if (dias.length < diasPasados * 0.5) {
    cierre = `Solo has apuntado la mitad de los días. Con el registro completo las cifras de arriba serían mucho más fiables.`;
  } else if (contraste && !contraste.coherente && contraste.desvio > 0) {
    cierre = "Antes de tocar nada, prueba a apuntar una semana entera sin dejarte el picoteo: ahí suele estar la diferencia.";
  } else if (energia && balance.encima > balance.debajo + balance.linea && energia.objetivo.id === "bajar") {
    cierre = "Para bajar hay que sumar más días por debajo que por encima, y ahora mismo pasa lo contrario.";
  } else if (!entrenos.length) {
    cierre = "La alimentación manda en el peso, pero sin entrenos se pierde músculo por el camino.";
  } else {
    cierre = "El registro es consistente: sigue así y en un mes la tendencia se leerá sola.";
  }

  return {
    hayDatos: true,
    etiqueta,
    detalle,
    estaCerrado,
    diasPasados,
    diasTotales,
    titular,
    secciones,
    cierre,
    cifras: {
      peso: { registros: pesos.length, primero, ultimo, diferencia, pendiente },
      entrenos: { sesiones: entrenos.length, minutos, diasEntrenados, porTipo },
      comidas: { diasConRegistro: dias.length, notaMedia, kcalMedia, balance },
      contraste,
    },
    dias,
  };
}
