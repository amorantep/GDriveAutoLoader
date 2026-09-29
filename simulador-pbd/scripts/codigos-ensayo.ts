// Genera docs/codigos-ensayo.txt: 5 códigos de ejemplo (uno por sector) para ensayar la plenaria.
// Uso: npm run ensayo
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DATOS } from '../src/model/datos';
import { codificar, decodificar } from '../src/codec/codigo';
import { eleccionesModo, estadoNuevo, calcularIndicadores } from '../src/engine/indicadores';
import type { EstadoGrupo } from '../src/model/types';

const B = eleccionesModo(DATOS, 'B');
const nucleo = DATOS.catalogo.decisiones.filter((d) => d.nucleo).map((d) => d.id);
const ts = (hh: number, mm: number) => new Date(Date.UTC(2026, 9, 1, hh + 5, mm)).toISOString(); // 01/10/2026, hora de Lima

function grupo(sector: string, alias: string, cambios: Record<string, string>, extra: Partial<EstadoGrupo>, hora: [number, number]): EstadoGrupo {
  const st = estadoNuevo(DATOS, sector);
  return { ...st, alias, elecciones: { ...st.elecciones, ...cambios }, revisadas: nucleo, ...extra, ts: ts(...hora) };
}

const grupos: EstadoGrupo[] = [
  grupo(
    'mineria',
    'Cóndor',
    { 'ONB-02': 'd', 'PER-01': 'c', 'ASI-01': 'c', 'ASI-02': 'd', 'ASI-03': 'b', 'ASI-04': 'b', 'SAL-01': 'd', 'SAL-02': 'c', 'IA-02': 'c', 'IA-03': 'd' },
    {
      declaracion: {
        prioriza: ['UO', 'EL'],
        sacrifica: 'CI',
        justificacion: 'En socavón la ubicación durante el turno salva vidas; por eso aceptamos rastreo solo en jornada y mapa en emergencias con registro. Pagamos más por la alternativa al rostro y por la supresión automática.',
        dificil: { decision: 'ASI-03', texto: 'Operaciones pidió 24/7. Lo limitamos al turno: fuera de jornada no hay finalidad que lo justifique.' },
      },
      eventos: {
        'EV-05': {
          respuesta: 'mantenemos',
          decisiones: ['ASI-03', 'ASI-04'],
          texto: 'Mantenemos: el mapa ya se activa en emergencias. Un GPS continuo para todos no evita accidentes y rompe la confianza.',
          eleccionesAntes: { ...estadoNuevo(DATOS, 'mineria').elecciones, 'ASI-03': 'b', 'ASI-04': 'b' },
        },
      },
    },
    [11, 42],
  ),
  grupo(
    'finanzas',
    'Auditores',
    { 'ONB-02': 'd', 'PER-01': 'd', 'ASI-01': 'd', 'ASI-02': 'e', 'ASI-03': 'c', 'ASI-04': 'c', 'SAL-01': 'd', 'SAL-02': 'c', 'IA-02': 'c', 'IA-03': 'd', 'ASI-05': 'b' },
    {
      declaracion: {
        prioriza: ['EL', 'RP'],
        sacrifica: 'UO',
        justificacion: 'La SBS y la reputación mandan. Auditoría tendrá el historial vía RR. HH. con motivo registrado, no un mapa. Retenemos 12 meses para investigar fraudes.',
        dificil: { decision: 'ASI-04', texto: 'Auditoría quería trazabilidad total. Se la damos a RR. HH. con motivo, no al supervisor.' },
      },
      eventos: {
        'EV-01': {
          respuesta: 'cambiamos',
          decisiones: ['ASI-05'],
          texto: 'Bajamos la retención a 90 días. La plantilla nunca salió del celular, pero el historial sí estaba en la nube.',
          eleccionesAntes: { ...B, 'ASI-02': 'e', 'ASI-05': 'b' },
        },
      },
    },
    [11, 44],
  ),
  grupo(
    'publico',
    'Programa Rural',
    { 'ONB-02': 'c', 'PER-01': 'b', 'ASI-01': 'd', 'ASI-02': 'c', 'ASI-03': 'd', 'ASI-04': 'd', 'SAL-01': 'c', 'SAL-02': 'b', 'IA-02': 'b', 'IA-03': 'd' },
    {
      declaracion: {
        prioriza: ['CI', 'EL'],
        sacrifica: 'RP',
        justificacion: 'Con presupuesto rígido elegimos PIN y borrado manual por TI. Lo que entregamos por acceso a la información es solo marcó / no marcó.',
        dificil: { decision: 'ASI-02', texto: 'La supresión automática cuesta más este año; dejamos borrado manual con control trimestral.' },
      },
      eventos: {},
    },
    [11, 45],
  ),
  grupo(
    'telecom',
    'Tiendas',
    { 'ONB-02': 'c', 'PER-01': 'c', 'ASI-01': 'c', 'ASI-02': 'd', 'ASI-03': 'c', 'ASI-04': 'd', 'SAL-01': 'd', 'SAL-02': 'c', 'IA-02': 'c', 'IA-03': 'c' },
    {
      declaracion: {
        prioriza: ['UO', 'AC'],
        sacrifica: 'RT',
        justificacion: 'Comercial necesita el ranking para los bonos: lo aceptamos con aviso y revisión humana obligatoria. A cambio, nada de mapa en vivo.',
        dificil: { decision: 'IA-03', texto: 'El puntaje tensiona la confianza; sin revisión humana sería una decisión automatizada.' },
      },
      eventos: {},
    },
    [11, 47],
  ),
  grupo(
    'abogados',
    'Ríos',
    {},
    {
      revisadas: ['ASI-03', 'SAL-02', 'IA-03'],
      declaracion: {
        prioriza: ['EL', 'RT'],
        sacrifica: 'CI',
        justificacion: 'Como asesores, lo primero es que el cliente no quede expuesto ante la ANPD ni SUNAFIL.',
        dificil: { decision: 'IA-03', texto: 'El puntaje con revisión humana es lícito, pero exige informar y permitir impugnar.' },
      },
      eventos: {},
      dictamen: {
        marcadas: ['ASI-03', 'SAL-02', 'IA-03'],
        riesgos: [
          'Rastreo 24/7, también fuera de jornada: desproporcionado.',
          'Muro con nombre y detalle médico: revela datos de salud.',
          'Puntaje de productividad sin canal de impugnación.',
        ],
        recomendaciones: ['Ubicación solo al marcar y mapa en emergencias.', 'Aviso preventivo anónimo; detalle solo para SST.', 'Informar la lógica y habilitar revisión.'],
        revelado: true,
      },
    },
    [11, 49],
  ),
];

const lineas: string[] = [
  '# Códigos de ensayo para la plenaria (datos ficticios)',
  '# Pégalos en «Docente > Tablero» (todos a la vez, uno por línea).',
  `# Generados con el catálogo ${DATOS.catalogo.version}. Si cambias el catálogo, vuelve a correr: npm run ensayo`,
  '',
];
for (const g of grupos) {
  const c = codificar(DATOS, g);
  const r = decodificar(DATOS, c);
  if (!r.ok) throw new Error(`El código de ${g.sector} no se decodifica: ${r.mensaje}`);
  const ind = calcularIndicadores(DATOS, g, g.sector);
  lineas.push(`# ${g.alias} (${g.sector}) · ${c.length} caracteres · RT ${ind.valor.RT} EL ${ind.valor.EL} UO ${ind.valor.UO} CI ${ind.valor.CI} AC ${ind.valor.AC} RP ${ind.valor.RP}`);
  lineas.push(c);
  lineas.push('');
}
const dir = resolve(import.meta.dirname, '../docs');
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, 'codigos-ensayo.txt'), lineas.join('\n'));
console.log(lineas.filter((l) => l.startsWith('# ') && l.includes('caracteres')).join('\n'));
