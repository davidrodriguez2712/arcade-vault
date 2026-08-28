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
- **Supabase** via `@supabase/ssr`: clients in `app/lib/supabase/` (`client.ts` browser, `server.ts` server), session refresh in root `proxy.ts` (Next 16 renamed `middleware` → `proxy`). Env vars `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` (see `.env.example`). Schema lives in `supabase/migrations/`, applied via the Supabase MCP. Smoke test: `/diagnostico/supabase`.

## Skills

Usa siempre /frontend-design para diseñar la interfaz de usuario

## The managed agent-rules block

The marked block in `AGENTS.md` is auto-generated and re-added by `next dev` (`node_modules/next/dist/server/lib/generate-agent-files.js`). Commit it together with your changes so the working tree stays clean; deleting it from a diff just recreates the uncommitted change.
