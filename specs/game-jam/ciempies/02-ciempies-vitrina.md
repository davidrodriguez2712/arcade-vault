# SPEC game-jam · ciempies · 02 — Ciempiés en la entrada `ciempies`: vitrina y catálogo

> **Estado:** Borrador
> **Lote:** game jam «Ciempiés (Centipede)» — 2026-08-29
> **Depende de:** SPEC 01, SPEC 04, SPEC 06 · motor `01-ciempies-motor.md`
> **Fecha:** 2026-08-29
> **Numeración:** local del lote; al aprobar, renumérala como `specs/NN-ciempies.md` antes de `/add-game`.
> **Objetivo:** Dar de alta la entrada de catálogo `ciempies` (fila nueva en `games`, portada CSS, copy de ficha y presencia en el Salón de la Fama) para el juego Ciempiés, cuyo motor vive en `01-ciempies-motor.md`.

---

## Por qué existe esta spec

SPEC 04 fijó la ficha del juego (`/juego/[id]`) y el catálogo (`/biblioteca`); SPEC 06 movió el
catálogo a la tabla `games` de Supabase y el Salón de la Fama (`/salon`) a la tabla `scores`, con la
UI ramificando por `game.hasLeaderboard`. Cada juego de la plataforma tiene, por tanto, dos caras: su
**presencia** (fila en `games`, portada, copy, pestaña de Salón) y su **motor** (carpeta en
`app/components/games/`, entrada en `REAL_GAME_PLAYERS`).

Esta spec cubre solo la **presencia** de Ciempiés. Es una entrada de catálogo **nueva**, `ciempies`,
porque ninguna ficha simulada disponible (`gloton`, `invasores`, `ranaria`, `duelo-pixel`) representa
temáticamente a Ciempiés: `invasores` es la reservada a Space Invaders y su copy lo describe con
precisión. El motor —campo de setas, ciempiés que se trocea, araña, leaderboard bajo RLS— vive en
`01-ciempies-motor.md`, que depende de esta spec como precondición (necesita la fila en `games` para
activar `has_leaderboard`).

Esta spec **no revisa** ninguna decisión de SPEC 04 ni de SPEC 06.

---

## Scope

**In:**

- `supabase/migrations/NN-ciempies.sql` (nuevo) — aplicado al proyecto remoto con
  `mcp__supabase__apply_migration`. Esta spec aporta **la mitad de catálogo**: una sentencia
  `insert` en `public.games`. La otra mitad (`update … set has_leaderboard = true`) la añade el motor
  (`01-ciempies-motor.md`) al mismo archivo.
  - `insert into public.games (id, title, short, long, cat, cover, color, best, plays, sort_order,
has_leaderboard) values ('ciempies', 'CIEMPIÉS', '<short>', '<long>', 'SHOOTER', 'cover-ciempies',
'magenta', 0, '0', 8, false);`
  - `has_leaderboard` nace en `false`; lo activa el motor una vez `ciempies` está en
    `REAL_GAME_PLAYERS` (así se mantiene el invariante).
  - La tabla `scores` **ya existe** desde SPEC 06: no se recrea, no se toca su RLS.
- `app/lib/supabase/database.types.ts` — regenerado con `mcp__supabase__generate_typescript_types`
  tras la migración (el esquema no cambia de columnas; se regenera por higiene).
- `app/lib/games.ts` — `ciempies` es nuevo:
  - añadir `'ciempies'` a `FALLBACK_GAME_IDS` (respaldo de build si Supabase no responde).
  - `fallbackGame()` deja `hasLeaderboard` como está: el respaldo de build sin Supabase no marca
    leaderboard para los juegos añadidos después de `rocas` (mismo criterio aceptado en SPEC 07–09).
- `app/globals.css` — anexar `.cover-ciempies` junto a los demás `.cover-*` (bloque "Cover art
  generators (pure CSS)"), arte de portada de **puro CSS** en la paleta neón:
  - fondo `linear-gradient(135deg, #24003a, #0a0a18)`.
  - `::after`: un ciempiés serpenteante de puntos `var(--magenta)` bajando en diagonal (varios
    `radial-gradient`) más un puñado de setas `var(--green)` dispersas, con `filter: drop-shadow(0 0
6px rgba(255, 0, 110, 0.55))`.
  - `::before`: un pequeño cañón triangular `var(--yellow)` (`content: "▲"`) centrado en la base.
  - El nombre de la clase es igual al valor de la columna `cover` (`cover-ciempies`).
  - **No** redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`,
    `.hall-table*`, `.leaderboard`, `.lb-row`, `.lb-empty`, ni el bloque `.centipede-*` del motor.
- Copy de la ficha `/juego/ciempies` — lo sirve `getGame("ciempies")` desde la fila nueva:
  - `title`: `CIEMPIÉS`.
  - `short`: `Fumiga el ciempiés que serpentea por el campo de setas.`
  - `long`: `Un ciempiés de neón baja serpenteando entre un campo de setas fosforescentes. Dispara
desde tu franja inferior para trocearlo: cada segmento que revientas deja una seta nueva y la
cadena se parte en dos. Entre oleada y oleada, la araña cruza a saltos comiéndose el campo.`
  - Los tags hardcodeados de la ficha ("1 JUGADOR", estrellas de dificultad) **no** se tocan en esta
    spec — se dejan como en el resto de fichas.
- Presencia en `/salon`: la pestaña `CIEMPIÉS` aparece sola en cuanto `game.hasLeaderboard` es `true`
  (lo activa el motor); esta spec solo **verifica** que la pestaña se genera y muestra el estado
  vacío `.lb-empty` mientras `scores` no tenga filas de `ciempies`.
- `references/implemented-games.md` — `+1` fila en la tabla:
  `| \`ciempies\` | CIEMPIÉS | SHOOTER | magenta | Fumiga el ciempiés que serpentea por el campo de
  setas. |`.
- `CLAUDE.md` — "Stack notes": mencionar `ciempies` en el roster del catálogo (9 juegos) y, cuando el
  motor esté, en "Real games". Esta spec solo añade la fila de catálogo; la nota de motor la pone
  `01-ciempies-motor.md`.
- Revisión visual con Playwright MCP: screenshots en `.playwright-screenshots/` de `/biblioteca` (la
  tarjeta `CIEMPIÉS` con su portada), `/juego/ciempies` (ficha con el copy nuevo + aside con datos y
  vacío) y `/salon` (pestaña `CIEMPIÉS` con datos y vacía), en escritorio y ~390 px.

**Out of scope (para futuras specs):**

- Todo el motor: `engine.ts`, el envoltorio `centipede-player.tsx`, `touch-controls.tsx`, la entrada
  en `REAL_GAME_PLAYERS`, el bloque `.centipede-*` de `globals.css` y el `update … set
has_leaderboard = true` (van en `01-ciempies-motor.md`).
- Realtime / paginación del Salón de la Fama.
- Marcas reales en la home (la home sigue con datos simulados).
- Retocar los tags hardcodeados de otras fichas ni los de `/juego/ciempies`.
- Recalcular `games.best` / `games.plays` desde datos reales.
- Auth real / columna `user_id` en `scores`.
- Tests automatizados (no hay runner).

---

## Data model

No introduce estructuras nuevas. La fila de `games` sigue el esquema de SPEC 06
(`supabase/migrations/06-tabla-juegos-y-leaderboard.sql`). Valores de la fila nueva:

| Columna           | Valor                                                      |
| ----------------- | ---------------------------------------------------------- |
| `id`              | `ciempies`                                                 |
| `title`           | `CIEMPIÉS`                                                 |
| `short`           | `Fumiga el ciempiés que serpentea por el campo de setas.`  |
| `long`            | ver copy de la ficha, arriba                               |
| `cat`             | `SHOOTER` (check: `ARCADE \| PUZZLE \| SHOOTER \| VERSUS`) |
| `cover`           | `cover-ciempies`                                           |
| `color`           | `magenta` (check: `cyan \| magenta \| yellow \| green`)    |
| `best`            | `0`                                                        |
| `plays`           | `'0'`                                                      |
| `sort_order`      | `8` (siguiente entero libre tras el `7` de `duelo-pixel`)  |
| `has_leaderboard` | `false` (lo activa `01-ciempies-motor.md`)                 |

En `app/lib/games.ts`, `FALLBACK_GAME_IDS` pasa de 8 a 9 ids con `'ciempies'` añadido al final.

---

## Implementation plan

Cada paso deja el sistema compilando y es commitable por separado.

1. **Migración (mitad de catálogo) + tipos + respaldo.** Crear `supabase/migrations/NN-ciempies.sql`
   con el `insert` de la fila `ciempies` (`has_leaderboard = false`, `sort_order = 8`). Aplicar con
   `mcp__supabase__apply_migration`. Regenerar `app/lib/supabase/database.types.ts`. Añadir
   `'ciempies'` a `FALLBACK_GAME_IDS` en `app/lib/games.ts`. Verificación: `mcp__supabase__list_tables`
   muestra la fila `ciempies` con `has_leaderboard = false`; `mcp__supabase__list_migrations` incluye
   `NN`; `mcp__supabase__get_advisors` (security) no reporta nada crítico nuevo; `npm run build`
   compila y `/biblioteca` lista 9 juegos.

2. **Portada `.cover-ciempies`.** Añadir la clase (`+ ::before` / `::after`) a `app/globals.css` junto
   a los demás `.cover-*`. Verificación: `/biblioteca` muestra la tarjeta `CIEMPIÉS` con su arte de
   portada; la portada del detalle en `/juego/ciempies` usa la misma clase; no hay regresión visual
   en las otras 8 tarjetas.

3. **Copy de la ficha.** Confirmar que `title` / `short` / `long` de la fila describen el juego
   (campo de setas, ciempiés que se trocea, oleadas, araña). Verificación: `/juego/ciempies` muestra
   el copy nuevo en cabecera y descripción; `generateStaticParams` de `/juego/[id]` genera la ruta
   `ciempies` sin 404.

4. **Docs.** `references/implemented-games.md` `+1` fila; `CLAUDE.md` "Stack notes" menciona los 9
   juegos del catálogo. Verificación: ambos archivos listan `ciempies` con `SHOOTER` / `magenta`.

5. **Lint, build y revisión visual.** `npm run lint` y `npm run build` limpios. Screenshots con
   Playwright MCP en `.playwright-screenshots/` de `/biblioteca`, `/juego/ciempies` (ficha + aside
   con datos y vacío) y `/salon` (pestaña `CIEMPIÉS` con datos y vacía), en escritorio y ~390 px.
   Verificar que el resto del catálogo y de las pestañas del Salón no ha cambiado. Commitear el bloque
   gestionado de `AGENTS.md` / `CLAUDE.md` si `next dev` lo reescribió.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `npm run lint` sin errores ni warnings.
- [ ] `mcp__supabase__list_tables` muestra `public.games` con la fila `ciempies`
      (`cat = 'SHOOTER'`, `color = 'magenta'`, `cover = 'cover-ciempies'`, `sort_order = 8`,
      `has_leaderboard = false`); `mcp__supabase__list_migrations` incluye `NN`.
- [ ] `supabase/migrations/NN-ciempies.sql` existe en el repo con el `insert` aplicado.
- [ ] `/biblioteca` lista 9 juegos e incluye la tarjeta `CIEMPIÉS` con su portada `.cover-ciempies`.
- [ ] `/juego/ciempies` renderiza la ficha con el `title` / `short` / `long` nuevos y la portada
      `.cover-ciempies`.
- [ ] `generateStaticParams` de `/juego/[id]` y `/juego/[id]/jugar` genera la ruta `ciempies`; ningún
      id del catálogo da 404.
- [ ] `FALLBACK_GAME_IDS` en `app/lib/games.ts` contiene `'ciempies'` y `getGames()` devuelve 9
      juegos también cuando cae al respaldo.
- [ ] Con `has_leaderboard = false`, `/juego/ciempies` y `/salon` muestran datos simulados
      (`seededScores`) para `ciempies`; la pestaña de `/salon` reacciona sola cuando el motor active
      el flag.
- [ ] `.cover-ciempies` es la **única** clase `.cover-*` nueva; `app/globals.css` no redefine `:root`,
      `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`, `.podium*`, `.hall-table*`, `.leaderboard`,
      `.lb-row` ni `.lb-empty`.
- [ ] `references/implemented-games.md` lista una fila `ciempies` (`SHOOTER`, `magenta`).
- [ ] `CLAUDE.md` "Stack notes" menciona los 9 juegos del catálogo con `ciempies`.
- [ ] Hay screenshots en `.playwright-screenshots/` de `/biblioteca`, `/juego/ciempies` y `/salon`
      (pestaña `CIEMPIÉS` con datos y vacía), en escritorio y ~390 px.

---

## Decisions

- **Sí:** fila **nueva** en `games` (`ciempies`). **No:** reutilizar `invasores` — es la ficha de
  Space Invaders (su copy: "filas alienígenas", "formación tras formación"); reutilizarla dejaría
  Space Invaders sin hueco y con un copy que no describe lo que se juega. `gloton` / `ranaria` /
  `duelo-pixel` representan otros clásicos y tampoco encajan.
- **Sí:** `cat = SHOOTER`. Ciempiés es un shooter de campo fijo: un cañón dispara hacia arriba a
  enemigos que descienden. Encaja con la categoría igual que `rocas` e `invasores`.
- **Sí:** `color = magenta`. Los otros dos shooters ya usan `yellow` (`rocas`) y `green`
  (`invasores`); `magenta` distingue la tarjeta y solo lo comparte `caida` (categoría distinta). El
  ciempiés de neón se dibuja en `var(--magenta)` en el motor, así que portada y juego combinan.
- **Sí:** `sort_order = 8`, el siguiente entero libre tras `duelo-pixel` (7). El juego nuevo va al
  final del catálogo.
- **Sí:** `has_leaderboard` nace en `false` y lo activa el motor. Mantiene el invariante
  `has_leaderboard = true` ⇔ `id` en `REAL_GAME_PLAYERS` en todo momento.
- **Sí:** copy que nombra las tres señas del juego (campo de setas, troceado del ciempiés, araña
  entre oleadas), para que la ficha describa lo que se juega desde el día uno.
- **No:** tocar los tags hardcodeados de la ficha ni la home; van en su propia spec si se hacen.

---

## Risks

| Riesgo                                                                  | Mitigación                                                                                    |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `get_advisors` marca el `insert` anónimo de `scores`                    | Intencional y heredado de SPEC 06; revisar que no aparezcan **otros** hallazgos nuevos.       |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`  | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                     |
| La portada `.cover-ciempies` queda ilegible o rota a ~390 px            | Arte de puro CSS con formas simples; la revisión visual con Playwright a 390 px lo comprueba. |
| `FALLBACK_GAME_IDS` y la siembra de `games` se desincronizan            | El paso 1 añade `'ciempies'` a ambos a la vez; criterio de aceptación dedicado.               |
| El motor se aprueba antes que la vitrina y no existe la fila `ciempies` | Esta spec es `Depende de` del motor; el motor verifica la fila antes de activar el flag.      |

---

## Lo que **no** entra en esta spec

- El motor `engine.ts`, el envoltorio, los táctiles, el registry y el bloque `.centipede-*` de CSS.
- El `update … set has_leaderboard = true` (lo añade el motor a la misma migración).
- Realtime / paginación del Salón; marcas reales en la home.
- Retocar tags hardcodeados de fichas; recalcular `games.best` / `games.plays`.
- Auth real, columna `user_id` en `scores`.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
