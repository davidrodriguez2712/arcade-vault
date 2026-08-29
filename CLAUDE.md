# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

**Arcade Vault** — a web platform for playing browser games online and competing on high scores (see `README.md`, in Spanish). It sits inside the `ClaudeCode/` monorepo alongside sibling game projects (`03-claude-tetris`, `04-arkanoid`); those are unrelated to this directory.

Current state: freshly scaffolded `create-next-app`. `app/page.tsx` is still the starter template and the whole `05-arcade-vault/` directory is untracked in git — no game or platform code exists yet.

## Workflow

The project follows **Spec-Driven Design** using the `/spec` and `/spec-impl` commands from [Klerith/fernando-skills](https://github.com/Klerith/fernando-skills). Those skills are not installed yet — add them with:

```bash
npx skills@latest add Klerith/fernando-skills
```

Write a spec before implementing a feature.

## Commands

```bash
npm run dev     # next dev (Turbopack) — also rewrites the managed block in AGENTS.md/CLAUDE.md
npm run build   # next build
npm run start    # serve the production build
npm run lint    # eslint (flat config, eslint.config.mjs)
```

No test runner is configured.

## Stack notes

- **Next.js 16.3.3, App Router.** Per `AGENTS.md`, this Next version has breaking changes vs. training data — read the relevant guide under `node_modules/next/dist/docs/` (`01-app/...`) before writing Next code.
- **React 19.2.8** — App Router pins its own React canary regardless of this version.
- **Tailwind CSS v4**, CSS-first config: `@import "tailwindcss"` and `@theme` live in `app/globals.css`; there is no `tailwind.config`. PostCSS via `@tailwindcss/postcss`.
- **TypeScript strict**, `@/*` path alias maps to the project root.
- Route-typed globals like `LayoutProps<"/">` / `PageProps` are generated into `.next/types` — use them directly, don't import from `next`.
- **Supabase** via `@supabase/ssr`: clients in `app/lib/supabase/` (`client.ts` browser, `server.ts` server + Server Actions, `public.ts` cookie-less read-only client for public data so pages stay static/ISR), session refresh in root `proxy.ts` (Next 16 renamed `middleware` → `proxy`). Env vars `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (see `.env.example`). Schema lives in `supabase/migrations/`, applied via the Supabase MCP. Smoke test: `/diagnostico/supabase`.
- **Catalog & scores in Supabase.** The game catalog is the `games` table, read with `getGames()` / `getGame()` from `app/lib/games.ts` (`FALLBACK_GAME_IDS` keeps the build alive if the DB is unreachable). High scores are the `scores` table: anonymous initials-only inserts under RLS, gated to games with `games.has_leaderboard = true` (today: `rocas`, `caida`, `bloque-buster` and `serpentina`). `getTopScores()` reads them; `submitScore()` in `app/lib/scores-actions.ts` writes them and revalidates `/salon` + `/juego/[id]`. Games without a real engine still show `seededScores` mocks.
- **Real games** live in `app/components/games/<game>/` as a framework-agnostic `engine.ts` (canvas game loop, no React/Next imports) plus a thin `"use client"` wrapper. Registered by game id in `app/components/games/registry.ts` (`REAL_GAME_PLAYERS`); `/juego/[id]/jugar` renders the real player when registered, otherwise the simulated `PlayerScreen`. So far: `asteroids` → `rocas`, `tetris` → `caida` (480×600 internal space, board + side panel drawn on one canvas), `arkanoid` → `bloque-buster` (800×600 internal space, procedural neon render of the vanilla breakout, 5 levels, ends on 3 lives lost or level 5 cleared), `snake` → `serpentina` (800×600 internal space, 32×22 grid + 50px HUD band, dies on wall or self, speeds up every 4 fruits over 6 tiers; the fruit sprite is drawn from `public/games/serpentina/fruits.png` — the only binary asset in `public/` — with a procedural diamond fallback until it loads). On game over the engine fires `onGameOver`; the wrapper shows a React save overlay (canvas no longer draws its own GAME OVER text).

## Skills

Usa siempre /frontend-design para diseñar la interfaz de usuario

Para añadir un juego nuevo con su leaderboard, usa `/add-game` (`.claude/skills/add-game/`): redacta la spec `NN-slug.md` (motor + tabla `scores` + cableado), espera aprobación, y la implementa paso a paso. El juego puede portarse desde `references/started-games/` o hacerse desde cero.

## The managed agent-rules block

The marked block in `AGENTS.md` is auto-generated and re-added by `next dev` (`node_modules/next/dist/server/lib/generate-agent-files.js`). Commit it together with your changes so the working tree stays clean; deleting it from a diff just recreates the uncommitted change.
