# SPEC game-jam · barriles · 01 — Barriles en la entrada `barriles`: motor + leaderboard

> **Estado:** Borrador
> **Lote:** game jam «Barriles (clon de Donkey Kong)» — 2026-08-30
> **Depende de:** SPEC 01, SPEC 05, SPEC 06 · vitrina `02-barriles-vitrina.md`
> **Fecha:** 2026-08-30
> **Numeración:** local del lote; al aprobar, renumérala como `specs/NN-barriles.md` antes de `/add-game`.
> **Objetivo:** Construir desde cero un clon de Donkey Kong en un motor TypeScript agnóstico de framework montado en el marco CRT del reproductor, conectado a la entrada de catálogo `barriles`, con vigas escalonadas, escaleras, barriles deterministas, martillo y guardado real de puntuaciones bajo RLS.

---

## Por qué existe esta spec

SPEC 05 portó `rocas` (Asteroides) a un motor real y fijó el patrón: `engine.ts` sin React/Next +
envoltorio `"use client"` fino, registrado en `app/components/games/registry.ts`. SPEC 06 movió el
catálogo y las puntuaciones a Supabase y añadió el overlay React de guardado, la tabla `scores` con
inserción anónima bajo RLS condicionada a `games.has_leaderboard`, y el estado vacío del leaderboard.
SPEC 07, SPEC 08 y SPEC 09 repitieron el patrón para `caida` (Tetris), `bloque-buster` (Arkanoid) y
`serpentina` (Snake); SPEC 11 lo repitió para `ranaria` (Frogger). Hoy `rocas`, `caida`,
`bloque-buster`, `serpentina` y `ranaria` son los únicos juegos con motor real y
`has_leaderboard = true`.

El catálogo no tiene ningún juego de **plataformas de escalada con obstáculos rodantes**: los cinco
motores reales existentes son de inercia 360° (`rocas`), caída de piezas (`caida`), rebote de pelota
(`bloque-buster`), recorrido en rejilla (`serpentina`) y cruce de carriles (`ranaria`). El lote
«Barriles» llena ese hueco con una entrada de catálogo **nueva**, `barriles`, categoría `ARCADE`: un
peón que trepa una torre de vigas inclinadas esquivando barriles que ruedan hacia abajo por rutas
deterministas, salta en el momento justo, y usa un martillo temporal para destruirlos. La mecánica
—vigas escalonadas con pendiente fija, barriles con trayectoria determinista (sin IA de persecución),
salto con ventana de invulnerabilidad y combo de martillo— es **distinta** de los cinco motores ya
implementados.

Esta spec aplica SPEC 05 + SPEC 06 tal cual, sin tocar la infraestructura compartida:
`app/lib/scores.ts`, `app/lib/scores-actions.ts`, `app/lib/supabase/public.ts`, `app/juego/[id]/*` y
`app/salon/*` ya son agnósticos del juego — todo va por `game_id` + `has_leaderboard`. La fila
`barriles` de la tabla `games` la **crea la vitrina** (`02-barriles-vitrina.md`), que es
**precondición** de esta spec; aquí solo se añade la mitad de leaderboard de la migración y la entrada
en `REAL_GAME_PLAYERS`.

**No hay juego de referencia.** No existe `references/started-games/` para un clon de Donkey Kong; el
motor se escribe desde cero siguiendo el contrato de clase de SPEC 05, igual que se hizo con Snake
(SPEC 09) y Ciempiés. Donkey Kong es nativo de pantalla **vertical** (una torre alta y estrecha); esta
spec **rediseña el layout** a un espacio interno **720×600 (relación ~4:3)** para encajar en el marco
CRT sin bandas — ver Decisions.

Esta spec **no revisa** ninguna decisión de SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09 ni SPEC 11.

---

## Scope

**In:**

- `supabase/migrations/NN-barriles.sql` — **la mitad de leaderboard**. El archivo lo crea la vitrina
  (`02-barriles-vitrina.md`) con el `insert` de la fila `barriles` y `has_leaderboard = false`. Esta
  spec **añade al final del mismo archivo** una sola sentencia:
  - `update public.games set has_leaderboard = true where id = 'barriles';`
  - Se aplica al proyecto remoto con `mcp__supabase__apply_migration` junto con la mitad de la
    vitrina. La tabla `scores` **ya existe** desde SPEC 06: no se recrea, no se toca su RLS.
- `app/lib/supabase/database.types.ts` — regenerado con `mcp__supabase__generate_typescript_types`
  tras la migración (el esquema no cambia de columnas; se regenera por higiene).
- `app/components/games/kong/engine.ts` (nuevo) — motor escrito desde cero, **sin ninguna importación
  de `react` ni de `next`**. Exporta la clase `KongGame` y los tipos `TouchAction` / `GameOverResult`.
  Dibuja siempre en el espacio interno fijo **720×600**; el escalado responsive vive solo en
  `resize()`. `dt` capado a 50 ms. **No** pinta el texto de "GAME OVER" (lo pone el overlay React); sí
  pinta la banda de HUD, las vigas escalonadas, las escaleras, el peón, los barriles, el martillo (si
  hay), la meta y el overlay "EN PAUSA".
  - Constantes del módulo: `HUD_H = 40` (área de juego `720 × 560` desde `y = 40`), `ROWS = 5`
    (índice `0` = viga inicial abajo, `4` = viga meta arriba), `ROW_H = 112`,
    `ROW_BASE_Y(row) = 540 - row * 112` (`540, 428, 316, 204, 92`), `STEPS_PER_GIRDER = 8`,
    `STEP_W = 90` (`720 / 8`), `STEP_H = 10`, `LADDER_XS = [180, 540]`, `LADDER_HALF_W = 18`,
    `PLAYER_W = 22`, `PLAYER_H = 30`, `PLAYER_SPEED = 160` px/s, `LADDER_SPEED = 140` px/s,
    `JUMP_DURATION = 0.4` s, `JUMP_HEIGHT = 46` px, `BARREL_SIZE = 24`, `BARREL_BASE_SPEED = 130`
    px/s, `SPAWN_INTERVAL_BASE = 3.2` s, `HAMMER_POS = { row: 2, x: 360 }`, `HAMMER_DURATION = 6` s,
    `HAMMER_COMBO_SCORES = [300, 500, 800]`, `JUMP_SCORE = 100`, `START_LIVES = 3`,
    `PLAYER_START = { row: 0, x: 40 }`, `GOAL = { row: 4, x: 60 }` (alcanzar la viga `4` con
    `x ≤ 60`).
  - **Vigas como escalera discreta**, no como pendiente continua: cada viga `row` tiene 8 escalones
    planos de `STEP_W = 90` px de ancho. Para `row` **par** (tiende a bajar hacia la derecha):
    `stepY(row, i) = ROW_BASE_Y[row] - (7 - i) * STEP_H`; para `row` **impar** (tiende a bajar hacia la
    izquierda): `stepY(row, i) = ROW_BASE_Y[row] - i * STEP_H`, con `i = Math.floor(x / STEP_W)`
    acotado a `0..7`. La superficie de una viga en cualquier `x` es `girderY(row, x) = stepY(row,
clamp(Math.floor(x / STEP_W), 0, 7))`. Esto da el efecto visual de una viga inclinada en zigzag
    (alternando por fila) sin pendientes continuas: la colisión y el reposo del peón son siempre un
    rectángulo alineado a ejes sobre el escalón actual.
  - **Escaleras**: dos por cada unión entre `row` y `row + 1`, en `x = 180` y `x = 540`. Una escalera
    conecta `girderY(row, x)` con `girderY(row + 1, x)` en línea recta vertical. El peón puede
    trepar/bajar por una escalera cuando su `x` está a menos de `LADDER_HALF_W` del centro y su `row`
    actual coincide con uno de los dos extremos de esa escalera.
  - Estado del peón (ver Data model): `playerRow`, `playerX`, `playerMode`
    (`"walking" | "climbing" | "jumping"`), `jumpElapsed`, `hasHammer`, `hammerTimer`, `hammerCombo`,
    `hammerAvailable`. - `"walking"`: `playerX` se mueve con `←`/`→` a `PLAYER_SPEED`, acotado a `0..720`; `playerY =
girderY(playerRow, playerX)`. `↑`/`↓` inician `"climbing"` solo si `playerX` está dentro de
    `LADDER_HALF_W` de una `LADDER_XS[i]` que conecte con la fila adyacente en esa dirección, y
    **nunca** mientras `hasHammer` es `true` (igual que el arcade: no se trepa con el martillo en
    la mano). - `"climbing"`: `playerX` fijo en el centro de la escalera; `playerY` se mueve con `↑`/`↓` a
    `LADDER_SPEED` entre `girderY(playerRow, x)` y `girderY(playerRow + 1, x)`; al llegar a un
    extremo, `playerMode = "walking"` y `playerRow` cambia. - `"jumping"`: se activa por **flanco** de `Espacio`/`KeyX` (o el botón táctil `jump`) solo desde
    `"walking"`, dura `JUMP_DURATION`; el desplazamiento horizontal sigue respondiendo a `←`/`→`;
    la `y` dibujada resta un offset parabólico
    `jumpOffset(t) = JUMP_HEIGHT * 4 * (t / JUMP_DURATION) * (1 - t / JUMP_DURATION)` sobre
    `girderY(playerRow, playerX)`; no cambia `playerRow`; al terminar, vuelve a `"walking"`.
  - Barriles (ver Data model): se generan en `GOAL` (`row = 4`, `x = 40`, `dir = 1`) cada
    `spawnInterval = Math.max(1.2, SPAWN_INTERVAL_BASE - 0.3 * (level - 1))` segundos, con un
    `barrelIndex` incremental. Cada barril rueda con
    `speed = BARREL_BASE_SPEED * Math.min(2, 1 + 0.12 * (level - 1))` px/s:
    - `mode: "rolling"`: `x += dir * speed * dt`. Determinismo: si `barrelIndex % 3 === 0`
      **y** el barril cruza en su dirección de avance alguna `LADDER_XS[i]` que conecte con la fila
      inferior, pasa a `mode: "laddering"` en ese `x`. En caso contrario, al llegar a un borde
      (`x ≤ 0` o `x ≥ 720`) y si `row > 0`, pasa a `mode: "falling"`; si `row === 0`, se elimina
      (cae fuera de la torre).
    - `mode: "laddering"`: desciende en vertical desde `girderY(row, x)` hasta `girderY(row - 1, x)`
      a `220` px/s; al llegar, `row -= 1`, `dir = -dir`, `mode = "rolling"`.
    - `mode: "falling"`: cae en vertical desde `girderY(row, edgeX)` hasta `girderY(row - 1, edgeX)`
      durante `EDGE_FALL_TIME = 0.25` s (interpolación lineal por `fallElapsed`); al completarse,
      `row -= 1`, `dir = -dir`, `mode = "rolling"`, `x` se mantiene en `edgeX`.
    - Ningún barril persigue al peón ni consulta su posición: la ruta de cada barril depende solo de
      `barrelIndex % 3`, su `row`/`x`/`dir` de partida y el tiempo — **sin IA de persecución**.
  - Colisión peón↔barril: cada frame, si `playerRow === barrel.row` y `barrel.mode === "rolling"`, se
    comprueba solape de AABB (`PLAYER_W × PLAYER_H` contra `BARREL_SIZE × BARREL_SIZE`).
    - Si `playerMode === "jumping"` y hay solape y `barrel.jumpedOver !== true`: `score += JUMP_SCORE`
      (100), `barrel.jumpedOver = true`, el barril sigue rodando.
    - Si `playerMode !== "jumping"` y hay solape:
      - con `hasHammer`: el barril se elimina, `hammerCombo = Math.min(hammerCombo + 1, 3)`,
        `score += HAMMER_COMBO_SCORES[hammerCombo - 1]` (300 / 500 / 800; se queda en 800 para
        golpes adicionales dentro del mismo martillo).
      - sin `hasHammer`: `loseLife()` (ver abajo).
  - Martillo: `HAMMER_POS` fijo por partida; si `hammerAvailable` y el peón solapa esa celda en
    `"walking"`, `hasHammer = true`, `hammerTimer = HAMMER_DURATION`, `hammerCombo = 0`,
    `hammerAvailable = false`. `hammerTimer` decrece cada frame; a `0`, `hasHammer = false`.
  - Reloj: `timeLeft` arranca en `TIME_LIMIT(level) = Math.max(30, 60 - (level - 1) * 5)` y decrece
    cada frame mientras `state === "playing"`. A `timeLeft ≤ 0`: `loseLife()`.
  - `loseLife()`: `lives -= 1`; si `lives === 0` → `endGame()`; si no, se limpian los barriles activos,
    se reinicia `spawnTimer`, `playerRow/playerX/playerMode` vuelven a `PLAYER_START`/`"walking"`,
    `hasHammer = false`, `hammerAvailable = true` (si aún no se había recogido en este intento;
    si ya estaba consumida en este `level`, permanece consumida), `timeLeft = TIME_LIMIT(level)`.
  - Meta: cuando `playerRow === GOAL.row` y `playerX ≤ GOAL.x`: `score += Math.round(timeLeft) * 10`,
    `level += 1`, se reinicia el tablero (barriles fuera, `spawnTimer = 0`, `hammerAvailable = true`,
    `playerRow/playerX/playerMode` a `PLAYER_START`/`"walking"`, `timeLeft = TIME_LIMIT(level)`),
    conservando `score` y `lives`.
  - Fin de partida: `state = "gameover"` + `if (!gameOverNotified) { gameOverNotified = true;
onGameOver?.({ score, level }); }`. `gameOverNotified` se resetea en `initGame()`. `level` es el
    **número de torre alcanzada** en el momento de perder la última vida (no baja al perder una vida
    intermedia).
  - `draw()`: banda de HUD (`SCORE` a la izquierda, `TORRE n` centrado, vidas como iconos triangulares
    y `TIEMPO` a la derecha, con `var(--pixel)`), las 5 vigas como líneas escalonadas en
    `var(--cyan)`, las 4 escaleras como travesaños cortos en `var(--yellow)`, el peón como una figura
    simple en `var(--magenta)` (con un pequeño icono de martillo superpuesto si `hasHammer`), los
    barriles como círculos en `var(--green)`, el icono del martillo en `HAMMER_POS` mientras
    `hammerAvailable`, y un marcador de meta (silueta + bandera) en `GOAL`. El overlay "EN PAUSA" se
    pinta cuando `paused`. **Nunca** pinta "GAME OVER".
  - Contrato de la clase: `constructor(canvas)`, `start()`, `stop()`, `destroy()`, `restart()`,
    `setPaused()` / `togglePause()`, `resize(cssW, cssH, dpr)`, `setOnGameOver(cb)`,
    `setInput(action, pressed)`.
  - Input: `←` `→` mueven al peón mientras están pulsadas (en `"walking"` y también en `"jumping"`);
    `↑` `↓` inician/continúan el trepado en `"climbing"` (ignoradas mientras `hasHammer`); `Espacio` /
    `KeyX` (o el botón táctil `jump`) disparan el salto como **flanco**, solo desde `"walking"`.
    `onKeyDown` / `onKeyUp` son campos arrow-fn con guard `isFormFieldFocused(e.target)`. `Escape` /
    `KeyP` alternan pausa; el motor **no** pinta "GAME OVER"; el overlay de pausa no lleva selector de
    nada.
- `app/components/games/kong/kong-player.tsx` (nuevo, `"use client"`) — envoltorio fino, copia de
  `app/components/games/asteroids/asteroids-player.tsx` con `GAME_ID = "barriles"` y la clase
  `KongGame`:
  - Marco CRT (`.crt` / `.crt-screen` / `.crt-bottom`), `<canvas className="kong-canvas" width={720}
height={600}>` dentro de `.kong-stage`.
  - `useEffect` de montaje: guard StrictMode (`gameRef.current?.destroy()`), `new KongGame(canvas)`,
    `game.setOnGameOver(setOver…)`, `applySize()` con `stage.getBoundingClientRect()` →
    `game.resize(w, h, devicePixelRatio || 1)`, `ResizeObserver` sobre el stage, `game.start()`,
    `visibilitychange` → `game.setPaused(document.hidden)`, `keydown` en `window` con
    `preventDefault` de `ArrowUp/ArrowDown/ArrowLeft/ArrowRight/Space` (salvo si se escribe en un
    input) y `Escape`/`KeyP` → `togglePause()`, `Space` → cerrar el overlay. Cleanup:
    `ro.disconnect()`, quitar listeners, `game.destroy()`, `gameRef.current = null`.
  - Overlay `.modal-bd` / `.modal` (reutiliza las clases de `globals.css`) con `<h2>FIN DEL
JUEGO</h2>`, `.final-label`, `.final` con `over.score.toLocaleString("es-ES")`, input de iniciales
    (`e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 12)`), botón `GUARDAR
PUNTUACIÓN` (`disabled` si `phase === "saving" || name.length === 0`) →
    `submitScore({ gameId: "barriles", name, score: over.score, level: over.level })`, `.actions` con
    `JUGAR DE NUEVO` → `game.restart()` + `setOver(null)` y `VOLVER` → `/juego/barriles`. Estados
    `idle | saving | saved | error`: `saved` → `<div className="toast-saved">▸ PUNTUACIÓN
GUARDADA_</div>`, `error` → muestra `res.error` sin romper el canvas.
  - `crt-bottom`: etiqueta `BARRILES · CRT-83 · 60 HZ` y `DONKEY KONG`.
  - Monta `<KongTouchControls onInput={handleInput} />` dentro de `.crt-screen`.
- `app/components/games/kong/touch-controls.tsx` (nuevo, `"use client"`) — copia de
  `asteroids/touch-controls.tsx` con 5 botones: D-pad en cruz (`▲ ▼ ◄ ►`) abajo-izquierda y `SALTO`
  abajo-derecha. `TouchAction = "up" | "down" | "left" | "right" | "jump"`. `left` / `right` / `up` /
  `down` son booleanos sostenidos (`onPointerDown` → `onInput(action, true)`; `onPointerUp` /
  `onPointerCancel` / `onPointerLeave` → `false`); `jump` dispara un flanco en `onPointerDown`.
  `e.preventDefault()` en cada handler. Visibles solo bajo `@media (pointer: coarse)`.
- `app/components/games/registry.ts` — añadir `barriles: KongPlayer` a `REAL_GAME_PLAYERS`.
- `app/globals.css` — anexar al final el bloque `/* ===== juego: kong (barriles) ===== */`:
  - `.kong-stage` (`position: absolute; inset: 0; background: #000;`).
  - `.kong-canvas` (`display: block; width: 100%; height: 100%; object-fit: contain;
touch-action: none;`).
  - `.kong-touch` (`position: absolute; inset: 0; display: none; pointer-events: none; z-index: 4;`)
    - `@media (pointer: coarse) { .kong-touch { display: block; } }` + `.kong-touch-btn` con las 5
      variantes de posición (`.up` `.down` `.left` `.right` en cruz abajo-izquierda, `.jump`
      abajo-derecha).
  - **No** añade ningún `.cover-*` — `.cover-barriles` lo añade la vitrina (`02-barriles-vitrina.md`).
  - **No** redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`,
    `.hall-table*`, `.leaderboard`, `.lb-row`, `.lb-empty`.
- `CLAUDE.md` — "Stack notes": actualizar la línea de leaderboards (añadir `barriles`) y la de "Real
  games" (añadir `kong` → `barriles`, motor desde cero, espacio interno 720×600).
- Revisión visual con Playwright MCP: screenshots en `.playwright-screenshots/` de
  `/juego/barriles/jugar` (inicio, partida en curso, overlay de guardado), `/juego/barriles` (aside
  con datos y vacío) y `/salon` (tab `BARRILES` con datos y vacía), en escritorio y ~390 px. Verificar
  que `/juego/rocas`, `/juego/caida`, `/juego/bloque-buster`, `/juego/serpentina` y `/juego/ranaria`
  siguen igual y que otro juego simulado (p. ej. `/juego/gloton`) sigue con `seededScores`.

**Out of scope (para futuras specs):**

- Sonido y música.
- Vigas con pendiente continua (curva real); se usa una escalera discreta de segmentos planos — ver
  Decisions.
- Barriles en llamas, cubos de fuego voladores, muelles/resortes, la torre "cemento" u otras variantes
  de niveles del arcade original.
- Multi-vida de barril (rebote sobre el peón), power-ups distintos del martillo.
- Animación de la princesa/objetivo más allá de un marcador estático en la meta.
- Modo a 2 jugadores o versus.
- Persistencia local (`localStorage` / IndexedDB).
- Auth real / columna `user_id` en `scores` (el leaderboard sigue siendo anónimo por iniciales).
- Recalcular `games.best` / `games.plays` desde datos reales (siguen siendo columnas mock estáticas).
- Portar los otros juegos simulados a motor real.
- Marcas reales en la home; Realtime / paginación del leaderboard.
- Todo lo de la vitrina: la portada `.cover-barriles`, el copy del catálogo, la ficha
  `/juego/barriles` y la pestaña de `/salon` (van en `02-barriles-vitrina.md`).
- Tests automatizados (no hay runner).

---

## Data model

La tabla `scores` no cambia (definida en SPEC 06). El único estado nuevo es el del motor, en memoria y
por partida.

```ts
// engine.ts
type GameState = "playing" | "gameover";
type PlayerMode = "walking" | "climbing" | "jumping";
export type TouchAction = "up" | "down" | "left" | "right" | "jump";
export interface GameOverResult {
  score: number;
  level: number; // torre/fase superada, 1..N
}

interface Barrel {
  id: number;
  row: number; // 0..4
  x: number; // px, 0..720
  dir: 1 | -1;
  mode: "rolling" | "laddering" | "falling";
  fallElapsed: number; // segundos, solo en mode "falling"
  jumpedOver: boolean; // ya sumó +100 en esta vida
}

class KongGame {
  private playerRow = 0;
  private playerX = 40;
  private playerMode: PlayerMode = "walking";
  private jumpElapsed = 0; // segundos dentro del salto actual
  private hasHammer = false;
  private hammerTimer = 0;
  private hammerCombo = 0; // 0..3, golpes dentro del martillo actual
  private hammerAvailable = true;

  private barrels: Barrel[] = [];
  private barrelIndex = 0;
  private spawnTimer = 0;

  private score = 0;
  private lives = 3;
  private level = 1;
  private timeLeft = 60;

  private state: GameState = "playing";
  private paused = false;
  private gameOverNotified = false;

  private keys: Record<string, boolean> = {};
  private touch: Record<TouchAction, boolean> = {
    up: false,
    down: false,
    left: false,
    right: false,
    jump: false,
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
`0..720 × 0..600`):

| Concepto              | Valor                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------- |
| Área de juego         | `HUD_H = 40`; juego en `720 × 560` desde `y = 40`                                           |
| Vigas                 | `ROWS = 5` (0 abajo .. 4 arriba); `ROW_H = 112`; `ROW_BASE_Y = [540,428,316,204,92]`        |
| Escalera de la viga   | `STEPS_PER_GIRDER = 8`, `STEP_W = 90`, `STEP_H = 10` (escalón plano, no pendiente continua) |
| Escaleras             | `LADDER_XS = [180, 540]`, una por unión de filas, `LADDER_HALF_W = 18`                      |
| Peón                  | `PLAYER_W = 22`, `PLAYER_H = 30`, `PLAYER_SPEED = 160` px/s, `LADDER_SPEED = 140` px/s      |
| Salto                 | `JUMP_DURATION = 0.4` s, `JUMP_HEIGHT = 46` px, offset parabólico                           |
| Barriles              | `BARREL_SIZE = 24`; `speed = 130 × min(2, 1 + 0.12×(level-1))` px/s                         |
| Aparición de barriles | `spawnInterval = max(1.2, 3.2 - 0.3×(level-1))` s; determinismo por `barrelIndex % 3`       |
| Caída entre vigas     | `EDGE_FALL_TIME = 0.25` s; descenso por escalera a `220` px/s                               |
| Puntos                | salto `+100`; martillo `+300/+500/+800` (combo, tope 800); meta `+round(timeLeft)×10`       |
| Martillo              | `HAMMER_POS = { row: 2, x: 360 }`, `HAMMER_DURATION = 6` s, uno por torre                   |
| Reloj                 | `TIME_LIMIT(level) = max(30, 60 - (level-1)×5)`; a 0 se pierde una vida                     |
| Vidas                 | `START_LIVES = 3`                                                                           |
| Meta                  | viga `4`, `x ≤ 60`                                                                          |
| `scores.level`        | número de torre/fase superada en el momento del fin de partida                              |

Invariantes internos (heredados del patrón de SPEC 05 / SPEC 07 / SPEC 08 / SPEC 09):

- Loop: `dt = Math.min((ts - last) / 1000, 0.05)`; `if (!paused) update(dt); draw();` y
  re-`requestAnimationFrame`.
- `onKeyDown` / `onKeyUp` son campos arrow-fn (para quitarlos en `stop()`), con guard
  `isFormFieldFocused(e.target)` para no capturar el teclado mientras se escriben las iniciales.
- Fin de partida: `state = "gameover"` + `if (!gameOverNotified) { gameOverNotified = true;
onGameOver?.({ score, level }); }`. `gameOverNotified` se resetea en `initGame()` para que
  `restart()` lo re-arme.
- `resize()`: `targetAspect = 720 / 600`; tras ajustar `canvas.width/height` a `tamaño * dpr` con esa
  proporción, `ctx.setTransform(pxW / 720, 0, 0, pxH / 600, 0, 0)`.
- Las vigas son **escalones planos** (`stepY`), nunca una pendiente continua: la colisión peón↔viga y
  peón↔barril siempre compara rectángulos alineados a ejes sobre el mismo escalón/fila, sin trigonometría.
- Ningún barril lee la posición del peón: su ruta depende solo de `barrelIndex % 3`, `row`, `x`, `dir`
  y `dt` — determinista, sin IA de persecución.
- `setInput` combina con el teclado en `update()`: `up/down/left/right` sostenidos, `jump` como flanco
  (igual patrón que `"fire"` en asteroides / `"drop"` en tetris).

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
  ranaria: FroggerPlayer,
  barriles: KongPlayer,
};
```

### Mapa de archivos tras esta spec

| Archivo                                        | Tipo               | Cambio                                       |
| ---------------------------------------------- | ------------------ | -------------------------------------------- |
| `supabase/migrations/NN-barriles.sql`          | migración SQL      | `+` sentencia `update … set has_leaderboard` |
| `app/lib/supabase/database.types.ts`           | tipos generados    | regenerado                                   |
| `app/components/games/kong/engine.ts`          | motor (agnóstico)  | nuevo                                        |
| `app/components/games/kong/kong-player.tsx`    | client component   | nuevo                                        |
| `app/components/games/kong/touch-controls.tsx` | client component   | nuevo                                        |
| `app/components/games/registry.ts`             | mapa id→componente | `+1` entrada (`barriles`)                    |
| `app/globals.css`                              | estilos            | `+` bloque `.kong-*`                         |
| `CLAUDE.md`                                    | doc                | "Stack notes"                                |

`app/lib/games.ts` (lo toca la vitrina para `FALLBACK_GAME_IDS` / `fallbackGame()`), `app/lib/scores.ts`,
`app/lib/scores-actions.ts`, `app/lib/supabase/public.ts`, `app/lib/home.ts`,
`app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx`, `app/salon/page.tsx`,
`app/components/hall-of-fame.tsx`, `player-screen.tsx`, `asteroids/*`, `tetris/*`, `arkanoid/*`,
`snake/*` y `frogger/*` **no se tocan** en esta spec — ya son agnósticos del juego: todo va por
`game_id` + `has_leaderboard`.

---

## Implementation plan

Cada paso deja el sistema compilando y es commitable por separado.

1. **Mitad de leaderboard de la migración + tipos.** La fila `barriles` ya existe (la crea la
   vitrina, `has_leaderboard = false`). Añadir al final de `supabase/migrations/NN-barriles.sql` la
   sentencia `update public.games set has_leaderboard = true where id = 'barriles';` y aplicarla con
   `mcp__supabase__apply_migration`. Regenerar `app/lib/supabase/database.types.ts`. Verificación:
   `mcp__supabase__list_tables` muestra `barriles` con `has_leaderboard = true`;
   `mcp__supabase__list_migrations` incluye `NN`; `mcp__supabase__get_advisors` (security) no reporta
   nada crítico nuevo (el insert anónimo en `scores` es el hallazgo esperado de SPEC 06); un `insert`
   de prueba vía `mcp__supabase__execute_sql` con `game_id = 'barriles'` y datos válidos se acepta, y
   con `game_id = 'gloton'` se rechaza; `npm run build` compila (la app aún usa `PlayerScreen` para
   `barriles` en este punto).

2. **Esqueleto del motor + dispatch.** Crear `app/components/games/kong/engine.ts` con la clase
   `KongGame` mínima: `constructor` (canvas + `getContext("2d")`, `throw` si no hay ctx),
   `start`/`stop`/`destroy`/`restart`, `setPaused`/`togglePause`, `resize`, `setOnGameOver`,
   `setInput`, y un loop `rAF` que solo pinta el canvas de negro. Crear
   `app/components/games/kong/kong-player.tsx` (marco `.crt` + `<canvas className="kong-canvas">` +
   `useEffect` que monta/destruye el motor + `ResizeObserver` + enlace `VOLVER`, sin overlay todavía).
   Añadir `barriles: KongPlayer` a `registry.ts` y el bloque `.kong-*` mínimo (stage + canvas) a
   `globals.css`. Verificación: `/juego/barriles/jugar` muestra un canvas negro dentro del marco CRT;
   `/juego/gloton/jugar` sigue mostrando `PlayerScreen`; `npm run build` y `npm run lint` pasan.

3. **Vigas + escaleras + peón + teclado + dibujo.** Portar a `engine.ts`: constantes, `stepY` /
   `girderY`, `initGame()` (peón en `PLAYER_START`, `level = 1`, `timeLeft = TIME_LIMIT(1)`), el
   movimiento en `"walking"` por escalones, la transición a `"climbing"` en las dos escaleras y el
   movimiento vertical, el salto (`"jumping"`, flanco de `Espacio`, offset parabólico). `draw()` pinta
   la banda de HUD (`SCORE` / `TORRE n` / vidas / `TIEMPO`), las 5 vigas escalonadas, las 2 escaleras
   y el peón. `start()` engancha `keydown`/`keyup`; `stop()` los quita. `Escape`/`P` pausan con
   overlay "EN PAUSA"; el motor **no** pinta "GAME OVER". Verificación manual con teclado en 720×600
   fijo: caminar por cada viga sin atravesar escalones, trepar y bajar las dos escaleras, saltar con
   `Espacio`, alcanzar la meta (`row 4`, `x ≤ 60`) y ver el bono de tiempo sumado y `level += 1` con
   el tablero reiniciado. Navegar fuera a media partida no deja `requestAnimationFrame` huérfano ni
   errores.

4. **Barriles + martillo + colisión + vidas.** Añadir el spawn determinista en `GOAL`, los modos
   `"rolling"` / `"laddering"` / `"falling"` (con la regla `barrelIndex % 3`), la colisión peón↔barril
   (salto = `+100` y sigue rodando; sin salto y sin martillo = `loseLife()`; con martillo = barril
   destruido + combo `300/500/800`), el pickup y temporizador del martillo, el reloj `timeLeft` y
   `loseLife()` (reinicio de posición, barriles y temporizador; `endGame()` a 0 vidas). Verificación
   manual: un barril con `barrelIndex % 3 === 0` baja por una escalera al cruzarla, el resto cae al
   borde de la viga a la fila inferior invirtiendo dirección; saltar un barril suma `+100` una sola
   vez; recoger el martillo y golpear 3 barriles seguidos suma `300, 500, 800`; agotar el reloj o
   chocar sin martillo resta una vida y reinicia la posición; a 0 vidas se dispara `onGameOver` una
   sola vez con `{ score, level }`.

5. **Escalado responsive + táctiles + guardado real + docs.** `resize(cssW, cssH, dpr)` con
   `targetAspect = 720/600` y `ctx.setTransform`. En `kong-player.tsx`, `.kong-stage` +
   `ResizeObserver` que llama a `resize`. Crear `touch-controls.tsx` con los 5 botones (D-pad + salto)
   cableados a `game.setInput()`; completar el bloque `.kong-*` de `globals.css`. Overlay `.modal` con
   "FIN DEL JUEGO", puntuación final, input de iniciales (filtro `[A-Za-z0-9_]`, máx 12, mayúsculas) y
   los botones; `submitScore({ gameId: "barriles", name, score, level })`; estados guardando (botón
   deshabilitado) / "▸ PUNTUACIÓN GUARDADA\_" / error legible sin romper el canvas; `JUGAR DE NUEVO` →
   `game.restart()` + `setOver(null)`. Actualizar "Stack notes" de `CLAUDE.md`. `npm run lint` y
   `npm run build` limpios; quitar imports / `console` sin usar. Screenshots con Playwright MCP en
   `.playwright-screenshots/` de `/juego/barriles/jugar` (inicio, en curso, overlay de guardado),
   `/juego/barriles` (aside con datos y vacío) y `/salon` (tab `BARRILES` con datos y vacía), en
   escritorio y ~390 px. Verificar que `/juego/rocas`, `/juego/caida`, `/juego/bloque-buster`,
   `/juego/serpentina`, `/juego/ranaria` y `/juego/gloton` no han cambiado de comportamiento.
   Commitear el bloque gestionado de `AGENTS.md` / `CLAUDE.md` si `next dev` lo reescribió.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `npm run lint` sin errores ni warnings.
- [ ] `app/components/games/kong/engine.ts` no importa nada de `react` ni de `next`.
- [ ] `mcp__supabase__list_tables` muestra `public.games` con la fila `barriles` y
      `has_leaderboard = true`; `mcp__supabase__list_migrations` incluye la migración `NN`.
- [ ] `supabase/migrations/NN-barriles.sql` existe en el repo con el `insert` de la vitrina y el
      `update … set has_leaderboard = true` de esta spec, y es el SQL aplicado.
- [ ] Insertar en `scores` una fila con `game_id = 'gloton'` vía API `anon` es rechazado por la
      política; con `game_id = 'barriles'` y datos válidos, se acepta.
- [ ] `/juego/barriles/jugar` renderiza un `<canvas>` dentro del marco CRT (`.crt` / `.crt-screen` /
      `.crt-bottom`), sin HUD React.
- [ ] `/juego/gloton/jugar` (y el resto de ids sin motor real) sigue mostrando `PlayerScreen` con el
      contador simulado; `/juego/rocas/jugar`, `/juego/caida/jugar`, `/juego/bloque-buster/jugar`,
      `/juego/serpentina/jugar` y `/juego/ranaria/jugar` siguen con sus motores.
- [ ] `generateStaticParams` de `/juego/[id]` y `/juego/[id]/jugar` genera también la ruta `barriles`;
      ningún id existente da 404.
- [ ] Teclado: `←` `→` mueven al peón por la viga actual sin atravesar los escalones; `↑` `↓` trepan
      las escaleras solo dentro de su rango horizontal; `Espacio` salta con un arco breve.
- [ ] Un barril con `barrelIndex % 3 === 0` desciende por una escalera al cruzarla; el resto cae al
      borde de su viga a la fila inferior invirtiendo su dirección; ningún barril reacciona a la
      posición del peón.
- [ ] Saltar sobre un barril suma exactamente `+100` una sola vez por barril.
- [ ] Recoger el martillo impide trepar mientras dura, y golpear barriles seguidos con él suma
      `+300`, luego `+500`, luego `+800` (y se queda en `+800`), destruyendo cada barril golpeado.
- [ ] Chocar con un barril sin martillo y sin estar saltando resta una vida y reinicia al peón en
      `PLAYER_START` sin perder el `score` acumulado.
- [ ] Agotar el reloj (`timeLeft` a 0) resta una vida igual que un choque.
- [ ] Alcanzar la viga superior en `x ≤ 60` suma `round(timeLeft) × 10` puntos, sube `level` en 1 y
      reinicia el tablero (barriles, martillo, reloj, posición) conservando `score` y `lives`.
- [ ] A `lives === 0`, el motor entra en `gameover` y dispara `onGameOver` **una sola vez** con
      `{ score, level }` (`level` = torre alcanzada al perder la última vida).
- [ ] El canvas **no** dibuja el texto "GAME OVER"; al terminar aparece un overlay React (`.modal`)
      con la puntuación final y un input de iniciales.
- [ ] El input de iniciales solo acepta `[A-Za-z0-9_]`, máximo 12, y lo muestra en mayúsculas.
- [ ] `GUARDAR PUNTUACIÓN` con un nombre válido inserta una fila en `scores` (`game_id = 'barriles'`,
      `score` y `level` de la partida) y muestra "PUNTUACIÓN GUARDADA"; la fila aparece luego en
      `/juego/barriles` y `/salon` tab `BARRILES`.
- [ ] `submitScore` con nombre inválido, o con Supabase caído, devuelve `{ ok: false, error }` y el
      overlay muestra el mensaje sin romper el canvas.
- [ ] `JUGAR DE NUEVO` en el overlay reinicia la partida vía `game.restart()` sin recargar la página.
- [ ] Con `scores` sin filas de `barriles`: la tab `BARRILES` de `/salon` y el aside de
      `/juego/barriles` muestran el estado vacío `.lb-empty` en vez de podio / filas.
- [ ] El canvas escala manteniendo proporción `720:600`, se ve nítido con `devicePixelRatio > 1`, y la
      página no tiene scroll horizontal a ~390 px.
- [ ] Con las flechas y `Espacio` durante la partida, la página no hace scroll.
- [ ] En viewport táctil (`pointer: coarse`) se ven 5 botones (D-pad + salto) que mueven, trepan y
      saltan; en escritorio no se muestran.
- [ ] `Escape` o `P` alternan pausa con un overlay "EN PAUSA" en el canvas; cambiar de pestaña pausa.
- [ ] Navegar fuera de `/juego/barriles/jugar` a media partida no deja errores en consola ni un
      `requestAnimationFrame` activo.
- [ ] El juego no usa `localStorage` ni IndexedDB, no reproduce audio ni carga assets; la única
      petición de red es `submitScore`.
- [ ] Invariante: `games.has_leaderboard = true` para `barriles` ⇔ `barriles` está en
      `REAL_GAME_PLAYERS`.
- [ ] `app/globals.css` solo añade el bloque `.kong-*`; no añade ningún `.cover-*` (lo hace la
      vitrina) y no redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`,
      `.hall-table*`, `.leaderboard`, `.lb-row` ni `.lb-empty`.
- [ ] Hay screenshots en `.playwright-screenshots/` de `/juego/barriles/jugar`, `/juego/barriles` y
      `/salon` tab `BARRILES` (con datos y vacío), en escritorio y ~390 px.
- [ ] `CLAUDE.md` "Stack notes" menciona que `barriles` (clon de Donkey Kong) tiene motor real y
      `has_leaderboard`.

---

## Decisions

- **Sí:** entrada de catálogo **nueva** (`barriles`), creada por la vitrina. **No:** reutilizar
  `gloton` (Pac-Man), `invasores` (Space Invaders) o `duelo-pixel` (Pong) — ninguna de las tres fichas
  simuladas restantes representa temáticamente un juego de plataformas de escalada; su copy describe
  con precisión otro clásico.
- **Sí:** las dos features (motor real + leaderboard) en el lote, como hicieron SPEC 06–09 y SPEC 11.
  `has_leaderboard = true` solo tiene sentido con un juego en `REAL_GAME_PLAYERS`; el flag lo activa
  esta spec, emparejado con la entrada del registry.
- **Sí:** motor **desde cero**. No hay `references/started-games/` para un clon de Donkey Kong; se
  sigue el contrato de clase de SPEC 05 sin portar código, igual que SPEC 09 (Snake) y Ciempiés.
- **Sí:** espacio interno **720×600 (~4:3)**, rediseñando el layout vertical nativo de Donkey Kong (una
  torre alta y estrecha) a una torre de **5 vigas** que llena el ancho del marco CRT. **No:** un
  espacio vertical estrecho (p. ej. 400×700) — dejaría bandas laterales fuertes en el reproductor,
  distinto del resto de juegos reales de la plataforma (todos 4:3 u horizontal).
  - Riesgo conocido asumido: la física de salto y la colisión sobre vigas inclinadas es la parte más
    delicada del motor (ver Risks).
- **Sí:** vigas como **escalera discreta de segmentos planos** (`STEP_H = 10` por cada
  `STEP_W = 90` px), no como una pendiente continua. Reduce toda la colisión peón↔viga y
  peón↔barril a comparaciones de rectángulos alineados a ejes sobre el escalón/fila actual, evitando
  trigonometría e intersección de segmentos inclinados. **No:** una pendiente lineal continua —
  visualmente algo más fiel al arcade, pero mucho más riesgo de colisión (el criterio explícito de
  encaje de la plataforma pide "espacio interno de coordenadas fijo" y motor simple, no fidelidad
  pixel-perfect al original).
- **Sí:** barriles con ruta **determinista** (`barrelIndex % 3` decide si toman la primera escalera
  que cruzan; el resto cae al borde de la viga). Cumple el requisito explícito "sin IA de
  persecución": ningún barril lee la posición del peón. **No:** una probabilidad aleatoria por barril
  (rompería el determinismo pedido) ni una IA que busque al peón (fuera del criterio de encaje de la
  plataforma, que exige un motor simple y predecible).
- **Sí:** salto con **ventana de invulnerabilidad completa** durante `JUMP_DURATION` (no se pierde
  vida por ningún barril mientras se salta) y `+100` la primera vez que se solapa con un barril en
  ese estado. Es la mecánica más reconocible del arcade original y da feedback claro e inmediato.
  **No:** una hitbox de salto más fina basada en la altura exacta del arco — añade complejidad de
  colisión para poca ganancia jugable.
- **Sí:** martillo con **combo de 3 golpes** (`300 → 500 → 800`, tope en 800), como pide el encargo.
  **No:** trepar mientras se lleva el martillo — mantiene el riesgo/recompensa del arcade original
  (cambiar de viga exige soltar el martillo).
- **Sí:** bono de tiempo al completar la torre (`round(timeLeft) × 10`) y `scores.level` = **torre/fase
  superada**. Da progresión y contexto a la marca, igual que el `level` del resto de juegos reales.
  **No:** un temporizador visual de cuenta atrás en pantalla completa tipo arcade original — el HUD ya
  lo muestra en la banda superior, es suficiente para esta spec.
- **Sí:** render **procedural en la paleta neon**, cero assets binarios. Coherente con `rocas`,
  `caida`, `bloque-buster` y Ciempiés. **No:** sprites de un gorila / barril / martillo pixel-art.
- **Sí:** controles táctiles con **D-pad de 4 botones + salto**, gated por `(pointer: coarse)`, en
  línea con el resto de juegos reales (mismo patrón que Ciempiés con `fire`). Sin ellos el juego es
  injugable en móvil.
- **No:** tocar `PlayerScreen`, `CATS`, la infraestructura de `scores` / catálogo ni el copy de otras
  fichas. Los juegos simulados restantes siguen igual hasta su propia spec.

---

## Risks

| Riesgo                                                                                        | Mitigación                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Física de salto + colisión en vigas inclinadas (riesgo conocido del encargo)                  | Vigas como escalera discreta de segmentos planos (sin pendiente continua); colisión siempre AABB por escalón/fila; verificación manual dedicada en el paso 3 y 4 del plan. |
| `requestAnimationFrame` no cancelado al navegar → loop huérfano                               | `destroy()` en el cleanup del `useEffect`; criterio de aceptación dedicado (heredado de SPEC 05).                                                                          |
| React StrictMode monta el efecto dos veces en dev → doble motor                               | `gameRef.current?.destroy()` al principio del efecto; `destroy()` idempotente.                                                                                             |
| `has_leaderboard` y `REAL_GAME_PLAYERS` se desincronizan                                      | El flag lo activa esta spec junto con la entrada del registry; invariante en criterios.                                                                                    |
| La vitrina no está aplicada y la fila `barriles` no existe al correr el `update`              | `Depende de` marca la vitrina como precondición; el paso 1 verifica la fila antes del `update`.                                                                            |
| `get_advisors` marca el `insert` anónimo de `scores`                                          | Intencional y heredado de SPEC 06; revisar que no haya **otros** hallazgos.                                                                                                |
| El peón queda "atascado" entre `"walking"` y `"climbing"` cerca del límite de la escalera     | `LADDER_HALF_W` con margen (18 px sobre escalones de 90 px); la transición solo cambia `playerMode`, nunca dos veces en el mismo frame.                                    |
| `dt` grande al volver de una pestaña en segundo plano → el peón o un barril saltan de escalón | `dt` capado a 50 ms; auto-pausa en `visibilitychange`.                                                                                                                     |
| `preventDefault` de las flechas / `Space` afecta a otras rutas                                | Solo se engancha mientras el juego está montado y se quita en el cleanup; guard `isFormFieldFocused`.                                                                      |
| El HUD y las vigas en la paleta neon quedan ilegibles a ~390 px                               | Texto con `var(--pixel)` a tamaño legible; la revisión visual con Playwright a 390 px lo verifica.                                                                         |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`                        | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                                                                                                  |

---

## Lo que **no** entra en esta spec

- Sonido y música.
- Vigas con pendiente continua; barriles en llamas, cubos voladores, muelles, niveles adicionales del
  arcade original.
- Sprites / assets binarios; control con ratón.
- Multi-vida de barril, power-ups distintos del martillo, animación de la meta más allá de un marcador
  estático.
- Modo a 2 jugadores o versus; persistencia local.
- Auth real, columna `user_id` en `scores`, tabla `profiles`.
- Recalcular `games.best` / `games.plays` desde datos reales.
- Portar los otros juegos simulados a motor real.
- Marcas reales en la home; Realtime o paginación en el leaderboard.
- Todo lo de la vitrina: portada `.cover-barriles`, copy del catálogo, ficha y `/salon`.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
