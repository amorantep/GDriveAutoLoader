// Registro de pantallas derivadas (SPEC §3). Las votaciones de data/votaciones.json las referencian por id.

export type Vista = 'colaborador' | 'supervisor';

export interface PantallaInfo {
  id: string;
  vista: Vista;
  titulo: string;
  decisiones: string[];
}

export const PANTALLAS: PantallaInfo[] = [
  { id: 'colaborador/onboarding-registro', vista: 'colaborador', titulo: 'Registro', decisiones: ['ONB-01'] },
  { id: 'colaborador/onboarding-aceptacion', vista: 'colaborador', titulo: 'Aceptación', decisiones: ['ONB-02'] },
  { id: 'colaborador/asistencia', vista: 'colaborador', titulo: 'Marcar asistencia', decisiones: ['ASI-01', 'ASI-03'] },
  { id: 'colaborador/salud', vista: 'colaborador', titulo: 'Mi salud', decisiones: ['SAL-01'] },
  { id: 'colaborador/asistente', vista: 'colaborador', titulo: 'Asistente', decisiones: ['IA-01', 'IA-02', 'IA-03'] },
  { id: 'colaborador/privacidades', vista: 'colaborador', titulo: 'Mis privacidades', decisiones: ['ONB-03', 'PER-01', 'PER-02'] },
  { id: 'supervisor/directorio', vista: 'supervisor', titulo: 'Directorio del equipo', decisiones: ['PER-01', 'PER-02', 'PER-03', 'PER-04'] },
  { id: 'supervisor/mapa', vista: 'supervisor', titulo: 'Mapa de asistencia', decisiones: ['ASI-03', 'ASI-04'] },
  { id: 'supervisor/ficha-lucia', vista: 'supervisor', titulo: 'Ficha biométrica de Lucía', decisiones: ['ASI-02'] },
  { id: 'supervisor/salud', vista: 'supervisor', titulo: 'Salud del equipo', decisiones: ['SAL-01', 'SAL-02'] },
  { id: 'supervisor/desempeno', vista: 'supervisor', titulo: 'Evaluación de desempeño', decisiones: ['IA-03'] },
];

export const IDS_PANTALLAS = PANTALLAS.map((p) => p.id);
