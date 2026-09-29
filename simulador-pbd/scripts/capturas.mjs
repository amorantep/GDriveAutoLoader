// Capturas de las pantallas del Modo A y B a 1280×720 (docs/capturas/). Uso: node scripts/capturas.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.CHROMIUM_PATH].find((p) => p && existsSync(p));
const url = 'file://' + resolve(import.meta.dirname, '../dist/index.html');
const out = resolve(import.meta.dirname, '../docs/capturas');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const peticiones = [];
page.on('request', (r) => { if (!r.url().startsWith('file://') && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) peticiones.push(r.url()); });
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));

const pantallas = {
  colaborador: ['Registro', 'Aceptación', 'Marcar asistencia', 'Mi salud', 'Asistente', 'Mis privacidades'],
  supervisor: ['Directorio del equipo', 'Mapa de asistencia', 'Ficha biométrica de Lucía', 'Salud del equipo', 'Evaluación de desempeño'],
};
for (const modo of ['a', 'b']) {
  await page.goto(`${url}?modo=${modo}`);
  for (const [vista, lista] of Object.entries(pantallas)) {
    await page.getByRole('group', { name: 'Ver como' }).getByRole('button', { name: vista === 'colaborador' ? 'Colaborador' : 'Supervisor' }).click();
    for (const [i, t] of lista.entries()) {
      await page.getByRole('navigation', { name: 'Pantallas' }).getByRole('button', { name: t }).click();
      await page.screenshot({ path: `${out}/modo-${modo}-${vista}-${i + 1}.png` });
    }
  }
  await page.getByRole('group', { name: 'Ver como' }).getByRole('button', { name: 'DPO' }).click();
  await page.screenshot({ path: `${out}/modo-${modo}-dpo.png` });
}
await page.goto(url);
await page.screenshot({ path: `${out}/inicio.png` });
await browser.close();
console.log(`Capturas en ${out}`);
console.log(peticiones.length ? `✗ Peticiones de red: ${peticiones.join(', ')}` : '✓ Sin peticiones de red');
if (errores.length) { console.log('✗ Errores:', errores); process.exit(1); }
