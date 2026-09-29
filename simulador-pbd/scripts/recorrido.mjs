// Recorrido completo con Playwright sobre dist/index.html: criterios de aceptación de las Fases 2 a 5.
// Uso: npm run build && npm run ensayo && node scripts/recorrido.mjs
import { chromium } from 'playwright-core';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.CHROMIUM_PATH].find((p) => p && existsSync(p));
const url = 'file://' + resolve(import.meta.dirname, '../dist/index.html');
const capturas = resolve(import.meta.dirname, '../docs/capturas');
const tmp = resolve(import.meta.dirname, '../test-results');
mkdirSync(capturas, { recursive: true });
mkdirSync(tmp, { recursive: true });

let fallos = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) fallos++;
};

const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: true });
const page = await ctx.newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
const verComo = (n) => page.getByRole('group', { name: 'Ver como' }).getByRole('button', { name: n }).click();
const pestana = (n) => page.getByRole('tab', { name: n }).click();

// ---------- Fase 2 ----------
await page.goto(`${url}?modo=a`);
await verComo('Supervisor');
let t = await page.locator('.escritorio').innerText();
ok(t.includes('+51 9•• ••• 214') && t.includes('Calle Los Álamos') && t.includes('14/03/1991') && t.includes('Lucía Paredes'), 'Fase 2 · Modo A, Directorio: celular, domicilio, cumpleaños con año y Lucía activa');
await page.getByRole('group', { name: 'Cambiar modo' }).getByRole('button', { name: 'B' }).click();
t = await page.locator('.escritorio').innerText();
ok(!t.includes('+51') && !t.includes('Álamos') && !t.includes('1991') && !t.includes('Lucía'), 'Fase 2 · Modo B, Directorio: solo nombre, área y correo; Lucía no aparece');
await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Salud del equipo' }).click();
t = await page.locator('.escritorio').innerText();
ok(t.includes('Apto con restricciones: no trabajos en altura por 60 días') && !t.includes('Lumbalgia'), 'Fase 2 · Modo B, Salud: restricción sin diagnóstico');
await page.getByRole('group', { name: 'Cambiar modo' }).getByRole('button', { name: 'A' }).click();
await verComo('Colaborador');
await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Marcar asistencia' }).click();
t = await page.locator('.celular').innerText();
ok(t.includes('Ubicación activa') && t.includes('1 440'), 'Fase 2 · Modo A, Asistencia: «Ubicación activa» y contador 1 440');
await page.locator('.borde-decisiones').getByRole('button', { name: 'ASI-03', exact: true }).click();
ok(await page.locator('.decision h2').innerText() === 'Frecuencia de geolocalización', 'Fase 2 · el borde lateral lleva a la decisión en el Panel');
await verComo('Supervisor');
await verComo('DPO');
ok((await page.locator('.decision h2').innerText()) === 'Frecuencia de geolocalización' && (await page.locator('.chip-modo').innerText()).includes('Modo A'), 'Fase 2 · «Ver como» conserva la decisión y el modo');
await page.getByLabel('Mostrar anotaciones').check();
await verComo('Colaborador');
await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: 'Aceptación' }).click();
ok((await page.locator('.anota').first().innerText()).includes('Preselección'), 'Fase 2 · anotaciones muestran el patrón oscuro');
await page.screenshot({ path: `${capturas}/anotaciones-modo-a.png` });

// ---------- Fase 3 ----------
await page.goto(`${url}?modo=taller`);
await page.getByRole('button', { name: /Minería/ }).first().click();
await page.getByRole('button', { name: /ASI-03/ }).first().click();
const rt0 = await page.locator('.ind').first().locator('.ind-valor').innerText();
const rev0 = await page.getByText(/Decisiones núcleo revisadas/).innerText();
await page.getByRole('radio', { name: /Solo en el instante de marcar/ }).click();
const rt1 = await page.locator('.ind').first().locator('.ind-valor').innerText();
const rev1 = await page.getByText(/Decisiones núcleo revisadas/).innerText();
ok(rt0 !== rt1 && (await page.locator('.fantasma').count()) > 0 && rev0 !== rev1, `Fase 3 · ASI-03 → c: barras se mueven (RT ${rt0} → ${rt1}), marca fantasma y contador (${rev0} → ${rev1})`);
await page.screenshot({ path: `${capturas}/taller-panel.png` });
// Teclado: flechas + Enter
await page.getByRole('radio', { name: /Solo en el instante de marcar/ }).focus();
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
ok((await page.getByRole('radio', { checked: true }).innerText()).includes('dentro o fuera de la sede'), 'Fase 3 · navegación por teclado (flechas + Enter)');
// Una sola roja activa
for (const d of ['ONB-02', 'PER-01', 'ASI-01', 'ASI-02', 'SAL-01', 'SAL-02', 'IA-02', 'IA-03']) {
  await page.locator('.item-dec', { hasText: d }).click();
  await page.locator('.opcion').last().click();
}
await page.locator('.item-dec', { hasText: 'SAL-02' }).click();
await page.locator('.opcion').first().click();
const inc = await page.locator('.incumple').innerText();
ok(/Incumplimiento \(1\)/.test(inc) && inc.includes('SAL-02'), 'Fase 3 · una sola opción roja: EL dice «Incumplimiento» y enlaza a SAL-02');
await page.locator('.item-dec', { hasText: 'ASI-01' }).click();
await page.locator('.incumple').getByRole('button', { name: 'SAL-02' }).click();
ok((await page.locator('.decision h2').innerText()) === 'Reporte de incidentes', 'Fase 3 · el enlace lleva a la decisión');
await page.locator('.opcion').last().click();
// Evento RIESGO5
await pestana('Eventos');
await page.getByRole('button', { name: 'Tengo un código de evento' }).click();
await page.getByLabel('Código de evento').fill('riesgo5');
await page.getByRole('button', { name: 'Desbloquear' }).click();
ok((await page.locator('.item-dec.reabierta').count()) === 2 && /respuesta del grupo \(obligatoria\)/i.test(await page.locator('.evento-card').innerText()), 'Fase 3 · RIESGO5: ASI-03 y ASI-04 resaltadas y se pide respuesta');
await page.getByRole('radio', { name: 'Cambiamos' }).check();
await page.locator('.evento-card').getByRole('button', { name: 'ASI-04' }).click();
await page.locator('.evento-card textarea').fill('Activamos el mapa solo en emergencias con registro de quién lo activa.');
// Evento con efecto (capa rayada)
await page.getByRole('button', { name: 'Tengo un código de evento' }).click();
await page.getByLabel('Código de evento').fill('LUCIA20');
await page.getByRole('button', { name: 'Desbloquear' }).click();
await page.screenshot({ path: `${capturas}/taller-eventos.png` });
// Declaración
await pestana('Prioridades');
const sels = page.locator('select.texto');
await sels.nth(0).selectOption('RT');
await sels.nth(1).selectOption('EL');
await sels.nth(2).selectOption('UO');
await page.getByLabel('Justificación').fill('Priorizamos al titular y la solidez legal; el supervisor pierde el recorrido, pero la emergencia queda cubierta.');
await sels.nth(3).selectOption('ASI-03');
await page.getByLabel('¿Por qué fue la más difícil?').fill('Operaciones pedía rastreo continuo por derrumbes.');
await pestana('Compartir');
await page.getByLabel(/Nombre del grupo/).fill('Cóndor');
const codigo = (await page.locator('.codigo-caja').innerText()).trim();
ok(codigo.startsWith('PBD1-'), `Fase 4 · código generado (${codigo.length} caracteres)`);
await page.screenshot({ path: `${capturas}/taller-compartir.png` });
const estadoAntes = await page.evaluate(() => localStorage.getItem('pbd-taller-v1'));
// Recarga → continuar
await page.reload();
ok(await page.getByText('Hay un taller guardado en este navegador').isVisible(), 'Fase 3 · al recargar se ofrece continuar');
await page.getByRole('button', { name: 'Continuar' }).click();
ok((await page.locator('.item-dec.reabierta').count()) === 2, 'Fase 3 · el estado continúa completo');
// Resumen imprimible
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('tab', { name: 'Compartir' }).click().then(() => page.getByRole('button', { name: 'Descargar resumen' }).click())]);
const rutaResumen = `${tmp}/resumen.html`;
await dl.saveAs(rutaResumen);
const pr = await ctx.newPage();
await pr.goto('file://' + rutaResumen);
const pdf = await pr.pdf({ format: 'A4', printBackground: true });
const paginas = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const html = readFileSync(rutaResumen, 'utf8');
ok(paginas >= 1 && paginas <= 2 && html.includes('Control y evidencia (se completa en S25)'), `Fase 4 · resumen en ${paginas} página(s) A4 con la columna «Control y evidencia (S25)»`);
writeFileSync(`${capturas}/resumen-ejemplo.pdf`, pdf);
await pr.close();
// ?g= en otro navegador
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const p2 = await ctx2.newPage();
await p2.goto(`${url}?g=${encodeURIComponent(codigo)}`);
await p2.waitForSelector('.panel');
const estadoDespues = await p2.evaluate(() => localStorage.getItem('pbd-taller-v1'));
const norm = (s) => {
  const o = JSON.parse(s);
  delete o.ts;
  return JSON.stringify(o, Object.keys(o).sort());
};
ok(norm(estadoAntes) === norm(estadoDespues), 'Fase 4 · ?g= en otro navegador restaura un estado idéntico');
await ctx2.close();

// Abogados: modo dictamen
const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const p3 = await ctx3.newPage();
await p3.goto(`${url}?modo=taller&sector=abogados`);
await p3.waitForSelector('.panel');
ok((await p3.locator('.zona-oculta').count()) > 0 && (await p3.locator('.incumple').count()) === 0 && (await p3.locator('.zona-R').count()) === 0, 'Fase 3 · abogados: sin zonas ni «Incumplimiento» al inicio');
await p3.locator('.item-dec', { hasText: 'ASI-03' }).click();
await p3.getByLabel(/Marcar como riesgo legal/).check();
await p3.screenshot({ path: `${capturas}/taller-dictamen.png` });
await p3.getByRole('tab', { name: 'Dictamen' }).click();
await p3.getByRole('button', { name: 'Revelar zonas' }).click();
ok(await p3.getByText('Encontraron 1 de 2').isVisible(), 'Fase 3 · «Revelar zonas» muestra «Encontraron 1 de 2»');
await ctx3.close();

// ---------- Fase 5 ----------
await page.goto(`${url}?modo=docente`);
await pestana('Tablero');
const ensayo = readFileSync(resolve(import.meta.dirname, '../docs/codigos-ensayo.txt'), 'utf8')
  .split('\n')
  .filter((l) => l.startsWith('PBD1-'));
const alterado = ensayo[0].slice(0, 30) + (ensayo[0][30] === 'x' ? 'y' : 'x') + ensayo[0].slice(31);
await page.getByLabel('Códigos de grupo').fill([...ensayo, alterado, 'basura'].join('\n'));
await page.getByRole('button', { name: 'Cargar códigos' }).click();
const archivo = `${tmp}/grupo-extra.json`;
writeFileSync(archivo, estadoAntes);
await page.locator('input[type=file]').setInputFiles(archivo);
await page.waitForTimeout(300);
const filas = await page.locator('.matriz tbody tr').count();
const cab = await page.locator('.matriz thead th').allInnerTexts();
const divs = cab.slice(1).map((x) => Number(x.split('\n').pop().replace('≠', '')));
const ordenado = divs.every((v, i) => i === 0 || divs[i - 1] >= v);
ok(filas === 6 && ordenado, `Fase 5 · 5 códigos + 1 JSON → ${filas} filas, columnas por divergencia (${divs.join(',')})`);
await page.getByLabel('Códigos de grupo').fill([alterado, 'basura'].join('\n'));
await page.getByRole('button', { name: 'Cargar códigos' }).click();
const inval = await page.locator('.alerta-roja').innerText();
ok(inval.includes('crc') && inval.includes('formato'), 'Fase 5 · inválidos reportados con su motivo (crc, formato)');
await page.getByLabel('Evento para la prueba de estrés').selectOption('EV-02');
const estres = await page.locator('.tarjeta', { hasText: 'Prueba de estrés' }).innerText();
ok(estres.includes('Nada que entregar') || estres.includes('Plantilla facial') || estres.includes('Puntajes'), 'Fase 5 · prueba de estrés EV-02 muestra el dossier de cada grupo');
await page.getByLabel('Comparar con el Modo B').check();
await page.screenshot({ path: `${capturas}/docente-tablero.png`, fullPage: true });
await pestana('Votaciones');
await page.locator('tr', { hasText: 'ONB-02' }).getByRole('button', { name: 'Proyectar' }).click();
const proy = page.locator('.proyeccion');
ok((await proy.locator('.celular').innerText()).includes('Acepto todo') && (await proy.locator('.voto .zona').count()) === 0, 'Fase 5 · Proyectar ONB-02: pantalla del Modo A y opciones sin colores');
await proy.locator('.voto input').nth(0).fill('9');
await proy.locator('.voto input').nth(3).fill('12');
await page.screenshot({ path: `${capturas}/docente-votacion.png` });
await proy.getByRole('button', { name: 'Revelar zonas' }).click();
ok((await proy.locator('.voto .zona').count()) === 4 && (await proy.locator('.normas li').count()) > 0, 'Fase 5 · «Revelar zonas» muestra colores y base normativa');
await page.screenshot({ path: `${capturas}/docente-votacion-revelada.png` });

ok(errores.length === 0, `Sin errores de JavaScript${errores.length ? ': ' + errores.join(' | ') : ''}`);
await browser.close();
console.log(fallos ? `\n✗ ${fallos} criterio(s) fallaron` : '\n✓ Todos los criterios pasan');
process.exit(fallos ? 1 : 0);
