# SPEC 02 — Página de inicio (landing) de Arcade Vault

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-27
> **Objetivo:** Portar la landing de `references/templates/home-about/home.jsx` a la ruta `/` del App Router, moviendo la Biblioteca actual a `/biblioteca`.

---

## Por qué existe esta spec

Hoy `/` es la Biblioteca (SPEC 01, implementada). El prototipo `home-about/home.jsx` define una landing de marketing con 6 secciones (hero, features, preview de juegos, métricas, actividad en vivo, precios y CTA final) que aún no existe en el proyecto.

A diferencia de la SPEC 01, esta spec **sí escribe CSS nuevo**: las clases `.home-*`, `.feature-*`, `.mini-*`, `.stat-*`, `.activity-*`, `.pricing-*`, `.reveal` y sus keyframes (`float`, `bounce`, `tickin`) solo viven en `references/templates/home-about/styles.css`, no en `app/globals.css`. Los tokens (`--cyan`, `--gold`, `--bg-2`, `--line-2`, `--silver`, `--bronze`, `--pixel`, `--mono`, etc.) y las clases de chrome (`.av-nav`, `.btn`, `.cover-bg`, `.cover-*`) ya existen y se reutilizan.

Mover la Biblioteca a `/biblioteca` obliga a repuntar los enlaces internos que hoy apuntan a `/` con el sentido de "volver a los juegos".

---

## Scope

**In:**

- Nueva ruta `/` (landing) que reemplaza la Biblioteca actual, con las **6 secciones** de `home.jsx`:
  1. HERO: eyebrow `▸ INSERTA UNA MONEDA_`, título a 3 líneas, subtítulo, 2 CTAs, indicador "DESLIZA ▼" y siluetas pixel flotantes (`FloatingSilhouettes`, 8 SVG).
  2. `// 01` ¿POR QUÉ ARCADE VAULT?: grid de 4 `feature-card` con icono pixel (`FeatureIcon`: GAMEPAD, FREE, TROPHY, ROCKET).
  3. `// 02` JUEGOS DISPONIBLES AHORA: rail de 6 `mini-card` desde `GAMES.slice(0, 6)` + botón "VER TODOS LOS JUEGOS →".
  4. STATS: banda de 3 métricas **derivadas** de `app/lib/` (ver Data model).
  5. `// 03` ACTIVIDAD EN VIVO: `activity-card` "ÚLTIMAS PUNTUACIONES" (ticker) + `activity-card` "TOP JUGADORES · HOY", ambas **derivadas** de `GAMES` / `PLAYERS` / `seededScores`.
  6. `// 04` PRECIOS: `price-card` plan único $0 + `pricing-faq` con 3 preguntas. + FINAL CTA "¿LISTO PARA JUGAR?" con botón "INSERTAR MONEDA →".
- Mover la Biblioteca de SPEC 01 a `/biblioteca`: nueva `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` (hero `av-hero` + `<GameLibrary />`), `metadata.title` "Arcade Vault · Biblioteca".
- Anexar a `app/globals.css` los bloques de CSS de la home portados de `home-about/styles.css` (solo los específicos de la landing, no el chrome ya existente), incluidos sus `@media`.
- Animación de aparición al hacer scroll: hook `useReveal` (IntersectionObserver) portado, añade `.in` a los elementos `.reveal`.
- Actualizar `app/components/site-nav.tsx`: añadir enlace "Inicio" → `/`; "Biblioteca" pasa a `/biblioteca`; `isActive("inicio")` = `pathname === "/"`; `isActive("biblioteca")` = `/biblioteca` o `startsWith("/juego")`. El logo sigue apuntando a `/`.
- Repuntar a `/biblioteca` todos los enlaces internos que hoy van a `/` con sentido "volver a los juegos":
  - `app/components/auth-card.tsx`: `router.push("/")` (submit, "JUGAR COMO INVITADO", 2 botones sociales).
  - `app/components/hall-of-fame.tsx`: `<Link href="/">` "VOLVER A LA BIBLIOTECA".
  - `app/components/player-screen.tsx`: `router.push("/")` "VOLVER AL VAULT".
  - `app/juego/[id]/page.tsx`: `<Link href="/">` "VOLVER AL VAULT".
- CTAs de la landing: "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS", "INSERTAR MONEDA" → `/biblioteca`; "CREAR CUENTA" y "EMPEZAR GRATIS" → `/entrar`; "VER SALÓN →" → `/salon`; click en `mini-card` → `/juego/[id]`.
- `metadata` de `/` con `title` propio ("Arcade Vault · Inicio").
- Revisión visual con Playwright MCP: screenshots de `/` (por sección) contra `references/templates/home-about/arcade-vault-standalone.html`, guardados en `.playwright-screenshots/`.

**Out of scope (para futuras specs):**

- Página "Acerca de" (`home-about/about.jsx`) y su enlace en el Nav. Sus estilos (`.about-*`, `.highlight-*`, `.contact-*`, `.term-*`) **no** se portan.
- El mando decorativo interactivo (`.gp`, `.dp`, `.ab`…) del `arcade-vault-standalone.html`: `home.jsx` no lo usa y queda fuera.
- Datos reales de tráfico, telemetría o "actividad en vivo" real: todo se deriva de los mocks estáticos, sin backend, sin polling, sin timestamps de reloj.
- Sistema de precios / pagos real: la sección PRECIOS es solo texto.
- Sesión de usuario: los CTAs de auth navegan pero no autentican (igual que SPEC 01).
- Redirect `/` → `/biblioteca` server-side o `next.config` para la ruta antigua: `/` ahora es la landing y no redirige.
- Tests automatizados (no hay runner).
- Rediseño responsive más allá de los `@media` que trae el CSS portado.

---

## Data model

No hay base de datos ni persistencia. Se reutiliza el modelo de SPEC 01 (`app/lib/games.ts`, `app/lib/scores.ts`) y se añade un módulo derivado.

`app/lib/home.ts` (nuevo) — funciones puras y deterministas, seguras en servidor (sin `Math.random` directo, sin `Date.now`):

```ts
import { GAMES } from "./games";
import { PLAYERS, seededScores } from "./scores";

export interface StatBlock { n: string; u: string; s: string; }
export interface TickRow { player: string; game: string; score: number; ago: string; color: GameColor; }
export interface TopRow { rank: number; player: string; score: number; }

// STATS: 3 bloques derivados de los mocks.
//  1) n = String(GAMES.length)            u = "JUEGOS"        s = "EN LA BÓVEDA"
//  2) n = suma de GAMES[].plays parseada  u = "PARTIDAS"      s = "JUGADAS EN TOTAL"
//  3) n = String(PLAYERS.length)          u = "JUGADORES"     s = "COMPITEN POR EL TOP"
export const HOME_STATS: StatBlock[];

// TICKER: 7 filas. Para cada uno de los primeros 7 GAMES: fila top de
// seededScores(game.id.length * 17 + 3, 7)[0]; ago = `hace ${(i+1)*3} min`.
export function tickerRows(): TickRow[];

// TOP JUGADORES: seededScores(PLAYERS.length * 29 + 5, 5), mapeado a { rank, player, score }.
export function topPlayers(): TopRow[];
```

Convención de parseo de `plays`: `"12.4K"` → `12400`, `"31.8K"` → `31800`; formateo del total con `toLocaleString("es-ES")`.

Mapa de rutas tras esta spec:

| Ruta          | Archivo                        | Tipo   | Componente cliente        | Cambio          |
| ------------- | ------------------------------ | ------ | ------------------------- | --------------- |
| `/`           | `app/page.tsx`                 | server | `HomeLanding`             | reescrito       |
| `/biblioteca` | `app/biblioteca/page.tsx`      | server | `GameLibrary`             | nuevo (movido)  |
| `/juego/[id]` | `app/juego/[id]/page.tsx`      | server | —                         | 1 enlace        |
| `/entrar`     | `app/entrar/page.tsx`          | server | `AuthCard`                | sin cambio      |
| `/salon`      | `app/salon/page.tsx`           | server | `HallOfFame`              | sin cambio      |
| (layout)      | `app/layout.tsx`               | server | `SiteNav`                 | sin cambio      |

Componentes nuevos bajo `app/components/`:

- `home-landing.tsx` (client, `"use client"`): las 6 secciones + `useReveal`. Recibe por props `stats`, `ticker`, `top` y `previewGames` calculados en el server component `app/page.tsx`.
- `home-silhouettes.tsx` (server): los 8 SVG de `FloatingSilhouettes`.
- `home-feature-icon.tsx` (server): los 4 SVG de `FeatureIcon`.

---

## Implementation plan

1. **CSS de la home.** Anexar al final de `app/globals.css` los bloques portados de `references/templates/home-about/styles.css`: `.home`, `.home-hero`, `.home-hero-inner`, `.hero-eyebrow`, `.home-title` (+ `.line-1/2/3`), `.home-sub`, `.home-ctas`, `.hero-scroll` (+ `.arrow`), `.home-silos` (+ `.silo`, `.s1`–`.s8`), `.home-section`, `.section-head`, `.section-title`, `.section-rule`, `.kicker`, `.feature-grid`, `.feature-card` (+ colores, `:hover`, `.ft-icon/.ft-title/.ft-desc`), `.mini-rail`, `.mini-card`, `.mini-cover`, `.mini-meta`, `.mini-title`, `.mini-cat`, `.home-stats` (+ `::before`), `.stats-inner`, `.stat-block`, `.stat-n/.stat-u/.stat-s`, `.activity-grid`, `.activity-card`, `.ac-head`, `.ac-title`, `.lb-link`, `.ticker`, `.tick-row`, `.tk-p/.tk-mid/.tk-s/.tk-t`, `.top-list`, `.top-row` (+ `top1/2/3`, `::before`), `.tp-rk/.tp-p/.tp-s/.tp-bar`, `.pricing-grid`, `.price-card` (+ `::before`), `.pc-*`, `.pricing-faq`, `.faq-item`, `.faq-q`, `.faq-a`, `.home-final` (+ `::before/::after`), `.final-title`, `.final-cta`, `.final-tag`, `.reveal` (+ `.reveal.in`); keyframes `float`, `bounce`, `tickin`; y los `@media` asociados (980/900/720/600/520 px). No portar `.about-*`, `.highlight-*`, `.contact-*`, `.term-*`, `.gp*`, `.dp*`, `.ab*`, ni redefinir `:root`, `body`, `.av-nav`, `.btn`. `npm run build` pasa; sin cambios visuales todavía.

2. **Mover la Biblioteca a `/biblioteca`.** Crear `app/biblioteca/page.tsx` con el contenido actual de `app/page.tsx` (import de `GameLibrary`, `<section className="av-hero">` + `<GameLibrary />`, `metadata.title` "Arcade Vault · Biblioteca"). Aún no tocar `app/page.tsx`. Verificación: `/biblioteca` se ve igual que `/` hoy; `/` sigue mostrando la Biblioteca.

3. **Repuntar enlaces internos a `/biblioteca`.** En `auth-card.tsx` (4 usos de `router.push("/")`), `hall-of-fame.tsx` (`href="/"`), `player-screen.tsx` (`router.push("/")`), `juego/[id]/page.tsx` (`href="/"`): cambiar `/` por `/biblioteca`. Verificación: desde `/entrar`, `/salon`, `/juego/caida` y `/juego/caida/jugar`, los botones "volver / invitado / social" llevan a `/biblioteca`.

4. **Nav.** Editar `site-nav.tsx`: añadir tipo `"inicio"` a `isActive`; enlace "Inicio" → `/` (activo si `pathname === "/"`); "Biblioteca" → `/biblioteca` (activo si `pathname === "/biblioteca"` o `pathname.startsWith("/juego")`); replicar ambos en el panel móvil. El logo sigue en `/`. Verificación: en `/` se marca "Inicio"; en `/biblioteca` y `/juego/*` se marca "Biblioteca"; el menú móvil muestra los 4 enlaces.

5. **Datos derivados.** Crear `app/lib/home.ts` con `HOME_STATS`, `tickerRows()`, `topPlayers()` según Data model. Sin UI todavía. Verificación: `npm run build` compila; un `console.log` temporal confirma 3 stats, 7 filas de ticker y 5 de top.

6. **Iconos y siluetas.** Crear `app/components/home-silhouettes.tsx` (8 SVG de `FloatingSilhouettes`, `aria-hidden`) y `app/components/home-feature-icon.tsx` (`FeatureIcon` con prop `kind`: GAMEPAD/FREE/TROPHY/ROCKET). Componentes server, markup literal del prototipo. Verificación: `npm run build` pasa.

7. **Landing: hero + features.** Crear `app/components/home-landing.tsx` (`"use client"`) con el hook `useReveal` (IntersectionObserver, `threshold: 0.12`, `unobserve` al entrar) y las secciones HERO (con `<HomeSilhouettes />`, CTAs a `/biblioteca` y `/entrar` vía `<Link>`) y `// 01` features (`.feature-grid` con los 4 datos del prototipo y `<HomeFeatureIcon />`, `transitionDelay` por índice). Reescribir `app/page.tsx` como server component: calcula `previewGames = GAMES.slice(0,6)`, `HOME_STATS`, `tickerRows()`, `topPlayers()` y los pasa a `<HomeLanding />`; `metadata.title` "Arcade Vault · Inicio". Verificación: `/` muestra hero y features; el título del navegador cambió; `/biblioteca` intacta.

8. **Landing: preview de juegos + stats.** Añadir a `home-landing.tsx` la sección `// 02` (`.mini-rail` con `previewGames`, cada `mini-card` es `<Link>` a `/juego/[id]`, cover `"cover-bg " + game.cover`, "VER TODOS LOS JUEGOS →" → `/biblioteca`) y la banda STATS (`.stats-inner` con `stats`). Verificación: 6 tarjetas enlazan al detalle correcto; "VER TODOS" abre `/biblioteca`; las 3 métricas muestran 8 / total de partidas / 18.

9. **Landing: actividad en vivo.** Añadir la sección `// 03`: `.activity-card` "▸ ÚLTIMAS PUNTUACIONES" con `.ticker` (filas de `ticker`, `animationDelay` por índice, score con `toLocaleString("es-ES")`) y `.activity-card` "▸ TOP JUGADORES · HOY" con `.top-list` (`top`, clases `top1/top2/top3`, barra `tp-fill` con `width: (100 - i*16) + "%"`, "VER SALÓN →" → `/salon`). Verificación: 7 filas en el ticker, 5 en el top, "VER SALÓN" abre `/salon`.

10. **Landing: precios + CTA final.** Añadir la sección `// 04` (`.pricing-grid`: `.price-card` con lista de 6 ítems y "EMPEZAR GRATIS →" → `/entrar`; `.pricing-faq` con las 3 preguntas del prototipo) y `.home-final` ("¿LISTO PARA JUGAR?" + "INSERTAR MONEDA →" → `/biblioteca`). Todas las secciones salvo el hero llevan `className="... reveal"`. Verificación: `/` renderiza las 6 secciones; al hacer scroll, cada sección aparece con la transición `.reveal`.

11. **Revisión visual con Playwright.** `npm run dev`; navegar a `http://localhost:3000/`; capturar screenshots por sección (hero, features, preview, stats, actividad, precios+final) en `.playwright-screenshots/`; contrastar cada una con la sección equivalente de `references/templates/home-about/arcade-vault-standalone.html`. Ajustar diferencias de spacing/color que no vengan del CSS portado. Repetir para viewport móvil (~390 px). Leer la consola del navegador: 0 errores, 0 warnings de hydration.

12. **Limpieza.** `npm run lint` y `npm run build` sin errores ni warnings. Quitar cualquier `console.log` temporal e imports sin usar. Confirmar que no quedan `href="/"` ni `router.push("/")` con sentido "biblioteca" fuera del logo del Nav.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores y prerenderiza `/`, `/biblioteca`, `/juego/[id]` (8), `/juego/[id]/jugar` (8), `/entrar` y `/salon`.
- [ ] `npm run lint` no reporta errores ni warnings.
- [ ] `/` no emite errores ni warnings en consola, incluido hydration mismatch.
- [ ] `/` muestra en orden: HERO, `// 01` ¿POR QUÉ ARCADE VAULT?, `// 02` JUEGOS DISPONIBLES AHORA, STATS, `// 03` ACTIVIDAD EN VIVO, `// 04` PRECIOS y CTA final "¿LISTO PARA JUGAR?".
- [ ] El HERO muestra las siluetas pixel flotantes animadas y el título a 3 líneas "EL ARCADE / CLÁSICO ESTÁ / DE VUELTA".
- [ ] La sección `// 01` muestra 4 `feature-card` (JUEGOS CLÁSICOS, 100% GRATIS, LADDER BOARDS, SIEMPRE CRECIENDO) cada una con su icono pixel.
- [ ] La sección `// 02` muestra 6 tarjetas; cada una abre `/juego/<id>` del juego correspondiente; "VER TODOS LOS JUEGOS →" abre `/biblioteca`.
- [ ] La banda STATS muestra `8` / `JUEGOS`, la suma de partidas de los 8 juegos formateada, y `18` / `JUGADORES`.
- [ ] El ticker "ÚLTIMAS PUNTUACIONES" muestra 7 filas (jugador ▸ juego, +score, "hace N min"); "TOP JUGADORES · HOY" muestra 5 filas con top1/top2/top3 resaltados y "VER SALÓN →" abre `/salon`.
- [ ] Las mismas filas del ticker y del top se renderizan idénticas en recarga (deterministas, sin hydration mismatch).
- [ ] La sección PRECIOS muestra la tarjeta "$0 / SIEMPRE" con 6 ítems y 3 preguntas frecuentes; "EMPEZAR GRATIS →" abre `/entrar`.
- [ ] El botón "INSERTAR MONEDA →" del CTA final abre `/biblioteca`.
- [ ] Al hacer scroll, cada sección con clase `reveal` pasa a opacidad total (recibe `.in`).
- [ ] `/biblioteca` muestra el mismo hero y la misma `GameLibrary` que antes tenía `/` (buscador, chips, estado vacío "NO HAY RESULTADOS").
- [ ] El Nav muestra "Inicio", "Biblioteca", "Salón de la Fama" e "Iniciar Sesión"; "Inicio" está activo en `/`, "Biblioteca" en `/biblioteca` y en `/juego/*`.
- [ ] El logo del Nav lleva a `/`.
- [ ] Desde `/entrar`, enviar el formulario, "JUGAR COMO INVITADO" o un botón social navega a `/biblioteca`.
- [ ] "VOLVER A LA BIBLIOTECA" en `/salon`, "VOLVER AL VAULT" en `/juego/<id>` y en `/juego/<id>/jugar` llevan a `/biblioteca`.
- [ ] `/` tiene `<title>` "Arcade Vault · Inicio", distinto del de `/biblioteca` ("Arcade Vault · Biblioteca").
- [ ] Existen screenshots de `/` por sección en `.playwright-screenshots/` y coinciden visualmente con `arcade-vault-standalone.html`.
- [ ] `app/globals.css` no redefine `:root`, `body`, `.av-nav` ni `.btn`; solo añade las clases de la home.
- [ ] No hay acceso a `localStorage` / IndexedDB / red ni ningún `Date.now()` / `Math.random()` en el render de la landing.

---

## Decisions

- **Sí:** la landing ocupa `/` y la Biblioteca se mueve a `/biblioteca`. Es lo idiomático para una web con página de marketing; da una URL limpia a cada cosa.
- **No:** landing en `/inicio` dejando la Biblioteca en `/`. Menos trabajo pero deja la landing como pantalla de segunda.
- **No:** redirect server-side de la Biblioteca antigua. `/` cambia de contenido, no de destino; no hay enlaces externos que preservar.
- **Sí:** portar CSS nuevo a `app/globals.css` (un único archivo, coherente con Tailwind v4 CSS-first). Se copian solo los bloques de la home; el chrome ya existe.
- **No:** archivo `app/home.css` aparte. Rompería el patrón de un solo `globals.css`.
- **Sí:** las 6 secciones del prototipo, incluidas STATS, ACTIVIDAD y PRECIOS. Es un MVP visual; recortar secciones aleja el resultado del diseño de referencia.
- **Sí:** STATS y ACTIVIDAD **derivadas** de `GAMES` / `PLAYERS` / `seededScores` en `app/lib/home.ts`, no hardcodeadas. Evita cifras que contradicen los datos reales ("12+" con 8 juegos) y centraliza el mock.
- **No:** ticker con datos hardcodeados literales del prototipo. Quedarían desincronizados de `GAMES`.
- **Sí:** funciones deterministas sin `Math.random` / `Date.now` en `home.ts`, calculadas en el server component y pasadas por props. Sin hydration mismatch.
- **Sí:** todos los CTA de "explorar / jugar / insertar moneda" y los redirects post-auth van a `/biblioteca`. "El Vault" en la UI = la Biblioteca de juegos, no la landing.
- **Sí:** añadir "Inicio" al Nav; el logo también lleva a `/`.
- **No:** añadir "Acerca de" al Nav ni portar `about.jsx`. Amplía el alcance; va en su propia spec.
- **No:** portar el mando decorativo (`.gp`/`.dp`/`.ab`) del `arcade-vault-standalone.html`. `home.jsx` no lo usa.
- **Sí:** `home-landing.tsx` como único client component (con `useReveal`); las siluetas y los iconos como server components hijos. `home.jsx` también es un solo componente.
- **Sí:** revisión visual con Playwright MCP y screenshots por sección en `.playwright-screenshots/`, como criterio de aceptación.

---

## Risks

| Riesgo                                                                        | Mitigación                                                                                                  |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Enlaces internos a `/` sin repuntar tras mover la Biblioteca                  | Paso 3 dedicado + criterio de aceptación explícito + `grep` de `href="/"` / `router.push("/")` en el paso 12. |
| Colisión de nombres de clase entre el CSS portado y `app/globals.css`         | El paso 1 lista las clases exactas a portar y prohíbe redefinir `:root`, `body`, `.av-nav`, `.btn`.        |
| Hydration mismatch en ticker / top / stats                                    | Datos deterministas en `home.ts`, calculados en server y pasados por props; `IntersectionObserver` en `useEffect`. |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`        | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                                  |
| Divergencia visual con el prototipo por Preflight de Tailwind                 | Paso 11: contrastar cada sección contra `arcade-vault-standalone.html` con Playwright, en desktop y móvil. |
| Preview de juegos usa `cover-bg` + `game.cover`; alguna clase `cover-*` falta | Verificar en el paso 8 que las 6 portadas de `GAMES.slice(0,6)` renderizan (las clases ya están en `globals.css` desde SPEC 01). |

---

## Lo que **no** entra en esta spec

- Página "Acerca de" y su enlace en el Nav (estilos `.about-*`, `.contact-*`, `.term-*` incluidos).
- El mando arcade decorativo interactivo del `arcade-vault-standalone.html`.
- Datos de actividad reales, telemetría, polling o timestamps de reloj.
- Precios / pagos reales.
- Sesión de usuario y autenticación real.
- Redirect de la ruta antigua de la Biblioteca.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
