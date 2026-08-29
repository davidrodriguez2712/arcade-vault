# Forma de la spec generada por /add-game

Esto es **contenido de dominio** para rellenar una spec de "juego nuevo + leaderboard", no un formato.
La **estructura, el header, la numeración y el estilo** los manda el método de `/spec`: lee
`.agents/skills/spec/template.md` y las specs existentes de `specs/` (sobre todo `05-*` y `06-*`) y
haz que la spec nueva se lea como una más de esa serie. Si algo de aquí choca con la forma real de las
specs del repo, gana la del repo.

Marcadores a sustituir:

| Marcador   | Significado                                                                   | Ejemplo                              |
| ---------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| `<NN>`     | número de spec, dos dígitos                                                   | `07`                                 |
| `<SLUG>`   | `id` del juego en la tabla `games` (columna `id`, y `cover` = `cover-<SLUG>`) | `caida`                              |
| `<DIR>`    | carpeta del componente en `app/components/games/`                             | `tetris`                             |
| `<Nombre>` | nombre visible del juego                                                      | `Tetris`                             |
| `<W>x<H>`  | espacio interno de coordenadas del motor                                      | `300x600`                            |
| `<REF>`    | carpeta de referencia, o "desde cero"                                         | `references/started-games/03-tetris` |

Si el juego **no** lleva leaderboard, quita todo lo marcado como `[solo con leaderboard]` y no toques
`has_leaderboard`, `scores`, `submitScore` ni el overlay de guardado.

---

## Header

```markdown
# SPEC <NN> — <Nombre> en la entrada `<SLUG>` con leaderboard

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 05, SPEC 06
> **Fecha:** <date +%F>
> **Objetivo:** Portar <Nombre> (<REF>) a un motor TypeScript agnóstico de framework montado en el marco CRT del reproductor, conectado a la entrada de catálogo `<SLUG>`, con guardado real de puntuaciones bajo RLS.
```

---

## Por qué existe esta spec

- Estado de partida: la entrada `<SLUG>` hoy usa `PlayerScreen` simulado / no existe todavía.
- SPEC 05 fijó el patrón "motor `engine.ts` sin React/Next + envoltorio `"use client"` fino,
  registrado en `app/components/games/registry.ts`". SPEC 06 añadió la tabla `scores`, la RLS de
  `insert` anónimo condicionada a `games.has_leaderboard`, y el overlay React de guardado.
- Esta spec aplica ambos patrones a `<SLUG>` sin cambiar nada de la infraestructura compartida
  (`app/lib/scores.ts`, `scores-actions.ts`, `supabase/public.ts`, `/juego/[id]/*`, `/salon` ya son
  agnósticos del juego: todo va por `game_id` + `has_leaderboard`).

---

## Scope

**In:**

- `supabase/migrations/<NN>-<slug>.sql` (nuevo) — aplicado con `mcp__supabase__apply_migration`.
  Contiene **una** de estas dos cosas:
  - Si `<SLUG>` es una fila nueva del catálogo:
    `insert into public.games (id, title, short, long, cat, cover, color, best, plays, sort_order, has_leaderboard) values ('<SLUG>', …, 'cover-<SLUG>', …, <sort_order>, true);`
  - Si `<SLUG>` ya existe: `update public.games set has_leaderboard = true where id = '<SLUG>';`
  - La tabla `scores` **ya existe** desde SPEC 06 — no se recrea ni se toca su RLS.
- `app/lib/supabase/database.types.ts` — regenerado con `mcp__supabase__generate_typescript_types`
  tras aplicar la migración.
- `app/lib/games.ts` — **solo si `<SLUG>` es nuevo**: añadir `'<SLUG>'` a `FALLBACK_GAME_IDS` y
  ampliar `fallbackGame()` para que `hasLeaderboard` sea `true` también para `'<SLUG>'`
  (hoy es `id === "rocas"`). Si `<SLUG>` ya existía, este archivo no se toca.
- `app/components/games/<DIR>/engine.ts` (nuevo) — motor portado de `<REF>`, **sin ninguna importación
  de React ni de Next**. Clase `<Nombre>Game` con el contrato de la sección Data model. Dibuja siempre
  en el espacio interno fijo `<W>x<H>`; el escalado responsive vive solo en `resize()`. `dt` capado a
  50 ms. El motor **no** pinta el texto de "GAME OVER" (lo pone el overlay React); sí pinta el HUD, el
  campo y el overlay "EN PAUSA".
- `app/components/games/<DIR>/<DIR>-player.tsx` (nuevo, `"use client"`) — envoltorio fino. Marco CRT
  (`.crt` / `.crt-screen` / `.crt-bottom`), `<canvas>` dentro de `.<DIR>-stage`. `useEffect` de montaje:
  guard StrictMode (`gameRef.current?.destroy()`), `new <Nombre>Game(canvas)`, `setOnGameOver`,
  `ResizeObserver` → `game.resize(rect.width, rect.height, dpr)`, `game.start()`,
  `visibilitychange` → `game.setPaused(document.hidden)`, `keydown` con `preventDefault` de las teclas
  de scroll y `Escape`/`KeyP` → `togglePause()`. Cleanup: `game.destroy()`.
  `[solo con leaderboard]` Overlay `.modal-bd` / `.modal` con "FIN DEL JUEGO", puntuación final, input
  de iniciales (filtro `e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 12)`), botón
  `GUARDAR PUNTUACIÓN` → `submitScore({ gameId: "<SLUG>", name, score, level })`, botón `JUGAR DE
NUEVO` → `game.restart()` + cerrar overlay, enlace `VOLVER` a `/juego/<SLUG>`. Estados
  `idle | saving | saved | error` con mensaje legible si `submitScore` falla.
- `app/components/games/<DIR>/touch-controls.tsx` (nuevo) — `[si el juego usa táctiles]` N botones
  superpuestos, `pointerdown` → `game.setInput(action, true)`, `pointerup`/`pointercancel`/
  `pointerleave` → `false`, `e.preventDefault()` en cada handler. Visibles solo bajo
  `@media (pointer: coarse)`.
- `app/components/games/registry.ts` — añadir `<SLUG>: <Nombre>Player` a `REAL_GAME_PLAYERS`.
- `app/globals.css` — anexar al final:
  - `.cover-<SLUG>` (+ `::before` / `::after` a gusto) junto a los demás `.cover-*` — arte de portada
    de puro CSS. El nombre de la clase debe ser igual al valor de la columna `cover`.
  - Bloque `/* ===== juego: <DIR> (<SLUG>) ===== */` con `.<DIR>-stage` (`position: absolute; inset: 0;
background: #000`), `.<DIR>-canvas` (`width: 100%; height: 100%; object-fit: contain;
touch-action: none`) y, si hay táctiles, `.<DIR>-touch` (`display: none` → `display: block` bajo
    `@media (pointer: coarse)`) + `.<DIR>-touch-btn`.
  - **No** redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`, `.hall-table*`,
    `.leaderboard`, `.lb-row`, `.lb-empty`.
- `CLAUDE.md` — "Stack notes": si el roster de juegos con `has_leaderboard` cambia, actualizar la
  frase (hoy "today: `rocas` only").
- Revisión visual con Playwright MCP: screenshots en `.playwright-screenshots/` de
  `/juego/<SLUG>/jugar` (inicio, partida, GAME OVER + overlay de guardado), `/juego/<SLUG>` (aside con
  datos y vacío) y `/salon` (tab de `<SLUG>` con datos y vacía), en escritorio y ~390 px. Verificar
  que otro juego simulado (p. ej. `/juego/caida` si no es este) sigue con `seededScores`.

**Out of scope (para futuras specs):**

- <lo que respondió el usuario en la Fase 1: sonido, más niveles, sprites, modos de juego…>
- Auth real / columna `user_id` en `scores` (el leaderboard sigue siendo anónimo por iniciales).
- Recalcular `games.best` / `games.plays` desde datos reales (siguen siendo columnas mock estáticas).
- Portar los otros juegos del catálogo a motor real.
- Realtime / paginación del leaderboard.
- Tests automatizados (no hay runner).

---

## Data model

La tabla `scores` no cambia (definida en SPEC 06). El único estado nuevo es el del motor, en memoria.

Contrato TS del motor (clase `<Nombre>Game` en `engine.ts`):

```ts
type GameState = "playing" | "dead" | "gameover";
type TouchAction = /* unión de acciones táctiles del juego, o se omite si no hay táctiles */;
interface GameOverResult { score: number; level: number; }

class <Nombre>Game {
  constructor(canvas: HTMLCanvasElement);   // toma canvas + 2d ctx; no arranca nada; throw si no hay ctx
  start(): void;                            // initGame(), engancha keydown/keyup en window, lanza rAF. Idempotente.
  stop(): void;                             // cancela rAF + quita listeners. Estado conservado.
  destroy(): void;                          // stop() + onGameOver = null. Idempotente.
  restart(): void;                          // initGame() de nuevo
  setPaused(paused: boolean): void;         // pausa lógica: el loop pinta pero no actualiza
  togglePause(): void;                      // ignora el toggle si state === "gameover"
  resize(cssWidth: number, cssHeight: number, dpr: number): void;   // backing store + ctx.setTransform sobre <W>x<H>
  setOnGameOver(cb: (r: GameOverResult) => void): void;             // se dispara UNA vez por partida, al perder
  setInput(action: TouchAction, pressed: boolean): void;            // [si hay táctiles] combina con el teclado
}
```

Invariantes internos:

- Loop: `dt = min((ts - last) / 1000, 0.05)`; `if (!paused) update(dt); draw();` y re-`requestAnimationFrame`.
- `onKeyDown` / `onKeyUp` son campos arrow-fn (para poder quitarlos en `stop()`), con guard
  `isFormFieldFocused(e.target)` para no capturar el teclado mientras se escriben las iniciales.
- El aviso de fin de partida se dispara una sola vez (flag `gameOverNotified`, reseteado en
  `initGame()` para que `restart()` lo re-arme).
- `resize()`: `ctx.setTransform(pxW / <W>, 0, 0, pxH / <H>, 0, 0)` tras ajustar `canvas.width/height`.

Convenciones: origen arriba-izquierda; el motor dibuja siempre en `<W>x<H>` sin enterarse del tamaño
real de la pantalla.

---

## Implementation plan

Cada paso deja el sistema compilando y es commitable por separado.

1. **Migración + tipos.** Escribir `supabase/migrations/<NN>-<slug>.sql` (fila nueva en `games` con
   `has_leaderboard = true`, **o** `update … set has_leaderboard = true` si `<SLUG>` ya existe).
   Aplicar con `mcp__supabase__apply_migration`. Regenerar `app/lib/supabase/database.types.ts`.
   `[solo si `<SLUG>` es nuevo]` Añadir `'<SLUG>'` a `FALLBACK_GAME_IDS` y ampliar `fallbackGame()`.
   Verificación: `mcp__supabase__list_tables` muestra la fila con `has_leaderboard = true`;
   `mcp__supabase__list_migrations` incluye `<NN>`; `get_advisors` no reporta nada crítico nuevo;
   `npm run build` compila.

2. **Esqueleto del motor + dispatch.** Crear `app/components/games/<DIR>/engine.ts` con la clase
   `<Nombre>Game` mínima: constructor, `start`/`stop`/`destroy`/`restart`, `setPaused`/`togglePause`,
   `resize`, `setOnGameOver`, `setInput`, y un loop rAF que solo pinta el canvas de negro. Crear
   `app/components/games/<DIR>/<DIR>-player.tsx` (marco CRT + `<canvas>` + `useEffect` que monta/
   destruye el motor + `ResizeObserver` + enlace `VOLVER`). Registrar en `registry.ts`.
   Verificación: `/juego/<SLUG>/jugar` muestra un canvas negro dentro del marco CRT; otro juego
   simulado sigue con `PlayerScreen`; `npm run build` pasa.

3. **Entidades + lógica de partida + teclado.** Portar de `<REF>` las clases/estructuras, las
   constantes y las funciones `initGame` / `update(dt)` / `draw()` con HUD en canvas. `start()`
   engancha `keydown`/`keyup`; `stop()` los quita. `resize()` con `ctx.setTransform`. `dt` capado a
   50 ms. El motor **no** pinta "GAME OVER". `setOnGameOver` se dispara al perder la última vida.
   Verificación manual con teclado: jugar, perder, ver que se dispara el callback, `restart()`
   reinicia. Navegar fuera a media partida no deja `requestAnimationFrame` huérfano ni errores.

4. **Escalado responsive + táctiles.** `.<DIR>-stage` con `aspect-ratio` correcto + `ResizeObserver`
   que llama a `resize`. `[si hay táctiles]` Crear `touch-controls.tsx` con los botones cableados a
   `game.setInput()`; `update()` combina `keys` + `touch`. Añadir las clases `.<DIR>-*` a
   `globals.css`. Verificación: el juego llena el marco CRT en escritorio y a ~390 px sin deformarse,
   nítido con `devicePixelRatio > 1`, sin scroll horizontal; en viewport táctil se ven los botones.

5. **Guardado real.** `[solo con leaderboard]` En `<DIR>-player.tsx`: overlay `.modal` con input de
   iniciales (filtro `[A-Za-z0-9_]`, máx 12, mayúsculas) y los botones; `submitScore({ gameId:
"<SLUG>", name, score, level })`; estados guardando / "▸ PUNTUACIÓN GUARDADA_" / error legible sin
   romper el canvas; `JUGAR DE NUEVO` → `game.restart()`. Verificación manual en `/juego/<SLUG>/jugar`:
   morir, escribir `TEST_1`, `GUARDAR`, ver la fila en `/juego/<SLUG>` y `/salon` tras revalidar; un
   nombre inválido y un fallo de red muestran mensaje legible; `game_id` sin `has_leaderboard` lo
   rechaza la RLS.

6. **Portada, CSS, docs y revisión visual.** `.cover-<SLUG>` en `globals.css`. Actualizar "Stack
   notes" de `CLAUDE.md` si cambia el roster. `npm run lint` y `npm run build` limpios; quitar imports
   / `console` sin usar. Screenshots con Playwright MCP en `.playwright-screenshots/` (escritorio y
   ~390 px). Commitear el bloque gestionado de `AGENTS.md` / `CLAUDE.md` si `next dev` lo reescribió.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `npm run lint` sin errores ni warnings.
- [ ] `app/components/games/<DIR>/engine.ts` no importa nada de `react` ni de `next`.
- [ ] `/juego/<SLUG>/jugar` renderiza un `<canvas>` dentro del marco CRT (`.crt` / `.crt-screen` /
      `.crt-bottom`).
- [ ] Otro juego simulado sigue mostrando `PlayerScreen` con el contador falso.
- [ ] `generateStaticParams` de `/juego/[id]` y `/juego/[id]/jugar` sigue generando todas las rutas
      del catálogo; ningún id existente da 404.
- [ ] El canvas escala manteniendo proporción, nítido con `devicePixelRatio > 1`, sin scroll
      horizontal a ~390 px.
- [ ] Navegar fuera de `/juego/<SLUG>/jugar` a media partida no deja errores en consola ni un
      `requestAnimationFrame` activo.
- [ ] `Escape` / `P` alternan pausa; cambiar de pestaña pausa el juego.
- [ ] `[táctiles]` En viewport `pointer: coarse` se ven los botones y controlan el juego; en
      escritorio no se muestran.
- [ ] `[leaderboard]` Al perder aparece un overlay `.modal` con la puntuación final y un input de
      iniciales; el canvas ya no dibuja el texto "GAME OVER".
- [ ] `[leaderboard]` El input solo acepta `[A-Za-z0-9_]`, máximo 12, en mayúsculas.
- [ ] `[leaderboard]` `GUARDAR PUNTUACIÓN` con nombre válido inserta una fila en `scores`
      (`game_id = '<SLUG>'`) y muestra "PUNTUACIÓN GUARDADA"; la fila aparece en `/juego/<SLUG>` y
      `/salon` tras revalidar.
- [ ] `[leaderboard]` `submitScore` con nombre inválido o con Supabase caído devuelve
      `{ ok: false, error }` y el overlay muestra el mensaje sin romper el juego.
- [ ] `[leaderboard]` Insertar en `scores` con `game_id` de un juego sin `has_leaderboard` vía API
      `anon` es rechazado por la RLS.
- [ ] `[leaderboard]` `JUGAR DE NUEVO` reinicia vía `game.restart()` sin recargar la página.
- [ ] Invariante: `games.has_leaderboard = true` para `<SLUG>` ⇔ `<SLUG>` está en `REAL_GAME_PLAYERS`.
- [ ] `app/globals.css` solo añade `.cover-<SLUG>` y el bloque `.<DIR>-*`; no redefine `:root`,
      `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`, `.hall-table*`, `.lb-row`, `.lb-empty`.
- [ ] Hay screenshots en `.playwright-screenshots/` de `/juego/<SLUG>/jugar`, `/juego/<SLUG>` y
      `/salon` (con datos y vacío), en escritorio y ~390 px.

---

## Decisions

- **Sí:** reutilizar el patrón de SPEC 05 + SPEC 06 al pie de la letra (motor agnóstico + envoltorio +
  registry + `has_leaderboard`). **No:** inventar una arquitectura nueva para este juego.
- **Sí / No:** `<SLUG>` es <fila nueva del catálogo / reutiliza la entrada existente>. Motivo: <…>.
- **Sí / No:** el juego lleva `has_leaderboard = true`. Motivo: <…>.
- **Sí / No:** controles táctiles. Motivo: <…>.
- **Sí:** `scores.level` reporta <el nivel del juego / siempre 1 porque el juego no tiene niveles>.
- <otras decisiones tomadas con el usuario en la Fase 1>

---

## Risks

| Riesgo                                                          | Mitigación                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `requestAnimationFrame` no cancelado al navegar → loop huérfano | `destroy()` en el cleanup del `useEffect`; criterio de aceptación dedicado.          |
| React StrictMode monta el efecto dos veces en dev → doble motor | `gameRef.current?.destroy()` al principio del efecto; `destroy()` idempotente.       |
| `has_leaderboard` y `REAL_GAME_PLAYERS` se desincronizan        | Invariante fijado en criterios de aceptación; se registran juntos en la misma rama.  |
| `get_advisors` marca el `insert` anónimo de `scores`            | Intencional y heredado de SPEC 06; revisar que no haya **otros** hallazgos.          |
| Assets del juego de referencia (sprites, sonidos)               | <portar el loader / redibujar procedural / omitir — según lo decidido en la Fase 1>. |
| `dt` enorme al volver de una pestaña en segundo plano           | `dt` capado a 50 ms + auto-pausa en `visibilitychange`.                              |

---

## Lo que **no** entra en esta spec

- <repetir aquí el "Out of scope" de arriba, en forma de lista corta>.

Cada uno, si se hace, va en su propia spec.
