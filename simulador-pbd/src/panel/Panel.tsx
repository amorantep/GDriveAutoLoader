// Panel del DPO (SPEC §4.1 y §4.2).
import { useMemo, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { BarrasIndicadores, Normas, Zona, decisionDe, useVista } from '../ui/comun';
import { calcularIndicadores, opcionElegida } from '../engine/indicadores';
import type { Decision } from '../model/types';

export interface Pestana {
  id: string;
  titulo: string;
  badge?: number;
  contenido: ReactNode;
}

export function Panel({
  activa,
  setActiva,
  pestanas = [],
  pestana,
  setPestana,
  pieIzq,
  reabiertas = [],
}: {
  activa: string;
  setActiva: (id: string) => void;
  pestanas?: Pestana[];
  pestana: string;
  setPestana: (id: string) => void;
  pieIzq?: ReactNode;
  reabiertas?: string[];
}) {
  const { datos, estado, zonasOcultas } = useVista();
  const ind = useMemo(() => calcularIndicadores(datos, estado, estado.sector), [datos, estado]);
  const nucleo = datos.catalogo.decisiones.filter((d) => d.nucleo);
  const otras = datos.catalogo.decisiones.filter((d) => !d.nucleo);
  const revisadas = nucleo.filter((d) => estado.revisadas.includes(d.id)).length;
  const ir = (id: string) => {
    setActiva(id);
    setPestana('decision');
  };
  const activaEsOtra = otras.some((d) => d.id === activa);

  const item = (d: Decision) => {
    const op = opcionElegida(d, estado.elecciones);
    return (
      <button key={d.id} className={`item-dec ${reabiertas.includes(d.id) ? 'reabierta' : ''}`} aria-current={d.id === activa && pestana === 'decision'} onClick={() => ir(d.id)}>
        <span className="id">{d.id}</span>
        <span className="marcas">
          {d.nucleo && estado.revisadas.includes(d.id) && (
            <span className="tag-revisada" title="Revisada">
              ✓
            </span>
          )}
          {estado.dictamen?.marcadas.includes(d.id) && <span title="Marcada como riesgo legal">⚖️</span>}
          <span className={`dot dot-${zonasOcultas ? 'X' : op.zona}`} title={zonasOcultas ? 'Zona oculta' : datos.catalogo.zonas[op.zona].nombre} />
          <strong>{op.id.toUpperCase()}</strong>
        </span>
        <span className="tit">{d.titulo}</span>
      </button>
    );
  };

  return (
    <div className="panel">
      <aside className="panel-izq" aria-label="Decisiones">
        <div className="tarjeta" style={{ padding: '10px 12px' }}>
          <div className="pequeno" style={{ fontWeight: 700 }}>
            Decisiones núcleo revisadas: {revisadas}/{nucleo.length}
          </div>
        </div>
        <div className="lista-dec">
          <h4>
            Núcleo <span className="tag-nucleo">Núcleo</span>
          </h4>
          {nucleo.map(item)}
          <details className="otras" open={activaEsOtra || undefined}>
            <summary>Otras decisiones (preconfiguradas en el estado B)</summary>
            <div className="lista-dec">
              {datos.catalogo.modulos.map((m) => {
                const ds = otras.filter((d) => d.modulo === m.id);
                return ds.length ? <div key={m.id} className="lista-dec">{ds.map(item)}</div> : null;
              })}
            </div>
          </details>
        </div>
        {pieIzq}
      </aside>

      <main className="tarjeta" style={{ minWidth: 0 }}>
        {pestanas.length > 0 && (
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={pestana === 'decision'} onClick={() => setPestana('decision')}>
              Decisión
            </button>
            {pestanas.map((p) => (
              <button key={p.id} role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)}>
                {p.titulo}
                {!!p.badge && <span className="badge">{p.badge}</span>}
              </button>
            ))}
          </div>
        )}
        {pestana === 'decision' ? <VistaDecision dec={decisionDe(activa, datos)} reabierta={reabiertas.includes(activa)} /> : pestanas.find((p) => p.id === pestana)?.contenido}
      </main>

      <aside className="panel-der tarjeta" aria-label="Indicadores">
        <h3 style={{ fontSize: 17 }}>Indicadores</h3>
        <BarrasIndicadores ind={ind} zonasOcultas={zonasOcultas} alIr={ir} />
      </aside>
    </div>
  );
}

function VistaDecision({ dec, reabierta }: { dec: Decision; reabierta: boolean }) {
  const { datos, estado, cambiar, zonasOcultas } = useVista();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const op = opcionElegida(dec, estado.elecciones);
  const dim = datos.catalogo.dimensiones.find((x) => x.id === dec.dimension)!;
  const mod = datos.catalogo.modulos.find((x) => x.id === dec.modulo)!;
  const editable = !!cambiar;

  const elegir = (oid: string) => {
    if (!cambiar) return;
    cambiar((s) => ({
      ...s,
      elecciones: { ...s.elecciones, [dec.id]: oid },
      revisadas: dec.nucleo && !s.revisadas.includes(dec.id) ? [...s.revisadas, dec.id] : s.revisadas,
    }));
  };
  const teclado = (e: KeyboardEvent, i: number) => {
    const n = dec.opciones.length;
    let j = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % n;
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + n) % n;
    if (j >= 0) {
      e.preventDefault();
      refs.current[j]?.focus();
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      elegir(dec.opciones[i].id);
    }
  };
  const marcada = estado.dictamen?.marcadas.includes(dec.id) ?? false;
  const obligaciones = dec.normas.filter((n) => n.tipo === 'obligacion-peru').map((n) => n.ref);

  return (
    <div className="decision">
      {reabierta && <div className="evento-card" style={{ padding: '8px 12px' }}>🔁 Decisión reabierta por un evento: revisen si mantienen o cambian esta opción.</div>}
      <div className="fila" style={{ gap: 8 }}>
        <span className="tag-nucleo" style={{ fontSize: 14 }}>
          {dec.id}
        </span>
        {dec.nucleo && <span className="tag-nucleo">Núcleo</span>}
        <span className="muted pequeno">{mod.nombre}</span>
      </div>
      <h2 style={{ marginTop: 6 }}>{dec.titulo}</h2>
      <p className="pregunta">{dec.pregunta}</p>
      <div className="meta-dec">
        <span title={dim.pregunta}>
          <strong>Dimensión:</strong> {dim.nombre} — {dim.pregunta}
        </span>
      </div>

      <div className="opciones" role="radiogroup" aria-label={dec.pregunta}>
        {dec.opciones.map((o, i) => (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="radio"
            aria-checked={o.id === op.id}
            aria-readonly={!editable}
            tabIndex={o.id === op.id ? 0 : -1}
            className={`opcion ${zonasOcultas ? '' : `z-${o.zona}`}`}
            onClick={() => elegir(o.id)}
            onKeyDown={(e) => teclado(e, i)}
            style={editable ? undefined : { cursor: 'default' }}
          >
            <span className="letra">{o.id.toUpperCase()}</span>
            <span>
              {o.etiqueta}
              {(o.modo === 'A' || o.modo === 'B') && !zonasOcultas && <span className="modo-tag">Opción del Modo {o.modo}</span>}
            </span>
            <Zona zona={o.zona} oculta={zonasOcultas} />
          </button>
        ))}
      </div>
      {!editable && <p className="pequeno muted">Solo lectura: en el Taller los grupos pueden cambiar esta configuración.</p>}

      {!zonasOcultas && op.zona === 'R' && (
        <div className="alerta-roja" role="alert">
          ⛔ Esta opción incumple {obligaciones.length ? obligaciones.join('; ') : 'la base normativa de esta decisión'}.
        </div>
      )}
      {op.nota && <div className="nota-op">📝 {op.nota}</div>}
      {op.patronOscuro && !zonasOcultas && (
        <div className="nota-op">
          🕳️ <strong>Patrón oscuro:</strong> {op.patronOscuro}
        </div>
      )}
      {op.rrhh && (
        <div className="bloque caja-rrhh">
          <strong>Con esta configuración, RR. HH. ve:</strong> {op.rrhh}
        </div>
      )}

      {estado.dictamen && cambiar && (
        <label className="fila" style={{ margin: '10px 0', fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={marcada}
            onChange={(e) =>
              cambiar((s) => {
                const m = s.dictamen!.marcadas.filter((x) => x !== dec.id);
                return { ...s, dictamen: { ...s.dictamen!, marcadas: e.target.checked ? [...m, dec.id] : m } };
              })
            }
            style={{ width: 20, height: 20 }}
          />
          ⚖️ Marcar como riesgo legal
        </label>
      )}

      <div className="bloque">
        <h4>Base normativa</h4>
        <Normas dec={dec} />
      </div>
      <div className="bloque">
        <h4>Estrategias de Hoepman (privacy design strategies)</h4>
        <div className="fila" style={{ gap: 6 }}>
          {dec.hoepman.map((h) => (
            <span key={h} className="tipo-norma">
              {h}
            </span>
          ))}
        </div>
      </div>
      <details className="bloque">
        <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Criterio de aceptación y evidencia</summary>
        <p style={{ marginTop: 6 }}>{dec.criterio}</p>
        <p className="muted">
          <strong>Evidencia:</strong> {dec.evidencia}
        </p>
      </details>
    </div>
  );
}
