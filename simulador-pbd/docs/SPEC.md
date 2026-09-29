# SPEC — Simulador Privacy by Default (S23)

Versión 1.0 · 28/09/2026 · Autor del contenido: Alan Morante (docente)

La spec pedagógica completa (objetivos, base normativa, guion de clase y rúbrica) está en el documento «Spec — Simulador Privacy by Default · App del Colaborador (S23)». Este archivo traduce esa spec a lo que hay que construir, con una decisión de arquitectura nueva: **sin backend**.

---

## 1. Propósito

Mostrar en clase la diferencia entre una app sin privacy by default y una con privacy by default, y dejar que grupos de alumnos tomen las decisiones de configuración, vean sus consecuencias en seis indicadores y comparen sus soluciones. No hay una única respuesta correcta: hay un piso legal (zona roja) y, por encima, decisiones de criterio que cada grupo justifica.

**Usuarios:**

| Usuario | Dónde está | Qué hace |
|---|---|---|
| Docente | Sala principal de Zoom, comparte pantalla | Demo del Modo A y del Modo B, votaciones, eventos, tablero |
| Grupo (4–5 personas) | Breakout room, una persona comparte pantalla | Configura el Panel del DPO, declara prioridades, reacciona a eventos, exporta |

## 2. Entrada y modos

La pantalla de inicio ofrece cuatro botones grandes: **Ver Modo A**, **Ver Modo B**, **Taller (grupos)** y **Docente**. El modo también se puede fijar por URL: `?modo=a|b|taller|docente&sector=mineria`.

| Modo | Estado de las 18 decisiones | Panel del DPO | Selector «Ver como» |
|---|---|---|---|
| A | Todas en la opción `modo: "A"` | Solo lectura | Colaborador · Supervisor · DPO |
| B | Todas en la opción `modo: "B"` | Solo lectura | Colaborador · Supervisor · DPO |
| Taller | Parte del Modo A (o del preset `cliente-minero` si el sector es `abogados`) | Editable | Colaborador · Supervisor · DPO |
| Docente | — | — | Votaciones · Eventos · Tablero |

En el modo Taller, lo primero es elegir el sector (tarjetas con el brief de `data/sectores.json`). El sector no se puede cambiar después sin reiniciar el taller (con confirmación).

El modo Docente no requiere contraseña: no hay datos sensibles. Solo se oculta detrás de `?modo=docente` o del botón de inicio.

## 3. Selector «Ver como» y pantallas

Una barra fija arriba permite pasar entre **Colaborador**, **Supervisor** y **DPO** sin perder el estado. El efecto buscado: el grupo cambia un default en el Panel, pasa a Supervisor y ve al instante qué dejó de ver.

Las pantallas se **derivan** del estado de las decisiones. Cada pantalla muestra, en un borde lateral discreto, los ID de las decisiones que la afectan (por ejemplo, «PER-01 · PER-03»), y al hacer clic lleva a esa decisión en el Panel.

### 3.1 Colaborador (marco de celular, personaje: Rosa Quispe)

| Pantalla | Decisiones | Cómo cambia |
|---|---|---|
| Registro | ONB-01 | Muestra los campos obligatorios según la opción. En `a` pide DNI, estado civil, hijos, domicilio, redes y foto con asterisco rojo; en `d` solo nombre, código, área y correo. |
| Aceptación | ONB-02 | `a`: casillas premarcadas, un botón celeste «Acepto todo» grande y «Rechazar» en gris pequeño. `d`: finalidades separadas y desmarcadas, dos botones iguales, y un bloque aparte «Esto no requiere tu consentimiento porque es parte de tu relación laboral: …». |
| Marcar asistencia | ASI-01, ASI-03 | Método de marcación según ASI-01. Un indicador permanente «Ubicación activa» en `ASI-03 a` y `b`; en `c` y `d` solo aparece durante la marcación. Contador «Puntos de ubicación registrados hoy»: 1 440 (`a`), 600 (`b`, 10 h de turno), 2 (`c`), 0 coordenadas (`d`). |
| Mi salud | SAL-01 | Siempre ve su propio informe completo (el trabajador sí tiene derecho). Una nota indica qué ve su jefe. |
| Asistente | IA-01, IA-02, IA-03 | Qué fuentes lee el asistente (IA-01), aviso sobre el uso por el proveedor (IA-02), si existe o no un puntaje (IA-03). |
| Mis privacidades | ONB-03, PER-01, PER-02 | Interruptores de visibilidad del perfil y de las finalidades opcionales. En `ONB-03 a` solo muestra «Para revocar, envía el formulario F-12 firmado a RR. HH.». |

### 3.2 Supervisor (escritorio, personaje: Jorge Salas)

| Pantalla | Decisiones | Cómo cambia |
|---|---|---|
| Directorio del equipo | PER-01, PER-02, PER-03, PER-04 | Tarjetas de Rosa, Miguel y Lucía. Celular, cumpleaños, foto y domicilio aparecen u ocultan según la opción. Lucía (cesada) aparece activa en `PER-04 a`, como «inactiva» en `b` y no aparece en `c`. |
| Mapa de asistencia | ASI-03, ASI-04 | `ASI-04 a`: mapa esquemático (SVG simple, no un mapa real) con puntos en vivo y recorrido del día. `b`: tabla «marcó / no marcó» y un botón «Activar emergencia» que muestra el mapa y deja registro. `c`: tabla y nota «Historial disponible solo para RR. HH. con motivo registrado». `d`: tabla «marcó / no marcó» y sede. Si ASI-03 es `a`, el mapa muestra también puntos a las 23:40 fuera de la jornada. |
| Ficha biométrica de Lucía | ASI-02 | Estado de la plantilla facial de una cesada: «Activa en la nube del proveedor» (`a`), «Se conserva hasta 30/06/2027» (`b`), «Pendiente de borrado manual» (`c`), «Suprimida el 30/06/2026 · constancia del proveedor» (`d`), «No existe: la comparación se hace en el celular» (`e`). |
| Salud del equipo | SAL-01, SAL-02 | Ficha de Rosa: diagnóstico, exámenes y medicación (`SAL-01 a`); solo diagnóstico (`b`); «Apto» sin restricción (`c`, nota: «el jefe podría asignarla a trabajos en altura»); «Apto con restricciones: no trabajos en altura por 60 días» (`d`). Muro del equipo según SAL-02. |
| Evaluación de desempeño | IA-03 | Puntaje de productividad de 0 a 100 con ranking (`a`); tabla de bonos calculados automáticamente (`b`); puntaje con un aviso y un campo obligatorio «Revisión humana» (`c`); nada (`d`); «El asistente no genera insumos para tu evaluación» (`e`). |

### 3.3 RR. HH. (sin pantalla)

En cada decisión del Panel hay un recuadro «Con esta configuración, RR. HH. ve: …». El texto se deriva de la opción. Si no hay texto específico, se omite el recuadro.

### 3.4 Anotaciones del docente

Un interruptor global «Mostrar anotaciones» (visible en los modos A, B y Docente) superpone etiquetas sobre las pantallas: el tipo de patrón oscuro (`patronOscuro` en el catálogo) y el ID de la decisión. Sirve para la demo inicial.

## 4. Panel del DPO

### 4.1 Estructura

- **Columna izquierda:** lista de módulos y decisiones. Las decisiones núcleo (`nucleo: true`) van primero, con la marca «Núcleo». Las demás aparecen plegadas bajo «Otras decisiones (preconfiguradas en el estado B)».
- **Centro:** la decisión activa. Muestra el título, la pregunta, la dimensión, las opciones como tarjetas seleccionables (cada una con su zona, icono y etiqueta), la base normativa etiquetada por tipo (obligación Perú, referencia UE, estándar, buena práctica; con «⚠️ verificar» si `verificar: true`), las estrategias de Hoepman, la nota de la opción si existe y el recuadro de RR. HH.
- **Columna derecha, siempre visible:** los 6 indicadores como barras de 0 a 100, con el valor anterior como una marca fantasma para ver el movimiento tras cada cambio. EL muestra «Incumplimiento» en rojo si hay al menos una opción roja activa, y lista las decisiones que lo causan (con enlace).

### 4.2 Reglas de interacción

1. Elegir una opción la aplica al instante y recalcula los indicadores.
2. Las opciones en zona roja se pueden elegir (el Modo A las tiene), pero muestran un aviso «Esta opción incumple … (norma)». No se bloquean: el aprendizaje está en ver el incumplimiento.
3. Un contador «Decisiones núcleo revisadas: 7/10» marca como revisada cada decisión núcleo en la que el grupo eligió algo, aunque sea la opción del Modo A.
4. Un botón «Restablecer al Modo A» (con confirmación).

### 4.3 Modo dictamen (sector `abogados`)

- Carga el preset `cliente-minero`.
- Las zonas se **ocultan** al inicio: las tarjetas no muestran color ni icono, y EL no muestra «Incumplimiento».
- El grupo marca las decisiones que considera ilícitas («Marcar como riesgo legal») y redacta 3 riesgos y 3 recomendaciones (280 caracteres cada uno).
- El botón «Revelar zonas» muestra los colores y cuántas de las `respuestasOcultas` encontró el grupo. La revelación queda registrada en el estado.

### 4.4 Declaración de prioridades

Es obligatoria antes de generar el código de grupo:

- Dos indicadores priorizados (selector de 6).
- Un indicador sacrificado (no puede ser uno de los priorizados).
- Justificación: máximo 280 caracteres, con contador visible.
- La decisión más difícil (selector) y por qué: máximo 280 caracteres.

### 4.5 Eventos

- Un botón «Tengo un código de evento» abre un campo. Un código válido (`data/eventos.json`) muestra la tarjeta del evento, rotulada «Evento ficticio de la simulación».
- Efectos:
  - `efectos`: se aplican los `delta` de las reglas cuya opción coincide con la elección del grupo.
  - `dossier` (EV-02): lista lo que el sistema aún conserva de Lucía según las elecciones y aplica `efectoPorItem` por cada ítem. Si la lista está vacía, lo celebra.
  - `checklistEvidencia` (EV-04): el grupo marca qué evidencia tiene; cada faltante aplica `efectoPorFaltante`.
  - `reabre` (EV-05): resalta esas decisiones y registra si el grupo las cambió después del evento.
  - `mensajeSinDatos`: se muestra si ninguna regla aplicó.
- Respuesta obligatoria del grupo: «Mantenemos» o «Cambiamos», qué decisiones y por qué (280 caracteres).
- Los efectos de los eventos se muestran como una capa separada en las barras (por ejemplo, un tramo rayado), para distinguir entre «la configuración» y «lo que pasó».

## 5. Motor de indicadores

Funciones puras en `src/engine`, cubiertas con pruebas.

```
peso(sector, ind) = pesos[ sector.pesos[ind] ]          // Bajo 0,5 · Medio 1 · Alto 1,5
                                                         // «abogados» usa los pesos de «mineria» (usaPesosDe)
efecto(op, sector) = op.efectos con op.ajustesSector[sector] superpuesto (reemplaza, no suma)
base[ind] = 50 + K × Σ_decisiones peso(sector, ind) × efecto(opElegida, sector)[ind]      // K = 1
valor[ind] = clamp(0, 100, round(base[ind] + Σ deltas de eventos desbloqueados))
incumplimiento = existe alguna decisión con opElegida.zona === "R"
```

- `K = 1` está calibrado para que el Modo A quede entre 0 y 30 en RT, EL y AC, y que el Modo B quede entre 70 y 100 en RT y EL, pero con UO entre 35 y 50 y CI cerca de 50. Así el Modo B protege, pero con costo visible. `K` es una constante única y exportada.
- Un texto fijo bajo las barras: «Valores de diseño docente para discutir trade-offs; no son una medición real».
- Las pruebas de calibración de `docs/PLAN.md` (Fase 1) son obligatorias.

## 6. Compartir sin backend

### 6.1 Estado del grupo

```ts
type EstadoGrupo = {
  v: 1;                              // versión del formato
  cat: string;                       // catalogo.version
  sector: string;                    // id de sector
  alias?: string;                    // nombre libre del grupo, máx. 30 caracteres, sin datos personales
  elecciones: Record<string, string>;// decisión → opción
  revisadas: string[];               // decisiones núcleo tocadas
  declaracion?: { prioriza: [string, string]; sacrifica: string; justificacion: string; dificil: { decision: string; texto: string } };
  eventos: Record<string, { respuesta: "mantenemos" | "cambiamos"; decisiones: string[]; texto: string; evidencia?: string[]; eleccionesAntes?: Record<string,string> }>;
  dictamen?: { marcadas: string[]; riesgos: string[]; recomendaciones: string[]; revelado: boolean };
  ts: string;                        // ISO
};
```

- Se guarda en `localStorage` con cada cambio (try/catch; si falla, la app sigue funcionando en memoria y muestra un aviso discreto).
- Al abrir el modo Taller con un estado guardado, se ofrece «Continuar» o «Empezar de nuevo».

### 6.2 Código de grupo

- Formato: `PBD1-<payload>-<crc>`.
  - `payload` = `LZString.compressToEncodedURIComponent(JSON compacto)`, con claves cortas y las elecciones como una cadena de letras en el orden del catálogo (por ejemplo, `"adcdbcadb..."`).
  - `crc` = 4 caracteres de un hash simple del payload, para detectar errores al copiar y pegar.
- Botón «Copiar código» con confirmación visual. Instrucción junto al botón: «Pega este código en el chat de Zoom para el docente».
- **Objetivo: 1 500 caracteres como máximo** en el caso normal: elecciones, declaración completa y un evento respondido. Una medición preliminar con lz-string dio unos 900 caracteres con texto repetitivo; con texto real se espera más. El dictamen del grupo 5 (seis textos de 280 caracteres) puede superar ese largo: para ese grupo se recomienda el archivo JSON. Si el código supera 1 500 caracteres, mostrar una advertencia y sugerir el archivo. ⚠️ Probar el límite real del chat de Zoom antes de la clase.
- Restauración: `?g=<código>` en la URL, o pegarlo en «Cargar código».

### 6.3 Archivo JSON

Botón «Descargar archivo del grupo» (`grupo-<sector>-<hhmm>.json`) con el `EstadoGrupo` completo. Es la alternativa si el código es muy largo o el chat lo corta.

## 7. Modo Docente

### 7.1 Votaciones en sala

- Lista de las 5 votaciones de `data/votaciones.json`.
- «Proyectar» abre a pantalla completa la pantalla del Modo A indicada y las opciones de la decisión, etiquetadas A, B, C, D, **sin** mostrar zonas.
- «Copiar texto para encuesta de Zoom»: pregunta + opciones en texto plano.
- Campos opcionales para escribir los conteos → barras.
- «Revelar zonas»: colorea las opciones y muestra la base normativa.

### 7.2 Eventos

- Tabla de eventos con su código, su momento sugerido (`uso`) y un botón «Copiar mensaje para las salas» con este texto: «Evento: <título>. Ingresen el código <CÓDIGO> en el Panel del DPO. Tienen 5 minutos».

### 7.3 Tablero comparativo

- **Carga:** un área para pegar varios códigos (uno por línea) y otra para arrastrar archivos JSON. Muestra los grupos cargados con su sector y su hora, e indica los códigos inválidos con el motivo (crc, versión, formato). Guarda el tablero en `localStorage` y ofrece «Vaciar tablero».
- **Matriz:** filas = grupos; columnas = decisiones núcleo (con un interruptor para ver las 18). Cada celda muestra la letra de la opción y su zona (color + icono). Al pasar el cursor, la etiqueta completa.
- **Divergencia:** resalta las columnas donde los grupos eligieron más opciones distintas, ordenadas de mayor a menor. Es el guion de la plenaria.
- **Indicadores:** por grupo, 6 mini-barras y la declaración de prioridades (prioriza / sacrifica / justificación).
- **Eventos:** una columna por evento con «mantenemos / cambiamos» y el texto.
- **Dictamen:** si hay un grupo `abogados`, un panel lado a lado con el grupo `mineria`: las decisiones que el grupo 5 marcó como riesgo frente a lo que eligió el grupo 1.
- **Comparar con el Modo B:** superpone una fila «Versión resuelta».
- **Prueba de estrés:** el docente elige EV-01 o EV-02 y el tablero calcula su efecto para todos los grupos a la vez, sin que ellos ingresen el código. Para EV-02 muestra el dossier de cada grupo.
- **Export del tablero:** HTML imprimible con la matriz, los indicadores y las declaraciones.

## 8. Export del grupo

«Descargar resumen» genera un HTML imprimible (una página A4 si es posible) con:

1. Sector, alias, fecha y hora.
2. Tabla de las 18 decisiones: opción elegida, zona, base normativa y estrategia de Hoepman.
3. Indicadores finales (con y sin eventos).
4. Declaración de prioridades.
5. Reacción a cada evento.
6. Dictamen (si aplica).
7. Una columna vacía «Control y evidencia (se completa en S25)» junto a cada decisión.

Botón adicional «Copiar como texto» para pegar en Miro.

## 9. Accesibilidad y proyección

- Diseño para 1280×720 compartido por Zoom: sin scroll horizontal y con el Panel legible completo en esa resolución.
- Navegación por teclado en el Panel: flechas entre opciones, Enter para elegir.
- Zonas con color + icono + texto. Contraste AA como mínimo.
- `prefers-reduced-motion` desactiva las animaciones de las barras.

## 10. Fuera de alcance (v1)

- Estado compartido en tiempo real, cuentas y votación desde el celular de los alumnos.
- Consola de RR. HH. navegable y módulo de Tareas.
- Traducción a otros idiomas.
- Edición del catálogo desde la interfaz (se edita el JSON).

## 11. Decisiones abiertas

- **Número de decisiones núcleo:** hoy son 10 (unos 2,5 minutos por decisión en el taller). Se cambia en el catálogo con `nucleo: true/false`, sin tocar código.
- **Límite del chat de Zoom** para el código de grupo: por probar.
- **Plazos laborales y de historia clínica** marcados con `verificar: true` en el catálogo: pendientes de confirmación por el docente.
