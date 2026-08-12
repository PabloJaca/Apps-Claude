/* Gastos · hoja de estilos.
   Pensada para el móvil primero, con un salto a dos columnas en pantallas
   grandes para que en el ordenador no quede una columna flaca en medio. */

export const CSS = `
.gx {
  /* «soft» estaba en #7C93A8: sobre blanco son 3,2 de contraste y sobre el
     papel 2,9, por debajo del mínimo para texto pequeño. Con #5C7488 pasa a
     4,9 y 4,5 sin dejar de ser el gris de lo secundario. */
  --paper:#F1F6FA; --card:#FFFFFF; --ink:#15293C; --soft:#5C7488;
  --line:#E6EDF3; --accent:#0F9E8E; --mint:#1FB47A; --amber:#F5A524; --coral:#F4614E;
  --sombra:0 1px 2px rgba(21,41,60,.04), 0 6px 20px rgba(21,41,60,.055);
  min-height:100dvh; height:100dvh; display:flex; flex-direction:column;
  background:var(--paper); color:var(--ink);
  font-family:'Instrument Sans', ui-sans-serif, system-ui, sans-serif;
  -webkit-font-smoothing:antialiased; position:relative; overflow:hidden;
}
.gx *, .gx *::before, .gx *::after { box-sizing:border-box; }
/* El reset va en :where() para que tenga especificidad cero. Escrito como
   «.gx button» pesaba más que «.fab» o «.tarjetaRevision» —una clase y un
   elemento contra una clase— y les borraba el fondo y el color: el botón
   principal, el flotante y la tarjeta de revisión salían todos en blanco. */
:where(.gx button) { font-family:inherit; cursor:pointer; border:none; background:none; color:inherit;
  display:inline-flex; align-items:center; justify-content:center; gap:7px; }
:where(.gx input) { font-family:inherit; color:inherit; }
.gx ul { list-style:none; margin:0; padding:0; }
.gx h2 { font-family:'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif;
  font-size:15px; font-weight:700; letter-spacing:-.015em; margin:0;
  display:flex; align-items:center; gap:7px; }
.gx .hIcono { color:var(--soft); }
.gx .mono { font-family:'IBM Plex Mono', ui-monospace, monospace; font-variant-numeric:tabular-nums; }
.gx :focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:6px; }
@keyframes girarSync { to { transform:rotate(360deg); } }
.gx .spin { animation:girarSync 1s linear infinite; }

.cabecera { display:flex; align-items:center; justify-content:space-between; gap:8px;
  padding:14px 14px 12px; flex-shrink:0; background:var(--paper); min-width:0; }
.cabeceraDerecha { display:flex; align-items:center; gap:8px; min-width:0; }
.mesTitulo { min-width:0; overflow:hidden; }
.mesNombre { white-space:nowrap; }
/* La pastilla se queda solo con el icono en todo lo que sea un móvil.
   Estaba en 400 px, que valía con tres botones arriba; con el micrófono son
   cuatro y a partir de 401 reaparecía la palabra «Guardado» y la cabecera se
   salía justo en los anchos más comunes de Android (412, 414, 430). El texto
   sobra al lado de una nube que ya lo dice. */
@media (max-width:520px) { .etiquetaSync { display:none; } }
/* Y en las muy estrechas —hay Android de 360 y de 320— sobra la flechita del
   título: el mes se sigue pudiendo tocar igual, y con ella la cabecera se
   salía por la derecha sin avisar, porque el marco recorta en silencio. */
@media (max-width:380px) {
  .cabecera { gap:4px; padding-left:10px; padding-right:10px; }
  .cabeceraDerecha { gap:5px; }
  .mesTitulo .hIcono { display:none; }
  .mesTitulo { padding-left:4px; padding-right:4px; margin-left:-4px; }
}
.flecha { width:40px; height:40px; border-radius:50%; color:var(--soft);
  background:#fff; box-shadow:var(--sombra); transition:color .15s, transform .1s; flex-shrink:0; }
.flecha:hover:not(:disabled) { color:var(--accent); }
.flecha:active:not(:disabled) { transform:scale(.93); }
.flecha:disabled { opacity:.3; cursor:default; box-shadow:none; background:transparent; }
.mesTitulo { display:flex; align-items:baseline; gap:7px; font-family:'Bricolage Grotesque', sans-serif;
  padding:6px 8px; margin-left:-8px; border-radius:12px; transition:background .14s; }
.mesTitulo:hover { background:#E7EEF4; }
.mesTitulo .hIcono { align-self:center; }
.mesNombre { font-size:18px; font-weight:700; letter-spacing:-.025em; text-transform:capitalize; }
.mesAno { font-size:13px; color:var(--soft); font-weight:500; }

.aviso { background:#FFEDE9; color:#B23E29; font-size:12.5px; padding:10px 16px;
  margin:0 14px 4px; border-radius:12px; flex-shrink:0; }

.lienzo { flex:1; overflow-y:auto; padding:4px 14px 24px;
  display:flex; flex-direction:column; gap:14px; -webkit-overflow-scrolling:touch; }

.hero { padding:8px 4px 4px; }
.etiqueta { font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--soft); font-weight:600; }
.cifraGrande { font-family:'Bricolage Grotesque', sans-serif; font-weight:800;
  font-size:clamp(40px, 13vw, 56px); line-height:1; letter-spacing:-.04em;
  margin:8px 0 12px; font-variant-numeric:tabular-nums; }
.filaResumen { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.delta { display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:600;
  padding:5px 10px; border-radius:99px; background:#EDF2F7; color:var(--soft); }
.delta.sube { background:#FFEDE9; color:#D64A34; }
.delta.baja { background:#DFF6EB; color:#0E8A5F; }
.trozo { display:inline-flex; align-items:center; gap:5px; font-size:12px; color:var(--soft);
  padding:5px 10px; border-radius:99px; background:#fff; box-shadow:var(--sombra); }
.trozo b { font-weight:600; color:var(--ink); }

.pulso { margin-top:20px; }
.pulso.enTarjeta { margin-top:4px; }
.pulsoBarras { display:flex; align-items:flex-end; gap:2px; height:76px; position:relative; }
.pulsoBarra { flex:1; background:var(--accent); border-radius:3px 3px 1px 1px; min-height:3px;
  opacity:.9; transition:opacity .15s; }
.pulsoBarra.excede { background:var(--coral); }
.pulsoBarra.futuro { background:#DCE7F0; opacity:1; }
.pulsoBarra.hoy { outline:2px solid var(--ink); outline-offset:1px; border-radius:3px; }
.pulsoBarra:hover { opacity:1; }
.pulsoRitmo { position:absolute; left:0; right:0; border-top:1.5px dashed #A9BECE; pointer-events:none; }
/* El gráfico vive dentro de una tarjeta, así que la etiqueta se recorta contra
   el blanco de la tarjeta y no contra el fondo de la página. */
.pulsoRitmo span { position:absolute; right:0; top:-16px; font-size:9.5px;
  font-family:'IBM Plex Mono', monospace; color:var(--soft); background:var(--card);
  padding:0 5px; letter-spacing:-.02em; }
.pulsoEje { display:flex; justify-content:space-between; margin-top:8px; font-size:10.5px; color:var(--soft); }

.tarjeta { background:var(--card); border-radius:18px; padding:17px; box-shadow:var(--sombra); }
.filaCabecera { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:13px; }
.etiquetaValor { font-size:11.5px; color:var(--soft); background:#F3F7FA;
  padding:4px 9px; border-radius:99px; white-space:nowrap; }
.pie { font-size:12.5px; color:var(--soft); line-height:1.55; margin:12px 0 0; }
.pie.sup { margin:0 0 12px; }
.pie.separador { margin-top:16px; padding-top:14px; border-top:1px solid var(--line);
  text-transform:uppercase; letter-spacing:.08em; font-size:10.5px; font-weight:600; }
.cifraGrande.enRojo { color:var(--coral); }
.conmutador { display:flex; gap:2px; background:#EDF2F7; border-radius:10px; padding:2px; flex-shrink:0; }
.conmutador button { font-size:12px; font-weight:600; padding:5px 11px; border-radius:8px; color:var(--soft); }
.conmutador button.sel { background:#fff; color:var(--ink); box-shadow:0 1px 3px rgba(21,41,60,.10); }
.pie.sup { margin-bottom:10px; }
.botonTexto { font-size:12.5px; font-weight:600; color:var(--accent); padding:4px 6px; }
.chipRepetir { display:flex; align-items:center; gap:7px; width:100%; background:#F7FAFC;
  border:1.5px solid var(--line); border-radius:12px; padding:9px 11px; text-align:left; margin-bottom:6px; }
.chipRepetir .nom { flex:1; min-width:0; font-size:13px; font-weight:600; color:var(--ink);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.chipRepetir .imp { font-family:'IBM Plex Mono', monospace; font-size:12.5px; color:var(--soft); flex-shrink:0; }
.barraObj { height:8px; border-radius:999px; background:#EDF2F7; overflow:hidden; margin:7px 0 5px; }
.barraObj > div { height:100%; border-radius:999px; background:var(--mint); transition:width .4s; }
.parrafo { font-size:14px; line-height:1.6; margin:0; color:var(--ink); }
.txtRojo { color:var(--coral); }
.txtVerde { color:var(--mint); }
.filaBotones { display:flex; gap:9px; }
.filaBotones .botonSecundario { flex:1; }

.insignia { width:36px; height:36px; border-radius:11px; display:inline-flex;
  align-items:center; justify-content:center; flex-shrink:0; }
.insignia.mini { width:28px; height:28px; border-radius:9px; }
.insignia.pulsable { cursor:pointer; transition:transform .12s; }
.insignia.pulsable:active { transform:scale(.92); }

.barraPres { position:relative; height:10px; background:#EDF2F7; border-radius:99px; }
/* Cuando la barra es el botón de editar el presupuesto hay que devolverle el
   display de bloque: el reset de botones la deja en inline-flex y las capas
   de dentro, que van posicionadas, se descolocan. */
.barraPres.pulsable { display:block; width:100%; padding:0; }
.barraPres.pulsable:hover { box-shadow:0 0 0 3px rgba(15,158,142,.12); }
.barraPres.pequena { height:7px; }
.barraPresRelleno { position:relative; height:100%; background:var(--accent);
  border-radius:99px; transition:width .35s ease; z-index:1; }
.barraPresRelleno.ambar { background:var(--amber); }
.barraPresRelleno.rojo { background:var(--coral); }
.barraPresFijos { position:absolute; top:0; left:0; height:100%; border-radius:99px; z-index:2;
  background:repeating-linear-gradient(45deg, rgba(255,255,255,.55) 0 3px, transparent 3px 6px), #9FB6C6; }
.barraPresMarca { position:absolute; top:-4px; bottom:-4px; width:2.5px; background:var(--ink);
  border-radius:2px; z-index:3; }

.itemGasto { display:flex; align-items:center; gap:12px; width:100%; text-align:left;
  justify-content:flex-start; padding:10px 6px; border-radius:12px; transition:background .12s; }
.itemGasto:hover { background:#F5F9FC; }
.itemGasto:active { background:#EDF3F8; }
.itemTexto { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.itemCat { font-size:14.5px; font-weight:500; display:flex; align-items:center; gap:7px;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.marcaFijo { display:inline-flex; align-items:center; gap:3px; font-family:'IBM Plex Mono', monospace;
  font-size:8.5px; font-weight:600; letter-spacing:.08em; text-transform:uppercase;
  color:var(--soft); background:#F0F5F9; border-radius:5px; padding:2px 5px; flex-shrink:0; }
.itemNota { font-size:11.5px; color:var(--soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.itemNota:empty { display:none; }
.itemDerecha { display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
.itemImporte { font-size:14.5px; font-weight:600; white-space:nowrap; }
.itemFecha { font-size:10.5px; color:var(--soft); }
.listaFijos.apagada .itemCat { color:var(--soft); }

.vacio { text-align:center; padding:12px 8px 6px; }
.vacioIcono { width:52px; height:52px; border-radius:16px; background:#F3F7FA; color:var(--soft);
  display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
.vacio p { font-size:13.5px; color:var(--soft); margin:0 0 16px; line-height:1.55; }
.vacioBotones { display:flex; flex-direction:column; gap:9px; }

.donutZona { position:relative; }
.donutCentro { position:absolute; inset:0; display:flex; flex-direction:column;
  align-items:center; justify-content:center; pointer-events:none; }
.donutTotal { font-size:20px; font-weight:600; letter-spacing:-.025em; }
.donutPie { font-size:10px; color:var(--soft); letter-spacing:.08em; text-transform:uppercase; margin-top:2px; }

.leyenda li { display:flex; align-items:center; gap:10px; padding:8px 2px; font-size:13.5px; }
.leyNombre { min-width:74px; flex-shrink:0; }
.leyBarra { flex:1; height:6px; background:#EDF2F7; border-radius:99px; overflow:hidden; }
.leyBarra i { display:block; height:100%; border-radius:99px; }
.leyImporte { font-weight:600; font-size:13px; min-width:66px; text-align:right; }

.listaRank li { display:flex; align-items:center; gap:10px; padding:8px 2px; font-size:13.5px; }
.rankTexto { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
.rankNombre { font-weight:500; }
.rankMedia { font-size:10.5px; color:var(--soft); }
.chip { font-family:'IBM Plex Mono', monospace; font-size:11.5px; font-weight:600;
  padding:5px 9px; border-radius:99px; background:#EDF2F7; color:var(--soft);
  min-width:64px; text-align:center; flex-shrink:0; }
.chipRojo { background:#FFEDE9; color:#D64A34; }
.chipVerde { background:#DFF6EB; color:#0E8A5F; }
.chipAmbar { background:#FFF4E2; color:#B87400; }

/* ── el año ──────────────────────────────────────────────────────────── */

.anoBarras { display:flex; align-items:flex-end; gap:5px; height:132px; }
.anoMes { flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:6px; height:100%; }
.anoColumna { position:relative; flex:1; width:100%; display:flex; align-items:flex-end; justify-content:center; }
/* Lo que entró va detrás y en claro: es el listón contra el que se lee el
   gasto, no otra barra que competir con la primera. */
.anoIngreso { position:absolute; bottom:0; left:0; right:0; background:#DDEBE8; border-radius:5px 5px 2px 2px; }
.anoGasto { position:relative; width:100%; background:var(--accent); border-radius:5px 5px 2px 2px; min-height:2px; }
.anoGasto.futuro { background:#E1E9F0; }
.anoGasto.enCurso { background:var(--ink); }
.anoEtiqueta { font-size:9.5px; color:var(--soft); text-transform:capitalize; }
.anoEtiqueta.enCurso { color:var(--ink); font-weight:700; }

/* ── avisos de tope ──────────────────────────────────────────────────── */

.avisoTopes { border-left:4px solid var(--amber); }
.listaAvisos li { display:flex; align-items:center; gap:10px; padding:7px 2px; }
.avisoTexto { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
.avisoNombre { font-size:13.5px; font-weight:500; }
.avisoPie { font-size:11.5px; color:var(--soft); }

/* ── fila que lleva a otra pantalla ──────────────────────────────────── */

.filaAviso { display:flex; align-items:center; gap:12px; width:100%; text-align:left;
  justify-content:flex-start; background:#FFF9EF; border-left:4px solid var(--amber);
  border-radius:18px; padding:14px 16px; box-shadow:var(--sombra); }
.filaAviso .itemNota { color:#8A6212; }

.filaAjuste { display:flex; align-items:center; gap:12px; width:100%; text-align:left;
  justify-content:flex-start; background:var(--card); border-radius:18px; padding:15px 17px;
  box-shadow:var(--sombra); transition:transform .12s; }
.filaAjuste:active { transform:scale(.99); }

.filaEditor { display:flex; align-items:center; gap:9px; }
.filaEditor .inputEuro { flex:1; }
.filaEditor .botonPrincipal { flex-shrink:0; padding:11px 16px; }

/* ── bienvenida ──────────────────────────────────────────────────────── */

.tituloBienvenida { font-family:'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif;
  font-weight:800; font-size:28px; letter-spacing:-.03em; line-height:1.15; margin:0; }
.bienvenida { max-width:520px; width:100%; margin:0 auto; }
/* La columna reparte el alto sobrante: sin esto, la tarjeta y los botones se
   estiran hasta el fondo de la pantalla. */
.bienvenida > * { flex:0 0 auto; }

.listaPres li { padding:9px 2px; }
.presFila { display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; font-size:13.5px; }
.presNombre { display:flex; align-items:center; gap:9px; font-weight:500; }
.presCifra { font-size:11.5px; color:var(--soft); }

.tip { background:var(--ink); color:#fff; padding:8px 11px; border-radius:10px;
  font-size:12px; display:flex; flex-direction:column; gap:2px; box-shadow:0 8px 24px rgba(21,41,60,.22); }

/* ── revisión del mes ────────────────────────────────────────────────── */

.tarjetaRevision { width:100%; display:flex; align-items:center; gap:13px; text-align:left;
  justify-content:flex-start; background:var(--ink); color:#fff; border-radius:18px;
  padding:16px 17px; box-shadow:var(--sombra); transition:transform .12s; }
.tarjetaRevision:active { transform:scale(.985); }
.revisionIcono { width:38px; height:38px; border-radius:13px; background:rgba(255,255,255,.12);
  display:flex; align-items:center; justify-content:center; color:var(--mint); flex-shrink:0; }
.revisionTexto { flex:1; display:flex; flex-direction:column; gap:2px; min-width:0; }
.revisionTitulo { font-family:'Bricolage Grotesque', sans-serif; font-weight:700; font-size:15.5px; }
.revisionPie { font-size:12px; color:rgba(255,255,255,.62); }

.pantallaCompleta { position:absolute; inset:0; z-index:70; background:var(--paper);
  overflow-y:auto; animation:aparecer .18s ease; }
.pantallaCaja { max-width:560px; margin:0 auto; padding:20px 14px 40px;
  display:flex; flex-direction:column; gap:14px; }
.pantallaCabecera { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
.pantallaTitulo { font-family:'Bricolage Grotesque', sans-serif; font-weight:800;
  font-size:26px; letter-spacing:-.03em; margin:2px 0 0; display:block; }
.navMes { display:flex; align-items:center; justify-content:space-between; gap:10px;
  background:#fff; border-radius:14px; padding:7px 9px; box-shadow:var(--sombra); }
.navMesTitulo { font-family:'Bricolage Grotesque', sans-serif; font-weight:700; font-size:15px;
  text-transform:capitalize; }

.notaMes { border-left:4px solid var(--soft); }
.notaMes.bien { border-left-color:var(--mint); background:linear-gradient(150deg, #E6F8F0 0%, #fff 62%); }
.notaMes.ok { border-left-color:var(--accent); background:linear-gradient(150deg, #E4F5F2 0%, #fff 62%); }
.notaMes.ojo { border-left-color:var(--amber); background:linear-gradient(150deg, #FFF4E2 0%, #fff 62%); }
.notaMes.mal { border-left-color:var(--coral); background:linear-gradient(150deg, #FFEDE9 0%, #fff 62%); }
.notaFila { display:flex; align-items:baseline; gap:7px; }
.notaCifra { font-family:'Bricolage Grotesque', sans-serif; font-weight:800; font-size:46px;
  line-height:1; letter-spacing:-.04em; }
.notaSobre { font-size:15px; color:var(--soft); }
.notaParcial { margin-left:auto; font-size:10.5px; letter-spacing:.07em; text-transform:uppercase;
  color:var(--soft); background:#fff; border-radius:99px; padding:4px 10px; font-weight:600; }
.notaTitular { font-family:'Bricolage Grotesque', sans-serif; font-weight:700; font-size:18px;
  line-height:1.3; letter-spacing:-.02em; margin:12px 0 0; }
.notaPie { font-size:11.5px; color:var(--soft); margin:9px 0 0; line-height:1.5; }

.listaHallazgos { display:flex; flex-direction:column; gap:12px; }
.hallazgo { display:flex; gap:11px; align-items:flex-start; }
.hallazgoIcono { width:28px; height:28px; border-radius:9px; display:flex; align-items:center;
  justify-content:center; flex-shrink:0; background:#EDF2F7; color:var(--soft); }
.hallazgo.ojo .hallazgoIcono { background:#FFF4E2; color:#D98A0B; }
.hallazgo.bien .hallazgoIcono { background:#DFF6EB; color:#0E8A5F; }
.hallazgo.consejo .hallazgoIcono { background:#E4F5F2; color:var(--accent); }
.hallazgoTitulo { font-size:13.5px; font-weight:600; margin:0 0 3px; }
.hallazgoTexto { font-size:12.5px; color:var(--soft); line-height:1.55; margin:0; }
.cierre { background:var(--ink); }
.cierre p { color:#fff; font-size:14px; line-height:1.55; margin:0; }

/* ── formularios ─────────────────────────────────────────────────────── */

.campo { display:flex; flex-direction:column; gap:6px; }
.campo > span { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--soft); font-weight:600; }
.campo input, .anadirFila input, .catNombre, .campoAncho {
  background:#F7FAFC; border:1.5px solid var(--line); border-radius:11px;
  padding:11px 13px; font-size:14.5px; width:100%; transition:border-color .15s, background .15s; }
.campo input:focus, .anadirFila input:focus, .campoAncho:focus { background:#fff; border-color:var(--accent); outline:none; }
.inputEuro { position:relative; display:flex; align-items:center; }
.inputEuro input { padding-right:30px; font-family:'IBM Plex Mono', monospace;
  background:#F7FAFC; border:1.5px solid var(--line); border-radius:11px;
  padding-top:11px; padding-bottom:11px; padding-left:13px; font-size:14.5px; width:100%; }
.inputEuro input:focus { background:#fff; border-color:var(--accent); outline:none; }
.inputEuro > span { position:absolute; right:12px; color:var(--soft); font-size:13px; pointer-events:none; }
.inputEuro.mini { width:78px; flex-shrink:0; }
.inputEuro.mini input { padding:8px 20px 8px 9px; font-size:12.5px; text-align:right; border-radius:9px; }
.inputEuro.mini > span { right:8px; font-size:11px; }

.listaCat li { padding:5px 0; }
.catFila { display:flex; align-items:center; gap:9px; }
.catNombre { flex:1; min-width:0; border-color:transparent; background:transparent; padding:8px 9px; font-size:14px; }
.catNombre:hover { background:#F7FAFC; }
.borrarCat { width:30px; height:30px; border-radius:9px; color:#B6C6D3; flex-shrink:0; transition:all .14s; }
.borrarCat:hover { background:#FFEDE9; color:var(--coral); }

.editorIcono { margin:10px 0 6px; padding:13px; background:#F7FAFC; border-radius:14px; }
.rejillaIconos { display:grid; grid-template-columns:repeat(auto-fill, minmax(38px, 1fr)); gap:6px; margin-bottom:12px; }
.opIcono { width:100%; aspect-ratio:1; border-radius:10px; background:#fff; color:var(--soft);
  box-shadow:0 1px 2px rgba(21,41,60,.06); transition:transform .1s; }
.opIcono:active { transform:scale(.92); }
.opIcono.sel { box-shadow:0 2px 8px rgba(21,41,60,.16); }

.anadirCat { margin-top:14px; padding-top:15px; border-top:1px solid var(--line); }
.colores { display:flex; flex-wrap:wrap; gap:7px; }
.colores.separadas { margin-top:11px; }
.swatch { width:24px; height:24px; border-radius:50%; border:2.5px solid transparent;
  box-shadow:0 1px 3px rgba(21,41,60,.14); transition:transform .12s; }
.swatch.elegido { border-color:var(--ink); transform:scale(1.14); }
.anadirFila { display:flex; gap:9px; align-items:center; }
.anadirFila input { flex:1; }

.confirmar { margin-top:12px; padding:14px; background:#FFEDE9; border-radius:14px; }
.confirmar p { font-size:12.5px; color:#B23E29; margin:0 0 11px; line-height:1.5; }
.confirmarBotones { display:flex; gap:9px; }
.confirmarBotones button { flex:1; margin-top:0; }
.nota { background:#F3F7FA; border-radius:12px; padding:11px 13px; font-size:12.5px;
  color:var(--soft); margin-bottom:16px; line-height:1.5; }

.botonPrincipal { background:var(--accent); color:#fff; font-size:14px; font-weight:600;
  padding:12px 20px; border-radius:12px; box-shadow:0 3px 10px rgba(15,158,142,.28);
  transition:opacity .15s, transform .1s; }
.botonPrincipal:hover:not(:disabled) { opacity:.92; }
.botonPrincipal:active:not(:disabled) { transform:scale(.98); }
.botonPrincipal:disabled { opacity:.4; cursor:default; box-shadow:none; }
.botonPrincipal.ancho { flex:1; }
.botonSecundario { width:100%; background:#F7FAFC; border:1.5px solid var(--line);
  padding:11px; border-radius:12px; font-size:13.5px; font-weight:500; transition:all .15s; }
.botonSecundario:hover { border-color:var(--accent); color:var(--accent); background:#fff; }
.botonSecundario.espaciado { margin-top:14px; }
.botonPeligro { background:#FFF5F3; border:1.5px solid #FBD9D1; color:var(--coral);
  padding:11px 16px; border-radius:12px; font-size:13.5px; font-weight:500; width:100%; margin-top:11px; }
.botonPeligro:hover { background:#FFEDE9; }
.accionesSecundarias { margin-top:18px; padding-top:16px; border-top:1px solid var(--line); }

.barra { display:flex; align-items:center; gap:4px; padding:9px 12px;
  padding-bottom:max(9px, env(safe-area-inset-bottom));
  background:#fff; flex-shrink:0; box-shadow:0 -2px 16px rgba(21,41,60,.06); }
.pestana { flex:1; flex-direction:column; gap:3px; padding:8px 4px; font-size:10.5px;
  font-weight:600; border-radius:12px; color:var(--soft); transition:all .15s; }
.pestana.activa { color:var(--accent); background:#E7F6F4; }
.fab { width:48px; height:48px; border-radius:15px; background:var(--accent); color:#fff;
  flex-shrink:0; margin-left:4px; box-shadow:0 4px 14px rgba(15,158,142,.4); transition:transform .12s; }
.fab:hover { transform:translateY(-2px); }
.fab:active { transform:scale(.93); }
/* El micrófono comparte forma con las flechas del mes y la lupa, pero con el
   color del acento: es una acción, no una navegación. */
.flecha.voz { color:var(--accent); }
.flecha.voz:hover { color:var(--accent); }

.velo { position:absolute; inset:0; background:rgba(21,41,60,.4); backdrop-filter:blur(2px);
  display:flex; align-items:flex-end; justify-content:center; z-index:80; animation:aparecer .18s ease; }
.hoja { width:100%; max-width:520px; background:var(--paper); border-radius:24px 24px 0 0;
  padding:10px 18px 20px; padding-bottom:max(20px, env(safe-area-inset-bottom));
  max-height:94%; overflow-y:auto; animation:subir .24s cubic-bezier(.2,.8,.3,1); }
.tirador { width:38px; height:4px; background:#D3DFE9; border-radius:99px; margin:0 auto 14px; }
.hojaCabecera { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
/* 40 y no 34: es el botón de cerrar de todas las hojas y se toca a menudo. */
.cerrar { width:40px; height:40px; border-radius:50%; color:var(--soft); background:#fff; box-shadow:var(--sombra); flex-shrink:0; }
.cerrar:hover { color:var(--ink); }

.importeZona { display:flex; align-items:baseline; justify-content:center; gap:5px; padding:18px 0 22px; }
.importeZona.compacta { padding:6px 0 18px; }
.importeInput { font-family:'Bricolage Grotesque', sans-serif !important; font-weight:800;
  font-size:48px; letter-spacing:-.045em; text-align:right; border:none; background:none;
  width:auto; max-width:55%; padding:0; outline:none; font-variant-numeric:tabular-nums; }
.importeInput::placeholder { color:#C3D2DE; }
.importeInput::-webkit-outer-spin-button, .importeInput::-webkit-inner-spin-button { -webkit-appearance:none; margin:0; }
.importeInput[type=number] { -moz-appearance:textfield; }
.importeMoneda { font-family:'Bricolage Grotesque', sans-serif; font-weight:700; font-size:29px; color:var(--soft); }
.porMes { font-size:12.5px; color:var(--soft); margin-left:7px; }

.bloque { margin-bottom:18px; }
.etiquetaCampo { font-size:11px; letter-spacing:.08em; text-transform:uppercase;
  color:var(--soft); font-weight:600; display:block; margin-bottom:9px; }
.chips { display:flex; flex-wrap:wrap; gap:8px; }
.chipCat { padding:9px 14px; border-radius:99px; font-size:13px; font-weight:500;
  border:1.5px solid var(--line); background:#fff; gap:6px; transition:transform .1s; }
.chipCat.sel { color:#fff; font-weight:600; box-shadow:0 3px 10px rgba(21,41,60,.16); }
.chipCat:active { transform:scale(.95); }
.dosColumnas { display:grid; grid-template-columns:1fr 1fr; gap:11px; }
.hojaAcciones { display:flex; gap:9px; align-items:stretch; }
.hojaAcciones .botonPeligro { margin-top:0; width:auto; padding:12px 17px; flex-shrink:0; }

.cargando { flex:1; display:flex; flex-direction:column; align-items:center;
  justify-content:center; gap:15px; color:var(--soft); font-size:13.5px; }
.spinner { width:28px; height:28px; border:3px solid var(--line);
  border-top-color:var(--accent); border-radius:50%; animation:girar .7s linear infinite; }

@keyframes girar { to { transform:rotate(360deg); } }
@keyframes subir { from { transform:translateY(100%); } to { transform:translateY(0); } }
@keyframes aparecer { from { opacity:0; } to { opacity:1; } }

@media (prefers-reduced-motion:reduce) {
  .gx *, .gx *::before, .gx *::after { animation-duration:.01ms !important; transition-duration:.01ms !important; }
}

@media (min-width:560px) {
  .lienzo { padding:4px 18px 28px; max-width:560px; width:100%; margin:0 auto; }
  .cabecera, .barra { max-width:560px; width:100%; margin:0 auto; }
}

/* ── ordenador: dos columnas y barra flotante ────────────────────────── */
@media (min-width:960px) {
  .lienzo {
    max-width:1000px; display:grid; align-content:start;
    grid-template-columns:1fr 1fr; gap:16px; padding:8px 24px 120px;
  }
  .hero, .anchoCompleto, .tarjetaRevision, .filaAjuste, .filaAviso { grid-column:1 / -1; }
  /* La bienvenida es una columna de preguntas: en dos columnas se leería en zigzag. */
  .lienzo.bienvenida { display:flex; max-width:520px; padding-bottom:48px; }
  .cabecera { max-width:1000px; padding:18px 24px 14px; }
  .aviso { max-width:1000px; margin:0 auto 6px; }
  .barra {
    position:fixed; left:50%; bottom:20px; transform:translateX(-50%);
    width:auto; max-width:none; border-radius:20px; padding:8px 10px;
    box-shadow:0 10px 34px rgba(21,41,60,.16); gap:6px;
  }
  .pestana { flex-direction:row; gap:8px; padding:10px 18px; font-size:13px; }
  .fab { width:44px; height:44px; }
  .velo { align-items:center; }
  .hoja { border-radius:24px; max-height:88%; }
  .pantallaCaja { max-width:820px; display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .pantallaCabecera, .navMes, .notaMes, .cierre { grid-column:1 / -1; }
  .pantallaCaja > .botonSecundario, .pantallaCaja > .pie { grid-column:1 / -1; }
}
`;
