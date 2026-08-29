# Backlog de juegos — Arcade Vault

Memoria del agente `game-planner` (`.claude/agents/game-planner.md`). Registra qué juegos se han
sugerido, considerado o descartado para el catálogo, y por qué. El agente lo lee antes de proponer y
añade una entrada después. Precede al comando `/add-game`.

## Roster actual

| ID              | Título        | Categoría | Color   | Estado     |
| --------------- | ------------- | --------- | ------- | ---------- |
| `bloque-buster` | BLOQUE BUSTER | ARCADE    | cyan    | motor real |
| `caida`         | CAÍDA         | PUZZLE    | magenta | motor real |
| `serpentina`    | SERPENTINA    | ARCADE    | green   | motor real |
| `rocas`         | ROCAS         | SHOOTER   | yellow  | motor real |
| `gloton`        | GLOTÓN        | ARCADE    | yellow  | simulada   |
| `invasores`     | INVASORES     | SHOOTER   | green   | simulada   |
| `ranaria`       | RANARIA       | ARCADE    | green   | simulada   |
| `duelo-pixel`   | DUELO PIXEL   | VERSUS    | cyan    | simulada   |

Fuente: `app/lib/games.ts` (`FALLBACK_GAME_IDS`) + `app/components/games/registry.ts`
(`REAL_GAME_PLAYERS`). Un `id` con motor real no se vuelve a proponer.

## Formato de entrada

```
## AAAA-MM-DD — <Nombre del juego> (`<id>`)

- Veredicto: Recomendado | Considerado | Descartado
- Categoría: ARCADE · color: cyan
- Encaje: <una frase>
- Origen: portar (`references/started-games/...`) | desde cero
- Motor: espacio interno <WxH> · scoring <...> · level <...>
- Handoff: /add-game "<descripción>"
- Motivo (si Considerado/Descartado): <una frase>
- Resultado: (a mano) spec NN / implementado / abandonado
```

## Registro de sugerencias

Más reciente al final.

_Sin entradas todavía. Candidatas naturales aún sin evaluar: las 4 fichas simuladas — `gloton`
(≈ Pac-Man), `invasores` (≈ Space Invaders), `ranaria` (≈ Frogger), `duelo-pixel` (≈ Pong). Ya tienen
fila de catálogo, color y categoría._
