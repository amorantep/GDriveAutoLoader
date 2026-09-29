// Pantallas de la vista Supervisor (SPEC §3.2). Todo se deriva de las elecciones del estado.
import { useState } from 'react';
import { Anota, useOp } from '../ui/comun';
import { usePersona } from './Colaborador';
import type { Personaje } from '../model/types';

const COLORES: Record<string, string> = { rosa: '#b04a7a', miguel: '#2f6f9f', lucia: '#7a5bb0' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fecha = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};

function Avatar({ p, foto }: { p: Personaje; foto: boolean }) {
  const ini = p.nombre
    .split(' ')
    .map((x) => x[0])
    .join('');
  return foto ? (
    <div className="avatar" style={{ background: COLORES[p.id] ?? '#555' }} aria-label={`Foto de ${p.nombre}`}>
      {ini}
    </div>
  ) : (
    <div className="avatar" style={{ background: '#c5ccd4' }} aria-label="Sin foto">
      <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
        <circle cx="12" cy="8" r="4" fill="#fff" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="#fff" />
      </svg>
    </div>
  );
}

// ---------- Directorio (PER-01..04) ----------
export function Directorio() {
  const cel = useOp('PER-01');
  const cum = useOp('PER-02');
  const dom = useOp('PER-03');
  const cese = useOp('PER-04');
  const personas = ['rosa', 'miguel', 'lucia'].map(usePersonaFija);
  return (
    <>
      <h3>Directorio del equipo</h3>
      <div className="fila" style={{ marginBottom: 8 }}>
        <Anota id="PER-01" />
        <Anota id="PER-02" />
        <Anota id="PER-03" />
        <Anota id="PER-04" />
      </div>
      <div className="tarjetas-personas">
        {personas.map((p) => {
          const cesada = p.estado === 'cesada';
          if (cesada && cese === 'c') return null;
          const inactiva = cesada && cese === 'b';
          const d = p.datos;
          const nac = d.nacimiento?.split('-').map(Number);
          return (
            <div key={p.id} className={`persona ${inactiva ? 'inactiva' : ''}`}>
              <div className="fila" style={{ flexWrap: 'nowrap' }}>
                <Avatar p={p} foto={cum === 'a'} />
                <div>
                  <strong>{p.nombre}</strong>
                  <div className="pequeno muted">{p.rol}</div>
                  {inactiva ? (
                    <span className="estado-tag" style={{ background: '#e3e7ec' }}>
                      Inactiva
                    </span>
                  ) : (
                    <span className="estado-tag" style={{ background: '#e6f4ea', color: '#1b6e3a' }}>
                      Activa
                    </span>
                  )}
                </div>
              </div>
              <dl>
                <dt>Área</dt>
                <dd>{d.area}</dd>
                <dt>Correo</dt>
                <dd style={{ wordBreak: 'break-all' }}>{d.correo}</dd>
                {d.celular && cel !== 'd' && (
                  <>
                    <dt>Celular</dt>
                    <dd>{d.celular}</dd>
                  </>
                )}
                {nac && cum === 'a' && (
                  <>
                    <dt>Cumpleaños</dt>
                    <dd>{fecha(d.nacimiento!)}</dd>
                  </>
                )}
                {nac && cum === 'b' && (
                  <>
                    <dt>Cumpleaños</dt>
                    <dd>
                      {nac[2]} de {MESES[nac[1] - 1]}
                    </dd>
                  </>
                )}
                {d.domicilio && dom !== 'd' && (
                  <>
                    <dt>Domicilio</dt>
                    <dd>{d.domicilio}</dd>
                  </>
                )}
              </dl>
            </div>
          );
        })}
      </div>
    </>
  );
}
// Hook con nombre distinto para usar dentro de map sin romper las reglas (el orden es fijo).
function usePersonaFija(id: string) {
  return usePersona(id);
}

// ---------- Mapa de asistencia (ASI-03, ASI-04) ----------
function MapaSVG({ fueraDeJornada, recorrido }: { fueraDeJornada: boolean; recorrido: boolean }) {
  return (
    <svg viewBox="0 0 520 250" style={{ width: '100%', maxWidth: 560, background: '#eef3f7', borderRadius: 10 }} role="img" aria-label="Mapa esquemático con la ubicación del equipo">
      <path d="M0 180 C120 150 200 210 320 170 S470 120 520 140" stroke="#cfd8e0" strokeWidth="18" fill="none" />
      <path d="M260 0 L240 250" stroke="#cfd8e0" strokeWidth="12" fill="none" />
      <rect x="170" y="60" width="130" height="80" rx="8" fill="#fff" stroke="#6a7682" strokeWidth="2" />
      <text x="235" y="80" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1b2430">
        Sede Arequipa
      </text>
      <rect x="378" y="20" width="136" height="50" rx="8" fill="#fff" stroke="#6a7682" strokeWidth="2" />
      <text x="446" y="40" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1b2430">
        Campamento Norte
      </text>
      {recorrido && <path d="M60 220 L110 190 L160 160 L200 128 L230 115" stroke="#b3261e" strokeWidth="3" strokeDasharray="6 4" fill="none" />}
      <circle cx="230" cy="115" r="8" fill="#b3261e" />
      <text x="190" y="132" fontSize="12" fontWeight="700" fill="#b3261e">
        Rosa · en vivo
      </text>
      {recorrido && <path d="M300 120 L360 105 L420 90" stroke="#2f6f9f" strokeWidth="3" strokeDasharray="6 4" fill="none" />}
      <circle cx="420" cy="90" r="8" fill="#2f6f9f" />
      <text x="432" y="95" fontSize="12" fontWeight="700" fill="#2f6f9f">
        Miguel
      </text>
      {fueraDeJornada && (
        <>
          <circle cx="60" cy="220" r="8" fill="#6b3fa0" />
          <text x="74" y="236" fontSize="12" fontWeight="700" fill="#6b3fa0">
            Rosa · 23:40 (fuera de jornada, domicilio)
          </text>
        </>
      )}
    </svg>
  );
}

function TablaMarcacion({ sede = true }: { sede?: boolean }) {
  return (
    <table className="tabla" style={{ maxWidth: 560 }}>
      <thead>
        <tr>
          <th>Colaborador</th>
          <th>Hoy</th>
          {sede && <th>Sede</th>}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Rosa Quispe</td>
          <td>✓ Marcó 06:52</td>
          {sede && <td>Sede Arequipa</td>}
        </tr>
        <tr>
          <td>Miguel Torres</td>
          <td>✓ Marcó 07:04</td>
          {sede && <td>Campamento Norte</td>}
        </tr>
      </tbody>
    </table>
  );
}

export function Mapa() {
  const geo = useOp('ASI-03');
  const vista = useOp('ASI-04');
  const [emergencia, setEmergencia] = useState<string | null>(null);
  const fuera = geo === 'a';
  const recorrido = geo === 'a' || geo === 'b';
  const mapa = <MapaSVG fueraDeJornada={fuera} recorrido={recorrido} />;
  return (
    <>
      <h3>Mapa de asistencia</h3>
      <div className="fila" style={{ marginBottom: 8 }}>
        <Anota id="ASI-04" />
        <Anota id="ASI-03" />
      </div>
      {vista === 'a' && (
        <>
          {mapa}
          <p className="pequeno muted">
            {recorrido ? 'Puntos en vivo y recorrido del día.' : geo === 'd' ? 'Sin coordenadas: la configuración solo registra dentro/fuera de la sede.' : 'Solo los puntos de marcación: la app no registra más ubicaciones.'}
          </p>
        </>
      )}
      {vista === 'b' && (
        <>
          <TablaMarcacion />
          <div style={{ marginTop: 12 }}>
            {emergencia ? (
              <>
                <div className="alerta-roja">🚨 Emergencia activada por Jorge Salas a las {emergencia}. Queda registro de la activación.</div>
                {mapa}
                <div>
                  <button className="btn btn-chico" onClick={() => setEmergencia(null)}>
                    Cerrar emergencia
                  </button>
                </div>
              </>
            ) : (
              <button
                className="btn btn-peligro"
                onClick={() => {
                  const d = new Date();
                  setEmergencia(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
                }}
              >
                🚨 Activar emergencia
              </button>
            )}
          </div>
        </>
      )}
      {vista === 'c' && (
        <>
          <TablaMarcacion />
          <div className="nota-caja">Historial disponible solo para RR. HH. con motivo registrado.</div>
        </>
      )}
      {vista === 'd' && <TablaMarcacion />}
      {fuera && vista !== 'a' && <p className="pequeno muted">(La app sigue registrando ubicaciones fuera de la jornada, aunque este panel no las muestre.)</p>}
    </>
  );
}

// ---------- Ficha biométrica de Lucía (ASI-02) ----------
const BIOMETRIA: Record<string, [string, string, string]> = {
  a: ['Activa en la nube del proveedor', '#fdecea', '#b3261e'],
  b: ['Se conserva hasta 30/06/2027', '#fff4d6', '#7a4f00'],
  c: ['Pendiente de borrado manual', '#fff4d6', '#7a4f00'],
  d: ['Suprimida el 30/06/2026 · constancia del proveedor', '#e6f4ea', '#1b6e3a'],
  e: ['No existe: la comparación se hace en el celular', '#e6f4ea', '#1b6e3a'],
};

export function FichaLucia() {
  const op = useOp('ASI-02');
  const lucia = usePersona('lucia');
  const [txt, fondo, color] = BIOMETRIA[op];
  return (
    <>
      <h3>Ficha biométrica</h3>
      <Anota id="ASI-02" />
      <div className="fila">
        <Avatar p={lucia} foto={false} />
        <div>
          <strong>{lucia.nombre}</strong>
          <div className="pequeno muted">
            {lucia.rol} · {lucia.sede} · Cesada el {lucia.fechaCese ? fecha(lucia.fechaCese) : '—'}
          </div>
        </div>
      </div>
      <div className="pequeno muted" style={{ marginTop: 12 }}>
        Plantilla facial
      </div>
      <div className="estado-grande" style={{ background: fondo, color }}>
        {txt}
      </div>
    </>
  );
}

// ---------- Salud del equipo (SAL-01, SAL-02) ----------
export function SaludEquipo() {
  const vista = useOp('SAL-01');
  const muro = useOp('SAL-02');
  const rosa = usePersona('rosa');
  const s = rosa.salud!;
  const inc = rosa.incidente!;
  return (
    <>
      <h3>Salud del equipo</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="persona">
          <Anota id="SAL-01" />
          <strong>{rosa.nombre}</strong>
          <dl>
            {vista === 'a' && (
              <>
                <dt>Diagnóstico</dt>
                <dd>{s.diagnostico}</dd>
                <dt>Exámenes</dt>
                <dd>{s.examenes}</dd>
                <dt>Medicación</dt>
                <dd>{s.medicacion}</dd>
              </>
            )}
            {vista === 'b' && (
              <>
                <dt>Diagnóstico</dt>
                <dd>{s.diagnostico}</dd>
              </>
            )}
            {vista === 'c' && (
              <>
                <dt>Aptitud</dt>
                <dd>Apto</dd>
              </>
            )}
            {vista === 'd' && (
              <>
                <dt>Aptitud</dt>
                <dd>
                  <strong>
                    {s.aptitud}: {s.restriccion.charAt(0).toLowerCase() + s.restriccion.slice(1)}
                  </strong>
                </dd>
              </>
            )}
          </dl>
          {vista === 'c' && <p className="pequeno error" style={{ marginTop: 8 }}>El jefe podría asignarla a trabajos en altura.</p>}
        </div>
        <div className="persona">
          <Anota id="SAL-02" />
          <strong>Muro del equipo</strong>
          <div className="nota-caja">
            {muro === 'a' && (
              <>
                🩹 <strong>{rosa.nombre}</strong> sufrió {s.diagnostico.toLowerCase()} ({inc.detalle.toLowerCase()}). Tratamiento: {s.medicacion.toLowerCase()}.
              </>
            )}
            {muro === 'b' && (
              <>
                ⚠️ <strong>{rosa.nombre}</strong>: incidente por {inc.tipo.toLowerCase()} el {fecha(inc.fecha)}.
              </>
            )}
            {muro === 'c' && <>ℹ️ Aviso preventivo: se registró un incidente por {inc.tipo.toLowerCase()} al levantar carga. Recuerda usar técnicas de levantamiento seguro.</>}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- Evaluación de desempeño (IA-03) ----------
export function Desempeno() {
  const op = useOp('IA-03');
  return (
    <>
      <h3>Evaluación de desempeño</h3>
      <Anota id="IA-03" />
      {(op === 'a' || op === 'c') && (
        <>
          {op === 'c' && <div className="nota-caja">ℹ️ Puntaje generado por el asistente de IA. Se informó a los colaboradores. Requiere revisión humana antes de usarlo.</div>}
          <table className="tabla" style={{ maxWidth: 560 }}>
            <thead>
              <tr>
                <th>Ranking</th>
                <th>Colaborador</th>
                <th>Puntaje de productividad</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>1</td>
                <td>Miguel Torres</td>
                <td>84 / 100</td>
              </tr>
              <tr>
                <td>2</td>
                <td>Rosa Quispe</td>
                <td>61 / 100</td>
              </tr>
            </tbody>
          </table>
          {op === 'c' && (
            <div className="campo" style={{ marginTop: 10, maxWidth: 560 }}>
              <label>
                Revisión humana <span className="ast">*</span>
              </label>
              <div className="input muted">Comentario del supervisor (obligatorio)</div>
            </div>
          )}
        </>
      )}
      {op === 'b' && (
        <table className="tabla" style={{ maxWidth: 560 }}>
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Puntaje</th>
              <th>Bono calculado automáticamente</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Miguel Torres</td>
              <td>84</td>
              <td>S/ 600</td>
            </tr>
            <tr>
              <td>Rosa Quispe</td>
              <td>61</td>
              <td>S/ 0</td>
            </tr>
          </tbody>
        </table>
      )}
      {op === 'd' && <p className="muted">(No hay insumos del asistente para la evaluación.)</p>}
      {op === 'e' && <div className="nota-caja">El asistente no genera insumos para tu evaluación.</div>}
    </>
  );
}
