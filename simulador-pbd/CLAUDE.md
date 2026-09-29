# Simulador Privacy by Default — App del Colaborador

Prototipo docente para la sesión S23 «Privacy by default» del Programa DPO & Tech Governance (UTEC Posgrado 2026). Lo usan un docente y unos 21 alumnos por Zoom, en breakout rooms. Los alumnos son en su mayoría abogados y oficiales de cumplimiento, no técnicos.

Lee `docs/SPEC.md` completo antes de escribir código y sigue `docs/PLAN.md` fase por fase.

## Qué es

Una sola app web estática con cuatro modos:

1. **Modo A:** la App del Colaborador sin privacy by default.
2. **Modo B:** la misma app con privacy by default (versión resuelta).
3. **Taller:** Panel del DPO donde cada grupo parte del Modo A, decide 18 configuraciones y ve el efecto en 6 indicadores.
4. **Docente:** votaciones en sala, códigos de eventos y tablero comparativo de grupos.

## Restricciones no negociables

- **Sin backend.** Nada de servidores, bases de datos, cuentas ni APIs externas. El estado vive en memoria y en `localStorage` (siempre dentro de try/catch). Los grupos comparten su trabajo con un **código de texto** y un archivo JSON (ver SPEC §6).
- **Un solo archivo de salida:** `npm run build` genera `dist/index.html` autocontenido (sin CDN, sin fuentes externas), que se abre con doble clic y funciona sin internet.
- **Guiado por datos:** `data/*.json` es la fuente de verdad. Las pantallas, el Panel y el motor de indicadores leen de ahí. No dupliques en el código textos, opciones, zonas ni efectos.
- **Datos ficticios:** solo los personajes de `data/personajes.json`. La app nunca pide datos personales reales a los alumnos.
- **La herramienta predica con el ejemplo:** sin analítica, sin cookies, sin rastreadores. En el pie de página: «Esta herramienta no recoge datos personales. Todo queda en tu navegador».
- **Idioma:** español en toda la interfaz, con registro formal pero natural. Términos de la industria (privacy by default, DPIA) en inglés, con su equivalente en español la primera vez que aparecen.

## Stack

- Vite + React 18 + TypeScript (modo estricto).
- `vite-plugin-singlefile` para generar un solo HTML.
- `lz-string` para comprimir los códigos de grupo.
- CSS propio con variables (sin framework de UI). Fuentes del sistema.
- Vitest para las pruebas del motor y del códec.

## Comandos

```bash
npm install
npm run dev        # desarrollo
npm run test       # Vitest
npm run build      # genera dist/index.html
npm run validate   # valida data/*.json contra los esquemas de src/model
```

## Diseño visual

- Paleta UTEC: celeste `#00C2FF` como acento, grises y blanco; estilo limpio.
- Zonas: roja, ámbar y verde, **siempre con icono y texto** además del color (no depender solo del color).
- Todo se proyecta por Zoom a 1280×720: textos de al menos 16 px en el Panel, contraste AA como mínimo.
- La vista Colaborador se muestra dentro de un marco de celular; las vistas Supervisor y DPO, como escritorio.
- Modo claro por defecto; el modo oscuro es opcional.

## Estructura sugerida

```
data/            JSON de contenido (no editar la forma sin actualizar src/model)
src/model/       tipos y validación de los JSON
src/engine/      cálculo de indicadores, zonas y eventos (funciones puras con pruebas)
src/codec/       códigos de grupo: serializar, comprimir, verificar
src/screens/     pantallas de Colaborador y Supervisor, derivadas del estado
src/panel/       Panel del DPO
src/docente/     votaciones, eventos y tablero
src/export/      resumen imprimible y JSON
```

## Criterio de terminado

Una fase está terminada solo si pasan sus criterios de aceptación de `docs/PLAN.md`, `npm run test` está en verde y `npm run build` genera el HTML único. Antes de cerrar cada fase, abre el build en un navegador (Playwright está disponible) y revisa a 1280×720.

## Qué no hacer

- No agregues funciones fuera de la SPEC sin preguntar.
- No cambies zonas, efectos ni textos normativos del catálogo: los define el docente. Si detectas una inconsistencia, repórtala.
- No inventes artículos ni normas en la interfaz; usa solo los de `data/catalogo.json`.
