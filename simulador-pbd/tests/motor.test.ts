import { describe, expect, it } from 'vitest';
import { DATOS } from '../src/model/datos';
import {
  K,
  aplicarEventos,
  calcularIndicadores,
  dossierEV02,
  efectoEvento,
  eleccionesModo,
  estadoNuevo,
  hayIncumplimiento,
  incumplimientos,
  redondear,
  buscarEvento,
} from '../src/engine/indicadores';

const A = eleccionesModo(DATOS, 'A');
const B = eleccionesModo(DATOS, 'B');
const calc = (sector: string, elecciones: Record<string, string>) => calcularIndicadores(DATOS, { elecciones, eventos: {} }, sector);

describe('calibración (docs/PLAN.md, Fase 1)', () => {
  it('K = 1', () => expect(K).toBe(1));

  const casos: [string, string, Record<string, string>, number[], boolean][] = [
    ['Minería, Modo A', 'mineria', A, [16, 17, 77, 68, 16, 28], true],
    ['Minería, Modo B', 'mineria', B, [82, 85, 38, 49, 82, 68], false],
    ['Finanzas, Modo A', 'finanzas', A, [16, 0, 68, 59, 27, 17], true],
    ['Finanzas, Modo B', 'finanzas', B, [82, 100, 42, 50, 71, 77], false],
    ['Sector público, Modo B', 'publico', B, [82, 100, 44, 48, 71, 77], false],
    ['Minería, Modo B con ASI-01=c, ASI-03=b, ASI-04=b, SAL-01=d', 'mineria', { ...B, 'ASI-01': 'c', 'ASI-03': 'b', 'ASI-04': 'b', 'SAL-01': 'd' }, [78, 81, 50, 47, 77, 65], false],
  ];
  for (const [nombre, sector, el, esperado, incumple] of casos) {
    it(nombre, () => {
      const r = calc(sector, el);
      expect([r.valor.RT, r.valor.EL, r.valor.UO, r.valor.CI, r.valor.AC, r.valor.RP]).toEqual(esperado);
      expect(hayIncumplimiento(DATOS, el)).toBe(incumple);
    });
  }

  it('Minería, Modo A: incumplimiento en 15 decisiones', () => {
    expect(incumplimientos(DATOS, A)).toHaveLength(15);
  });

  it('el redondeo es «mitad al par»', () => {
    expect([redondear(0.5), redondear(1.5), redondear(15.5), redondear(48.5), redondear(49.5), redondear(-0.5), redondear(3.4), redondear(3.6)]).toEqual([
      0, 2, 16, 48, 50, 0, 3, 4,
    ]);
  });
});

describe('preset y eventos', () => {
  it('el preset cliente-minero incumple exactamente por ASI-03 y SAL-02', () => {
    const st = estadoNuevo(DATOS, 'abogados');
    expect(incumplimientos(DATOS, st.elecciones).sort()).toEqual(['ASI-03', 'SAL-02']);
  });

  it('EV-01 con ASI-02=e y ASI-05=d no aplica efectos y devuelve mensajeSinDatos', () => {
    const ev = buscarEvento(DATOS, 'EV-01')!;
    const r = efectoEvento(DATOS, ev, { ...B, 'ASI-02': 'e', 'ASI-05': 'd' });
    expect(Object.values(r.delta).every((v) => v === 0)).toBe(true);
    expect(r.mensajeSinDatos).toBe(ev.mensajeSinDatos);
  });

  it('EV-01 en Modo A resta RT, RP y EL', () => {
    const r = efectoEvento(DATOS, buscarEvento(DATOS, 'EV-01')!, A);
    expect(r.delta).toMatchObject({ RT: -30, RP: -25, EL: -10 });
    expect(r.mensajeSinDatos).toBeUndefined();
  });

  it('EV-02 en Modo A lista 5 ítems; en Modo B, 0', () => {
    expect(dossierEV02(DATOS, A)).toHaveLength(5);
    expect(dossierEV02(DATOS, B)).toHaveLength(0);
    const r = efectoEvento(DATOS, buscarEvento(DATOS, 'EV-02')!, A);
    expect(r.delta).toMatchObject({ RT: -20, RP: -15 });
  });

  it('EV-04 resta EL por cada evidencia faltante', () => {
    const ev = buscarEvento(DATOS, 'EV-04')!;
    expect(efectoEvento(DATOS, ev, B, []).delta.EL).toBe(-30);
    expect(efectoEvento(DATOS, ev, B, ['logs', 'matriz']).delta.EL).toBe(-18);
  });

  it('EV-05 registra qué decisiones reabiertas cambió el grupo', () => {
    const ev = buscarEvento(DATOS, 'EV-05')!;
    const r = efectoEvento(DATOS, ev, A, [], { ...A, 'ASI-03': 'c' });
    expect(r.cambiadasTras).toEqual(['ASI-03']);
  });

  it('los eventos se suman a la base y se recortan a 0–100', () => {
    const st = estadoNuevo(DATOS, 'mineria');
    st.eventos['EV-01'] = { decisiones: [], texto: '', eleccionesAntes: { ...A } };
    const r = calcularIndicadores(DATOS, st, 'mineria');
    expect(r.base.RT).toBe(16);
    expect(r.valor.RT).toBe(0);
    expect(r.valor.EL).toBe(7);
    expect(aplicarEventos(DATOS, st).total.RT).toBe(-30);
  });

  it('el efecto del evento usa la foto de las elecciones al desbloquearlo', () => {
    const st = estadoNuevo(DATOS, 'mineria');
    st.eventos['EV-01'] = { decisiones: [], texto: '', eleccionesAntes: { ...A } };
    st.elecciones = { ...B };
    expect(aplicarEventos(DATOS, st).total.RT).toBe(-30);
  });
});
