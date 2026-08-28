# SPEC 05 — Primer juego real: Asteroides en la entrada `rocas`

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-28
> **Objetivo:** Portar el juego vanilla de `references/started-games/02-asteroids/` a un motor TypeScript agnóstico de framework montado en un `<canvas>` dentro del marco CRT del reproductor, conectado a la entrada de catálogo `rocas`, con escalado responsive y controles táctiles mínimos.

---

## Por qué existe esta spec

SPEC 01 dejó el reproductor (`/juego/[id]/jugar`) como una **simulación**: `PlayerScreen` incrementa un contador falso cada 220 ms y dibuja naves CSS a la deriva. No hay input, ni colisiones, ni game loop. Esta spec mete el **primer juego jugable de verdad**.

El catálogo ya tiene una entrada temática de asteroides: `rocas` ("Pulveriza asteroides en gravedad cero. Tu nave triangular flota en vacío absoluto…"). Se reutiliza esa entrada en lugar de añadir un noveno juego duplicado.

El juego de referencia (`references/started-games/02-asteroids/game.js`, 511 líneas) es canvas 2D puro, sin bundler ni dependencias: estado en variables globales, clases `Bullet` / `Asteroid` / `Ship` / `Particle` / `PowerUp`, loop `requestAnimationFrame`. Adaptarlo a Next implica encapsular ese estado global y esos listeners de `window` en algo que se pueda montar y **desmontar** limpiamente al navegar entre rutas del App Router.

Decisión de forma tomada con el usuario: el **canvas dibuja todo** (HUD y overlay de fin de partida incluidos, `Espacio` reinicia), se conserva el marco CRT de la plataforma como envoltorio, y **no** se persiste la puntuación en esta spec.

---

## Scope

**In:**

- `app/components/games/asteroids/engine.ts` (nuevo) — motor del juego portado de `game.js`, **sin ninguna importación de React ni de Next**. Exporta una clase `AsteroidsGame`:
  - `constructor(canvas: HTMLCanvasElement)` — guarda `canvas` y su `2d` context; no arranca nada.
  - `start()` — inicializa estado (`initGame`), engancha los listeners de teclado y lanza el `requestAnimationFrame`.
  - `stop()` — cancela el `rAF` y quita los listeners; el estado se conserva.
  - `destroy()` — `stop()` + libera referencias; idempotente.
  - `setInput(action: TouchAction, pressed: boolean)` — entrada alternativa para los botones táctiles (`'left' | 'right' | 'thrust' | 'fire'`).
  - `setPaused(paused: boolean)` / `togglePause()` — pausa lógica (el loop sigue pintando el último frame + overlay "EN PAUSA", no actualiza).
  - `resize(cssWidth: number, cssHeight: number, dpr: number)` — ajusta el backing store del canvas y la transform del context para que el motor siga dibujando en coordenadas internas 800×600.
  - Port literal de la lógica de `game.js`: constantes (`RADII`, `SPEEDS`, `POINTS`, `POWERUP_*`, `TRIPLE_SPREAD`), clases `Bullet` / `Asteroid` / `Ship` / `Particle` / `PowerUp`, funciones `spawnAsteroids` / `initGame` / `nextLevel` / `explode` / `killShip` / `update(dt)` / `draw()`, HUD en canvas (`SCORE`, `NIVEL`, iconos de vida, timer `3x`) y overlay `GAME OVER` (`Espacio` para reiniciar). `dt` sigue capado a 50 ms.
  - El estado global de `game.js` pasa a campos de instancia. Los listeners de teclado se guardan como referencias para poder quitarlos en `stop()`.
- `app/components/games/asteroids/asteroids-player.tsx` (nuevo, `"use client"`) — envoltorio fino:
  - Renderiza el marco CRT de la plataforma (`.crt` / `.crt-screen` / `.crt-bottom`) reutilizando las clases de `globals.css`, con el `<canvas>` dentro de `.crt-screen`.
  - En `useEffect` (mount): `new AsteroidsGame(canvasEl)`, `game.start()`. En cleanup: `game.destroy()`. Guard contra el doble montaje de React StrictMode.
  - `ResizeObserver` sobre el contenedor → `game.resize(w, h, window.devicePixelRatio)`.
  - `visibilitychange` → `game.setPaused(document.hidden)` (auto-pausa al perder foco, evita el salto tras volver a la pestaña).
  - `keydown` de `Escape` / `KeyP` → `game.togglePause()`.
  - `preventDefault` en `ArrowUp/ArrowDown/ArrowLeft/ArrowRight/Space` mientras el juego está montado, para que las teclas no hagan scroll de la página.
  - Enlace `VOLVER` (a `/juego/rocas`). Sin HUD React, sin botones `PAUSA` / `FIN` React.
  - Monta `<AsteroidsTouchControls>` (ver abajo).
- `app/components/games/asteroids/touch-controls.tsx` (nuevo, `"use client"`) — 4 botones superpuestos (`◄` rotar izq, `►` rotar der, `▲` propulsar, `●` disparar). Visibles solo en viewport táctil (`@media (pointer: coarse)`), ocultos en escritorio. `pointerdown` → `game.setInput(action, true)`, `pointerup` / `pointercancel` / `pointerleave` → `false`. `touch-action: none` en los botones.
- `app/components/games/registry.ts` (nuevo) — `REAL_GAME_PLAYERS: Record<string, ComponentType<{ title: string }>>` con una sola entrada hoy: `{ rocas: AsteroidsPlayer }`. Punto único donde se registran los juegos reales; los demás caen en `PlayerScreen`.
- `app/juego/[id]/jugar/page.tsx` — cambiar el render: `const Real = REAL_GAME_PLAYERS[game.id]; return Real ? <Real title={game.title} /> : <PlayerScreen gameId={game.id} title={game.title} />;`. `generateStaticParams` y `generateMetadata` intactos.
- `app/lib/games.ts` — ajustar el `long` de la entrada `rocas`: quitar la frase "Cuidado con los OVNIs en el horizonte." (el juego no tiene OVNIs) y mencionar el potenciador 3x. `id`, `title`, `short`, `cat`, `cover`, `color`, `best`, `plays` sin tocar.
- `app/globals.css` — anexar al final las clases nuevas: `.asteroids-stage` (contenedor con `aspect-ratio: 4 / 3`, `max-width`, centrado, letterbox), `.asteroids-canvas` (`width: 100%`, `height: 100%`, `image-rendering` a gusto, cursor), `.asteroids-touch` (rejilla de botones, `position: absolute`, `@media (pointer: coarse)` para mostrar/ocultar), `.asteroids-touch button`. Reutiliza tokens y `.crt*` existentes. **No** redefine `:root`, `body`, `.av-nav`, `.btn`, `.crt*`.
- `CLAUDE.md` — una línea en "Stack notes": los juegos reales viven en `app/components/games/<juego>/` con un `engine.ts` agnóstico de framework + envoltorio `"use client"`, registrados en `app/components/games/registry.ts`.
- Revisión visual con Playwright MCP: screenshots de `/juego/rocas/jugar` (inicio, partida en curso, potenciador activo, GAME OVER) en `.playwright-screenshots/`, escritorio y ~390 px. Verificar que `/juego/caida/jugar` sigue mostrando la simulación.

**Out of scope (para futuras specs):**

- Persistencia de puntuaciones: tabla `scores` en Supabase, RLS, y que una marca real de esta partida llegue al salón o a la tabla de `/juego/rocas`. Ya diferido en SPEC 04 a su propia spec. Aquí no hay guardado (ni falso ni real): el canvas solo ofrece `Espacio` para reiniciar.
- OVNIs / platillos enemigos que disparen. El juego de referencia no los tiene.
- Sonido y música.
- Portar los otros 7 juegos del catálogo. Siguen en `PlayerScreen` simulado.
- Sustituir `PlayerScreen` o borrar la arena CSS decorativa (`.game-arena`, `.enemy`, `.player-ship`). Se quedan para los juegos aún simulados.
- HUD React sincronizado, botones `PAUSA` / `FIN` React, modal de fin de partida de la plataforma para `rocas`.
- Dificultad configurable, tabla de records local (localStorage), modos de juego, logros.
- Ajustar los tags hardcodeados de `/juego/[id]` ("1 JUGADOR", "TECLADO / TÁCTIL", estrellas de dificultad).
- Tests automatizados (no hay runner).
- Guía de accesibilidad del canvas (foco, lector de pantalla, remapeo de teclas).

---

## Data model

No hay base de datos ni persistencia. El único estado nuevo es el del motor, en memoria y por partida.

```ts
// engine.ts
type GameState = "playing" | "dead" | "gameover";
type TouchAction = "left" | "right" | "thrust" | "fire";

class AsteroidsGame {
  // estado de partida (antes globales en game.js)
  private ship: Ship;
  private bullets: Bullet[];
  private asteroids: Asteroid[];
  private particles: Particle[];
  private powerUps: PowerUp[];
  private score = 0;
  private lives = 3;
  private level = 1;
  private state: GameState = "playing";
  private deadTimer = 0;
  private paused = false;

  // input
  private keys: Record<string, boolean> = {};
  private justPressed: Record<string, boolean> = {};
  private touch: Record<TouchAction, boolean> = {
    left: false,
    right: false,
    thrust: false,
    fire: false,
  };

  constructor(canvas: HTMLCanvasElement);
  start(): void;
  stop(): void;
  destroy(): void;
  setInput(action: TouchAction, pressed: boolean): void;
  setPaused(paused: boolean): void;
  togglePause(): void;
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
}
```

Constantes internas (portadas literalmente de `game.js`, coordenadas origen arriba-izquierda, espacio toroidal 800×600):

| Tamaño asteroide | Radio | Velocidad base | Puntos |
| ---------------- | ----- | -------------- | ------ |
| 1 (pequeño)      | 16    | 85             | 100    |
| 2 (mediano)      | 30    | 55             | 50     |
| 3 (grande)       | 50    | 32             | 20     |

Potenciador: `POWERUP_DROP_CHANCE = 0.15`, garantizado tras 5 kills sin drop, `POWERUP_DURATION = 5 s` (disparo triple), `POWERUP_TTL = 12 s` en pantalla, `TRIPLE_SPREAD = 0.18 rad`.

```ts
// registry.ts
export const REAL_GAME_PLAYERS: Record<
  string,
  ComponentType<{ title: string }>
> = {
  rocas: AsteroidsPlayer,
};
```

Mapa de archivos tras esta spec:

| Archivo                                               | Tipo               | Cambio        |
| ----------------------------------------------------- | ------------------ | ------------- |
| `app/components/games/asteroids/engine.ts`            | motor (agnóstico)  | nuevo         |
| `app/components/games/asteroids/asteroids-player.tsx` | client component   | nuevo         |
| `app/components/games/asteroids/touch-controls.tsx`   | client component   | nuevo         |
| `app/components/games/registry.ts`                    | mapa id→componente | nuevo         |
| `app/juego/[id]/jugar/page.tsx`                       | server component   | dispatch      |
| `app/lib/games.ts`                                    | datos              | copy `rocas`  |
| `app/globals.css`                                     | estilos            | +clases juego |
| `CLAUDE.md`                                           | doc                | +1 línea      |

Ninguna otra ruta ni componente se modifica. `PlayerScreen` no se toca.

---

## Implementation plan

1. **Esqueleto del motor + dispatch.** Crear `engine.ts` con la clase `AsteroidsGame` mínima: `constructor`, `start`/`stop`/`destroy`, un loop `rAF` que solo pinta el canvas de negro. Crear `asteroids-player.tsx` (marco `.crt` + `<canvas>` + `useEffect` que monta/destruye el motor + enlace `VOLVER`). Crear `registry.ts` con `{ rocas: AsteroidsPlayer }`. Editar `page.tsx` para el dispatch. Verificación: `/juego/rocas/jugar` muestra un canvas negro dentro del marco CRT; `/juego/caida/jugar` sigue mostrando `PlayerScreen`; `npm run build` pasa.

2. **Entidades.** Portar a `engine.ts` las clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` y las constantes, tipadas en TS strict. `ctx` pasa como parámetro a los `draw()` (o se lee de un campo). Sin cablear al loop todavía. `npm run build` pasa.

3. **Lógica de partida y teclado.** Portar `spawnAsteroids` / `initGame` / `nextLevel` / `explode` / `killShip` / `update(dt)` / `draw()` (con HUD y overlay `GAME OVER` en canvas). `start()` engancha `keydown`/`keyup` a `window` (referencias guardadas), `stop()` los quita. `pressed()` para `Space` (disparo y reinicio). Verificación manual con teclado en 800×600 fijo: rotar, propulsar (con llama), disparar (cooldown 0.2 s), partir asteroides (grande→2 medianos→2 pequeños; pequeño no parte), perder vidas, `GAME OVER`, `Espacio` reinicia, nivel sube al limpiar la pantalla.

4. **Escalado responsive.** Implementar `resize(cssW, cssH, dpr)`: `canvas.width/height` = tamaño CSS × dpr, `ctx.setTransform(...)` para dibujar en 800×600. En `asteroids-player.tsx`: `.asteroids-stage` con `aspect-ratio: 4 / 3` + `ResizeObserver` que llama a `resize`. Añadir las clases a `globals.css`. Verificación: el juego llena el marco CRT en escritorio y a ~390 px, sin deformarse, nítido en pantalla hi-dpi, sin scroll horizontal en la página.

5. **Controles táctiles.** Crear `touch-controls.tsx` con los 4 botones, gated por `@media (pointer: coarse)`, cableados a `game.setInput()` con `pointerdown`/`pointerup`/`pointercancel`. En `engine.ts`, `update()` combina `keys` y `touch` para rotación/propulsión, y `setInput('fire', true)` encola un disparo (consumido como `pressed('Space')`). Verificación: en devtools con emulación táctil los 4 botones controlan la nave; en escritorio no se ven.

6. **Ciclo de vida y pausa.** `destroy()` cancela el `rAF` y quita todos los listeners; guard de StrictMode en el `useEffect`. `visibilitychange` → `setPaused(document.hidden)`. `Escape` / `KeyP` → `togglePause()` con overlay "EN PAUSA" en canvas. `preventDefault` en flechas y `Space` mientras el juego está montado. Verificación: navegar de `/juego/rocas/jugar` a otra ruta a media partida no deja errores en consola ni un loop huérfano (un `console.count` temporal en el loop confirma que para); cambiar de pestaña pausa y al volver no hay salto; las flechas no hacen scroll.

7. **Copy, docs y revisión visual.** Ajustar `rocas.long` en `games.ts` (fuera OVNIs, dentro el 3x). Añadir la línea a "Stack notes" de `CLAUDE.md`. `npm run dev`; screenshots de `/juego/rocas/jugar` (inicio, en curso, 3x activo, GAME OVER) en `.playwright-screenshots/`, escritorio y ~390 px. `npm run lint` y `npm run build` limpios; quitar `console.count`/imports sin usar; commitear el bloque gestionado de `AGENTS.md`/`CLAUDE.md` si `next dev` lo reescribió.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `npm run lint` sin errores ni warnings.
- [ ] `engine.ts` no importa nada de `react` ni de `next`.
- [ ] `/juego/rocas/jugar` renderiza un `<canvas>` dentro del marco CRT (`.crt` / `.crt-screen` / `.crt-bottom`), sin el HUD React ni los botones `PAUSA` / `FIN`.
- [ ] `/juego/caida/jugar` (y el resto de ids) sigue mostrando `PlayerScreen` con el contador simulado.
- [ ] `generateStaticParams` sigue generando las 8 rutas de juego; ningún id existente da 404.
- [ ] Teclado: `←` `→` rotan la nave, `↑` propulsa y dibuja la llama, `Espacio` dispara con cooldown de 0.2 s.
- [ ] Un asteroide grande se parte en 2 medianos; un mediano en 2 pequeños; un pequeño no se parte.
- [ ] Puntos: grande +20, mediano +50, pequeño +100, reflejados en el HUD del canvas.
- [ ] La nave empieza con 3 vidas; parpadea con invencibilidad temporal al reaparecer; chocar con un asteroide resta una vida; a 0 vidas aparece el overlay `GAME OVER` y `Espacio` reinicia la partida.
- [ ] Al quedar 0 asteroides sube `NIVEL` y aparecen `3 + nivel` asteroides nuevos.
- [ ] El potenciador `3x` aparece (por probabilidad o garantizado tras 5 destrucciones sin drop); recogerlo da disparo triple durante ~5 s y el HUD muestra el temporizador.
- [ ] El HUD del canvas muestra `SCORE`, `NIVEL` y los iconos de vida.
- [ ] El canvas escala para llenar el marco CRT manteniendo proporción 4:3, se ve nítido en pantalla con `devicePixelRatio > 1`, y la página no tiene scroll horizontal a ~390 px.
- [ ] Con las flechas y `Espacio` durante la partida, la página no hace scroll.
- [ ] En viewport táctil (`pointer: coarse`) se ven 4 botones que controlan rotar izq/der, propulsar y disparar; en escritorio no se muestran.
- [ ] Cambiar de pestaña pausa el juego; al volver no hay un salto grande de simulación.
- [ ] `Escape` o `P` alternan pausa con un overlay "EN PAUSA" en el canvas.
- [ ] Navegar fuera de `/juego/rocas/jugar` a media partida no deja errores en consola ni un `requestAnimationFrame` activo (loop cancelado en el cleanup).
- [ ] El juego no usa `localStorage` ni IndexedDB y no hace ninguna petición de red.
- [ ] `app/lib/games.ts`: el `long` de `rocas` ya no menciona OVNIs.
- [ ] `app/globals.css` no redefine `:root`, `body`, `.av-nav`, `.btn` ni `.crt*`; solo añade `.asteroids-*`.
- [ ] Hay screenshots de `/juego/rocas/jugar` (inicio, en curso, 3x, GAME OVER) en `.playwright-screenshots/`, escritorio y móvil.

---

## Decisions

- **Sí:** reutilizar la entrada `rocas` del catálogo. Ya es temáticamente asteroides, con portada y color propios. **No:** añadir un noveno juego `asteroides` (duplicaría la temática) ni renombrar `rocas` (rompería enlaces y `generateStaticParams`).
- **Sí:** motor en un `engine.ts` **agnóstico de framework** (clase con `start`/`stop`/`destroy`) + envoltorio `"use client"` fino. Aísla el loop de 60 fps del ciclo de render de React y hace el patrón repetible para los siguientes juegos. **No:** reescribir la lógica en hooks/refs de React — mezclaría el loop con el render y complicaría el porte.
- **Sí:** el **canvas dibuja todo** (HUD, overlay `GAME OVER`, `Espacio` reinicia), como el original. **No:** HUD React sincronizado por callback ni modal de plataforma para `rocas` — más superficie de bugs para cero ganancia dado que no hay guardado.
- **Sí:** conservar el marco CRT (`.crt*`) como envoltorio. Da identidad visual coherente con el resto del reproductor sin coste.
- **No:** persistir la puntuación (ni falsa ni real). SPEC 04 ya difirió la tabla `scores` + RLS a su propia spec; sin sesión ni tabla, un "GUARDAR" aquí sería otra simulación. El canvas solo reinicia con `Espacio`.
- **Sí:** escalado responsive con espacio interno fijo 800×600 y `ctx.setTransform`. El motor no se entera del tamaño real; el canvas se adapta a cualquier viewport y al marco CRT. **No:** canvas fijo 800×600 — se cortaría en móvil y dentro del marco.
- **Sí:** controles táctiles mínimos (4 botones) gated por `(pointer: coarse)`. La página de detalle ya anuncia "TECLADO / TÁCTIL"; sin ellos el juego es injugable en móvil. **No:** remapeo de teclas ni gestos — fuera de alcance.
- **Sí:** mantener el potenciador `3x` (disparo triple) del `game.js` de referencia aunque su README no lo documente. Ya está implementado y añade variedad; quitarlo sería trabajo extra.
- **Sí:** auto-pausa en `visibilitychange` y pausa manual con `Escape` / `P`. El `dt` capado ya evita el "spiral of death", pero la auto-pausa evita el salto perceptible al volver a la pestaña. El original no tenía pausa; es una adición pequeña y esperada en la plataforma.
- **Sí:** registro `REAL_GAME_PLAYERS` (id→componente) con fallback a `PlayerScreen`. Un único punto para enchufar los siguientes juegos reales sin tocar `page.tsx` cada vez.
- **No:** tocar `PlayerScreen`, la arena CSS decorativa ni los tags hardcodeados de `/juego/[id]`. Los otros 7 juegos siguen simulados hasta su propia spec.

---

## Risks

| Riesgo                                                                               | Mitigación                                                                                                                           |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `requestAnimationFrame` no cancelado al navegar → loop huérfano, fugas               | `destroy()` en el cleanup del `useEffect`; criterio de aceptación con `console.count` temporal que confirma que el loop para.        |
| React StrictMode monta/desmonta el efecto dos veces en dev → doble motor             | Guard en el `useEffect` (ref booleana) y `destroy()` idempotente; se verifica en dev que solo corre un loop.                         |
| Flechas y `Espacio` hacen scroll de la página durante la partida                     | `preventDefault` en esas teclas mientras el juego está montado; criterio de aceptación dedicado.                                     |
| Canvas borroso en pantallas hi-dpi                                                   | `resize()` escala el backing store por `devicePixelRatio` y ajusta la transform; criterio de aceptación exige nitidez con dpr > 1.   |
| Los botones táctiles tapan zona de juego o disparan `contextmenu`/zoom               | `touch-action: none`, `pointer` events (no `touch`), `user-select: none`; posicionados en los bordes; solo bajo `(pointer: coarse)`. |
| `dt` enorme al volver de una pestaña en segundo plano → asteroides teletransportados | `dt` capado a 50 ms (ya en `game.js`) + auto-pausa en `visibilitychange`.                                                            |
| Listeners de teclado en `window` afectan a otras rutas si no se limpian              | `start()` guarda las referencias y `stop()`/`destroy()` las quita; el envoltorio llama a `destroy()` al desmontar.                   |
| El copy de `rocas` promete OVNIs que el juego no tiene                               | Paso 7 edita `rocas.long`; criterio de aceptación lo verifica.                                                                       |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`               | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                                                            |

---

## Lo que **no** entra en esta spec

- Persistir la puntuación: tabla `scores`, RLS, marca real en el salón y en `/juego/rocas`.
- OVNIs / platillos enemigos, sonido y música.
- Portar los otros 7 juegos del catálogo; siguen en `PlayerScreen`.
- HUD React, botones `PAUSA` / `FIN` React y modal de fin de partida para `rocas`.
- Records locales (localStorage), modos de juego, dificultad configurable, logros.
- Retocar los tags hardcodeados de `/juego/[id]`.
- Accesibilidad del canvas y remapeo de teclas.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
