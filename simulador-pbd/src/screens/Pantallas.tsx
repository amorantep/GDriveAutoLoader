import type { ComponentType } from 'react';
import { PANTALLAS } from './ids';
import type { Vista } from './ids';
import { Aceptacion, Asistencia, Asistente, MiSalud, Privacidades, Registro, usePersona } from './Colaborador';
import { Desempeno, Directorio, FichaLucia, Mapa, SaludEquipo } from './Supervisor';
import { useVista } from '../ui/comun';

export const COMPONENTES: Record<string, ComponentType> = {
  'colaborador/onboarding-registro': Registro,
  'colaborador/onboarding-aceptacion': Aceptacion,
  'colaborador/asistencia': Asistencia,
  'colaborador/salud': MiSalud,
  'colaborador/asistente': Asistente,
  'colaborador/privacidades': Privacidades,
  'supervisor/directorio': Directorio,
  'supervisor/mapa': Mapa,
  'supervisor/ficha-lucia': FichaLucia,
  'supervisor/salud': SaludEquipo,
  'supervisor/desempeno': Desempeno,
};

/** Borde lateral con las decisiones que afectan la pantalla; clic → Panel del DPO. */
function BordeDecisiones({ ids }: { ids: string[] }) {
  const { irADecision } = useVista();
  return (
    <div className="borde-decisiones" aria-label="Decisiones que afectan esta pantalla">
      {ids.map((id, i) => (
        <span key={id}>
          {i > 0 && '· '}
          <button type="button" onClick={() => irADecision(id)} title={`Ver ${id} en el Panel del DPO`}>
            {id}
          </button>
        </span>
      ))}
    </div>
  );
}

export function Marco({ pantalla }: { pantalla: string }) {
  const info = PANTALLAS.find((p) => p.id === pantalla)!;
  const C = COMPONENTES[pantalla];
  return info.vista === 'colaborador' ? <MarcoCelular ids={info.decisiones} C={C} /> : <MarcoEscritorio ids={info.decisiones} C={C} />;
}

function MarcoCelular({ ids, C }: { ids: string[]; C: ComponentType }) {
  const rosa = usePersona('rosa');
  return (
    <div className="escenario">
      <div className="celular" aria-label={`Celular de ${rosa.nombre}`}>
        <div className="celular-pantalla">
          <div className="celular-top">
            <span>9:41</span>
            <span>▂▄▆ 🔋</span>
          </div>
          <div className="celular-app">
            <span>App del Colaborador</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{rosa.nombre.split(' ')[0]}</span>
          </div>
          <div className="celular-cuerpo">
            <C />
          </div>
        </div>
      </div>
      <BordeDecisiones ids={ids} />
    </div>
  );
}

function MarcoEscritorio({ ids, C }: { ids: string[]; C: ComponentType }) {
  const jorge = usePersona('jorge');
  const { datos } = useVista();
  return (
    <div className="escenario" style={{ flex: 1 }}>
      <div className="escritorio">
        <div className="escritorio-top">
          <span>App del Colaborador · Portal del supervisor</span>
          <span>
            {jorge.nombre} · {datos.personajes.empresa}
          </span>
        </div>
        <div className="escritorio-cuerpo">
          <C />
        </div>
      </div>
      <BordeDecisiones ids={ids} />
    </div>
  );
}

export function VistaPantallas({ vista, pantalla, setPantalla }: { vista: Vista; pantalla: string; setPantalla: (id: string) => void }) {
  const lista = PANTALLAS.filter((p) => p.vista === vista);
  const actual = lista.some((p) => p.id === pantalla) ? pantalla : lista[0].id;
  return (
    <div className="vista">
      <nav className="nav-pantallas" aria-label="Pantallas">
        {lista.map((p) => (
          <button key={p.id} aria-current={p.id === actual} onClick={() => setPantalla(p.id)}>
            {p.titulo}
            <small>{p.decisiones.join(' · ')}</small>
          </button>
        ))}
      </nav>
      <Marco pantalla={actual} />
    </div>
  );
}
