# SPEC 10 — Jugar en móvil: mando táctil en pantalla y layout del reproductor

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 05, SPEC 07, SPEC 08, SPEC 09
> **Fecha:** 2026-08-29
> **Objetivo:** Rehacer el layout del reproductor en dispositivos táctiles para que los 4 juegos con motor real se jueguen con el canvas arriba y un mando en pantalla debajo (D-pad de 4 flechas + 2 botones de acción, fijo para los 4 juegos, con los controles no usados atenuados), y de paso corregir el scroll horizontal preexistente a ~390 px del `site-nav`.

---

## Por qué existe esta spec

SPEC 05 fijó el patrón del reproductor real: marco CRT (`.crt` / `.crt-screen` / `.crt-bottom`),
`<canvas>` con `object-fit: contain`, envoltorio `"use client"` fino y un componente
`touch-controls.tsx` por juego que dibuja botones **flotando por encima del canvas** dentro de
`.crt-screen`, gated por `@media (pointer: coarse)`. SPEC 07, SPEC 08 y SPEC 09 repitieron ese patrón
para `caida`, `bloque-buster` y `serpentina`.

En un móvil real ese patrón no funciona: en retrato el marco CRT queda muy pequeño (a 390 px de
viewport, `aspect-ratio: 4/3` da un canvas de ~270 px de alto), los botones flotantes de 54–60 px
tapan la zona de juego, el HUD de React del `PlayerScreen` y el `<SkinPicker>` se solapan con el
canvas (ver captura aportada por el usuario), y toda la página tiene además un scroll horizontal de
~13 px que arrastra el `site-nav` desde SPEC 05 (memoria `nav-overflow-390px`).

Esta spec cambia, **solo en `pointer: coarse`**:

- El **layout del reproductor**: pasa de "página que scrollea con un marco CRT centrado" a una
  **vista de juego a pantalla completa** — barra fina arriba (VOLVER + skin), canvas ocupando el
  hueco central, mando abajo — sin scroll de página.
- Los **controles táctiles**: los 4 `touch-controls.tsx` por juego se sustituyen por **un** mando
  compartido `<MobileGamepad>` con una botonera fija (▲ ▼ ◄ ► + **A** + **B**). Cada envoltorio de
  juego define su propio mapa `PAD_MAP` (colocado, tipado contra el `TouchAction` de su motor) y se
  lo pasa al mando; los controles que ese juego no mapea se pintan atenuados y no hacen nada. El
  `<MobileGamepad>` es genérico y no conoce ningún `game_id`.
- El **bug de scroll horizontal** del `site-nav` a ~390 px.

Decisiones de forma tomadas con el usuario antes de escribir esta spec:

- **Solo los 4 juegos con motor real** (`rocas`, `caida`, `bloque-buster`, `serpentina`). El
  `PlayerScreen` simulado (`gloton` y los otros 3 juegos falsos) **no se toca**: no tiene motor ni
  controles reales y desaparecerá cuando cada juego reciba su propia spec.
- **Botonera fija para los 4 juegos**, con los botones no usados atenuados (no ocultos). Aspecto de
  mando arcade consistente. La mayoría de juegos arcade necesitan como mucho 2 botones de acción.
- **Barra compacta sobre el canvas** con `VOLVER` a la izquierda y el selector de skin (compacto) a
  la derecha. La vista de juego ocupa el alto completo del viewport sin scroll de página.
- **Retrato:** columna `barra / canvas / mando`. **Apaisado:** el canvas ocupa toda la pantalla y el
  mando se divide en dos mitades (D-pad abajo-izquierda, botones abajo-derecha) superpuestas sobre el
  canvas, estilo consola portátil; la barra queda como franja translúcida arriba.
- **El mando se muestra solo con `@media (pointer: coarse)`** — mismo gate que hoy. Escritorio con
  ratón sigue con teclado y no ve nada nuevo.
- **Sin cambios de motor.** Los `engine.ts` no se tocan: el mando llama a los mismos
  `game.setInput(action, pressed)` que ya existen. Los mapeos nuevos (`▲` → `rotate` en `caida`,
  `▲`/`B` → `thrust` en `rocas`, …) viven en el `PAD_MAP` de cada envoltorio, no en el motor ni en
  ningún fichero central.
- **Arreglar el scroll horizontal a ~390 px** dentro de esta spec (el usuario lo pidió
  explícitamente), aunque el fix viva en `site-nav.tsx` / `globals.css`.
- **Fuera:** API de bloqueo de orientación, botón de pantalla completa (Fullscreen API), gestos de
  swipe sobre el canvas, mando configurable, vibración (Haptics), rediseño del HUD dibujado en
  canvas, tocar el `PlayerScreen` simulado, y cualquier cambio de mecánica, puntuación o `scores`.

Esta spec **no revisa** ninguna decisión de mecánica de SPEC 05, SPEC 07, SPEC 08 ni SPEC 09.

---

## Scope

**In:**

- `app/components/games/mobile-gamepad.tsx` (nuevo, `"use client"`) — mando compartido, **genérico y
  agnóstico del juego**. Sustituye a los 4 `touch-controls.tsx`.
  - `export type PadControl = "up" | "down" | "left" | "right" | "a" | "b";`
  - Props genéricas en `A extends string`:
    `{ map: Partial<Record<PadControl, A>>; onInput: (action: A, pressed: boolean) => void;
accent?: "cyan" | "green"; label?: string }`.
  - Renderiza 6 botones: un cluster D-pad (`▲ ▼ ◄ ►` en cruz) y un cluster de acción (`A`, `B`).
  - Para cada `PadControl`, si la clave **no está** en `map` el botón lleva la clase `is-idle`
    (atenuado, `aria-disabled`, sin handlers); si está, `onPointerDown` → `onInput(map[control],
true)`, `onPointerUp` / `onPointerCancel` / `onPointerLeave` → `onInput(map[control], false)`,
    con `e.preventDefault()` en cada handler (igual que los `touch-controls.tsx` actuales).
  - `A` usa `--magenta`; `B` y el D-pad usan `--cyan`, salvo `accent="green"` que los pinta con
    `--green` (lo pasa `serpentina`). El componente **no** lee ningún `game_id` ni `data-game`.
  - No lleva estado propio ni `localStorage`.
- **No hay fichero central de mapeo.** Cada envoltorio declara su `PAD_MAP` como constante local,
  tipada `Partial<Record<PadControl, TouchAction>>` con el `TouchAction` **de su propio motor** (así
  el compilador verifica cada valor). Clave ausente ⇒ botón atenuado. Los 4 mapas son:

  | Envoltorio (`game_id`)       | up       | down   | left   | right   | a      | b        |
  | ---------------------------- | -------- | ------ | ------ | ------- | ------ | -------- |
  | `asteroids` (`rocas`)        | `thrust` | —      | `left` | `right` | `fire` | `thrust` |
  | `tetris` (`caida`)           | `rotate` | `down` | `left` | `right` | `drop` | `rotate` |
  | `arkanoid` (`bloque-buster`) | —        | —      | `left` | `right` | —      | —        |
  | `snake` (`serpentina`)       | `up`     | `down` | `left` | `right` | —      | —        |

- `app/components/games/skin-picker.tsx` — añadir prop opcional `compact?: boolean`. Con
  `compact === true` renderiza **un solo botón** que muestra la skin activa (`SKIN_LABELS[value]`) y
  al pulsarlo avanza a la siguiente de `SKIN_NAMES` de forma cíclica (`onChange` con la siguiente).
  Sin `compact` (o `false`) el comportamiento actual (3 botones) no cambia — `serpentina` en
  escritorio sigue igual.
- `app/components/games/asteroids/asteroids-player.tsx` — en el JSX:
  - Envolver todo en `<div className="av-player av-player--game fade-in">`.
  - Añadir, **antes** del `<div className="crt">`, una `<div className="game-topbar">` con
    `<Link className="btn ghost" href="/juego/rocas">VOLVER</Link>` y
    `<SkinPicker gameId={GAME_ID} value={skin} onChange={handleSkin} compact />`.
  - Quitar `<AsteroidsTouchControls onInput={handleInput} />` de dentro de `.crt-screen`.
  - Declarar `const PAD_MAP: Partial<Record<PadControl, TouchAction>> = { left: "left", right:
"right", up: "thrust", a: "fire", b: "thrust" };` (con el `TouchAction` importado de `./engine`,
    `PadControl` de `../mobile-gamepad`).
  - Añadir, **después** del `<div className="crt">`, `<MobileGamepad map={PAD_MAP}
onInput={handleInput} label="ASTEROIDES" />`.
  - El `<SkinPicker>` de tamaño completo y el `<Link>VOLVER</Link>` sueltos que hoy van bajo el marco
    se mantienen (los usa el escritorio); en `pointer: coarse` se ocultan por CSS (la `game-topbar`
    los reemplaza).
  - `handleInput` no cambia de firma: `MobileGamepad` pasa un valor de `PAD_MAP`, que **es** un
    `TouchAction` de este motor por construcción del tipo.
  - Borrar el import y el uso de `./touch-controls`.
- `app/components/games/tetris/tetris-player.tsx` — igual, con
  `PAD_MAP = { left: "left", right: "right", down: "down", up: "rotate", a: "drop", b: "rotate" }`,
  `href="/juego/caida"`, `label="TETRIS"`. `caida` **no** tiene `<SkinPicker>` (no tiene skins): la
  `game-topbar` lleva solo `VOLVER`.
- `app/components/games/arkanoid/arkanoid-player.tsx` — igual, con
  `PAD_MAP = { left: "left", right: "right" }`, `href="/juego/bloque-buster"`, `label="ARKANOID"`,
  `<SkinPicker … compact />`.
- `app/components/games/snake/snake-player.tsx` — igual, con
  `PAD_MAP = { up: "up", down: "down", left: "left", right: "right" }`, `accent="green"`,
  `href="/juego/serpentina"`, `label="SNAKE"`, `<SkinPicker … compact />`.
- Borrar los 4 archivos de controles por juego:
  - `app/components/games/asteroids/touch-controls.tsx`
  - `app/components/games/tetris/touch-controls.tsx`
  - `app/components/games/arkanoid/touch-controls.tsx`
  - `app/components/games/snake/touch-controls.tsx`
- `app/globals.css`:
  - **Quitar** los 4 bloques `.<juego>-touch` / `.<juego>-touch-btn` (asteroides, tetris, arkanoid,
    snake). Las reglas `.<juego>-stage` y `.<juego>-canvas` **se mantienen** tal cual.
  - **Añadir** al final el bloque `/* ===== reproductor móvil (SPEC 10) ===== */`:
    - `.game-topbar { display: none; }` por defecto.
    - `.mobile-gamepad { display: none; }` por defecto.
    - Dentro de `@media (pointer: coarse)`:
      - `.av-player--game`: `position: fixed; inset: 0; margin: 0; padding: 0; max-width: none;
display: flex; flex-direction: column; background: #000; z-index: 30;` — vista de juego a
        pantalla completa, sin scroll. Usa `100dvh` implícito por `inset: 0`.
      - `.game-topbar`: `display: flex; align-items: center; justify-content: space-between;
gap: 8px; padding: 6px 10px; min-height: 40px; background: var(--bg-2);
border-bottom: 1px solid var(--line);`.
      - `.av-player--game .crt`: `flex: 1; min-height: 0; padding: 0; border-radius: 0;
box-shadow: none; background: #000;` y `.av-player--game .crt::before { display: none; }`.
      - `.av-player--game .crt-screen`: `aspect-ratio: auto; width: 100%; height: 100%;
border-radius: 0;`.
      - `.av-player--game .crt-bottom`: `display: none;` (la etiqueta CRT-83 no cabe en móvil).
      - `.av-player--game > .skin-picker`, `.av-player--game > div:has(> a.btn.ghost)`: los controles
        de escritorio sueltos bajo el marco → `display: none;` (la `game-topbar` los reemplaza).
        Alternativa aceptada si `:has()` da problemas: marcar ese `<div>` con
        `className="desktop-only-back"` en los 4 wrappers y ocultar por clase.
      - `.mobile-gamepad`: `display: flex; justify-content: space-between; align-items: center;
gap: 12px; padding: 10px 16px calc(10px + env(safe-area-inset-bottom));
background: var(--bg-2); border-top: 1px solid var(--line); flex: 0 0 auto;`.
      - `.pad-dpad`: cuadrícula 3×3 (`display: grid`) de ~150 px con `▲` arriba-centro, `◄`
        izquierda-centro, `►` derecha-centro, `▼` abajo-centro, centro vacío.
      - `.pad-actions`: `display: flex; gap: 14px;` con `A` y `B`.
      - `.pad-btn`: `width: 46px; height: 46px; border-radius: 50%; border: 1px solid var(--cyan);
background: rgba(0,0,0,0.4); color: var(--cyan); font-family: var(--pixel); font-size: 14px;
display: grid; place-items: center; pointer-events: auto; touch-action: none;
user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;`.
      - `.pad-btn:active:not(.is-idle)`: `background: rgba(0, 245, 255, 0.28);`.
      - `.pad-btn.is-idle`: `opacity: 0.25; pointer-events: none;`.
      - `.pad-btn[data-control="a"]`: `border-color: var(--magenta); color: var(--magenta);`.
      - `.mobile-gamepad[data-accent="green"] .pad-btn:not([data-control="a"])`: acento `--green`
        (la prop `accent="green"` del componente escribe ese `data-accent`).
    - Dentro de `@media (pointer: coarse) and (orientation: landscape)`:
      - `.av-player--game`: el `.crt` sigue como capa a pantalla completa; `.game-topbar` pasa a
        `position: absolute; inset: 0 0 auto 0; background: rgba(5,5,7,0.6); z-index: 32;`.
      - `.mobile-gamepad`: `position: absolute; inset: auto 0 0 0; background: transparent;
border: 0; pointer-events: none; z-index: 32;` con
        `.pad-dpad` y `.pad-actions` como hijos con `pointer-events: auto` (D-pad abajo-izquierda,
        acciones abajo-derecha, ambos con `env(safe-area-inset-*)`).
  - **Corrección del scroll horizontal a ~390 px** (memoria `nav-overflow-390px`):
    - Añadir `overflow-x: clip;` a la regla `html, body, #root` (línea ~52) — o a `html` sola si
      `clip` en `body` rompe algún `position: sticky` (verificar el `site-nav`).
    - `.av-nav .hamburger`: fijar `width: 40px; padding: 0; letter-spacing: 0;` para matar los ~3 px
      del glifo `≡`.
    - `.av-mobile-panel:not(.open)` y `.av-mobile-backdrop:not(.open)`: añadir `visibility: hidden;`
      para que el panel cerrado no cuente en `scrollWidth`.
- `app/components/site-nav.tsx` — si con lo anterior no basta: renderizar `.av-mobile-panel` y
  `.av-mobile-backdrop` **solo cuando `open === true`** (montaje condicional), conservando la clase
  `.open` para la transición de entrada. No se cambia ningún enlace ni el estado `open`.
- `CLAUDE.md` "Stack notes" — actualizar la frase "Cada juego trae además `touch-controls.tsx` para
  móvil" → mando compartido `app/components/games/mobile-gamepad.tsx` (genérico; cada envoltorio le
  pasa su `PAD_MAP` local), y una nota de que en `pointer: coarse` el reproductor pasa a pantalla
  completa (barra + canvas + mando).
- Revisión visual con Playwright MCP (emulación de dispositivo): screenshots en
  `.playwright-screenshots/` de `/juego/{rocas,caida,bloque-buster,serpentina}/jugar` en:
  - retrato ~390×844 (iPhone 12/13 mini-ish) y ~412×915 (Pixel 7),
  - apaisado ~844×390,
  - escritorio 1280 (para confirmar que **no** cambia).
    Y de `/`, `/biblioteca`, `/salon`, `/juego/rocas` a 390 px para confirmar
    `document.documentElement.scrollWidth === clientWidth`.

**Out of scope (para futuras specs):**

- API de bloqueo de orientación (`screen.orientation.lock`) y botón de pantalla completa
  (Fullscreen API).
- Gestos de swipe / arrastre sobre el canvas como alternativa al mando.
- Mando con disposición configurable, remapeo de botones, o tamaño ajustable.
- Vibración / Haptics al pulsar.
- Rediseño del HUD que cada motor dibuja dentro del canvas (score / vidas / nivel).
- Tocar el `PlayerScreen` simulado o darle controles táctiles (los 4 juegos falsos siguen igual).
- Portar los otros 4 juegos simulados a motor real.
- Un tercer botón de acción (`C`) o botones de hombro.
- Cambiar `object-fit` del canvas o el espacio interno de ningún motor.
- Auth, `scores`, catálogo, migraciones, Supabase — nada de eso se toca.
- Rediseño del `site-nav` más allá del fix puntual de overflow (el menú móvil off-canvas se queda
  como está).
- Tests automatizados (no hay runner).

---

## Data model

Esta spec **no introduce estructuras de datos persistentes**. No toca la tabla `scores` ni el
catálogo. El único "modelo" nuevo es el contrato del mando y el `PAD_MAP` que cada envoltorio
declara localmente, en memoria y estático:

```ts
// app/components/games/mobile-gamepad.tsx  — genérico, sin conocer ningún juego
export type PadControl = "up" | "down" | "left" | "right" | "a" | "b";

interface MobileGamepadProps<A extends string> {
  map: Partial<Record<PadControl, A>>; // clave ausente ⇒ botón atenuado
  onInput: (action: A, pressed: boolean) => void;
  accent?: "cyan" | "green"; // por defecto "cyan"
  label?: string;
}
```

```ts
// app/components/games/asteroids/asteroids-player.tsx  (una por envoltorio)
import type { TouchAction } from "./engine";
import type { PadControl } from "../mobile-gamepad";

const PAD_MAP: Partial<Record<PadControl, TouchAction>> = {
  left: "left",
  right: "right",
  up: "thrust",
  a: "fire",
  b: "thrust",
};
// tetris:   { left, right, down, up: "rotate", a: "drop", b: "rotate" }
// arkanoid: { left, right }
// snake:    { up, down, left, right }
```

Convenciones:

- Cada `PAD_MAP` está tipado contra el `TouchAction` **de su propio motor**: el compilador rechaza
  un valor que ese motor no acepte. No hay ningún `Record<gameId, …>` central.
- Clave ausente en `PAD_MAP` ⇒ el botón se pinta atenuado (`.is-idle`) y no dispara nada.
- `MobileGamepad` es puramente de presentación y genérico: recibe `map` + `onInput` + `accent` y no
  conoce ningún `game_id`. Añadir un 5.º juego = crear su carpeta con su `PAD_MAP` y registrarlo en
  `registry.ts`; este componente no se toca.

### Mapa de archivos tras esta spec

| Archivo                                               | Tipo             | Cambio                                                    |
| ----------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| `app/components/games/mobile-gamepad.tsx`             | client component | nuevo (mando compartido, genérico)                        |
| `app/components/games/skin-picker.tsx`                | client component | `+` prop `compact`                                        |
| `app/components/games/asteroids/asteroids-player.tsx` | client component | `game-topbar` + `MobileGamepad`; fuera `touch-controls`   |
| `app/components/games/tetris/tetris-player.tsx`       | client component | ídem                                                      |
| `app/components/games/arkanoid/arkanoid-player.tsx`   | client component | ídem                                                      |
| `app/components/games/snake/snake-player.tsx`         | client component | ídem                                                      |
| `app/components/games/asteroids/touch-controls.tsx`   | client component | **borrado**                                               |
| `app/components/games/tetris/touch-controls.tsx`      | client component | **borrado**                                               |
| `app/components/games/arkanoid/touch-controls.tsx`    | client component | **borrado**                                               |
| `app/components/games/snake/touch-controls.tsx`       | client component | **borrado**                                               |
| `app/globals.css`                                     | estilos          | `-` 4 bloques `.*-touch*`; `+` bloque móvil; fix overflow |
| `app/components/site-nav.tsx`                         | client component | montaje condicional del panel (si hace falta)             |
| `CLAUDE.md`                                           | doc              | "Stack notes"                                             |

`registry.ts`, los 4 `engine.ts`, `player-screen.tsx`, `app/lib/**`, `supabase/**`,
`app/juego/[id]/**` y `app/salon/**` **no se tocan**.

---

## Implementation plan

Cada paso deja el árbol compilando y es commitable por separado.

1. **Mando compartido genérico, cableado en un juego.** Crear `mobile-gamepad.tsx` con
   `<MobileGamepad>` genérico (6 botones, `.is-idle` para las claves ausentes de `map`, handlers de
   puntero con `preventDefault`, `accent`). En `asteroids-player.tsx`: quitar
   `<AsteroidsTouchControls>`, declarar el `PAD_MAP` local tipado con `TouchAction`, añadir
   `<MobileGamepad map={PAD_MAP} onInput={handleInput} label="ASTEROIDES" />` tras `.crt`, borrar
   `asteroids/touch-controls.tsx`. Añadir a `globals.css`
   `.mobile-gamepad { display: none }` + el bloque `@media (pointer: coarse)` mínimo que lo muestra
   como barra inferior (sin tocar todavía `.av-player`). Quitar de `globals.css` el bloque
   `.asteroids-touch*`. Verificación: en viewport `pointer: coarse` (DevTools device toolbar) el
   mando aparece bajo el marco CRT; girar y disparar en `rocas` funciona; el botón `▼` está
   atenuado; en escritorio no se ve nada nuevo y el teclado sigue igual; `npm run build` y
   `npm run lint` pasan.

2. **Layout de pantalla completa en `pointer: coarse` para `rocas`.** Añadir `av-player--game` al
   `<div>` raíz de `asteroids-player.tsx` y la `<div className="game-topbar">` (VOLVER + `<SkinPicker
… compact />`) antes de `.crt`. Añadir la prop `compact` a `skin-picker.tsx`. Completar en
   `globals.css` el `@media (pointer: coarse)`: `.av-player--game` fijo a pantalla completa, `.crt`
   sin marco y flexible, `.crt-screen` sin `aspect-ratio`, `.crt-bottom` oculto, controles de
   escritorio sueltos ocultos, `.game-topbar` visible. Verificación en retrato ~390 px: barra fina
   arriba, canvas ocupando el centro sin recortarse (`object-fit: contain`), mando abajo, **sin
   scroll de página**; el `<SkinPicker compact>` cicla `clasico → neon → retro` y persiste; VOLVER
   navega a `/juego/rocas`; el overlay de fin de partida (`.modal`) sigue centrado y usable.

3. **Apaisado para `rocas`.** Añadir el bloque `@media (pointer: coarse) and (orientation:
landscape)`: canvas a pantalla completa, `.game-topbar` como franja translúcida superior,
   `.mobile-gamepad` transparente con `.pad-dpad` abajo-izquierda y `.pad-actions` abajo-derecha
   (`pointer-events` solo en los clusters), `env(safe-area-inset-*)`. Verificación en ~844×390: el
   canvas llena la pantalla, D-pad y botones caen a los lados y no tapan el centro, se puede jugar
   una partida completa, no hay scroll en ningún eje.

4. **Replicar en `caida`, `bloque-buster` y `serpentina`.** Mismos cambios de JSX en los 3
   wrappers (`av-player--game`, `game-topbar`, su `PAD_MAP` local + `<MobileGamepad map={PAD_MAP}>`
   con `label` y `accent`, fuera el `touch-controls` local, `<SkinPicker … compact />` salvo en
   `caida`). Borrar
   los 3 `touch-controls.tsx` restantes y sus 3 bloques CSS `.*-touch*`. Verificación por juego en
   retrato y apaisado: `caida` mueve/rota/baja/hard-drop con D-pad + A + B (con `▲` = rotar);
   `bloque-buster` mueve la paleta con `◄ ►` y tiene `▲ ▼ A B` atenuados; `serpentina` gira con las
   4 flechas y tiene `A B` atenuados; ninguno recorta el canvas; el `<canvas width={480}>` de
   `caida` se centra sin deformarse.

5. **Fix del scroll horizontal a ~390 px.** `overflow-x: clip` en `html` (y `body` si procede),
   `.hamburger` con `width` fijo y `letter-spacing: 0`, `.av-mobile-panel` / `.av-mobile-backdrop`
   cerrados con `visibility: hidden`; si aún sobra ancho, montar el panel/backdrop en `site-nav.tsx`
   solo con `open === true`. Verificación con Playwright a 390 px en `/`, `/biblioteca`, `/salon`,
   `/juego/rocas` y `/juego/rocas/jugar`: `document.documentElement.scrollWidth ===
document.documentElement.clientWidth`; el menú hamburguesa sigue abriendo y cerrando el panel con
   su transición.

6. **Docs y revisión visual final.** Actualizar "Stack notes" de `CLAUDE.md`. `npm run lint` y
   `npm run build` limpios; sin imports ni `console` sueltos; sin referencias colgando a
   `./touch-controls`. Screenshots con Playwright MCP en `.playwright-screenshots/` de los 4 juegos
   en retrato (~390 y ~412) y apaisado (~844×390), más escritorio 1280 de los 4 para dejar
   constancia de que no cambió. Actualizar la memoria `nav-overflow-390px` a "resuelto en SPEC 10".
   Commitear el bloque gestionado de `AGENTS.md` / `CLAUDE.md` si `next dev` lo reescribió.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `npm run lint` sin errores ni warnings.
- [ ] Existe `app/components/games/mobile-gamepad.tsx` y **no** existe ningún fichero central de
      mapeo (`gamepad-map.ts` o similar); ya **no** existen los 4
      `app/components/games/*/touch-controls.tsx`.
- [ ] `mobile-gamepad.tsx` no contiene ningún literal de `game_id` (`"rocas"`, `"caida"`,
      `"bloque-buster"`, `"serpentina"`); cada `PAD_MAP` vive en el `*-player.tsx` de su juego,
      tipado `Partial<Record<PadControl, TouchAction>>` contra el motor de ese juego.
- [ ] Ningún archivo bajo `app/components/games/` importa `./touch-controls`.
- [ ] Los 4 `engine.ts` no cambian (git diff vacío para
      `app/components/games/*/engine.ts`).
- [ ] `registry.ts` no cambia.
- [ ] En un viewport `pointer: coarse`, `/juego/rocas/jugar` (y los otros 3) muestra: una barra
      superior con `VOLVER` y el selector de skin compacto, el canvas en el centro, y el mando
      (`▲ ▼ ◄ ►` + `A` + `B`) abajo.
- [ ] En `pointer: coarse` y retrato, la vista de juego ocupa el alto del viewport y **la página no
      hace scroll vertical ni horizontal**.
- [ ] El canvas nunca queda tapado por el mando ni por la barra: `object-fit: contain` mantiene el
      juego completo visible.
- [ ] `rocas`: `◄ ►` rotan, `▲` y `B` propulsan, `A` dispara, `▼` está atenuado y no hace nada.
- [ ] `caida`: `◄ ►` mueven, `▼` es soft drop, `▲` y `B` rotan, `A` es hard drop; ningún botón
      atenuado.
- [ ] `bloque-buster`: `◄ ►` mueven la paleta; `▲ ▼ A B` están atenuados y no hacen nada.
- [ ] `serpentina`: `▲ ▼ ◄ ►` fijan la dirección; `A` y `B` están atenuados.
- [ ] Un botón atenuado (`.is-idle`) no dispara `onInput` ni al mantenerlo pulsado.
- [ ] Soltar un botón de acción sostenido (`thrust`, `down`, …) o salir del botón con el dedo
      (`pointercancel` / `pointerleave`) envía `onInput(action, false)` — no se queda "pegado".
- [ ] En `pointer: coarse` y apaisado (`orientation: landscape`), el canvas llena la pantalla, el
      D-pad queda abajo-izquierda y `A`/`B` abajo-derecha superpuestos, la barra superior es una
      franja translúcida, y se puede completar una partida sin scroll en ningún eje.
- [ ] En escritorio (`pointer: fine`), los 4 reproductores se ven **igual que antes de esta spec**:
      marco CRT centrado, `<SkinPicker>` de 3 botones donde ya estaba, `VOLVER` bajo el marco, sin
      mando en pantalla; el teclado controla los 4 juegos como antes.
- [ ] El `<SkinPicker compact />` de la barra muestra la skin activa y al pulsarlo cicla
      `clasico → neon → retro → clasico`, aplicándola al motor y guardándola en `localStorage`
      (clave `arcade-vault:skin:<gameId>`); recargar conserva la elección.
- [ ] `caida` no muestra selector de skin (no tiene skins); su barra lleva solo `VOLVER`.
- [ ] El overlay de fin de partida (`.modal`) aparece centrado y es usable en retrato y apaisado; el
      input de iniciales y `GUARDAR PUNTUACIÓN` funcionan; `JUGAR DE NUEVO` reinicia vía
      `game.restart()`.
- [ ] Navegar fuera de `/juego/<id>/jugar` a media partida no deja errores en consola ni un
      `requestAnimationFrame` activo (heredado de SPEC 05, revalidado con el layout nuevo).
- [ ] A ~390 px de viewport, `document.documentElement.scrollWidth ===
document.documentElement.clientWidth` en `/`, `/biblioteca`, `/salon`, `/juego/rocas` y
      `/juego/rocas/jugar`.
- [ ] El menú hamburguesa del `site-nav` sigue abriendo y cerrando el panel off-canvas con su
      transición; el panel cerrado no añade ancho a la página.
- [ ] `app/globals.css` ya no contiene las clases `.asteroids-touch`, `.tetris-touch`,
      `.arkanoid-touch`, `.snake-touch` (ni sus `-btn`); sí conserva `.asteroids-canvas`,
      `.tetris-canvas`, `.arkanoid-canvas`, `.snake-canvas` y `.*-stage`.
- [ ] `app/globals.css` no redefine `:root`, `body` salvo el `overflow-x`, `.btn`, `.modal*`,
      `.podium*`, `.hall-table*`, `.leaderboard`, `.lb-row`, `.lb-empty`, ni ningún `.cover-*`.
- [ ] Hay screenshots en `.playwright-screenshots/` de los 4 juegos (`/juego/<id>/jugar`) en retrato
      (~390 y ~412 px) y apaisado (~844×390), más escritorio 1280 de los 4.
- [ ] `CLAUDE.md` "Stack notes" describe el mando compartido genérico (`mobile-gamepad.tsx`, con el
      `PAD_MAP` en cada envoltorio) y ya no dice que cada juego trae `touch-controls.tsx`.
- [ ] La memoria `nav-overflow-390px` queda actualizada como resuelta por SPEC 10.

---

## Decisions

- **Sí:** **un** mando compartido `MobileGamepad` genérico, en vez de 4 `touch-controls.tsx`. El
  90 % de esos componentes era idéntico; centralizar deja un solo sitio para el look del mando y el
  cableado de punteros. **No:** mantener un componente por juego — duplicación que ya nos costó 4
  bloques CSS casi iguales.
- **Sí:** el mapa botón→acción (`PAD_MAP`) vive en **cada envoltorio**, tipado contra el
  `TouchAction` de su motor. Colocado junto a `handleInput`, verificado por el compilador, y añadir
  un juego no obliga a tocar código compartido. **No:** un `Record<gameId, GamepadMap>` central en
  un `gamepad-map.ts` — acopla un componente presentacional a todos los juegos (justo lo que el repo
  evita: `registry.ts` es el único mapa central y lo es por obligación de la ruta) y degrada el tipo
  a `string | null`, obligando a verificar los valores a mano.
- **Sí:** botonera **fija** (`▲ ▼ ◄ ► A B`) para los 4 juegos, con los controles no usados
  atenuados. Da un mando reconocible y estable entre juegos, como pidió el usuario. **No:** mostrar
  por juego solo sus botones — cada juego tendría un mando de distinto tamaño y posición, y el
  jugador tendría que reorientarse.
- **Sí:** **2 botones de acción** (`A` / `B`) como tope. Los juegos arcade de la plataforma no
  necesitan más (`rocas` = disparar + propulsar; el resto, 0–1). **No:** 3+ botones ni gatillos —
  ocupan ancho y ninguno de los 4 juegos los usa.
- **Sí:** mapear `▲` → `rotate` y `B` → `rotate` en `caida`, y `▲`/`B` → `thrust` en `rocas`, en el
  `PAD_MAP` del envoltorio, no en el motor. Mantiene los `engine.ts` intactos y la mecánica sin
  tocar. **No:** añadir un `TouchAction` nuevo a los motores para el mando.
- **Sí:** **layout de pantalla completa** en `pointer: coarse` (barra / canvas / mando, sin scroll
  de página). El marco CRT decorativo y el `crt-bottom` no caben en un móvil y competían con el
  canvas. **No:** conservar el marco CRT y meter el mando debajo con scroll — es justo el problema
  de la captura del usuario.
- **Sí:** **barra compacta sobre el canvas** con `VOLVER` + skin (un botón que cicla). Mantiene esas
  acciones accesibles sin robarle sitio al canvas ni al mando. **No:** meterlas en el overlay de
  pausa — esconde el cambio de skin tras una interacción extra. **No:** dejarlas debajo del mando
  con scroll — reintroduce el scroll que queremos quitar.
- **Sí:** en **apaisado**, mando dividido en dos mitades superpuestas sobre un canvas a pantalla
  completa (estilo consola portátil). Aprovecha el ancho y es el gesto natural con dos pulgares.
  **No:** la misma pila vertical en apaisado — dejaría el canvas como una franja corta y ancha.
- **Sí:** gate `@media (pointer: coarse)`, igual que hoy. Es el criterio que ya usa la plataforma y
  no necesita JS. **No:** un toggle manual para forzar el mando en escritorio — más superficie para
  un caso de borde (laptop táctil) que se cubre igual con `coarse`.
- **Sí:** arreglar el scroll horizontal de ~390 px del `site-nav` **en esta spec**, porque el
  usuario lo pidió y porque una spec de "jugar en móvil" que deja la página con scroll lateral está
  a medias. **No:** un rediseño del menú móvil — el fix es acotado (`overflow-x: clip` + panel
  cerrado sin ancho + glifo del botón).
- **No:** tocar el `PlayerScreen` simulado, los motores, `registry.ts`, `scores`, el catálogo, ni
  añadir Fullscreen / bloqueo de orientación / vibración. Cada una, si se hace, en su propia spec.

---

## Risks

| Riesgo                                                                                             | Mitigación                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.av-player--game` fijo a pantalla completa tapa el `site-nav` en la ruta de juego                 | Es aceptado: la vista de juego en móvil es inmersiva; `VOLVER` en la barra devuelve a la ficha, que sí tiene nav.                                                                                                                                              |
| `100dvh` / `inset: 0` con la barra de URL del móvil que aparece y desaparece                       | Se usa `inset: 0` sobre un contenedor `position: fixed` (se re-mide solo); el canvas es `flex: 1` y `object-fit: contain` absorbe el cambio. Revisión Playwright en retrato lo comprueba.                                                                      |
| `:has()` para ocultar los controles de escritorio sueltos no soportado en algún navegador objetivo | Fallback prescrito: clase `desktop-only-back` en los 4 wrappers en vez del selector `:has()`.                                                                                                                                                                  |
| Botón "pegado" si el dedo sale del botón sin `pointerup` (scroll fantasma)                         | `pointercancel` y `pointerleave` también envían `false`; `touch-action: none` en `.pad-btn` y en `.<juego>-canvas` evita el scroll.                                                                                                                            |
| `overflow-x: clip` en `html`/`body` rompe un `position: sticky` del nav o del salón                | Paso 5 verifica el nav y `/salon`; si `clip` en `body` molesta, se aplica solo a `html`.                                                                                                                                                                       |
| Doble mapeo (`▲` y `B` a la misma acción) causa un `false` prematuro al soltar uno                 | `setInput(action, pressed)` de los motores es idempotente y trabaja sobre un `Record<action, boolean>`; soltar `▲` pone `thrust=false` aunque `B` siga pulsado. Aceptado y documentado; alternativa (contador de pulsaciones por acción) queda fuera de scope. |
| El canvas 480×600 de `caida` se ve muy estrecho en apaisado                                        | `object-fit: contain` lo centra con barras laterales negras; es el comportamiento correcto para un tablero vertical. Screenshot dedicado.                                                                                                                      |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`                             | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                                                                                                                                                                                      |

---

## Lo que **no** entra en esta spec

- Fullscreen API, bloqueo de orientación, vibración / Haptics.
- Gestos de swipe o arrastre sobre el canvas.
- Mando remapeable, redimensionable o con un tercer botón / gatillos.
- Rediseño del HUD que cada motor pinta dentro del canvas.
- El `PlayerScreen` simulado y los 4 juegos falsos (`gloton`, etc.).
- Portar los otros 4 juegos simulados a motor real.
- Cualquier cambio en `engine.ts`, `registry.ts`, `scores`, catálogo, Supabase o migraciones.
- Rediseño del `site-nav` más allá del fix puntual del scroll horizontal.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
