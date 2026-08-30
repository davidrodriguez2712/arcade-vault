# SPEC game-jam · barriles · 02 — Barriles en la entrada `barriles`: vitrina y catálogo

> **Estado:** Borrador
> **Lote:** game jam «Barriles (clon de Donkey Kong)» — 2026-08-30
> **Depende de:** SPEC 01, SPEC 04, SPEC 06 · motor `01-barriles-motor.md`
> **Fecha:** 2026-08-30
> **Numeración:** local del lote; al aprobar, renumérala como `specs/NN-barriles.md` antes de `/add-game`.
> **Objetivo:** Dar de alta la entrada de catálogo `barriles` (fila nueva en `games`, portada CSS, copy de ficha y presencia en el Salón de la Fama) para el clon de Donkey Kong, cuyo motor vive en `01-barriles-motor.md`.

---

## Por qué existe esta spec

SPEC 04 fijó la ficha del juego (`/juego/[id]`) y el catálogo (`/biblioteca`); SPEC 06 movió el
catálogo a la tabla `games` de Supabase y el Salón de la Fama (`/salon`) a la tabla `scores`, con la
UI ramificando por `game.hasLeaderboard`. Cada juego de la plataforma tiene, por tanto, dos caras: su
**presencia** (fila en `games`, portada, copy, pestaña de Salón) y su **motor** (carpeta en
`app/components/games/`, entrada en `REAL_GAME_PLAYERS`).

Esta spec cubre solo la **presencia** de Barriles. Es una entrada de catálogo **nueva**, `barriles`,
porque ninguna ficha simulada disponible (`gloton`, `invasores`, `duelo-pixel`) representa
temáticamente un clon de Donkey Kong: `gloton` es Pac-Man, `invasores` es Space Invaders y
`duelo-pixel` es Pong; sus tres copys describen con precisión otro clásico distinto. El motor —vigas
escalonadas, escaleras, barriles deterministas, martillo, leaderboard bajo RLS— vive en
`01-barriles-motor.md`, que depende de esta spec como precondición (necesita la fila en `games` para
activar `has_leaderboard`).

Esta spec **no revisa** ninguna decisión de SPEC 04 ni de SPEC 06.

---

## Scope

**In:**

- `supabase/migrations/NN-barriles.sql` (nuevo) — aplicado al proyecto remoto con
  `mcp__supabase__apply_migration`. Esta spec aporta **la mitad de catálogo**: una sentencia
  `insert` en `public.games`. La otra mitad (`update … set has_leaderboard = true`) la añade el motor
  (`01-barriles-motor.md`) al mismo archivo.
  - `insert into public.games (id, title, short, long, cat, cover, color, best, plays, sort_order,
has_leaderboard) values ('barriles', 'BARRILES', '<short>', '<long>', 'ARCADE', 'cover-barriles',
'magenta', 0, '0', 9, false);`
  - `has_leaderboard` nace en `false`; lo activa el motor una vez `barriles` está en
    `REAL_GAME_PLAYERS` (así se mantiene el invariante).
  - La tabla `scores` **ya existe** desde SPEC 06: no se recrea, no se toca su RLS.
- `app/lib/supabase/database.types.ts` — regenerado con `mcp__supabase__generate_typescript_types`
  tras la migración (el esquema no cambia de columnas; se regenera por higiene).
- `app/lib/games.ts` — `barriles` es nuevo:
  - añadir `'barriles'` a `FALLBACK_GAME_IDS` (respaldo de build si Supabase no responde).
  - ampliar `fallbackGame()` para que `hasLeaderboard` incluya `barriles`:
    `hasLeaderboard: id === "rocas" || id === "barriles"`.
- `app/globals.css` — anexar `.cover-barriles` junto a los demás `.cover-*` (bloque "Cover art
  generators (pure CSS)"), arte de portada de **puro CSS** en la paleta neón:
  - fondo `linear-gradient(135deg, #24003a, #0a0a18)`.
  - `::before`: vigas escalonadas en zigzag como bandas diagonales repetidas de `var(--cyan)`
    (`repeating-linear-gradient`), evocando la torre de vigas.
  - `::after`: unos pocos círculos `var(--green)` (barriles) dispuestos en diagonal, con
    `filter: drop-shadow(0 0 6px rgba(255, 0, 110, 0.5))`, y un pequeño triángulo `var(--magenta)`
    (`content: "▲"`) como el peón, cerca de la base.
  - El nombre de la clase es igual al valor de la columna `cover` (`cover-barriles`).
  - **No** redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`,
    `.hall-table*`, `.leaderboard`, `.lb-row`, `.lb-empty`, ni el bloque `.kong-*` del motor.
- Copy de la ficha `/juego/barriles` — lo sirve `getGame("barriles")` desde la fila nueva:
  - `title`: `BARRILES`.
  - `short`: `Esquiva barriles rodantes y trepa hasta lo más alto de la torre.`
  - `long`: `Un gorila de neón lanza barriles rodantes desde lo alto de una torre de vigas
inclinadas. Trepa escaleras, salta los barriles en el momento justo y hazte con el martillo para
destruirlos a golpes. Cada torre superada aprieta el reloj y acelera los barriles: cuanto más
tiempo te quede al llegar arriba, mayor será tu bonificación.`
  - Los tags hardcodeados de la ficha ("1 JUGADOR", estrellas de dificultad) **no** se tocan en esta
    spec — se dejan como en el resto de fichas.
- Presencia en `/salon`: la pestaña `BARRILES` aparece sola en cuanto `game.hasLeaderboard` es `true`
  (lo activa el motor); esta spec solo **verifica** que la pestaña se genera y muestra el estado
  vacío `.lb-empty` mientras `scores` no tenga filas de `barriles`.
- `references/implemented-games.md` — `+1` fila en la tabla:
  `| \`barriles\` | BARRILES | ARCADE | magenta | Esquiva barriles rodantes y trepa hasta lo más
  alto de la torre. |`.
- `CLAUDE.md` — "Stack notes": mencionar `barriles` en el roster del catálogo (9 juegos) y, cuando el
  motor esté, en "Real games". Esta spec solo añade la fila de catálogo; la nota de motor la pone
  `01-barriles-motor.md`.
- Revisión visual con Playwright MCP: screenshots en `.playwright-screenshots/` de `/biblioteca` (la
  tarjeta `BARRILES` con su portada), `/juego/barriles` (ficha con el copy nuevo + aside con datos y
  vacío) y `/salon` (pestaña `BARRILES` con datos y vacía), en escritorio y ~390 px.

**Out of scope (para futuras specs):**

- Todo el motor: `engine.ts`, el envoltorio `kong-player.tsx`, `touch-controls.tsx`, la entrada en
  `REAL_GAME_PLAYERS`, el bloque `.kong-*` de `globals.css` y el `update … set has_leaderboard = true`
  (van en `01-barriles-motor.md`).
- Realtime / paginación del Salón de la Fama.
- Marcas reales en la home (la home sigue con datos simulados).
- Retocar los tags hardcodeados de otras fichas ni los de `/juego/barriles`.
- Recalcular `games.best` / `games.plays` desde datos reales.
- Auth real / columna `user_id` en `scores`.
- Tests automatizados (no hay runner).

---

## Data model

No introduce estructuras nuevas. La fila de `games` sigue el esquema de SPEC 06
(`supabase/migrations/06-tabla-juegos-y-leaderboard.sql`). Valores de la fila nueva:

| Columna           | Valor                                                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | `barriles`                                                                                                                         |
| `title`           | `BARRILES`                                                                                                                         |
| `short`           | `Esquiva barriles rodantes y trepa hasta lo más alto de la torre.`                                                                 |
| `long`            | ver copy de la ficha, arriba                                                                                                       |
| `cat`             | `ARCADE` (check: `ARCADE \| PUZZLE \| SHOOTER \| VERSUS`)                                                                          |
| `cover`           | `cover-barriles`                                                                                                                   |
| `color`           | `magenta` (check: `cyan \| magenta \| yellow \| green`)                                                                            |
| `best`            | `0`                                                                                                                                |
| `plays`           | `'0'`                                                                                                                              |
| `sort_order`      | `9` (siguiente entero libre tras el `8` propuesto por el lote pendiente `specs/game-jam/ciempies`, aún sin aplicar; ver Decisions) |
| `has_leaderboard` | `false` (lo activa `01-barriles-motor.md`)                                                                                         |

En `app/lib/games.ts`, `FALLBACK_GAME_IDS` pasa de 8 a 9 ids con `'barriles'` añadido al final, y
`fallbackGame()` marca `hasLeaderboard: true` también para `barriles`.

---

## Implementation plan

Cada paso deja el sistema compilando y es commitable por separado.

1. **Migración (mitad de catálogo) + tipos + respaldo.** Crear `supabase/migrations/NN-barriles.sql`
   con el `insert` de la fila `barriles` (`has_leaderboard = false`, `sort_order = 9`). Aplicar con
   `mcp__supabase__apply_migration`. Regenerar `app/lib/supabase/database.types.ts`. Añadir
   `'barriles'` a `FALLBACK_GAME_IDS` y ampliar `fallbackGame()` en `app/lib/games.ts`. Verificación:
   `mcp__supabase__list_tables` muestra la fila `barriles` con `has_leaderboard = false`;
   `mcp__supabase__list_migrations` incluye `NN`; `mcp__supabase__get_advisors` (security) no reporta
   nada crítico nuevo; `npm run build` compila y `/biblioteca` lista 9 juegos.

2. **Portada `.cover-barriles`.** Añadir la clase (`+ ::before` / `::after`) a `app/globals.css` junto
   a los demás `.cover-*`. Verificación: `/biblioteca` muestra la tarjeta `BARRILES` con su arte de
   portada; la portada del detalle en `/juego/barriles` usa la misma clase; no hay regresión visual en
   las otras 8 tarjetas.

3. **Copy de la ficha.** Confirmar que `title` / `short` / `long` de la fila describen el juego (torre
   de vigas, barriles rodantes, escaleras, martillo, bono de tiempo). Verificación: `/juego/barriles`
   muestra el copy nuevo en cabecera y descripción; `generateStaticParams` de `/juego/[id]` genera la
   ruta `barriles` sin 404.

4. **Docs.** `references/implemented-games.md` `+1` fila; `CLAUDE.md` "Stack notes" menciona los 9
   juegos del catálogo. Verificación: ambos archivos listan `barriles` con `ARCADE` / `magenta`.

5. **Lint, build y revisión visual.** `npm run lint` y `npm run build` limpios. Screenshots con
   Playwright MCP en `.playwright-screenshots/` de `/biblioteca`, `/juego/barriles` (ficha + aside con
   datos y vacío) y `/salon` (pestaña `BARRILES` con datos y vacía), en escritorio y ~390 px.
   Verificar que el resto del catálogo y de las pestañas del Salón no ha cambiado. Commitear el bloque
   gestionado de `AGENTS.md` / `CLAUDE.md` si `next dev` lo reescribió.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `npm run lint` sin errores ni warnings.
- [ ] `mcp__supabase__list_tables` muestra `public.games` con la fila `barriles`
      (`cat = 'ARCADE'`, `color = 'magenta'`, `cover = 'cover-barriles'`, `sort_order = 9`,
      `has_leaderboard = false`); `mcp__supabase__list_migrations` incluye `NN`.
- [ ] `supabase/migrations/NN-barriles.sql` existe en el repo con el `insert` aplicado.
- [ ] `/biblioteca` lista 9 juegos e incluye la tarjeta `BARRILES` con su portada `.cover-barriles`.
- [ ] `/juego/barriles` renderiza la ficha con el `title` / `short` / `long` nuevos y la portada
      `.cover-barriles`.
- [ ] `generateStaticParams` de `/juego/[id]` y `/juego/[id]/jugar` genera la ruta `barriles`; ningún
      id del catálogo da 404.
- [ ] `FALLBACK_GAME_IDS` en `app/lib/games.ts` contiene `'barriles'` y `getGames()` devuelve 9
      juegos también cuando cae al respaldo; `fallbackGame("barriles").hasLeaderboard === true`.
- [ ] Con `has_leaderboard = false`, `/juego/barriles` y `/salon` muestran datos simulados
      (`seededScores`) para `barriles`; la pestaña de `/salon` reacciona sola cuando el motor active
      el flag.
- [ ] `.cover-barriles` es la **única** clase `.cover-*` nueva; `app/globals.css` no redefine
      `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`, `.hall-table*`,
      `.leaderboard`, `.lb-row` ni `.lb-empty`.
- [ ] `references/implemented-games.md` lista una fila `barriles` (`ARCADE`, `magenta`).
- [ ] `CLAUDE.md` "Stack notes" menciona los 9 juegos del catálogo con `barriles`.
- [ ] Hay screenshots en `.playwright-screenshots/` de `/biblioteca`, `/juego/barriles` y `/salon`
      (pestaña `BARRILES` con datos y vacía), en escritorio y ~390 px.

---

## Decisions

- **Sí:** fila **nueva** en `games` (`barriles`). **No:** reutilizar `gloton` (Pac-Man), `invasores`
  (Space Invaders) o `duelo-pixel` (Pong) — ninguna representa temáticamente un juego de plataformas
  de escalada con barriles; reutilizar cualquiera dejaría su clásico original huérfano y con un copy
  que no describe lo que se juega.
- **Sí:** `cat = ARCADE`. Es un juego de plataformas de un jugador sin encaje limpio en `PUZZLE`,
  `SHOOTER` ni `VERSUS`; `ARCADE` es la categoría "cajón" que ya usan `serpentina` y `ranaria`, otros
  juegos de recorrido/habilidad de un jugador.
- **Sí:** `color = magenta`. Es el color que menos satura la fila actual del catálogo junto a `caida`
  (categoría distinta); el peón y el HUD del motor ya se dibujan en `var(--magenta)`, así que portada
  y juego combinan.
- **Sí:** `sort_order = 9`, no `8`. El siguiente entero libre tras `duelo-pixel` (`7`) sería `8`, pero
  el lote `specs/game-jam/ciempies` (aún en Borrador, sin aplicar) ya propone `sort_order = 8` para
  `ciempies` en su propia spec `02-ciempies-vitrina.md`. Para no chocar si ambos lotes se aprueban,
  esta spec reserva `9`. Si `ciempies` se aprueba con otro valor o se descarta, `sort_order` puede
  renumerarse sin coste antes de aplicar la migración.
- **Sí:** `has_leaderboard` nace en `false` y lo activa el motor. Mantiene el invariante
  `has_leaderboard = true` ⇔ `id` en `REAL_GAME_PLAYERS` en todo momento.
- **Sí:** ampliar `fallbackGame()` para que `hasLeaderboard` incluya `barriles` (no solo `rocas`),
  para que el respaldo de build sin Supabase refleje el estado final una vez el motor esté aplicado.
- **Sí:** copy que nombra las señas de identidad del juego (torre de vigas, barriles, escaleras,
  martillo, bono de tiempo), para que la ficha describa lo que se juega desde el día uno.
- **No:** tocar los tags hardcodeados de la ficha ni la home; van en su propia spec si se hacen.

---

## Risks

| Riesgo                                                                       | Mitigación                                                                                    |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `get_advisors` marca el `insert` anónimo de `scores`                         | Intencional y heredado de SPEC 06; revisar que no aparezcan **otros** hallazgos nuevos.       |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`       | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                     |
| La portada `.cover-barriles` queda ilegible o rota a ~390 px                 | Arte de puro CSS con formas simples; la revisión visual con Playwright a 390 px lo comprueba. |
| `FALLBACK_GAME_IDS` y la siembra de `games` se desincronizan                 | El paso 1 añade `'barriles'` a ambos a la vez; criterio de aceptación dedicado.               |
| El motor se aprueba antes que la vitrina y no existe la fila `barriles`      | Esta spec es `Depende de` del motor; el motor verifica la fila antes de activar el flag.      |
| Choque de `sort_order` con el lote pendiente `ciempies` si ambos se aprueban | Esta spec reserva `9` en vez de `8`; renumerar es trivial antes de aplicar la migración.      |

---

## Lo que **no** entra en esta spec

- El motor `engine.ts`, el envoltorio, los táctiles, el registry y el bloque `.kong-*` de CSS.
- El `update … set has_leaderboard = true` (lo añade el motor a la misma migración).
- Realtime / paginación del Salón; marcas reales en la home.
- Retocar tags hardcodeados de fichas; recalcular `games.best` / `games.plays`.
- Auth real, columna `user_id` en `scores`.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
