import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { INDICADORES, MAX_TEXTO } from '../model/types';
import type { Datos, Decision, EstadoGrupo, IndicadorId, Opcion, TipoNorma, ZonaId } from '../model/types';
import { DATOS } from '../model/datos';
import type { Indicadores } from '../engine/indicadores';

// ---------------- Contexto de la vista ----------------

export interface Ctx {
  datos: Datos;
  estado: EstadoGrupo;
  /** null = solo lectura (Modos A y B). */
  cambiar: ((f: (s: EstadoGrupo) => EstadoGrupo) => void) | null;
  anotaciones: boolean;
  /** Ocultar zonas (modo dictamen antes de «Revelar zonas»). */
  zonasOcultas: boolean;
  irADecision: (id: string) => void;
}

export const VistaCtx = createContext<Ctx | null>(null);
export function useVista(): Ctx {
  const c = useContext(VistaCtx);
  if (!c) throw new Error('Falta VistaCtx');
  return c;
}

export const decisionDe = (id: string, datos: Datos = DATOS): Decision => datos.catalogo.decisiones.find((d) => d.id === id)!;

/** Letra de la opción elegida en una decisión. */
export function useOp(id: string): string {
  return useVista().estado.elecciones[id];
}

export function opcionDe(datos: Datos, decId: string, opId: string): Opcion | undefined {
  return decisionDe(decId, datos).opciones.find((o) => o.id === opId);
}

export const nombreIndicador = (id: IndicadorId, datos: Datos = DATOS) => datos.catalogo.indicadores.find((i) => i.id === id)!.nombre;

// ---------------- Zonas ----------------

export function IconoZona({ zona }: { zona: ZonaId }) {
  if (zona === 'R')
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="3.6" y1="12.4" x2="12.4" y2="3.6" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  if (zona === 'A')
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 2v12M4 14h8M2 5h12M4 5l-2.5 5h5zM12 5l-2.5 5h5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.18" />
      <path d="M4 8.5l2.6 2.6L12 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Zona({ zona, oculta = false, corta = false }: { zona: ZonaId; oculta?: boolean; corta?: boolean }) {
  if (oculta) return <span className="zona zona-oculta">Zona oculta</span>;
  const z = DATOS.catalogo.zonas[zona];
  return (
    <span className={`zona zona-${zona}`} title={z.descripcion}>
      <IconoZona zona={zona} />
      {corta ? zona : z.nombre}
    </span>
  );
}

const TIPO_NORMA: Record<TipoNorma, string> = {
  'obligacion-peru': 'Obligación Perú',
  'referencia-ue': 'Referencia UE',
  estandar: 'Estándar',
  'buena-practica': 'Buena práctica',
};

export function Normas({ dec }: { dec: Decision }) {
  return (
    <ul className="normas">
      {dec.normas.map((n) => (
        <li key={n.ref}>
          <span className={`tipo-norma tipo-${n.tipo}`}>{TIPO_NORMA[n.tipo]}</span>
          <span>
            {n.ref} {n.verificar && <span className="verificar">⚠️ verificar</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export const tipoNorma = (t: TipoNorma) => TIPO_NORMA[t];

// ---------------- Anotaciones del docente (SPEC §3.4) ----------------

export function Anota({ id }: { id: string }) {
  const { anotaciones, datos, estado } = useVista();
  if (!anotaciones) return null;
  const op = opcionDe(datos, id, estado.elecciones[id]);
  return (
    <span className="anota" role="note">
      {id}
      {op?.patronOscuro && <em>{op.patronOscuro}</em>}
    </span>
  );
}

// ---------------- Indicadores ----------------

export function BarrasIndicadores({ ind, zonasOcultas, alIr }: { ind: Indicadores; zonasOcultas?: boolean; alIr?: (id: string) => void }) {
  const previo = useRef<Record<IndicadorId, number> | null>(null);
  const [fantasma, setFantasma] = useState<Record<IndicadorId, number> | null>(null);
  const clave = INDICADORES.map((i) => ind.valor[i]).join(',');
  useEffect(() => {
    if (previo.current && previo.current !== null) {
      const cambio = INDICADORES.some((i) => previo.current![i] !== ind.valor[i]);
      if (cambio) setFantasma(previo.current);
    }
    previo.current = { ...ind.valor };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
  const hayEventos = INDICADORES.some((i) => ind.deltasEventos[i] !== 0);
  return (
    <div className="indicadores" aria-live="polite">
      {DATOS.catalogo.indicadores.map(({ id, nombre, descripcion }) => {
        const v = ind.valor[id];
        const b = ind.base[id];
        const desde = Math.min(v, b);
        const ancho = Math.abs(b - v);
        return (
          <div className="ind" key={id}>
            <div className="ind-cab" title={descripcion}>
              <strong>
                {id} · {nombre}
              </strong>
              <span className="ind-valor">{v}</span>
            </div>
            <div className="barra-ind" role="img" aria-label={`${nombre}: ${v} de 100${v !== b ? `; sin eventos: ${b}` : ''}`}>
              <div className="relleno" style={{ width: `${desde}%` }} />
              {ancho > 0 && <div className="evento" style={{ left: `${desde}%`, width: `${ancho}%` }} />}
              {fantasma && fantasma[id] !== v && <div className="fantasma" style={{ left: `calc(${fantasma[id]}% - 1px)` }} title={`Antes: ${fantasma[id]}`} />}
            </div>
            {v !== b && <span className="pequeno muted">Configuración: {b} · eventos: {v - b > 0 ? '+' : ''}{v - b}</span>}
            {id === 'EL' && !zonasOcultas && ind.incumplimiento.length > 0 && (
              <span className="incumple">
                ⛔ Incumplimiento ({ind.incumplimiento.length}):{' '}
                {ind.incumplimiento.map((d, i) => (
                  <span key={d}>
                    {i > 0 && ' · '}
                    {alIr ? (
                      <button type="button" className="btn-link" onClick={() => alIr(d)}>
                        {d}
                      </button>
                    ) : (
                      d
                    )}
                  </span>
                ))}
              </span>
            )}
          </div>
        );
      })}
      <p className="leyenda">
        {fantasma && <>▏marca: valor anterior. </>}
        {hayEventos && (
          <>
            <span className="leyenda-evento" /> efecto de eventos.{' '}
          </>
        )}
        Valores de diseño docente para discutir trade-offs; no son una medición real.
      </p>
    </div>
  );
}

// ---------------- Utilidades de UI ----------------

export function TextoLimitado({
  valor,
  cambiar,
  etiqueta,
  max = MAX_TEXTO,
  filas = 3,
  deshabilitado,
}: {
  valor: string;
  cambiar: (v: string) => void;
  etiqueta: string;
  max?: number;
  filas?: number;
  deshabilitado?: boolean;
}) {
  const n = [...valor].length;
  return (
    <label className="col" style={{ gap: 4 }}>
      <span style={{ fontWeight: 600 }}>{etiqueta}</span>
      <textarea
        className="texto"
        rows={filas}
        value={valor}
        disabled={deshabilitado}
        onChange={(e) => cambiar([...e.target.value].slice(0, max).join(''))}
      />
      <span className={`contador-car ${n >= max ? 'lleno' : ''}`}>
        {n}/{max}
      </span>
    </label>
  );
}

export function Confirmar({ texto, si, no, etiquetaSi = 'Sí, continuar' }: { texto: ReactNode; si: () => void; no: () => void; etiquetaSi?: string }) {
  return (
    <div className="modal-fondo" role="dialog" aria-modal="true">
      <div className="modal">
        <div style={{ marginBottom: 14 }}>{texto}</div>
        <div className="fila" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={no} autoFocus>
            Cancelar
          </button>
          <button className="btn btn-peligro" onClick={si}>
            {etiquetaSi}
          </button>
        </div>
      </div>
    </div>
  );
}

let avisar: (t: string) => void = () => {};
export function Toast() {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    let h: ReturnType<typeof setTimeout>;
    avisar = (x) => {
      setT(x);
      clearTimeout(h);
      h = setTimeout(() => setT(null), 2200);
    };
  }, []);
  return t ? (
    <div className="toast" role="status">
      {t}
    </div>
  ) : null;
}
export const toast = (t: string) => avisar(t);

export async function copiar(texto: string, aviso = 'Copiado al portapapeles'): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    toast(aviso);
    return true;
  } catch {
    // Respaldo para file:// y navegadores sin permiso de portapapeles.
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    toast(ok ? aviso : 'No se pudo copiar: selecciona el texto y usa Ctrl+C');
    return ok;
  }
}

export function descargar(nombre: string, contenido: string, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------- localStorage (siempre con try/catch) ----------------

export const almacen = {
  fallo: false,
  leer<T>(clave: string): T | null {
    try {
      const v = localStorage.getItem(clave);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      almacen.fallo = true;
      return null;
    }
  },
  guardar(clave: string, valor: unknown): boolean {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch {
      almacen.fallo = true;
      return false;
    }
  },
  borrar(clave: string) {
    try {
      localStorage.removeItem(clave);
    } catch {
      almacen.fallo = true;
    }
  },
};

export const hhmm = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '--:--' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const fechaHora = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
};
