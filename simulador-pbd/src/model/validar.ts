// Validador en tiempo de ejecución de data/*.json (sin librerías). Devuelve la lista de errores; vacía = válido.
import { IDS_PANTALLAS } from '../screens/ids';
import { INDICADORES, TIPOS_NORMA, ZONAS } from './types';
import type { Datos } from './types';

type Obj = Record<string, unknown>;
const esObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const esStr = (x: unknown): x is string => typeof x === 'string' && x.length > 0;
const esNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const esArr = (x: unknown): x is unknown[] => Array.isArray(x);

export function validarDatos(d: unknown): string[] {
  const err: string[] = [];
  const e = (m: string) => err.push(m);
  if (!esObj(d)) return ['Los datos no son un objeto'];
  const { catalogo, sectores, eventos, personajes, votaciones } = d as Obj;

  // ---------- Forma ----------
  const efectosOk = (x: unknown, donde: string, parcial = false) => {
    if (!esObj(x)) return e(`${donde}: efectos no es un objeto`);
    for (const k of Object.keys(x)) {
      if (!(INDICADORES as readonly string[]).includes(k)) e(`${donde}: indicador desconocido «${k}»`);
      else if (!esNum(x[k])) e(`${donde}: ${k} no es un número`);
    }
    if (!parcial) for (const i of INDICADORES) if (!(i in x)) e(`${donde}: falta el indicador ${i}`);
  };

  if (!esObj(catalogo) || !esArr(catalogo.decisiones)) {
    e('catalogo.json: falta «decisiones»');
    return err;
  }
  if (!esStr(catalogo.version)) e('catalogo.json: falta «version»');
  const modulos = new Set(esArr(catalogo.modulos) ? catalogo.modulos.map((m) => (m as Obj).id) : []);
  const dimensiones = new Set(esArr(catalogo.dimensiones) ? catalogo.dimensiones.map((m) => (m as Obj).id) : []);
  for (const i of INDICADORES) {
    if (!esArr(catalogo.indicadores) || !catalogo.indicadores.some((x) => (x as Obj).id === i)) e(`catalogo.json: falta el indicador ${i}`);
  }
  for (const z of ZONAS) if (!esObj(catalogo.zonas) || !esObj(catalogo.zonas[z])) e(`catalogo.json: falta la zona ${z}`);

  if (!esObj(sectores) || !esArr(sectores.sectores) || !esObj(sectores.presets) || !esObj(sectores.pesos)) {
    e('sectores.json: forma inválida');
    return err;
  }
  const idsSector = new Set(sectores.sectores.map((s) => (s as Obj).id as string));

  // ---------- Regla 1: IDs únicos ----------
  const decisiones = new Map<string, Set<string>>();
  const zonaDe = new Map<string, string>(); // "DEC:op" → zona
  for (const raw of catalogo.decisiones) {
    const dec = raw as Obj;
    const id = dec.id as string;
    if (!esStr(id)) {
      e('catalogo.json: decisión sin id');
      continue;
    }
    if (decisiones.has(id)) e(`catalogo.json: ID de decisión duplicado «${id}»`);
    const ops = new Set<string>();
    decisiones.set(id, ops);
    for (const k of ['titulo', 'pregunta', 'criterio', 'evidencia']) if (!esStr(dec[k])) e(`${id}: falta «${k}»`);
    if (typeof dec.nucleo !== 'boolean') e(`${id}: «nucleo» debe ser true o false`);
    if (!modulos.has(dec.modulo)) e(`${id}: módulo desconocido «${String(dec.modulo)}»`);
    if (!dimensiones.has(dec.dimension)) e(`${id}: dimensión desconocida «${String(dec.dimension)}»`);
    if (!esArr(dec.hoepman)) e(`${id}: «hoepman» debe ser una lista`);
    if (!esArr(dec.normas)) e(`${id}: «normas» debe ser una lista`);
    else
      for (const n of dec.normas) {
        const no = n as Obj;
        if (!esStr(no.ref)) e(`${id}: norma sin «ref»`);
        if (!(TIPOS_NORMA as readonly string[]).includes(no.tipo as string)) e(`${id}: tipo de norma desconocido «${String(no.tipo)}»`);
      }
    if (!esArr(dec.opciones) || dec.opciones.length < 2) {
      e(`${id}: necesita al menos dos opciones`);
      continue;
    }
    let nA = 0;
    let nB = 0;
    for (const rawOp of dec.opciones) {
      const op = rawOp as Obj;
      const oid = op.id as string;
      if (!esStr(oid) || !/^[a-z]$/.test(oid)) e(`${id}: el ID de opción «${String(oid)}» debe ser una sola letra minúscula`);
      if (ops.has(oid)) e(`${id}: ID de opción duplicado «${oid}»`);
      ops.add(oid);
      if (!(ZONAS as readonly string[]).includes(op.zona as string)) e(`${id}.${oid}: zona desconocida «${String(op.zona)}»`);
      zonaDe.set(`${id}:${oid}`, op.zona as string);
      if (!esStr(op.etiqueta)) e(`${id}.${oid}: falta «etiqueta»`);
      efectosOk(op.efectos, `${id}.${oid}`);
      // ---------- Regla 2 y 3: modos A/B ----------
      if (op.modo === 'A') nA++;
      else if (op.modo === 'B') {
        nB++;
        if (op.zona === 'R') e(`${id}.${oid}: la opción del Modo B no puede estar en zona R`);
      } else if (op.modo !== undefined) e(`${id}.${oid}: «modo» debe ser "A" o "B"`);
      // ---------- Regla 4: sectores en ajustesSector ----------
      if (op.ajustesSector !== undefined) {
        if (!esObj(op.ajustesSector)) e(`${id}.${oid}: «ajustesSector» no es un objeto`);
        else
          for (const [s, ef] of Object.entries(op.ajustesSector)) {
            if (!idsSector.has(s)) e(`${id}.${oid}: ajustesSector referencia el sector inexistente «${s}»`);
            efectosOk(ef, `${id}.${oid}.ajustesSector.${s}`, true);
          }
      }
    }
    if (nA !== 1) e(`${id}: debe tener exactamente una opción modo "A" (tiene ${nA})`);
    if (nB !== 1) e(`${id}: debe tener exactamente una opción modo "B" (tiene ${nB})`);
  }

  const refDecision = (dec: unknown, donde: string) => {
    if (!decisiones.has(dec as string)) {
      e(`${donde}: referencia la decisión inexistente «${String(dec)}»`);
      return false;
    }
    return true;
  };
  const refOpciones = (dec: string, ops: unknown, donde: string) => {
    if (!esArr(ops)) return e(`${donde}: «opciones» debe ser una lista`);
    for (const o of ops) if (!decisiones.get(dec)?.has(o as string)) e(`${donde}: la opción «${String(o)}» no existe en ${dec}`);
  };

  // ---------- Sectores y presets ----------
  for (const p of Object.keys(sectores.pesos)) if (!esNum(sectores.pesos[p])) e(`sectores.json: peso «${p}» no es un número`);
  for (const raw of sectores.sectores) {
    const s = raw as Obj;
    const sid = String(s.id);
    if (s.usaPesosDe !== undefined) {
      if (!idsSector.has(s.usaPesosDe as string)) e(`sector ${sid}: usaPesosDe referencia el sector inexistente «${String(s.usaPesosDe)}»`);
    } else if (!esObj(s.pesos)) e(`sector ${sid}: falta «pesos» o «usaPesosDe»`);
    else
      for (const i of INDICADORES) {
        const p = s.pesos[i];
        if (!(typeof p === 'string' && p in sectores.pesos)) e(`sector ${sid}: peso inválido para ${i}`);
      }
    if (esArr(s.decisionesTensas)) s.decisionesTensas.forEach((dd) => refDecision(dd, `sector ${sid}.decisionesTensas`));
    if (s.configuracionInicial !== undefined && !esObj(sectores.presets[s.configuracionInicial as string]))
      e(`sector ${sid}: configuracionInicial referencia el preset inexistente «${String(s.configuracionInicial)}»`);
  }
  for (const [pid, raw] of Object.entries(sectores.presets)) {
    const p = raw as Obj;
    if (!esObj(p.elecciones) || !esArr(p.respuestasOcultas)) {
      e(`preset ${pid}: forma inválida`);
      continue;
    }
    for (const [dd, op] of Object.entries(p.elecciones)) {
      if (refDecision(dd, `preset ${pid}`) && !decisiones.get(dd)!.has(op as string))
        e(`preset ${pid}: la opción «${String(op)}» no existe en ${dd}`);
    }
    for (const dd of decisiones.keys()) if (!(dd in p.elecciones)) e(`preset ${pid}: falta la elección de ${dd}`);
    p.respuestasOcultas.forEach((dd) => refDecision(dd, `preset ${pid}.respuestasOcultas`));
    // ---------- Regla 5: zona R exactamente en respuestasOcultas ----------
    const rojas = Object.entries(p.elecciones)
      .filter(([dd, op]) => zonaDe.get(`${dd}:${String(op)}`) === 'R')
      .map(([dd]) => dd)
      .sort();
    const ocultas = [...(p.respuestasOcultas as string[])].sort();
    if (rojas.join(',') !== ocultas.join(','))
      e(`preset ${pid}: las decisiones en zona R (${rojas.join(', ') || 'ninguna'}) no coinciden con respuestasOcultas (${ocultas.join(', ') || 'ninguna'})`);
  }

  // ---------- Eventos ----------
  if (!esObj(eventos) || !esArr(eventos.eventos)) e('eventos.json: falta «eventos»');
  else {
    const codigos = new Set<string>();
    const idsEv = new Set<string>();
    for (const raw of eventos.eventos) {
      const ev = raw as Obj;
      const eid = String(ev.id);
      if (idsEv.has(eid)) e(`eventos.json: ID de evento duplicado «${eid}»`);
      idsEv.add(eid);
      if (!esStr(ev.codigo)) e(`${eid}: falta «codigo»`);
      else {
        const c = (ev.codigo as string).toUpperCase();
        if (codigos.has(c)) e(`${eid}: código duplicado «${c}»`);
        codigos.add(c);
      }
      for (const k of ['titulo', 'texto', 'pregunta']) if (!esStr(ev[k])) e(`${eid}: falta «${k}»`);
      if (esArr(ev.ponePrueba)) ev.ponePrueba.forEach((dd) => dd === 'todas' || refDecision(dd, `${eid}.ponePrueba`));
      if (esArr(ev.efectos))
        ev.efectos.forEach((r, i) => {
          const re = r as Obj;
          if (refDecision(re.decision, `${eid}.efectos[${i}]`)) refOpciones(re.decision as string, re.opciones, `${eid}.efectos[${i}]`);
          efectosOk(re.delta, `${eid}.efectos[${i}].delta`, true);
        });
      if (esArr(ev.dossier))
        ev.dossier.forEach((r, i) => {
          const re = r as Obj;
          if (refDecision(re.decision, `${eid}.dossier[${i}]`)) refOpciones(re.decision as string, re.opciones, `${eid}.dossier[${i}]`);
          if (!esStr(re.item)) e(`${eid}.dossier[${i}]: falta «item»`);
        });
      if (ev.efectoPorItem !== undefined) efectosOk(ev.efectoPorItem, `${eid}.efectoPorItem`, true);
      if (ev.efectoPorFaltante !== undefined) efectosOk(ev.efectoPorFaltante, `${eid}.efectoPorFaltante`, true);
      if (esArr(ev.reabre)) ev.reabre.forEach((dd) => refDecision(dd, `${eid}.reabre`));
    }
  }

  // ---------- Votaciones ----------
  if (!esObj(votaciones) || !esArr(votaciones.votaciones)) e('votaciones.json: falta «votaciones»');
  else
    for (const raw of votaciones.votaciones) {
      const v = raw as Obj;
      refDecision(v.decision, `votación ${String(v.orden)}`);
      if (!IDS_PANTALLAS.includes(v.pantalla as string)) e(`votación ${String(v.orden)}: pantalla desconocida «${String(v.pantalla)}»`);
    }

  // ---------- Personajes ----------
  if (!esObj(personajes) || !esArr(personajes.personajes)) e('personajes.json: falta «personajes»');
  else
    for (const id of ['rosa', 'jorge', 'lucia', 'miguel'])
      if (!personajes.personajes.some((p) => (p as Obj).id === id)) e(`personajes.json: falta el personaje «${id}»`);

  return err;
}

export function datosValidos(d: Datos): Datos {
  const errores = validarDatos(d);
  if (errores.length) throw new Error('Datos inválidos:\n' + errores.join('\n'));
  return d;
}
