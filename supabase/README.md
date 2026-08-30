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

| Migración                       | Contenido                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `06-tabla-juegos-y-leaderboard` | `public.games` (catálogo) + `public.scores` (leaderboard anónimo)                        |
| `07`…`10`                       | activan `has_leaderboard` en cada juego con motor real                                   |
| `11-perfiles-de-usuario`        | `public.profiles` + trigger `handle_new_user` (SPEC 12)                                  |
| `12-endurecer-seguridad`        | `revoke execute` de `rls_auto_enable()` + RLS reafirmada en `games` / `scores` (SPEC 13) |

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

## Seguridad (SPEC 13)

La migración `12-endurecer-seguridad.sql` cubre la parte de base de datos (revoca
la RPC accidental `rls_auto_enable()` y reafirma RLS en `games` / `scores`). Los
headers de seguridad viven en `next.config.ts` (`headers()` + `poweredByHeader:
false`).

Lo que falta se configura **a mano en el dashboard** de Supabase
(`https://supabase.com/dashboard/project/itmhyidlxraapcjzprvn`), porque el MCP no
expone la configuración de Auth (mismo caso que SPEC 12):

### 1. Longitud mínima de contraseña = 8

- **Authentication › Sign In / Providers › Email**: _Minimum password length_ =
  `8`. El Server Action `signUp` ya valida `≥ 8`; esto alinea el dashboard (venía
  en su valor por defecto, 6).

### 2. Leaked password protection

- **Authentication › Sign In / Providers › Email** (o _Authentication › Policies_):
  activar _Leaked password protection_ (comprobación contra HaveIBeenPwned.org).
  Cierra el aviso `auth_leaked_password_protection` de `get_advisors`.

### 3. Password requirements = solo longitud

- **Authentication › Sign In / Providers › Email** › _Password Requirements_ =
  **"No required characters"**. Decisión de esta spec: solo longitud mínima, sin
  clases de caracteres obligatorias (la leaked password protection cubre el caso
  real de contraseñas ya comprometidas).

### 4. Rate limits anti-bot

- **Authentication › Rate Limits**: bajar los límites por defecto a valores
  anti-bot razonables. Valores aplicados:
  - _Sign ups / sign ins_: **30 / hora por IP** (defecto: 30 en 5 min).
  - _Token verifications_: **30 / hora por IP** (defecto: 30 en 5 min).
  - _Token refreshes_ y _Send email_ se dejan en su valor por defecto.
- La integración de un CAPTCHA (Cloudflare Turnstile / hCaptcha) queda **para otra
  spec**; aquí solo se baja el rate limit.

### 5. Protección de rutas

La protección de `/perfil` (y del resto de rutas con sesión) se mantiene **a nivel
de página** (SPEC 12): `proxy.ts` solo refresca el token de Supabase y no filtra
rutas, para no acoplar el proxy ni volver dinámicas `/`, `/biblioteca`, `/salon`.
No se toca `proxy.ts` en esta spec.

### Verificación

- `mcp__supabase__get_advisors` (security) ya **no** reporta
  `auth_leaked_password_protection` ni los dos avisos de `rls_auto_enable`.
- Crear un usuario de prueba desde el dashboard con contraseña de 7 caracteres
  falla; con 8 funciona.
- `mcp__supabase__list_tables` muestra `games` y `scores` con `rls_enabled: true`.
- Checklist completo: `references/security/security-checklist.md`.
