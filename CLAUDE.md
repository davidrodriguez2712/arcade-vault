# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

**Arcade Vault** — a web platform for playing browser games online and competing on high scores (see `README.md`, in Spanish). It sits inside the `ClaudeCode/` monorepo alongside sibling game projects (`03-claude-tetris`, `04-arkanoid`); those are unrelated to this directory.

Current state: working platform. Pages: `/` home landing, `/biblioteca` catálogo, `/salon` Salón de la Fama (leaderboards), `/juego/[id]` ficha + `/juego/[id]/jugar` player, `/acerca` (con formulario de contacto), `/entrar` (tarjeta de acceso, sin auth real todavía), `/diagnostico/supabase` smoke test. Catálogo y marcas en Supabase. Cuatro juegos con motor real (`rocas`, `caida`, `bloque-buster`, `serpentina`); el resto son fichas simuladas. Specs entregadas en `specs/01-…` … `specs/09-…`.

## Workflow

The project follows **Spec-Driven Design** using the `/spec` and `/spec-impl` commands from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills). Skills instaladas en `.claude/skills/` (`spec`, `spec-impl`, `ui-ux-pro-max`, `add-game`) y `.agents/skills/`. Reinstalar/actualizar con:

```bash
npx skills@latest add Klerith/fernando-skills
```

Write a spec before implementing a feature.

Para juegos nuevos el flujo es: agente `game-planner` (decide un juego) o agente `game-jam` (lote de 3 specs por tema) — ver `## Agents` — → revisión → `/add-game` (redacta e implementa la spec).

## Commands

```bash
npm run dev     # next dev — también reescribe el bloque gestionado de AGENTS.md
npm run build   # next build
npm run start   # next start — sirve el build de producción
npm run lint    # eslint (flat config, eslint.config.mjs)
```

Formateo con Prettier (`prettier` en devDependencies, sin script propio).

No test runner is configured.

## Stack notes

- **Next.js 16.3.3, App Router.** Per `AGENTS.md`, this Next version has breaking changes vs. training data — read the relevant guide under `node_modules/next/dist/docs/` (`01-app/...`) before writing Next code.
- **React 19.2.8** — App Router pins its own React canary regardless of this version.
- **Tailwind CSS v4**, CSS-first config: `@import "tailwindcss"` and `@theme` live in `app/globals.css`; there is no `tailwind.config`. PostCSS via `@tailwindcss/postcss`.
- **TypeScript strict**, `@/*` path alias maps to the project root.
- Route-typed globals like `LayoutProps<"/">` / `PageProps` are generated into `.next/types` — use them directly, don't import from `next`.
- **Supabase** via `@supabase/ssr`: clients in `app/lib/supabase/` (`client.ts` browser, `server.ts` server + Server Actions, `public.ts` cookie-less read-only client for public data so pages stay static/ISR), session refresh in root `proxy.ts` (Next 16 renamed `middleware` → `proxy`). Tipos generados en `app/lib/supabase/database.types.ts` (Supabase MCP `generate_typescript_types`). Env vars `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (see `.env.example`). Migraciones en `supabase/migrations/NN-slug.sql` (hoy hasta la 09), aplicadas con el MCP de Supabase. Smoke test: `/diagnostico/supabase`.
- **Catalog & scores in Supabase.** The game catalog is the `games` table, read with `getGames()` / `getGame()` from `app/lib/games.ts` (`FALLBACK_GAME_IDS` keeps the build alive if the DB is unreachable). High scores are the `scores` table: anonymous initials-only inserts under RLS, gated to games with `games.has_leaderboard = true` (today: `rocas`, `caida`, `bloque-buster` and `serpentina`) and more (see '/references/implemented-games.md') when you need to check which games are implemented and how to implement new ones. `getTopScores()` / `seededScores()` in `app/lib/scores.ts` read them; `submitScore()` in `app/lib/scores-actions.ts` writes them and revalidates `/salon` + `/juego/[id]`. `/salon` also uses ISR (`revalidate = 60`). Games without a real engine still show `seededScores` mocks.
- **Formulario de contacto** (`/acerca`): `POST /api/contacto` (`app/api/contacto/route.ts`) valida con `app/lib/contact.ts` (+ honeypot `company`) y envía el correo con **Resend** (`resend` dep, env `RESEND_API_KEY`, remitente `onboarding@resend.dev`).
- **Real games** live in `app/components/games/<game>/` as a framework-agnostic `engine.ts` (canvas game loop, no React/Next imports) plus a thin `"use client"` wrapper. El mando táctil es compartido: `app/components/games/mobile-gamepad.tsx` (`<MobileGamepad>` genérico — D-pad `▲▼◄►` + `A`/`B`, agnóstico del juego); cada envoltorio le pasa su `PAD_MAP` local (`Partial<Record<PadControl, TouchAction>>` tipado contra su propio motor; clave ausente ⇒ botón atenuado). En `@media (pointer: coarse)` el reproductor pasa a pantalla completa (barra `VOLVER` + skin / canvas / mando), sin scroll de página; en apaisado el mando se divide en dos mitades superpuestas. Registered by game id in `app/components/games/registry.ts` (`REAL_GAME_PLAYERS`); `/juego/[id]/jugar` renders the real player when registered, otherwise the simulated `PlayerScreen`. So far: `asteroids` → `rocas`, `tetris` → `caida` (480×600 internal space, board + side panel drawn on one canvas), `arkanoid` → `bloque-buster` (800×600 internal space, procedural neon render of the vanilla breakout, 5 levels, ends on 3 lives lost or level 5 cleared), `snake` → `serpentina` (800×600 internal space, 32×22 grid + 50px HUD band, dies on wall or self, speeds up every 4 fruits over 6 tiers; the fruit sprite is drawn from `public/games/serpentina/fruits.png` — the only binary asset in `public/` — with a procedural diamond fallback until it loads). On game over the engine fires `onGameOver`; the wrapper shows a React save overlay (canvas no longer draws its own GAME OVER text).

## Skills

- `/frontend-design` — úsalo siempre para diseñar la interfaz de usuario. `/ui-ux-pro-max` para intel de UI/UX (estilos, paletas, tipografías, guías).
- `/spec` + `/spec-impl` — Spec-Driven Design (redactar spec → aprobación → implementar).
- `/add-game` (`.claude/skills/add-game/`) — añade un juego nuevo con su leaderboard: redacta la spec `NN-slug.md` (motor + tabla `scores` + cableado), espera aprobación, y la implementa paso a paso. El juego puede portarse desde `references/started-games/` o hacerse desde cero.

## Agents

- `game-planner` (`.claude/agents/game-planner.md`) — decide **qué** juego añadir a continuación y si encaja con la plataforma (categoría, estética CRT, motor agnóstico, puntuación para el leaderboard). Mantiene su memoria de sugerencias en `references/game-suggestion-todo.md`. Entrega el handoff a `/add-game`; no escribe specs ni código.
- `game-jam` (`.claude/agents/game-jam.md`) — dado un **tema**, elige 3 juegos que encajan con la plataforma y redacta por cada uno dos specs completas (`01` motor + `02` vitrina) en `specs/game-jam/<game-id>/`, en `Borrador`, para revisión humana. No implementa ni ejecuta `/add-game`; solo escribe los `.md` bajo `specs/game-jam/`.
- `skin-designer` (`.claude/agents/skin-designer.md`) — implementa el sistema de skins en **un juego a la vez, solo el que se le indique** (nunca audita ni toca los demás). Le añade al menos 3 skins (`clasico` por defecto, `neon`, `retro`) como paleta `<NOMBRE>_SKINS` en `engine.ts` conmutable con `setSkin()`, más un `<SkinPicker>` en el envoltorio con la preferencia en `localStorage`. Mantiene el registro de qué juegos ya tienen skins en `references/game-skins.md`. Toca ese engine, su envoltorio y `app/globals.css`; no toca mecánica, puntuación, `scores`, `registry.ts` ni migraciones.
- `mobile-porter` (`.claude/agents/mobile-porter.md`) — audita y corrige la presentación **móvil** (navegador táctil) de **una zona por invocación**: una página de la plataforma (`/`, `/biblioteca`, `/salon`, `/juego/[id]`, `/acerca`, `/entrar`) o el reproductor de un juego real. Usa la SPEC 10 (`specs/10-jugar-en-movil-tactil.md`) como contrato, verifica con Playwright (retrato ~390/~412, apaisado ~844×390, escritorio 1280 sin regresión) y mantiene el registro en `references/mobile-porting.md`. Toca CSS responsive (`@media`) y JSX de layout/página/reproductor; no toca engines, `registry.ts`, `scores` ni migraciones.

## The managed agent-rules block

The marked block in `AGENTS.md` is auto-generated and re-added by `next dev` (`node_modules/next/dist/server/lib/generate-agent-files.js`). Commit it together with your changes so the working tree stays clean; deleting it from a diff just recreates the uncommitted change.
