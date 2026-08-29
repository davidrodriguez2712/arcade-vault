# SPEC 08 — Tercer juego real: Arkanoid en la entrada `bloque-buster` con leaderboard

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 05, SPEC 06
> **Fecha:** 2026-08-28
> **Objetivo:** Portar el Arkanoid vanilla de `references/started-games/04-arkanoid/` a un motor TypeScript agnóstico de framework montado en el marco CRT del reproductor, conectado a la entrada de catálogo `bloque-buster`, con render procedural en la paleta neon, controles táctiles y guardado real de puntuaciones bajo RLS.

---

## Por qué existe esta spec

SPEC 05 portó `rocas` (Asteroides) a un motor real y fijó el patrón: `engine.ts` sin React/Next +
envoltorio `"use client"` fino, registrado en `app/components/games/registry.ts`. SPEC 06 movió el
catálogo y las puntuaciones a Supabase y añadió el overlay React de guardado, la tabla `scores` con
inserción anónima bajo RLS condicionada a `games.has_leaderboard`, y el estado vacío del leaderboard.
SPEC 07 repitió el patrón para `caida` (Tetris). Hoy `rocas` y `caida` son los únicos juegos con
motor real y `has_leaderboard = true`.

La entrada `bloque-buster` ("BLOQUE BUSTER", categoría `ARCADE`, portada `cover-bricks`, color cyan,
"Rebota la pelota y destruye muros de neón") ya es el hueco temático de breakout en el catálogo: hoy
la sirve el `PlayerScreen` simulado. Esta spec mete el **tercer juego jugable de verdad**
reutilizando esa entrada, aplicando SPEC 05 + SPEC 06 tal cual, sin tocar la infraestructura
compartida.

El juego de referencia (`references/started-games/04-arkanoid/game.js`, 268 líneas) es canvas 2D puro,
sin bundler: estado en variables de módulo (`paddle`, `ball`, `blocks`, `explosions`, `lives`,
`score`, `gameState`, `currentLevel`, `isPaused`), canvas 800×600, `loop(ts)` con `dt` en segundos,
colisiones AABB (una por frame, `+10` puntos), 5 niveles definidos en `levels.js` con un multiplicador
de velocidad de bola por nivel (`×1.00` → `×1.46`). El input es ratón + `←`/`→` para la paleta, y
`P`/`Escape` para pausar (con un selector de nivel de debug en el overlay de pausa). HUD y overlays se
dibujan en el canvas. Los assets son un spritesheet PNG (`spritesheet-breakout.png`) y dos MP3.
Adaptarlo implica pasar ese estado global y esos listeners de `window` a una clase que se monte y
**desmonte** limpiamente al navegar entre rutas del App Router, y redibujar todo de forma procedural.

Decisiones de forma tomadas con el usuario antes de escribir esta spec:

- **Reutilizar la entrada `bloque-buster`.** La migración solo hace
  `update public.games set has_leaderboard = true where id = 'bloque-buster'`. No se crea un `id`
  nuevo ni se toca `FALLBACK_GAME_IDS` / `fallbackGame()`. El `short` / `long` actuales ya describen
  este juego (nave-paleta, núcleo de plasma, muros de bloques cromáticos, niveles, racha): **no se
  editan**.
- **Con leaderboard.** `has_leaderboard = true`, overlay React de guardado al terminar, marcas reales
  en `/juego/bloque-buster` y `/salon`.
- **Render procedural en la paleta neon.** Nada de `spritesheet-breakout.png` ni de los dos MP3. La
  paleta, la bola y los bloques se dibujan como formas de canvas con los tokens de `globals.css`
  (`var(--cyan)` etc.). La explosión al romper un bloque es un destello procedural corto, no los 4
  frames del sprite. Cero peticiones de red aparte de `submitScore`.
- **Espacio interno 800×600 (4:3).** Igual que el referente y que `rocas`. `object-fit: contain`
  centra el canvas en el marco CRT (4:3) sin bandas. La grilla de bloques 10×6 cabe tal cual.
- **Los 5 niveles de `levels.js`, sin selector.** Se portan los patrones (parrilla, pirámide,
  ajedrez, filas con huecos, marco + cruz) y su multiplicador de velocidad. Se **quita** el selector
  "saltar a nivel" del overlay de pausa (era una ayuda de debug).
- **Controles táctiles con 2 botones:** `◄` `►` (mover la paleta), sostenidos.
- **`scores.level` reporta el nivel alcanzado (1–5).**
- **La partida termina al perder las 3 vidas o al completar el nivel 5.** Ambos casos disparan
  `onGameOver` una sola vez con la puntuación final; el overlay de guardado es el mismo.
- **Fuera:** los assets del referente (spritesheet + sonidos), el control con ratón, el selector de
  nivel en pausa, ladrillos multi-impacto, power-ups y niveles adicionales.

Esta spec **no revisa** ninguna decisión de SPEC 05, SPEC 06 ni SPEC 07.

---

## Scope

**In:**

- `supabase/migrations/08-juego-arkanoid-bloque-buster.sql` (nuevo) — aplicado al proyecto remoto con
  `mcp__supabase__apply_migration`. Contiene una sola sentencia:
  - `update public.games set has_leaderboard = true where id = 'bloque-buster';`
  - La tabla `scores` **ya existe** desde SPEC 06: no se recrea, no se toca su RLS. `title`, `short`,
    `long`, `cat`, `cover`, `color`, `best`, `plays`, `sort_order` de `bloque-buster` **no se tocan**.
- `app/lib/supabase/database.types.ts` — regenerado con `mcp__supabase__generate_typescript_types`
  tras la migración (el esquema no cambia de columnas; se regenera por higiene).
- `app/components/games/arkanoid/engine.ts` (nuevo) — motor portado de `game.js`, **sin ninguna
  importación de React ni de Next**. Exporta la clase `ArkanoidGame` y los tipos `TouchAction` /
  `GameOverResult`. Dibuja siempre en el espacio interno fijo 800×600; el escalado responsive vive
  solo en `resize()`. `dt` capado a 50 ms. **No** pinta el texto de "GAME OVER" ni el de victoria
  (lo pone el overlay React); sí pinta el fondo, los bloques, la paleta, la bola, el destello de
  ruptura, el HUD (`SCORE` / `NIVEL` / vidas) y el overlay "EN PAUSA".
  - Port de: `PADDLE_SPEED` (400), `BLOCK_COLS` (10), `BLOCK_ROWS` (6), `BLOCK_W` (64), `BLOCK_H`
    (24), `BLOCKS_ORIGIN_X` / `BLOCKS_ORIGIN_Y`, `BASE_BALL_VX` (200), `BASE_BALL_VY` (-300), y las
    funciones `initPaddle`, `initBall`, `loadLevel`, `collideAABB`, `update(dt)`, `draw()`.
  - `LEVELS` portado de `levels.js` (5 entradas: `{ speed, blocks: [{ col, row, color }] }` con los
    patrones parrilla / pirámide / ajedrez / huecos / marco+cruz). La lógica IIFE que genera los
    patrones se porta a una función pura o a un array literal en el módulo.
  - Los colores de bloque (`red`, `yellow`, `cyan`, `magenta`, `hotpink`, `green`, `gray`) se
    **re-mapean** a tokens de la paleta neon de `globals.css` (`var(--cyan)`, `var(--magenta)`,
    `var(--yellow)`, `var(--green)` y variantes) en vez de los nombres CSS crudos.
  - Explosión: al romper un bloque se encola un destello procedural corto (rectángulo que se expande
    y se desvanece, `~150 ms`), sin spritesheet.
  - `initBall()` recoloca la bola sobre la paleta tras perder una vida (como el referente).
  - Contrato de la clase (ver Data model): `constructor(canvas)`, `start()`, `stop()`, `destroy()`,
    `restart()`, `setPaused()` / `togglePause()`, `resize(cssW, cssH, dpr)`, `setOnGameOver(cb)`,
    `setInput(action, pressed)`.
  - Input: `←` `→` (o los botones táctiles `left` / `right`) mueven la paleta **mientras estén
    pulsados** a `PADDLE_SPEED` px/s. No hay disparo ni lanzamiento manual: la bola sale sola, como
    en el referente.
  - Fin de partida: `state = "gameover"` + `onGameOver({ score, level })` **una sola vez** cuando
    `lives` llega a 0 **o** cuando se limpian todos los bloques del nivel 5. `level` = `currentLevel`
    en ese instante (1–5). Al limpiar un nivel < 5, `loadLevel(currentLevel + 1)` conserva el `score`.
  - `Escape` / `KeyP` durante la partida alternan pausa; el motor **no** pinta "GAME OVER" ni
    "¡Completaste el juego!"; el overlay de pausa **no** lleva selector de nivel.
- `app/components/games/arkanoid/arkanoid-player.tsx` (nuevo, `"use client"`) — envoltorio fino, copia
  de `app/components/games/asteroids/asteroids-player.tsx` con `GAME_ID = "bloque-buster"` y la clase
  `ArkanoidGame`:
  - Marco CRT (`.crt` / `.crt-screen` / `.crt-bottom`), `<canvas className="arkanoid-canvas"
width={800} height={600}>` dentro de `.arkanoid-stage`.
  - `useEffect` de montaje: guard StrictMode (`gameRef.current?.destroy()`), `new ArkanoidGame(canvas)`,
    `game.setOnGameOver(setOver…)`, `ResizeObserver` → `game.resize(rect.width, rect.height, dpr)`,
    `game.start()`, `visibilitychange` → `game.setPaused(document.hidden)`, `keydown` con
    `preventDefault` de `ArrowUp/ArrowDown/ArrowLeft/ArrowRight/Space` (salvo si se escribe en un
    input) y `Escape`/`KeyP` → `togglePause()`, `Space` → cerrar el overlay. Cleanup: `game.destroy()`.
  - Overlay `.modal-bd` / `.modal` (reutiliza las clases de `globals.css`) con "FIN DEL JUEGO",
    puntuación final (`toLocaleString("es-ES")`), input de iniciales
    (`e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 12)`), botón `GUARDAR
PUNTUACIÓN` → `submitScore({ gameId: "bloque-buster", name, score, level })`, botón `JUGAR DE
NUEVO` → `game.restart()` + cerrar overlay, enlace `VOLVER` a `/juego/bloque-buster`. Estados
    `idle | saving | saved | error` con "▸ PUNTUACIÓN GUARDADA_" y mensaje de error legible.
  - `crt-bottom`: etiqueta `BLOQUE BUSTER · CRT-83 · 60 HZ` y `ARKANOID`.
  - Monta `<ArkanoidTouchControls onInput={handleInput} />`.
- `app/components/games/arkanoid/touch-controls.tsx` (nuevo, `"use client"`) — copia de
  `asteroids/touch-controls.tsx` con 2 botones. `TouchAction = "left" | "right"`, ambos booleanos
  sostenidos. `pointerdown` → `onInput(action, true)`; `pointerup` / `pointercancel` / `pointerleave`
  → `false`; `e.preventDefault()` en cada handler. Visibles solo bajo `@media (pointer: coarse)`.
- `app/components/games/registry.ts` — añadir `"bloque-buster": ArkanoidPlayer` a `REAL_GAME_PLAYERS`.
- `app/globals.css` — anexar al final el bloque `/* ===== juego: arkanoid (bloque-buster) ===== */`:
  - `.arkanoid-stage` (`position: absolute; inset: 0; background: #000;`).
  - `.arkanoid-canvas` (`display: block; width: 100%; height: 100%; object-fit: contain;
touch-action: none;`).
  - `.arkanoid-touch` (`position: absolute; inset: 0; display: none; pointer-events: none;
z-index: 4;`) + `@media (pointer: coarse) { .arkanoid-touch { display: block; } }` +
    `.arkanoid-touch-btn` con las 2 variantes de posición (`.left` abajo-izquierda, `.right`
    abajo-derecha).
  - **No** añade ningún `.cover-*` — `.cover-bricks` ya existe (línea ~692) y es el que usa
    `bloque-buster`.
  - **No** redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`,
    `.hall-table*`, `.leaderboard`, `.lb-row`, `.lb-empty`.
- `CLAUDE.md` — "Stack notes": actualizar la línea de leaderboards ("hoy: `rocas` y `caida`" → "hoy:
  `rocas`, `caida` y `bloque-buster`") y la de "Real games" (añadir `arkanoid` → `bloque-buster`).
- Revisión visual con Playwright MCP: screenshots en `.playwright-screenshots/` de
  `/juego/bloque-buster/jugar` (inicio, partida en curso, overlay de guardado), `/juego/bloque-buster`
  (aside con datos y vacío) y `/salon` (tab `BLOQUE BUSTER` con datos y vacía), en escritorio y
  ~390 px. Verificar que `/juego/rocas` y `/juego/caida` siguen funcionando y que otro juego simulado
  (p. ej. `/juego/serpentina`) sigue con `seededScores`.

**Out of scope (para futuras specs):**

- El spritesheet `spritesheet-breakout.png` y los dos MP3 (`ball-bounce.mp3`, `break-sound.mp3`) del
  referente. El motor no carga assets ni reproduce audio.
- Control de la paleta con el ratón (el patrón de la plataforma es teclado + botones táctiles).
- El selector "saltar a nivel" del overlay de pausa.
- Ladrillos multi-impacto, ladrillos indestructibles, power-ups (paleta larga, multibola, láser),
  niveles más allá de los 5 del referente.
- Auth real / columna `user_id` en `scores` (el leaderboard sigue siendo anónimo por iniciales).
- Recalcular `games.best` / `games.plays` desde datos reales (siguen siendo columnas mock estáticas).
- Portar los otros 5 juegos simulados a motor real.
- Marcas reales en la home; Realtime / paginación del leaderboard.
- Ajustar los tags hardcodeados de `/juego/bloque-buster` ("1 JUGADOR", estrellas de dificultad).
- Tests automatizados (no hay runner).

---

## Data model

La tabla `scores` no cambia (definida en SPEC 06). El único estado nuevo es el del motor, en memoria
y por partida.

```ts
// engine.ts
type GameState = "playing" | "gameover";
export type TouchAction = "left" | "right";
export interface GameOverResult {
  score: number;
  level: number;
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string; // token de la paleta neon
  alive: boolean;
}

interface Burst {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number; // ms
}

class ArkanoidGame {
  private paddle = { x: 0, y: 560, w: 81, h: 14 };
  private ball = { x: 0, y: 0, w: 16, h: 16, vx: 0, vy: 0 };
  private blocks: Block[] = [];
  private bursts: Burst[] = [];
  private score = 0;
  private lives = 3;
  private currentLevel = 1;
  private state: GameState = "playing";
  private paused = false;
  private gameOverNotified = false;

  private keys: Record<string, boolean> = {};
  private touch: Record<TouchAction, boolean> = { left: false, right: false };

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

Constantes portadas de `game.js` (coordenadas origen arriba-izquierda; el motor dibuja siempre en
`0..800 × 0..600`):

| Concepto            | Valor                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Paleta              | `w = 81`, `h = 14`, `y = 560`, `PADDLE_SPEED = 400` px/s                  |
| Bola                | `w = h = 16`, `BASE_BALL_VX = 200`, `BASE_BALL_VY = -300`                 |
| Grilla de bloques   | `BLOCK_COLS = 10`, `BLOCK_ROWS = 6`, `BLOCK_W = 64`, `BLOCK_H = 24`       |
| Origen de la grilla | `BLOCKS_ORIGIN_X = (800 - 10 * 64) / 2 = 80`, `BLOCKS_ORIGIN_Y = 80`      |
| Puntos              | `+10` por bloque destruido (no hay bono por completar nivel)              |
| Vidas               | `3`; al caer la bola `lives--` y `initBall()` la recoloca sobre la paleta |
| Niveles             | 5 (`LEVELS` de `levels.js`); `speed` multiplica `BASE_BALL_V*` por nivel  |
| Velocidad por nivel | `×1.00`, `×1.10`, `×1.21`, `×1.33`, `×1.46`                               |
| Destello de ruptura | rectángulo que se expande y se desvanece, `~150 ms`                       |

Invariantes internos (heredados del patrón de SPEC 05 / SPEC 07):

- Loop: `dt = Math.min((ts - last) / 1000, 0.05)`; `if (!paused) update(dt); draw();` y re-`rAF`.
- `onKeyDown` / `onKeyUp` son campos arrow-fn (para quitarlos en `stop()`), con guard
  `isFormFieldFocused(e.target)` para no capturar el teclado mientras se escriben las iniciales.
- Fin de partida: `state = "gameover"` + `if (!gameOverNotified) { gameOverNotified = true;
onGameOver?.({ score, level: currentLevel }); }`. `gameOverNotified` se resetea en `initGame()`
  para que `restart()` lo re-arme.
- `resize()`: `targetAspect = 800 / 600`; tras ajustar `canvas.width/height` a `tamaño * dpr` con esa
  proporción, `ctx.setTransform(pxW / 800, 0, 0, pxH / 600, 0, 0)`.
- `"left"` / `"right"` en `setInput` son booleanos sostenidos que se combinan con
  `keys["ArrowLeft"]` / `keys["ArrowRight"]` en `update()`.
- Colisión de bloques: como en el referente, **un bloque por frame** (`break` tras el primer
  impacto); `ball.vy = -ball.vy`.
- Al quedar `blocks.every(b => !b.alive)`: si `currentLevel < 5` → `loadLevel(currentLevel + 1)`
  (conserva `score`); si `currentLevel === 5` → fin de partida.

```ts
// registry.ts
export const REAL_GAME_PLAYERS: Record<
  string,
  ComponentType<{ title: string }>
> = {
  rocas: AsteroidsPlayer,
  caida: TetrisPlayer,
  "bloque-buster": ArkanoidPlayer,
};
```

### Mapa de archivos tras esta spec

| Archivo                                                   | Tipo               | Cambio                         |
| --------------------------------------------------------- | ------------------ | ------------------------------ |
| `supabase/migrations/08-juego-arkanoid-bloque-buster.sql` | migración SQL      | nuevo (aplicado vía MCP)       |
| `app/lib/supabase/database.types.ts`                      | tipos generados    | regenerado                     |
| `app/components/games/arkanoid/engine.ts`                 | motor (agnóstico)  | nuevo                          |
| `app/components/games/arkanoid/arkanoid-player.tsx`       | client component   | nuevo                          |
| `app/components/games/arkanoid/touch-controls.tsx`        | client component   | nuevo                          |
| `app/components/games/registry.ts`                        | mapa id→componente | `+1` entrada (`bloque-buster`) |
| `app/globals.css`                                         | estilos            | `+` bloque `.arkanoid-*`       |
| `CLAUDE.md`                                               | doc                | "Stack notes"                  |

`app/lib/games.ts`, `app/lib/scores.ts`, `app/lib/scores-actions.ts`, `app/lib/supabase/public.ts`,
`app/lib/home.ts`, `app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx`, `app/salon/page.tsx`,
`app/components/hall-of-fame.tsx`, `player-screen.tsx`, `asteroids/*` y `tetris/*` **no se tocan** —
ya son agnósticos del juego: todo va por `game_id` + `has_leaderboard`. `bloque-buster` ya está en
`FALLBACK_GAME_IDS`, así que ese archivo no cambia.

---

## Implementation plan

1. **Migración + tipos.** Escribir `supabase/migrations/08-juego-arkanoid-bloque-buster.sql` con
   `update public.games set has_leaderboard = true where id = 'bloque-buster';`. Aplicar con
   `mcp__supabase__apply_migration`. Regenerar `app/lib/supabase/database.types.ts`. Verificación:
   `mcp__supabase__list_tables` muestra `bloque-buster` con `has_leaderboard = true`;
   `mcp__supabase__list_migrations` incluye `08`; `mcp__supabase__get_advisors` (security) no reporta
   nada crítico nuevo (el insert anónimo en `scores` es el hallazgo esperado de SPEC 06); un `insert`
   de prueba vía `mcp__supabase__execute_sql` con `game_id = 'bloque-buster'` y datos válidos se
   acepta, y con `game_id = 'serpentina'` se rechaza; `npm run build` compila (la app aún usa el
   `PlayerScreen` para `bloque-buster` en este punto).

2. **Esqueleto del motor + dispatch.** Crear `app/components/games/arkanoid/engine.ts` con la clase
   `ArkanoidGame` mínima: `constructor`, `start`/`stop`/`destroy`/`restart`, `setPaused`/`togglePause`,
   `resize`, `setOnGameOver`, `setInput`, y un loop `rAF` que solo pinta el canvas de negro. Crear
   `app/components/games/arkanoid/arkanoid-player.tsx` (marco `.crt` + `<canvas
className="arkanoid-canvas">` + `useEffect` que monta/destruye el motor + `ResizeObserver` +
   enlace `VOLVER`, sin overlay todavía). Añadir `"bloque-buster": ArkanoidPlayer` a `registry.ts`.
   Verificación: `/juego/bloque-buster/jugar` muestra un canvas negro dentro del marco CRT;
   `/juego/serpentina/jugar` sigue mostrando `PlayerScreen`; `npm run build` y `npm run lint` pasan.

3. **Niveles + lógica de partida + teclado + dibujo.** Portar a `engine.ts`: las constantes, `LEVELS`
   (5 patrones de `levels.js`), `initPaddle` / `initBall` / `loadLevel` / `collideAABB` / `update(dt)`
   con el movimiento de paleta, el movimiento y rebotes de la bola (paredes, paleta, bloques uno por
   frame), la pérdida de vida y el avance/fin de nivel. `draw()` pinta fondo, bloques (paleta neon),
   destellos de ruptura, paleta, bola y el HUD (`SCORE` a la izquierda, `NIVEL` centrado, vidas como
   iconos a la derecha) en canvas. `start()` engancha `keydown`/`keyup`; `stop()` los quita. `←` `→`
   sostenidos mueven la paleta. `setOnGameOver` se dispara al llegar a 0 vidas o al limpiar el nivel 5. El motor **no** pinta "GAME OVER" ni el mensaje de victoria; `Escape`/`P` pausan con overlay
   "EN PAUSA" (sin selector de nivel). Verificación manual con teclado en 800×600 fijo: mover la
   paleta, rebotes correctos, romper bloques (`+10`, uno por frame), perder vidas y recolocar la
   bola, subir de nivel al limpiar la grilla y notar la aceleración, disparo del callback a 0 vidas y
   al completar el nivel 5. Navegar fuera a media partida no deja `requestAnimationFrame` huérfano ni
   errores.

4. **Escalado responsive + táctiles.** `resize(cssW, cssH, dpr)` con `targetAspect = 800/600` y
   `ctx.setTransform`. En `arkanoid-player.tsx`, `.arkanoid-stage` + `ResizeObserver` que llama a
   `resize`. Crear `touch-controls.tsx` con los 2 botones (`◄` `►`) cableados a `game.setInput()`;
   `update()` combina `keys` + `touch`. Añadir el bloque `.arkanoid-*` a `globals.css`. Verificación:
   el juego llena el marco CRT en escritorio y a ~390 px sin deformarse, nítido con
   `devicePixelRatio > 1`, sin scroll horizontal; en viewport táctil (`pointer: coarse`) los 2
   botones mueven la paleta y en escritorio no se ven; las flechas no hacen scroll de la página.

5. **Guardado real.** En `arkanoid-player.tsx`: overlay `.modal` con "FIN DEL JUEGO", puntuación
   final, input de iniciales (filtro `[A-Za-z0-9_]`, máx 12, mayúsculas) y los tres botones;
   `submitScore({ gameId: "bloque-buster", name, score, level })`; estados guardando (botón
   deshabilitado) / "▸ PUNTUACIÓN GUARDADA_" / error legible sin romper el canvas; `JUGAR DE NUEVO` →
   `game.restart()` + `setOver(null)`. Verificación manual en `/juego/bloque-buster/jugar`: terminar
   la partida (perder o completar el nivel 5), escribir `TEST_1`, `GUARDAR`, ver la fila en el aside
   de `/juego/bloque-buster` y en la tab `BLOQUE BUSTER` de `/salon` (revalidación inmediata por
   `revalidatePath`); un nombre vacío / inválido y un fallo de red muestran mensaje legible; `JUGAR
DE NUEVO` reinicia sin recargar la página.

6. **Docs, CSS final y revisión visual.** Actualizar "Stack notes" de `CLAUDE.md` (roster de
   leaderboards y "Real games"). `npm run lint` y `npm run build` limpios; quitar imports / `console`
   sin usar. Screenshots con Playwright MCP en `.playwright-screenshots/` de
   `/juego/bloque-buster/jugar` (inicio, en curso, overlay de guardado), `/juego/bloque-buster`
   (aside con datos y vacío) y `/salon` (tab `BLOQUE BUSTER` con datos y vacía), en escritorio y
   ~390 px. Verificar que `/juego/rocas`, `/juego/caida` y `/juego/serpentina` no han cambiado de
   comportamiento. Commitear el bloque gestionado de `AGENTS.md` / `CLAUDE.md` si `next dev` lo
   reescribió.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `npm run lint` sin errores ni warnings.
- [ ] `app/components/games/arkanoid/engine.ts` no importa nada de `react` ni de `next`.
- [ ] `mcp__supabase__list_tables` muestra `public.games` con la fila `bloque-buster` y
      `has_leaderboard = true`; `mcp__supabase__list_migrations` incluye la migración `08`.
- [ ] `supabase/migrations/08-juego-arkanoid-bloque-buster.sql` existe en el repo con el mismo SQL
      aplicado.
- [ ] Insertar en `scores` una fila con `game_id = 'serpentina'` vía API `anon` es rechazado por la
      política; con `game_id = 'bloque-buster'` y datos válidos, se acepta.
- [ ] `/juego/bloque-buster/jugar` renderiza un `<canvas>` dentro del marco CRT (`.crt` /
      `.crt-screen` / `.crt-bottom`), sin HUD React.
- [ ] `/juego/serpentina/jugar` (y el resto de ids sin motor real) sigue mostrando `PlayerScreen` con
      el contador simulado; `/juego/rocas/jugar` y `/juego/caida/jugar` siguen con sus motores.
- [ ] `generateStaticParams` de `/juego/[id]` y `/juego/[id]/jugar` sigue generando las 8 rutas del
      catálogo; ningún id existente da 404.
- [ ] Teclado: `←` y `→` mueven la paleta mientras están pulsados; soltar la tecla la detiene.
- [ ] La bola rebota en las tres paredes (izquierda, derecha, techo) y en la paleta; caer por abajo
      resta una vida y recoloca la bola sobre la paleta.
- [ ] Romper un bloque suma exactamente `+10` puntos, reflejados en el HUD, y produce un destello
      procedural corto (sin spritesheet).
- [ ] Al limpiar todos los bloques de un nivel < 5 se carga el siguiente nivel conservando el
      `score`, y la bola va más rápida (`×1.10` … `×1.46`).
- [ ] Al llegar a 0 vidas **o** al limpiar todos los bloques del nivel 5, el motor entra en
      `gameover` y dispara `onGameOver` **una sola vez** con `{ score, level }` (`level` = nivel
      alcanzado, 1–5).
- [ ] El canvas **no** dibuja el texto "GAME OVER" ni "¡Completaste el juego!"; al terminar aparece
      un overlay React (`.modal`) con la puntuación final y un input de iniciales.
- [ ] El input de iniciales solo acepta `[A-Za-z0-9_]`, máximo 12, y lo muestra en mayúsculas.
- [ ] `GUARDAR PUNTUACIÓN` con un nombre válido inserta una fila en `scores` (`game_id =
    'bloque-buster'`, `score` y `level` de la partida) y muestra "PUNTUACIÓN GUARDADA"; la fila
      aparece luego en `/juego/bloque-buster` y `/salon` tab `BLOQUE BUSTER`.
- [ ] `submitScore` con nombre inválido, o con Supabase caído, devuelve `{ ok: false, error }` y el
      overlay muestra el mensaje sin romper el juego.
- [ ] `JUGAR DE NUEVO` en el overlay reinicia la partida vía `game.restart()` sin recargar la página.
- [ ] Con `scores` sin filas de `bloque-buster`: la tab `BLOQUE BUSTER` de `/salon` y el aside de
      `/juego/bloque-buster` muestran el estado vacío `.lb-empty` en vez de podio / filas.
- [ ] El canvas escala manteniendo proporción 4:3, se ve nítido con `devicePixelRatio > 1`, y la
      página no tiene scroll horizontal a ~390 px.
- [ ] Con las flechas durante la partida, la página no hace scroll.
- [ ] En viewport táctil (`pointer: coarse`) se ven 2 botones que mueven la paleta izq/der; en
      escritorio no se muestran.
- [ ] `Escape` o `P` alternan pausa con un overlay "EN PAUSA" en el canvas (sin selector de nivel);
      cambiar de pestaña pausa.
- [ ] Navegar fuera de `/juego/bloque-buster/jugar` a media partida no deja errores en consola ni un
      `requestAnimationFrame` activo.
- [ ] El juego no usa `localStorage` ni IndexedDB, no carga `spritesheet-breakout.png` ni ningún
      audio; la única petición de red es `submitScore`.
- [ ] Invariante: `games.has_leaderboard = true` para `bloque-buster` ⇔ `bloque-buster` está en
      `REAL_GAME_PLAYERS`.
- [ ] `app/globals.css` solo añade el bloque `.arkanoid-*`; no añade ningún `.cover-*` nuevo y no
      redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`, `.hall-table*`,
      `.leaderboard`, `.lb-row` ni `.lb-empty`.
- [ ] Hay screenshots en `.playwright-screenshots/` de `/juego/bloque-buster/jugar`,
      `/juego/bloque-buster` y `/salon` tab `BLOQUE BUSTER` (con datos y vacío), en escritorio y
      ~390 px.
- [ ] `CLAUDE.md` "Stack notes" menciona que `bloque-buster` (Arkanoid) tiene motor real y
      `has_leaderboard`.

---

## Decisions

- **Sí:** reutilizar la entrada `bloque-buster` del catálogo y solo hacer `update … set
has_leaderboard = true`. Ya es temáticamente breakout (`ARCADE`, `cover-bricks`, cyan) y su
  `short` / `long` describen este juego. **No:** crear un `id` nuevo `arkanoid` — duplicaría la
  temática y dejaría `bloque-buster` como juego simulado huérfano.
- **Sí:** las dos features (motor real + leaderboard) en la misma spec, como hicieron SPEC 06 para
  `rocas` y SPEC 07 para `caida`. `has_leaderboard = true` solo tiene sentido con un juego en
  `REAL_GAME_PLAYERS`.
- **Sí:** render **procedural en la paleta neon**, sin assets. Es coherente con `rocas` y `caida`,
  evita meter binarios en `public/` y mantiene el juego sin peticiones de red. **No:** portar
  `spritesheet-breakout.png` ni los dos MP3 — más superficie (loader, autoplay de audio, assets) para
  cero ganancia de plataforma.
- **Sí:** espacio interno **800×600 (4:3)**, igual que el referente y que `rocas`. Encaja en el marco
  CRT sin bandas y la grilla 10×6 cabe tal cual. **No:** 600×800 vertical — dejaría bandas laterales
  y obligaría a re-maquetar la grilla.
- **Sí:** portar **los 5 niveles** de `levels.js` con su multiplicador de velocidad. Dan progresión
  real a la partida y ya están definidos. **No:** el selector "saltar a nivel" del overlay de pausa
  (era debug), ni un bucle infinito procedural (se aleja del referente).
- **Sí:** controles táctiles con **2 botones** (`◄` `►`), sostenidos, gated por `(pointer: coarse)`,
  igual que en `rocas` y `caida`. Sin ellos el juego es injugable en móvil. **No:** control por
  arrastre sobre el canvas ni control con ratón — el patrón de la plataforma es teclado + botones.
- **Sí:** `scores.level` reporta el **nivel alcanzado** (`currentLevel`, 1–5). Es barato, ya lo lleva
  el motor y da contexto a la marca, igual que el `level` de `rocas` y `caida`.
- **Sí:** la partida termina **al perder las 3 vidas o al completar el nivel 5**; ambos disparan
  `onGameOver` una sola vez y abren el mismo overlay de guardado. **No:** un mensaje de victoria en
  canvas que no guarda — el jugador que se termina el juego también quiere su marca.
- **Sí:** la bola sale sola tras perder una vida (`initBall()`), como el referente. **No:**
  lanzamiento manual con una tecla — añade estado y una acción táctil para poca ganancia.
- **No:** tocar `PlayerScreen`, la arena CSS decorativa, `CATS`, `FALLBACK_GAME_IDS`,
  `fallbackGame()`, los tags hardcodeados de `/juego/bloque-buster` ni la infraestructura de `scores`
  / catálogo. Los 5 juegos simulados restantes siguen igual hasta su propia spec.

---

## Risks

| Riesgo                                                                          | Mitigación                                                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `requestAnimationFrame` no cancelado al navegar → loop huérfano                 | `destroy()` en el cleanup del `useEffect`; criterio de aceptación dedicado (heredado de SPEC 05).            |
| React StrictMode monta el efecto dos veces en dev → doble motor                 | `gameRef.current?.destroy()` al principio del efecto; `destroy()` idempotente.                               |
| `has_leaderboard` y `REAL_GAME_PLAYERS` se desincronizan                        | Se registran en la misma rama; invariante fijado en criterios de aceptación.                                 |
| `get_advisors` marca el `insert` anónimo de `scores`                            | Intencional y heredado de SPEC 06; revisar que no haya **otros** hallazgos.                                  |
| La bola atraviesa un bloque o la paleta a alta velocidad (nivel 5, `dt` grande) | `dt` capado a 50 ms; colisión AABB por frame como el referente; la revisión manual del nivel 5 lo comprueba. |
| Doble disparo de `onGameOver` (StrictMode, fin de nivel 5 + 0 vidas a la vez)   | Flag `gameOverNotified`, reseteado en `initGame()`; `restart()` lo re-arma.                                  |
| `preventDefault` de las flechas afecta a otras rutas                            | Solo se engancha mientras el juego está montado y se quita en el cleanup; guard `isFormFieldFocused`.        |
| El HUD y los bloques en la paleta neon quedan ilegibles a ~390 px               | Texto con `var(--pixel)` a tamaño legible; la revisión visual con Playwright a 390 px lo verifica.           |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`          | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                                    |

---

## Lo que **no** entra en esta spec

- El spritesheet `spritesheet-breakout.png` y los sonidos del referente; audio y música.
- Control con ratón y control por arrastre sobre el canvas.
- El selector "saltar a nivel" del overlay de pausa.
- Ladrillos multi-impacto o indestructibles, power-ups, niveles más allá de los 5.
- Auth real, columna `user_id` en `scores`, tabla `profiles`.
- Recalcular `games.best` / `games.plays` desde datos reales.
- Portar los otros 5 juegos simulados a motor real.
- Marcas reales en la home; Realtime o paginación en el leaderboard.
- Retocar los tags hardcodeados de `/juego/bloque-buster`.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
