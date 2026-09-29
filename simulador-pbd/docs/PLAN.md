# Plan de implementación

La clase es el **jueves 01/10/2026**. Las fases están ordenadas para que, si el tiempo se acaba, lo construido ya sirva en clase:

- Tras la Fase 2 ya se puede hacer la **demo A/B**.
- Tras la Fase 4 ya funciona el **taller** (el tablero se reemplaza proyectando los exports).
- La Fase 5 agrega las votaciones y el tablero.

Al terminar cada fase: `npm run test` en verde, `npm run build` genera `dist/index.html` y se revisa el build en el navegador a 1280×720.

---

## Fase 0 — Base del proyecto

- Scaffold de Vite + React + TypeScript, `vite-plugin-singlefile`, `lz-string` y Vitest.
- `src/model`: tipos TypeScript de los cinco JSON y un validador en tiempo de ejecución, sin librerías pesadas.
- `npm run validate` debe comprobar:
  - IDs únicos de decisiones y de opciones dentro de cada decisión.
  - Cada decisión tiene exactamente una opción `modo: "A"` y una `modo: "B"`.
  - Ninguna opción `modo: "B"` está en zona `R`.
  - Todas las referencias entre archivos existen: decisiones en eventos, votaciones y presets; opciones en los presets; sectores en `ajustesSector`.
  - El preset `cliente-minero` tiene zona `R` exactamente en sus `respuestasOcultas`.
- Tokens CSS: paleta, tipografía y los tres colores de zona.

**Aceptación:** `npm run validate` pasa con los datos actuales y falla si se rompe cualquiera de las reglas anteriores (una prueba por regla). El build produce un solo archivo sin peticiones de red, verificado en la pestaña de red del navegador.

## Fase 1 — Motor de indicadores y códec

- `src/engine`: `calcularIndicadores(estado, sector)`, `hayIncumplimiento`, `aplicarEventos` y `dossierEV02`, como funciones puras.
- `src/codec`: `codificar(estado) → "PBD1-…-crc"` y `decodificar(codigo) → estado | error`.

**Pruebas de calibración obligatorias.** Con K = 1 y los datos actuales, los valores deben coincidir exactamente:

| Caso | RT | EL | UO | CI | AC | RP | Incumplimiento |
|---|---|---|---|---|---|---|---|
| Minería, Modo A | 16 | 17 | 77 | 68 | 16 | 28 | Sí (15 decisiones) |
| Minería, Modo B | 82 | 85 | 38 | 49 | 82 | 68 | No |
| Finanzas, Modo A | 16 | 0 | 68 | 59 | 27 | 17 | Sí |
| Finanzas, Modo B | 82 | 100 | 42 | 50 | 71 | 77 | No |
| Sector público, Modo B | 82 | 100 | 44 | 48 | 71 | 77 | No |
| Minería, Modo B con ASI-01=c, ASI-03=b, ASI-04=b, SAL-01=d | 78 | 81 | 50 | 47 | 77 | 65 | No |

Si alguien cambia los efectos del catálogo, estas pruebas fallan a propósito. En ese caso se actualizan con el docente, no en silencio.

**Otras pruebas:**

- El preset `cliente-minero` da incumplimiento causado exactamente por ASI-03 y SAL-02.
- EV-01 con ASI-02 = `e` y ASI-05 = `d` no aplica efectos y devuelve `mensajeSinDatos`.
- EV-02 en Modo A lista 5 ítems; en Modo B, 0.
- El códec hace ida y vuelta sin pérdida, con todos los textos al máximo (280 caracteres, incluidas tildes, ñ, comillas y emojis).
- Con texto realista no repetitivo (declaración completa y un evento, 280 caracteres cada texto), el código mide como máximo 1 500 caracteres. Reportar la longitud medida para el caso normal y para el dictamen del grupo 5.
- Un código con un carácter alterado da un error de crc legible.

## Fase 2 — Demo: Modos A y B con «Ver como»

- Pantalla de inicio, ruteo por `?modo=`.
- Selector «Ver como»: Colaborador (marco de celular), Supervisor (escritorio) y DPO (Panel en solo lectura).
- Todas las pantallas de SPEC §3.1 y §3.2, derivadas del estado.
- Interruptor «Mostrar anotaciones» (SPEC §3.4).
- Mapa esquemático en SVG propio (sede, puntos y recorrido), no un mapa real.

**Aceptación (Given/When/Then):**

- *Given* Modo A, *When* el docente abre «Supervisor > Directorio», *Then* ve celular, domicilio, cumpleaños con año y la tarjeta activa de Lucía.
- *Given* Modo B, *When* abre la misma pantalla, *Then* solo ve nombre, área y correo, y Lucía no aparece.
- *Given* Modo A, *When* abre «Colaborador > Marcar asistencia», *Then* ve «Ubicación activa» permanente y el contador en 1 440.
- *Given* Modo B, *When* abre «Supervisor > Salud del equipo», *Then* ve «Apto con restricciones: no trabajos en altura por 60 días» y ningún diagnóstico.
- *Given* cualquier pantalla, *When* se cambia «Ver como», *Then* la decisión seleccionada y el modo se conservan.
- Capturas con Playwright a 1280×720 de cada pantalla en A y en B, guardadas en `docs/capturas/`.

## Fase 3 — Panel del DPO (Taller)

- Selección de sector con tarjetas de brief.
- Panel según SPEC §4.1 y §4.2, indicadores en vivo con marca fantasma y la leyenda «valores de diseño docente».
- Modo dictamen para `abogados` (SPEC §4.3).
- Declaración de prioridades (SPEC §4.4).
- Eventos por código (SPEC §4.5).
- Persistencia en `localStorage` con «Continuar / Empezar de nuevo».

**Aceptación:**

- *Given* un grupo de minería en Modo A, *When* cambia ASI-03 a `c`, *Then* las barras se mueven, la marca fantasma muestra el valor anterior y el contador de núcleo sube.
- *Given* una sola opción roja activa, *When* se mira EL, *Then* dice «Incumplimiento» y enlaza a esa decisión.
- *Given* el sector `abogados`, *When* entra al Panel, *Then* no ve zonas hasta pulsar «Revelar zonas», y entonces ve «Encontraron X de 2».
- *Given* el código `RIESGO5`, *When* se ingresa, *Then* ASI-03 y ASI-04 quedan resaltadas y se pide la respuesta del grupo.
- *Given* que se recarga la página, *When* vuelve al Taller, *Then* se le ofrece continuar con todo su estado.

## Fase 4 — Compartir y exportar

- «Copiar código», «Descargar archivo del grupo», «Cargar código» y `?g=` (SPEC §6).
- «Descargar resumen» en HTML imprimible y «Copiar como texto» (SPEC §8).
- La declaración de prioridades es obligatoria antes de copiar el código.

**Aceptación:**

- *Given* un grupo con todo completo, *When* copia el código y lo abre en otro navegador con `?g=`, *Then* el estado es idéntico.
- *Given* el resumen, *When* se imprime a PDF desde el navegador, *Then* cabe en una o dos páginas A4 y trae la columna vacía «Control y evidencia (S25)».

## Fase 5 — Modo Docente

- Votaciones (SPEC §7.1), eventos con «Copiar mensaje para las salas» (§7.2) y tablero completo (§7.3).

**Aceptación:**

- *Given* 5 códigos pegados (uno por sector) y un archivo JSON arrastrado, *When* se carga el tablero, *Then* aparecen 6 filas, los inválidos se reportan con su motivo y las columnas se ordenan por divergencia.
- *Given* el tablero cargado, *When* el docente aplica EV-02 como prueba de estrés, *Then* ve el dossier de Lucía de cada grupo.
- *Given* la votación ONB-02, *When* se pulsa «Proyectar», *Then* se ve a pantalla completa la pantalla de aceptación del Modo A con las opciones A–D sin colores. Tras «Revelar zonas», aparecen los colores y la base normativa.

## Fase 6 — Pulido y ensayo

- Recorrido completo con Playwright: demo A/B → taller de minería → evento → código → tablero.
- Revisión de textos: ortografía, tildes y ningún término técnico sin explicar.
- Generar 5 códigos de ejemplo (uno por sector, con decisiones distintas) en `docs/codigos-ensayo.txt`, para que el docente ensaye la plenaria.
- `README.md` final con cómo publicar el HTML en Netlify Drop o GitHub Pages, o cómo enviarlo como archivo.
