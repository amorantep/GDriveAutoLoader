import { useCallback, useEffect, useMemo, useState } from 'react';
import { DATOS } from './model/datos';
import type { EstadoGrupo } from './model/types';
import { VistaCtx, Confirmar, Toast, almacen, toast } from './ui/comun';
import type { Ctx } from './ui/comun';
import { eleccionesIniciales, eleccionesModo, estadoNuevo, buscarSector } from './engine/indicadores';
import { decodificar } from './codec/codigo';
import { VistaPantallas } from './screens/Pantallas';
import type { Vista } from './screens/ids';
import { Panel } from './panel/Panel';
import type { Pestana } from './panel/Panel';
import { BriefSector, Compartir, Eventos, Prioridades, PestanaDictamen, SelectorSector } from './panel/Taller';
import { Docente } from './docente/Docente';

type Modo = 'inicio' | 'a' | 'b' | 'taller' | 'docente';
type VerComo = Vista | 'dpo';
const CLAVE_TALLER = 'pbd-taller-v1';
const datos = DATOS;

/** Lee un parámetro sin convertir «+» en espacio (los códigos lz-string usan «+»). */
function param(nombre: string): string | null {
  const m = new RegExp(`[?&]${nombre}=([^&]*)`).exec(window.location.search);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function fijarURL(modo: Modo, sector?: string) {
  try {
    const q = new URLSearchParams();
    if (modo !== 'inicio') q.set('modo', modo);
    if (sector && modo !== 'docente') q.set('sector', sector);
    const qs = q.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
  } catch {
    /* file:// en algunos navegadores */
  }
}

const sectorValido = (s: string | null) => (s && datos.sectores.sectores.some((x) => x.id === s) ? s : null);

export default function App() {
  const inicial = useMemo(() => {
    const m = (param('modo') ?? '').toLowerCase();
    const g = param('g');
    return {
      modo: (['a', 'b', 'taller', 'docente'].includes(m) ? m : g ? 'taller' : 'inicio') as Modo,
      sector: sectorValido(param('sector')),
      g,
    };
  }, []);
  const [modo, setModo] = useState<Modo>(inicial.modo);
  const [sectorDemo, setSectorDemo] = useState(inicial.sector ?? 'mineria');
  const [verComo, setVerComo] = useState<VerComo>(inicial.modo === 'taller' ? 'dpo' : 'colaborador');
  const [pantalla, setPantalla] = useState<Record<Vista, string>>({ colaborador: 'colaborador/onboarding-registro', supervisor: 'supervisor/directorio' });
  const [activa, setActiva] = useState(datos.catalogo.decisiones.find((d) => d.nucleo)!.id);
  const [pestana, setPestana] = useState('decision');
  const [anotaciones, setAnotaciones] = useState(false);
  const [taller, setTaller] = useState<EstadoGrupo | null>(null);
  const [guardado, setGuardado] = useState<EstadoGrupo | null>(null);
  const [confirmar, setConfirmar] = useState<null | { texto: string; si: () => void; etiqueta?: string }>(null);
  const [errorG, setErrorG] = useState('');
  const [falloAlmacen, setFalloAlmacen] = useState(false);

  // Arranque: ?g=, estado guardado o ?sector=
  useEffect(() => {
    if (inicial.g) {
      const r = decodificar(datos, inicial.g);
      if (r.ok) {
        setTaller(r.estado);
        setModo('taller');
        setVerComo('dpo');
        toast('Estado del grupo cargado desde el enlace');
        return;
      }
      setErrorG(`No se pudo cargar el código del enlace: ${r.mensaje}`);
    }
    const g = almacen.leer<EstadoGrupo>(CLAVE_TALLER);
    if (g && g.cat === datos.catalogo.version && g.elecciones) setGuardado(g);
    else if (inicial.modo === 'taller' && inicial.sector) setTaller(estadoNuevo(datos, inicial.sector));
    setFalloAlmacen(almacen.fallo);
  }, [inicial]);

  useEffect(() => {
    fijarURL(modo, modo === 'taller' ? taller?.sector : modo === 'a' || modo === 'b' ? sectorDemo : undefined);
  }, [modo, taller?.sector, sectorDemo]);

  // Guardado automático del taller
  useEffect(() => {
    if (!taller) return;
    if (!almacen.guardar(CLAVE_TALLER, taller)) setFalloAlmacen(true);
  }, [taller]);

  const cambiarTaller = useCallback((f: (s: EstadoGrupo) => EstadoGrupo) => setTaller((s) => (s ? { ...f(s), ts: new Date().toISOString() } : s)), []);

  const estadoDemo = useMemo<EstadoGrupo>(
    () => ({
      v: 1,
      cat: datos.catalogo.version,
      sector: sectorDemo,
      elecciones: eleccionesModo(datos, modo === 'b' ? 'B' : 'A'),
      revisadas: [],
      eventos: {},
      ts: new Date().toISOString(),
    }),
    [modo, sectorDemo],
  );

  const irADecision = useCallback((id: string) => {
    setActiva(id);
    setPestana('decision');
    setVerComo('dpo');
  }, []);

  const ir = (m: Modo) => {
    setModo(m);
    setPestana('decision');
    if (m === 'taller') setVerComo('dpo');
    else if (m === 'a' || m === 'b') setVerComo((v) => v);
    window.scrollTo(0, 0);
  };

  const enTaller = modo === 'taller' && taller;
  const estado = enTaller ? taller : estadoDemo;
  const zonasOcultas = !!(enTaller && taller.dictamen && !taller.dictamen.revelado);
  const ctx: Ctx = {
    datos,
    estado,
    cambiar: enTaller ? cambiarTaller : null,
    anotaciones: anotaciones && (modo === 'a' || modo === 'b' || modo === 'docente'),
    zonasOcultas,
    irADecision,
  };

  // Decisiones reabiertas por eventos (EV-05)
  const reabiertas = enTaller
    ? Object.keys(taller.eventos).flatMap((id) => datos.eventos.eventos.find((e) => e.id === id)?.reabre ?? [])
    : [];

  let pestanas: Pestana[] = [];
  if (enTaller) {
    pestanas = [
      { id: 'prioridades', titulo: 'Prioridades', contenido: <Prioridades /> },
      { id: 'eventos', titulo: 'Eventos', badge: Object.values(taller.eventos).filter((r) => !r.respuesta || !r.texto.trim()).length, contenido: <Eventos /> },
      ...(taller.dictamen ? [{ id: 'dictamen', titulo: 'Dictamen', contenido: <PestanaDictamen /> }] : []),
      {
        id: 'compartir',
        titulo: 'Compartir',
        contenido: (
          <Compartir
            alCargar={(st) =>
              setConfirmar({
                texto: 'Se reemplazará el estado actual del grupo por el del código. ¿Continuar?',
                si: () => {
                  setTaller(st);
                  toast('Código cargado');
                },
              })
            }
          />
        ),
      },
    ];
  }

  const reiniciar = () =>
    setConfirmar({
      texto: taller?.dictamen ? '¿Restablecer la configuración del cliente minero? Se pierden las elecciones del grupo (se conservan la declaración y los eventos).' : '¿Restablecer al Modo A? Se pierden las elecciones del grupo (se conservan la declaración y los eventos).',
      etiqueta: 'Restablecer',
      si: () => cambiarTaller((s) => ({ ...s, elecciones: eleccionesIniciales(datos, s.sector), revisadas: [] })),
    });

  const nombreModo: Record<Modo, [string, string]> = {
    inicio: ['', ''],
    a: ['Modo A · sin privacy by default', 'A'],
    b: ['Modo B · con privacy by default', 'B'],
    taller: ['Taller', 'T'],
    docente: ['Docente', 'D'],
  };

  return (
    <VistaCtx.Provider value={ctx}>
      <div className="app">
        <header className="barra">
          <button className="btn-link" style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => ir('inicio')} title="Volver al inicio">
            <span className="marca">
              Simulador PbD
              <small>Privacy by Default · S23</small>
            </span>
          </button>
          {modo !== 'inicio' && <span className={`chip-modo ${nombreModo[modo][1]}`}>{nombreModo[modo][0]}</span>}
          {enTaller && <span className="pequeno muted">{taller.alias ? `${taller.alias} · ` : ''}{buscarSector(datos, taller.sector).nombre}</span>}
          <span className="espacio" />
          {(modo === 'a' || modo === 'b' || enTaller) && (
            <div className="vercomo">
              <span>Ver como</span>
              <div className="grupo-btn" role="group" aria-label="Ver como">
                {(['colaborador', 'supervisor', 'dpo'] as VerComo[]).map((v) => (
                  <button key={v} aria-pressed={verComo === v} onClick={() => setVerComo(v)}>
                    {v === 'colaborador' ? 'Colaborador' : v === 'supervisor' ? 'Supervisor' : 'DPO'}
                  </button>
                ))}
              </div>
            </div>
          )}
          {(modo === 'a' || modo === 'b') && (
            <div className="grupo-btn" role="group" aria-label="Cambiar modo">
              <button aria-pressed={modo === 'a'} onClick={() => ir('a')}>
                A
              </button>
              <button aria-pressed={modo === 'b'} onClick={() => ir('b')}>
                B
              </button>
            </div>
          )}
          {(modo === 'a' || modo === 'b' || modo === 'docente') && (
            <label className="fila pequeno" style={{ gap: 6, fontWeight: 600 }}>
              <input type="checkbox" checked={anotaciones} onChange={(e) => setAnotaciones(e.target.checked)} />
              Mostrar anotaciones
            </label>
          )}
          {falloAlmacen && <span className="aviso-discreto" title="El navegador no permite guardar. Todo sigue funcionando en memoria.">No se puede guardar en este navegador</span>}
        </header>

        <div className="contenido">
          {modo === 'inicio' && <Inicio ir={ir} error={errorG} />}

          {(modo === 'a' || modo === 'b' || enTaller) && (
            <>
              {verComo === 'dpo' ? (
                <Panel
                  activa={activa}
                  setActiva={setActiva}
                  pestana={pestana}
                  setPestana={setPestana}
                  pestanas={pestanas}
                  reabiertas={reabiertas}
                  pieIzq={
                    enTaller ? (
                      <>
                        <BriefSector />
                        <div className="col" style={{ marginTop: 10 }}>
                          <button className="btn btn-chico" onClick={reiniciar}>
                            {taller.dictamen ? 'Restablecer configuración del cliente' : 'Restablecer al Modo A'}
                          </button>
                          <button
                            className="btn btn-chico btn-peligro"
                            onClick={() =>
                              setConfirmar({
                                texto: '¿Reiniciar el taller? Se borra todo el trabajo del grupo en este navegador y podrán elegir otro sector. Si lo necesitan, primero descarguen el archivo del grupo.',
                                etiqueta: 'Reiniciar taller',
                                si: () => {
                                  almacen.borrar(CLAVE_TALLER);
                                  setTaller(null);
                                  setPestana('decision');
                                },
                              })
                            }
                          >
                            Reiniciar taller / cambiar sector
                          </button>
                        </div>
                      </>
                    ) : (
                      <label className="col pequeno" style={{ marginTop: 10, gap: 4 }}>
                        <span style={{ fontWeight: 600 }}>Pesos del sector</span>
                        <select className="texto" value={sectorDemo} onChange={(e) => setSectorDemo(e.target.value)}>
                          {datos.sectores.sectores.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                    )
                  }
                />
              ) : (
                <VistaPantallas vista={verComo} pantalla={pantalla[verComo]} setPantalla={(id) => setPantalla((p) => ({ ...p, [verComo]: id }))} />
              )}
            </>
          )}

          {modo === 'taller' && !taller && (
            <>
              {guardado ? (
                <div className="tarjeta" style={{ maxWidth: 560, margin: '40px auto' }}>
                  <h2>Hay un taller guardado en este navegador</h2>
                  <p>
                    {guardado.alias ? `${guardado.alias} · ` : ''}
                    {buscarSector(datos, guardado.sector).nombre} · última modificación {new Date(guardado.ts).toLocaleString('es-PE')}
                  </p>
                  <div className="fila">
                    <button
                      className="btn btn-prim"
                      onClick={() => {
                        setTaller({ ...guardado, eventos: guardado.eventos ?? {}, revisadas: guardado.revisadas ?? [] });
                        setGuardado(null);
                        setVerComo('dpo');
                      }}
                    >
                      Continuar
                    </button>
                    <button
                      className="btn"
                      onClick={() =>
                        setConfirmar({
                          texto: 'Se borrará el taller guardado. ¿Empezar de nuevo?',
                          etiqueta: 'Empezar de nuevo',
                          si: () => {
                            almacen.borrar(CLAVE_TALLER);
                            setGuardado(null);
                          },
                        })
                      }
                    >
                      Empezar de nuevo
                    </button>
                  </div>
                </div>
              ) : (
                <SelectorSector
                  alElegir={(s) => {
                    setTaller(estadoNuevo(datos, s));
                    setVerComo('dpo');
                    setActiva(datos.catalogo.decisiones.find((d) => d.nucleo)!.id);
                    setPestana('decision');
                  }}
                />
              )}
            </>
          )}

          {modo === 'docente' && <Docente />}
        </div>

        <footer className="pie">Esta herramienta no recoge datos personales. Todo queda en tu navegador. · Personajes, empresas y eventos ficticios.</footer>
        {confirmar && (
          <Confirmar
            texto={confirmar.texto}
            etiquetaSi={confirmar.etiqueta}
            no={() => setConfirmar(null)}
            si={() => {
              confirmar.si();
              setConfirmar(null);
            }}
          />
        )}
        <Toast />
      </div>
    </VistaCtx.Provider>
  );
}

function Inicio({ ir, error }: { ir: (m: Modo) => void; error: string }) {
  const botones: [Modo, string, string, string][] = [
    ['a', 'Demo', 'Ver Modo A', 'La App del Colaborador sin privacy by default (privacidad por defecto).'],
    ['b', 'Demo', 'Ver Modo B', 'La misma app con privacy by default: la versión resuelta.'],
    ['taller', 'Grupos', 'Taller', 'Panel del DPO: decidan las configuraciones y vean su efecto en seis indicadores.'],
    ['docente', 'Docente', 'Docente', 'Votaciones en sala, códigos de eventos y tablero comparativo de grupos.'],
  ];
  return (
    <div className="inicio">
      <h1>Simulador Privacy by Default</h1>
      <p className="muted" style={{ fontSize: 18 }}>
        Sesión S23 · Programa DPO &amp; Tech Governance. Una app ficticia de RR. HH. para ver qué cambia cuando la configuración por defecto protege al colaborador.
      </p>
      {error && <p className="alerta-roja">{error}</p>}
      <div className="inicio-grid">
        {botones.map(([m, etq, tit, desc]) => (
          <button key={m} className="inicio-btn" onClick={() => ir(m)}>
            <span className="etq">{etq}</span>
            <strong>{tit}</strong>
            <span className="muted">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
