# SPEC 06 — Tabla de juegos y leaderboard en Supabase

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 04, SPEC 05
> **Fecha:** 2026-08-28
> **Objetivo:** Mover el catálogo y las puntuaciones a Supabase — tabla `games` sembrada con el catálogo actual y de lectura pública, tabla `scores` de inserción anónima con iniciales validada por CHECK y RLS, marcas reales en `/salon` y `/juego/[id]` solo para los juegos con motor real (hoy `rocas`) y un overlay de guardado al terminar la partida de `rocas`.

---

## Por qué existe esta spec

Hoy todo el contenido de datos es mock en el repo:

- El catálogo son 8 objetos hardcodeados en `app/lib/games.ts` (`GAMES`).
- Las puntuaciones se generan con `seededScores` (`app/lib/scores.ts`): un PRNG determinista sobre una lista fija de 18 nombres. Se usan en `/salon` (`hall-of-fame.tsx`), en el detalle de juego (`app/juego/[id]/page.tsx`) y en la home (`app/lib/home.ts`).
- El botón "GUARDAR PUNTUACIÓN" del `PlayerScreen` simulado solo cambia un estado local (`setSaved(true)`).

SPEC 04 dejó Supabase cableado (clientes browser/server con `@supabase/ssr`, `proxy.ts`, `/diagnostico/supabase`) pero **sin ninguna tabla**, y difirió explícitamente la tabla `scores` + RLS y "que GUARDAR PUNTUACIÓN escriba de verdad" a su propia spec. Esta es esa spec, y además saca el catálogo del código.

SPEC 05 portó `rocas` a un motor real (`app/components/games/asteroids/engine.ts`) y decidió "**el canvas dibuja todo** (HUD y overlay de fin), `Espacio` reinicia, **no** se persiste la puntuación". Esta spec **revisa esa última parte**: el motor deja de pintar el texto de `GAME OVER` y el envoltorio React monta un overlay con un formulario de guardado. El resto de decisiones de SPEC 05 quedan intactas.

Decisiones de forma tomadas con el usuario antes de escribir esta spec:

- **Una sola spec** para las dos features (tabla `games` + leaderboard), aunque sea amplia.
- **Iniciales anónimas, sin auth.** No hay spec de Auth todavía; el jugador escribe 3-12 caracteres al morir. La validación es por CHECK de columna + RLS, sin rate limit.
- **Solo los juegos con motor real** guardan y muestran marcas reales. Hoy es solo `rocas`. Los otros 7 siguen con `seededScores` en `/salon` y en su detalle hasta que cada uno tenga su spec.
- La tabla `games` guarda **todas** las columnas actuales, incluidas `best` y `plays`, sembradas con los valores mock y **estáticas** (no se recalculan desde `scores`).
- El catálogo es **100% data-driven**: `generateStaticParams` consulta la tabla en build.

---

## Scope

**In:**

- `supabase/migrations/06-tabla-juegos-y-leaderboard.sql` (nuevo) — aplicado al proyecto remoto `itmhyidlxraapcjzprvn` con `mcp__supabase__apply_migration`. Contiene:
  - `create table public.games` con las columnas del modelo de datos (abajo), `CHECK` en `cat` y `color`, y `has_leaderboard boolean not null default false`.
  - `create table public.scores` con `CHECK` en `name` (regex), `score` (rango 0–100000000) y `level` (rango 1–10000), FK `game_id → games.id`, e índice `(game_id, score desc, created_at desc)`.
  - RLS habilitada en ambas. `games`: `select` público (`anon`, `authenticated`), sin políticas de escritura. `scores`: `select` público, `insert` público con `with check` que exige `exists (… games.has_leaderboard)`; sin `update` ni `delete`.
  - `INSERT` de siembra de los 8 juegos de `GAMES` con sus valores actuales (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`, `sort_order`). `rocas` con `has_leaderboard = true`; los otros 7 con `false`.
- `app/lib/supabase/public.ts` (nuevo) — `createPublicClient()` sobre `createClient` de `@supabase/supabase-js` (sin cookies, sin sesión), tipado `<Database>`, para lecturas públicas anónimas en `generateStaticParams` y en el render de páginas que deben poder quedarse estáticas / ISR. **No** sustituye a `client.ts` ni `server.ts` de SPEC 04.
- `app/lib/games.ts` — reescrito:
  - Se elimina la constante `GAMES`.
  - Se mantienen `GameColor`, `CATS` y la interfaz `Game`, a la que se añade `hasLeaderboard: boolean` (mapea `has_leaderboard`). Sin campos snake_case en la interfaz.
  - `getGames(): Promise<Game[]>` — `cache()` de React, cliente público, `select` ordenado por `sort_order`.
  - `getGame(id: string): Promise<Game | null>`.
  - `FALLBACK_GAME_IDS: string[]` — los 8 slugs actuales, usados por `getGames`/`generateStaticParams` si la consulta falla o vuelve vacía en build (evita romper el build por un fallo de red).
- `app/lib/scores.ts` — se mantiene `PLAYERS`, `ScoreRow` y `seededScores` (siguen alimentando los 7 juegos simulados). Se añade:
  - `getTopScores(gameId: string, limit: number): Promise<ScoreRow[]>` — cliente público, `order('score', desc).order('created_at', desc).limit(limit)`, mapea a `ScoreRow` (`rank` recalculado, `date` formateada `dd/mm/yyyy`).
  - `formatScoreDate(iso: string): string`.
- `app/lib/scores-actions.ts` (nuevo, `"use server"`) — `submitScore(input: { gameId: string; name: string; score: number; level: number }): Promise<{ ok: true } | { ok: false; error: string }>`:
  - Valida en servidor: `name` contra `^[A-Za-z0-9_]{1,12}$`, `score` entero en rango, `level` entero en rango, `gameId` presente.
  - Inserta con el cliente de servidor de SPEC 04 (`app/lib/supabase/server.ts`), rol `anon`, bajo RLS.
  - En éxito: `revalidatePath('/salon')` y `revalidatePath('/juego/' + gameId)`.
  - Traduce el error de Postgres (violación de CHECK o de la política) a un mensaje legible en español.
- `app/lib/home.ts` — `HOME_STATS` (constante) pasa a `homeStats(): Promise<StatBlock[]>`; `tickerRows()` pasa a `async` (necesita `getGames()`). `topPlayers()` **no cambia** (solo usa `PLAYERS`). El ticker y el top siguen usando `seededScores` — la home **no** lee la tabla `scores`.
- `app/lib/supabase/database.types.ts` — regenerado con `mcp__supabase__generate_typescript_types` tras la migración (ahora con `games` y `scores`).
- `app/page.tsx` — `export default async function`; `const games = await getGames()`; `previewGames={games.slice(0, 6)}`, `stats={await homeStats()}`, `ticker={await tickerRows()}`, `top={topPlayers()}`. `metadata` intacto.
- `app/biblioteca/page.tsx` — `async`; `await getGames()` y pásalo a `<GameLibrary games={…} />`.
- `app/components/game-library.tsx` — recibe `games: Game[]` por prop en vez de importar `GAMES`. Sigue importando `CATS` de `games.ts`. Resto de la lógica de filtro intacta.
- `app/salon/page.tsx` — `async`; `const games = await getGames()`; construye `realScores: Record<string, ScoreRow[]>` llamando a `getTopScores(g.id, 12)` para cada `g` con `g.hasLeaderboard`; pasa `games` y `realScores` a `<HallOfFame />`. `export const revalidate = 60`.
- `app/components/hall-of-fame.tsx` — recibe `games: Game[]` y `realScores: Record<string, ScoreRow[]>` por prop:
  - La tab activa usa `realScores[tab]` si `games.find(tab).hasLeaderboard`, si no `seededScores` como hoy.
  - Podio y tabla renderizan un **estado vacío** ("AÚN NO HAY MARCAS · SÉ EL PRIMERO") cuando la lista real tiene 0 filas, y un podio parcial cuando tiene 1 o 2.
  - `useMemo`/`useState` de tabs intactos.
- `app/juego/[id]/page.tsx`:
  - `generateStaticParams` → `async`, `(await getGames()).map(g => ({ id: g.id }))`.
  - `generateMetadata` → `getGame(id)`.
  - Componente: `getGame(id)`; si `game.hasLeaderboard`, el aside `.leaderboard` usa `await getTopScores(id, 10)` con estado vacío; si no, `seededScores(id.length * 17 + 3, 10)` como hoy.
  - `export const revalidate = 60`.
  - El `stat-strip` "Mejor global" sigue mostrando `game.best` (columna, estática). Los tags hardcodeados no se tocan.
- `app/juego/[id]/jugar/page.tsx` — `generateStaticParams` y `generateMetadata` → `async` con `getGames()`/`getGame()`. El dispatch a `REAL_GAME_PLAYERS` / `PlayerScreen` intacto.
- `app/components/games/asteroids/engine.ts`:
  - Nuevo `setOnGameOver(cb: (result: { score: number; level: number }) => void)` (o parámetro opcional del constructor). El callback se dispara **una sola vez** en la transición a `state = "gameover"`.
  - Nuevo método público `restart()` — reinicia la partida (equivalente a lo que hoy hace `Espacio` en `GAME OVER`).
  - `draw()` deja de pintar el texto `GAME OVER` y la línea "Espacio para reiniciar". El último frame (campo congelado) se sigue pintando; el overlay lo tapa React.
  - `Espacio` durante `gameover` sigue reiniciando (no molesta y es coherente).
- `app/components/games/asteroids/asteroids-player.tsx`:
  - Estado `over: { score: number; level: number } | null`, `phase: "idle" | "saving" | "saved" | "error"`, `name`, `errorMsg`.
  - En el `useEffect` de montaje: `game.setOnGameOver((r) => setOver(r))`.
  - Overlay React (reutiliza `.modal-bd` / `.modal` de `globals.css`, como `player-screen.tsx`) con: "FIN DEL JUEGO", puntuación final, input de iniciales (filtra a `^[A-Za-z0-9_]{0,12}$`, `toUpperCase()`), botón `GUARDAR PUNTUACIÓN` → `submitScore({ gameId: "rocas", name, score, level })`, botón `JUGAR DE NUEVO` → `game.restart()` + `setOver(null)`, enlace `VOLVER` a `/juego/rocas`.
  - Estados visibles: guardando (botón deshabilitado), "▸ PUNTUACIÓN GUARDADA_", y mensaje de error legible si `submitScore` falla (el juego no se rompe; se puede reintentar o jugar de nuevo).
- `app/globals.css` — anexar `.lb-empty` (estado vacío del aside `.leaderboard` y del bloque del salón: texto centrado, `var(--mono)`, `var(--ink-faint)`). **No** redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`, `.hall-table*`, `.leaderboard`/`.lb-row` existentes.
- `CLAUDE.md` — "Stack notes": el catálogo vive en la tabla `games` (leído con `getGames()` de `app/lib/games.ts` vía el cliente público `app/lib/supabase/public.ts`); las puntuaciones en `scores` (insert anónimo bajo RLS con `submitScore` de `app/lib/scores-actions.ts`); solo los juegos con `has_leaderboard = true` muestran marcas reales.
- Revisión visual con Playwright MCP: screenshots en `.playwright-screenshots/` de `/biblioteca`, `/salon` (tab `ROCAS` con datos y vacía), `/juego/rocas` (aside con datos y vacío) y el overlay de guardado de `/juego/rocas/jugar`, en escritorio y ~390 px. Verificar que `/juego/caida` y su `/salon` tab siguen mostrando `seededScores`.

**Out of scope (para futuras specs):**

- Auth real (`signUp` / `signInWithPassword` / sesión en el Nav / `/entrar` funcional) y columna `user_id` en `scores`. El leaderboard de esta spec es 100% anónimo por iniciales.
- Tabla `public.profiles` y su trigger.
- Rate limiting / captcha / moderación de nombres ofensivos en `scores`. Solo hay CHECK de formato.
- Recalcular `games.best` o `games.plays` desde datos reales. Siguen siendo columnas mock estáticas.
- Portar los otros 7 juegos a motor real y que guarden marcas. Siguen simulados con `PlayerScreen` y `seededScores`.
- Que el `PlayerScreen` simulado escriba en `scores` (su contador es aleatorio; la política RLS lo rechazaría igualmente por `has_leaderboard = false`).
- Marcas reales en la home (`/`): el ticker y el top de jugadores siguen sembrados.
- Panel de administración de juegos (CRUD). El catálogo se edita con SQL / MCP.
- Fila "▸ TU MEJOR MARCA EN …" personalizada (necesita identidad).
- Paginación / scroll infinito del leaderboard. Límite fijo (12 en `/salon`, 10 en el detalle).
- Realtime (que una marca nueva aparezca sin recargar ni revalidar).
- Migrar `CATS` a una tabla o derivarlas de `games`. Siguen como constante en `games.ts`.
- Ajustar los tags hardcodeados de `/juego/[id]` ("1 JUGADOR", estrellas de dificultad).
- Tests automatizados (no hay runner).

---

## Data model

### Tabla `public.games`

```sql
create table public.games (
  id             text primary key,               -- slug: 'rocas', 'caida', …
  title          text not null,
  short          text not null,
  long           text not null,
  cat            text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover          text not null,                   -- clase CSS de portada: 'cover-rocas'
  color          text not null check (color in ('cyan','magenta','yellow','green')),
  best           integer not null default 0,      -- mock sembrado, estático
  plays          text    not null default '0',    -- mock sembrado ("15.6K"), estático
  sort_order     integer not null,                -- orden de catálogo (0..7)
  has_leaderboard boolean not null default false, -- true = acepta y muestra marcas reales
  created_at     timestamptz not null default now()
);
```

RLS: `enable row level security`. Política única `select` para `anon, authenticated` con `using (true)`. Sin políticas de `insert` / `update` / `delete` (el catálogo se edita solo por migración / MCP, que hace bypass de RLS).

Siembra: las 8 filas de la constante `GAMES` actual, `sort_order` = índice en el array. `rocas` → `has_leaderboard = true`; el resto → `false`.

### Tabla `public.scores`

```sql
create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  game_id    text not null references public.games(id) on delete cascade,
  name       text not null check (name ~ '^[A-Za-z0-9_]{1,12}$'),
  score      integer not null check (score >= 0 and score <= 100000000),
  level      integer not null default 1 check (level >= 1 and level <= 10000),
  created_at timestamptz not null default now()
);

create index scores_game_id_score_idx
  on public.scores (game_id, score desc, created_at desc);
```

RLS: `enable row level security`.

- `select` para `anon, authenticated` con `using (true)`.
- `insert` para `anon, authenticated` con:
  ```sql
  with check (
    exists (select 1 from public.games g where g.id = game_id and g.has_leaderboard)
  )
  ```
- Sin `update` ni `delete`.

### Tipos y firmas en la app

```ts
// app/lib/games.ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: GameColor;
  best: number;
  plays: string;
  hasLeaderboard: boolean;
}
export const FALLBACK_GAME_IDS: string[]; // 8 slugs actuales
export function getGames(): Promise<Game[]>;
export function getGame(id: string): Promise<Game | null>;

// app/lib/scores.ts  (seededScores / PLAYERS / ScoreRow intactos)
export function getTopScores(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]>;
export function formatScoreDate(iso: string): string;

// app/lib/scores-actions.ts
("use server");
export function submitScore(input: {
  gameId: string;
  name: string;
  score: number;
  level: number;
}): Promise<{ ok: true } | { ok: false; error: string }>;

// app/lib/supabase/public.ts
export function createPublicClient(): SupabaseClient<Database>;
```

### Mapa de archivos tras esta spec

| Archivo                                                 | Tipo             | Cambio                                                |
| ------------------------------------------------------- | ---------------- | ----------------------------------------------------- |
| `supabase/migrations/06-tabla-juegos-y-leaderboard.sql` | migración SQL    | nuevo (aplicado vía MCP)                              |
| `app/lib/supabase/public.ts`                            | módulo lectura   | nuevo                                                 |
| `app/lib/supabase/database.types.ts`                    | tipos generados  | regenerado (games + scores)                           |
| `app/lib/games.ts`                                      | datos / acceso   | reescrito: fuera `GAMES`, dentro `getGames`/`getGame` |
| `app/lib/scores.ts`                                     | datos / acceso   | `+getTopScores`, `+formatScoreDate`                   |
| `app/lib/scores-actions.ts`                             | server action    | nuevo                                                 |
| `app/lib/home.ts`                                       | datos            | `HOME_STATS`→`homeStats()`, `tickerRows` async        |
| `app/page.tsx`                                          | server component | `async`, awaits                                       |
| `app/biblioteca/page.tsx`                               | server component | `async`, `getGames()` → prop                          |
| `app/components/game-library.tsx`                       | client component | recibe `games` por prop                               |
| `app/salon/page.tsx`                                    | server component | `async`, fetch real + `revalidate`                    |
| `app/components/hall-of-fame.tsx`                       | client component | props `games` + `realScores`, estado vacío            |
| `app/juego/[id]/page.tsx`                               | server component | params async, aside real si `hasLeaderboard`          |
| `app/juego/[id]/jugar/page.tsx`                         | server component | params async                                          |
| `app/components/games/asteroids/engine.ts`              | motor            | `+onGameOver`, `+restart()`, sin texto GAME OVER      |
| `app/components/games/asteroids/asteroids-player.tsx`   | client component | overlay de guardado                                   |
| `app/globals.css`                                       | estilos          | `+.lb-empty`                                          |
| `CLAUDE.md`                                             | doc              | Stack notes                                           |

`site-nav.tsx`, `site-footer.tsx`, `home-landing.tsx`, `game-card.tsx`, `player-screen.tsx`, `auth-card.tsx`, `proxy.ts`, `app/lib/supabase/{client,server,proxy}.ts` y las rutas `/acerca`, `/entrar`, `/diagnostico/supabase` **no se tocan**.

---

## Implementation plan

1. **Migración + tipos.** Escribir `supabase/migrations/06-tabla-juegos-y-leaderboard.sql` con las dos tablas, CHECKs, índice, RLS y los `INSERT` de siembra de los 8 juegos (`rocas.has_leaderboard = true`). Aplicar con `mcp__supabase__apply_migration`. Regenerar `app/lib/supabase/database.types.ts`. Verificación: `mcp__supabase__list_tables` muestra `games` con 8 filas y `scores` con 0; `mcp__supabase__get_advisors` (security) no reporta nada crítico salvo el insert anónimo esperado en `scores`; `npm run build` sigue compilando (la app aún usa el catálogo hardcodeado en este punto — el commit se cierra en el paso 2).

2. **Catálogo data-driven.** Crear `app/lib/supabase/public.ts`. Reescribir `app/lib/games.ts` (`getGames`/`getGame`/`FALLBACK_GAME_IDS`, `Game.hasLeaderboard`, sin `GAMES`). Actualizar en el mismo commit todos los consumidores del catálogo: `app/page.tsx`, `app/biblioteca/page.tsx`, `app/components/game-library.tsx` (prop `games`), `app/lib/home.ts` (`homeStats()` / `tickerRows()` async), `app/juego/[id]/page.tsx` y `app/juego/[id]/jugar/page.tsx` (`generateStaticParams` / `generateMetadata` async). Las puntuaciones siguen sembradas en todas partes. Verificación: `npm run build` y `npm run lint` limpios; `npm run dev`; `/`, `/biblioteca`, `/juego/rocas`, `/juego/caida`, `/salon` se ven idénticas a antes; editar `title` de una fila de `games` vía MCP y revalidar refleja el cambio; `generateStaticParams` sigue generando 8 rutas.

3. **Lectura de marcas reales.** Añadir `getTopScores` y `formatScoreDate` a `app/lib/scores.ts`. En `app/juego/[id]/page.tsx`: si `game.hasLeaderboard`, el aside usa `getTopScores(id, 10)` con estado vacío `.lb-empty`; si no, `seededScores` como hoy. `app/salon/page.tsx` pasa a `async`, construye `realScores` y lo pasa junto a `games` a `HallOfFame`; `HallOfFame` recibe ambos por prop y usa real para tabs con `hasLeaderboard` (podio parcial / vacío incluidos), sembrado para el resto. `export const revalidate = 60` en ambas rutas. Verificación: con `scores` vacía, la tab `ROCAS` de `/salon` y el aside de `/juego/rocas` muestran el estado vacío; insertando 3 filas a mano vía `mcp__supabase__execute_sql` aparecen ordenadas por `score` desc tras revalidar; `/juego/caida` y su tab siguen con `seededScores`.

4. **Guardado desde `rocas`.** Crear `app/lib/scores-actions.ts` con `submitScore` (validación en servidor + insert con el cliente de `server.ts` + `revalidatePath`). En `engine.ts`: `setOnGameOver`, `restart()`, y quitar el dibujado del texto `GAME OVER` / "Espacio". En `asteroids-player.tsx`: overlay React con input de iniciales y los tres botones. Verificación manual en `/juego/rocas/jugar`: morir, escribir "TEST_1", `GUARDAR`, ver la fila en `/juego/rocas` y en `/salon` tras revalidar; un nombre vacío o con caracteres inválidos y un fallo de red muestran un mensaje legible sin romper el canvas; `JUGAR DE NUEVO` reinicia sin recargar la página; navegar fuera a media partida sigue sin dejar loop huérfano (criterio de SPEC 05).

5. **CSS, docs y revisión visual.** Añadir `.lb-empty` a `globals.css` (sin redefinir nada existente). Actualizar "Stack notes" de `CLAUDE.md`. `npm run lint` y `npm run build` limpios; quitar imports / `console` sin usar. Screenshots con Playwright MCP en `.playwright-screenshots/`: `/biblioteca`, `/salon` (tab `ROCAS` con datos y vacía), `/juego/rocas` (aside con datos y vacío), overlay de guardado de `/juego/rocas/jugar`; escritorio y ~390 px. Commitear el bloque gestionado de `AGENTS.md` / `CLAUDE.md` si `next dev` lo reescribió.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `npm run lint` sin errores ni warnings.
- [ ] `mcp__supabase__list_tables` muestra `public.games` (8 filas) y `public.scores`; `mcp__supabase__list_migrations` incluye la migración `06`.
- [ ] `supabase/migrations/06-tabla-juegos-y-leaderboard.sql` existe en el repo con el mismo SQL aplicado.
- [ ] `public.games` y `public.scores` tienen RLS habilitada; `games` solo con política `select`; `scores` con `select` público e `insert` público condicionado a `games.has_leaderboard`, sin `update` ni `delete`.
- [ ] Insertar en `scores` una fila con `game_id = 'caida'` vía API `anon` es rechazado por la política; con `game_id = 'rocas'` y datos válidos, se acepta.
- [ ] Insertar en `scores` con `name = 'ab cd'` o `name = ''` o `score` negativo es rechazado por un CHECK.
- [ ] `app/lib/games.ts` no exporta ninguna constante `GAMES`; exporta `getGames`, `getGame` y `FALLBACK_GAME_IDS`.
- [ ] `app/lib/supabase/public.ts` crea el cliente sin `cookies()` y no importa nada de `next/headers`.
- [ ] `/biblioteca` lista los 8 juegos, el buscador y los chips de categoría filtran igual que antes.
- [ ] `generateStaticParams` de `/juego/[id]` y `/juego/[id]/jugar` genera exactamente las 8 rutas; ningún id existente da 404.
- [ ] Cambiar `title` o `long` de una fila de `games` vía MCP se refleja en `/biblioteca` y `/juego/[id]` tras la revalidación, sin tocar código.
- [ ] Con `scores` vacía: la tab `ROCAS` de `/salon` y el aside de `/juego/rocas` muestran el estado vacío `.lb-empty` en vez de podio / filas.
- [ ] Con filas reales en `scores` para `rocas`: `/salon` tab `ROCAS` muestra hasta 12 ordenadas por `score` desc y `/juego/rocas` hasta 10; el podio refleja las 3 primeras.
- [ ] `/salon` tab `CAÍDA` (y las de los otros 6 juegos sin motor real) y el aside de `/juego/caida` siguen mostrando `seededScores` determinista.
- [ ] En `/juego/rocas/jugar`, al perder la última vida aparece un overlay React (`.modal`) con la puntuación final y un input de iniciales; el canvas ya no dibuja el texto `GAME OVER`.
- [ ] El input de iniciales solo acepta `[A-Za-z0-9_]`, máximo 12, y lo muestra en mayúsculas.
- [ ] `GUARDAR PUNTUACIÓN` con un nombre válido inserta una fila en `scores` (`game_id = 'rocas'`, `score` y `level` de la partida) y muestra "PUNTUACIÓN GUARDADA"; la fila aparece luego en `/juego/rocas` y `/salon`.
- [ ] `submitScore` con nombre inválido, o con Supabase caído, devuelve `{ ok: false, error }` y el overlay muestra el mensaje sin romper el juego.
- [ ] `JUGAR DE NUEVO` en el overlay reinicia la partida vía `game.restart()` sin recargar la página.
- [ ] Navegar fuera de `/juego/rocas/jugar` a media partida no deja errores en consola ni un `requestAnimationFrame` activo (criterio heredado de SPEC 05 sigue cumpliéndose).
- [ ] La home (`/`), `site-nav.tsx`, `game-card.tsx`, `player-screen.tsx` y `auth-card.tsx` no se han modificado en su comportamiento visible; la home no hace ninguna consulta a `scores`.
- [ ] `app/globals.css` solo añade `.lb-empty`; no redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`, `.hall-table*` ni `.leaderboard` / `.lb-row`.
- [ ] La página no tiene scroll horizontal nuevo a ~390 px en `/biblioteca`, `/salon`, `/juego/rocas` ni en el overlay de guardado.
- [ ] Hay screenshots en `.playwright-screenshots/` de `/biblioteca`, `/salon` (con datos y vacía), `/juego/rocas` (con datos y vacío) y el overlay de guardado, en escritorio y ~390 px.
- [ ] `CLAUDE.md` "Stack notes" menciona la tabla `games` (`getGames()` / `public.ts`) y la tabla `scores` (`submitScore` / `has_leaderboard`).

---

## Decisions

- **Sí:** las dos features (`games` + leaderboard) en **una sola spec**, por decisión explícita del usuario. **No:** partir en SPEC 06 (catálogo) + SPEC 07 (leaderboard), aunque el alcance es amplio (2 tablas, RLS, ~9 componentes tocados).
- **Sí:** leaderboard **anónimo por iniciales**, sin auth, validado por CHECK de columna + RLS. Encaja con el `PlayerScreen` actual ("TUS INICIALES") y no bloquea la spec esperando a Auth. **No:** exigir Auth real primero — no existe esa spec y retrasaría todo. **No:** rate limiting / captcha — sobra para un proyecto de portfolio; el CHECK de formato y el tope de score contienen lo peor.
- **No:** columna `user_id` en `scores`. El usuario eligió "iniciales anónimas" y no la opción "migrable a Auth". Cuando llegue Auth, su spec añadirá la columna.
- **Sí:** `scores` guarda `name`, `score`, `game_id`, `created_at` y **`level`**. El `level` es barato, ya lo tiene el motor de `rocas` y da contexto a la marca. **No:** más campos (duración, semilla, replay).
- **Sí:** la política de `insert` de `scores` exige `games.has_leaderboard` mediante subconsulta en el `with check`. Impide meter basura por API para los 7 juegos simulados sin necesidad de un trigger. `has_leaderboard` es la **única fuente de verdad** de "este juego tiene marcas reales"; debe quedar `true` solo para juegos que además estén en `REAL_GAME_PLAYERS`.
- **Sí:** tope de score como **constante global en el CHECK** (`0..100000000`), igual para todos los juegos. **No:** columna `max_score` por juego + trigger — más SQL para una precisión que hoy nadie necesita.
- **Sí:** la tabla `games` guarda `best` y `plays` como **columnas mock sembradas y estáticas**. Mantiene la UI de tarjetas y detalle sin cambios. **No:** recalcular `best` desde `scores` (solo `rocas` tendría dato real y quedaría incoherente con los demás) ni quitar esos números de la UI.
- **Sí:** catálogo **100% data-driven**: `generateStaticParams` consulta `games` en build. **No:** mantener una lista de slugs en el repo como fuente de build — se pidió data-driven; el riesgo de build sin DB se cubre con `FALLBACK_GAME_IDS`.
- **Sí:** cliente **`public.ts` sin cookies** (`@supabase/supabase-js` directo) para las lecturas públicas de catálogo y marcas. Permite que `/biblioteca`, `/juego/[id]` y `/salon` sigan generándose estáticas + ISR (`revalidate`). **No:** usar el cliente de `server.ts` para estas lecturas — llama a `cookies()` y volvería dinámicas todas esas rutas.
- **Sí:** `submitScore` como **Server Action** (no Route Handler, no cliente de navegador). Permite validar en servidor y `revalidatePath` en la misma llamada. Usa el rol `anon` bajo RLS, coherente con SPEC 04 (sin `service_role`).
- **Sí:** revalidación por **tiempo (`revalidate = 60`) + `revalidatePath` en la acción**. La marca propia se ve al instante tras guardar; las de otros, en ≤ 60 s. **No:** Realtime — otra spec si hace falta.
- **Sí:** **revisar SPEC 05**: el motor de `rocas` deja de pintar el texto `GAME OVER` y el envoltorio React monta el overlay de guardado. Es el cambio mínimo para tener un formulario con input de nombre. El resto de SPEC 05 (canvas dibuja HUD y campo, `Espacio` reinicia, marco CRT) queda igual.
- **Sí:** la home **no** lee `scores`; su ticker y su top siguen sembrados. Reduce superficie y evita otra ruta dinámica. **No:** meter la marca real de `rocas` en el ticker — poco valor, más acoplamiento.
- **No:** tocar `PlayerScreen`, `CATS`, los tags de `/juego/[id]` ni la arena CSS decorativa. Los 7 juegos simulados siguen igual hasta su propia spec.

---

## Risks

| Riesgo                                                                                         | Mitigación                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase no responde en `next build` → `generateStaticParams` vacío / build roto               | `getGames()` cae a `FALLBACK_GAME_IDS` (8 slugs en el repo) si la consulta falla o vuelve vacía; criterio de aceptación exige 8 rutas generadas.                     |
| Insert anónimo en `scores` abierto a spam por API                                              | CHECK de formato en `name`, rango en `score` y `level`, y `with check` que limita a juegos con `has_leaderboard`. Rate limit queda fuera de alcance, documentado.    |
| `has_leaderboard` y `REAL_GAME_PLAYERS` se desincronizan (marca real sin motor, o al revés)    | Una sola fila hoy (`rocas`); criterio de aceptación y decisión lo fijan como invariante; el envoltorio solo existe para juegos del registry.                         |
| `get_advisors` marca la política de insert anónimo como hallazgo de seguridad                  | Es intencional y esperado; se documenta en la decisión. Se revisa que no haya **otros** hallazgos.                                                                   |
| Lecturas con el cliente de `server.ts` (cookies) vuelven dinámicas rutas que hoy son estáticas | Todas las lecturas públicas usan `public.ts` (sin cookies); `submitScore` es lo único que usa el cliente de servidor.                                                |
| El overlay React de `rocas` tapa el canvas y deja el loop corriendo detrás                     | El overlay se monta sobre `state = "gameover"`, en el que el motor ya no actualiza (solo repinta el frame); `JUGAR DE NUEVO` llama a `game.restart()`.               |
| `revalidatePath` en un Server Action no refresca una ruta con `dynamic = "force-static"`       | Las rutas usan `revalidate = 60` (ISR), no `force-static`; `revalidatePath` invalida el caché de datos. Criterio de aceptación verifica que la marca propia aparece. |
| Doble disparo de `onGameOver` (StrictMode, transición repetida)                                | El motor dispara el callback una sola vez por partida (flag interno); `restart()` rearma el flag.                                                                    |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`                         | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                                                                                            |

---

## Lo que **no** entra en esta spec

- Auth real, sesión en el Nav, columna `user_id` en `scores`, tabla `profiles`.
- Rate limiting, captcha o moderación de nombres en `scores`.
- Recalcular `games.best` / `games.plays` desde datos reales.
- Portar los otros 7 juegos a motor real o que guarden marcas.
- Marcas reales en la home; Realtime en el leaderboard.
- Panel de administración de juegos (CRUD por UI).
- Fila "TU MEJOR MARCA" personalizada; paginación del leaderboard.
- Migrar `CATS` a datos; retocar los tags hardcodeados de `/juego/[id]`.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
