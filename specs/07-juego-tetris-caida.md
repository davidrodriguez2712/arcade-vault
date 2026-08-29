# SPEC 07 — Segundo juego real: Tetris en la entrada `caida` con leaderboard

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 05, SPEC 06
> **Fecha:** 2026-08-28
> **Objetivo:** Portar el Tetris vanilla de `references/started-games/03-tetris/` a un motor TypeScript agnóstico de framework montado en el marco CRT del reproductor, conectado a la entrada de catálogo `caida`, con panel lateral en canvas, controles táctiles y guardado real de puntuaciones bajo RLS.

---

## Por qué existe esta spec

SPEC 05 portó `rocas` (Asteroides) a un motor real y fijó el patrón: `engine.ts` sin React/Next +
envoltorio `"use client"` fino, registrado en `app/components/games/registry.ts`. SPEC 06 movió el
catálogo y las puntuaciones a Supabase y añadió el overlay React de guardado, la tabla `scores` con
inserción anónima bajo RLS condicionada a `games.has_leaderboard`, y el estado vacío del leaderboard.
Hoy `rocas` es el **único** juego con motor real y `has_leaderboard = true`.

La entrada `caida` ("CAÍDA", categoría `PUZZLE`, portada `cover-tetro`, color magenta) ya es el hueco
temático de Tetris en el catálogo: hoy la sirve el `PlayerScreen` simulado. Esta spec mete el
**segundo juego jugable de verdad** reutilizando esa entrada, aplicando SPEC 05 + SPEC 06 tal cual,
sin tocar la infraestructura compartida.

El juego de referencia (`references/started-games/03-tetris/game.js`, 332 líneas) es canvas 2D puro,
sin bundler: estado en variables de módulo, piezas como matrices, `loop(ts)` con acumulador
`dropAccum` contra `dropInterval` en ms, `clearLines` de abajo arriba, ghost piece, preview de la
siguiente pieza. HUD y overlay son **DOM** (`#score` / `#lines` / `#level`, un segundo `<canvas>` para
la preview, un `<div>` de overlay). Adaptarlo implica pasar todo ese estado global y ese HUD de DOM a
una clase que se monte y **desmonte** limpiamente al navegar entre rutas del App Router, y dibujar el
HUD y la preview en el mismo canvas.

Decisiones de forma tomadas con el usuario antes de escribir esta spec:

- **Reutilizar la entrada `caida`.** La migración solo hace
  `update public.games set has_leaderboard = true where id = 'caida'`. No se crea un `id` nuevo ni se
  toca `FALLBACK_GAME_IDS` / `fallbackGame()`.
- **Con leaderboard.** `has_leaderboard = true`, overlay React de guardado al perder, marcas reales
  en `/juego/caida` y `/salon`.
- **Espacio interno 480×600 con panel lateral en canvas.** Tablero 300×600 a la izquierda (10×20 a
  30 px), panel de 180 px a la derecha con `SCORE` / `LINES` / `LEVEL` / `NEXT`. Proporción 4:5;
  `object-fit: contain` lo centra dentro del marco CRT (4:3), con banda negra a los lados.
- **Tetris estándar de 7 piezas.** Se descarta la 8ª pieza "tuerca" (anillo con hueco) del `game.js`
  de referencia — el hueco central impedía completar líneas debajo de ella.
- **Controles táctiles con 5 botones:** `◄` `►` (mover), `▼` (soft drop), `⟳` (rotar), `⤓` (hard drop).
- **Fuera:** tema claro/oscuro + `localStorage`, sonido, hold piece / 7-bag randomizer (se mantiene el
  random puro del referente), y los colores pastel del `game.js` (se re-mapean a la paleta neon de
  `globals.css`).

Esta spec **no revisa** ninguna decisión de SPEC 05 ni de SPEC 06.

---

## Scope

**In:**

- `supabase/migrations/07-juego-tetris-caida.sql` (nuevo) — aplicado al proyecto remoto
  `itmhyidlxraapcjzprvn` con `mcp__supabase__apply_migration`. Contiene:
  - `update public.games set has_leaderboard = true where id = 'caida';`
  - Si al leer la fila `caida` su `short` / `long` describen un juego que no es este (menciones a
    mecánicas ausentes), un `update public.games set short = …, long = … where id = 'caida'` en la
    misma migración para que el copy hable del tablero 10×20, el hard drop, la ghost piece y la
    siguiente pieza. `title`, `cat`, `cover`, `color`, `best`, `plays`, `sort_order` **no se tocan**.
  - La tabla `scores` **ya existe** desde SPEC 06: no se recrea, no se toca su RLS.
- `app/lib/supabase/database.types.ts` — regenerado con `mcp__supabase__generate_typescript_types`
  tras la migración (el esquema no cambia de columnas; se regenera por higiene).
- `app/components/games/tetris/engine.ts` (nuevo) — motor portado de `game.js`, **sin ninguna
  importación de React ni de Next**. Exporta la clase `TetrisGame` y los tipos `TouchAction` /
  `GameOverResult`. Dibuja siempre en el espacio interno fijo 480×600; el escalado responsive vive
  solo en `resize()`. `dt` capado a 50 ms. **No** pinta el texto de "GAME OVER" (lo pone el overlay
  React); sí pinta el tablero, la ghost piece, la pieza actual, la rejilla, el panel lateral
  (`SCORE` / `LINES` / `LEVEL` / `NEXT`) y el overlay "EN PAUSA".
  - Port de: `COLS` (10), `ROWS` (20), `BLOCK` (30), `PIECES` (7: I, O, T, S, Z, J, L),
    `LINE_SCORES` (`[0, 100, 300, 500, 800]`), `createBoard`, `randomPiece` (elige 1..7), `collide`,
    `rotateCW`, `tryRotate` (kicks `[0, -1, 1, -2, 2]`), `merge`, `clearLines`, `ghostY`, `hardDrop`,
    `softDrop`, `lockPiece`, `spawn`, `drawBlock`, la rejilla, `drawNext`, el HUD.
  - `COLORS` se re-mapea a tokens de la paleta neon (`var(--cyan)`, `var(--magenta)`, `var(--yellow)`,
    `var(--green)` y variantes) en vez de `#4dd0e1` etc.
  - `dropInterval` en **segundos**: `Math.max(0.1, 1 - (level - 1) * 0.09)`; `level =
Math.floor(lines / 10) + 1`. Acumulador `dropAccum` en segundos contra `dropInterval`.
  - Contrato de la clase (ver Data model): `constructor(canvas)`, `start()`, `stop()`, `destroy()`,
    `restart()`, `setPaused()` / `togglePause()`, `resize(cssW, cssH, dpr)`,
    `setOnGameOver(cb)`, `setInput(action, pressed)`.
  - Input: `←` `→` `↑`/`X` (rotar) y `Espacio` (hard drop) se consumen como **flanco** (`pressed`);
    `↓` acelera la caída **mientras esté pulsado** (`keys["ArrowDown"]` o el botón táctil `down`).
  - `setOnGameOver` se dispara **una sola vez** por partida, cuando `spawn()` genera una pieza que ya
    colisiona (`endGame`), con `{ score, level }`.
  - `Escape` / `KeyP` durante la partida alternan pausa; el motor no pinta "GAME OVER".
- `app/components/games/tetris/tetris-player.tsx` (nuevo, `"use client"`) — envoltorio fino, copia de
  `app/components/games/asteroids/asteroids-player.tsx` con `GAME_ID = "caida"` y la clase `TetrisGame`:
  - Marco CRT (`.crt` / `.crt-screen` / `.crt-bottom`), `<canvas className="tetris-canvas" width={480}
height={600}>` dentro de `.tetris-stage`.
  - `useEffect` de montaje: guard StrictMode (`gameRef.current?.destroy()`), `new TetrisGame(canvas)`,
    `game.setOnGameOver(setOver…)`, `ResizeObserver` → `game.resize(rect.width, rect.height, dpr)`,
    `game.start()`, `visibilitychange` → `game.setPaused(document.hidden)`, `keydown` con
    `preventDefault` de `ArrowUp/ArrowDown/ArrowLeft/ArrowRight/Space` (salvo si se escribe en un
    input) y `Escape`/`KeyP` → `togglePause()`, `Space` → cerrar el overlay. Cleanup: `game.destroy()`.
  - Overlay `.modal-bd` / `.modal` (reutiliza las clases de `globals.css`) con "FIN DEL JUEGO",
    puntuación final (`toLocaleString("es-ES")`), input de iniciales
    (`e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 12)`), botón `GUARDAR
PUNTUACIÓN` → `submitScore({ gameId: "caida", name, score, level })`, botón `JUGAR DE NUEVO` →
    `game.restart()` + cerrar overlay, enlace `VOLVER` a `/juego/caida`. Estados
    `idle | saving | saved | error` con "▸ PUNTUACIÓN GUARDADA_" y mensaje de error legible.
  - `crt-bottom`: etiqueta `CAÍDA · CRT-83 · 60 HZ` y `TETRIS`.
  - Monta `<TetrisTouchControls onInput={handleInput} />`.
- `app/components/games/tetris/touch-controls.tsx` (nuevo, `"use client"`) — copia de
  `asteroids/touch-controls.tsx` con 5 botones. `TouchAction = "left" | "right" | "down" | "rotate" |
"drop"`. `left` / `right` / `rotate` / `drop` disparan un flanco; `down` es booleano sostenido.
  `pointerdown` → `onInput(action, true)`; `pointerup` / `pointercancel` / `pointerleave` → `false`;
  `e.preventDefault()` en cada handler. Visibles solo bajo `@media (pointer: coarse)`.
- `app/components/games/registry.ts` — añadir `caida: TetrisPlayer` a `REAL_GAME_PLAYERS`.
- `app/globals.css` — anexar al final el bloque `/* ===== juego: tetris (caida) ===== */`:
  - `.tetris-stage` (`position: absolute; inset: 0; background: #000;`).
  - `.tetris-canvas` (`display: block; width: 100%; height: 100%; object-fit: contain;
touch-action: none;`).
  - `.tetris-touch` (`position: absolute; inset: 0; display: none; pointer-events: none; z-index: 4;`)
    - `@media (pointer: coarse) { .tetris-touch { display: block; } }` + `.tetris-touch-btn` con las 5
      variantes de posición (`.left` / `.right` abajo-izquierda; `.rotate` / `.down` / `.drop`
      abajo-derecha).
  - **No** añade ningún `.cover-*` — `.cover-tetro` ya existe (línea ~715) y es el que usa `caida`.
  - **No** redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`,
    `.hall-table*`, `.leaderboard`, `.lb-row`, `.lb-empty`.
- `CLAUDE.md` — "Stack notes": actualizar la línea de leaderboards ("today: `rocas` only" → "hoy:
  `rocas` y `caida`") y la de "Real games" ("First one: `asteroids` → `rocas`" → añadir
  `tetris` → `caida`).
- Revisión visual con Playwright MCP: screenshots en `.playwright-screenshots/` de
  `/juego/caida/jugar` (inicio, partida en curso, overlay de guardado), `/juego/caida` (aside con
  datos y vacío) y `/salon` (tab `CAÍDA` con datos y vacía), en escritorio y ~390 px. Verificar que
  `/juego/rocas` y su tab siguen funcionando y que otro juego simulado (p. ej. `/juego/serpentina`)
  sigue con `seededScores`.

**Out of scope (para futuras specs):**

- Toggle de tema claro/oscuro, `light-mode` y `localStorage` del `game.js` de referencia. El motor no
  usa `localStorage` ni IndexedDB y no hace ninguna petición de red (aparte de `submitScore`).
- Sonido y música.
- La 8ª pieza "tuerca" del referente.
- Hold piece, cola de piezas de más de 1, y 7-bag randomizer. Se mantiene `Math.random` puro.
- DAS / ARR configurables para el movimiento lateral.
- Auth real / columna `user_id` en `scores` (el leaderboard sigue siendo anónimo por iniciales).
- Recalcular `games.best` / `games.plays` desde datos reales (siguen siendo columnas mock estáticas).
- Portar los otros 6 juegos simulados a motor real.
- Marcas reales en la home; Realtime / paginación del leaderboard.
- Ajustar los tags hardcodeados de `/juego/caida` ("1 JUGADOR", estrellas de dificultad).
- Tests automatizados (no hay runner).

---

## Data model

La tabla `scores` no cambia (definida en SPEC 06). El único estado nuevo es el del motor, en memoria y
por partida.

```ts
// engine.ts
type GameState = "playing" | "gameover";
export type TouchAction = "left" | "right" | "down" | "rotate" | "drop";
export interface GameOverResult {
  score: number;
  level: number;
}

interface Piece {
  type: number; // 1..7 (índice en COLORS / PIECES)
  shape: number[][]; // matriz cuadrada; 0 = vacío, type = ocupado
  x: number; // columna del borde izquierdo (puede ser negativa por wall kick)
  y: number; // fila del borde superior
}

class TetrisGame {
  private board: number[][]; // ROWS x COLS; 0 = vacío, 1..7 = color
  private current: Piece;
  private next: Piece;
  private score = 0;
  private lines = 0;
  private level = 1;
  private state: GameState = "playing";
  private dropAccum = 0; // segundos acumulados
  private dropInterval = 1; // segundos; max(0.1, 1 - (level-1)*0.09)
  private paused = false;
  private gameOverNotified = false;

  private keys: Record<string, boolean> = {};
  private justPressed: Record<string, boolean> = {};
  private touch: Record<TouchAction, boolean> = {
    left: false,
    right: false,
    down: false,
    rotate: false,
    drop: false,
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

Constantes portadas de `game.js` (coordenadas origen arriba-izquierda; el tablero ocupa el rectángulo
interno `0..300 × 0..600`, el panel `300..480 × 0..600`):

| Concepto              | Valor                                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| Tablero               | `COLS = 10`, `ROWS = 20`, `BLOCK = 30`                                   |
| Piezas                | 7: `I O T S Z J L` (matrices de `game.js`, sin la pieza 8 "tuerca")      |
| Puntos por líneas     | `LINE_SCORES = [0, 100, 300, 500, 800]`, multiplicado por `level`        |
| Soft drop / hard drop | `+1` por fila / `+2` por celda recorrida                                 |
| Nivel                 | `level = Math.floor(lines / 10) + 1`                                     |
| Velocidad de caída    | `dropInterval = Math.max(0.1, 1 - (level - 1) * 0.09)` s                 |
| Rotación              | `rotateCW` (transpone + invierte filas) + wall kicks `[0, -1, 1, -2, 2]` |
| Ghost piece           | `ghostY()` proyecta hacia abajo; se dibuja a `globalAlpha ≈ 0.2`         |

Invariantes internos (heredados del patrón de SPEC 05):

- Loop: `dt = Math.min((ts - last) / 1000, 0.05)`; `if (!paused) update(dt); draw();` y re-`rAF`.
- `onKeyDown` / `onKeyUp` son campos arrow-fn (para quitarlos en `stop()`), con guard
  `isFormFieldFocused(e.target)` para no capturar el teclado mientras se escriben las iniciales.
- Fin de partida: `state = "gameover"` + `if (!gameOverNotified) { gameOverNotified = true;
onGameOver?.({ score, level }); }`. `gameOverNotified` se resetea en `initGame()`.
- `resize()`: `targetAspect = 480 / 600`; tras ajustar `canvas.width/height` a `tamaño * dpr` con esa
  proporción, `ctx.setTransform(pxW / 480, 0, 0, pxH / 600, 0, 0)`.
- `"left" | "right" | "rotate" | "drop"` en `setInput` disparan `justPressed` en el flanco de subida
  (como `"fire"` en asteroides); `"down"` es un booleano sostenido combinado con `keys["ArrowDown"]`.

```ts
// registry.ts
export const REAL_GAME_PLAYERS: Record<
  string,
  ComponentType<{ title: string }>
> = {
  rocas: AsteroidsPlayer,
  caida: TetrisPlayer,
};
```

### Mapa de archivos tras esta spec

| Archivo                                          | Tipo               | Cambio                   |
| ------------------------------------------------ | ------------------ | ------------------------ |
| `supabase/migrations/07-juego-tetris-caida.sql`  | migración SQL      | nuevo (aplicado vía MCP) |
| `app/lib/supabase/database.types.ts`             | tipos generados    | regenerado               |
| `app/components/games/tetris/engine.ts`          | motor (agnóstico)  | nuevo                    |
| `app/components/games/tetris/tetris-player.tsx`  | client component   | nuevo                    |
| `app/components/games/tetris/touch-controls.tsx` | client component   | nuevo                    |
| `app/components/games/registry.ts`               | mapa id→componente | `+1` entrada (`caida`)   |
| `app/globals.css`                                | estilos            | `+` bloque `.tetris-*`   |
| `CLAUDE.md`                                      | doc                | "Stack notes"            |

`app/lib/games.ts`, `app/lib/scores.ts`, `app/lib/scores-actions.ts`, `app/lib/supabase/public.ts`,
`app/lib/home.ts`, `app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx`, `app/salon/page.tsx`,
`app/components/hall-of-fame.tsx`, `player-screen.tsx` y `asteroids/*` **no se tocan** — ya son
agnósticos del juego: todo va por `game_id` + `has_leaderboard`.

---

## Implementation plan

1. **Migración + tipos.** Escribir `supabase/migrations/07-juego-tetris-caida.sql` con el
   `update … set has_leaderboard = true where id = 'caida'` (y el `update` de `short` / `long` si el
   copy actual no describe el juego). Aplicar con `mcp__supabase__apply_migration`. Regenerar
   `app/lib/supabase/database.types.ts`. Verificación: `mcp__supabase__list_tables` muestra `caida`
   con `has_leaderboard = true`; `mcp__supabase__list_migrations` incluye `07`;
   `mcp__supabase__get_advisors` (security) no reporta nada crítico nuevo (el insert anónimo en
   `scores` es el hallazgo esperado de SPEC 06); un `insert` de prueba vía `mcp__supabase__execute_sql`
   con `game_id = 'caida'` y datos válidos se acepta, y con `game_id = 'serpentina'` se rechaza;
   `npm run build` compila (la app aún usa el `PlayerScreen` para `caida` en este punto).

2. **Esqueleto del motor + dispatch.** Crear `app/components/games/tetris/engine.ts` con la clase
   `TetrisGame` mínima: `constructor`, `start`/`stop`/`destroy`/`restart`, `setPaused`/`togglePause`,
   `resize`, `setOnGameOver`, `setInput`, y un loop `rAF` que solo pinta el canvas de negro. Crear
   `app/components/games/tetris/tetris-player.tsx` (marco `.crt` + `<canvas className="tetris-canvas">`
   - `useEffect` que monta/destruye el motor + `ResizeObserver` + enlace `VOLVER`, sin overlay
     todavía). Añadir `caida: TetrisPlayer` a `registry.ts`. Verificación: `/juego/caida/jugar` muestra
     un canvas negro dentro del marco CRT; `/juego/serpentina/jugar` sigue mostrando `PlayerScreen`;
     `npm run build` y `npm run lint` pasan.

3. **Entidades + lógica de partida + teclado + dibujo.** Portar a `engine.ts` las constantes, las 7
   piezas, `createBoard` / `randomPiece` (1..7) / `collide` / `rotateCW` / `tryRotate` / `merge` /
   `clearLines` / `ghostY` / `hardDrop` / `softDrop` / `lockPiece` / `spawn`, y `update(dt)` con el
   acumulador `dropAccum` vs `dropInterval`. `draw()` pinta: rejilla + tablero + ghost + pieza actual
   en el rectángulo `0..300 × 0..600`, y el panel (`SCORE` / `LINES` / `LEVEL` / `NEXT` con la
   siguiente pieza) en `300..480 × 0..600`, todo en canvas con `var(--pixel)` / `var(--mono)` y la
   paleta neon. `start()` engancha `keydown`/`keyup`; `stop()` los quita. `←` `→` `↑`/`X` `Espacio`
   como flanco; `↓` sostenido acelera la caída. `setOnGameOver` se dispara en `spawn()` al colisionar.
   El motor **no** pinta "GAME OVER"; `Escape`/`P` pausan con overlay "EN PAUSA". Verificación manual
   con teclado en 480×600 fijo: mover, rotar con wall kicks, soft/hard drop, limpiar 1–4 líneas con
   la puntuación correcta, subir de nivel cada 10 líneas y notar la aceleración, `GAME OVER` al
   ahogarse. Navegar fuera a media partida no deja `requestAnimationFrame` huérfano ni errores.

4. **Escalado responsive + táctiles.** `resize(cssW, cssH, dpr)` con `targetAspect = 480/600` y
   `ctx.setTransform`. En `tetris-player.tsx`, `.tetris-stage` + `ResizeObserver` que llama a
   `resize`. Crear `touch-controls.tsx` con los 5 botones cableados a `game.setInput()`; `update()`
   combina `keys` + `touch`. Añadir el bloque `.tetris-*` a `globals.css`. Verificación: el juego
   llena el marco CRT en escritorio y a ~390 px sin deformarse, nítido con `devicePixelRatio > 1`,
   sin scroll horizontal; en viewport táctil (`pointer: coarse`) los 5 botones controlan la pieza y en
   escritorio no se ven; las flechas y `Espacio` no hacen scroll de la página.

5. **Guardado real.** En `tetris-player.tsx`: overlay `.modal` con "FIN DEL JUEGO", puntuación final,
   input de iniciales (filtro `[A-Za-z0-9_]`, máx 12, mayúsculas) y los tres botones;
   `submitScore({ gameId: "caida", name, score, level })`; estados guardando (botón deshabilitado) /
   "▸ PUNTUACIÓN GUARDADA_" / error legible sin romper el canvas; `JUGAR DE NUEVO` → `game.restart()`
   - `setOver(null)`. Verificación manual en `/juego/caida/jugar`: morir, escribir `TEST_1`,
     `GUARDAR`, ver la fila en el aside de `/juego/caida` y en la tab `CAÍDA` de `/salon` (revalidación
     inmediata por `revalidatePath`); un nombre vacío / inválido y un fallo de red muestran mensaje
     legible; `JUGAR DE NUEVO` reinicia sin recargar la página.

6. **Docs, CSS final y revisión visual.** Actualizar "Stack notes" de `CLAUDE.md`. `npm run lint` y
   `npm run build` limpios; quitar imports / `console` sin usar. Screenshots con Playwright MCP en
   `.playwright-screenshots/` de `/juego/caida/jugar` (inicio, en curso, overlay de guardado),
   `/juego/caida` (aside con datos y vacío) y `/salon` (tab `CAÍDA` con datos y vacía), en escritorio
   y ~390 px. Verificar que `/juego/rocas` y `/juego/serpentina` no han cambiado de comportamiento.
   Commitear el bloque gestionado de `AGENTS.md` / `CLAUDE.md` si `next dev` lo reescribió.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `npm run lint` sin errores ni warnings.
- [ ] `app/components/games/tetris/engine.ts` no importa nada de `react` ni de `next`.
- [ ] `mcp__supabase__list_tables` muestra `public.games` con la fila `caida` y `has_leaderboard =
  true`; `mcp__supabase__list_migrations` incluye la migración `07`.
- [ ] `supabase/migrations/07-juego-tetris-caida.sql` existe en el repo con el mismo SQL aplicado.
- [ ] Insertar en `scores` una fila con `game_id = 'serpentina'` vía API `anon` es rechazado por la
      política; con `game_id = 'caida'` y datos válidos, se acepta.
- [ ] `/juego/caida/jugar` renderiza un `<canvas>` dentro del marco CRT (`.crt` / `.crt-screen` /
      `.crt-bottom`), sin HUD React.
- [ ] `/juego/serpentina/jugar` (y el resto de ids sin motor real) sigue mostrando `PlayerScreen` con
      el contador simulado; `/juego/rocas/jugar` sigue mostrando Asteroides.
- [ ] `generateStaticParams` de `/juego/[id]` y `/juego/[id]/jugar` sigue generando las 8 rutas del
      catálogo; ningún id existente da 404.
- [ ] Teclado: `←` `→` mueven la pieza, `↑` / `X` rotan con wall kicks, `↓` acelera la caída,
      `Espacio` hace hard drop.
- [ ] Una línea completa se elimina y las filas de arriba bajan; 1/2/3/4 líneas dan
      `100/300/500/800 × nivel` puntos, reflejados en el panel.
- [ ] El nivel sube a `floor(lines / 10) + 1` y la caída se acelera (`dropInterval` baja).
- [ ] El panel del canvas muestra `SCORE`, `LINES`, `LEVEL` y la siguiente pieza (`NEXT`).
- [ ] La ghost piece se dibuja translúcida donde aterrizará la pieza actual.
- [ ] Al aparecer una pieza que ya colisiona, el motor entra en `gameover` y dispara `onGameOver`
      **una sola vez**.
- [ ] Al perder aparece un overlay React (`.modal`) con la puntuación final y un input de iniciales;
      el canvas ya no dibuja el texto "GAME OVER".
- [ ] El input de iniciales solo acepta `[A-Za-z0-9_]`, máximo 12, y lo muestra en mayúsculas.
- [ ] `GUARDAR PUNTUACIÓN` con un nombre válido inserta una fila en `scores` (`game_id = 'caida'`,
      `score` y `level` de la partida) y muestra "PUNTUACIÓN GUARDADA"; la fila aparece luego en
      `/juego/caida` y `/salon` tab `CAÍDA`.
- [ ] `submitScore` con nombre inválido, o con Supabase caído, devuelve `{ ok: false, error }` y el
      overlay muestra el mensaje sin romper el juego.
- [ ] `JUGAR DE NUEVO` en el overlay reinicia la partida vía `game.restart()` sin recargar la página.
- [ ] Con `scores` sin filas de `caida`: la tab `CAÍDA` de `/salon` y el aside de `/juego/caida`
      muestran el estado vacío `.lb-empty` en vez de podio / filas.
- [ ] El canvas escala manteniendo proporción 4:5, se ve nítido con `devicePixelRatio > 1`, y la
      página no tiene scroll horizontal a ~390 px.
- [ ] Con las flechas y `Espacio` durante la partida, la página no hace scroll.
- [ ] En viewport táctil (`pointer: coarse`) se ven 5 botones que mueven, rotan, soft-drop y
      hard-drop; en escritorio no se muestran.
- [ ] `Escape` o `P` alternan pausa con un overlay "EN PAUSA" en el canvas; cambiar de pestaña pausa.
- [ ] Navegar fuera de `/juego/caida/jugar` a media partida no deja errores en consola ni un
      `requestAnimationFrame` activo.
- [ ] El juego no usa `localStorage` ni IndexedDB; la única petición de red es `submitScore`.
- [ ] Invariante: `games.has_leaderboard = true` para `caida` ⇔ `caida` está en `REAL_GAME_PLAYERS`.
- [ ] `app/globals.css` solo añade el bloque `.tetris-*`; no añade ningún `.cover-*` nuevo y no
      redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`, `.hall-table*`,
      `.leaderboard`, `.lb-row` ni `.lb-empty`.
- [ ] Hay screenshots en `.playwright-screenshots/` de `/juego/caida/jugar`, `/juego/caida` y
      `/salon` tab `CAÍDA` (con datos y vacío), en escritorio y ~390 px.
- [ ] `CLAUDE.md` "Stack notes" menciona que `caida` (Tetris) tiene motor real y `has_leaderboard`.

---

## Decisions

- **Sí:** reutilizar la entrada `caida` del catálogo y solo hacer `update … set has_leaderboard =
true`. Ya es temáticamente Tetris (`PUZZLE`, `cover-tetro`, magenta). **No:** crear un `id` nuevo
  `tetris` — duplicaría la temática y dejaría `caida` como juego simulado huérfano.
- **Sí:** las dos features (motor real + leaderboard) en la misma spec, como hizo SPEC 06 para
  `rocas`. `has_leaderboard = true` solo tiene sentido con un juego en `REAL_GAME_PLAYERS`.
- **Sí:** espacio interno **480×600 con panel lateral dibujado en el mismo canvas**. Da sitio al
  `NEXT` y a `SCORE` / `LINES` / `LEVEL` sin un segundo `<canvas>` ni HUD React, y encaja razonable en
  el marco CRT (4:3) con `object-fit: contain`. **No:** 300×600 solo tablero (letterbox vertical
  fuerte, `NEXT` apretado). **No:** 800×600 con huecos decorativos (más superficie de dibujo para
  cero valor).
- **Sí:** **Tetris estándar de 7 piezas.** La 8ª pieza "tuerca" del `game.js` de referencia es un
  anillo con hueco central: una fila nunca se completa debajo del hueco, lo que rompe el `clearLines`.
  **No:** portarla — el README de referencia tampoco la documenta.
- **Sí:** `←` `→` rotación y hard drop como **flanco** (`pressed`), soft drop **sostenido**. Encaja
  con el modelo `keys` / `justPressed` del motor de asteroides y evita depender del auto-repeat del
  SO. **No:** DAS / ARR configurables — fuera de alcance.
- **Sí:** `scores.level` reporta el **nivel de Tetris** (`floor(lines / 10) + 1`). Es barato, ya lo
  calcula el motor y da contexto a la marca, igual que el `level` de `rocas`.
- **Sí:** re-mapear los colores pastel del referente a la **paleta neon** de `globals.css`
  (`var(--cyan)` etc.). **No:** mantener los `#4dd0e1` — desentonarían con el resto de la plataforma.
- **Sí:** controles táctiles con **5 botones** (`◄` `►` `▼` `⟳` `⤓`), gated por `(pointer: coarse)`,
  igual que en `rocas`. Sin ellos Tetris es injugable en móvil.
- **No:** tocar `PlayerScreen`, la arena CSS decorativa, `CATS`, los tags hardcodeados de
  `/juego/caida` ni la infraestructura de `scores` / catálogo. Los 6 juegos simulados restantes
  siguen igual hasta su propia spec.

---

## Risks

| Riesgo                                                                             | Mitigación                                                                                            |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `requestAnimationFrame` no cancelado al navegar → loop huérfano                    | `destroy()` en el cleanup del `useEffect`; criterio de aceptación dedicado (heredado de SPEC 05).     |
| React StrictMode monta el efecto dos veces en dev → doble motor                    | `gameRef.current?.destroy()` al principio del efecto; `destroy()` idempotente.                        |
| `has_leaderboard` y `REAL_GAME_PLAYERS` se desincronizan                           | Se registran en la misma rama; invariante fijado en criterios de aceptación.                          |
| `get_advisors` marca el `insert` anónimo de `scores`                               | Intencional y heredado de SPEC 06; revisar que no haya **otros** hallazgos.                           |
| El acumulador de caída en ms del referente choca con el `dt` en segundos del motor | `dropAccum` y `dropInterval` se portan a segundos; `dt` capado a 50 ms evita el "spiral of death".    |
| El panel lateral en canvas dificulta leer el HUD a ~390 px                         | El texto usa `var(--pixel)` a tamaño legible; la revisión visual con Playwright a 390 px lo verifica. |
| `preventDefault` de `ArrowDown` / `Space` afecta a otras rutas                     | Solo se engancha mientras el juego está montado y se quita en el cleanup; guard `isFormFieldFocused`. |
| Doble disparo de `onGameOver` (StrictMode, `spawn` repetido)                       | Flag `gameOverNotified`, reseteado en `initGame()`; `restart()` lo re-arma.                           |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`             | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                             |

---

## Lo que **no** entra en esta spec

- Tema claro/oscuro, `localStorage`, sonido y música.
- La 8ª pieza "tuerca", hold piece, 7-bag randomizer, DAS/ARR configurables.
- Auth real, columna `user_id` en `scores`, tabla `profiles`.
- Recalcular `games.best` / `games.plays` desde datos reales.
- Portar los otros 6 juegos simulados a motor real.
- Marcas reales en la home; Realtime o paginación en el leaderboard.
- Retocar los tags hardcodeados de `/juego/caida`.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
