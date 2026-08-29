-- SPEC 08 — Tercer juego real: Arkanoid en la entrada `bloque-buster` con leaderboard
-- Aplicada al proyecto remoto itmhyidlxraapcjzprvn con mcp__supabase__apply_migration.
--
-- `bloque-buster` ya existe en public.games (sembrada en la migración 06). Esta
-- migración solo activa su leaderboard: a partir de aquí la política RLS de insert
-- de public.scores acepta filas con game_id = 'bloque-buster'.
--
-- El copy (`short` / `long`) de la fila ya describe el juego real (nave-paleta,
-- núcleo de plasma, muros de bloques cromáticos, niveles, racha) — no se toca.
-- La tabla public.scores no cambia.

update public.games
set has_leaderboard = true
where id = 'bloque-buster';
