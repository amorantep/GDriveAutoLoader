// Motor de indicadores (SPEC §5). Funciones puras: reciben los datos y el estado, no leen nada global.
import { INDICADORES } from '../model/types';
import type { Datos, Decision, Efectos, EstadoGrupo, Evento, IndicadorId, Opcion, Sector } from '../model/types';

/** Constante de escala única del motor. Calibrada para las pruebas de docs/PLAN.md. */
export const K = 1;

export type Valores = Record<IndicadorId, number>;

export const ceros = (): Valores => ({ RT: 0, EL: 0, UO: 0, CI: 0, AC: 0, RP: 0 });

/**
 * Redondeo «mitad al par» (redondeo bancario). Con los pesos 0,5 / 1 / 1,5 aparecen valores x,5;
 * las cifras de calibración del PLAN solo cuadran con esta regla (p. ej. 0,5 → 0 y 49,5 → 50).
 */
export function redondear(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}

export const clamp = (x: number) => Math.max(0, Math.min(100, x));

export function buscarSector(datos: Datos, sectorId: string): Sector {
  const s = datos.sectores.sectores.find((x) => x.id === sectorId);
  if (!s) throw new Error(`Sector desconocido: ${sectorId}`);
  return s;
}

/** peso(sector, ind) = pesos[sector.pesos[ind]]; «usaPesosDe» toma los pesos de otro sector. */
export function pesosSector(datos: Datos, sectorId: string): Valores {
  let s = buscarSector(datos, sectorId);
  if (s.usaPesosDe) s = buscarSector(datos, s.usaPesosDe);
  const out = ceros();
  for (const i of INDICADORES) out[i] = datos.sectores.pesos[s.pesos![i]];
  return out;
}

/** efecto(op, sector) = op.efectos con op.ajustesSector[sector] superpuesto (reemplaza, no suma). */
export function efectoOpcion(op: Opcion, sectorId: string): Efectos {
  return { ...op.efectos, ...(op.ajustesSector?.[sectorId] ?? {}) } as Efectos;
}

export function opcionElegida(dec: Decision, elecciones: Record<string, string>): Opcion {
  const op = dec.opciones.find((o) => o.id === elecciones[dec.id]);
  if (!op) throw new Error(`Elección inválida en ${dec.id}: ${elecciones[dec.id]}`);
  return op;
}

export function eleccionesModo(datos: Datos, modo: 'A' | 'B'): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of datos.catalogo.decisiones) out[d.id] = d.opciones.find((o) => o.modo === modo)!.id;
  return out;
}

/**
 * SPEC §2 dice que el Taller «parte del Modo A», pero SPEC §4.1 rotula las decisiones no núcleo como
 * «preconfiguradas en el estado B». Con true, el grupo parte con las núcleo en A y las demás en B;
 * con false, las 18 parten en A. Decisión pendiente del docente.
 */
export const OTRAS_PRECONFIGURADAS_EN_B = true;

/** Elecciones iniciales del taller: Modo A (ver constante anterior), o el preset del sector (p. ej. «cliente-minero»). */
export function eleccionesIniciales(datos: Datos, sectorId: string): Record<string, string> {
  const s = buscarSector(datos, sectorId);
  if (s.configuracionInicial) return { ...datos.sectores.presets[s.configuracionInicial].elecciones };
  const a = eleccionesModo(datos, 'A');
  if (!OTRAS_PRECONFIGURADAS_EN_B) return a;
  const b = eleccionesModo(datos, 'B');
  return Object.fromEntries(datos.catalogo.decisiones.map((d) => [d.id, d.nucleo ? a[d.id] : b[d.id]]));
}

/** base[ind] = 50 + K × Σ peso(sector, ind) × efecto(opElegida, sector)[ind] (sin redondear). */
export function calcularBase(datos: Datos, elecciones: Record<string, string>, sectorId: string): Valores {
  const pesos = pesosSector(datos, sectorId);
  const out = ceros();
  for (const i of INDICADORES) out[i] = 50;
  for (const dec of datos.catalogo.decisiones) {
    const ef = efectoOpcion(opcionElegida(dec, elecciones), sectorId);
    for (const i of INDICADORES) out[i] += K * pesos[i] * ef[i];
  }
  return out;
}

/** Decisiones cuya opción elegida está en zona roja. */
export function incumplimientos(datos: Datos, elecciones: Record<string, string>): string[] {
  return datos.catalogo.decisiones.filter((d) => opcionElegida(d, elecciones).zona === 'R').map((d) => d.id);
}

export function hayIncumplimiento(datos: Datos, elecciones: Record<string, string>): boolean {
  return incumplimientos(datos, elecciones).length > 0;
}

// ---------------- Eventos ----------------

export interface ResultadoEvento {
  evento: Evento;
  delta: Valores;
  /** Reglas que aplicaron, en texto legible. */
  detalles: { texto: string; delta: Partial<Efectos> }[];
  /** Ítems del dossier (EV-02). */
  dossier?: string[];
  /** Evidencia faltante (EV-04). */
  faltantes?: { id: string; etiqueta: string }[];
  /** Decisiones reabiertas (EV-05) que el grupo cambió después del evento. */
  cambiadasTras?: string[];
  /** Ninguna regla aplicó y el evento tiene mensajeSinDatos. */
  mensajeSinDatos?: string;
}

const suma = (acc: Valores, d: Partial<Efectos>, veces = 1) => {
  for (const [k, v] of Object.entries(d)) acc[k as IndicadorId] += (v as number) * veces;
};

export function buscarEvento(datos: Datos, id: string): Evento | undefined {
  return datos.eventos.eventos.find((e) => e.id === id);
}

export function eventoPorCodigo(datos: Datos, codigo: string): Evento | undefined {
  const c = codigo.trim().toUpperCase();
  return datos.eventos.eventos.find((e) => e.codigo.toUpperCase() === c);
}

export function dossier(evento: Evento, elecciones: Record<string, string>): string[] {
  return (evento.dossier ?? []).filter((r) => r.opciones.includes(elecciones[r.decision])).map((r) => r.item);
}

/** Lo que el sistema aún conserva de Lucía (EV-02) según las elecciones. */
export function dossierEV02(datos: Datos, elecciones: Record<string, string>): string[] {
  const ev = buscarEvento(datos, 'EV-02');
  return ev ? dossier(ev, elecciones) : [];
}

/**
 * Efecto de un evento sobre unas elecciones.
 * @param elecciones  las elecciones con las que «ocurrió» el evento (normalmente la foto al desbloquearlo)
 * @param evidencia   evidencia marcada por el grupo (EV-04)
 * @param actuales    elecciones actuales, para saber qué decisiones reabiertas cambió el grupo (EV-05)
 */
export function efectoEvento(
  datos: Datos,
  evento: Evento,
  elecciones: Record<string, string>,
  evidencia: string[] = [],
  actuales?: Record<string, string>,
): ResultadoEvento {
  const delta = ceros();
  const detalles: ResultadoEvento['detalles'] = [];
  const res: ResultadoEvento = { evento, delta, detalles };
  for (const r of evento.efectos ?? []) {
    if (r.opciones.includes(elecciones[r.decision])) {
      suma(delta, r.delta);
      const dec = datos.catalogo.decisiones.find((d) => d.id === r.decision)!;
      const op = dec.opciones.find((o) => o.id === elecciones[r.decision])!;
      detalles.push({ texto: `${dec.id} · ${op.etiqueta}`, delta: r.delta });
    }
  }
  if (evento.dossier) {
    res.dossier = dossier(evento, elecciones);
    if (evento.efectoPorItem) suma(delta, evento.efectoPorItem, res.dossier.length);
  }
  if (evento.checklistEvidencia) {
    res.faltantes = evento.checklistEvidencia.filter((c) => !evidencia.includes(c.id));
    if (evento.efectoPorFaltante) suma(delta, evento.efectoPorFaltante, res.faltantes.length);
  }
  if (evento.reabre && actuales) res.cambiadasTras = evento.reabre.filter((d) => actuales[d] !== elecciones[d]);
  if (evento.mensajeSinDatos && evento.efectos && detalles.length === 0) res.mensajeSinDatos = evento.mensajeSinDatos;
  return res;
}

/** Aplica todos los eventos desbloqueados por el grupo. */
export function aplicarEventos(datos: Datos, estado: EstadoGrupo): { total: Valores; porEvento: Record<string, ResultadoEvento> } {
  const total = ceros();
  const porEvento: Record<string, ResultadoEvento> = {};
  for (const [id, r] of Object.entries(estado.eventos)) {
    const ev = buscarEvento(datos, id);
    if (!ev) continue;
    const res = efectoEvento(datos, ev, r.eleccionesAntes ?? estado.elecciones, r.evidencia ?? [], estado.elecciones);
    porEvento[id] = res;
    suma(total, res.delta);
  }
  return { total, porEvento };
}

export interface Indicadores {
  /** Valores de la configuración, sin eventos (0–100, redondeados). */
  base: Valores;
  /** valor[ind] = clamp(0, 100, round(base + Σ deltas de eventos)). */
  valor: Valores;
  deltasEventos: Valores;
  incumplimiento: string[];
}

export function calcularIndicadores(datos: Datos, estado: Pick<EstadoGrupo, 'elecciones' | 'eventos'>, sectorId: string): Indicadores {
  const bruto = calcularBase(datos, estado.elecciones, sectorId);
  const { total } = aplicarEventos(datos, { eventos: estado.eventos, elecciones: estado.elecciones } as EstadoGrupo);
  const base = ceros();
  const valor = ceros();
  for (const i of INDICADORES) {
    base[i] = clamp(redondear(bruto[i]));
    valor[i] = clamp(redondear(bruto[i] + total[i]));
  }
  return { base, valor, deltasEventos: total, incumplimiento: incumplimientos(datos, estado.elecciones) };
}

export function estadoNuevo(datos: Datos, sectorId: string): EstadoGrupo {
  return {
    v: 1,
    cat: datos.catalogo.version,
    sector: sectorId,
    elecciones: eleccionesIniciales(datos, sectorId),
    revisadas: [],
    eventos: {},
    dictamen: buscarSector(datos, sectorId).modoDictamen
      ? { marcadas: [], riesgos: ['', '', ''], recomendaciones: ['', '', ''], revelado: false }
      : undefined,
    ts: new Date().toISOString(),
  };
}

export function declaracionCompleta(estado: EstadoGrupo): boolean {
  const d = estado.declaracion;
  return !!(
    d &&
    d.prioriza[0] &&
    d.prioriza[1] &&
    d.prioriza[0] !== d.prioriza[1] &&
    d.sacrifica &&
    !d.prioriza.includes(d.sacrifica) &&
    d.justificacion.trim() &&
    d.dificil.decision &&
    d.dificil.texto.trim()
  );
}

/** Cuántas de las respuestas ocultas del preset marcó el grupo como riesgo legal. */
export function aciertosDictamen(datos: Datos, estado: EstadoGrupo): { encontradas: number; total: number } {
  const s = buscarSector(datos, estado.sector);
  const ocultas = s.configuracionInicial ? datos.sectores.presets[s.configuracionInicial].respuestasOcultas : [];
  const marcadas = estado.dictamen?.marcadas ?? [];
  return { encontradas: ocultas.filter((d) => marcadas.includes(d)).length, total: ocultas.length };
}
