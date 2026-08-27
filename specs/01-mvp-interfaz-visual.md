# SPEC 01 — MVP de interfaz visual: las 5 pantallas de Arcade Vault

> **Estado:** Implementado
> **Depende de:** —
> **Fecha:** 2026-08-27
> **Objetivo:** Implementar como rutas de Next las 5 pantallas del prototipo de `references/templates/` (biblioteca, detalle, reproductor, autenticación y salón de la fama), solo la capa visual, sin lógica de juego ni backend.

---

## Por qué existe esta spec

El tema global ya está en el proyecto (`app/globals.css` porta `references/templates/styles.css` y las fuentes se cargan con `next/font`, commit `1e25522`). Falta convertir el prototipo — hoy un SPA con router hash y Babel en el navegador (`references/templates/*.jsx`) — en pantallas reales del App Router. Esta spec cubre únicamente el aspecto visual para tener un MVP navegable; los juegos, la autenticación real y la persistencia son specs posteriores.

`app/globals.css` ya contiene **todas** las clases que estas pantallas necesitan (`.av-detail`, `.leaderboard`, `.av-player`, `.crt*`, `.game-arena*`, `.modal*`, `.av-auth-wrap`, `.auth-*`, `.av-hall`, `.podium*`, `.hall-table`, etc.). No se escribe CSS nuevo salvo ajustes puntuales.

---

## Scope

**In:**

- 5 rutas del App Router con nombres en español:
  - `/` — Biblioteca (reemplaza el `app/page.tsx` demo actual).
  - `/juego/[id]` — Detalle de juego + tabla de mejores puntuaciones.
  - `/juego/[id]/jugar` — Reproductor: marco CRT, HUD y modal de fin de partida.
  - `/entrar` — Autenticación (formularios visuales).
  - `/salon` — Salón de la Fama.
- Nav y footer compartidos, movidos a `app/layout.tsx`, presentes en las 5 rutas.
- Interacciones de UI como client components: buscador y chips de categoría en la biblioteca, tilt 3D de las tarjetas, tabs de `/entrar`, tabs por juego en `/salon`, menú móvil del Nav, y en el reproductor: contador de puntos falso animado, nivel, pausa y modal de fin de partida.
- Animaciones decorativas del reproductor (arena CSS con naves/enemigos a la deriva, contador que sube solo cada ~220 ms). Sin input ni reglas.
- Datos mock estáticos en `app/lib/` portados de `references/templates/data.jsx` (`GAMES`, `CATS`, `PLAYERS`, `seededScores`).
- Prerender estático de `/juego/[id]` y `/juego/[id]/jugar` con `generateStaticParams`.
- `metadata` por ruta (título distinto por pantalla).
- `notFound()` cuando el `id` de juego no existe.

**Out of scope (para futuras specs):**

- Cualquier lógica de juego real (input, colisiones, reglas, game loop).
- Autenticación real, sesión de usuario, y la fila "TU MEJOR MARCA" del salón (queda fuera al no haber sesión).
- Persistencia: el botón "GUARDAR PUNTUACIÓN" solo dispara la animación de confirmación, no guarda nada. Sin localStorage, sin base de datos, sin API routes.
- Créditos / monedas reales (el contador del Nav es texto fijo `CRÉDITOS · 03`).
- Botones sociales funcionales (Google / GitHub) y proveedores OAuth.
- Tests (no hay runner configurado en el proyecto).
- Rediseño responsive más allá de los media queries que ya trae `globals.css`.
- i18n / textos en otro idioma que no sea el español del prototipo.

---

## Data model

Sin base de datos ni persistencia. Solo se amplían los datos mock estáticos.

`app/lib/games.ts` (hoy existe con campos reducidos) pasa a:

```ts
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;      // slug, p. ej. "bloque-buster"
  title: string;
  short: string;   // descripción corta (tarjeta)
  long: string;    // descripción larga (detalle)  — NUEVO
  cat: string;     // "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS"
  cover: string;   // clase CSS del cover art, p. ej. "cover-bricks"
  color: GameColor;
  best: number;
  plays: string;   // p. ej. "12.4K"              — NUEVO
}

export const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"] as const;
export const GAMES: Game[] = [ /* los 8 juegos de data.jsx, con long y plays */ ];
```

`app/lib/scores.ts` (nuevo), portado literal de `data.jsx`:

```ts
export const PLAYERS: string[] = [ /* 18 alias de data.jsx */ ];

export interface ScoreRow { rank: number; name: string; score: number; date: string; }

// Generador determinista (mismo seed → mismas filas). Sin Math.random:
// seguro para render en servidor y sin hydration mismatch.
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Convención de seeds (igual que el prototipo): detalle usa `id.length * 17 + 3`, salón usa `tab.length * 23 + 7`.

Mapa de rutas:

| Ruta                    | Archivo                             | Tipo    | Componente cliente             |
| ----------------------- | ----------------------------------- | ------- | ------------------------------ |
| `/`                     | `app/page.tsx`                      | server  | `GameLibrary`, `GameCard`      |
| `/juego/[id]`           | `app/juego/[id]/page.tsx`           | server  | —                              |
| `/juego/[id]/jugar`     | `app/juego/[id]/jugar/page.tsx`     | server  | `PlayerScreen`                 |
| `/entrar`               | `app/entrar/page.tsx`               | server  | `AuthCard`                     |
| `/salon`                | `app/salon/page.tsx`                | server  | `HallOfFame`                   |
| (layout)                | `app/layout.tsx`                    | server  | `SiteNav`                      |

Componentes nuevos bajo `app/components/`: `site-nav.tsx` (client), `site-footer.tsx` (server), `game-card.tsx` (client), `game-library.tsx` (client), `player-screen.tsx` (client), `auth-card.tsx` (client), `hall-of-fame.tsx` (client).

---

## Implementation plan

1. **Ampliar datos mock.** Editar `app/lib/games.ts`: añadir `long` y `plays` a los 8 juegos y al tipo `Game` (valores de `references/templates/data.jsx`). Crear `app/lib/scores.ts` con `PLAYERS`, `ScoreRow` y `seededScores` portados de `data.jsx`. Sin cambios visuales. `npm run build` pasa.

2. **Nav compartido.** Crear `app/components/site-nav.tsx` (client: `"use client"`, enlace activo por `usePathname`, estado `open` para `.av-mobile-panel` / `.av-mobile-backdrop`, enlaces `Biblioteca`→`/`, `Salón de la Fama`→`/salon`, botón `Iniciar Sesión`→`/entrar` con `<Link>`). Crear `app/components/site-footer.tsx` (server, el `<footer>` de `app.jsx`). Verificación manual: el Nav y el footer aparecen; el menú móvil abre y cierra por debajo de 840 px.

3. **Layout.** Editar `app/layout.tsx`: dentro de `<div id="root">` renderizar `<SiteNav />`, `<main className="av-main">{children}</main>` y `<SiteFooter />`. Verificación: las rutas existentes siguen compilando y muestran el chrome común.

4. **Biblioteca.** Crear `app/components/game-card.tsx` (client: tilt 3D con `onMouseMove` / `onMouseLeave` como en `biblioteca.jsx`; "JUGAR" y click en la tarjeta van con `<Link>` a `/juego/[id]`). Crear `app/components/game-library.tsx` (client: input de búsqueda + chips `CATS`, filtra `GAMES` por título y categoría, estado vacío "NO HAY RESULTADOS"). Reescribir `app/page.tsx`: `<section className="av-hero">` (h1 `flicker` + sub con `blink`) + `<GameLibrary />`. Verificación: `/` coincide con `biblioteca.jsx`; buscar "ca" filtra; chip "PUZZLE" filtra; vaciar resultados muestra el estado vacío.

5. **Detalle.** Crear `app/juego/[id]/page.tsx` (server): `generateStaticParams` desde `GAMES`, `generateMetadata` con `game.title`, `notFound()` si no existe. Render de `.av-detail`: cover, `.detail-tags`, `<h2>` neón, `game.long`, `.stat-strip` (`plays`, `best`, dificultad fija `★ ★ ★ ☆ ☆`), `.detail-actions` (`▶ JUGAR AHORA`→`/juego/[id]/jugar`, `VOLVER AL VAULT`→`/`) y `.leaderboard` con `seededScores(id.length*17+3, 10)`. Verificación: `/juego/caida` coincide con `detalle.jsx`; `/juego/inexistente` da 404.

6. **Reproductor.** Crear `app/components/player-screen.tsx` (client): estados `score`/`level`/`paused`/`over`, `setInterval` de 220 ms que sube `score` (parado si `paused` o `over`), subida de `level` cada 2500 puntos, HUD (`.player-hud` con jugador `INVITADO`, puntuación, vidas `♥ ♥ ♥`, nivel), botones `PAUSA`/`FIN`/`SALIR`, `.crt` con `.game-arena` (grid-floor + enemies + player-ship) y overlay `EN PAUSA`, y modal `.modal-bd` cuando `over` (puntuación final, input "TUS INICIALES" + "GUARDAR PUNTUACIÓN" que solo cambia a `.toast-saved`, "JUGAR DE NUEVO" reinicia, "VOLVER AL VAULT"→`/`). Crear `app/juego/[id]/jugar/page.tsx` (server): `generateStaticParams`, `notFound()`, pasa `game.title` a `<PlayerScreen />`. Verificación: `/juego/caida/jugar` coincide con `reproductor.jsx`; el contador sube; PAUSA lo detiene y muestra el overlay; FIN abre el modal; GUARDAR muestra el toast.

7. **Autenticación.** Crear `app/components/auth-card.tsx` (client): tab `in` / `up`, campo email visible solo en `up` con `.slide-in`, `onSubmit` hace `preventDefault` + `router.push("/")`, "JUGAR COMO INVITADO" y los botones sociales también van a `/`. Crear `app/entrar/page.tsx` (server) que lo monta en `.av-auth-wrap`. Verificación: `/entrar` coincide con `auth.jsx`; cambiar a "CREAR CUENTA" revela el campo de correo; enviar navega a `/`.

8. **Salón de la Fama.** Crear `app/components/hall-of-fame.tsx` (client): tabs `.chip` por juego (estado `tab`, por defecto `GAMES[0].id`), `.podium` (plata / oro / bronce con `rows[1]`, `rows[0]`, `rows[2]`) y `.hall-table` con `seededScores(tab.length*23+7, 12)` y `animationDelay` por fila. Sin la fila "TU MEJOR MARCA". Botón "VOLVER A LA BIBLIOTECA"→`/`. Crear `app/salon/page.tsx` (server) en `.av-hall` con la cabecera. Verificación: `/salon` coincide con `salon.jsx` salvo la fila de usuario; cambiar de juego recalcula podio y tabla.

9. **Metadata y limpieza.** `metadata` (o `generateMetadata`) por ruta con títulos distintos. Eliminar código muerto del demo anterior en `app/page.tsx` y cualquier import sin usar en `app/lib/`. `npm run lint` y `npm run build` sin errores ni warnings.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores y prerenderiza `/`, `/juego/[id]` (8), `/juego/[id]/jugar` (8), `/entrar` y `/salon`.
- [ ] `npm run lint` no reporta errores ni warnings.
- [ ] Ninguna de las 5 rutas emite errores ni warnings en la consola del navegador (incluido hydration mismatch).
- [ ] El Nav y el footer se ven en las 5 rutas; el enlace activo del Nav corresponde a la ruta actual.
- [ ] Por debajo de 840 px de ancho, el botón hamburguesa abre `.av-mobile-panel` y el backdrop lo cierra.
- [ ] En `/`, escribir en el buscador filtra las tarjetas por título en vivo; al no haber coincidencias aparece "NO HAY RESULTADOS".
- [ ] En `/`, pulsar un chip de categoría (p. ej. "SHOOTER") deja solo los juegos de esa categoría; "TODOS" las muestra todas.
- [ ] Pulsar "JUGAR" en una tarjeta abre `/juego/<id>` de ese juego.
- [ ] `/juego/caida` muestra portada, descripción larga, `.stat-strip` con partidas/mejor/dificultad y una tabla de 10 puntuaciones con top1/top2/top3 resaltados.
- [ ] `/juego/<id-que-no-existe>` responde con la página 404 de Next.
- [ ] "▶ JUGAR AHORA" en el detalle abre `/juego/<id>/jugar`.
- [ ] En `/juego/caida/jugar` el contador de puntuación aumenta solo; "PAUSA" lo detiene y muestra el overlay "EN PAUSA"; "REANUDAR" lo reactiva.
- [ ] "FIN" abre el modal de fin de partida con la puntuación final; "GUARDAR PUNTUACIÓN" cambia el bloque por el texto "▸ PUNTUACIÓN GUARDADA_" y no persiste nada.
- [ ] "JUGAR DE NUEVO" reinicia puntuación a 0, vidas a 3 y nivel a 01.
- [ ] `/entrar` muestra los tabs "INICIAR SESIÓN" / "CREAR CUENTA"; en "CREAR CUENTA" aparece el campo "Correo electrónico".
- [ ] Enviar el formulario de `/entrar`, "JUGAR COMO INVITADO" o un botón social navega a `/` sin recargar y sin guardar sesión.
- [ ] El Nav siempre muestra el botón "Iniciar Sesión" (nunca un nombre de usuario).
- [ ] `/salon` muestra tabs por juego, un podio de 3 y una tabla de 12 filas; cambiar de tab recalcula podio y tabla.
- [ ] `/salon` no muestra la fila "▸ TU MEJOR MARCA EN …".
- [ ] Cada ruta tiene un `<title>` propio distinto del de las demás.
- [ ] No existe ningún archivo de motor de juego ni ningún acceso a `localStorage` / IndexedDB / red en el código de la app.

---

## Decisions

- **Sí:** rutas reales del App Router, una por pantalla. Es lo idiomático en Next 16 y da URLs compartibles.
- **No:** replicar el router hash del prototipo con una sola página y estado cliente. Poco idiomático y sin URL por pantalla.
- **Sí:** rutas y carpetas en español (`/juego`, `/entrar`, `/salon`). Coherente con la UI, que está 100 % en español.
- **No:** rutas en inglés. Mezclaría idiomas sin beneficio.
- **Sí:** interacciones de UI con client components (filtros, tabs, menú móvil, HUD, modal). Son parte del aspecto visual; varias pantallas se verían "muertas" sin ellas.
- **No:** markup 100 % estático.
- **Sí:** mantener las animaciones decorativas del reproductor (arena a la deriva, contador que sube solo). No hay input ni reglas: es ambientación del CRT, no un juego.
- **No:** sesión de usuario. Sin login real, el Nav siempre ofrece "Iniciar Sesión" y el salón omite la fila del usuario. Baja el alcance del MVP.
- **No:** persistencia de puntuaciones. El modal solo anima la confirmación. localStorage/DB van en otra spec.
- **Sí:** datos mock estáticos en `app/lib/` (`games.ts` ampliado + `scores.ts` nuevo), portados de `data.jsx`.
- **Sí:** `seededScores` determinista (sin `Math.random`) para poder renderizar tablas en servidor sin hydration mismatch.
- **Sí:** `generateStaticParams` para `/juego/[id]` y `/juego/[id]/jugar`; los 8 juegos son conocidos en build.
- **Sí:** Nav y footer en `app/layout.tsx`. El prototipo los muestra en todas las pantallas.
- **Sí:** no se escribe CSS nuevo; `app/globals.css` ya trae todas las clases del prototipo.

---

## Risks

| Riesgo                                                                 | Mitigación                                                                                     |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Hydration mismatch al renderizar tablas de puntuaciones               | `seededScores` es determinista; el `setInterval` del reproductor arranca en `useEffect` (solo cliente). |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md` | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios para dejar el árbol limpio. |
| Tilt 3D de las tarjetas con `onMouseMove` puede pesar en móviles      | El efecto solo se activa con puntero fino; el hover ya funciona por CSS aunque el JS no corra. |
| Divergencia visual con el prototipo por Preflight de Tailwind          | Contrastar cada ruta contra su `.jsx` de `references/templates/` durante la implementación.   |

---

## Lo que **no** entra en esta spec

- Ningún juego jugable (input, reglas, colisiones, game loop).
- Autenticación real, sesión de usuario y la fila "TU MEJOR MARCA" del salón.
- Persistencia de puntuaciones o preferencias (localStorage, IndexedDB, base de datos, API routes).
- Botones sociales funcionales y OAuth.
- Sistema de créditos / monedas real.
- Tests automatizados.

Cada uno de ellos, si se hace, va en su propia spec.
