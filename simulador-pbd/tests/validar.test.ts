import { describe, expect, it } from 'vitest';
import { DATOS } from '../src/model/datos';
import { validarDatos } from '../src/model/validar';
import type { Datos } from '../src/model/types';

const copia = (): Datos => structuredClone(DATOS);
const dec = (d: Datos, id: string) => d.catalogo.decisiones.find((x) => x.id === id)!;
const falla = (d: Datos, patron: RegExp) => {
  const errores = validarDatos(d);
  expect(errores.some((e) => patron.test(e)), errores.join('\n')).toBe(true);
};

describe('npm run validate', () => {
  it('pasa con los datos actuales', () => {
    expect(validarDatos(DATOS)).toEqual([]);
  });

  it('regla 1a: IDs de decisión únicos', () => {
    const d = copia();
    dec(d, 'ONB-02').id = 'ONB-01';
    falla(d, /ID de decisión duplicado/);
  });

  it('regla 1b: IDs de opción únicos dentro de cada decisión', () => {
    const d = copia();
    dec(d, 'PER-01').opciones[1].id = 'a';
    falla(d, /ID de opción duplicado/);
  });

  it('regla 2a: exactamente una opción modo A', () => {
    const d = copia();
    dec(d, 'PER-01').opciones[1].modo = 'A';
    falla(d, /exactamente una opción modo "A"/);
  });

  it('regla 2b: exactamente una opción modo B', () => {
    const d = copia();
    delete dec(d, 'PER-01').opciones[3].modo;
    falla(d, /exactamente una opción modo "B"/);
  });

  it('regla 3: ninguna opción modo B en zona R', () => {
    const d = copia();
    dec(d, 'SAL-02').opciones[2].zona = 'R';
    falla(d, /Modo B no puede estar en zona R/);
  });

  it('regla 4a: decisiones de eventos existen', () => {
    const d = copia();
    d.eventos.eventos[0].efectos![0].decision = 'XXX-99';
    falla(d, /decisión inexistente «XXX-99»/);
  });

  it('regla 4b: opciones de eventos existen', () => {
    const d = copia();
    d.eventos.eventos[0].efectos![0].opciones = ['z'];
    falla(d, /opción «z» no existe/);
  });

  it('regla 4c: decisiones de votaciones existen', () => {
    const d = copia();
    d.votaciones.votaciones[0].decision = 'NOPE-1';
    falla(d, /votación 1: referencia la decisión inexistente/);
  });

  it('regla 4d: decisiones y opciones de presets existen', () => {
    const d = copia();
    d.sectores.presets['cliente-minero'].elecciones['ONB-01'] = 'z';
    falla(d, /preset cliente-minero: la opción «z» no existe en ONB-01/);
  });

  it('regla 4e: sectores de ajustesSector existen', () => {
    const d = copia();
    dec(d, 'PER-03').opciones[2].ajustesSector = { mineriaa: { UO: 2 } };
    falla(d, /sector inexistente «mineriaa»/);
  });

  it('regla 4f: pantallas de votaciones existen', () => {
    const d = copia();
    d.votaciones.votaciones[0].pantalla = 'colaborador/nada';
    falla(d, /pantalla desconocida/);
  });

  it('regla 5a: el preset tiene zona R en decisiones fuera de respuestasOcultas', () => {
    const d = copia();
    d.sectores.presets['cliente-minero'].elecciones['ONB-01'] = 'a';
    falla(d, /no coinciden con respuestasOcultas/);
  });

  it('regla 5b: respuestasOcultas incluye una decisión que no es roja', () => {
    const d = copia();
    d.sectores.presets['cliente-minero'].respuestasOcultas.push('PER-01');
    falla(d, /no coinciden con respuestasOcultas/);
  });

  it('las opciones tienen ID de una letra (requisito del códec)', () => {
    const d = copia();
    dec(d, 'PER-01').opciones[0].id = 'aa';
    falla(d, /una sola letra/);
  });
});
