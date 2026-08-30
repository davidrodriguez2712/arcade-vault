-- SPEC 13 — Endurecimiento de seguridad: cierre de avisos del linter
-- Aplicada al proyecto remoto itmhyidlxraapcjzprvn con mcp__supabase__apply_migration
-- (nombre 12_endurecer_seguridad).
--
-- Hace dos cosas:
--
--   1. Revoca el EXECUTE de public.rls_auto_enable() a anon / authenticated /
--      public. Es una función SECURITY DEFINER de event trigger (auto-activa RLS
--      en tablas nuevas de public) que Supabase deja expuesta como RPC en
--      /rest/v1/rpc/rls_auto_enable. Llamarla por RPC ya falla (usa
--      pg_event_trigger_ddl_commands(), solo válido dentro de un event trigger),
--      pero el linter la marca igual (avisos 0028 / 0029). El event trigger sigue
--      vivo: se ejecuta con los privilegios de su owner, no con el EXECUTE del
--      rol de sesión que aquí se revoca.
--
--   2. Reafirma RLS en public.games y public.scores. Ya estaba activa desde la
--      migración 06; estas dos líneas son idempotentes y dejan el "endurecimiento"
--      autoexplicativo en el repo.
--
-- No crea tablas, columnas ni tipos. No hace falta regenerar database.types.ts.

-- 1. Revoca la RPC accidental (linter 0028 / 0029).
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

-- 2. Reafirma RLS (idempotente; ya estaba activa desde SPEC 06).
alter table public.games  enable row level security;
alter table public.scores enable row level security;
