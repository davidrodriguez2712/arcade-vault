# Calidad móvil por zona — Arcade Vault

Registro de qué zonas de la plataforma (páginas y reproductores) están revisadas para verse y
jugarse bien en el navegador táctil de un móvil.
Lo mantiene el agente `mobile-porter` (`.claude/agents/mobile-porter.md`), que trabaja
**una zona a la vez** y solo sobre la zona que se le indique.

## Contrato

Una zona "cumple" cuando, a ~390 y ~412 px:

- `document.documentElement.scrollWidth === clientWidth` (sin scroll horizontal).
- Ningún texto cortado ni caja desbordada; ningún ancho fijo mayor que el viewport.
- Objetivos táctiles ≥ 44×44 px.
- Grids/tablas/raíles colapsados a 1–2 columnas; lo que scrollee, en su propio `overflow-x: auto`.
- La estética a 1280 px no cambia respecto al estado previo.

Para un reproductor, además, se cumple la SPEC 10 (barra `VOLVER` + skin compacto, canvas
`object-fit: contain` sin recorte, mando `▲▼◄► A B` con los no mapeados atenuados, apaisado con el
mando dividido, overlay de fin de partida usable).

El contrato completo de móvil vive en `specs/10-jugar-en-movil-tactil.md`.

## Estado por zona

| Zona                          | Ruta / archivos                                                   | Retrato        | Apaisado       | Overflow-x     | Fecha      | Notas                                                               |
| ----------------------------- | ----------------------------------------------------------------- | -------------- | -------------- | -------------- | ---------- | ------------------------------------------------------------------- |
| `home`                        | `/` · `app/page.tsx`                                              | ✅             | —              | ✅             | 2026-08-29 | Verificado en SPEC 10 (paso 5, `spec10-step5-home-390-nooverflow`). |
| `biblioteca`                  | `/biblioteca` · `app/biblioteca/**`                               | ❌ sin revisar | ❌ sin revisar | ❌ sin revisar | —          |                                                                     |
| `salon`                       | `/salon` · `app/salon/**`                                         | ❌ sin revisar | ❌ sin revisar | ❌ sin revisar | —          |                                                                     |
| `ficha`                       | `/juego/[id]` · `app/juego/[id]/**`                               | ❌ sin revisar | ❌ sin revisar | ❌ sin revisar | —          |                                                                     |
| `entrar`                      | `/entrar` · `app/entrar/**`                                       | ❌ sin revisar | ❌ sin revisar | ❌ sin revisar | —          |                                                                     |
| `acerca`                      | `/acerca` · `app/acerca/**`                                       | ❌ sin revisar | ❌ sin revisar | ❌ sin revisar | —          |                                                                     |
| `reproductor · rocas`         | `/juego/rocas/jugar` · `app/components/games/asteroids/**`        | ✅             | ✅             | ✅             | 2026-08-29 | Implementado en SPEC 10.                                            |
| `reproductor · caida`         | `/juego/caida/jugar` · `app/components/games/tetris/**`           | ✅             | ✅             | ✅             | 2026-08-29 | Implementado en SPEC 10. Sin selector de skin.                      |
| `reproductor · bloque-buster` | `/juego/bloque-buster/jugar` · `app/components/games/arkanoid/**` | ✅             | ✅             | ✅             | 2026-08-29 | Implementado en SPEC 10.                                            |
| `reproductor · serpentina`    | `/juego/serpentina/jugar` · `app/components/games/snake/**`       | ✅             | ✅             | ✅             | 2026-08-29 | Implementado en SPEC 10. Mando `accent="green"`.                    |

Leyenda: `❌ sin revisar` · `✅ ok` · `⚠️ con pendientes`.
