// Resumen imprimible del grupo (SPEC §8) y del tablero (SPEC §7.3). Genera HTML autocontenido.
import { INDICADORES } from '../model/types';
import type { Datos, EstadoGrupo } from '../model/types';
import { buscarSector, calcularIndicadores, opcionElegida, aciertosDictamen } from '../engine/indicadores';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ICONO = { R: '⛔', A: '⚖', V: '✓' } as const;
const fecha = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
};
const indNombre = (datos: Datos, id: string) => datos.catalogo.indicadores.find((i) => i.id === id)?.nombre ?? id;

const CSS = `
*{box-sizing:border-box}body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1b2430;margin:0;padding:8mm 9mm;font-size:9pt;line-height:1.25}
h1{font-size:14pt;margin:0 0 1.5mm;border-bottom:3px solid #00C2FF;padding-bottom:1.5mm}h2{font-size:10.5pt;margin:3mm 0 1.2mm}p{margin:0 0 1.2mm}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #c5ccd4;padding:.8mm 1.2mm;text-align:left;vertical-align:top}
th{background:#f4f6f8;font-size:7pt;text-transform:uppercase;letter-spacing:.2px}
.z{font-weight:700;white-space:nowrap}.zR{color:#b3261e}.zA{color:#7a4f00}.zV{color:#1b6e3a}
.meta{color:#4a5563}.chica{font-size:7.2pt}.vacia{width:30mm}
.barras{display:grid;grid-template-columns:repeat(6,1fr);gap:2.5mm}.b{font-size:8pt}.bb{height:2.2mm;background:#e3e7ec;position:relative;margin-top:.6mm}.bb span{position:absolute;left:0;top:0;bottom:0;background:#006a8e}
.nota{color:#4a5563;font-size:7.5pt;margin-top:1mm}
@page{size:A4;margin:0}
`;

export function nombreGrupo(datos: Datos, st: EstadoGrupo): string {
  const s = buscarSector(datos, st.sector);
  return st.alias ? `${st.alias} (${s.nombre})` : `Grupo ${s.grupo} · ${s.nombre}`;
}

function barras(datos: Datos, v: Record<string, number>) {
  return `<div class="barras">${INDICADORES.map(
    (i) => `<div class="b"><strong>${i}</strong> ${v[i]}<div class="bb"><span style="width:${v[i]}%"></span></div><div class="chica meta">${esc(indNombre(datos, i))}</div></div>`,
  ).join('')}</div>`;
}

export function resumenHTML(datos: Datos, st: EstadoGrupo): string {
  const s = buscarSector(datos, st.sector);
  const ind = calcularIndicadores(datos, st, st.sector);
  const hayEventos = Object.keys(st.eventos).length > 0;
  const filas = datos.catalogo.decisiones
    .map((d) => {
      const o = opcionElegida(d, st.elecciones);
      return `<tr><td class="chica"><strong>${d.id}</strong>${d.nucleo ? ' ·N' : ''}<br>${esc(d.titulo)}</td>
<td class="chica"><strong>${o.id.toUpperCase()}</strong> · ${esc(o.etiqueta)}</td>
<td class="z z${o.zona} chica">${ICONO[o.zona]} ${esc(datos.catalogo.zonas[o.zona].nombre)}</td>
<td class="chica">${d.normas.map((n) => esc(n.ref) + (n.verificar ? ' ⚠️' : '')).join('; ')}</td>
<td class="chica">${esc(d.hoepman.join(', '))}</td><td class="vacia"></td></tr>`;
    })
    .join('');
  const dcl = st.declaracion;
  const decl = dcl
    ? `<p><strong>Priorizamos:</strong> ${esc(indNombre(datos, dcl.prioriza[0]))} y ${esc(indNombre(datos, dcl.prioriza[1]))}. <strong>Sacrificamos:</strong> ${esc(indNombre(datos, dcl.sacrifica))}.</p>
<p><strong>Justificación:</strong> ${esc(dcl.justificacion)}</p><p><strong>Decisión más difícil (${esc(dcl.dificil.decision)}):</strong> ${esc(dcl.dificil.texto)}</p>`
    : '<p class="meta">Sin declaración de prioridades.</p>';
  const evs = Object.entries(st.eventos)
    .map(([id, r]) => {
      const ev = datos.eventos.eventos.find((e) => e.id === id);
      return `<tr><td><strong>${id}</strong> ${esc(ev?.titulo ?? '')}</td><td>${r.respuesta ? (r.respuesta === 'mantenemos' ? 'Mantenemos' : 'Cambiamos') : '—'}${r.decisiones.length ? ' · ' + r.decisiones.join(', ') : ''}</td><td>${esc(r.texto)}</td></tr>`;
    })
    .join('');
  let dict = '';
  if (st.dictamen) {
    const a = aciertosDictamen(datos, st);
    dict = `<h2>6. Dictamen</h2><p><strong>Marcadas como riesgo legal:</strong> ${st.dictamen.marcadas.join(', ') || '—'}${st.dictamen.revelado ? ` · Encontraron ${a.encontradas} de ${a.total}` : ''}</p>
<table><tr><th>Riesgos</th><th>Recomendaciones</th></tr>${[0, 1, 2]
      .map((i) => `<tr><td>${i + 1}. ${esc(st.dictamen!.riesgos[i] ?? '')}</td><td>${i + 1}. ${esc(st.dictamen!.recomendaciones[i] ?? '')}</td></tr>`)
      .join('')}</table>`;
  }
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resumen · ${esc(nombreGrupo(datos, st))}</title><style>${CSS}</style></head><body>
<h1>Simulador Privacy by Default · Resumen del grupo</h1>
<p class="meta"><strong>${esc(s.nombre)}</strong> · ${esc(s.organizacion)}${st.alias ? ` · Grupo: <strong>${esc(st.alias)}</strong>` : ''} · ${esc(fecha(st.ts))}</p>
<h2>1. Decisiones</h2>
<table><tr><th style="width:24mm">Decisión</th><th style="width:52mm">Opción elegida</th><th>Zona</th><th>Base normativa</th><th>Hoepman</th><th>Control y evidencia (se completa en S25)</th></tr>${filas}</table>
<p class="nota">·N = decisión núcleo. ⚠️ = plazo o referencia pendiente de verificar por el docente.</p>
<h2>2. Indicadores finales</h2>
${hayEventos ? '<p class="chica meta">Con eventos:</p>' + barras(datos, ind.valor) + '<p class="chica meta">Sin eventos (solo la configuración):</p>' : ''}${barras(datos, ind.base)}
<p class="nota">${ind.incumplimiento.length ? `⛔ Incumplimiento en: ${ind.incumplimiento.join(', ')}. ` : ''}Valores de diseño docente para discutir trade-offs; no son una medición real.</p>
<h2>3. Declaración de prioridades</h2>${decl}
<h2>4. Reacción a eventos</h2>${evs ? `<table><tr><th>Evento</th><th>Respuesta</th><th>Por qué</th></tr>${evs}</table>` : '<p class="meta">Sin eventos.</p>'}
${dict}
<p class="nota">Eventos y datos ficticios de la simulación. Esta herramienta no recoge datos personales.</p>
</body></html>`;
}

export function resumenTexto(datos: Datos, st: EstadoGrupo): string {
  const s = buscarSector(datos, st.sector);
  const ind = calcularIndicadores(datos, st, st.sector);
  const l: string[] = [];
  l.push(`RESUMEN · ${nombreGrupo(datos, st)} · ${fecha(st.ts)}`);
  l.push(`${s.organizacion}`);
  l.push('');
  l.push('DECISIONES');
  for (const d of datos.catalogo.decisiones) {
    const o = opcionElegida(d, st.elecciones);
    l.push(`${d.id} ${d.titulo}: ${o.id.toUpperCase()} · ${o.etiqueta} [${ICONO[o.zona]} ${datos.catalogo.zonas[o.zona].nombre}]`);
  }
  l.push('');
  l.push('INDICADORES: ' + INDICADORES.map((i) => `${i} ${ind.valor[i]}${ind.valor[i] !== ind.base[i] ? ` (sin eventos ${ind.base[i]})` : ''}`).join(' · '));
  if (ind.incumplimiento.length) l.push(`Incumplimiento: ${ind.incumplimiento.join(', ')}`);
  if (st.declaracion) {
    const d = st.declaracion;
    l.push('');
    l.push(`PRIORIZAMOS: ${indNombre(datos, d.prioriza[0])} y ${indNombre(datos, d.prioriza[1])} · SACRIFICAMOS: ${indNombre(datos, d.sacrifica)}`);
    l.push(`Justificación: ${d.justificacion}`);
    l.push(`Más difícil (${d.dificil.decision}): ${d.dificil.texto}`);
  }
  for (const [id, r] of Object.entries(st.eventos)) {
    l.push('');
    l.push(`EVENTO ${id}: ${r.respuesta ?? '—'}${r.decisiones.length ? ' · ' + r.decisiones.join(', ') : ''}`);
    if (r.texto) l.push(r.texto);
  }
  if (st.dictamen) {
    l.push('');
    l.push(`DICTAMEN · marcadas: ${st.dictamen.marcadas.join(', ') || '—'}`);
    st.dictamen.riesgos.forEach((r, i) => r && l.push(`Riesgo ${i + 1}: ${r}`));
    st.dictamen.recomendaciones.forEach((r, i) => r && l.push(`Recomendación ${i + 1}: ${r}`));
  }
  return l.join('\n');
}

export function tableroHTML(datos: Datos, grupos: EstadoGrupo[], todas: boolean): string {
  const decs = datos.catalogo.decisiones.filter((d) => todas || d.nucleo);
  const cab = decs.map((d) => `<th>${d.id}</th>`).join('');
  const filas = grupos
    .map((g) => {
      const ind = calcularIndicadores(datos, g, g.sector);
      return `<tr><td><strong>${esc(nombreGrupo(datos, g))}</strong></td>${decs
        .map((d) => {
          const o = opcionElegida(d, g.elecciones);
          return `<td class="z z${o.zona}" title="${esc(o.etiqueta)}">${ICONO[o.zona]} ${o.id.toUpperCase()}</td>`;
        })
        .join('')}<td class="chica">${INDICADORES.map((i) => `${i} ${ind.valor[i]}`).join(' · ')}</td></tr>`;
    })
    .join('');
  const decl = grupos
    .map((g) => {
      const d = g.declaracion;
      return `<tr><td><strong>${esc(nombreGrupo(datos, g))}</strong></td><td>${d ? `${d.prioriza.join(' + ')}` : '—'}</td><td>${d ? d.sacrifica : '—'}</td><td>${d ? esc(d.justificacion) : ''}</td></tr>`;
    })
    .join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Tablero comparativo</title><style>${CSS} @page{size:A4 landscape}</style></head><body>
<h1>Simulador Privacy by Default · Tablero comparativo</h1><p class="meta">${esc(new Date().toLocaleString('es-PE'))} · ${grupos.length} grupos</p>
<h2>Matriz de decisiones</h2><table><tr><th>Grupo</th>${cab}<th>Indicadores</th></tr>${filas}</table>
<h2>Declaraciones</h2><table><tr><th>Grupo</th><th>Prioriza</th><th>Sacrifica</th><th>Justificación</th></tr>${decl}</table>
<p class="nota">Valores de diseño docente para discutir trade-offs; no son una medición real. Datos ficticios.</p></body></html>`;
}
