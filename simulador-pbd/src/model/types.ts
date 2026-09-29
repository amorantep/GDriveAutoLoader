// Tipos de los cinco JSON de data/. Si cambias la forma de un JSON, actualiza este archivo y validar.ts.

export const INDICADORES = ['RT', 'EL', 'UO', 'CI', 'AC', 'RP'] as const;
export type IndicadorId = (typeof INDICADORES)[number];
export type Efectos = Record<IndicadorId, number>;

export const ZONAS = ['R', 'A', 'V'] as const;
export type ZonaId = (typeof ZONAS)[number];

export const TIPOS_NORMA = ['obligacion-peru', 'referencia-ue', 'estandar', 'buena-practica'] as const;
export type TipoNorma = (typeof TIPOS_NORMA)[number];

export interface Opcion {
  id: string;
  modo?: 'A' | 'B';
  zona: ZonaId;
  etiqueta: string;
  efectos: Efectos;
  ajustesSector?: Record<string, Partial<Efectos>>;
  patronOscuro?: string;
  nota?: string;
  /** Texto opcional del recuadro «Con esta configuración, RR. HH. ve: …». */
  rrhh?: string;
}

export interface Norma {
  ref: string;
  tipo: TipoNorma;
  verificar?: boolean;
}

export interface Decision {
  id: string;
  modulo: string;
  dimension: string;
  nucleo: boolean;
  titulo: string;
  pregunta: string;
  hoepman: string[];
  normas: Norma[];
  opciones: Opcion[];
  criterio: string;
  evidencia: string;
}

export interface Catalogo {
  version: string;
  nota?: string;
  indicadores: { id: IndicadorId; nombre: string; descripcion: string }[];
  zonas: Record<ZonaId, { nombre: string; descripcion: string; icono: string }>;
  dimensiones: { id: string; nombre: string; pregunta: string }[];
  modulos: { id: string; nombre: string }[];
  decisiones: Decision[];
}

export type Peso = 'Bajo' | 'Medio' | 'Alto';

export interface Sector {
  id: string;
  grupo: number;
  nombre: string;
  organizacion: string;
  contexto: string;
  peticion: { quien: string; texto: string };
  decisionesTensas: string[];
  pesos?: Record<IndicadorId, Peso>;
  usaPesosDe?: string;
  modoDictamen?: boolean;
  configuracionInicial?: string;
  tarea?: string;
  opcional?: boolean;
  notaOpcional?: string;
}

export interface Preset {
  descripcion: string;
  respuestasOcultas: string[];
  elecciones: Record<string, string>;
}

export interface Sectores {
  version: string;
  pesos: Record<Peso, number>;
  sectores: Sector[];
  presets: Record<string, Preset>;
}

export interface ReglaEfecto {
  decision: string;
  opciones: string[];
  delta: Partial<Efectos>;
}

export interface Evento {
  id: string;
  codigo: string;
  titulo: string;
  texto: string;
  ponePrueba: string[];
  efectos?: ReglaEfecto[];
  mensajeSinDatos?: string;
  dossier?: { decision: string; opciones: string[]; item: string }[];
  efectoPorItem?: Partial<Efectos>;
  checklistEvidencia?: { id: string; etiqueta: string }[];
  efectoPorFaltante?: Partial<Efectos>;
  reabre?: string[];
  pregunta: string;
  uso: string;
}

export interface Eventos {
  version: string;
  nota?: string;
  eventos: Evento[];
}

export interface Personaje {
  id: string;
  nombre: string;
  rol: string;
  sede: string;
  estado: string;
  fechaCese?: string;
  supervisor?: string;
  contratista?: string;
  datos: {
    codigo: string;
    area: string;
    correo: string;
    celular?: string;
    domicilio?: string;
    nacimiento?: string;
    estadoCivil?: string;
    hijos?: number;
    redes?: string;
    contactoEmergencia?: string;
  };
  salud?: { aptitud: string; restriccion: string; diagnostico: string; examenes: string; medicacion: string };
  incidente?: { fecha: string; tipo: string; detalle: string };
  asistencia?: { marcacionesHoy: number; puntosUbicacionModoA: number };
  biometria?: { plantillaActivaModoA: boolean };
}

export interface Personajes {
  version: string;
  nota?: string;
  empresa: string;
  personajes: Personaje[];
}

export interface Votacion {
  orden: number;
  dimension: string;
  decision: string;
  pantalla: string;
  pregunta: string;
}

export interface Votaciones {
  version: string;
  nota?: string;
  votaciones: Votacion[];
}

export interface Datos {
  catalogo: Catalogo;
  sectores: Sectores;
  eventos: Eventos;
  personajes: Personajes;
  votaciones: Votaciones;
}

/** Estado de un grupo del taller (SPEC §6.1). */
export interface RespuestaEvento {
  respuesta?: 'mantenemos' | 'cambiamos';
  decisiones: string[];
  texto: string;
  evidencia?: string[];
  eleccionesAntes?: Record<string, string>;
}

export interface Declaracion {
  prioriza: [string, string];
  sacrifica: string;
  justificacion: string;
  dificil: { decision: string; texto: string };
}

export interface Dictamen {
  marcadas: string[];
  riesgos: string[];
  recomendaciones: string[];
  revelado: boolean;
}

export interface EstadoGrupo {
  v: 1;
  cat: string;
  sector: string;
  alias?: string;
  elecciones: Record<string, string>;
  revisadas: string[];
  declaracion?: Declaracion;
  eventos: Record<string, RespuestaEvento>;
  dictamen?: Dictamen;
  ts: string;
}

export const MAX_TEXTO = 280;
export const MAX_ALIAS = 30;
