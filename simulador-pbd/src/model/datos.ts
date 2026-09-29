import catalogo from '../../data/catalogo.json';
import sectores from '../../data/sectores.json';
import eventos from '../../data/eventos.json';
import personajes from '../../data/personajes.json';
import votaciones from '../../data/votaciones.json';
import type { Catalogo, Datos, Eventos, Personajes, Sectores, Votaciones } from './types';

export const DATOS: Datos = {
  catalogo: catalogo as unknown as Catalogo,
  sectores: sectores as unknown as Sectores,
  eventos: eventos as unknown as Eventos,
  personajes: personajes as unknown as Personajes,
  votaciones: votaciones as unknown as Votaciones,
};
