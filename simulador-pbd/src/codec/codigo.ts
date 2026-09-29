// Códigos de grupo (SPEC §6.2): PBD1-<payload>-<crc>
import LZString from 'lz-string';
import type { Datos, EstadoGrupo, RespuestaEvento } from '../model/types';

export const PREFIJO = 'PBD1';
export const LARGO_OBJETIVO = 1500;

/** Forma compacta: claves cortas, elecciones como cadena de letras en el orden del catálogo. */
interface Compacto {
  v: 1;
  c: string;
  s: string;
  a?: string;
  e: string;
  r: string;
  d?: [string, string, string, string, string, string];
  ev?: Record<string, [string, string, string, string?, string?]>;
  di?: [string, string[], string[], number];
  t: string;
}

/** Hash FNV-1a de 32 bits, 4 caracteres en base 36. */
export function crc(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).padStart(4, '0').slice(-4);
}

const idxDe = (datos: Datos) => datos.catalogo.decisiones.map((d) => d.id);
const aIndices = (ids: string[], orden: string[]) =>
  ids
    .map((id) => orden.indexOf(id))
    .filter((i) => i >= 0)
    .map((i) => i.toString(36))
    .join('');
const deIndices = (s: string, orden: string[]) => [...s].map((c) => orden[parseInt(c, 36)]).filter(Boolean);
const aLetras = (el: Record<string, string>, orden: string[]) => orden.map((id) => el[id] ?? '_').join('');
const deLetras = (s: string, orden: string[]) => Object.fromEntries(orden.map((id, i) => [id, s[i]]));

export function compactar(datos: Datos, st: EstadoGrupo): Compacto {
  const orden = idxDe(datos);
  const c: Compacto = { v: 1, c: st.cat, s: st.sector, e: aLetras(st.elecciones, orden), r: aIndices(st.revisadas, orden), t: st.ts };
  if (st.alias) c.a = st.alias;
  if (st.declaracion) {
    const d = st.declaracion;
    c.d = [d.prioriza[0], d.prioriza[1], d.sacrifica, d.justificacion, d.dificil.decision, d.dificil.texto];
  }
  const ids = Object.keys(st.eventos);
  if (ids.length) {
    c.ev = {};
    for (const id of ids) {
      const r = st.eventos[id];
      const t: [string, string, string, string?, string?] = [
        r.respuesta === 'mantenemos' ? 'm' : r.respuesta === 'cambiamos' ? 'c' : '',
        aIndices(r.decisiones, orden),
        r.texto,
      ];
      // «~» = sin checklist de evidencia; «» = checklist sin marcas.
      if (r.evidencia || r.eleccionesAntes) t.push(r.evidencia ? r.evidencia.join(',') : '~');
      if (r.eleccionesAntes) t.push(aLetras(r.eleccionesAntes, orden));
      c.ev[id] = t;
    }
  }
  if (st.dictamen) {
    const d = st.dictamen;
    c.di = [aIndices(d.marcadas, orden), d.riesgos, d.recomendaciones, d.revelado ? 1 : 0];
  }
  return c;
}

export function expandir(datos: Datos, c: Compacto): EstadoGrupo {
  const orden = idxDe(datos);
  const st: EstadoGrupo = {
    v: 1,
    cat: c.c,
    sector: c.s,
    elecciones: deLetras(c.e, orden),
    revisadas: deIndices(c.r ?? '', orden),
    eventos: {},
    ts: c.t,
  };
  if (c.a) st.alias = c.a;
  if (c.d) st.declaracion = { prioriza: [c.d[0], c.d[1]], sacrifica: c.d[2], justificacion: c.d[3], dificil: { decision: c.d[4], texto: c.d[5] } };
  for (const [id, t] of Object.entries(c.ev ?? {})) {
    const r: RespuestaEvento = { decisiones: deIndices(t[1], orden), texto: t[2] };
    if (t[0] === 'm') r.respuesta = 'mantenemos';
    if (t[0] === 'c') r.respuesta = 'cambiamos';
    if (t[3] !== undefined && t[3] !== '~') r.evidencia = t[3] ? t[3].split(',') : [];
    if (t[4]) r.eleccionesAntes = deLetras(t[4], orden);
    st.eventos[id] = r;
  }
  if (c.di) st.dictamen = { marcadas: deIndices(c.di[0], orden), riesgos: c.di[1], recomendaciones: c.di[2], revelado: c.di[3] === 1 };
  return st;
}

export function codificar(datos: Datos, st: EstadoGrupo): string {
  const payload = LZString.compressToEncodedURIComponent(JSON.stringify(compactar(datos, st)));
  return `${PREFIJO}-${payload}-${crc(payload)}`;
}

export type ErrorCodigo = { ok: false; motivo: 'formato' | 'crc' | 'version' | 'datos'; mensaje: string };
export type ResultadoCodigo = { ok: true; estado: EstadoGrupo } | ErrorCodigo;

/** Verifica que el estado decodificado sea coherente con el catálogo. */
export function verificarEstado(datos: Datos, st: EstadoGrupo): string | null {
  if (st.v !== 1) return 'versión de formato desconocida';
  if (!datos.sectores.sectores.some((s) => s.id === st.sector)) return `sector desconocido «${st.sector}»`;
  for (const d of datos.catalogo.decisiones) {
    if (!d.opciones.some((o) => o.id === st.elecciones?.[d.id])) return `elección inválida en ${d.id}`;
  }
  return null;
}

export function decodificar(datos: Datos, codigo: string): ResultadoCodigo {
  // Zoom o el correo pueden partir el código en líneas o cambiar «+» por espacio.
  const limpio = codigo.trim().replace(/\s+/g, '');
  const m = /^([A-Za-z0-9]+)-(.+)-([0-9A-Za-z]{4})$/.exec(limpio);
  if (!m) return { ok: false, motivo: 'formato', mensaje: 'No tiene el formato PBD1-…-xxxx. ¿Se copió completo?' };
  if (m[1] !== PREFIJO) return { ok: false, motivo: 'version', mensaje: `Código de otra versión («${m[1]}»); esta app lee ${PREFIJO}.` };
  if (crc(m[2]) !== m[3])
    return { ok: false, motivo: 'crc', mensaje: 'El código está alterado o incompleto (falla la verificación). Pídanle al grupo que lo copie de nuevo.' };
  let c: Compacto;
  try {
    const json = LZString.decompressFromEncodedURIComponent(m[2]);
    if (!json) throw new Error('vacío');
    c = JSON.parse(json);
  } catch {
    return { ok: false, motivo: 'formato', mensaje: 'No se pudo descomprimir el código.' };
  }
  if (c.v !== 1) return { ok: false, motivo: 'version', mensaje: `Versión de formato desconocida (${String(c.v)}).` };
  if (c.c !== datos.catalogo.version)
    return { ok: false, motivo: 'version', mensaje: `El código se generó con el catálogo ${c.c}; esta app usa el ${datos.catalogo.version}.` };
  const st = expandir(datos, c);
  const problema = verificarEstado(datos, st);
  if (problema) return { ok: false, motivo: 'datos', mensaje: `Datos incoherentes: ${problema}.` };
  return { ok: true, estado: st };
}

/** Lee un archivo JSON de grupo (SPEC §6.3). */
export function leerArchivo(datos: Datos, texto: string): ResultadoCodigo {
  let st: EstadoGrupo;
  try {
    st = JSON.parse(texto);
  } catch {
    return { ok: false, motivo: 'formato', mensaje: 'El archivo no es un JSON válido.' };
  }
  if (!st || typeof st !== 'object') return { ok: false, motivo: 'formato', mensaje: 'El archivo no contiene un estado de grupo.' };
  if (st.v !== 1) return { ok: false, motivo: 'version', mensaje: 'Versión de formato desconocida.' };
  if (st.cat !== datos.catalogo.version)
    return { ok: false, motivo: 'version', mensaje: `El archivo se generó con el catálogo ${st.cat}; esta app usa el ${datos.catalogo.version}.` };
  st.revisadas ??= [];
  st.eventos ??= {};
  const problema = verificarEstado(datos, st);
  if (problema) return { ok: false, motivo: 'datos', mensaje: `Datos incoherentes: ${problema}.` };
  return { ok: true, estado: st };
}
