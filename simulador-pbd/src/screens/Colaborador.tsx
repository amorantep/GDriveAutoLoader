// Pantallas de la vista Colaborador (SPEC §3.1). Todo se deriva de las elecciones del estado.
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Anota, useOp, useVista } from '../ui/comun';
import type { Personaje } from '../model/types';

export function usePersona(id: string): Personaje {
  return useVista().datos.personajes.personajes.find((p) => p.id === id)!;
}

function Campo({ etiqueta, valor, obligatorio, placeholder }: { etiqueta: string; valor?: string; obligatorio?: boolean; placeholder?: string }) {
  return (
    <div className="campo">
      <label>
        {etiqueta} {obligatorio && <span className="ast">*</span>}
      </label>
      <div className="input">{valor ?? <span className="muted">{placeholder ?? ''}</span>}</div>
    </div>
  );
}

function Caja({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <div className="check">
      <span className={`caja ${on ? 'on' : ''}`} aria-hidden="true">
        {on ? '✓' : ''}
      </span>
      <span>
        <span className="sr">{on ? 'Marcada: ' : 'Sin marcar: '}</span>
        {children}
      </span>
    </div>
  );
}

// ---------- Registro (ONB-01) ----------
export function Registro() {
  const op = useOp('ONB-01');
  const rosa = usePersona('rosa');
  const d = rosa.datos;
  const base = (
    <>
      <Campo etiqueta="Nombre completo" valor={rosa.nombre} obligatorio />
      <Campo etiqueta="Código de colaborador" valor={d.codigo} obligatorio />
      <Campo etiqueta="Área" valor={d.area} obligatorio />
      <Campo etiqueta="Correo corporativo" valor={d.correo} obligatorio />
    </>
  );
  return (
    <>
      <h3>Crea tu cuenta</h3>
      <Anota id="ONB-01" />
      {base}
      {op === 'a' && (
        <>
          <Campo etiqueta="DNI" obligatorio placeholder="8 dígitos" />
          <Campo etiqueta="Estado civil" valor={d.estadoCivil} obligatorio />
          <Campo etiqueta="N.º de hijos" valor={String(d.hijos ?? '')} obligatorio />
          <Campo etiqueta="Domicilio" valor={d.domicilio} obligatorio />
          <Campo etiqueta="Redes sociales" valor={d.redes} obligatorio />
          <Campo etiqueta="Foto personal" obligatorio placeholder="📷 Subir foto" />
        </>
      )}
      {op === 'b' && <Campo etiqueta="Redes sociales" valor={d.redes} obligatorio />}
      {op === 'c' && (
        <>
          <Campo etiqueta="DNI" obligatorio placeholder="8 dígitos" />
          <Campo etiqueta="Estado civil" valor={d.estadoCivil} obligatorio />
          <Campo etiqueta="N.º de hijos" valor={String(d.hijos ?? '')} obligatorio />
          <Campo etiqueta="Domicilio" valor={d.domicilio} obligatorio />
          <Campo etiqueta="Redes sociales" valor={d.redes} obligatorio />
          <p className="muted" style={{ fontSize: 10 }}>
            * Los campos adicionales son opcionales.
          </p>
        </>
      )}
      {op === 'd' && <Campo etiqueta="Contacto de emergencia (opcional)" placeholder="Nombre y teléfono" />}
      <button className="btn btn-prim" style={{ width: '100%', marginTop: 8 }} tabIndex={-1}>
        Continuar
      </button>
    </>
  );
}

// ---------- Aceptación (ONB-02) ----------
const FINALIDADES_OPCIONALES = [
  'Mostrar mi foto y cumpleaños en el directorio',
  'Recibir novedades y beneficios de socios comerciales',
  'Usar mi ubicación para estadísticas de movilidad',
  'Usar mis conversaciones con el asistente para mejorar el servicio',
];
const BASE_LABORAL = ['Registro de asistencia y jornada', 'Pago de remuneraciones', 'Obligaciones de seguridad y salud en el trabajo'];

export function Aceptacion() {
  const op = useOp('ONB-02');
  const premarcadas = op === 'a' || op === 'b';
  return (
    <>
      <h3>Antes de empezar</h3>
      <Anota id="ONB-02" />
      {op === 'd' ? (
        <>
          <p className="pequeno">Elige qué usos opcionales aceptas. Puedes cambiarlos cuando quieras en «Mis privacidades».</p>
          {FINALIDADES_OPCIONALES.map((f) => (
            <Caja key={f} on={false}>
              {f}
            </Caja>
          ))}
          <div className="fila" style={{ marginTop: 10, flexWrap: 'nowrap' }}>
            <button className="btn" style={{ flex: 1 }} tabIndex={-1}>
              Rechazar todo
            </button>
            <button className="btn" style={{ flex: 1 }} tabIndex={-1}>
              Aceptar selección
            </button>
          </div>
          <div className="nota-caja nota-laboral">
            <strong>Esto no requiere tu consentimiento porque es parte de tu relación laboral:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {BASE_LABORAL.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <>
          <p className="pequeno">Para usar la app, acepta los siguientes tratamientos:</p>
          {[...BASE_LABORAL, ...FINALIDADES_OPCIONALES].map((f) => (
            <Caja key={f} on={premarcadas}>
              {f}
            </Caja>
          ))}
          {op === 'b' && <p className="pequeno muted">Puedes desmarcar las casillas que no desees.</p>}
          <button className="btn btn-prim" style={{ width: '100%', marginTop: 12, padding: '14px', fontSize: 18 }} tabIndex={-1}>
            Acepto todo
          </button>
          {op === 'a' ? (
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <span style={{ color: '#b9bfc6', fontSize: 11 }}>Rechazar</span>
            </div>
          ) : (
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button className="btn btn-chico" tabIndex={-1}>
                Rechazar
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ---------- Marcar asistencia (ASI-01, ASI-03) ----------
const PUNTOS: Record<string, string> = { a: '1 440', b: '600', c: '2', d: '0 coordenadas' };

export function Asistencia() {
  const metodo = useOp('ASI-01');
  const geo = useOp('ASI-03');
  const permanente = geo === 'a' || geo === 'b';
  const [marcando, setMarcando] = useState(false);
  useEffect(() => {
    if (!marcando) return;
    const h = setTimeout(() => setMarcando(false), 2500);
    return () => clearTimeout(h);
  }, [marcando]);
  const activa = permanente || marcando;
  return (
    <>
      <div className="fila" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Marcar asistencia</h3>
        {activa && <span className="pastilla-ubic">{geo === 'd' ? 'Verificando sede' : 'Ubicación activa'}</span>}
      </div>
      <Anota id="ASI-03" />
      <p className="pequeno muted">Turno: 07:00–17:00 · Sede Arequipa</p>
      <div className="nota-caja" style={{ textAlign: 'center' }}>
        <Anota id="ASI-01" />
        {(metodo === 'a' || metodo === 'b') && (
          <>
            <div style={{ fontSize: 54 }} aria-hidden="true">
              🙂
            </div>
            <strong>Mira a la cámara</strong>
            <p className="pequeno">Reconocimiento facial obligatorio para marcar.</p>
            {metodo === 'b' && <p className="pequeno muted">Firmaste el consentimiento de biometría el 02/03/2026. No hay otro método disponible.</p>}
          </>
        )}
        {metodo === 'c' && (
          <>
            <strong>¿Cómo quieres marcar?</strong>
            <div className="fila" style={{ justifyContent: 'center', marginTop: 8 }}>
              <button className="btn" tabIndex={-1}>
                🙂 Rostro
              </button>
              <button className="btn" tabIndex={-1}>
                🔢 PIN
              </button>
            </div>
          </>
        )}
        {metodo === 'd' && (
          <>
            <strong>Ingresa tu PIN o escanea el QR de la sede</strong>
            <div style={{ fontSize: 28, letterSpacing: 8, margin: '8px 0' }}>• • • •</div>
            <button className="btn-link pequeno" tabIndex={-1}>
              Activar reconocimiento facial (opcional)
            </button>
          </>
        )}
      </div>
      <button className="btn btn-prim" style={{ width: '100%' }} onClick={() => setMarcando(true)}>
        {marcando ? 'Marcando…' : 'Marcar ingreso'}
      </button>
      {!permanente && <p className="pequeno muted">{geo === 'd' ? 'Solo se verifica si estás dentro o fuera de la sede, sin coordenadas.' : 'La ubicación se usa solo en el instante de marcar.'}</p>}
      <div className="nota-caja" style={{ marginTop: 12 }}>
        <div className="pequeno muted">Puntos de ubicación registrados hoy</div>
        <div className="contador">{PUNTOS[geo] ?? '—'}</div>
        {geo === 'a' && <div className="pequeno error">Incluye puntos fuera de tu jornada (por ejemplo, 23:40).</div>}
        {geo === 'b' && <div className="pequeno muted">Uno por minuto durante tu turno de 10 horas.</div>}
      </div>
    </>
  );
}

// ---------- Mi salud (SAL-01) ----------
const JEFE_VE: Record<string, (s: NonNullable<Personaje['salud']>) => string> = {
  a: (s) => `Tu jefe ve tu diagnóstico (${s.diagnostico}), tus exámenes y tu medicación.`,
  b: (s) => `Tu jefe ve tu diagnóstico (${s.diagnostico}).`,
  c: () => 'Tu jefe solo ve «Apto», sin restricciones.',
  d: (s) => `Tu jefe ve «${s.aptitud}: ${s.restriccion.toLowerCase()}», sin detalle clínico.`,
};

export function MiSalud() {
  const op = useOp('SAL-01');
  const s = usePersona('rosa').salud!;
  return (
    <>
      <h3>Mi salud ocupacional</h3>
      <p className="pequeno muted">Tu propio informe siempre está completo: tienes derecho a conocerlo.</p>
      <dl className="persona" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px', margin: 0 }}>
        <dt className="muted">Aptitud</dt>
        <dd style={{ margin: 0 }}>{s.aptitud}</dd>
        <dt className="muted">Restricción</dt>
        <dd style={{ margin: 0 }}>{s.restriccion}</dd>
        <dt className="muted">Diagnóstico</dt>
        <dd style={{ margin: 0 }}>{s.diagnostico}</dd>
        <dt className="muted">Exámenes</dt>
        <dd style={{ margin: 0 }}>{s.examenes}</dd>
        <dt className="muted">Medicación</dt>
        <dd style={{ margin: 0 }}>{s.medicacion}</dd>
      </dl>
      <div className="nota-caja">
        <Anota id="SAL-01" />
        <div>
          <strong>Qué ve tu jefe: </strong>
          {JEFE_VE[op]?.(s)}
        </div>
      </div>
    </>
  );
}

// ---------- Asistente (IA-01, IA-02, IA-03) ----------
const FUENTES: Record<string, string> = {
  a: 'Todos tus correos y chats (lectura automática)',
  b: 'Tu calendario corporativo',
  c: 'Solo lo que tú compartas conmigo',
};
const PROVEEDOR: Record<string, ReactNode> = {
  a: <span style={{ fontSize: 10, color: '#9aa3ad' }}>Al usar el asistente aceptas los términos del proveedor.</span>,
  b: <span className="pequeno">Aviso: el proveedor usa datos anonimizados de las conversaciones para mejorar su servicio.</span>,
  c: <span className="pequeno ok">Tus conversaciones no se usan para entrenar modelos (desactivado por contrato).</span>,
};
const EVALUACION: Record<string, ReactNode> = {
  a: null,
  b: null,
  c: <span className="pequeno">Aviso: el asistente genera un puntaje de productividad que ve tu jefe. Una persona lo revisa antes de usarlo.</span>,
  d: <span className="pequeno">El asistente no genera puntajes ni evaluaciones sobre ti.</span>,
  e: <span className="pequeno">Tu resumen de actividad de la semana (solo tú lo ves): 12 tareas cerradas, 3 reuniones.</span>,
};

export function Asistente() {
  const fuentes = useOp('IA-01');
  const prov = useOp('IA-02');
  const ev = useOp('IA-03');
  return (
    <>
      <h3>Asistente</h3>
      <div className="nota-caja" style={{ background: '#e8f7ff' }}>
        🤖 Hola, Rosa. ¿En qué te ayudo hoy?
      </div>
      <div className="bloque">
        <strong className="pequeno">Qué puedo leer</strong>
        <Anota id="IA-01" />
        <div>{FUENTES[fuentes]}</div>
      </div>
      <div className="bloque">
        <Anota id="IA-02" />
        <div>{PROVEEDOR[prov]}</div>
      </div>
      <div className="bloque">
        <Anota id="IA-03" />
        <div>{EVALUACION[ev] ?? <span className="muted pequeno">(Sin aviso sobre evaluaciones.)</span>}</div>
      </div>
      <div className="campo" style={{ marginTop: 12 }}>
        <div className="input muted">Escribe un mensaje…</div>
      </div>
    </>
  );
}

// ---------- Mis privacidades (ONB-03, PER-01, PER-02) ----------
function Interruptor({ etiqueta, on, bloqueado, detalle }: { etiqueta: string; on: boolean; bloqueado?: boolean; detalle?: string }) {
  return (
    <div className="interruptor">
      <span>
        {etiqueta}
        {detalle && <span className="muted pequeno" style={{ display: 'block' }}>{detalle}</span>}
      </span>
      <span className={`sw ${on ? 'on' : ''} ${bloqueado ? 'bloq' : ''}`} role="switch" aria-checked={on} aria-disabled={bloqueado} aria-label={etiqueta} />
    </div>
  );
}

const CELULAR: Record<string, [boolean, string]> = {
  a: [true, 'Visible para toda la empresa (no se puede cambiar)'],
  b: [true, 'Visible para tu equipo (no se puede cambiar)'],
  c: [true, 'Visible solo para tu supervisor (no se puede cambiar)'],
  d: [false, 'Oculto. Tú decides si lo muestras y a quién.'],
};
const CUMPLE: Record<string, [boolean, string]> = {
  a: [true, 'Fecha completa y foto visibles para todos (no se puede cambiar)'],
  b: [true, 'Día y mes, visibles para tu equipo'],
  c: [false, 'Nada visible. Puedes activar día y mes.'],
};

export function Privacidades() {
  const rev = useOp('ONB-03');
  const cel = useOp('PER-01');
  const cum = useOp('PER-02');
  const onb = useOp('ONB-02');
  const opcionalesOn = onb === 'a' || onb === 'b';
  return (
    <>
      <h3>Mis privacidades</h3>
      <Anota id="PER-01" />
      <Interruptor etiqueta="Mostrar mi celular" on={CELULAR[cel][0]} bloqueado={cel !== 'd'} detalle={CELULAR[cel][1]} />
      <Anota id="PER-02" />
      <Interruptor etiqueta="Mostrar cumpleaños y foto" on={CUMPLE[cum][0]} bloqueado={cum === 'a'} detalle={CUMPLE[cum][1]} />
      <h4 style={{ marginTop: 14, fontSize: 15 }}>Usos opcionales</h4>
      <Anota id="ONB-03" />
      {rev === 'a' ? (
        <div className="nota-caja">Para revocar, envía el formulario F-12 firmado a RR. HH.</div>
      ) : (
        <>
          {FINALIDADES_OPCIONALES.map((f) => (
            <Interruptor key={f} etiqueta={f} on={opcionalesOn} />
          ))}
          <p className="pequeno muted">
            {rev === 'b'
              ? 'Al desactivar un uso, te pediremos confirmarlo en tres pantallas.'
              : 'Los cambios se aplican al instante y no tienen consecuencias laborales.'}
          </p>
        </>
      )}
    </>
  );
}
