-- SPEC 11 — Quinto juego real: Frogger en la entrada `ranaria` con leaderboard
-- Aplicada al proyecto remoto itmhyidlxraapcjzprvn con mcp__supabase__apply_migration.
--
-- `ranaria` ya existe en public.games (sembrada en la migración 06 como ficha
-- simulada). Esta migración solo activa su leaderboard: a partir de aquí la
-- política RLS de insert de public.scores acepta filas con game_id = 'ranaria'.
--
-- No se toca el copy (`short` / `long`) ni la tabla public.scores. El motor real
-- vive en app/components/games/frogger/ y se registra como `ranaria` en
-- app/components/games/registry.ts.

update public.games
set has_leaderboard = true
where id = 'ranaria';
