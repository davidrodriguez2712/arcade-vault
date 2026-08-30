# Skins por juego — Arcade Vault

Registro de qué juegos con motor real tienen implementado el sistema de skins.
Lo mantiene el agente `skin-designer` (`.claude/agents/skin-designer.md`), que trabaja
**un juego a la vez** y solo sobre el juego que se le indique.

## Contrato

Cada juego que "cumple" tiene, en `app/components/games/<DIR>/engine.ts`:

- `interface <Nombre>Palette` — un rol de color por uso del canvas.
- `const <NOMBRE>_SKINS: Record<SkinName, <Nombre>Palette>` con las claves exactas
  `clasico` · `neon` · `retro`.
- `skin: SkinName = "clasico"` + `setSkin(name)` que aplica al vuelo.

Y en `app/components/games/<DIR>/<DIR>-player.tsx`:

- `<SkinPicker gameId value onChange>` fuera del `<canvas>` y del overlay.
- Preferencia cargada con `loadSkin(GAME_ID)` y guardada con `saveSkin(GAME_ID, skin)`
  (`localStorage`, clave `arcade-vault:skin:<gameId>`).

Skins:

- **`clasico`** (por defecto) — la paleta original del juego, sin cambios.
- **`neon`** — paleta casa saturada cian/magenta/amarillo/verde sobre negro, glow CRT.
- **`retro`** — fósforo monocromo cálido (ámbar/verde), bajo contraste, sin glow.

## Infra compartida

| Archivo                                   | Estado    |
| ----------------------------------------- | --------- |
| `app/components/games/skins.ts`           | Pendiente |
| `app/components/games/skin-picker.tsx`    | Pendiente |
| `app/globals.css` · bloque `.skin-picker` | Pendiente |

La primera invocación del agente que implemente skins crea esta infra.

## Estado por juego

Fuente de la lista: `REAL_GAME_PLAYERS` en `app/components/games/registry.ts`.

| ID              | Motor (`<DIR>`) | Skins      | Fecha | Notas |
| --------------- | --------------- | ---------- | ----- | ----- |
| `rocas`         | `asteroids`     | ❌ ninguna | —     |       |
| `caida`         | `tetris`        | ❌ ninguna | —     |       |
| `bloque-buster` | `arkanoid`      | ❌ ninguna | —     |       |
| `serpentina`    | `snake`         | ❌ ninguna | —     |       |

Leyenda de la columna **Skins**: `❌ ninguna` · `✅ clasico + neon + retro` · `⚠️ parcial`.
