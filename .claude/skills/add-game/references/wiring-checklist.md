# Checklist de cableado — juego + leaderboard en Arcade Vault

Recorrido end-to-end para la Fase 4 de `/add-game`. El único juego real hoy es **Asteroides**
(`id = rocas`, carpeta `app/components/games/asteroids/`); es la referencia viva.

---

## Invariante

`games.has_leaderboard = true` ⇔ `id` presente en `REAL_GAME_PLAYERS` (`app/components/games/registry.ts`).

- La política RLS de `insert` en `scores` exige `exists (select 1 from games g where g.id = game_id and g.has_leaderboard)`.
- La UI (`/juego/[id]`, `/salon`) rama por `game.hasLeaderboard`: si `true` usa `getTopScores`, si no `seededScores`.

---

## 1. Base de datos

Escribir `supabase/migrations/NN-<slug>.sql` **y** aplicarlo con `mcp__supabase__apply_migration`
(no basta con dejar el archivo). La tabla `scores` ya existe desde SPEC 06 — **no** se recrea.

**Si `<SLUG>` es fila nueva del catálogo:**

```sql
insert into public.games
  (id, title, short, long, cat, cover, color, best, plays, sort_order, has_leaderboard)
values
  ('<SLUG>', '<TITLE>', '<short>', '<long>',
   'ARCADE',            -- ARCADE | PUZZLE | SHOOTER | VERSUS
   'cover-<SLUG>',
   'cyan',              -- cyan | magenta | yellow | green
   0, '0',
   <sort_order>,        -- siguiente entero libre
   true);
```

**Si `<SLUG>` ya existe (como hizo `rocas`):**

```sql
update public.games set has_leaderboard = true where id = '<SLUG>';
```

Después:

- `mcp__supabase__generate_typescript_types` → sobrescribe `app/lib/supabase/database.types.ts`.
- `mcp__supabase__list_tables` → la fila `games` tiene `has_leaderboard = true`.
- `mcp__supabase__list_migrations` → incluye `NN`.
- `mcp__supabase__get_advisors` (type `security`) → el `insert` anónimo en `scores` es un hallazgo
  **esperado** (heredado de SPEC 06); que no aparezcan **otros** nuevos.
- Comprobar la RLS con `mcp__supabase__execute_sql`: un `insert` en `scores` con `game_id` de un juego
  sin `has_leaderboard` debe fallar; con `<SLUG>` y datos válidos debe pasar.

**Solo si `<SLUG>` es nuevo**, en `app/lib/games.ts`:

- Añadir `'<SLUG>'` a `FALLBACK_GAME_IDS`.
- En `fallbackGame()`, cambiar `hasLeaderboard: id === "rocas"` por una comprobación que incluya
  `<SLUG>` (p. ej. `["rocas", "<SLUG>"].includes(id)`).

No se toca nada más de `games.ts` / `scores.ts` / `scores-actions.ts`: `getTopScores`, `submitScore`,
el regex `NAME_RE` (`^[A-Za-z0-9_]{1,12}$`) y los `revalidatePath` ya son agnósticos del juego.

---

## 2. Motor — `app/components/games/<DIR>/engine.ts`

Punto de partida: `templates/engine.ts.txt` de este skill. Contrato público exacto:

| Método                              | Contrato                                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `constructor(canvas)`               | guarda canvas + `getContext("2d")`; `throw` si no hay ctx; no arranca nada                                                        |
| `start()`                           | `initGame()`, `addEventListener` keydown/keyup en `window`, lanza `requestAnimationFrame`. Idempotente (no-op si `rafId != null`) |
| `stop()`                            | `cancelAnimationFrame` + quita los listeners. Estado conservado                                                                   |
| `destroy()`                         | `stop()` + `onGameOver = null`. Idempotente                                                                                       |
| `restart()`                         | `initGame()` de nuevo                                                                                                             |
| `setPaused(bool)` / `togglePause()` | pausa lógica; `togglePause` ignora el toggle si `state === "gameover"`                                                            |
| `resize(cssW, cssH, dpr)`           | ajusta `canvas.width/height` a `tamaño * dpr` con proporción `W/H`, luego `ctx.setTransform(pxW/W, 0, 0, pxH/H, 0, 0)`            |
| `setOnGameOver(cb)`                 | `cb: (r: { score: number; level: number }) => void`, se dispara **una sola vez** por partida                                      |
| `setInput(action, pressed)`         | `[si hay táctiles]` combina con el teclado en `update()`; `"fire"` → `justPressed["Space"]` en el flanco de subida                |

Reglas:

- **Cero imports de `react` / `next`.** Todo el estado en campos privados.
- Loop: `dt = Math.min((ts - last) / 1000, 0.05)` (cap 50 ms); `if (!paused) update(dt); draw();`.
- `onKeyDown` / `onKeyUp` son campos arrow-fn (para quitarlos en `stop()`), con guard
  `isFormFieldFocused(e.target)`.
- Fin de partida: `state = "gameover"` + `if (!gameOverNotified) { gameOverNotified = true;
onGameOver?.({ score, level }); }`. `gameOverNotified` se resetea en `initGame()`.
- `draw()` pinta el campo, las entidades y el HUD (`SCORE` / `NIVEL` / vidas) en canvas, y el overlay
  "EN PAUSA". **Nunca** pinta el texto de "GAME OVER".

---

## 3. Envoltorio — `app/components/games/<DIR>/<DIR>-player.tsx`

Punto de partida: `templates/game-player.tsx.txt`. Responsabilidades:

- `"use client"`, props `{ title: string }` (tipo exacto que exige el registry), `const GAME_ID = "<SLUG>"`.
- `useEffect(() => { … }, [])`:
  - guard StrictMode: `gameRef.current?.destroy()` al principio.
  - `new <Nombre>Game(canvas)` → `gameRef.current`.
  - `game.setOnGameOver((r) => { setOver(r); … })`.
  - `applySize()` con `stage.getBoundingClientRect()` → `game.resize(w, h, devicePixelRatio || 1)`;
    `ResizeObserver` sobre el stage.
  - `game.start()`.
  - `keydown` en `window`: `preventDefault` de `ArrowUp/Down/Left/Right/Space` (salvo si se está
    escribiendo en un input); `Escape`/`KeyP` → `togglePause()`; `Space` → cerrar el overlay.
  - `visibilitychange` → `game.setPaused(document.hidden)`.
  - cleanup: `ro.disconnect()`, quitar listeners, `game.destroy()`, `gameRef.current = null`.
- Marco CRT: `.av-player` › `.crt` › `.crt-screen` › `.<DIR>-stage` › `<canvas className="<DIR>-canvas">`,
  y `.crt-bottom`. `[táctiles]` `<TouchControls onInput={handleInput} />` dentro de `.crt-screen`.
- `[leaderboard]` Overlay `.modal-bd` › `.modal` (reutiliza las clases de `globals.css`):
  - `<h2>FIN DEL JUEGO</h2>`, `.final-label`, `.final` con `over.score.toLocaleString("es-ES")`.
  - input filtrado: `e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 12)`.
  - botón `GUARDAR PUNTUACIÓN`, `disabled` si `phase === "saving" || name.length === 0`, llama a
    `submitScore({ gameId: GAME_ID, name, score: over.score, level: over.level })`.
  - `phase`: `idle | saving | saved | error`. `saved` → `<div className="toast-saved">▸ PUNTUACIÓN
GUARDADA_</div>`. `error` → muestra `res.error` sin romper el canvas.
  - `.actions`: `JUGAR DE NUEVO` → `game.restart()` + `setOver(null)`; `VOLVER` → `/juego/<SLUG>`.

`submitScore` está en `app/lib/scores-actions.ts` (`"use server"`), valida en servidor e inserta con
el cliente de `app/lib/supabase/server.ts` (rol `anon`, bajo RLS) y hace `revalidatePath("/salon")` +
`revalidatePath("/juego/" + gameId)`.

---

## 4. Táctiles (opcional) — `app/components/games/<DIR>/touch-controls.tsx`

Punto de partida: `templates/touch-controls.tsx.txt`. `"use client"`, props
`{ onInput: (action, pressed) => void }`. Cada botón: `onPointerDown` → `onInput(action, true)`;
`onPointerUp` / `onPointerCancel` / `onPointerLeave` → `false`; `e.preventDefault()` en cada handler.
Las acciones deben existir en la unión `TouchAction` del motor.

---

## 5. Registry — `app/components/games/registry.ts`

```ts
import <Nombre>Player from "./<DIR>/<DIR>-player";

export const REAL_GAME_PLAYERS: Record<string, ComponentType<{ title: string }>> = {
  rocas: AsteroidsPlayer,
  "<SLUG>": <Nombre>Player,
};
```

Es el **único** cableado que necesita `/juego/[id]/jugar`. `/juego/[id]` y `/salon` reaccionan solos
vía `game.hasLeaderboard`. No se tocan `app/juego/[id]/page.tsx`, `jugar/page.tsx`, `salon/page.tsx`
ni `hall-of-fame.tsx`.

---

## 6. CSS — `app/globals.css` (anexar al final)

- `.cover-<SLUG>` (+ `::before` / `::after` a gusto) junto a los demás `.cover-*` (bloque
  "Cover art generators (pure CSS)"). El nombre debe ser igual al valor de la columna `cover`. Lo usan
  la tarjeta del catálogo y la portada del detalle vía `<div className={"cover-bg " + game.cover} />`.
- Bloque `/* ===== juego: <DIR> (<SLUG>) ===== */` modelado sobre el de asteroides:
  - `.<DIR>-stage { position: absolute; inset: 0; background: #000; }`
  - `.<DIR>-canvas { display: block; width: 100%; height: 100%; object-fit: contain; touch-action: none; }`
  - `[táctiles]` `.<DIR>-touch { position: absolute; inset: 0; display: none; pointer-events: none; }`
    - `@media (pointer: coarse) { .<DIR>-touch { display: block; } }` + `.<DIR>-touch-btn` variantes.

**No redefinir:** `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`, `.hall-table*`,
`.leaderboard`, `.lb-row`, `.lb-empty`.

---

## 7. Docs

- `CLAUDE.md` "Stack notes": si cambia el roster de juegos con `has_leaderboard` (hoy la frase dice
  "today: `rocas` only"), actualizarla.
- Commitear el bloque gestionado de `AGENTS.md` / `CLAUDE.md` si `next dev` lo reescribió.

---

## 8. Verificación manual

1. `npm run lint` y `npm run build` limpios.
2. `npm run dev` → `/juego/<SLUG>/jugar`: el canvas llena el marco CRT en escritorio y a ~390 px, sin
   scroll horizontal, nítido con `devicePixelRatio > 1`.
3. Jugar → perder → aparece el overlay `.modal` con la puntuación final (el canvas ya no dibuja
   "GAME OVER").
4. Escribir `TEST_1` → `GUARDAR PUNTUACIÓN` → "▸ PUNTUACIÓN GUARDADA_". La fila aparece en el aside de
   `/juego/<SLUG>` y en la tab de `<SLUG>` de `/salon` (revalidación inmediata por `revalidatePath`).
5. Nombre vacío / con caracteres inválidos → mensaje legible, el juego no se rompe.
6. `JUGAR DE NUEVO` → reinicia sin recargar la página.
7. Navegar fuera a media partida → sin errores en consola ni `requestAnimationFrame` huérfano.
8. Un juego simulado (p. ej. `/juego/caida`) sigue con `PlayerScreen` y `seededScores`.
9. Screenshots con Playwright MCP en `.playwright-screenshots/` (escritorio y ~390 px).
