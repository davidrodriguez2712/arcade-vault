-- SPEC 09 — Cuarto juego real: Snake en la entrada `serpentina` con leaderboard
-- Aplicada al proyecto remoto itmhyidlxraapcjzprvn con mcp__supabase__apply_migration.
--
-- `serpentina` ya existe en public.games (sembrada en la migración 06). Esta
-- migración solo activa su leaderboard: a partir de aquí la política RLS de insert
-- de public.scores acepta filas con game_id = 'serpentina'.
--
-- El copy (`short` / `long`) de la fila menciona "núcleos magenta"; con las frutas
-- del spritesheet queda desalineado, pero reescribirlo va en su propia spec — no se
-- toca aquí. La tabla public.scores no cambia.

update public.games
set has_leaderboard = true
where id = 'serpentina';
