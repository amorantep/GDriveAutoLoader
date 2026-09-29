// Modo Docente (SPEC §7): votaciones en sala, eventos y tablero comparativo.
import { useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import { INDICADORES } from '../model/types';
import type { EstadoGrupo, Votacion } from '../model/types';
import { Normas, VistaCtx, Zona, almacen, copiar, decisionDe, descargar, hhmm, useVista } from '../ui/comun';
import { buscarEvento, buscarSector, calcularIndicadores, efectoEvento, eleccionesModo, opcionElegida, aciertosDictamen } from '../engine/indicadores';
import { decodificar, leerArchivo } from '../codec/codigo';
import { Marco } from '../screens/Pantallas';
import { nombreGrupo, tableroHTML } from '../export/resumen';

export function Docente() {
  const [tab, setTab] = useState<'votaciones' | 'eventos' | 'tablero'>('votaciones');
  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <div className="tabs" role="tablist">
        {(
          [
            ['votaciones', 'Votaciones'],
            ['eventos', 'Eventos'],
            ['tablero', 'Tablero'],
          ] as const
        ).map(([id, t]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'votaciones' && <Votaciones />}
      {tab === 'eventos' && <EventosDocente />}
      {tab === 'tablero' && <Tablero />}
    </div>
  );
}

// ---------------- Votaciones ----------------
function Votaciones() {
  const { datos } = useVista();
  const [proy, setProy] = useState<Votacion | null>(null);
  return (
    <div className="col">
      <p className="muted">Proyecta la pantalla del Modo A y las opciones sin zonas. El voto se hace con una encuesta de Zoom; luego puedes escribir los conteos y revelar las zonas.</p>
      <table className="tabla tarjeta">
        <thead>
          <tr>
            <th>#</th>
            <th>Dimensión</th>
            <th>Decisión</th>
            <th>Pregunta</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {datos.votaciones.votaciones
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .map((v) => (
              <tr key={v.orden}>
                <td>{v.orden}</td>
                <td>{datos.catalogo.dimensiones.find((d) => d.id === v.dimension)?.nombre ?? v.dimension}</td>
                <td>
                  <strong>{v.decision}</strong> · {decisionDe(v.decision, datos).titulo}
                </td>
                <td>{v.pregunta}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-prim btn-chico" onClick={() => setProy(v)}>
                    Proyectar
                  </button>{' '}
                  <button className="btn btn-chico" onClick={() => copiar(textoEncuesta(v), '✓ Texto de la encuesta copiado')}>
                    Copiar texto para encuesta de Zoom
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {proy && <Proyeccion v={proy} cerrar={() => setProy(null)} />}
    </div>
  );
}

function textoEncuesta(v: Votacion) {
  const d = decisionDe(v.decision);
  return [v.pregunta, ...d.opciones.map((o) => `${o.id.toUpperCase()}) ${o.etiqueta}`)].join('\n');
}

function Proyeccion({ v, cerrar }: { v: Votacion; cerrar: () => void }) {
  const ctx = useVista();
  const d = decisionDe(v.decision, ctx.datos);
  const [conteos, setConteos] = useState<Record<string, string>>({});
  const [revelar, setRevelar] = useState(false);
  const total = d.opciones.reduce((a, o) => a + (Number(conteos[o.id]) || 0), 0);
  const estadoA = useMemo<EstadoGrupo>(
    () => ({ v: 1, cat: ctx.datos.catalogo.version, sector: 'mineria', elecciones: eleccionesModo(ctx.datos, 'A'), revisadas: [], eventos: {}, ts: '' }),
    [ctx.datos],
  );
  useEffect(() => {
    try {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    } catch {
      /* sin pantalla completa */
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && cerrar();
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('keydown', esc);
      try {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      } catch {
        /* nada */
      }
    };
  }, [cerrar]);
  return (
    <div className="proyeccion" role="dialog" aria-modal="true" aria-label={`Votación: ${v.pregunta}`}>
      <div className="fila" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 26 }}>{v.pregunta}</h2>
        <div className="fila">
          <button className="btn" onClick={() => copiar(textoEncuesta(v), '✓ Texto de la encuesta copiado')}>
            Copiar texto para encuesta
          </button>
          {!revelar ? (
            <button className="btn btn-prim" onClick={() => setRevelar(true)}>
              Revelar zonas
            </button>
          ) : (
            <button className="btn" onClick={() => setRevelar(false)}>
              Ocultar zonas
            </button>
          )}
          <button className="btn" onClick={cerrar}>
            Cerrar ✕
          </button>
        </div>
      </div>
      <div className="proyeccion-grid">
        <VistaCtx.Provider value={{ ...ctx, estado: estadoA, cambiar: null, zonasOcultas: !revelar, irADecision: () => {} }}>
          <Marco pantalla={v.pantalla} />
        </VistaCtx.Provider>
        <div className="col">
          <div className="pequeno muted">
            {d.id} · {d.titulo} · Pantalla del Modo A
          </div>
          <div className="votos">
            {d.opciones.map((o) => {
              const n = Number(conteos[o.id]) || 0;
              return (
                <div key={o.id} className="voto" style={revelar ? { borderColor: o.zona === 'R' ? '#b3261e' : o.zona === 'A' ? '#e0a100' : '#1b6e3a', borderLeftWidth: 10 } : undefined}>
                  <span className="letra">{o.id.toUpperCase()}</span>
                  <div>
                    <div>{o.etiqueta}</div>
                    {revelar && (
                      <div style={{ marginTop: 4 }}>
                        <Zona zona={o.zona} />
                      </div>
                    )}
                    {total > 0 && <div className="barra-voto" style={{ width: `${(n / total) * 100}%` }} />}
                  </div>
                  <label>
                    <span className="sr">Votos para {o.id.toUpperCase()}</span>
                    <input className="texto" type="number" min={0} value={conteos[o.id] ?? ''} placeholder="0" onChange={(e) => setConteos((c) => ({ ...c, [o.id]: e.target.value }))} />
                  </label>
                </div>
              );
            })}
          </div>
          {total > 0 && <div className="pequeno muted">{total} votos</div>}
          {revelar && (
            <div className="tarjeta">
              <h4>Base normativa</h4>
              <Normas dec={d} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- Eventos ----------------
function EventosDocente() {
  const { datos } = useVista();
  return (
    <div className="col">
      <p className="muted">Copia el mensaje y envíalo con «Transmitir mensaje a todas las salas» de Zoom.</p>
      <table className="tabla tarjeta">
        <thead>
          <tr>
            <th>Evento</th>
            <th>Código</th>
            <th>Momento sugerido</th>
            <th>Pone a prueba</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {datos.eventos.eventos.map((e) => (
            <tr key={e.id}>
              <td>
                <strong>{e.id}</strong> · {e.titulo}
                <div className="pequeno muted">{e.texto}</div>
              </td>
              <td>
                <code style={{ fontSize: 18, fontWeight: 800 }}>{e.codigo}</code>
              </td>
              <td>{e.uso}</td>
              <td className="pequeno">{e.ponePrueba.join(', ')}</td>
              <td>
                <button className="btn btn-prim btn-chico" onClick={() => copiar(`Evento: ${e.titulo}. Ingresen el código ${e.codigo} en el Panel del DPO. Tienen 5 minutos.`, '✓ Mensaje copiado')}>
                  Copiar mensaje para las salas
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Tablero ----------------
const CLAVE_TABLERO = 'pbd-tablero-v1';
interface Invalido {
  origen: string;
  motivo: string;
  mensaje: string;
}
const claveGrupo = (g: EstadoGrupo) => `${g.sector}|${g.alias ?? ''}|${g.ts}`;

function Tablero() {
  const { datos } = useVista();
  const [grupos, setGrupos] = useState<EstadoGrupo[]>(() => almacen.leer<EstadoGrupo[]>(CLAVE_TABLERO) ?? []);
  const [invalidos, setInvalidos] = useState<Invalido[]>([]);
  const [texto, setTexto] = useState('');
  const [todas, setTodas] = useState(false);
  const [conB, setConB] = useState(false);
  const [arrastre, setArrastre] = useState(false);
  const [estres, setEstres] = useState<'' | 'EV-01' | 'EV-02'>('');

  useEffect(() => {
    almacen.guardar(CLAVE_TABLERO, grupos);
  }, [grupos]);

  const agregar = (nuevos: EstadoGrupo[], malos: Invalido[]) => {
    setGrupos((gs) => {
      const m = new Map(gs.map((g) => [claveGrupo(g), g]));
      for (const g of nuevos) m.set(claveGrupo(g), g);
      return [...m.values()].sort((a, b) => buscarSector(datos, a.sector).grupo - buscarSector(datos, b.sector).grupo);
    });
    setInvalidos(malos);
  };

  const cargarCodigos = () => {
    const lineas = texto
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    // Zoom antepone «Nombre: » o parte líneas: se toma desde «PBD» y una línea suelta se une al código
    // anterior solo si este es inválido y la unión da un código válido.
    const codigos: string[] = [];
    for (const l of lineas) {
      const i = l.search(/[A-Z]{3}\d-/);
      const previo = codigos[codigos.length - 1];
      if (i >= 0) codigos.push(l.slice(i));
      else if (previo && !decodificar(datos, previo).ok && decodificar(datos, previo + l).ok) codigos[codigos.length - 1] = previo + l;
      else codigos.push(l);
    }
    const ok: EstadoGrupo[] = [];
    const malos: Invalido[] = [];
    codigos.forEach((c, n) => {
      const r = decodificar(datos, c);
      if (r.ok) ok.push(r.estado);
      else malos.push({ origen: `Código ${n + 1} (${c.slice(0, 14)}…)`, motivo: r.motivo, mensaje: r.mensaje });
    });
    agregar(ok, malos);
    if (malos.length === 0) setTexto('');
  };

  const cargarArchivos = async (files: FileList | null) => {
    if (!files) return;
    const ok: EstadoGrupo[] = [];
    const malos: Invalido[] = [];
    for (const f of Array.from(files)) {
      const r = leerArchivo(datos, await f.text());
      if (r.ok) ok.push(r.estado);
      else malos.push({ origen: f.name, motivo: r.motivo, mensaje: r.mensaje });
    }
    agregar(ok, malos);
  };

  const soltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastre(false);
    void cargarArchivos(e.dataTransfer.files);
  };

  const decs = datos.catalogo.decisiones.filter((d) => todas || d.nucleo);
  const divergencia = (id: string) => new Set(grupos.map((g) => g.elecciones[id])).size;
  const columnas = decs.slice().sort((a, b) => divergencia(b.id) - divergencia(a.id));
  const maxDiv = Math.max(0, ...columnas.map((d) => divergencia(d.id)));
  const resuelta: EstadoGrupo = { v: 1, cat: datos.catalogo.version, sector: 'mineria', elecciones: eleccionesModo(datos, 'B'), revisadas: [], eventos: {}, ts: '' };
  const idsEventos = datos.eventos.eventos.filter((e) => grupos.some((g) => g.eventos[e.id])).map((e) => e.id);
  const abogados = grupos.filter((g) => buscarSector(datos, g.sector).modoDictamen);
  const mineros = grupos.filter((g) => g.sector === 'mineria');

  return (
    <div className="col">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="tarjeta col">
          <strong>Pegar códigos (uno por línea)</strong>
          <textarea className="texto" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="PBD1-…" aria-label="Códigos de grupo" />
          <div className="fila">
            <button className="btn btn-prim" onClick={cargarCodigos} disabled={!texto.trim()}>
              Cargar códigos
            </button>
          </div>
        </div>
        <div
          className={`drop ${arrastre ? 'activo' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastre(true);
          }}
          onDragLeave={() => setArrastre(false)}
          onDrop={soltar}
        >
          <p style={{ fontWeight: 700 }}>Arrastra aquí los archivos JSON de los grupos</p>
          <label className="btn" style={{ display: 'inline-block' }}>
            o elige archivos
            <input type="file" accept=".json,application/json" multiple className="sr" onChange={(e) => void cargarArchivos(e.target.files)} />
          </label>
        </div>
      </div>

      {invalidos.length > 0 && (
        <div className="alerta-roja">
          <strong>No se pudieron cargar:</strong>
          <ul style={{ margin: '4px 0 0' }}>
            {invalidos.map((x, i) => (
              <li key={i}>
                {x.origen}: <em>{x.motivo}</em> — {x.mensaje}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="fila">
        <strong>{grupos.length} grupo(s) cargado(s)</strong>
        {grupos.map((g) => (
          <span key={claveGrupo(g)} className="tipo-norma" style={{ textTransform: 'none', fontSize: 13 }}>
            {nombreGrupo(datos, g)} · {hhmm(g.ts)}{' '}
            <button className="btn-link" aria-label={`Quitar ${nombreGrupo(datos, g)}`} onClick={() => setGrupos((gs) => gs.filter((x) => x !== g))}>
              ✕
            </button>
          </span>
        ))}
        <span className="espacio" style={{ flex: 1 }} />
        {grupos.length > 0 && (
          <>
            <button className="btn btn-chico" onClick={() => descargar(`tablero-${hhmm(new Date().toISOString()).replace(':', '')}.html`, tableroHTML(datos, grupos, todas), 'text/html')}>
              Exportar tablero
            </button>
            <button
              className="btn btn-chico btn-peligro"
              onClick={() => {
                if (window.confirm('¿Vaciar el tablero?')) {
                  setGrupos([]);
                  setInvalidos([]);
                }
              }}
            >
              Vaciar tablero
            </button>
          </>
        )}
      </div>

      {grupos.length > 0 && (
        <>
          <div className="tarjeta" style={{ overflowX: 'auto' }}>
            <div className="fila" style={{ marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Matriz de decisiones</h3>
              <label className="fila pequeno" style={{ gap: 6 }}>
                <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} /> Ver las 18
              </label>
              <label className="fila pequeno" style={{ gap: 6 }}>
                <input type="checkbox" checked={conB} onChange={(e) => setConB(e.target.checked)} /> Comparar con el Modo B
              </label>
              <span className="pequeno muted">Columnas ordenadas por divergencia (más opciones distintas primero). Resaltadas: máxima divergencia.</span>
            </div>
            <table className="matriz">
              <thead>
                <tr>
                  <th className="grupo">Grupo</th>
                  {columnas.map((d) => (
                    <th key={d.id} className={maxDiv > 1 && divergencia(d.id) === maxDiv ? 'div-alta' : ''} title={`${d.titulo} · ${divergencia(d.id)} opciones distintas`}>
                      {d.id}
                      <div className="pequeno muted" style={{ fontWeight: 500 }}>
                        {divergencia(d.id)}≠
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => (
                  <FilaMatriz key={claveGrupo(g)} g={g} ids={columnas.map((d) => d.id)} nombre={nombreGrupo(datos, g)} />
                ))}
                {conB && <FilaMatriz g={resuelta} ids={columnas.map((d) => d.id)} nombre="Versión resuelta (Modo B)" clase="resuelta" />}
              </tbody>
            </table>
          </div>

          <div className="tarjeta" style={{ overflowX: 'auto' }}>
            <h3>Indicadores y declaración de prioridades</h3>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Indicadores</th>
                  <th>Prioriza</th>
                  <th>Sacrifica</th>
                  <th>Justificación</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((g) => {
                  const ind = calcularIndicadores(datos, g, g.sector);
                  const d = g.declaracion;
                  return (
                    <tr key={claveGrupo(g)}>
                      <td>
                        <strong>{nombreGrupo(datos, g)}</strong>
                        {ind.incumplimiento.length > 0 && <div className="error pequeno">⛔ {ind.incumplimiento.length} en zona roja</div>}
                      </td>
                      <td>
                        <MiniBarras v={ind.valor} />
                      </td>
                      <td>{d ? d.prioriza.join(' + ') : '—'}</td>
                      <td>{d?.sacrifica ?? '—'}</td>
                      <td className="pequeno">
                        {d?.justificacion}
                        {d && (
                          <div className="muted">
                            Más difícil: {d.dificil.decision} — {d.dificil.texto}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {idsEventos.length > 0 && (
            <div className="tarjeta" style={{ overflowX: 'auto' }}>
              <h3>Reacción a eventos</h3>
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    {idsEventos.map((id) => (
                      <th key={id}>
                        {id} · {buscarEvento(datos, id)!.titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => (
                    <tr key={claveGrupo(g)}>
                      <td>
                        <strong>{nombreGrupo(datos, g)}</strong>
                      </td>
                      {idsEventos.map((id) => {
                        const r = g.eventos[id];
                        return (
                          <td key={id} className="pequeno">
                            {r ? (
                              <>
                                <strong>{r.respuesta === 'mantenemos' ? 'Mantenemos' : r.respuesta === 'cambiamos' ? 'Cambiamos' : 'Sin respuesta'}</strong>
                                {r.decisiones.length > 0 && ` · ${r.decisiones.join(', ')}`}
                                <div>{r.texto}</div>
                              </>
                            ) : (
                              <span className="muted">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {abogados.length > 0 && (
            <div className="tarjeta" style={{ overflowX: 'auto' }}>
              <h3>Dictamen: estudio de abogados frente al grupo de minería</h3>
              {abogados.map((ab) => {
                const a = aciertosDictamen(datos, ab);
                return (
                  <div key={claveGrupo(ab)} style={{ marginBottom: 12 }}>
                    <p>
                      <strong>{nombreGrupo(datos, ab)}</strong> marcó {ab.dictamen?.marcadas.length ?? 0} decisión(es) como riesgo legal · encontró {a.encontradas} de {a.total}
                      {ab.dictamen?.revelado ? ' (zonas reveladas)' : ' (zonas aún ocultas)'}
                    </p>
                    <table className="tabla">
                      <thead>
                        <tr>
                          <th>Decisión</th>
                          <th>Configuración del cliente</th>
                          <th>¿Marcada como riesgo?</th>
                          {mineros.map((m) => (
                            <th key={claveGrupo(m)}>Eligió {nombreGrupo(datos, m)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {datos.catalogo.decisiones.map((d) => {
                          const o = opcionElegida(d, ab.elecciones);
                          const marcada = ab.dictamen?.marcadas.includes(d.id);
                          if (!marcada && o.zona !== 'R' && !mineros.some((m) => opcionElegida(d, m.elecciones).zona === 'R')) return null;
                          return (
                            <tr key={d.id}>
                              <td>
                                <strong>{d.id}</strong> · {d.titulo}
                              </td>
                              <td>
                                {o.id.toUpperCase()} <Zona zona={o.zona} corta />
                              </td>
                              <td>{marcada ? '⚖️ Sí' : '—'}</td>
                              {mineros.map((m) => {
                                const om = opcionElegida(d, m.elecciones);
                                return (
                                  <td key={claveGrupo(m)}>
                                    {om.id.toUpperCase()} <Zona zona={om.zona} corta />
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }} className="pequeno">
                      <div>
                        <strong>Riesgos</strong>
                        <ol>{ab.dictamen?.riesgos.filter(Boolean).map((r, i) => <li key={i}>{r}</li>)}</ol>
                      </div>
                      <div>
                        <strong>Recomendaciones</strong>
                        <ol>{ab.dictamen?.recomendaciones.filter(Boolean).map((r, i) => <li key={i}>{r}</li>)}</ol>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="tarjeta">
            <div className="fila">
              <h3 style={{ margin: 0 }}>Prueba de estrés</h3>
              <select className="texto" style={{ width: 'auto' }} value={estres} onChange={(e) => setEstres(e.target.value as typeof estres)} aria-label="Evento para la prueba de estrés">
                <option value="">— Elegir evento —</option>
                <option value="EV-01">EV-01 · {buscarEvento(datos, 'EV-01')?.titulo}</option>
                <option value="EV-02">EV-02 · {buscarEvento(datos, 'EV-02')?.titulo}</option>
              </select>
              <span className="pequeno muted">Calcula el evento sobre la configuración actual de cada grupo, sin que ingresen el código.</span>
            </div>
            {estres && (
              <table className="tabla" style={{ marginTop: 10 }}>
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Efecto</th>
                    <th>{estres === 'EV-02' ? 'Dossier de Lucía' : 'Qué encontró el atacante'}</th>
                  </tr>
                </thead>
                <tbody>
                  {grupos.map((g) => {
                    const r = efectoEvento(datos, buscarEvento(datos, estres)!, g.elecciones);
                    const deltas = INDICADORES.filter((i) => r.delta[i] !== 0);
                    return (
                      <tr key={claveGrupo(g)}>
                        <td>
                          <strong>{nombreGrupo(datos, g)}</strong>
                        </td>
                        <td>{deltas.length ? deltas.map((i) => `${i} ${r.delta[i]}`).join(' · ') : <span className="ok">Sin efecto</span>}</td>
                        <td className="pequeno">
                          {estres === 'EV-02' ? (
                            r.dossier?.length ? (
                              <ul style={{ margin: 0 }}>
                                {r.dossier.map((x) => (
                                  <li key={x}>{x}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="ok">🎉 Nada que entregar más allá de lo necesario</span>
                            )
                          ) : r.mensajeSinDatos ? (
                            <span className="ok">🎉 {r.mensajeSinDatos}</span>
                          ) : (
                            r.detalles.map((x) => <div key={x.texto}>{x.texto}</div>)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FilaMatriz({ g, ids, nombre, clase }: { g: EstadoGrupo; ids: string[]; nombre: string; clase?: string }) {
  const { datos } = useVista();
  return (
    <tr className={clase}>
      <td className="grupo">
        <strong>{nombre}</strong>
        {g.ts && <div className="pequeno muted">{hhmm(g.ts)}</div>}
      </td>
      {ids.map((id) => {
        const o = opcionElegida(decisionDe(id, datos), g.elecciones);
        return (
          <td key={id} title={`${id}: ${o.etiqueta} (${datos.catalogo.zonas[o.zona].nombre})`}>
            <span className={`celda zona-${o.zona}`}>
              <Icono z={o.zona} />
              {o.id.toUpperCase()}
            </span>
          </td>
        );
      })}
    </tr>
  );
}

function Icono({ z }: { z: 'R' | 'A' | 'V' }) {
  return <span aria-hidden="true">{z === 'R' ? '⛔' : z === 'A' ? '⚖' : '✓'}</span>;
}

function MiniBarras({ v }: { v: Record<string, number> }) {
  return (
    <div className="mini-barras">
      {INDICADORES.map((i) => (
        <div key={i} className="mini" title={`${i}: ${v[i]}`}>
          <div className="mb">
            <span style={{ height: `${v[i]}%` }} />
          </div>
          {i} {v[i]}
        </div>
      ))}
    </div>
  );
}
