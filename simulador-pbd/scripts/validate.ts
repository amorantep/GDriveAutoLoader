// npm run validate — valida data/*.json contra las reglas de src/model/validar.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validarDatos } from '../src/model/validar';

const leer = (f: string) => JSON.parse(readFileSync(resolve(import.meta.dirname, '../data', f), 'utf8'));
const datos = {
  catalogo: leer('catalogo.json'),
  sectores: leer('sectores.json'),
  eventos: leer('eventos.json'),
  personajes: leer('personajes.json'),
  votaciones: leer('votaciones.json'),
};
const errores = validarDatos(datos);
if (errores.length) {
  console.error(`✗ ${errores.length} error(es) en data/:`);
  for (const e of errores) console.error('  - ' + e);
  process.exit(1);
}
console.log(`✓ data/ válido: ${datos.catalogo.decisiones.length} decisiones, ${datos.sectores.sectores.length} sectores, ${datos.eventos.eventos.length} eventos, ${datos.votaciones.votaciones.length} votaciones.`);
