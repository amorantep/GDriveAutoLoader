import { describe, expect, it } from 'vitest';
import { DATOS } from '../src/model/datos';
import { codificar, decodificar, leerArchivo, LARGO_OBJETIVO } from '../src/codec/codigo';
import { eleccionesModo, estadoNuevo } from '../src/engine/indicadores';
import type { EstadoGrupo } from '../src/model/types';

const texto280 = (base: string) => {
  let t = base;
  while (t.length < 280) t += ' ' + base;
  return t.slice(0, 280);
};

// Textos realistas, no repetitivos, de 280 caracteres.
const JUSTIFICACION =
  'Priorizamos la protección del titular y la solidez legal porque la geolocalización continua y la biometría sin alternativa exponen a la minera ante la ANPD y SUNAFIL. Aceptamos perder utilidad operativa: el supervisor ya no ve el recorrido, pero el botón de emergencia cubre derrumbes.';
const DIFICIL =
  'ASI-03 fue la más discutida. Operaciones insistió en que, sin ubicación continua durante el turno, el rescate en socavón demora. Elegimos registrar solo al marcar y activar el mapa en emergencias con registro de quién lo activa, porque rastrear 24/7 es desproporcionado y genera rechazo.';
const EVENTO =
  'Cambiamos ASI-02: pasamos a supresión automática al cese con constancia del proveedor. Mantuvimos ASI-05 en 90 días porque auditoría lo necesita para investigar fraudes. Notificaremos a la ANPD dentro de 48 horas y a los trabajadores afectados, con el detalle de qué datos se filtraron.';
const RIESGOS = [
  'El rastreo continuo 24/7 incluye horas fuera de la jornada: trata la localización sin finalidad legítima, contra el principio de proporcionalidad. Es la exposición más grave ante la ANPD y una prueba fuerte para el sindicato ante SUNAFIL. Recomendamos suspenderlo antes del lanzamiento del piloto.',
  'Publicar en el muro del equipo el nombre, la lesión y el detalle médico de un incidente revela datos de salud sin base legal y vulnera la confidencialidad de la Ley 29783. Además expone al trabajador frente a sus pares. El detalle debe quedar solo en SST y el médico ocupacional de la sede.',
  'El puntaje de productividad con revisión humana es lícito, pero debe informarse de forma previa y clara. Sin una DPIA (evaluación de impacto) que justifique la necesidad y sin un canal para impugnar, la empresa carga con la prueba si un trabajador reclama. Documenten la lógica y los criterios usados.',
];
const RECOMENDACIONES = [
  'Configurar la geolocalización solo en el instante de marcar y habilitar un mapa en vivo únicamente al declarar una emergencia, con registro de quién la activó, cuándo y por qué motivo. Informar a los trabajadores y al sindicato de esta regla antes del lanzamiento y revisarla en seis meses.',
  'Reemplazar la publicación del incidente por un aviso preventivo anónimo para el equipo y restringir el detalle clínico al médico ocupacional y al comité de SST. Registrar los accesos al módulo de salud y conservar esos logs al menos dos años, como exige el artículo 46.3 del Reglamento vigente.',
  'Definir plazos de conservación para el historial de ubicación y las plantillas biométricas, pedir al proveedor constancias de supresión al cese y firmar cláusulas que prohíban usar los datos para entrenar modelos. Revisar la matriz de visibilidad por rol cada semestre con TI, RR. HH. y Legal.',
];

function estadoNormal(): EstadoGrupo {
  const st = estadoNuevo(DATOS, 'mineria');
  st.alias = 'Grupo Cóndor';
  st.elecciones = { ...eleccionesModo(DATOS, 'B'), 'ASI-03': 'c', 'ASI-04': 'b' };
  st.revisadas = DATOS.catalogo.decisiones.filter((d) => d.nucleo).map((d) => d.id);
  st.declaracion = { prioriza: ['RT', 'EL'], sacrifica: 'UO', justificacion: JUSTIFICACION, dificil: { decision: 'ASI-03', texto: DIFICIL } };
  st.eventos['EV-01'] = { respuesta: 'cambiamos', decisiones: ['ASI-02'], texto: EVENTO, eleccionesAntes: eleccionesModo(DATOS, 'A') };
  return st;
}

describe('códec de grupo', () => {
  it('ida y vuelta sin pérdida con textos al máximo (tildes, ñ, comillas y emojis)', () => {
    const raro = texto280('Ñandú «citas» "dobles" \'simples\' — áéíóú ÁÉÍÓÚ ü ¿¡ 😀👩🏽‍⚖️🇵🇪 \\ / & % # < > {} []');
    const st = estadoNormal();
    st.alias = 'Ñoños «Grupo» 😀 áéí'.slice(0, 30);
    st.declaracion = { prioriza: ['RT', 'AC'], sacrifica: 'CI', justificacion: raro, dificil: { decision: 'SAL-01', texto: raro } };
    for (const ev of DATOS.eventos.eventos) {
      st.eventos[ev.id] = {
        respuesta: 'mantenemos',
        decisiones: ['ONB-01', 'IA-03'],
        texto: raro,
        eleccionesAntes: eleccionesModo(DATOS, 'A'),
        ...(ev.checklistEvidencia ? { evidencia: ['logs', 'matriz'] } : {}),
      };
    }
    st.dictamen = { marcadas: ['ASI-03', 'SAL-02'], riesgos: [raro, raro, raro], recomendaciones: [raro, raro, raro], revelado: true };
    const r = decodificar(DATOS, codificar(DATOS, st));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.estado).toEqual(st);
  });

  it('ida y vuelta de un estado recién creado', () => {
    const st = estadoNuevo(DATOS, 'finanzas');
    const r = decodificar(DATOS, codificar(DATOS, st));
    expect(r.ok && r.estado).toEqual(st);
  });

  it(`caso normal con texto realista: ≤ ${LARGO_OBJETIVO} caracteres`, () => {
    const codigo = codificar(DATOS, estadoNormal());
    console.log(`Largo del código, caso normal: ${codigo.length} caracteres`);
    expect(codigo.length).toBeLessThanOrEqual(LARGO_OBJETIVO);
  });

  it('dictamen del grupo 5: se mide y se reporta', () => {
    const st = estadoNuevo(DATOS, 'abogados');
    st.revisadas = ['ASI-03', 'SAL-02'];
    st.declaracion = { prioriza: ['EL', 'RT'], sacrifica: 'CI', justificacion: JUSTIFICACION, dificil: { decision: 'ASI-03', texto: DIFICIL } };
    st.dictamen = { marcadas: ['ASI-03', 'SAL-02', 'IA-03'], riesgos: RIESGOS, recomendaciones: RECOMENDACIONES, revelado: true };
    const codigo = codificar(DATOS, st);
    console.log(`Largo del código, dictamen del grupo 5: ${codigo.length} caracteres`);
    const r = decodificar(DATOS, codigo);
    expect(r.ok && r.estado).toEqual(st);
  });

  it('un carácter alterado da un error de crc legible', () => {
    const codigo = codificar(DATOS, estadoNormal());
    const i = 20;
    const alterado = codigo.slice(0, i) + (codigo[i] === 'A' ? 'B' : 'A') + codigo.slice(i + 1);
    const r = decodificar(DATOS, alterado);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toBe('crc');
      expect(r.mensaje).toMatch(/alterado o incompleto/);
    }
  });

  it('un código truncado o de otra versión se rechaza con motivo', () => {
    const codigo = codificar(DATOS, estadoNormal());
    const r1 = decodificar(DATOS, codigo.slice(0, 200));
    expect(r1.ok).toBe(false);
    const r2 = decodificar(DATOS, codigo.replace('PBD1', 'PBD2'));
    expect(!r2.ok && r2.motivo).toBe('version');
    const r3 = decodificar(DATOS, 'hola');
    expect(!r3.ok && r3.motivo).toBe('formato');
  });

  it('tolera saltos de línea y espacios pegados por el chat', () => {
    const codigo = codificar(DATOS, estadoNormal());
    const partido = codigo.slice(0, 100) + '\n ' + codigo.slice(100);
    expect(decodificar(DATOS, partido).ok).toBe(true);
  });

  it('lee el archivo JSON del grupo', () => {
    const st = estadoNormal();
    const r = leerArchivo(DATOS, JSON.stringify(st));
    expect(r.ok && r.estado).toEqual(st);
    expect(leerArchivo(DATOS, '{no json').ok).toBe(false);
  });
});
