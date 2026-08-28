# Supabase — esquema y migraciones

Proyecto remoto: **`itmhyidlxraapcjzprvn`** (`https://itmhyidlxraapcjzprvn.supabase.co`).

## Migraciones

Cada cambio de esquema (tablas, RLS, triggers, funciones) va como un archivo SQL
en `migrations/`, con nombre `NNN_descripcion.sql` (numeración incremental).

Los archivos se aplican al proyecto remoto con la herramienta `apply_migration`
del MCP de Supabase (`.mcp.json`). No se usa el stack local de la CLI (`supabase
start` / `supabase db push`) ni `config.toml`.

Flujo:

1. Escribir el `.sql` en `migrations/`.
2. Aplicarlo con `apply_migration` (nombre = el del archivo sin extensión).
3. Regenerar `app/lib/supabase/database.types.ts` con `generate_typescript_types`.
4. Commitear el `.sql` y los tipos juntos.

## Estado actual

Sin tablas. La SPEC 04 solo montó los clientes, el `proxy.ts` de sesión y la
ruta `/diagnostico/supabase`. Las tablas (`profiles`, `scores`) llegan en specs
posteriores.
