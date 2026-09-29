// Pestañas del Taller: prioridades (§4.4), eventos (§4.5), dictamen (§4.3) y compartir (§6, §8).
import { useMemo, useState } from 'react';
import { INDICADORES, MAX_ALIAS } from '../model/types';
import type { Declaracion, EstadoGrupo, Sector } from '../model/types';
import { TextoLimitado, copiar, descargar, hhmm, nombreIndicador, toast, useVista } from '../ui/comun';
import { aciertosDictamen, buscarSector, calcularIndicadores, declaracionCompleta, efectoEvento, eventoPorCodigo } from '../engine/indicadores';
import { LARGO_OBJETIVO, codificar, decodificar } from '../codec/codigo';
import { resumenHTML, resumenTexto } from '../export/resumen';

// ---------------- Selección de sector ----------------
export function SelectorSector({ alElegir }: { alElegir: (s: string) => void }) {
  const { datos } = useVista();
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <h2>Taller · Elijan su sector</h2>
      <p className="muted">
        Cada grupo actúa como DPO (delegado de protección de datos) de una organización ficticia. El sector define el contexto y cuánto pesa cada indicador. No se puede cambiar después sin reiniciar el taller.
      </p>
      <div className="sector-grid">
        {datos.sectores.sectores.map((s) => (
          <TarjetaSector key={s.id} s={s} alElegir={alElegir} />
        ))}
      </div>
    </div>
  );
}

function TarjetaSector({ s, alElegir }: { s: Sector; alElegir: (s: string) => void }) {
  return (
    <button className="sector-card" onClick={() => alElegir(s.id)}>
      <span className="pequeno muted" style={{ fontWeight: 700 }}>
        Grupo {s.grupo}
        {s.opcional ? ' · opcional' : ''}
      </span>
      <strong style={{ fontSize: 20 }}>{s.nombre}</strong>
      <span style={{ fontWeight: 600 }}>{s.organizacion}</span>
      <span className="pequeno">{s.contexto}</span>
      <span className="peticion">
        <strong>{s.peticion.quien}:</strong> «{s.peticion.texto}»
      </span>
      {s.tarea && <span className="pequeno">{s.tarea}</span>}
      {s.decisionesTensas.length > 0 && <span className="pequeno muted">Decisiones en tensión: {s.decisionesTensas.join(' · ')}</span>}
    </button>
  );
}

export function BriefSector() {
  const { datos, estado } = useVista();
  const s = buscarSector(datos, estado.sector);
  return (
    <details className="tarjeta pequeno" style={{ padding: '8px 12px', marginTop: 10 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
        Brief: {s.nombre} (grupo {s.grupo})
      </summary>
      <p style={{ marginTop: 6 }}>{s.organizacion}</p>
      <p>{s.contexto}</p>
      <p>
        <strong>{s.peticion.quien}:</strong> «{s.peticion.texto}»
      </p>
      {s.tarea && <p>{s.tarea}</p>}
    </details>
  );
}

// ---------------- Declaración de prioridades ----------------
const VACIA: Declaracion = { prioriza: ['', ''], sacrifica: '', justificacion: '', dificil: { decision: '', texto: '' } };

export function Prioridades() {
  const { datos, estado, cambiar } = useVista();
  const d = estado.declaracion ?? VACIA;
  const set = (f: (d: Declaracion) => Declaracion) => cambiar?.((s) => ({ ...s, declaracion: f(s.declaracion ?? VACIA) }));
  const selInd = (valor: string, onCambio: (v: string) => void, excluir: string[], etiqueta: string) => (
    <label className="col" style={{ gap: 4 }}>
      <span style={{ fontWeight: 600 }}>{etiqueta}</span>
      <select className="texto" value={valor} onChange={(e) => onCambio(e.target.value)}>
        <option value="">— Elegir —</option>
        {INDICADORES.map((i) => (
          <option key={i} value={i} disabled={excluir.includes(i)}>
            {i} · {nombreIndicador(i)}
          </option>
        ))}
      </select>
    </label>
  );
  const completa = declaracionCompleta(estado);
  return (
    <div className="col">
      <h3>Declaración de prioridades</h3>
      <p className="muted pequeno">Es obligatoria antes de generar el código del grupo. No hay una respuesta única: expliquen su criterio.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        {selInd(d.prioriza[0], (v) => set((x) => ({ ...x, prioriza: [v, x.prioriza[1]] })), [d.prioriza[1], d.sacrifica], 'Priorizamos (1)')}
        {selInd(d.prioriza[1], (v) => set((x) => ({ ...x, prioriza: [x.prioriza[0], v] })), [d.prioriza[0], d.sacrifica], 'Priorizamos (2)')}
        {selInd(d.sacrifica, (v) => set((x) => ({ ...x, sacrifica: v })), d.prioriza, 'Sacrificamos')}
      </div>
      <TextoLimitado etiqueta="Justificación" valor={d.justificacion} cambiar={(v) => set((x) => ({ ...x, justificacion: v }))} />
      <label className="col" style={{ gap: 4 }}>
        <span style={{ fontWeight: 600 }}>La decisión más difícil</span>
        <select className="texto" value={d.dificil.decision} onChange={(e) => set((x) => ({ ...x, dificil: { ...x.dificil, decision: e.target.value } }))}>
          <option value="">— Elegir —</option>
          {datos.catalogo.decisiones.map((dd) => (
            <option key={dd.id} value={dd.id}>
              {dd.id} · {dd.titulo}
            </option>
          ))}
        </select>
      </label>
      <TextoLimitado etiqueta="¿Por qué fue la más difícil?" valor={d.dificil.texto} cambiar={(v) => set((x) => ({ ...x, dificil: { ...x.dificil, texto: v } }))} />
      <p className={completa ? 'ok' : 'muted'}>{completa ? '✓ Declaración completa.' : 'Completen todos los campos para poder generar el código.'}</p>
    </div>
  );
}

// ---------------- Eventos ----------------
export function Eventos() {
  const { datos, estado, cambiar } = useVista();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState(false);
  const ids = Object.keys(estado.eventos);
  const ingresar = () => {
    const ev = eventoPorCodigo(datos, codigo);
    if (!ev) return setError('Código no válido. Revisen el mensaje del docente.');
    if (estado.eventos[ev.id]) return setError('Ese evento ya está desbloqueado.');
    cambiar?.((s) => ({
      ...s,
      eventos: {
        ...s.eventos,
        [ev.id]: { decisiones: [], texto: '', eleccionesAntes: { ...s.elecciones }, ...(ev.checklistEvidencia ? { evidencia: [] } : {}) },
      },
    }));
    setCodigo('');
    setError('');
    setAbierto(false);
    toast(`Evento desbloqueado: ${ev.titulo}`);
  };
  return (
    <div>
      <div className="fila" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Eventos</h3>
        {!abierto ? (
          <button className="btn btn-prim" onClick={() => setAbierto(true)}>
            Tengo un código de evento
          </button>
        ) : (
          <form
            className="fila"
            onSubmit={(e) => {
              e.preventDefault();
              ingresar();
            }}
          >
            <input className="texto" style={{ width: 180, textTransform: 'uppercase' }} autoFocus value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código" aria-label="Código de evento" />
            <button className="btn btn-prim" type="submit">
              Desbloquear
            </button>
            <button className="btn" type="button" onClick={() => setAbierto(false)}>
              Cancelar
            </button>
          </form>
        )}
        {error && <span className="error">{error}</span>}
      </div>
      {ids.length === 0 && <p className="muted">Aún no hay eventos. El docente enviará un código a todas las salas.</p>}
      {ids
        .slice()
        .reverse()
        .map((id) => (
          <TarjetaEvento key={id} id={id} />
        ))}
    </div>
  );
}

function TarjetaEvento({ id }: { id: string }) {
  const { datos, estado, cambiar } = useVista();
  const ev = datos.eventos.eventos.find((e) => e.id === id)!;
  const r = estado.eventos[id];
  const res = efectoEvento(datos, ev, r.eleccionesAntes ?? estado.elecciones, r.evidencia ?? [], estado.elecciones);
  const set = (f: (x: typeof r) => typeof r) => cambiar?.((s) => ({ ...s, eventos: { ...s.eventos, [id]: f(s.eventos[id]) } }));
  const deltas = INDICADORES.filter((i) => res.delta[i] !== 0);
  return (
    <div className="evento-card">
      <div className="rotulo">Evento ficticio de la simulación · {ev.id}</div>
      <h3 style={{ margin: '4px 0' }}>{ev.titulo}</h3>
      <p>{ev.texto}</p>
      <p>
        <strong>Pregunta:</strong> {ev.pregunta}
      </p>

      {res.detalles.length > 0 && (
        <div className="bloque">
          <h4>Qué pasó con su configuración</h4>
          <ul style={{ margin: 0 }}>
            {res.detalles.map((d) => (
              <li key={d.texto}>
                {d.texto}: {Object.entries(d.delta).map(([k, v]) => `${k} ${v! > 0 ? '+' : ''}${v}`).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}
      {res.mensajeSinDatos && <p className="ok">🎉 {res.mensajeSinDatos}</p>}
      {res.dossier && (
        <div className="bloque">
          <h4>Lo que el sistema aún conserva de Lucía</h4>
          {res.dossier.length ? (
            <ul style={{ margin: 0 }}>
              {res.dossier.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <p className="ok">🎉 Nada: su configuración no conserva datos de Lucía más allá de lo necesario.</p>
          )}
        </div>
      )}
      {ev.checklistEvidencia && (
        <div className="bloque">
          <h4>¿Qué evidencia tienen?</h4>
          {ev.checklistEvidencia.map((c) => (
            <label key={c.id} className="fila" style={{ gap: 8, margin: '4px 0' }}>
              <input
                type="checkbox"
                checked={r.evidencia?.includes(c.id) ?? false}
                disabled={!cambiar}
                onChange={(e) =>
                  set((x) => {
                    const ev2 = (x.evidencia ?? []).filter((y) => y !== c.id);
                    return { ...x, evidencia: e.target.checked ? [...ev2, c.id] : ev2 };
                  })
                }
              />
              {c.etiqueta}
            </label>
          ))}
          <p className="pequeno muted">Cada evidencia faltante resta: {Object.entries(ev.efectoPorFaltante ?? {}).map(([k, v]) => `${k} ${v}`).join(', ')}.</p>
        </div>
      )}
      {ev.reabre && (
        <div className="bloque">
          <h4>Decisiones reabiertas</h4>
          <p>
            {ev.reabre.map((d) => (
              <span key={d} style={{ marginRight: 10 }}>
                <strong>{d}</strong>: {res.cambiadasTras?.includes(d) ? `cambiada (${(r.eleccionesAntes?.[d] ?? '').toUpperCase()} → ${estado.elecciones[d].toUpperCase()})` : 'sin cambios'}
              </span>
            ))}
          </p>
        </div>
      )}
      {deltas.length > 0 && (
        <p className="pequeno" style={{ fontWeight: 700 }}>
          Efecto en los indicadores: {deltas.map((i) => `${i} ${res.delta[i] > 0 ? '+' : ''}${res.delta[i]}`).join(' · ')}
        </p>
      )}

      <div className="bloque" style={{ background: '#fff', borderRadius: 8, padding: 10 }}>
        <h4>Respuesta del grupo (obligatoria)</h4>
        <div className="fila" role="radiogroup" aria-label="Respuesta del grupo">
          {(['mantenemos', 'cambiamos'] as const).map((v) => (
            <label key={v} className="fila" style={{ gap: 6, fontWeight: 700 }}>
              <input type="radio" name={`resp-${id}`} checked={r.respuesta === v} disabled={!cambiar} onChange={() => set((x) => ({ ...x, respuesta: v }))} />
              {v === 'mantenemos' ? 'Mantenemos' : 'Cambiamos'}
            </label>
          ))}
        </div>
        <div className="pequeno" style={{ margin: '8px 0 4px', fontWeight: 600 }}>
          Qué decisiones
        </div>
        <div className="fila" style={{ gap: 6 }}>
          {datos.catalogo.decisiones.map((d) => {
            const on = r.decisiones.includes(d.id);
            const destacada = ev.ponePrueba.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                className="btn btn-chico"
                aria-pressed={on}
                disabled={!cambiar}
                style={on ? { background: '#6b3fa0', color: '#fff', borderColor: '#6b3fa0' } : destacada ? { borderColor: '#6b3fa0' } : undefined}
                onClick={() => set((x) => ({ ...x, decisiones: on ? x.decisiones.filter((y) => y !== d.id) : [...x.decisiones, d.id] }))}
              >
                {d.id}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 8 }}>
          <TextoLimitado etiqueta="¿Por qué?" valor={r.texto} cambiar={(v) => set((x) => ({ ...x, texto: v }))} deshabilitado={!cambiar} />
        </div>
      </div>
    </div>
  );
}

// ---------------- Dictamen (abogados) ----------------
export function PestanaDictamen() {
  const { datos, estado, cambiar } = useVista();
  const d = estado.dictamen!;
  const s = buscarSector(datos, estado.sector);
  const a = aciertosDictamen(datos, estado);
  const setTexto = (tipo: 'riesgos' | 'recomendaciones', i: number, v: string) =>
    cambiar?.((st) => {
      const arr = [...st.dictamen![tipo]];
      arr[i] = v;
      return { ...st, dictamen: { ...st.dictamen!, [tipo]: arr } };
    });
  return (
    <div className="col">
      <h3>Dictamen para el cliente</h3>
      <p>{s.tarea}</p>
      <p className="muted pequeno">
        Recorran las decisiones y usen «⚖️ Marcar como riesgo legal» en las que consideren ilícitas. Marcadas: <strong>{d.marcadas.join(', ') || 'ninguna'}</strong>.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="col">
          {[0, 1, 2].map((i) => (
            <TextoLimitado key={i} etiqueta={`Riesgo ${i + 1}`} valor={d.riesgos[i] ?? ''} cambiar={(v) => setTexto('riesgos', i, v)} filas={3} />
          ))}
        </div>
        <div className="col">
          {[0, 1, 2].map((i) => (
            <TextoLimitado key={i} etiqueta={`Recomendación ${i + 1}`} valor={d.recomendaciones[i] ?? ''} cambiar={(v) => setTexto('recomendaciones', i, v)} filas={3} />
          ))}
        </div>
      </div>
      {d.revelado ? (
        <div className="tarjeta" style={{ background: '#e6f4ea' }}>
          <strong style={{ fontSize: 20 }}>
            Encontraron {a.encontradas} de {a.total}
          </strong>
          <p style={{ margin: '6px 0 0' }}>Las zonas ya están visibles en el Panel. La revelación quedó registrada.</p>
        </div>
      ) : (
        <div>
          <button className="btn btn-prim" onClick={() => cambiar?.((st) => ({ ...st, dictamen: { ...st.dictamen!, revelado: true } }))}>
            Revelar zonas
          </button>
          <span className="pequeno muted" style={{ marginLeft: 10 }}>
            Muestra los colores y cuántas opciones ilícitas encontraron. No se puede deshacer.
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------- Compartir y exportar ----------------
export function Compartir({ alCargar }: { alCargar: (st: EstadoGrupo) => void }) {
  const { datos, estado, cambiar } = useVista();
  const completa = declaracionCompleta(estado);
  const codigo = useMemo(() => (completa ? codificar(datos, estado) : ''), [completa, datos, estado]);
  const [cargar, setCargar] = useState('');
  const [errCarga, setErrCarga] = useState('');
  const largo = codigo.length > LARGO_OBJETIVO;
  const s = buscarSector(datos, estado.sector);
  const archivo = () => descargar(`grupo-${estado.sector}-${hhmm(new Date().toISOString()).replace(':', '')}.json`, JSON.stringify(estado, null, 2));
  const ind = calcularIndicadores(datos, estado, estado.sector);
  return (
    <div className="col">
      <h3>Compartir con el docente</h3>
      <label className="col" style={{ gap: 4, maxWidth: 420 }}>
        <span style={{ fontWeight: 600 }}>Nombre del grupo (opcional, sin datos personales)</span>
        <input className="texto" maxLength={MAX_ALIAS} value={estado.alias ?? ''} placeholder={`Grupo ${s.grupo}`} onChange={(e) => cambiar?.((st) => ({ ...st, alias: e.target.value.slice(0, MAX_ALIAS) || undefined }))} />
      </label>
      {!completa ? (
        <div className="alerta-roja">Completen la declaración de prioridades (pestaña «Prioridades») para generar el código.</div>
      ) : (
        <div className="tarjeta" style={{ boxShadow: 'none', border: '1px solid var(--gris-2)' }}>
          <div className="fila" style={{ justifyContent: 'space-between' }}>
            <strong>Código del grupo</strong>
            <span className="pequeno muted">{codigo.length} caracteres</span>
          </div>
          <div className="codigo-caja" style={{ margin: '6px 0' }}>
            {codigo}
          </div>
          {largo && <p className="nota-op pequeno">⚠️ El código supera {LARGO_OBJETIVO} caracteres y el chat podría cortarlo. Mejor envíen el archivo del grupo.</p>}
          <div className="fila">
            <button className="btn btn-prim" onClick={() => copiar(codigo, '✓ Código copiado')}>
              Copiar código
            </button>
            <span className="pequeno">Pega este código en el chat de Zoom para el docente.</span>
          </div>
        </div>
      )}
      <div className="fila">
        <button className="btn" onClick={archivo} disabled={!completa}>
          Descargar archivo del grupo
        </button>
        <button className="btn" onClick={() => descargar(`resumen-${estado.sector}-${hhmm(new Date().toISOString()).replace(':', '')}.html`, resumenHTML(datos, estado), 'text/html')}>
          Descargar resumen
        </button>
        <button className="btn" onClick={() => copiar(resumenTexto(datos, estado), '✓ Resumen copiado como texto')}>
          Copiar como texto
        </button>
      </div>
      <p className="pequeno muted">
        El resumen es un HTML imprimible: ábranlo y usen «Imprimir → Guardar como PDF». «Copiar como texto» sirve para pegar en Miro.
        {ind.incumplimiento.length > 0 && ` Ojo: su configuración aún tiene ${ind.incumplimiento.length} decisión(es) en zona roja.`}
      </p>

      <h3 style={{ marginTop: 10 }}>Cargar código</h3>
      <p className="pequeno muted">Reemplaza el estado actual por el de un código (por ejemplo, para continuar en otra computadora).</p>
      <textarea className="texto" rows={2} value={cargar} onChange={(e) => setCargar(e.target.value)} placeholder="PBD1-…" aria-label="Código a cargar" />
      <div className="fila">
        <button
          className="btn"
          disabled={!cargar.trim()}
          onClick={() => {
            const r = decodificar(datos, cargar);
            if (!r.ok) return setErrCarga(r.mensaje);
            setErrCarga('');
            setCargar('');
            alCargar(r.estado);
          }}
        >
          Cargar
        </button>
        {errCarga && <span className="error">{errCarga}</span>}
      </div>
    </div>
  );
}
