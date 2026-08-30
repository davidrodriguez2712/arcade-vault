# SPEC game-jam · ciempies · 01 — Ciempiés en la entrada `ciempies`: motor + leaderboard

> **Estado:** Borrador
> **Lote:** game jam «Ciempiés (Centipede)» — 2026-08-29
> **Depende de:** SPEC 01, SPEC 05, SPEC 06 · vitrina `02-ciempies-vitrina.md`
> **Fecha:** 2026-08-29
> **Numeración:** local del lote; al aprobar, renumérala como `specs/NN-ciempies.md` antes de `/add-game`.
> **Objetivo:** Construir desde cero un Ciempiés en un motor TypeScript agnóstico de framework montado en el marco CRT del reproductor, conectado a la entrada de catálogo `ciempies`, con campo de setas destructible, araña, controles táctiles y guardado real de puntuaciones bajo RLS.

---

## Por qué existe esta spec

SPEC 05 portó `rocas` (Asteroides) a un motor real y fijó el patrón: `engine.ts` sin React/Next +
envoltorio `"use client"` fino, registrado en `app/components/games/registry.ts`. SPEC 06 movió el
catálogo y las puntuaciones a Supabase y añadió el overlay React de guardado, la tabla `scores` con
inserción anónima bajo RLS condicionada a `games.has_leaderboard`, y el estado vacío del leaderboard.
SPEC 07, SPEC 08 y SPEC 09 repitieron el patrón para `caida` (Tetris), `bloque-buster` (Arkanoid) y
`serpentina` (Snake). Hoy `rocas`, `caida`, `bloque-buster` y `serpentina` son los únicos juegos con
motor real y `has_leaderboard = true`.

El catálogo tiene dos shooters (`rocas`, un shooter de inercia en 360°, y `invasores`, un shooter de
formaciones que desciende — la ficha reservada a Space Invaders), pero **ningún shooter de campo
fijo con un enemigo segmentado que se parte al recibir impactos**. El lote «Ciempiés» llena ese hueco
con una entrada de catálogo nueva, `ciempies`, categoría `SHOOTER`: un ciempiés de neón que serpentea
hacia abajo por un campo de setas destructibles, un cañón que solo se mueve por la franja inferior, y
la araña como amenaza secundaria entre oleadas. La mecánica —rejilla de setas de 4 impactos, enemigo
que rebota y baja al chocar, y que al ser troceado se divide en dos cadenas— es **distinta** de los
cuatro motores ya implementados (inercia / tetrominós / breakout / snake).

Esta spec aplica SPEC 05 + SPEC 06 tal cual, sin tocar la infraestructura compartida:
`app/lib/scores.ts`, `app/lib/scores-actions.ts`, `app/lib/supabase/public.ts`, `app/juego/[id]/*` y
`app/salon/*` ya son agnósticos del juego — todo va por `game_id` + `has_leaderboard`. La fila
`ciempies` de la tabla `games` la **crea la vitrina** (`02-ciempies-vitrina.md`), que es
**precondición** de esta spec; aquí solo se añade la mitad de leaderboard de la migración y la entrada
en `REAL_GAME_PLAYERS`.

**No hay juego de referencia.** No existe `references/started-games/` para Ciempiés; el motor se
escribe desde cero siguiendo el contrato de clase de SPEC 05, igual que se hizo con Snake en SPEC 09.

Esta spec **no revisa** ninguna decisión de SPEC 05, SPEC 06, SPEC 07, SPEC 08 ni SPEC 09.

---

## Scope

**In:**

- `supabase/migrations/NN-ciempies.sql` — **la mitad de leaderboard**. El archivo lo crea la vitrina
  (`02-ciempies-vitrina.md`) con el `insert` de la fila `ciempies` y `has_leaderboard = false`. Esta
  spec **añade al final del mismo archivo** una sola sentencia:
  - `update public.games set has_leaderboard = true where id = 'ciempies';`
  - Se aplica al proyecto remoto con `mcp__supabase__apply_migration` junto con la mitad de la
    vitrina. La tabla `scores` **ya existe** desde SPEC 06: no se recrea, no se toca su RLS.
- `app/lib/supabase/database.types.ts` — regenerado con `mcp__supabase__generate_typescript_types`
  tras la migración (el esquema no cambia de columnas; se regenera por higiene).
- `app/components/games/centipede/engine.ts` (nuevo) — motor escrito desde cero, **sin ninguna
  importación de `react` ni de `next`**. Exporta la clase `CentipedeGame` y los tipos `TouchAction` /
  `GameOverResult`. Dibuja siempre en el espacio interno fijo **800×600**; el escalado responsive vive
  solo en `resize()`. `dt` capado a 50 ms. **No** pinta el texto de "GAME OVER" (lo pone el overlay
  React); sí pinta la banda de HUD, el campo de setas, el ciempiés, la araña, el cañón, la bala y el
  overlay "EN PAUSA".
  - Constantes del módulo: `CELL = 25`, `COLS = 32`, `ROWS = 22`, `HUD_H = 50` (área de juego
    `800 × 550` desde `y = 50`), `PLAYER_ROWS = 6` (el cañón se confina a las filas `16..21`),
    `PLAYER_SPEED = 260` px/s, `BULLET_SPEED = 900` px/s, `MAX_BULLETS = 1`, `MUSHROOM_HP = 4`,
    `START_MUSHROOMS = 28`, `START_SEGMENTS = 11`, `CENTIPEDE_CPS = [6, 7, 8, 9, 10, 11, 12, 13, 14]`
    (celdas/s por oleada, tope en la 9), `SPIDER_MIN_GAP = 8`, `SPIDER_MAX_GAP = 14` (segundos),
    `EXTRA_LIFE_EVERY = 12000`.
  - Puntuación: seta destruida (4º impacto) `+1`; segmento de cuerpo `+10`; cabeza `+100`; araña
    `+300` / `+600` / `+900` según la distancia vertical al cañón al abatirla (lejos / media / cerca).
    Sin bono por limpiar la oleada.
  - Estado de partida (ver Data model): `mushrooms` (rejilla `COLS × ROWS` de `0..4`), `segments`
    (array de segmentos del ciempiés, cada uno con celda, dirección horizontal, flag `head` y flag
    `descending`), `player` (posición en px del cañón), `bullets` (array, longitud `≤ MAX_BULLETS`),
    `spider` (o `null`) con su temporizador de aparición, `score`, `lives`, `wave` (1..N),
    `state`, `paused`, `gameOverNotified`.
  - `initGame()`: `score = 0`, `lives = 3`, `wave = 1`, `gameOverNotified = false`; siembra
    `START_MUSHROOMS` setas a HP 4 en celdas aleatorias de las filas `1..20` dejando libre la fila
    del cañón; coloca el cañón centrado en la fila `21`; genera el ciempiés de `START_SEGMENTS`
    segmentos entrando por arriba desde la columna 0 hacia la derecha; `spider = null` con el primer
    `gap` aleatorio.
  - Movimiento del ciempiés (a paso fijo, gobernado por un acumulador contra
    `interval = 1 / CENTIPEDE_CPS[min(wave - 1, 8)]`): cada segmento avanza una celda en su dirección
    horizontal; si la celda destino tiene seta, sale del área de juego, o está en el borde, el
    segmento baja una fila e invierte su dirección; al llegar a la franja del cañón rebota hacia
    arriba y vuelve a bajar, quedándose a serpentear por las filas inferiores.
  - Disparo: `Space` (o el botón táctil `fire`) crea una bala si hay menos de `MAX_BULLETS` activas;
    mantener pulsado re-dispara en cuanto la bala anterior desaparece. La bala sube en vertical a
    `BULLET_SPEED`; impacta la primera seta o segmento que toca y se elimina.
  - Impacto en seta: `mushrooms[c][r] -= 1`; a `0` la seta desaparece y suma `+1`.
  - Impacto en segmento: ese segmento muere y su celda se convierte en seta a HP 4; la cadena se
    **parte en dos** por ese punto (los segmentos que iban detrás se convierten en una cadena nueva
    con su propia cabeza). `+10` cuerpo, `+100` cabeza.
  - Oleada limpia (`segments.length === 0`): `wave += 1`; nuevo ciempiés más corto con cabezas
    sueltas adicionales (`headsExtra = min(wave - 1, 6)`) y `interval` menor.
  - Araña: cuando su temporizador llega a 0 aparece por un lateral de la franja del cañón y se mueve
    en diagonal rebotando dentro de las filas `13..21`; se come cualquier seta por la que pasa; si
    toca el cañón el jugador pierde una vida. Al abatirla suma según distancia y reprograma el
    siguiente `gap`.
  - Pérdida de vida: un segmento del ciempiés o la araña toca el cañón → `lives -= 1`, se recolocan
    el cañón y el ciempiés actual, y las setas a HP `1..3` se restauran a HP 4. A `lives === 0` →
    `endGame()`.
  - Vida extra: al cruzar cada múltiplo de `EXTRA_LIFE_EVERY` puntos, `lives += 1`.
  - Fin de partida: `state = "gameover"` + `if (!gameOverNotified) { gameOverNotified = true;
onGameOver?.({ score, level: wave }); }`. `gameOverNotified` se resetea en `initGame()`.
  - `draw()`: banda de HUD (`SCORE` a la izquierda, vidas como iconos de cañón en el centro,
    `OLEADA n` a la derecha, con `var(--pixel)`), rejilla sutil del área de juego, setas como
    racimos de neón cuyo brillo baja con el HP, ciempiés como celdas redondeadas en `var(--magenta)`
    con la cabeza más brillante, araña como estrella angular en `var(--cyan)`, cañón como triángulo
    `var(--yellow)`, bala como segmento vertical, y el overlay "EN PAUSA" cuando `paused`. **Nunca**
    pinta "GAME OVER".
  - Contrato de la clase: `constructor(canvas)`, `start()`, `stop()`, `destroy()`, `restart()`,
    `setPaused()` / `togglePause()`, `resize(cssW, cssH, dpr)`, `setOnGameOver(cb)`,
    `setInput(action, pressed)`.
  - Input: `←` `↑` `→` `↓` (o los botones táctiles) mueven el cañón **mientras estén pulsados** por su
    franja; `Space` (o `fire`) dispara. `onKeyDown` / `onKeyUp` son campos arrow-fn con guard
    `isFormFieldFocused(e.target)`. `Escape` / `KeyP` alternan pausa; el motor **no** pinta "GAME
    OVER"; el overlay de pausa no lleva selector de nada.
- `app/components/games/centipede/centipede-player.tsx` (nuevo, `"use client"`) — envoltorio fino,
  copia de `app/components/games/asteroids/asteroids-player.tsx` con `GAME_ID = "ciempies"` y la clase
  `CentipedeGame`:
  - Marco CRT (`.crt` / `.crt-screen` / `.crt-bottom`), `<canvas className="centipede-canvas"
width={800} height={600}>` dentro de `.centipede-stage`.
  - `useEffect` de montaje: guard StrictMode (`gameRef.current?.destroy()`), `new
CentipedeGame(canvas)`, `game.setOnGameOver(setOver…)`, `applySize()` con
    `stage.getBoundingClientRect()` → `game.resize(w, h, devicePixelRatio || 1)`, `ResizeObserver`
    sobre el stage, `game.start()`, `visibilitychange` → `game.setPaused(document.hidden)`, `keydown`
    en `window` con `preventDefault` de `ArrowUp/ArrowDown/ArrowLeft/ArrowRight/Space` (salvo si se
    escribe en un input) y `Escape`/`KeyP` → `togglePause()`, `Space` → cerrar el overlay. Cleanup:
    `ro.disconnect()`, quitar listeners, `game.destroy()`, `gameRef.current = null`.
  - Overlay `.modal-bd` / `.modal` (reutiliza las clases de `globals.css`) con `<h2>FIN DEL
JUEGO</h2>`, `.final-label`, `.final` con `over.score.toLocaleString("es-ES")`, input de iniciales
    (`e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 12)`), botón `GUARDAR
PUNTUACIÓN` (`disabled` si `phase === "saving" || name.length === 0`) →
    `submitScore({ gameId: "ciempies", name, score: over.score, level: over.level })`, `.actions` con
    `JUGAR DE NUEVO` → `game.restart()` + `setOver(null)` y `VOLVER` → `/juego/ciempies`. Estados
    `idle | saving | saved | error`: `saved` → `<div className="toast-saved">▸ PUNTUACIÓN
GUARDADA_</div>`, `error` → muestra `res.error` sin romper el canvas.
  - `crt-bottom`: etiqueta `CIEMPIÉS · CRT-83 · 60 HZ` y `CENTIPEDE`.
  - Monta `<CentipedeTouchControls onInput={handleInput} />` dentro de `.crt-screen`.
- `app/components/games/centipede/touch-controls.tsx` (nuevo, `"use client"`) — copia de
  `asteroids/touch-controls.tsx` con 5 botones: D-pad en cruz (`▲ ▼ ◄ ►`) abajo-izquierda y `DISPARO`
  abajo-derecha. `TouchAction = "up" | "down" | "left" | "right" | "fire"`, todos booleanos
  sostenidos. `onPointerDown` → `onInput(action, true)`; `onPointerUp` / `onPointerCancel` /
  `onPointerLeave` → `onInput(action, false)`; `e.preventDefault()` en cada handler. Visibles solo
  bajo `@media (pointer: coarse)`.
- `app/components/games/registry.ts` — añadir `ciempies: CentipedePlayer` a `REAL_GAME_PLAYERS`.
- `app/globals.css` — anexar al final el bloque `/* ===== juego: centipede (ciempies) ===== */`:
  - `.centipede-stage` (`position: absolute; inset: 0; background: #000;`).
  - `.centipede-canvas` (`display: block; width: 100%; height: 100%; object-fit: contain;
touch-action: none;`).
  - `.centipede-touch` (`position: absolute; inset: 0; display: none; pointer-events: none;
z-index: 4;`) + `@media (pointer: coarse) { .centipede-touch { display: block; } }` +
    `.centipede-touch-btn` con las 5 variantes de posición (`.up` `.down` `.left` `.right` en cruz
    abajo-izquierda, `.fire` abajo-derecha).
  - **No** añade ningún `.cover-*` — `.cover-ciempies` lo añade la vitrina (`02-ciempies-vitrina.md`).
  - **No** redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`,
    `.hall-table*`, `.leaderboard`, `.lb-row`, `.lb-empty`.
- `CLAUDE.md` — "Stack notes": actualizar la línea de leaderboards (añadir `ciempies`) y la de "Real
  games" (añadir `centipede` → `ciempies`, motor desde cero, espacio interno 800×600).
- Revisión visual con Playwright MCP: screenshots en `.playwright-screenshots/` de
  `/juego/ciempies/jugar` (inicio, partida en curso, overlay de guardado), `/juego/ciempies` (aside
  con datos y vacío) y `/salon` (tab `CIEMPIÉS` con datos y vacía), en escritorio y ~390 px. Verificar
  que `/juego/rocas`, `/juego/caida`, `/juego/bloque-buster` y `/juego/serpentina` siguen igual y que
  otro juego simulado (p. ej. `/juego/invasores`) sigue con `seededScores`.

**Out of scope (para futuras specs):**

- Sonido y música.
- La pulga (`flea`) que suelta setas cuando quedan pocas en la franja del cañón.
- El escorpión (`scorpion`) que envenena setas y el descenso vertical acelerado del ciempiés sobre
  una seta envenenada.
- Sprites o assets binarios: todo el render es procedural en la paleta neon.
- Control con trackball / ratón (el patrón de la plataforma es teclado + botones táctiles).
- Multibala, disparo con cadencia configurable, potenciadores.
- Modo a 2 jugadores o versus.
- Persistencia local (`localStorage` / IndexedDB).
- Auth real / columna `user_id` en `scores` (el leaderboard sigue siendo anónimo por iniciales).
- Recalcular `games.best` / `games.plays` desde datos reales (siguen siendo columnas mock estáticas).
- Portar los otros juegos simulados a motor real.
- Marcas reales en la home; Realtime / paginación del leaderboard.
- Todo lo de la vitrina: la portada `.cover-ciempies`, el copy del catálogo, la ficha
  `/juego/ciempies` y la pestaña de `/salon` (van en `02-ciempies-vitrina.md`).
- Tests automatizados (no hay runner).

---

## Data model

La tabla `scores` no cambia (definida en SPEC 06). El único estado nuevo es el del motor, en memoria
y por partida.

```ts
// engine.ts
type GameState = "playing" | "gameover";
export type TouchAction = "up" | "down" | "left" | "right" | "fire";
export interface GameOverResult {
  score: number;
  level: number; // oleada alcanzada, 1..N
}

interface Segment {
  col: number;
  row: number;
  dir: 1 | -1; // dirección horizontal
  head: boolean;
  descending: boolean;
}

interface Spider {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

class CentipedeGame {
  private mushrooms: number[][] = []; // [col][row] -> 0..4 (HP)
  private segments: Segment[] = []; // cabeza de cada cadena primero
  private player = { x: 400, y: 537.5 }; // px, confinado a las filas 16..21
  private bullets: { x: number; y: number }[] = [];
  private spider: Spider | null = null;
  private spiderTimer = 0; // segundos hasta la próxima araña
  private centAccum = 0; // acumulador del paso del ciempiés
  private score = 0;
  private lives = 3;
  private wave = 1;
  private nextExtraLife = 12000;
  private state: GameState = "playing";
  private paused = false;
  private gameOverNotified = false;

  private keys: Record<string, boolean> = {};
  private touch: Record<TouchAction, boolean> = {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
  };

  constructor(canvas: HTMLCanvasElement);
  start(): void;
  stop(): void;
  destroy(): void;
  restart(): void;
  setPaused(paused: boolean): void;
  togglePause(): void;
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  setOnGameOver(cb: (result: GameOverResult) => void): void;
  setInput(action: TouchAction, pressed: boolean): void;
}
```

Constantes del módulo (coordenadas origen arriba-izquierda; el motor dibuja siempre en
`0..800 × 0..600`):

| Concepto                 | Valor                                                                   |
| ------------------------ | ----------------------------------------------------------------------- |
| Celda                    | `CELL = 25` px                                                          |
| Rejilla de juego         | `COLS = 32`, `ROWS = 22`; origen `(0, HUD_H)` con `HUD_H = 50`          |
| Franja del cañón         | filas `16..21` (`PLAYER_ROWS = 6`); `PLAYER_SPEED = 260` px/s           |
| Bala                     | `BULLET_SPEED = 900` px/s, `MAX_BULLETS = 1`                            |
| Setas                    | `START_MUSHROOMS = 28`, `MUSHROOM_HP = 4`; `+1` al destruir             |
| Ciempiés                 | `START_SEGMENTS = 11`; `+10` cuerpo, `+100` cabeza                      |
| Paso del ciempiés        | `CENTIPEDE_CPS = [6,7,8,9,10,11,12,13,14]` celdas/s; `interval = 1/cps` |
| Cabezas sueltas / oleada | `headsExtra = min(wave - 1, 6)`                                         |
| Araña                    | aparece cada `8..14` s; `+300 / +600 / +900` por distancia              |
| Vidas                    | `3`; vida extra cada `EXTRA_LIFE_EVERY = 12000` puntos                  |
| `scores.level`           | `wave` en el momento del fin de partida                                 |

Invariantes internos (heredados del patrón de SPEC 05 / SPEC 07 / SPEC 08 / SPEC 09):

- Loop: `dt = Math.min((ts - last) / 1000, 0.05)`; `if (!paused) update(dt); draw();` y
  re-`requestAnimationFrame`.
- El ciempiés avanza con un acumulador: `centAccum += dt; while (centAccum >= interval) { centAccum -=
interval; stepCentipede(); }`, con un tope de pasos por frame para no encadenar tras un `dt` grande.
- `onKeyDown` / `onKeyUp` son campos arrow-fn (para quitarlos en `stop()`), con guard
  `isFormFieldFocused(e.target)` para no capturar el teclado mientras se escriben las iniciales.
- Fin de partida: `state = "gameover"` + `if (!gameOverNotified) { gameOverNotified = true;
onGameOver?.({ score, level: wave }); }`. `gameOverNotified` se resetea en `initGame()` para que
  `restart()` lo re-arme.
- `resize()`: `targetAspect = 800 / 600`; tras ajustar `canvas.width/height` a `tamaño * dpr` con esa
  proporción, `ctx.setTransform(pxW / 800, 0, 0, pxH / 600, 0, 0)`.
- `setInput` combina con el teclado en `update()`: `up/down/left/right` sostenidos con las flechas,
  `fire` sostenido con `Space` (autofire limitado por `MAX_BULLETS`).
- Una seta nunca se coloca en la fila `21` (la del cañón en reposo); la celda de un segmento abatido
  sí puede quedar en la franja del cañón.

```ts
// registry.ts
export const REAL_GAME_PLAYERS: Record<
  string,
  ComponentType<{ title: string }>
> = {
  rocas: AsteroidsPlayer,
  caida: TetrisPlayer,
  "bloque-buster": ArkanoidPlayer,
  serpentina: SnakePlayer,
  ciempies: CentipedePlayer,
};
```

### Mapa de archivos tras esta spec

| Archivo                                               | Tipo               | Cambio                                       |
| ----------------------------------------------------- | ------------------ | -------------------------------------------- |
| `supabase/migrations/NN-ciempies.sql`                 | migración SQL      | `+` sentencia `update … set has_leaderboard` |
| `app/lib/supabase/database.types.ts`                  | tipos generados    | regenerado                                   |
| `app/components/games/centipede/engine.ts`            | motor (agnóstico)  | nuevo                                        |
| `app/components/games/centipede/centipede-player.tsx` | client component   | nuevo                                        |
| `app/components/games/centipede/touch-controls.tsx`   | client component   | nuevo                                        |
| `app/components/games/registry.ts`                    | mapa id→componente | `+1` entrada (`ciempies`)                    |
| `app/globals.css`                                     | estilos            | `+` bloque `.centipede-*`                    |
| `CLAUDE.md`                                           | doc                | "Stack notes"                                |

`app/lib/games.ts` (lo toca la vitrina para `FALLBACK_GAME_IDS` / `fallbackGame()`), `app/lib/scores.ts`,
`app/lib/scores-actions.ts`, `app/lib/supabase/public.ts`, `app/lib/home.ts`,
`app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx`, `app/salon/page.tsx`,
`app/components/hall-of-fame.tsx`, `player-screen.tsx`, `asteroids/*`, `tetris/*`, `arkanoid/*` y
`snake/*` **no se tocan** en esta spec — ya son agnósticos del juego: todo va por `game_id` +
`has_leaderboard`.

---

## Implementation plan

Cada paso deja el sistema compilando y es commitable por separado.

1. **Mitad de leaderboard de la migración + tipos.** La fila `ciempies` ya existe (la crea la vitrina,
   `has_leaderboard = false`). Añadir al final de `supabase/migrations/NN-ciempies.sql` la sentencia
   `update public.games set has_leaderboard = true where id = 'ciempies';` y aplicarla con
   `mcp__supabase__apply_migration`. Regenerar `app/lib/supabase/database.types.ts`. Verificación:
   `mcp__supabase__list_tables` muestra `ciempies` con `has_leaderboard = true`;
   `mcp__supabase__list_migrations` incluye `NN`; `mcp__supabase__get_advisors` (security) no reporta
   nada crítico nuevo (el insert anónimo en `scores` es el hallazgo esperado de SPEC 06); un `insert`
   de prueba vía `mcp__supabase__execute_sql` con `game_id = 'ciempies'` y datos válidos se acepta, y
   con `game_id = 'invasores'` se rechaza; `npm run build` compila (la app aún usa `PlayerScreen` para
   `ciempies` en este punto).

2. **Esqueleto del motor + dispatch.** Crear `app/components/games/centipede/engine.ts` con la clase
   `CentipedeGame` mínima: `constructor` (canvas + `getContext("2d")`, `throw` si no hay ctx),
   `start`/`stop`/`destroy`/`restart`, `setPaused`/`togglePause`, `resize`, `setOnGameOver`,
   `setInput`, y un loop `rAF` que solo pinta el canvas de negro. Crear
   `app/components/games/centipede/centipede-player.tsx` (marco `.crt` + `<canvas
className="centipede-canvas">` + `useEffect` que monta/destruye el motor + `ResizeObserver` +
   enlace `VOLVER`, sin overlay todavía). Añadir `ciempies: CentipedePlayer` a `registry.ts` y el
   bloque `.centipede-*` mínimo (stage + canvas) a `globals.css`. Verificación:
   `/juego/ciempies/jugar` muestra un canvas negro dentro del marco CRT; `/juego/invasores/jugar`
   sigue mostrando `PlayerScreen`; `npm run build` y `npm run lint` pasan.

3. **Campo de setas + ciempiés + cañón + teclado + dibujo.** Portar a `engine.ts`: constantes,
   `initGame()` (siembra de setas, cañón, ciempiés inicial), `stepCentipede()` (avance a paso fijo,
   baja + invierte al chocar con seta/borde, rebote en la franja del cañón), el movimiento del cañón
   por su franja, el disparo (`Space` → bala, `MAX_BULLETS`), las colisiones bala↔seta y bala↔segmento
   (partición de la cadena, `+10` / `+100`, celda a seta), la limpieza de oleada (`wave += 1`, nuevo
   ciempiés + cabezas sueltas), la pérdida de vida al tocar el cañón y el `endGame()` a 0 vidas.
   `draw()` pinta la banda de HUD (`SCORE` / vidas / `OLEADA n`), la rejilla sutil, las setas con
   brillo según HP, el ciempiés en `var(--magenta)`, el cañón en `var(--yellow)` y la bala. `start()`
   engancha `keydown`/`keyup`; `stop()` los quita. `Escape`/`P` pausan con overlay "EN PAUSA"; el
   motor **no** pinta "GAME OVER". Verificación manual con teclado en 800×600 fijo: mover el cañón por
   su franja, disparar, trocear el ciempiés y verlo partirse, destruir setas en 4 impactos, subir de
   oleada al limpiar y notar la aceleración, perder vidas al contacto, disparo único del callback con
   `{ score, level: wave }`. Navegar fuera a media partida no deja `requestAnimationFrame` huérfano ni
   errores.

4. **Araña + vida extra + escalado responsive + táctiles.** Añadir la araña (temporizador de
   aparición, rebote diagonal en las filas `13..21`, come setas, mata al contacto, `+300/+600/+900`
   por distancia) y la vida extra cada `EXTRA_LIFE_EVERY` puntos. `resize(cssW, cssH, dpr)` con
   `targetAspect = 800/600` y `ctx.setTransform`. En `centipede-player.tsx`, `.centipede-stage` +
   `ResizeObserver` que llama a `resize`. Crear `touch-controls.tsx` con los 5 botones (D-pad + fuego)
   cableados a `game.setInput()`; `update()` combina `keys` + `touch`. Completar el bloque
   `.centipede-*` de `globals.css`. Verificación: el juego llena el marco CRT en escritorio y a
   ~390 px sin deformarse, nítido con `devicePixelRatio > 1`, sin scroll horizontal; en viewport
   táctil (`pointer: coarse`) los 5 botones mueven y disparan y en escritorio no se ven; las flechas y
   `Space` no hacen scroll de la página.

5. **Guardado real + docs + revisión visual.** En `centipede-player.tsx`: overlay `.modal` con "FIN
   DEL JUEGO", puntuación final, input de iniciales (filtro `[A-Za-z0-9_]`, máx 12, mayúsculas) y los
   botones; `submitScore({ gameId: "ciempies", name, score, level })`; estados guardando (botón
   deshabilitado) / "▸ PUNTUACIÓN GUARDADA_" / error legible sin romper el canvas; `JUGAR DE NUEVO` →
   `game.restart()` + `setOver(null)`. Actualizar "Stack notes" de `CLAUDE.md`. `npm run lint` y
   `npm run build` limpios; quitar imports / `console` sin usar. Screenshots con Playwright MCP en
   `.playwright-screenshots/` de `/juego/ciempies/jugar` (inicio, en curso, overlay de guardado),
   `/juego/ciempies` (aside con datos y vacío) y `/salon` (tab `CIEMPIÉS` con datos y vacía), en
   escritorio y ~390 px. Verificar que `/juego/rocas`, `/juego/caida`, `/juego/bloque-buster`,
   `/juego/serpentina` y `/juego/invasores` no han cambiado de comportamiento. Commitear el bloque
   gestionado de `AGENTS.md` / `CLAUDE.md` si `next dev` lo reescribió.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `npm run lint` sin errores ni warnings.
- [ ] `app/components/games/centipede/engine.ts` no importa nada de `react` ni de `next`.
- [ ] `mcp__supabase__list_tables` muestra `public.games` con la fila `ciempies` y
      `has_leaderboard = true`; `mcp__supabase__list_migrations` incluye la migración `NN`.
- [ ] `supabase/migrations/NN-ciempies.sql` existe en el repo con el `insert` de la vitrina y el
      `update … set has_leaderboard = true` de esta spec, y es el SQL aplicado.
- [ ] Insertar en `scores` una fila con `game_id = 'invasores'` vía API `anon` es rechazado por la
      política; con `game_id = 'ciempies'` y datos válidos, se acepta.
- [ ] `/juego/ciempies/jugar` renderiza un `<canvas>` dentro del marco CRT (`.crt` / `.crt-screen` /
      `.crt-bottom`), sin HUD React.
- [ ] `/juego/invasores/jugar` (y el resto de ids sin motor real) sigue mostrando `PlayerScreen` con
      el contador simulado; `/juego/rocas/jugar`, `/juego/caida/jugar`, `/juego/bloque-buster/jugar` y
      `/juego/serpentina/jugar` siguen con sus motores.
- [ ] `generateStaticParams` de `/juego/[id]` y `/juego/[id]/jugar` genera también la ruta
      `ciempies`; ningún id existente da 404.
- [ ] Teclado: `←` `↑` `→` `↓` mueven el cañón dentro de su franja; `Space` dispara y mantener `Space`
      re-dispara al desaparecer la bala.
- [ ] Solo hay una bala activa a la vez (`MAX_BULLETS = 1`).
- [ ] Una seta requiere 4 impactos: los tres primeros bajan su brillo, el cuarto la elimina y suma
      exactamente `+1`.
- [ ] Disparar a un segmento de cuerpo suma `+10`, a una cabeza `+100`; el segmento abatido deja una
      seta a HP 4 en su celda y la cadena se parte en dos.
- [ ] El ciempiés baja una fila e invierte su dirección al chocar con una seta, un borde o el fondo
      del área de juego, y serpentea por las filas inferiores al llegar a la franja del cañón.
- [ ] Al abatir todos los segmentos sube la oleada (`wave += 1`), reaparece un ciempiés más corto con
      cabezas sueltas y el paso se acelera (`interval` menor).
- [ ] La araña aparece cada 8–14 s, rebota en diagonal por las filas inferiores, se come las setas
      por las que pasa, y abatirla suma `+300`, `+600` o `+900` según la distancia al cañón.
- [ ] Un segmento del ciempiés o la araña tocando el cañón resta una vida; a 0 vidas el motor entra
      en `gameover` y dispara `onGameOver` **una sola vez** con `{ score, level }` (`level` = oleada).
- [ ] Al cruzar cada múltiplo de 12 000 puntos se suma una vida.
- [ ] El canvas **no** dibuja el texto "GAME OVER"; al terminar aparece un overlay React (`.modal`)
      con la puntuación final y un input de iniciales.
- [ ] El input de iniciales solo acepta `[A-Za-z0-9_]`, máximo 12, y lo muestra en mayúsculas.
- [ ] `GUARDAR PUNTUACIÓN` con un nombre válido inserta una fila en `scores` (`game_id = 'ciempies'`,
      `score` y `level` de la partida) y muestra "PUNTUACIÓN GUARDADA"; la fila aparece luego en
      `/juego/ciempies` y `/salon` tab `CIEMPIÉS`.
- [ ] `submitScore` con nombre inválido, o con Supabase caído, devuelve `{ ok: false, error }` y el
      overlay muestra el mensaje sin romper el canvas.
- [ ] `JUGAR DE NUEVO` en el overlay reinicia la partida vía `game.restart()` sin recargar la página.
- [ ] Con `scores` sin filas de `ciempies`: la tab `CIEMPIÉS` de `/salon` y el aside de
      `/juego/ciempies` muestran el estado vacío `.lb-empty` en vez de podio / filas.
- [ ] El canvas escala manteniendo proporción 4:3, se ve nítido con `devicePixelRatio > 1`, y la
      página no tiene scroll horizontal a ~390 px.
- [ ] Con las flechas y `Space` durante la partida, la página no hace scroll.
- [ ] En viewport táctil (`pointer: coarse`) se ven 5 botones (D-pad + disparo) que mueven y disparan;
      en escritorio no se muestran.
- [ ] `Escape` o `P` alternan pausa con un overlay "EN PAUSA" en el canvas; cambiar de pestaña pausa.
- [ ] Navegar fuera de `/juego/ciempies/jugar` a media partida no deja errores en consola ni un
      `requestAnimationFrame` activo.
- [ ] El juego no usa `localStorage` ni IndexedDB, no reproduce audio ni carga assets; la única
      petición de red es `submitScore`.
- [ ] Invariante: `games.has_leaderboard = true` para `ciempies` ⇔ `ciempies` está en
      `REAL_GAME_PLAYERS`.
- [ ] `app/globals.css` solo añade el bloque `.centipede-*`; no añade ningún `.cover-*` (lo hace la
      vitrina) y no redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`,
      `.hall-table*`, `.leaderboard`, `.lb-row` ni `.lb-empty`.
- [ ] Hay screenshots en `.playwright-screenshots/` de `/juego/ciempies/jugar`, `/juego/ciempies` y
      `/salon` tab `CIEMPIÉS` (con datos y vacío), en escritorio y ~390 px.
- [ ] `CLAUDE.md` "Stack notes" menciona que `ciempies` (Ciempiés) tiene motor real y
      `has_leaderboard`.

---

## Decisions

- **Sí:** entrada de catálogo **nueva** (`ciempies`), creada por la vitrina. **No:** reutilizar la
  ficha simulada `invasores` — es la reservada a Space Invaders (su copy habla de "filas alienígenas"
  y "formación tras formación"); reutilizarla dejaría Space Invaders huérfano y con copy que miente.
  Ningún otro simulado (`gloton` Pac-Man, `ranaria` Frogger, `duelo-pixel` Pong) encaja con Ciempiés.
- **Sí:** las dos features (motor real + leaderboard) en el lote, como hicieron SPEC 06–09.
  `has_leaderboard = true` solo tiene sentido con un juego en `REAL_GAME_PLAYERS`; el flag lo activa
  esta spec, emparejado con la entrada del registry.
- **Sí:** motor **desde cero**. No hay `references/started-games/` para Ciempiés; se sigue el contrato
  de clase de SPEC 05 sin portar código, igual que SPEC 09 para Snake.
- **Sí:** espacio interno **800×600 (4:3)** con banda de HUD de 50 px y rejilla de 32×22 celdas de
  25 px, igual que `serpentina` y `bloque-buster`. Llena el marco CRT sin bandas. **No:** un tablero
  vertical estrecho tipo recreativa original (dejaría bandas laterales fuertes).
- **Sí:** cañón con **movimiento libre en px** confinado a las 6 filas inferiores. Da el tacto de
  esquiva del Centipede original. **No:** cañón bloqueado a la rejilla — se sentiría rígido.
- **Sí:** **una sola bala en pantalla** (`MAX_BULLETS = 1`) con autofire al mantener `Space`, como el
  arcade original. **No:** multibala — trivializa el troceado del ciempiés.
- **Sí:** el ciempiés **se parte en dos** al recibir un impacto en el cuerpo y la celda impactada se
  vuelve seta. Es la mecánica identitaria del juego. **No:** un ciempiés que solo pierde el segmento
  final.
- **Sí:** **araña** como único enemigo secundario, con puntuación por distancia `300/600/900`.
  **No:** pulga y escorpión — más estado y más criterios para el mismo lote; van en otra spec.
- **Sí:** el juego **acelera por oleadas** y `scores.level` reporta la **oleada alcanzada**. Da
  progresión y contexto a la marca, igual que el `level` de `rocas`, `caida`, `bloque-buster` y
  `serpentina`.
- **Sí:** **vida extra cada 12 000 puntos**, como el arcade. Es una línea de lógica y recompensa las
  partidas largas.
- **Sí:** render **procedural en la paleta neon**, cero assets binarios. Coherente con `rocas`,
  `caida` y `bloque-buster`. **No:** spritesheet de bichos.
- **Sí:** controles táctiles con **D-pad de 4 botones + disparo**, sostenidos, gated por
  `(pointer: coarse)`, en línea con el resto de juegos reales. Sin ellos el juego es injugable en
  móvil.
- **No:** tocar `PlayerScreen`, `CATS`, la infraestructura de `scores` / catálogo ni el copy de otras
  fichas. Los juegos simulados restantes siguen igual hasta su propia spec.

---

## Risks

| Riesgo                                                                           | Mitigación                                                                                            |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `requestAnimationFrame` no cancelado al navegar → loop huérfano                  | `destroy()` en el cleanup del `useEffect`; criterio de aceptación dedicado (heredado de SPEC 05).     |
| React StrictMode monta el efecto dos veces en dev → doble motor                  | `gameRef.current?.destroy()` al principio del efecto; `destroy()` idempotente.                        |
| `has_leaderboard` y `REAL_GAME_PLAYERS` se desincronizan                         | El flag lo activa esta spec junto con la entrada del registry; invariante en criterios.               |
| La vitrina no está aplicada y la fila `ciempies` no existe al correr el `update` | `Depende de` marca la vitrina como precondición; el paso 1 verifica la fila antes del `update`.       |
| `get_advisors` marca el `insert` anónimo de `scores`                             | Intencional y heredado de SPEC 06; revisar que no haya **otros** hallazgos.                           |
| `dt` grande al volver de una pestaña en segundo plano → varios pasos de golpe    | `dt` capado a 50 ms + tope de pasos del ciempiés por frame + auto-pausa en `visibilitychange`.        |
| La partición de la cadena deja segmentos "huérfanos" mal enlazados               | `stepCentipede()` reconstruye cada cadena desde su cabeza; test manual del troceado en el paso 3.     |
| `preventDefault` de las flechas / `Space` afecta a otras rutas                   | Solo se engancha mientras el juego está montado y se quita en el cleanup; guard `isFormFieldFocused`. |
| El HUD y las setas en la paleta neon quedan ilegibles a ~390 px                  | Texto con `var(--pixel)` a tamaño legible; la revisión visual con Playwright a 390 px lo verifica.    |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`           | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                             |

---

## Lo que **no** entra en esta spec

- Sonido y música.
- La pulga y el escorpión, las setas envenenadas y el descenso vertical acelerado.
- Sprites / assets binarios; control con trackball o ratón.
- Multibala, cadencia configurable, potenciadores.
- Modo a 2 jugadores o versus; persistencia local.
- Auth real, columna `user_id` en `scores`, tabla `profiles`.
- Recalcular `games.best` / `games.plays` desde datos reales.
- Portar los otros juegos simulados a motor real.
- Marcas reales en la home; Realtime o paginación en el leaderboard.
- Todo lo de la vitrina: portada `.cover-ciempies`, copy del catálogo, ficha y `/salon`.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
