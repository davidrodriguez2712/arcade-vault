# Supabase — esquema y migraciones

Proyecto remoto: **`itmhyidlxraapcjzprvn`** (`https://itmhyidlxraapcjzprvn.supabase.co`).

## Migraciones

Cada cambio de esquema (tablas, RLS, triggers, funciones) va como un archivo SQL
en `migrations/`, con nombre `NN-descripcion.sql` (numeración incremental).

Los archivos se aplican al proyecto remoto con la herramienta `apply_migration`
del MCP de Supabase (`.mcp.json`). No se usa el stack local de la CLI (`supabase
start` / `supabase db push`) ni `config.toml`.

Flujo:

1. Escribir el `.sql` en `migrations/`.
2. Aplicarlo con `apply_migration` (nombre = el del archivo sin extensión).
3. Regenerar `app/lib/supabase/database.types.ts` con `generate_typescript_types`.
4. Commitear el `.sql` y los tipos juntos.

## Estado actual

| Migración                       | Contenido                                                         |
| ------------------------------- | ----------------------------------------------------------------- |
| `06-tabla-juegos-y-leaderboard` | `public.games` (catálogo) + `public.scores` (leaderboard anónimo) |
| `07`…`10`                       | activan `has_leaderboard` en cada juego con motor real            |
| `11-perfiles-de-usuario`        | `public.profiles` + trigger `handle_new_user` (SPEC 12)           |

`public.scores` sigue siendo anónimo (iniciales); no tiene `user_id`.

## Auth (SPEC 12)

La auth real (alta, confirmación de correo, login por email, OAuth Google/GitHub,
`/perfil`) vive en el código (`app/lib/auth*.ts`, `app/auth/**`, `app/entrar`,
`app/perfil`). La tabla `public.profiles` y su trigger los crea la migración
`11-perfiles-de-usuario.sql`.

Además hay que configurar **a mano en el dashboard** de Supabase
(`https://supabase.com/dashboard/project/itmhyidlxraapcjzprvn`), porque el MCP no
expone la configuración de Auth:

### 1. Confirmación de correo

- **Authentication › Sign In / Providers › Email**: activar **Confirm email**.

### 2. Plantilla del correo de confirmación

- **Authentication › Emails › Templates › Confirm signup**: sustituir
  `{{ .ConfirmationURL }}` por:

  ```
  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
  ```

  (flujo server-side con `token_hash` + `verifyOtp`, no el flujo implícito).

### 3. URLs

- **Authentication › URL Configuration**:
  - **Site URL**: la URL del entorno que estés probando. En desarrollo,
    `http://localhost:3000`; en producción, el dominio real. El enlace del correo
    de confirmación usa este valor (`{{ .SiteURL }}`).
  - **Redirect URLs** (allowlist): añadir `http://localhost:3000/**` y la URL de
    producción con `/**`. La usa el retorno de OAuth (`/auth/callback`).

### 4. Proveedores OAuth

- **Authentication › Sign In / Providers**: activar **Google** y **GitHub** con su
  Client ID / Client Secret.
- En la consola de cada proveedor (Google Cloud, GitHub Developer Settings)
  registrar como **Authorized redirect URI** la callback de Supabase:

  ```
  https://itmhyidlxraapcjzprvn.supabase.co/auth/v1/callback
  ```

  (Supabase intercambia el código y luego redirige a `redirectTo`, que la app
  fija a `<origin>/auth/callback`.)

### Verificación

- `/diagnostico/supabase` sigue respondiendo "sin sesión".
- Alta con email → llega el correo → el enlace abre `/auth/confirm` → sesión
  iniciada.
- Botones Google / GitHub en `/entrar` → vuelven por `/auth/callback` con sesión.
