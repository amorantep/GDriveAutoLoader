# Simulador Privacy by Default — paquete para Claude Code

Especificación, datos y código del simulador de la sesión S23. Las Fases 0 a 6 de `docs/PLAN.md` están implementadas.

**Archivo listo para usar:** `publicar/simulador-pbd.html` (un solo HTML, sin internet). Se regenera con `npm run build` (sale en `dist/index.html`).

## Contenido

| Archivo | Para qué sirve |
|---|---|
| `CLAUDE.md` | Instrucciones que Claude Code lee automáticamente: stack, restricciones y criterio de terminado |
| `docs/SPEC.md` | Qué construir: modos, pantallas, Panel, motor, compartir sin backend y tablero |
| `docs/PLAN.md` | Seis fases con criterios de aceptación y pruebas de calibración |
| `data/catalogo.json` | Las 18 decisiones: opciones, zonas, efectos, normas, criterios Given/When/Then y evidencia |
| `data/sectores.json` | Briefs, pesos por sector y el preset del cliente minero para el grupo 5 |
| `data/eventos.json` | Los 5 eventos, con sus códigos de desbloqueo y sus efectos |
| `data/personajes.json` | Rosa, Jorge, Lucía y Miguel, con sus datos ficticios |
| `data/votaciones.json` | Las 5 votaciones del bloque expositivo |

Para cambiar el contenido (una zona, un efecto, un texto o qué decisiones son núcleo), edita los JSON, no el código.

## Comandos

```bash
npm install
npm run validate   # valida data/*.json
npm run test       # motor, calibración y códec (Vitest)
npm run build      # dist/index.html autocontenido
npm run ensayo     # regenera docs/codigos-ensayo.txt
npm run capturas   # capturas de los Modos A y B en docs/capturas/
npm run recorrido  # recorrido con Playwright: criterios de aceptación de las Fases 2 a 5
```

## Publicar

- **Netlify Drop:** entra a app.netlify.com/drop y arrastra `publicar/simulador-pbd.html` (renómbralo a `index.html` si quieres la URL raíz).
- **GitHub Pages:** sube el archivo como `index.html` a un repositorio con Pages activado.
- **Como archivo:** envíalo por WhatsApp o Drive; se abre con doble clic. En `file://` todo funciona, incluido copiar códigos y guardar el avance.
- Enlaces útiles: `?modo=a`, `?modo=b`, `?modo=taller&sector=mineria`, `?modo=docente`.

## Cómo empezar en Claude Code (histórico)

1. Descomprime la carpeta en tu computadora.
2. Abre una terminal en esa carpeta y ejecuta `claude`. También puedes abrir la carpeta desde la app de escritorio de Claude Code.
3. Pega este primer mensaje:

```
Lee CLAUDE.md, docs/SPEC.md y docs/PLAN.md, y revisa los JSON de data/.
Antes de escribir código, dime en 10 líneas cómo vas a estructurar el
proyecto y si ves inconsistencias en los datos. Luego implementa la
Fase 0 y la Fase 1, corre las pruebas y detente para que revise.
```

4. Cuando revises las Fases 0 y 1, pide: «Sigue con la Fase 2 y muéstrame capturas del Modo A y del Modo B».
5. Continúa fase por fase. Pedir una fase por turno da mejores resultados que pedir todo junto.

**Si el tiempo apremia antes del 01/10:** con las Fases 0 a 2 ya tienes la demo A/B. Con las Fases 0 a 4 también funciona el taller: proyectas los exports en lugar del tablero.

## Cómo usarlo en clase

- **Generar la app:** `npm run build` genera un solo archivo, `dist/index.html`.
- **Compartirla con los alumnos**, de una de estas formas:
  - Súbela a Netlify Drop (arrastras el archivo y obtienes un enlace).
  - Publícala en GitHub Pages.
  - Envíala por WhatsApp o Drive: se abre con doble clic y funciona sin internet.
- **Flujo del taller:** los grupos trabajan en su navegador y pegan su código en el chat de Zoom. Tú los pegas en «Docente > Tablero».
- **Eventos:** desde «Docente > Eventos» copias el mensaje y lo envías con «Transmitir mensaje a todas las salas» de Zoom.

## Pendientes antes de la clase

- [ ] Probar el largo máximo de un código de grupo en el chat de Zoom.
- [ ] Confirmar los plazos marcados con `"verificar": true` en `data/catalogo.json`.
- [ ] Decidir si se mantienen 10 decisiones núcleo o se baja a 6–7.
- [ ] Ensayar la plenaria con `docs/codigos-ensayo.txt` (se genera en la Fase 6).
