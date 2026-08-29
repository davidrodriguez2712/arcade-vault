# SPEC 09 — Cuarto juego real: Snake en la entrada `serpentina` con leaderboard

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 05, SPEC 06
> **Fecha:** 2026-08-28
> **Objetivo:** Construir desde cero un Snake en un motor TypeScript agnóstico de framework montado en el marco CRT del reproductor, conectado a la entrada de catálogo `serpentina`, con las frutas dibujadas desde el spritesheet `fruits.png`, controles táctiles y guardado real de puntuaciones bajo RLS.

---

## Por qué existe esta spec

SPEC 05 portó `rocas` (Asteroides) a un motor real y fijó el patrón: `engine.ts` sin React/Next +
envoltorio `"use client"` fino, registrado en `app/components/games/registry.ts`. SPEC 06 movió el
catálogo y las puntuaciones a Supabase y añadió el overlay React de guardado, la tabla `scores` con
inserción anónima bajo RLS condicionada a `games.has_leaderboard`, y el estado vacío del leaderboard.
SPEC 07 y SPEC 08 repitieron el patrón para `caida` (Tetris) y `bloque-buster` (Arkanoid). Hoy
`rocas`, `caida` y `bloque-buster` son los únicos juegos con motor real y `has_leaderboard = true`.

La entrada `serpentina` ("SERPENTINA", categoría `ARCADE`, portada `cover-snake`, color verde,
`sort_order = 2`) ya es el hueco temático de Snake en el catálogo: hoy la sirve el `PlayerScreen`
simulado. Esta spec mete el **cuarto juego jugable de verdad** reutilizando esa entrada, aplicando
SPEC 05 + SPEC 06 tal cual, sin tocar la infraestructura compartida.

**No hay juego de referencia.** No existe `references/started-games/` para Snake; el motor se escribe
desde cero siguiendo el contrato de clase de SPEC 05. Lo único que se aporta como material es el
spritesheet de frutas en `references/source-assets/snake-assets/` (`fruits.png` 3790×442 +
`sprites.js` con las coordenadas de recorte de la fila pixel-art).

Decisiones de forma tomadas con el usuario antes de escribir esta spec:

- **Reutilizar la entrada `serpentina`.** La migración solo hace
  `update public.games set has_leaderboard = true where id = 'serpentina'`. No se crea un `id` nuevo
  ni se toca `FALLBACK_GAME_IDS` / `fallbackGame()`. `title`, `short`, `long`, `cat`, `cover`,
  `color`, `best`, `plays`, `sort_order` **no se editan** (el `short` / `long` actuales hablan de
  "núcleos magenta"; se dejan como están, igual que SPEC 08 dejó el copy de `bloque-buster`).
- **Con leaderboard.** `has_leaderboard = true`, overlay React de guardado al terminar, marcas reales
  en `/juego/serpentina` y `/salon`.
- **Las frutas se dibujan desde `fruits.png`.** Es el **primer juego con un asset binario en
  `public/`**: el archivo se copia a `public/games/serpentina/fruits.png` y el motor lo carga con
  `new Image()` + `drawImage()` usando los recortes de la fila pixel-art (`y = 136`, `h = 160`). Las
  coordenadas se **copian** a una constante del motor; `sprites.js` no se importa (usa `window` y no
  es un módulo). El juego es jugable aunque la imagen aún no haya cargado (fruta de respaldo
  procedural). Todo lo demás (serpiente, rejilla, HUD) es procedural en la paleta neon.
- **Espacio interno 800×600 (4:3), grilla de celda 25 px.** Banda de HUD de 50 px arriba; área de
  juego de 32×22 celdas desde `y = 50`. `object-fit: contain` centra el canvas en el marco CRT (4:3)
  sin bandas. Igual proporción que `rocas` y `bloque-buster`.
- **Muerte al tocar el borde.** Snake clásico: chocar con cualquier pared termina la partida, igual
  que morderse la cola. Sin bordes que envuelven.
- **Acelera al comer.** Tick base ~7 celdas/s; cada 4 frutas sube un tramo de velocidad hasta un tope
  de ~18 celdas/s (6 tramos). `scores.level` reporta el **tramo alcanzado** (1–6).
- **Puntuación simple.** Cada fruta vale `+10` y alarga la serpiente 1 segmento. La fruta que aparece
  rota por los 22 sprites del atlas **solo por estética**; no hay frutas raras ni de valor distinto.
- **Controles táctiles: D-pad de 4 botones.** `TouchAction = "up" | "down" | "left" | "right"`. Cada
  toque fija la dirección (no sostenido). Gated por `@media (pointer: coarse)`.
- **Fuera:** sonido, otros modos (obstáculos, muros interiores, 2 jugadores), persistencia local,
  frutas de valor variable, portar el resto de juegos simulados, auth real en `scores`, recalcular
  `games.best` / `games.plays`.

Esta spec **no revisa** ninguna decisión de SPEC 05, SPEC 06, SPEC 07 ni SPEC 08.

---

## Scope

**In:**

- `references/source-assets/snake-assets/fruits.png` → `public/games/serpentina/fruits.png` (nuevo) —
  se copia el PNG tal cual (3790×442, RGBA, fondo transparente). Es el único asset binario del
  proyecto en `public/`. `sprites.js` **no** se copia ni se importa.
- `supabase/migrations/09-juego-snake-serpentina.sql` (nuevo) — aplicado al proyecto remoto
  `itmhyidlxraapcjzprvn` con `mcp__supabase__apply_migration`. Contiene una sola sentencia:
  - `update public.games set has_leaderboard = true where id = 'serpentina';`
  - La tabla `scores` **ya existe** desde SPEC 06: no se recrea, no se toca su RLS. El resto de
    columnas de `serpentina` **no se tocan**.
- `app/lib/supabase/database.types.ts` — regenerado con `mcp__supabase__generate_typescript_types`
  tras la migración (el esquema no cambia de columnas; se regenera por higiene).
- `app/components/games/snake/engine.ts` (nuevo) — motor escrito desde cero, **sin ninguna
  importación de React ni de Next**. Exporta la clase `SnakeGame` y los tipos `TouchAction` /
  `GameOverResult`. Dibuja siempre en el espacio interno fijo 800×600; el escalado responsive vive
  solo en `resize()`. `dt` capado a 50 ms. **No** pinta el texto de "GAME OVER" (lo pone el overlay
  React); sí pinta la banda de HUD, la rejilla, la serpiente, la fruta y el overlay "EN PAUSA".
  - Constantes: `CELL = 25`, `COLS = 32`, `ROWS = 22`, `HUD_H = 50` (área de juego `800 × 550` desde
    `y = 50`), `START_LEN = 4`, `GROW_PER_FRUIT = 1`, `POINTS_PER_FRUIT = 10`, `FRUITS_PER_TIER = 4`,
    `TIER_CELLS_PER_S = [7, 9, 11, 13, 15, 18]` (6 tramos; `interval = 1 / cps`).
  - `SPRITE_SRC = "/games/serpentina/fruits.png"` y `FRUIT_CROPS` — array de 22 recortes
    `{ x, y, w, h }` **copiados** de `sprites.js` (fila `y = 136`, `h = 160`: banana, orange, grape,
    garlic, eggplant, strawberry, cherry, carrot, mushroom, broccoli, watermelon, pepper, kiwi,
    lemon, peach, peanut, apple, tomato, berries, grapes2, pineapple, melon).
  - Carga del sprite: en el constructor, `this.sprites = new Image(); this.sprites.src = SPRITE_SRC;`
    con `onload` → `this.spritesReady = true`. `draw()` usa `drawImage` con el recorte
    `FRUIT_CROPS[this.fruitSprite]` si `spritesReady`; si no, dibuja un rombo neón de respaldo. Cero
    peticiones de red aparte de esta imagen estática y de `submitScore`.
  - Estado de partida (ver Data model): `snake` (array de celdas, cabeza primero), `dir` / `nextDir`
    (vector unitario en celdas), `fruit` (celda), `fruitSprite` (índice 0–21), `score`, `fruitsEaten`,
    `tier` (1–6), `state`, `paused`, `gameOverNotified`, `tickAccum`.
  - `initGame()`: serpiente de `START_LEN` segmentos centrada en la fila media, `dir` y `nextDir` a la
    derecha, `score = 0`, `fruitsEaten = 0`, `tier = 1`, `fruitSprite = 0`, `gameOverNotified = false`,
    fruta en una celda libre aleatoria.
  - `step()` (un paso de la serpiente, llamado por el acumulador): aplica `nextDir` a `dir` (ignora un
    giro de 180°), calcula la celda de la cabeza nueva. Si sale de `0..COLS-1 × 0..ROWS-1` **o** cae
    sobre una celda del cuerpo → fin de partida. Si cae sobre `fruit` → `score += 10`, `fruitsEaten++`,
    no se quita la cola (crece 1), `fruitSprite = (fruitSprite + 1) % 22`, nueva fruta en celda libre,
    y si `fruitsEaten % FRUITS_PER_TIER === 0` → `tier = min(tier + 1, 6)`. Si no come → se quita la
    cola (longitud constante).
  - Loop: `dt = Math.min((ts - last) / 1000, 0.05)`; `if (!paused) { tickAccum += dt; if (tickAccum >=
interval) { tickAccum -= interval; step(); } } draw();` y re-`requestAnimationFrame`. `interval =
1 / TIER_CELLS_PER_S[tier - 1]`.
  - `draw()`: banda de HUD (`SCORE` a la izquierda, `LONGITUD` centrado, `VEL. x{tier}` a la derecha,
    con `var(--pixel)`), rejilla sutil del área de juego, serpiente como celdas redondeadas en
    `var(--green)` con la cabeza más brillante, fruta (sprite o rombo de respaldo) centrada en su
    celda a ~1.3× `CELL`, y el overlay "EN PAUSA" cuando `paused`. **Nunca** pinta "GAME OVER".
  - Fin de partida: `state = "gameover"` + `if (!gameOverNotified) { gameOverNotified = true;
onGameOver?.({ score, level: tier }); }`. `gameOverNotified` se resetea en `initGame()`.
  - Contrato de la clase: `constructor(canvas)`, `start()`, `stop()`, `destroy()`, `restart()`,
    `setPaused()` / `togglePause()`, `resize(cssW, cssH, dpr)`, `setOnGameOver(cb)`,
    `setInput(action, pressed)`.
  - Input: `←` `↑` `→` `↓` (o los botones táctiles) fijan `nextDir` — se ignora si es opuesto a `dir`.
    `setInput` solo actúa cuando `pressed === true` (dirección instantánea, no sostenida). `onKeyDown`
    / `onKeyUp` son campos arrow-fn con guard `isFormFieldFocused(e.target)`. `Escape` / `KeyP`
    alternan pausa; el motor **no** pinta "GAME OVER"; el overlay de pausa no lleva selector de nada.
- `app/components/games/snake/snake-player.tsx` (nuevo, `"use client"`) — envoltorio fino, copia de
  `app/components/games/asteroids/asteroids-player.tsx` con `GAME_ID = "serpentina"` y la clase
  `SnakeGame`:
  - Marco CRT (`.crt` / `.crt-screen` / `.crt-bottom`), `<canvas className="snake-canvas" width={800}
height={600}>` dentro de `.snake-stage`.
  - `useEffect` de montaje: guard StrictMode (`gameRef.current?.destroy()`), `new SnakeGame(canvas)`,
    `game.setOnGameOver(setOver…)`, `applySize()` con `stage.getBoundingClientRect()` →
    `game.resize(w, h, devicePixelRatio || 1)`, `ResizeObserver` sobre el stage, `game.start()`,
    `visibilitychange` → `game.setPaused(document.hidden)`, `keydown` en `window` con `preventDefault`
    de `ArrowUp/ArrowDown/ArrowLeft/ArrowRight/Space` (salvo si se escribe en un input) y
    `Escape`/`KeyP` → `togglePause()`, `Space` → cerrar el overlay. Cleanup: `ro.disconnect()`, quitar
    listeners, `game.destroy()`, `gameRef.current = null`.
  - Overlay `.modal-bd` / `.modal` (reutiliza las clases de `globals.css`) con `<h2>FIN DEL
JUEGO</h2>`, `.final-label`, `.final` con `over.score.toLocaleString("es-ES")`, input de iniciales
    (`e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 12)`), botón `GUARDAR
PUNTUACIÓN` (`disabled` si `phase === "saving" || name.length === 0`) →
    `submitScore({ gameId: "serpentina", name, score: over.score, level: over.level })`, `.actions`
    con `JUGAR DE NUEVO` → `game.restart()` + `setOver(null)` y `VOLVER` → `/juego/serpentina`.
    Estados `idle | saving | saved | error`: `saved` → `<div className="toast-saved">▸ PUNTUACIÓN
GUARDADA_</div>`, `error` → muestra `res.error` sin romper el canvas.
  - `crt-bottom`: etiqueta `SERPENTINA · CRT-83 · 60 HZ` y `SNAKE`.
  - Monta `<SnakeTouchControls onInput={handleInput} />` dentro de `.crt-screen`.
- `app/components/games/snake/touch-controls.tsx` (nuevo, `"use client"`) — copia de
  `asteroids/touch-controls.tsx` con 4 botones en cruz. `TouchAction = "up" | "down" | "left" |
"right"`. `onPointerDown` → `onInput(action, true)`; `onPointerUp` / `onPointerCancel` /
  `onPointerLeave` → `onInput(action, false)`; `e.preventDefault()` en cada handler. Visibles solo
  bajo `@media (pointer: coarse)`.
- `app/components/games/registry.ts` — añadir `serpentina: SnakePlayer` a `REAL_GAME_PLAYERS`.
- `app/globals.css` — anexar al final el bloque `/* ===== juego: snake (serpentina) ===== */`:
  - `.snake-stage` (`position: absolute; inset: 0; background: #000;`).
  - `.snake-canvas` (`display: block; width: 100%; height: 100%; object-fit: contain;
touch-action: none;`).
  - `.snake-touch` (`position: absolute; inset: 0; display: none; pointer-events: none; z-index: 4;`)
    - `@media (pointer: coarse) { .snake-touch { display: block; } }` + `.snake-touch-btn` con las 4
      variantes de posición en cruz (`.up`, `.down`, `.left`, `.right`) en la esquina inferior derecha.
  - **No** añade ningún `.cover-*` — `.cover-snake` ya existe (línea ~734) y es el que usa
    `serpentina`.
  - **No** redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`,
    `.hall-table*`, `.leaderboard`, `.lb-row`, `.lb-empty`.
- `CLAUDE.md` — "Stack notes": actualizar la línea de leaderboards ("hoy: `rocas`, `caida` y
  `bloque-buster`" → "+ `serpentina`") y la de "Real games" (añadir `snake` → `serpentina`, con la
  nota de que carga `public/games/serpentina/fruits.png`).
- Revisión visual con Playwright MCP: screenshots en `.playwright-screenshots/` de
  `/juego/serpentina/jugar` (inicio, partida en curso, overlay de guardado), `/juego/serpentina`
  (aside con datos y vacío) y `/salon` (tab `SERPENTINA` con datos y vacía), en escritorio y ~390 px.
  Verificar que `/juego/rocas`, `/juego/caida` y `/juego/bloque-buster` siguen igual y que otro juego
  simulado (p. ej. `/juego/gloton`) sigue con `seededScores`.

**Out of scope (para futuras specs):**

- Sonido y música.
- Frutas de valor variable, frutas raras temporizadas, power-ups, veneno.
- Muros interiores, obstáculos, mapas por nivel, modo laberinto.
- Bordes que envuelven (esta spec fija "muerte al tocar el borde").
- Modo a 2 jugadores o versus.
- Persistencia local (`localStorage` / IndexedDB).
- `sprites.js` como módulo importable o un cargador de atlas genérico reutilizable.
- Usar las otras dos filas de `fruits.png` (estilos no pixel-art).
- Auth real / columna `user_id` en `scores` (el leaderboard sigue siendo anónimo por iniciales).
- Recalcular `games.best` / `games.plays` desde datos reales (siguen siendo columnas mock estáticas).
- Reescribir el `short` / `long` de `serpentina` para que hable de frutas en vez de "núcleos magenta".
- Portar los otros 4 juegos simulados a motor real.
- Marcas reales en la home; Realtime / paginación del leaderboard.
- Ajustar los tags hardcodeados de `/juego/serpentina` ("1 JUGADOR", estrellas de dificultad).
- Tests automatizados (no hay runner).

---

## Data model

La tabla `scores` no cambia (definida en SPEC 06). El único estado nuevo es el del motor, en memoria
y por partida.

```ts
// engine.ts
type GameState = "playing" | "gameover";
export type TouchAction = "up" | "down" | "left" | "right";
export interface GameOverResult {
  score: number;
  level: number; // tramo de velocidad alcanzado, 1..6
}

interface Cell {
  col: number;
  row: number;
}

interface FruitCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

class SnakeGame {
  private snake: Cell[] = []; // cabeza en el índice 0
  private dir: Cell = { col: 1, row: 0 }; // vector en celdas
  private nextDir: Cell = { col: 1, row: 0 };
  private fruit: Cell = { col: 0, row: 0 };
  private fruitSprite = 0; // índice 0..21 en FRUIT_CROPS
  private score = 0;
  private fruitsEaten = 0;
  private tier = 1; // 1..6
  private state: GameState = "playing";
  private paused = false;
  private gameOverNotified = false;
  private tickAccum = 0; // segundos acumulados hacia el siguiente paso

  private sprites = new Image();
  private spritesReady = false;

  private keys: Record<string, boolean> = {};

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

| Concepto              | Valor                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| Celda                 | `CELL = 25` px                                                             |
| Grilla de juego       | `COLS = 32`, `ROWS = 22`; origen `(0, HUD_H)` con `HUD_H = 50`             |
| Serpiente inicial     | `START_LEN = 4`, centrada, moviéndose a la derecha                         |
| Crecimiento por fruta | `GROW_PER_FRUIT = 1` segmento                                              |
| Puntos por fruta      | `POINTS_PER_FRUIT = 10` (sin bono)                                         |
| Tramos de velocidad   | `TIER_CELLS_PER_S = [7, 9, 11, 13, 15, 18]`; `interval = 1 / cps`          |
| Subida de tramo       | cada `FRUITS_PER_TIER = 4` frutas, hasta el tramo 6                        |
| `scores.level`        | `tier` en el momento del fin de partida (1..6)                             |
| Sprite de fruta       | `SPRITE_SRC = "/games/serpentina/fruits.png"`, `FRUIT_CROPS` = 22 recortes |
| Fruta de respaldo     | rombo neón centrado en la celda mientras `spritesReady === false`          |

`FRUIT_CROPS` — copiados de `references/source-assets/snake-assets/sprites.js` (fila pixel-art,
`y = 136`, `h = 160`), en este orden: `banana` `{34,136,110,160}`, `orange` `{186,136,150,160}`,
`grape` `{378,136,110,160}`, `garlic` `{540,136,130,160}`, `eggplant` `{712,136,130,160}`,
`strawberry` `{894,136,110,160}`, `cherry` `{1066,136,110,160}`, `carrot` `{1228,136,130,160}`,
`mushroom` `{1400,136,130,160}`, `broccoli` `{1582,136,110,160}`, `watermelon` `{1734,136,150,160}`,
`pepper` `{1906,136,150,160}`, `kiwi` `{2068,136,170,160}`, `lemon` `{2250,136,140,160}`,
`peach` `{2432,136,130,160}`, `peanut` `{2604,136,130,160}`, `apple` `{2786,136,110,160}`,
`tomato` `{2948,136,130,160}`, `berries` `{3110,136,150,160}`, `grapes2` `{3302,136,110,160}`,
`pineapple` `{3454,136,150,160}`, `melon` `{3637,136,130,160}`.

Invariantes internos (heredados del patrón de SPEC 05 / SPEC 07 / SPEC 08):

- Loop: `dt = Math.min((ts - last) / 1000, 0.05)`; con acumulador, `un` `step()` como máximo por
  frame; `draw()` siempre; re-`requestAnimationFrame`.
- `onKeyDown` / `onKeyUp` son campos arrow-fn (para quitarlos en `stop()`), con guard
  `isFormFieldFocused(e.target)` para no capturar el teclado mientras se escriben las iniciales.
- Fin de partida: `state = "gameover"` + `if (!gameOverNotified) { gameOverNotified = true;
onGameOver?.({ score, level: tier }); }`. `gameOverNotified` se resetea en `initGame()` para que
  `restart()` lo re-arme.
- `resize()`: `targetAspect = 800 / 600`; tras ajustar `canvas.width/height` a `tamaño * dpr` con esa
  proporción, `ctx.setTransform(pxW / 800, 0, 0, pxH / 600, 0, 0)`.
- `nextDir` se valida contra `dir` en `step()`: un giro de 180° se ignora (no se puede reversar sobre
  el cuerpo). El buffer evita el "doble giro" en un solo frame.
- La fruta se coloca siempre en una celda que no ocupa la serpiente; si el tablero estuviera lleno
  (704 celdas) la partida ya habría terminado antes.

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
};
```

### Mapa de archivos tras esta spec

| Archivo                                             | Tipo               | Cambio                         |
| --------------------------------------------------- | ------------------ | ------------------------------ |
| `public/games/serpentina/fruits.png`                | asset binario      | nuevo (copia del source-asset) |
| `supabase/migrations/09-juego-snake-serpentina.sql` | migración SQL      | nuevo (aplicado vía MCP)       |
| `app/lib/supabase/database.types.ts`                | tipos generados    | regenerado                     |
| `app/components/games/snake/engine.ts`              | motor (agnóstico)  | nuevo                          |
| `app/components/games/snake/snake-player.tsx`       | client component   | nuevo                          |
| `app/components/games/snake/touch-controls.tsx`     | client component   | nuevo                          |
| `app/components/games/registry.ts`                  | mapa id→componente | `+1` entrada (`serpentina`)    |
| `app/globals.css`                                   | estilos            | `+` bloque `.snake-*`          |
| `CLAUDE.md`                                         | doc                | "Stack notes"                  |

`app/lib/games.ts`, `app/lib/scores.ts`, `app/lib/scores-actions.ts`, `app/lib/supabase/public.ts`,
`app/lib/home.ts`, `app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx`, `app/salon/page.tsx`,
`app/components/hall-of-fame.tsx`, `player-screen.tsx`, `asteroids/*`, `tetris/*` y `arkanoid/*`
**no se tocan** — ya son agnósticos del juego: todo va por `game_id` + `has_leaderboard`.
`serpentina` ya está en `FALLBACK_GAME_IDS`, así que `games.ts` no cambia (`fallbackGame()` sigue con
`hasLeaderboard: id === "rocas"`, igual que tras SPEC 07 / SPEC 08: el respaldo de build sin Supabase
no marca leaderboard para los juegos añadidos después de `rocas`, y se acepta).

---

## Implementation plan

Cada paso deja el sistema compilando y es commitable por separado.

1. **Asset + migración + tipos.** Copiar `references/source-assets/snake-assets/fruits.png` a
   `public/games/serpentina/fruits.png`. Escribir
   `supabase/migrations/09-juego-snake-serpentina.sql` con
   `update public.games set has_leaderboard = true where id = 'serpentina';`. Aplicar con
   `mcp__supabase__apply_migration`. Regenerar `app/lib/supabase/database.types.ts`. Verificación:
   `mcp__supabase__list_tables` muestra `serpentina` con `has_leaderboard = true`;
   `mcp__supabase__list_migrations` incluye `09`; `mcp__supabase__get_advisors` (security) no reporta
   nada crítico nuevo (el insert anónimo en `scores` es el hallazgo esperado de SPEC 06); un `insert`
   de prueba vía `mcp__supabase__execute_sql` con `game_id = 'serpentina'` y datos válidos se acepta,
   y con `game_id = 'gloton'` se rechaza; `npm run build` compila (la app aún usa `PlayerScreen` para
   `serpentina` en este punto).

2. **Esqueleto del motor + dispatch.** Crear `app/components/games/snake/engine.ts` con la clase
   `SnakeGame` mínima: `constructor` (canvas + `getContext("2d")`, `throw` si no hay ctx, arranca la
   carga de `SPRITE_SRC`), `start`/`stop`/`destroy`/`restart`, `setPaused`/`togglePause`, `resize`,
   `setOnGameOver`, `setInput`, y un loop `rAF` que solo pinta el canvas de negro. Crear
   `app/components/games/snake/snake-player.tsx` (marco `.crt` + `<canvas className="snake-canvas">` +
   `useEffect` que monta/destruye el motor + `ResizeObserver` + enlace `VOLVER`, sin overlay todavía).
   Añadir `serpentina: SnakePlayer` a `registry.ts`. Verificación: `/juego/serpentina/jugar` muestra
   un canvas negro dentro del marco CRT; `/juego/gloton/jugar` sigue mostrando `PlayerScreen`;
   `npm run build` y `npm run lint` pasan.

3. **Grilla + lógica de partida + teclado + dibujo.** Portar a `engine.ts`: constantes, `FRUIT_CROPS`,
   `initGame()`, `step()` (giro con `nextDir`, colisión con paredes y cuerpo, comer fruta, crecer,
   subir de tramo, recolocar fruta), el acumulador de tick contra `interval = 1 /
TIER_CELLS_PER_S[tier - 1]`, y `draw()` (banda de HUD con `SCORE` / `LONGITUD` / `VEL. x{tier}`,
   rejilla sutil, serpiente en `var(--green)` con cabeza brillante, fruta con `drawImage` del recorte
   `FRUIT_CROPS[fruitSprite]` o rombo de respaldo). `start()` engancha `keydown`/`keyup`; `stop()` los
   quita. `←` `↑` `→` `↓` fijan `nextDir` (ignorando el opuesto). `setOnGameOver` se dispara al chocar
   con pared o cuerpo. El motor **no** pinta "GAME OVER"; `Escape`/`P` pausan con overlay "EN PAUSA".
   Verificación manual con teclado en 800×600 fijo: mover la serpiente en las 4 direcciones, comer
   frutas (`+10`, crece 1, el sprite cambia), acelerar cada 4 frutas, morir al tocar la pared y al
   morderse, disparo único del callback con `{ score, level: tier }`. Navegar fuera a media partida no
   deja `requestAnimationFrame` huérfano ni errores.

4. **Escalado responsive + táctiles.** `resize(cssW, cssH, dpr)` con `targetAspect = 800/600` y
   `ctx.setTransform`. En `snake-player.tsx`, `.snake-stage` + `ResizeObserver` que llama a `resize`.
   Crear `touch-controls.tsx` con los 4 botones en cruz (`▲ ▼ ◄ ►`) cableados a `game.setInput()`;
   `setInput` fija `nextDir` cuando `pressed === true`. Añadir el bloque `.snake-*` a `globals.css`.
   Verificación: el juego llena el marco CRT en escritorio y a ~390 px sin deformarse, nítido con
   `devicePixelRatio > 1`, sin scroll horizontal; en viewport táctil (`pointer: coarse`) los 4
   botones cambian la dirección y en escritorio no se ven; las flechas no hacen scroll de la página.

5. **Guardado real.** En `snake-player.tsx`: overlay `.modal` con "FIN DEL JUEGO", puntuación final,
   input de iniciales (filtro `[A-Za-z0-9_]`, máx 12, mayúsculas) y los botones; `submitScore({
gameId: "serpentina", name, score, level })`; estados guardando (botón deshabilitado) / "▸
   PUNTUACIÓN GUARDADA_" / error legible sin romper el canvas; `JUGAR DE NUEVO` → `game.restart()` +
   `setOver(null)`. Verificación manual en `/juego/serpentina/jugar`: morir, escribir `TEST_1`,
   `GUARDAR`, ver la fila en el aside de `/juego/serpentina` y en la tab `SERPENTINA` de `/salon`
   (revalidación inmediata por `revalidatePath`); un nombre vacío / inválido y un fallo de red
   muestran mensaje legible; `game_id` sin `has_leaderboard` lo rechaza la RLS.

6. **Docs, CSS final y revisión visual.** Actualizar "Stack notes" de `CLAUDE.md` (roster de
   leaderboards y "Real games", con la nota del asset en `public/`). `npm run lint` y `npm run build`
   limpios; quitar imports / `console` sin usar. Screenshots con Playwright MCP en
   `.playwright-screenshots/` de `/juego/serpentina/jugar` (inicio, en curso, overlay de guardado),
   `/juego/serpentina` (aside con datos y vacío) y `/salon` (tab `SERPENTINA` con datos y vacía), en
   escritorio y ~390 px. Verificar que `/juego/rocas`, `/juego/caida`, `/juego/bloque-buster` y
   `/juego/gloton` no han cambiado de comportamiento. Commitear el bloque gestionado de `AGENTS.md` /
   `CLAUDE.md` si `next dev` lo reescribió.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `npm run lint` sin errores ni warnings.
- [ ] `app/components/games/snake/engine.ts` no importa nada de `react` ni de `next`.
- [ ] `public/games/serpentina/fruits.png` existe y es copia byte a byte de
      `references/source-assets/snake-assets/fruits.png`.
- [ ] `mcp__supabase__list_tables` muestra `public.games` con la fila `serpentina` y
      `has_leaderboard = true`; `mcp__supabase__list_migrations` incluye la migración `09`.
- [ ] `supabase/migrations/09-juego-snake-serpentina.sql` existe en el repo con el mismo SQL aplicado.
- [ ] Insertar en `scores` una fila con `game_id = 'gloton'` vía API `anon` es rechazado por la
      política; con `game_id = 'serpentina'` y datos válidos, se acepta.
- [ ] `/juego/serpentina/jugar` renderiza un `<canvas>` dentro del marco CRT (`.crt` / `.crt-screen` /
      `.crt-bottom`), sin HUD React.
- [ ] `/juego/gloton/jugar` (y el resto de ids sin motor real) sigue mostrando `PlayerScreen` con el
      contador simulado; `/juego/rocas/jugar`, `/juego/caida/jugar` y `/juego/bloque-buster/jugar`
      siguen con sus motores.
- [ ] `generateStaticParams` de `/juego/[id]` y `/juego/[id]/jugar` sigue generando las 8 rutas del
      catálogo; ningún id existente da 404.
- [ ] Teclado: `←` `↑` `→` `↓` cambian la dirección de la serpiente; un giro de 180° se ignora.
- [ ] La serpiente avanza a paso fijo; comer una fruta suma exactamente `+10`, alarga 1 segmento y
      hace aparecer otra fruta con el **siguiente** sprite del atlas.
- [ ] Cada 4 frutas la velocidad sube un tramo (`7 → 9 → 11 → 13 → 15 → 18` celdas/s) y se detiene en
      el tramo 6.
- [ ] Chocar con cualquier borde del área de juego **o** con el propio cuerpo entra en `gameover` y
      dispara `onGameOver` **una sola vez** con `{ score, level }` (`level` = tramo alcanzado, 1–6).
- [ ] El canvas **no** dibuja el texto "GAME OVER"; al terminar aparece un overlay React (`.modal`)
      con la puntuación final y un input de iniciales.
- [ ] La fruta se dibuja desde `fruits.png` (recorte de la fila pixel-art) cuando la imagen ha
      cargado; si aún no ha cargado, se dibuja un rombo neón y el juego sigue siendo jugable.
- [ ] El input de iniciales solo acepta `[A-Za-z0-9_]`, máximo 12, y lo muestra en mayúsculas.
- [ ] `GUARDAR PUNTUACIÓN` con un nombre válido inserta una fila en `scores` (`game_id =
  'serpentina'`, `score` y `level` de la partida) y muestra "PUNTUACIÓN GUARDADA"; la fila
      aparece luego en `/juego/serpentina` y `/salon` tab `SERPENTINA`.
- [ ] `submitScore` con nombre inválido, o con Supabase caído, devuelve `{ ok: false, error }` y el
      overlay muestra el mensaje sin romper el juego.
- [ ] `JUGAR DE NUEVO` en el overlay reinicia la partida vía `game.restart()` sin recargar la página.
- [ ] Con `scores` sin filas de `serpentina`: la tab `SERPENTINA` de `/salon` y el aside de
      `/juego/serpentina` muestran el estado vacío `.lb-empty` en vez de podio / filas.
- [ ] El canvas escala manteniendo proporción 4:3, se ve nítido con `devicePixelRatio > 1`, y la
      página no tiene scroll horizontal a ~390 px.
- [ ] Con las flechas durante la partida, la página no hace scroll.
- [ ] En viewport táctil (`pointer: coarse`) se ven 4 botones en cruz que cambian la dirección; en
      escritorio no se muestran.
- [ ] `Escape` o `P` alternan pausa con un overlay "EN PAUSA" en el canvas; cambiar de pestaña pausa.
- [ ] Navegar fuera de `/juego/serpentina/jugar` a media partida no deja errores en consola ni un
      `requestAnimationFrame` activo.
- [ ] El juego no usa `localStorage` ni IndexedDB, no reproduce audio; las únicas peticiones de red
      son `public/games/serpentina/fruits.png` y `submitScore`.
- [ ] Invariante: `games.has_leaderboard = true` para `serpentina` ⇔ `serpentina` está en
      `REAL_GAME_PLAYERS`.
- [ ] `app/globals.css` solo añade el bloque `.snake-*`; no añade ningún `.cover-*` nuevo y no
      redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`, `.hall-table*`,
      `.leaderboard`, `.lb-row` ni `.lb-empty`.
- [ ] Hay screenshots en `.playwright-screenshots/` de `/juego/serpentina/jugar`, `/juego/serpentina`
      y `/salon` tab `SERPENTINA` (con datos y vacío), en escritorio y ~390 px.
- [ ] `CLAUDE.md` "Stack notes" menciona que `serpentina` (Snake) tiene motor real, `has_leaderboard`
      y carga `public/games/serpentina/fruits.png`.

---

## Decisions

- **Sí:** reutilizar la entrada `serpentina` del catálogo y solo hacer `update … set has_leaderboard
= true`. Ya es temáticamente Snake (`ARCADE`, `cover-snake`, verde, `sort_order 2`). **No:** crear
  un `id` nuevo — duplicaría la temática y dejaría `serpentina` como juego simulado huérfano.
- **No:** reescribir el `short` / `long` de `serpentina`. Mencionan "núcleos magenta" en vez de
  frutas, pero SPEC 08 dejó el copy de `bloque-buster` igual; retocar copy va en su propia spec.
- **Sí:** motor **desde cero**. No hay `references/started-games/` para Snake; se sigue el contrato de
  clase de SPEC 05 sin portar código.
- **Sí:** dibujar las frutas desde `fruits.png` cargado desde `public/games/serpentina/fruits.png`.
  El usuario aportó el spritesheet y da identidad visual al juego. Es el **primer asset binario en
  `public/`**; se acepta la excepción al "cero assets" de SPEC 05–08 para las frutas, y todo lo demás
  sigue procedural. **No:** dibujar la fruta procedural ignorando el material aportado. **No:**
  importar `sprites.js` (usa `window`, no es módulo) — se copian las 22 coordenadas al motor.
- **Sí:** fruta de respaldo procedural (rombo neón) mientras `fruits.png` no ha cargado, para que el
  juego nunca dependa de la red para ser jugable.
- **Sí:** usar solo la **fila pixel-art** (`y = 136`) del spritesheet — encaja con la estética CRT.
  **No:** las otras dos filas (estilos suaves / fotográficos).
- **Sí:** espacio interno **800×600 (4:3)** con banda de HUD de 50 px y grilla de 32×22 celdas de
  25 px. Llena el marco CRT sin bandas, igual que `rocas` y `bloque-buster`. **No:** tablero cuadrado
  600×600 — dejaría bandas laterales.
- **Sí:** **muerte al tocar el borde**, Snake clásico. **No:** bordes que envuelven — más indulgente
  pero se aleja del Snake de referencia; puede ir en otra spec como modo.
- **Sí:** la serpiente **acelera** cada 4 frutas hasta un tope de 6 tramos, y `scores.level` reporta
  el tramo alcanzado (1–6). Da progresión y contexto a la marca, igual que el `level` de `rocas`,
  `caida` y `bloque-buster`. **No:** velocidad constante y `level: 1` fijo — partida plana.
- **Sí:** puntuación simple (`+10` por fruta, `+1` de longitud) y el sprite de la fruta rota por los
  22 del atlas **solo por estética**. **No:** frutas raras / de valor variable — más estado y más
  criterios de aceptación para poca ganancia; va en otra spec.
- **Sí:** controles táctiles con **D-pad de 4 botones** (`up` / `down` / `left` / `right`), toque
  instantáneo, gated por `(pointer: coarse)`, en línea con `rocas` / `caida` / `bloque-buster`.
  **No:** 2 botones de giro relativo ni gestos de swipe sobre el canvas — menos intuitivo o más
  código de punteros fuera del patrón de la plataforma.
- **No:** tocar `PlayerScreen`, la arena CSS decorativa, `CATS`, `FALLBACK_GAME_IDS`, `fallbackGame()`,
  los tags hardcodeados de `/juego/serpentina` ni la infraestructura de `scores` / catálogo. Los 4
  juegos simulados restantes siguen igual hasta su propia spec.

---

## Risks

| Riesgo                                                                        | Mitigación                                                                                                  |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `requestAnimationFrame` no cancelado al navegar → loop huérfano               | `destroy()` en el cleanup del `useEffect`; criterio de aceptación dedicado (heredado de SPEC 05).           |
| React StrictMode monta el efecto dos veces en dev → doble motor               | `gameRef.current?.destroy()` al principio del efecto; `destroy()` idempotente.                              |
| `has_leaderboard` y `REAL_GAME_PLAYERS` se desincronizan                      | Se registran en la misma rama; invariante fijado en criterios de aceptación.                                |
| `get_advisors` marca el `insert` anónimo de `scores`                          | Intencional y heredado de SPEC 06; revisar que no haya **otros** hallazgos.                                 |
| `fruits.png` no carga (offline, 404) → sin fruta visible                      | Fruta de respaldo procedural mientras `spritesReady === false`; el juego sigue jugable.                     |
| Doble giro en un frame → la serpiente se reversa sobre sí misma               | `nextDir` se aplica una sola vez por `step()` y se valida contra `dir` (giro de 180° ignorado).             |
| `dt` enorme al volver de una pestaña en segundo plano → varios pasos de golpe | `dt` capado a 50 ms + `un` `step()` máximo por frame + auto-pausa en `visibilitychange`.                    |
| `preventDefault` de las flechas afecta a otras rutas                          | Solo se engancha mientras el juego está montado y se quita en el cleanup; guard `isFormFieldFocused`.       |
| El HUD y la serpiente en la paleta neon quedan ilegibles a ~390 px            | Texto con `var(--pixel)` a tamaño legible; la revisión visual con Playwright a 390 px lo verifica.          |
| Primer asset en `public/` → se nos olvida copiarlo o se rompe la ruta         | Paso 1 dedicado al asset; criterio de aceptación que compara con el source-asset; `SPRITE_SRC` es absoluto. |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`        | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                                   |

---

## Lo que **no** entra en esta spec

- Sonido y música.
- Frutas de valor variable, frutas raras temporizadas, power-ups, veneno.
- Muros interiores, obstáculos, mapas por nivel, bordes que envuelven.
- Modo a 2 jugadores o versus.
- Persistencia local; `sprites.js` como módulo importable; las otras dos filas de `fruits.png`.
- Auth real, columna `user_id` en `scores`, tabla `profiles`.
- Recalcular `games.best` / `games.plays` desde datos reales.
- Reescribir el `short` / `long` de `serpentina`.
- Portar los otros 4 juegos simulados a motor real.
- Marcas reales en la home; Realtime o paginación en el leaderboard.
- Retocar los tags hardcodeados de `/juego/serpentina`.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
