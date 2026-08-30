# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

**Arcade Vault** — a web platform for playing browser games online and competing on high scores (see `README.md`, in Spanish). It sits inside the `ClaudeCode/` monorepo alongside sibling game projects (`03-claude-tetris`, `04-arkanoid`); those are unrelated to this directory.

Current state: working platform. Pages: `/` home landing, `/biblioteca` catálogo, `/salon` Salón de la Fama (leaderboards), `/juego/[id]` ficha + `/juego/[id]/jugar` player, `/acerca` (con formulario de contacto), `/entrar` (auth real: alta + login + OAuth), `/perfil` (cuenta), `/auth/*` (rutas de confirmación y callback), `/diagnostico/supabase` smoke test. Catálogo y marcas en Supabase. Cinco juegos con motor real (`rocas`, `caida`, `bloque-buster`, `serpentina`, `ranaria`); el resto son fichas simuladas. Specs entregadas en `specs/01-…` … `specs/12-…` (10 = jugar en móvil táctil, 11 = frogger, 12 = registro/login/auth); borradores de game jam en `specs/game-jam/<id>/`.

## Workflow

The project follows **Spec-Driven Design** using the `/spec` and `/spec-impl` commands from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills). Skills locales: `add-game` y `spec-impl-game` en `.claude/skills/`; `spec`, `spec-impl` y `ui-ux-pro-max` en `.agents/skills/` (con symlinks desde `.claude/skills/`). `/frontend-design` es una skill global del harness, no vive en el repo. Reinstalar/actualizar con:

```bash
npx skills@latest add Klerith/fernando-skills
```

Write a spec before implementing a feature.

Para juegos nuevos el flujo es: agente `game-planner` (decide un juego) o agente `game-jam` (3 juegos × 2 specs por tema) — ver `## Agents` — → revisión → `/add-game` (redacta e implementa la spec).

## Commands

```bash
npm run dev     # next dev — también reescribe el bloque gestionado de AGENTS.md
npm run build   # next build
npm run start   # next start — sirve el build de producción
npm run lint    # eslint (flat config, eslint.config.mjs)
```

Formateo con Prettier (`prettier` en devDependencies, sin script propio). Un hook `PostToolUse` en `.claude/settings.json` (matcher `Write|Edit`) auto-formatea cada `.js/.jsx/.ts/.tsx` tocado: `eslint --fix` + `prettier --write` + borrado de líneas en blanco.

No test runner is configured.

## Stack notes

- **Next.js 16.3.3, App Router.** Per `AGENTS.md`, this Next version has breaking changes vs. training data — read the relevant guide under `node_modules/next/dist/docs/` (`01-app/...`) before writing Next code.
- **React 19.2.8** — App Router pins its own React canary regardless of this version.
- **Tailwind CSS v4**, CSS-first config: `@import "tailwindcss"` and `@theme` live in `app/globals.css`; there is no `tailwind.config`. PostCSS via `@tailwindcss/postcss`.
- **TypeScript strict**, `@/*` path alias maps to the project root.
- Route-typed globals like `LayoutProps<"/">` / `PageProps` are generated into `.next/types` — use them directly, don't import from `next`.
- **Supabase** via `@supabase/ssr`: clients in `app/lib/supabase/` (`client.ts` browser, `server.ts` server + Server Actions, `public.ts` cookie-less read-only client for public data so pages stay static/ISR), session refresh in root `proxy.ts` (Next 16 renamed `middleware` → `proxy`). Tipos generados en `app/lib/supabase/database.types.ts` (Supabase MCP `generate_typescript_types`). Env vars `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (see `.env.example`). Migraciones en `supabase/migrations/NN-slug.sql` (empiezan en la 06, hoy hasta la 12), aplicadas con el MCP de Supabase. Smoke test: `/diagnostico/supabase`.
- **Catalog & scores in Supabase.** The game catalog is the `games` table, read with `getGames()` / `getGame()` from `app/lib/games.ts` (`FALLBACK_GAME_IDS` keeps the build alive if the DB is unreachable). High scores are the `scores` table: anonymous initials-only inserts under RLS, gated to games with `games.has_leaderboard = true` (today: `rocas`, `caida`, `bloque-buster`, `serpentina` and `ranaria`). See `references/implemented-games.md` when you need to check which games are implemented and how to implement new ones. `getTopScores()` / `seededScores()` in `app/lib/scores.ts` read them; `submitScore()` in `app/lib/scores-actions.ts` writes them and revalidates `/salon` + `/juego/[id]`. `/salon` also uses ISR (`revalidate = 60`). Games without a real engine still show `seededScores` mocks.
- **Formulario de contacto** (`/acerca`): `POST /api/contacto` (`app/api/contacto/route.ts`) valida con `app/lib/contact.ts` (+ honeypot `company`) y envía el correo con **Resend** (`resend` dep, env `RESEND_API_KEY`, remitente `onboarding@resend.dev`).
- **Auth real** (SPEC 12): Supabase Auth con alta email + contraseña (confirmación por correo, ruta `app/auth/confirm/route.ts`), login por email y OAuth Google/GitHub (`app/auth/callback/route.ts`), logout. `app/lib/auth-actions.ts` (`"use server"`: `signUp`/`signIn`/`signOut`/`updateUsername`), `app/lib/auth.ts` (`getSessionUser()` para servidor), `app/lib/auth-shared.ts` (tipos + `sanitizeNext`). Tabla `public.profiles` (una fila por `auth.users`, `username` único case-insensitive, trigger `handle_new_user` autogenera el username; función `username_available`). El nav (`site-nav.tsx`) lee la sesión **en cliente** (`onAuthStateChange`) para no volver dinámicas `/`, `/biblioteca`, `/salon`. `/entrar` redirige si ya hay sesión; `/perfil` se auto-protege (el `proxy.ts` no protege rutas). `scores` sigue anónimo (sin `user_id`). Config del dashboard (confirmación, plantilla, OAuth) en `supabase/README.md`.
- **Endurecimiento de seguridad** (SPEC 13): headers de seguridad en `next.config.ts` (`headers()` sobre `/(.*)` — `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`, `X-DNS-Prefetch-Control` — + `poweredByHeader: false`; **sin** CSP, va en otra spec). Migración `12-endurecer-seguridad.sql`: `revoke execute` de `rls_auto_enable()` (cierra los avisos del linter) + RLS reafirmada en `games` / `scores`. Ajustes de Auth (password mínima 8, leaked password protection, rate limits anti-bot) documentados en `supabase/README.md` §"Seguridad (SPEC 13)" y aplicados a mano en el dashboard. Checklist: `references/security/security-checklist.md`.
- **Real games** live in `app/components/games/<game>/` as a framework-agnostic `engine.ts` (canvas game loop, no React/Next imports) plus a thin `"use client"` wrapper. El mando táctil es compartido: `app/components/games/mobile-gamepad.tsx` (`<MobileGamepad>` genérico — D-pad `▲▼◄►` + `A`/`B`, agnóstico del juego); cada envoltorio le pasa su `PAD_MAP` local (`Partial<Record<PadControl, TouchAction>>` tipado contra su propio motor; clave ausente ⇒ botón atenuado). En `@media (pointer: coarse)` el reproductor pasa a pantalla completa (barra `VOLVER` + skin / canvas / mando), sin scroll de página; en apaisado el mando se divide en dos mitades superpuestas. El sistema de skins también es compartido: `app/components/games/skins.ts` (`SkinName` = `clasico`/`neon`/`retro`, `loadSkin`/`saveSkin` en `localStorage`, clave `arcade-vault:skin:<id>`) + `app/components/games/skin-picker.tsx` (`<SkinPicker>`); cada motor define su `<NOMBRE>_SKINS: Record<SkinName, …>` y conmuta al vuelo con `setSkin()`. Con skins hoy: `rocas`, `bloque-buster`, `serpentina` (registro en `references/game-skins.md`). Registered by game id in `app/components/games/registry.ts` (`REAL_GAME_PLAYERS`); `/juego/[id]/jugar` renders the real player when registered, otherwise the simulated `PlayerScreen`. So far: `asteroids` → `rocas`, `tetris` → `caida` (480×600 internal space, board + side panel drawn on one canvas), `arkanoid` → `bloque-buster` (800×600 internal space, procedural neon render of the vanilla breakout, 5 levels, ends on 3 lives lost or level 5 cleared), `snake` → `serpentina` (800×600 internal space, 32×22 grid + 50px HUD band, dies on wall or self, speeds up every 4 fruits over 6 tiers; the fruit sprite is drawn from `public/games/serpentina/fruits.png` — the only binary asset in `public/` — with a procedural diamond fallback until it loads), `frogger` → `ranaria` (640×560 internal space, 16×14 grid of 40px cells, road + river lanes + 5 goal homes, dies on car/water/timeout, level up on filling all 5 homes). On game over the engine fires `onGameOver`; the wrapper shows a React save overlay (canvas no longer draws its own GAME OVER text).

## Skills

- `/frontend-design` (skill global del harness) — úsalo siempre para diseñar la interfaz de usuario. `/ui-ux-pro-max` para intel de UI/UX (estilos, paletas, tipografías, guías). Maquetas HTML/JSX de referencia visual en `references/templates/`.
- `/spec` + `/spec-impl` — Spec-Driven Design (redactar spec → aprobación → implementar).
- `/add-game` (`.claude/skills/add-game/`) — añade un juego nuevo con su leaderboard: redacta la spec `NN-slug.md` (motor + tabla `scores` + cableado), espera aprobación, y la implementa paso a paso. El juego puede portarse desde `references/started-games/` (fuentes de sprites en `references/source-assets/`) o hacerse desde cero.
- `/spec-impl-game` (`.claude/skills/spec-impl-game/`) — como `/spec-impl` para una spec de juego ya aprobada: implementa paso a paso y, tras verificar y commitear, encadena `skin-designer` y luego `mobile-porter` sobre ese `game-id`, en secuencia (nunca en paralelo). Si la spec no es de juego, se comporta como `/spec-impl`.

## Agents

Flujo de juego nuevo: `game-planner` o `game-jam` → revisión humana → `/add-game`. Cada agente lleva su propio registro en `references/` y su contrato completo en su archivo de definición.

- **`game-planner`** — decide qué juego añadir y si encaja (categoría, CRT, motor agnóstico, puntuación). Memoria: `references/game-suggestion-todo.md`. Detalle: `.claude/agents/game-planner.md`.
- **`game-jam`** — dado un tema, redacta 3 × 2 specs de juego (`01` motor + `02` vitrina) en `specs/game-jam/<id>/`, en `Borrador`. No implementa. Detalle: `.claude/agents/game-jam.md`.
- **`skin-designer`** — implementa el sistema de skins en un juego (solo el indicado): `<NOMBRE>_SKINS` en `engine.ts` + `<SkinPicker>` en el envoltorio. Registro: `references/game-skins.md`. Detalle: `.claude/agents/skin-designer.md`.
- **`mobile-porter`** — audita y corrige una zona móvil táctil por invocación (una página o el reproductor de un juego real) contra la SPEC 10; verifica con Playwright. Registro: `references/mobile-porting.md`. Detalle: `.claude/agents/mobile-porter.md`.
- **`game-performance`** — perfila y optimiza (cambios invisibles, render pixel a pixel idéntico) el bucle de canvas de un juego real por invocación. Registro: `references/game-performance.md`. Detalle: `.claude/agents/game-performance.md`.

## The managed agent-rules block

`AGENTS.md` is _entirely_ the `BEGIN/END:nextjs-agent-rules` block (no hand-written content) — auto-generated and re-added by `next dev` (`node_modules/next/dist/server/lib/generate-agent-files.js`), and imported here via `@AGENTS.md`. Commit it together with your changes so the working tree stays clean; deleting it from a diff just recreates the uncommitted change.
