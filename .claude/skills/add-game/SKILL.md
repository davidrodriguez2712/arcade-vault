---
name: add-game
description: Crea un juego nuevo con su leaderboard e intégralo en la plataforma. Primero redacta la spec NN-slug.md (motor del juego + tabla scores + cableado), espera aprobación humana, y luego la implementa paso a paso. El juego puede portarse desde references/started-games/ o construirse desde cero. Comando manual.
disable-model-invocation: true
argument-hint: 'descripción del juego (ej. "portar tetris a la entrada caida") · o NN-slug de una spec ya aprobada para implementarla'
---

# /add-game — Nuevo juego + leaderboard, de la spec a la implementación

## Contexto de sesión

Fecha de hoy (úsala en el header de la spec, nunca la inventes):
!`date +%F`

Specs que ya existen:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe todavía"`

Juegos de referencia disponibles para portar:
!`ls references/started-games/ 2>/dev/null || echo "(no hay carpeta references/started-games/)"`

Estado del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Config de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo de config)"`

Juegos reales ya registrados:
!`cat app/components/games/registry.ts 2>/dev/null || echo "(registry.ts no existe)"`

Método de spec del proyecto (skill `/spec`):
!`ls .agents/skills/spec/ .claude/skills/spec/ 2>/dev/null || echo "(el skill /spec no está instalado — usa solo spec-template.md y las specs existentes)"`

---

Este skill lleva un juego nuevo desde la idea hasta estar jugable en `/juego/<slug>/jugar` con su
tabla de puntuaciones real en `/juego/<slug>` y `/salon`. Reproduce el trabajo de SPEC 05 (motor
agnóstico de framework) + SPEC 06 (tabla `scores`, RLS, overlay de guardado) para cada juego nuevo.

**Argumento recibido:** `$ARGUMENTS`

Tus respuestas van siempre en el idioma del prompt inicial (por defecto, español).

## Invariante que nunca se rompe

`games.has_leaderboard = true` ⇔ el `id` del juego está en `REAL_GAME_PLAYERS`
(`app/components/games/registry.ts`).

- Flag `true` sin motor registrado → leaderboard donde nadie puede puntuar.
- Motor registrado sin el flag → la política RLS de `scores` rechaza el `insert`.

---

## Fase 0 — Enrutado

Mira la lista de `specs/` del contexto de sesión.

- **Si `$ARGUMENTS` identifica una spec existente** (nombre completo `07-portar-tetris`, solo número
  `07`, o solo slug `portar-tetris`) → salta directo a la **Fase 3**. Es la segunda invocación del
  pipeline: la spec ya está escrita y (se espera) aprobada.
- **En cualquier otro caso** → **Fase 1**. Estás redactando la spec. Si `$ARGUMENTS` viene vacío, pide
  una descripción de una sola frase de qué juego quieres añadir.

---

## Fase 1 — Aclarar mediante preguntas

**No escribes código en esta fase.** Solo recoges lo necesario para escribir la spec.

Antes de preguntar, lee para tener contexto:

1. `CLAUDE.md` (incluye `@AGENTS.md`) — stack, convenciones, la nota de "Real games" y "Catalog & scores".
2. **El método de spec del proyecto** (obligatorio antes de escribir nada en la Fase 2):
   - `.agents/skills/spec/SKILL.md` y `.agents/skills/spec/template.md` (o `.claude/skills/spec/…` si
     ahí está el symlink) — es la definición canónica de cómo se redacta una spec en este repo:
     estructura de secciones, reglas del header, numeración, slug, estados, y el seed de
     `specs/.spec-config.yml`. Si el skill `/spec` no está instalado, sáltate este punto.
   - **Todas** las specs de `specs/` (o al menos las 3-4 más recientes) — son la referencia real de
     estilo: copia su idioma, el wording exacto de los estados (`Borrador` / `En revisión` /
     `Aprobado` / `Implementado` / `Obsoleto`), la forma del header en blockquote, cómo numeran y cómo
     redactan Scope / Decisiones. Presta atención especial a `05-*` y `06-*`: esta spec es su
     continuación directa.
3. `app/lib/games.ts` — interfaz `Game`, `CATS`, `FALLBACK_GAME_IDS`, `GameColor`, `fallbackGame()`.
4. `app/components/games/registry.ts` — qué juegos ya tienen motor real.
5. `references/wiring-checklist.md` (junto a este skill) — el recorrido end-to-end y qué NO tocar.

Pregunta en bloques de 3-5 con `AskUserQuestion`, esperando respuesta entre bloques. Cubre:

1. **Entrada de catálogo.** ¿Reutilizar una fila que ya existe (como hizo `rocas`) o crear un `id`
   nuevo? Muestra los 8 ids de `FALLBACK_GAME_IDS` e indica cuáles ya tienen motor real. Si es nueva:
   pide `id` (slug kebab-case), `title`, `short`, `long`, `cat` (`ARCADE|PUZZLE|SHOOTER|VERSUS`),
   `color` (`cyan|magenta|yellow|green`), y el `sort_order` siguiente libre.
2. **Origen del juego.** ¿Portar desde `references/started-games/<carpeta>` o construir desde cero? Si
   se porta, lee ese `game.js` + `README.md` + `CLAUDE.md` antes de continuar y resume su arquitectura
   (globales, clases, loop, HUD, game over, scoring, assets).
3. **Leaderboard.** ¿`has_leaderboard = true`? Por defecto **sí** — es el propósito del skill. Si el
   usuario dice que no, la spec omite todo lo de `scores` y el envoltorio no monta overlay de guardado.
4. **Controles táctiles.** ¿Necesita `touch-controls.tsx`? ¿Qué acciones tiene la unión `TouchAction`
   (p. ej. `"left" | "right" | "thrust" | "fire"` para asteroides, `"left" | "right" | "down" |
"rotate" | "drop"` para tetris)?
5. **Espacio interno de coordenadas** fijo del motor (asteroides 800×600, tetris ~300×600). El escalado
   responsive vive solo en `resize()`.
6. **Nivel / dificultad para `scores.level`.** ¿El juego tiene un concepto de "nivel" que reportar?
   Si no, `submitScore` acepta `level: 1` fijo.
7. **Fuera de alcance.** Qué se menciona pero se difiere a otra spec (sonido, más niveles, sprites,
   modos de juego, portar otros juegos).

Deja de preguntar cuando puedas responder sin asumir nada:

- ¿Qué archivos aparecen o cambian?
- ¿Cuál es el primer paso ejecutable y cuál el último?
- ¿Cómo verifico que está terminado?

---

## Fase 2 — Escribir la spec

Escribes la spec siguiendo **el método de spec del proyecto** (el skill `/spec`), no un formato propio.
Este skill solo aporta el **contenido de dominio** (motor + `scores` + cableado); la estructura, el
header, la numeración y las reglas las manda `/spec`.

1. **Relee las referencias** (si no lo hiciste ya en la Fase 1):
   - `.agents/skills/spec/template.md` — la forma exacta que debe respetar la spec (orden de
     secciones, reglas del header en blockquote, "una frase por idea", nombres concretos, sin TODOs).
   - `.agents/skills/spec/SKILL.md` — Fases 3 y 4: cómo numerar, cómo derivar el slug, marcar
     `Borrador` por defecto (nunca `Aprobado`), verificar las dependencias referenciadas, y **sembrar
     `specs/.spec-config.yml` con `AutoCreateBranch: true` si no existe** (si ya existe, no lo toques).
   - Las specs de `specs/` — especialmente `05-*` y `06-*`. La spec nueva debe leerse como una más de
     esa serie: mismo idioma, mismos títulos de sección, mismo tono.
   - `spec-template.md` (junto a este skill) — el esqueleto de "juego + leaderboard" con Scope /
     Data model / Implementation plan / Acceptance criteria ya parametrizados. Es contenido de relleno,
     no un formato: adáptalo a la estructura real que usan las specs del repo.
2. Numera: el `NN` más alto de `specs/` + 1, con dos dígitos. Deriva un slug kebab-case del objetivo
   (p. ej. `portar-tetris-a-caida`).
3. Header, con la forma que usen las specs existentes:
   - `**Estado:** Borrador` (o el término exacto del repo). **Nunca `Aprobado`.**
   - `**Depende de:** SPEC 01, SPEC 05, SPEC 06` — verifica que cada una existe en `specs/`; si alguna
     falta, dilo en vez de dejar una referencia colgada.
   - `**Fecha:**` = la salida de `date +%F` del contexto de sesión. Nunca inventes la fecha.
   - `**Objetivo:**` una sola frase.
4. Rellena todas las secciones con nombres de archivo concretos, sin TODOs, combinando: la estructura
   de las specs del repo + el contenido de `spec-template.md` ajustado al juego (carpeta del
   componente, espacio de coordenadas, si hay táctiles, si el `id` es nuevo o reutilizado).
5. Escribe el archivo directamente en `specs/NN-slug.md`. **No pidas permiso para escribirlo ni
   preguntes si el nombre está bien.** Solo pregunta si el archivo ya existe. Si sembraste
   `specs/.spec-config.yml`, menciónalo.
6. **Para aquí.** Confirma al usuario:
   - Ruta del archivo creado.
   - La spec está en `Borrador`. La relee y cambia el estado a `Aprobado` a mano (eso lo hace el
     humano, no el agente).
   - Siguiente paso: `/add-game NN-slug` para implementarla.
   - No propongas implementar, ni escribir código, ni nada más allá de esta confirmación.

---

## Fase 3 — Validar el estado y crear la rama

1. **Localiza la spec** que indica `$ARGUMENTS` en `specs/`. Si no la encuentras, muestra las
   disponibles y pide que corrijan el nombre.
2. **Lee el archivo y valida el estado.** Busca la línea de estado cerca del header (etiqueta
   `**Estado:**` / `**Status:**` / equivalente). Solo continúas si el estado **significa "Aprobado"**
   en cualquier idioma (`Aprobado`, `Approved`, `Aprovado`, `Approuvé`, …). Cualquier otra cosa
   (`Borrador`, `En revisión`, `Implementado`, `Obsoleto`, valor no reconocido, línea ausente) → para
   y muestra:

   ```
   ❌ No puedo implementar esta spec.

   Estado actual: [ESTADO ENCONTRADO]
   Solo trabajo con specs cuyo estado significa "Aprobado".

   Para continuar:
     1. Si la spec está lista, ábrela y cambia el estado a "Aprobado" a mano.
        Ese cambio lo hace el humano, no el agente.
     2. Si aún necesita trabajo, usa /add-game <descripción> para retomarla.
   ```

   No ofrezcas alternativas ni "puedo empezar igual si quieres". El bloqueo es intencional.

3. **Comprueba el working tree.** Si `git status --short` no está vacío, para y muestra los cambios
   pendientes, luego pregunta:

   ```
   ⚠️ Hay cambios sin commitear en el working tree.
   Cambiar de rama se los llevaría. ¿Qué hacemos?
     1. Commitéalos o haz stash tú, y vuelve a lanzar el comando  (recomendado)
     2. Continuar igualmente — los cambios viajan a la rama nueva
   ```

   No hagas stash ni commit por el usuario salvo que lo pida explícitamente. Si el working tree está
   limpio, no lo menciones y sigue.

4. **Crea la rama.** Nombre: `spec-NN-slug` (el nombre del archivo sin extensión). Lee `AutoCreateBranch`
   de `specs/.spec-config.yml`:
   - Ausente / valor no reconocido → trátalo como `true`.
   - `true` → `git checkout -b spec-NN-slug` (o `git checkout` si ya existe; si existe, lee
     `git log --oneline`, di qué pasos del plan parecen hechos y propón desde cuál reanudar, y espera
     confirmación).
   - `false` → pregunta `¿Crear y cambiar a la rama spec-NN-slug? [s/N]` antes de tocar git. Si dice
     que no, implementa en la rama actual tras confirmación explícita.

5. **Muestra el resumen de la spec** (sin empezar a implementar): objetivo, scope, plan de
   implementación y criterios de aceptación. Luego:

   ```
   ✅ Lista para implementar.

   Spec:   specs/NN-slug.md
   Rama:   spec-NN-slug  (activa)
   Estado: Aprobado

   Voy a implementar siguiendo el plan de implementación al pie de la letra.
   Pauso después de cada paso para que revises el diff.

   ¿Empezamos por el Paso 1?
   ```

   Espera confirmación explícita.

---

## Fase 4 — Implementar paso a paso

Reglas durante toda la implementación:

- **Nunca commitees automáticamente.** Ni por paso ni al final. Escribes el código y muestras el diff;
  commitear es decisión y comando del usuario.
- **Implementa lo que dice la spec.** Si algo te parece mejorable, dilo como observación e implementa lo
  acordado. Los cambios van a la spec, no al código por sorpresa.
- **Ritmo:** un paso del plan → resumen de archivos tocados → `Paso N completado. Revisa el diff y dime
si sigo con el Paso N+1.` → espera confirmación.
- **Si aparece una ambigüedad** que la spec no resuelve: para, descríbela, ofrece 2-3 opciones
  concretas, espera decisión. No improvises.
- **Si piden algo fuera del scope:** recuérdalo, sugiere anotarlo para otra spec, no lo implementes en
  esta rama.

Apoyo para los pasos:

- Punto de partida del código: copia los archivos de `templates/` (junto a este skill) a
  `app/components/games/<carpeta>/` y adáptalos — **no los importes**. El motor real de asteroides en
  `app/components/games/asteroids/` es la referencia viva más completa.
- `references/wiring-checklist.md` tiene el contrato exacto del motor, las responsabilidades del
  envoltorio, la DDL / RLS de `scores`, las herramientas MCP a usar y el guion de verificación manual.
- Migraciones: escribe el `.sql` en `supabase/migrations/NN-<slug>.sql` **y** aplícalo con
  `mcp__supabase__apply_migration`. Regenera `app/lib/supabase/database.types.ts` con
  `mcp__supabase__generate_typescript_types`. Verifica con `mcp__supabase__list_tables` /
  `mcp__supabase__list_migrations`. Revisa `mcp__supabase__get_advisors` (el `insert` anónimo en
  `scores` es un hallazgo esperado; que no haya otros).

Al terminar el último paso:

```
✅ Todos los pasos del plan están implementados.

Siguiente: verificar los criterios de aceptación uno a uno.
Si pasan todos, cambia el estado de la spec a "Implementado", commitea (incluye el bloque
gestionado de AGENTS.md / CLAUDE.md si `next dev` lo reescribió) y mergea la rama.
```

---

## Reglas duras

- Nunca escribas código en las Fases 1-2; solo el `.md` de la spec.
- La spec sigue el método de `/spec`: lee `.agents/skills/spec/template.md` + las specs de `specs/`
  antes de redactar. `spec-template.md` de este skill es contenido de dominio, no un formato que
  sustituya al del proyecto.
- Nunca marques la spec como `Aprobado` automáticamente — lo hace el humano.
- Nunca implementes una spec cuyo estado no signifique "Aprobado".
- Mantén el invariante `has_leaderboard` ⇔ `REAL_GAME_PLAYERS`.
- El motor (`engine.ts`) no importa nada de `react` ni de `next`.
- No redefinas en `app/globals.css`: `:root`, `body`, `.av-nav`, `.btn`, `.crt*`, `.modal*`,
  `.podium*`, `.hall-table*`, `.leaderboard`, `.lb-row`, `.lb-empty`.
