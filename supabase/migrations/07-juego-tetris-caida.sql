-- SPEC 07 — Segundo juego real: Tetris en la entrada `caida` con leaderboard
-- Aplicada al proyecto remoto itmhyidlxraapcjzprvn con mcp__supabase__apply_migration.
--
-- `caida` ya existe en public.games (sembrada en la migración 06). Esta migración
-- solo activa su leaderboard: a partir de aquí la política RLS de insert de
-- public.scores acepta filas con game_id = 'caida'.
--
-- El copy (`short` / `long`) de la fila ya describe el juego real (rotar piezas,
-- limpiar líneas, la velocidad sube cada 10 líneas) — no se toca.
-- La tabla public.scores no cambia.

update public.games
set has_leaderboard = true
where id = 'caida';
