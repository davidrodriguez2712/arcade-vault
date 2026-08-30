---
name: spec-impl-game
description: Igual que /spec-impl (implementa una spec aprobada paso a paso, con rama y pausas) pero para specs de juego. Al terminar la implementación y su commit, encadena dos agentes en secuencia sobre el juego recién implementado — primero skin-designer, luego mobile-porter — nunca en paralelo. Comando manual.
disable-model-invocation: true
argument-hint: <NN-spec-name>
---

# /spec-impl-game — Implementa una spec de juego y encadena skin-designer → mobile-porter

Este comando hace **dos cosas, en este orden**:

1. Implementa la spec **exactamente con el método de `/spec-impl`** (mismas 4 fases, misma
   rama `spec-NN-slug`, mismas pausas, sin commitear por el usuario).
2. Una vez la spec está implementada, verificada y **commiteada por el usuario**, detona dos
   agentes **uno después del otro, jamás en paralelo**:
   - `skin-designer` sobre el `game-id` recién implementado → espera a que termine.
   - `mobile-porter` sobre el mismo `game-id` (su reproductor) → espera a que termine.

Úsalo cuando la spec a implementar **añade o modifica un juego con motor real**. Si la spec
no es de juego, el comando se comporta como `/spec-impl` normal y no encadena nada.

Tus respuestas van siempre en el idioma del prompt inicial (por defecto, español).

## Contexto de sesión

Estado del repositorio:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Config de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo de config)"`

Juegos reales ya registrados:
!`cat app/components/games/registry.ts 2>/dev/null || echo "(registry.ts no existe)"`

---

## Fases 1–4 · Implementar la spec (método de `/spec-impl`)

**Lee `.claude/skills/spec-impl/SKILL.md` y sigue sus 4 fases al pie de la letra.** Este
comando no reimplementa esa lógica: la ejecuta por referencia. Si por lo que sea no puedes
leer ese archivo, usa el recap de abajo, que es equivalente.

**Argumento recibido:** `$ARGUMENTS`

### Recap de las 4 fases de `/spec-impl` (respaldo)

- **Fase 1 — Identificar la spec.** Si `$ARGUMENTS` viene vacío, lista `specs/` y pide el
  nombre exacto; para. Si tiene valor, localiza el archivo en `specs/` (acepta nombre
  completo `07-portar-tetris`, solo número `07`, o solo slug `portar-tetris`). Si no lo
  encuentras, muestra las specs disponibles y pide corregir.
- **Fase 2 — Validar el estado.** Lee la spec. Busca la línea de estado cerca del header
  (`**Estado:**` / `**Status:**` / equivalente). **Solo continúas si el estado significa
  "Aprobado"** en cualquier idioma (`Aprobado`, `Approved`, `Aprovado`, `Approuvé`, …).
  Cualquier otra cosa (`Borrador`, `En revisión`, `Implementado`, `Obsoleto`, valor no
  reconocido, línea ausente) → **para** y muestra:

  ```
  ❌ No puedo implementar esta spec.

  Estado actual: [ESTADO ENCONTRADO]
  Solo trabajo con specs cuyo estado significa "Aprobado" (p. ej. `Aprobado`, `Approved`,
  o el equivalente en otro idioma).

  Para continuar tienes dos opciones:
    1. Si la spec está lista, ábrela y cambia el estado a "Aprobado" a mano.
       Ese cambio lo hace el humano, no el agente.
    2. Si aún necesita trabajo, usa /spec [nombre] para retomarla.
  ```

  No ofrezcas alternativas ni "puedo empezar igual si quieres". El bloqueo es intencional.

- **Fase 3 — Rama.** Si `git status --short` no está vacío, para, muestra los cambios
  pendientes y pregunta si commitea/stashea el usuario (recomendado) o continúa igual — **no
  hagas stash ni commit por el usuario**. Deriva la rama `spec-NN-slug` del nombre del
  archivo sin extensión. Lee `AutoCreateBranch` (ausente / no reconocido → `true`). Con
  `true`: `git checkout -b spec-NN-slug` (o `git checkout` si ya existe; si existe, lee
  `git log --oneline`, di qué pasos parecen hechos y propón desde cuál reanudar). Con
  `false`: pregunta `[s/N]` antes de tocar git. Luego muestra el resumen de la spec
  (objetivo, alcance, plan de implementación, criterios de aceptación) sin empezar a
  implementar.
- **Fase 4 — Implementar paso a paso.** Confirma con el usuario antes del Paso 1. Un paso
  del plan → resumen de archivos tocados → `Paso N completado. Revisa el diff y dime si sigo
con el Paso N+1.` → espera confirmación. **Nunca commitees automáticamente**, ni por paso
  ni al final. Implementa lo que dice la spec; lo mejorable se comenta, no se cambia por
  sorpresa. Ante una ambigüedad que la spec no resuelve: para, ofrece 2-3 opciones, espera
  decisión.

### Añadido propio de este comando: capturar el `GAME_ID`

Durante las fases 3–4, identifica el **`game-id` de catálogo** del juego que la spec
implementa (el `id` que la spec crea nuevo o reutiliza de `FALLBACK_GAME_IDS`; p. ej.
`rocas`, `caida`, `serpentina`). No lo confundas con el `<DIR>` de la carpeta del componente
(`asteroids`, `tetris`, `snake`).

Una vez implementado el último paso, **confírmalo** leyendo
`app/components/games/registry.ts`: el `game-id` debe aparecer como clave en
`REAL_GAME_PLAYERS`. Guarda ese valor como `GAME_ID` para las fases siguientes.

---

## Fase 5 · Cierre de la implementación + gate de commit

Al terminar el último paso del plan, emite el cierre de `/spec-impl`:

```
✅ Todos los pasos del plan están implementados.

Siguiente: verifica los criterios de aceptación de la spec uno a uno.
Si pasan todos, cambia el estado de la spec a "Implementado" y haz el commit final
(incluye el bloque gestionado de AGENTS.md / CLAUDE.md si `next dev` lo reescribió).
```

### 5a — Comprobación de encaje

Mira `REAL_GAME_PLAYERS` en `app/components/games/registry.ts`:

- **Si no hay `GAME_ID`** (la spec no añade ni toca un juego con motor real) → informa al
  usuario de que la spec no es de juego, que el trabajo termina aquí igual que con
  `/spec-impl`, y **no encadenes ningún agente**. Fin.
- **Si hay `GAME_ID`** → sigue a 5b.

### 5b — Gate de commit (obligatorio)

Pide al usuario que confirme **explícitamente** que:

1. Los criterios de aceptación de la spec pasan uno a uno.
2. Ha hecho el commit del juego en la rama `spec-NN-slug`.

**No continúes a la Fase 6 sin esa confirmación.** No commitees por el usuario. No lances
los agentes con el juego a medio implementar o sin commitear: `skin-designer` y
`mobile-porter` construyen encima y necesitan un diff limpio del que partir.

---

## Fase 6 · skin-designer

Con el juego ya commiteado:

1. Lanza **una sola** llamada a la herramienta de subagentes (`Task` / `Agent`) con
   `subagent_type: skin-designer`. Prompt:

   ```
   Implementa el sistema de skins (clasico + neon + retro) en el juego `<GAME_ID>`.
   Acabo de implementar y commitear su motor a partir de la spec `specs/NN-slug.md`;
   la rama activa es `spec-NN-slug`. Sigue tu contrato habitual y actualiza
   references/game-skins.md al terminar.
   ```

2. **Regla dura: espera la notificación de finalización de skin-designer antes de hacer
   NADA más.** No lances `mobile-porter` en el mismo mensaje. No lances los dos agentes en
   paralelo. El turno termina tras lanzar skin-designer; retomas al recibir su aviso de fin.

3. Cuando skin-designer termine: retransmite su informe corto al usuario (no cites el
   transcript entero). Si falló o quedó a medias, **detente aquí** y cuéntaselo al usuario —
   no sigas con mobile-porter sobre un estado roto.

4. Ofrece con `AskUserQuestion` (recomendado = sí) commitear el diff de skins antes de
   seguir. No commitees tú.

---

## Fase 7 · mobile-porter

**Solo después de que skin-designer haya terminado** (y, si el usuario quiso, commiteado):

1. Lanza **una sola** llamada a la herramienta de subagentes con
   `subagent_type: mobile-porter`. Prompt:

   ```
   Audita y corrige la vista móvil del reproductor del juego `<GAME_ID>`
   (`/juego/<GAME_ID>/jugar`). Acabo de implementar su motor y sus skins en la rama
   `spec-NN-slug`. Usa la SPEC 10 como contrato y actualiza references/mobile-porting.md
   al terminar.
   ```

2. Espera su notificación de finalización. Retransmite su informe corto al usuario.

---

## Fase 8 · Resumen final

Cuando mobile-porter termine, resume al usuario:

```
/spec-impl-game · <GAME_ID>

Spec         specs/NN-slug.md  →  Implementado  ·  rama spec-NN-slug
skin-designer  <una línea del informe>
mobile-porter  <una línea del informe>

Pendiente: revisa y commitea los diffs de skin-designer / mobile-porter que sigan
sin commitear (todos en la rama spec-NN-slug) antes de mergear.
```

---

## Reglas duras

- Este comando **no reimplementa** la lógica de `/spec-impl`: la sigue leyendo
  `.claude/skills/spec-impl/SKILL.md`. El recap embebido es solo un respaldo.
- **Nunca commitees automáticamente** — ni el juego, ni las skins, ni los fixes móviles.
  Commitear es decisión y comando del usuario.
- **Secuencia estricta:** `mobile-porter` no arranca hasta que `skin-designer` haya
  notificado su fin. Los dos agentes nunca van en el mismo mensaje ni en paralelo.
- **Una sola invocación de cada agente.** El `game-id` que reciben es idéntico y es el
  `GAME_ID` capturado en las fases 3–4 (clave en `REAL_GAME_PLAYERS`, no el `<DIR>`).
- **Gate de commit obligatorio** entre la implementación y la Fase 6: sin confirmación
  explícita del usuario de que verificó y commiteó, no se lanza ningún agente.
- Si la spec **no** añade ni toca un juego con motor real → termina como `/spec-impl`, sin
  agentes.
- Respeta el bloqueo de estado de `/spec-impl`: solo specs cuyo estado significa "Aprobado".
- Si `skin-designer` falla o queda a medias, no sigas con `mobile-porter`.
