# SPEC 12 — Registro, inicio de sesión y autenticación

> **Estado:** Aprobado
> **Depende de:** SPEC 04, SPEC 06
> **Fecha:** 2026-08-30
> **Objetivo:** Convertir el `/entrar` de maqueta en autenticación real con Supabase (alta con email + contraseña y confirmación de correo, login por email, OAuth de Google y GitHub, cierre de sesión, tabla `profiles` con username único y una página `/perfil`), dejando el juego abierto sin cuenta.

---

## Por qué existe esta spec

SPEC 04 cableó los clientes de Supabase (`@supabase/ssr`), el `proxy.ts` que refresca el token y la
ruta `/diagnostico/supabase`, pero dejó **fuera** todo lo de auth: `signUp`, `signInWithPassword`,
`signOut`, conectar `auth-card.tsx`, la sesión en el nav y `/entrar` funcional. Hoy `auth-card.tsx`
es una maqueta: el `submit` hace `router.push("/biblioteca")` sin tocar Supabase, el campo de login
se llama "Usuario", y los botones de Google / GitHub / invitado solo navegan.

Esta spec implementa esa auth real. El proyecto remoto `itmhyidlxraapcjzprvn` ya tiene el esquema
`auth` de Supabase (vacío) y las tablas `public.games` / `public.scores` de SPEC 06. No existe
tabla de perfiles.

Decisiones de forma cerradas con el usuario antes de escribir la spec:

- **Vías de acceso:** email + contraseña **y** OAuth de Google y GitHub. No entra el invitado
  anónimo de Supabase: "jugar como invitado" sigue siendo navegar a `/biblioteca` sin cuenta.
- **Confirmación de correo activada:** el alta manda un enlace de confirmación; hasta confirmarlo no
  hay sesión. Requiere ruta `/auth/confirm`, cambiar la plantilla de email en el dashboard y una
  pantalla "revisa tu correo".
- **Identidad:** tabla `public.profiles` (una fila por `auth.users`) con `username` único. Un
  trigger la rellena en cada alta. El username es el nombre público del jugador.
- **Login por email**, no por username: el campo pasa a "Correo electrónico" y se llama a
  `signInWithPassword({ email, password })` directo.
- **Auth opcional:** el `proxy.ts` **no** protege ninguna ruta ni redirige. Jugar sin cuenta sigue
  funcionando igual. Solo `/entrar` redirige (si ya hay sesión) y `/perfil` se auto-protege a nivel
  de página.
- **`/perfil` mínima:** muestra email y username, permite cambiar el username (con unicidad) y tiene
  "CERRAR SESIÓN".
- **El nav lee la sesión en cliente:** `site-nav.tsx` (ya es `"use client"`) usa el cliente de
  navegador + `onAuthStateChange`. Las páginas que hoy son estáticas / ISR (`/`, `/biblioteca`,
  `/salon`) **no** pasan a dinámicas.
- **OAuth sin username elegido:** el trigger autogenera un username a partir del email (`kai`, y si
  choca `kai2`, `kai3`…). El usuario lo cambia cuando quiera en `/perfil`.
- **`scores` no se toca:** el leaderboard sigue siendo anónimo por iniciales. `scores.user_id`, la
  fila "TU MEJOR MARCA" y vincular partidas a la cuenta van en otra spec.
- **Recuperar contraseña fuera:** "¿Olvidaste tu contraseña?" (`resetPasswordForEmail` + ruta de
  nueva contraseña + otra plantilla de email) va en su propia spec.

---

## Scope

**In:**

- **Migración `supabase/migrations/11-perfiles-de-usuario.sql`** (aplicada al proyecto remoto con
  `mcp__supabase__apply_migration`):
  - Tabla `public.profiles` (ver Data model): `id` → `auth.users(id)`, `username` con `CHECK` de
    formato, `created_at`, `updated_at`.
  - Índice único `profiles_username_lower_idx` sobre `lower(username)` (unicidad sin distinción de
    mayúsculas).
  - RLS: `SELECT` público (`anon`, `authenticated`); `UPDATE` solo del dueño
    (`auth.uid() = id`). Sin política de `INSERT` ni `DELETE` para usuarios.
  - Función `public.handle_new_user()` (`security definer`, `search_path = ''`) que inserta la fila
    de `profiles` derivando el username de `raw_user_meta_data->>'username'` o, si falta, del prefijo
    del email; si el candidato ya existe le añade un sufijo numérico.
  - Trigger `on_auth_user_created` `after insert on auth.users`.
- **Regenerar `app/lib/supabase/database.types.ts`** con `mcp__supabase__generate_typescript_types`
  (añade `profiles`).
- **Configuración del proyecto Supabase** (dashboard, sin código — se documenta en
  `supabase/README.md`):
  - Activar "Confirm email" en Auth › Providers › Email.
  - Plantilla "Confirm signup": cambiar `{{ .ConfirmationURL }}` por
    `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
  - Auth › URL Configuration: Site URL de producción y Redirect URLs con
    `http://localhost:3000/**` (dev) y la de producción.
  - Activar los proveedores Google y GitHub con su Client ID / Secret y registrar la Callback URL
    de Supabase en cada consola de desarrollador.
- **`app/lib/auth.ts`** (nuevo) — helper de servidor `getSessionUser()`:
  `Promise<{ id: string; email: string | null; username: string } | null>`. Usa el cliente de
  servidor, `supabase.auth.getUser()`, y si hay usuario lee su fila de `profiles`. Devuelve `null`
  sin sesión o si falla.
- **`app/lib/auth-actions.ts`** (nuevo, `"use server"`) — Server Actions:
  - `signUp(_state, formData)` — valida email, contraseña (≥ 8) y username
    (`^[A-Za-z0-9_]{3,16}$`); comprueba que el username no exista (case-insensitive); llama a
    `supabase.auth.signUp({ email, password, options: { data: { username } } })`. Devuelve
    `{ ok: true, needsConfirmation: true }` o `{ ok: false, error }`.
  - `signIn(_state, formData)` — `signInWithPassword({ email, password })`; en éxito `redirect(next)`
    (validado: solo rutas internas que empiezan por `/`), en fallo `{ ok: false, error }`.
  - `signOut()` — `supabase.auth.signOut()` y `redirect("/")`.
  - `updateUsername(_state, formData)` — exige sesión; valida formato y unicidad; actualiza
    `profiles.username` **y** `supabase.auth.updateUser({ data: { username } })` (para que el nav en
    cliente lo vea); devuelve `{ ok, error }`.
  - Todos los mensajes de error en español y sin filtrar detalles de Supabase.
- **`app/auth/confirm/route.ts`** (nuevo) — `GET`: lee `token_hash` y `type`, llama a
  `supabase.auth.verifyOtp({ type, token_hash })`, y redirige a `next` (por defecto `/biblioteca`,
  saneado) sin los parámetros secretos; si falla redirige a `/auth/error`.
- **`app/auth/callback/route.ts`** (nuevo) — `GET` para OAuth: lee `code`, llama a
  `supabase.auth.exchangeCodeForSession(code)`, redirige a `next` (por defecto `/biblioteca`); si
  falla, a `/auth/error`.
- **`app/auth/error/page.tsx`** (nuevo) — Server Component con `robots: { index: false }`: mensaje
  legible ("no pudimos validar el enlace") y enlace a `/entrar`. Markup mínimo reutilizando clases
  de `globals.css`.
- **`app/components/auth-card.tsx`** (rework completo, sigue `"use client"`):
  - Dos pestañas: "INICIAR SESIÓN" y "CREAR CUENTA" (se conservan).
  - Login: campos "Correo electrónico" + "Contraseña"; `<form action={signInAction}>` con
    `useActionState`.
  - Alta: campos "Nombre de jugador" (username) + "Correo electrónico" + "Contraseña";
    `<form action={signUpAction}>` con `useActionState`. En éxito con `needsConfirmation` la tarjeta
    pasa al estado "revisa tu correo" (oculta el formulario, muestra el email al que se envió).
  - Botones Google / GitHub: llaman al **cliente de navegador**
    `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: \`${window.location.origin}/auth/callback?next=${next}\` } })`.
  - Botón "JUGAR COMO INVITADO": `<Link href="/biblioteca">` (sin lógica).
  - Zona de error/estado bajo el formulario; botón de submit con estado `pending` (`useFormStatus`
    o el `pending` de `useActionState`).
  - Prop `next?: string` (destino tras login); por defecto `/biblioteca`.
- **`app/entrar/page.tsx`** — Server Component: `getSessionUser()`; si hay sesión, `redirect` a
  `searchParams.next` saneado o `/biblioteca`. Pasa `next` a `<AuthCard next={next} />`. Lee
  `searchParams` con la firma de `PageProps`.
- **`app/perfil/page.tsx`** (nuevo) — Server Component: `getSessionUser()`; si es `null`,
  `redirect("/entrar?next=/perfil")`. Muestra email y username y renderiza
  `<ProfilePanel email={...} username={...} />`. `metadata.title` "Tu perfil · Arcade Vault".
- **`app/components/profile-panel.tsx`** (nuevo, `"use client"`): formulario de cambio de username
  (`<form action={updateUsernameAction}>` con `useActionState`, muestra ok/error) y botón "CERRAR
  SESIÓN" (`<form action={signOutAction}>`).
- **`app/components/site-nav.tsx`** — `useEffect` con el cliente de navegador: `getUser()` inicial +
  `supabase.auth.onAuthStateChange` (limpiar la suscripción en el cleanup). Estado local
  `username: string | null` leído de `user.user_metadata.username`.
  - Con sesión: el botón "Iniciar Sesión" se sustituye por un `<Link href="/perfil">` con el
    username y un botón "Salir" que llama a `supabase.auth.signOut()` en cliente y luego
    `router.push("/")` + `router.refresh()`.
  - Sin sesión: como hoy ("Iniciar Sesión").
  - **Quitar** el bloque `coin-counter` falso ("CRÉDITOS · 03") del nav y del panel móvil.
  - Mismo tratamiento en el `<aside>` del panel móvil.
- **`app/globals.css`** — estilos para: estado "revisa tu correo" y mensajes de error/éxito del
  `auth-card`, el `profile-panel`, y el enlace de usuario + botón "Salir" del nav. Reutilizar
  `.field`, `.btn`, `.auth-*` al máximo; no redefinir `:root`, `.btn`, `.modal*`, `.podium*`,
  `.hall-*`, `.cover-*`.
- **`.env.example`** — sin cambios (no hace falta variable nueva: OAuth usa
  `window.location.origin`; la confirmación usa el Site URL del dashboard). Se añade solo un
  comentario si aclara algo.
- **`supabase/README.md`** — sección "Auth (SPEC 12)" con los pasos de configuración del dashboard.
- **`CLAUDE.md`** "Stack notes" — una línea: auth real con Supabase (`profiles`, `/entrar`,
  `/perfil`, `/auth/*`), sesión leída en cliente por el nav, juego abierto sin cuenta.
- **Verificación**: `npm run build` y `npm run lint` limpios; alta → correo → confirmación → sesión;
  login por email; login con Google y con GitHub; `/perfil` cambia el username; "Salir" cierra
  sesión; jugar sin cuenta intacto; `/`, `/biblioteca` y `/salon` siguen estáticas / ISR en el
  output del build.

**Fuera de alcance (para futuras specs):**

- Recuperar contraseña (`resetPasswordForEmail`, ruta de nueva contraseña, plantilla de email).
- `scores.user_id`, fila "TU MEJOR MARCA EN…", vincular partidas guardadas a la cuenta, y que las
  iniciales del leaderboard se rellenen desde el perfil.
- Protección de rutas en `proxy.ts` (redirect a `/entrar` sin sesión) más allá de la auto-protección
  de `/perfil` a nivel de página.
- Invitado anónimo de Supabase (`signInAnonymously`) y enlazar una cuenta anónima con email.
- Cambio de email, borrado de cuenta, MFA, "security notification emails".
- Avatar / foto de perfil (Supabase Storage), bio, país, u otros campos de `profiles`.
- Forzar al usuario de OAuth a elegir username antes de seguir navegando.
- Página pública de perfil de otro jugador.
- Roles / permisos / panel de administración.
- Rediseño del `auth-card` o del nav más allá de cablear la sesión y quitar el `coin-counter`.
- Tests automatizados (no hay runner).

---

## Data model

### Tabla `public.profiles`

```sql
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_username_lower_idx on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "profiles are public readable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

### Trigger de alta

`public.handle_new_user()` — `security definer`, `search_path = ''`:

- `base` = `lower()` de `raw_user_meta_data->>'username'`, o del prefijo del email si falta, con los
  caracteres no válidos eliminados.
- Si `base` queda con menos de 3 caracteres se rellena (`|| 'player'`); se recorta a 16.
- Si `lower(base)` ya existe en `profiles`, se prueba `base2`, `base3`… (recortando `base` para que
  el sufijo quepa en 16) hasta encontrar hueco.
- `insert into public.profiles (id, username) values (new.id, <candidato>)`.

Trigger: `create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();`

### Contratos TypeScript nuevos

```ts
// app/lib/auth.ts
export async function getSessionUser(): Promise<{
  id: string;
  email: string | null;
  username: string;
} | null>;

// app/lib/auth-actions.ts  ("use server")
type ActionState = { ok: boolean; error?: string; needsConfirmation?: boolean };

export async function signUp(
  prev: ActionState,
  form: FormData,
): Promise<ActionState>;
export async function signIn(
  prev: ActionState,
  form: FormData,
): Promise<ActionState>; // redirect en éxito
export async function signOut(): Promise<void>; // redirect("/")
export async function updateUsername(
  prev: ActionState,
  form: FormData,
): Promise<ActionState>;
```

Reglas:

- Username: `^[A-Za-z0-9_]{3,16}$`, único sin distinción de mayúsculas (índice `lower(username)`).
- Contraseña: mínimo 8 caracteres (validado en el Server Action; Supabase aplica su propio mínimo).
- `next`: solo se acepta si empieza por `/` y no por `//`; en cualquier otro caso se usa
  `/biblioteca`.
- El nav lee el username de `user.user_metadata.username` (lo escribe `signUp` vía `options.data` y
  `updateUsername` vía `auth.updateUser`); `profiles` es la fuente de verdad para servidor y RLS.

### Mapa de archivos tras esta spec

| Archivo                                          | Tipo             | Cambio                                  |
| ------------------------------------------------ | ---------------- | --------------------------------------- |
| `supabase/migrations/11-perfiles-de-usuario.sql` | migración        | nuevo                                   |
| `app/lib/supabase/database.types.ts`             | tipos generados  | regenerado (+ `profiles`)               |
| `app/lib/auth.ts`                                | módulo server    | nuevo                                   |
| `app/lib/auth-actions.ts`                        | server actions   | nuevo                                   |
| `app/auth/confirm/route.ts`                      | route handler    | nuevo                                   |
| `app/auth/callback/route.ts`                     | route handler    | nuevo                                   |
| `app/auth/error/page.tsx`                        | server component | nuevo                                   |
| `app/perfil/page.tsx`                            | server component | nuevo                                   |
| `app/components/profile-panel.tsx`               | client component | nuevo                                   |
| `app/components/auth-card.tsx`                   | client component | rework completo (auth real)             |
| `app/entrar/page.tsx`                            | server component | redirect si hay sesión + `next`         |
| `app/components/site-nav.tsx`                    | client component | sesión en cliente; fuera `coin-counter` |
| `app/globals.css`                                | estilos          | estados auth-card / perfil / nav        |
| `supabase/README.md`                             | doc              | sección "Auth (SPEC 12)"                |
| `CLAUDE.md`                                      | doc              | +1 línea "Stack notes"                  |

No se tocan: `proxy.ts`, `app/lib/supabase/{client,server,proxy,public}.ts`, `app/lib/scores*.ts`,
`app/lib/games.ts`, la tabla `scores`, la tabla `games`, `app/salon/**`, `app/juego/**`,
`app/layout.tsx` (sigue sin ser `async`), los motores de juego y `registry.ts`.

---

## Implementation plan

Cada paso deja el árbol compilando y es commitable por separado.

1. **Migración `profiles` + trigger + RLS.** Escribir y aplicar
   `supabase/migrations/11-perfiles-de-usuario.sql` con `mcp__supabase__apply_migration`. Regenerar
   `app/lib/supabase/database.types.ts`. Verificación: `mcp__supabase__list_tables` muestra
   `public.profiles`; crear un usuario de prueba desde Auth del dashboard genera su fila con un
   `username` derivado del email; `mcp__supabase__get_advisors` (security) no reporta nada nuevo
   sobre `profiles`; `npm run build` compila.

2. **Configuración del dashboard de Supabase.** Activar "Confirm email"; editar la plantilla
   "Confirm signup"; fijar Site URL y Redirect URLs; activar Google y GitHub con sus credenciales.
   Documentar los pasos en `supabase/README.md`. Verificación: la ruta `/diagnostico/supabase` sigue
   respondiendo "sin sesión"; no hay cambios de código que verificar aquí.

3. **Helpers de auth.** Crear `app/lib/auth.ts` (`getSessionUser`) y `app/lib/auth-actions.ts`
   (`signUp`, `signIn`, `signOut`, `updateUsername` con sus validaciones y `ActionState`). Sin UI
   todavía. Verificación: `npm run build` y `npm run lint` pasan; import de `getSessionUser` desde un
   Server Component de prueba compila.

4. **Rutas `/auth/*`.** Crear `app/auth/confirm/route.ts`, `app/auth/callback/route.ts` y
   `app/auth/error/page.tsx`. Verificación: `/auth/error` renderiza con su mensaje; `GET /auth/confirm`
   sin `token_hash` redirige a `/auth/error`; `GET /auth/callback` sin `code` redirige a
   `/auth/error`; ninguna ruta existente rompe.

5. **`auth-card.tsx` + `/entrar`.** Rework del componente (login por email, alta con username, estado
   "revisa tu correo", errores, `pending`, botones OAuth por cliente de navegador, "JUGAR COMO
   INVITADO" como `Link`). `app/entrar/page.tsx` pasa a Server Component que redirige si hay sesión y
   pasa `next`. Verificación manual en `npm run dev`: alta real → llega el correo → el enlace
   confirma y deja sesión iniciada → `/entrar` redirige a `/biblioteca`; login por email correcto y
   con credenciales malas (mensaje de error); login con Google y con GitHub completan y vuelven por
   `/auth/callback`.

6. **`/perfil` + `profile-panel.tsx`.** Crear la página (con guard que redirige a
   `/entrar?next=/perfil`) y el panel cliente (cambio de username + "CERRAR SESIÓN"). Verificación:
   sin sesión, `/perfil` redirige a `/entrar`; con sesión muestra email y username; cambiar el
   username a uno libre persiste (recargar lo confirma) y a uno ocupado muestra error; "CERRAR
   SESIÓN" vuelve a `/`.

7. **Sesión en el `site-nav`.** Añadir el `useEffect` con `getUser()` + `onAuthStateChange`; mostrar
   username (enlace a `/perfil`) + "Salir" con sesión, o "Iniciar Sesión" sin ella. Quitar el
   `coin-counter` del nav y del panel móvil. Verificación: iniciar y cerrar sesión actualizan el nav
   sin recargar la página; `npm run build` sigue marcando `/`, `/biblioteca` y `/salon` como
   estáticas / ISR (no dinámicas); el menú hamburguesa sigue funcionando.

8. **CSS de los estados nuevos.** Añadir a `globals.css` los estilos del estado "revisa tu correo",
   los mensajes ok/error del `auth-card` y del `profile-panel`, y el enlace de usuario + "Salir" del
   nav. Verificación visual con Playwright MCP: screenshots en `.playwright-screenshots/` de
   `/entrar` (login y alta), `/entrar` en estado "revisa tu correo", `/perfil`, `/auth/error`, y el
   nav con sesión y sin sesión, a ~390 px y a 1280 px.

9. **Docs y cierre.** Actualizar `CLAUDE.md` "Stack notes" y `supabase/README.md`. `npm run lint` y
   `npm run build` sin errores ni warnings; sin imports ni `console` sueltos. Regenerar
   `database.types.ts` si hiciera falta. Commitear el bloque gestionado de `AGENTS.md` / `CLAUDE.md`
   si `next dev` lo reescribió. Confirmar con `mcp__supabase__get_advisors` que no hay avisos de
   seguridad nuevos.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `npm run lint` sin errores ni warnings.
- [ ] `mcp__supabase__list_tables` muestra `public.profiles` con RLS activada; existe la migración
      `supabase/migrations/11-perfiles-de-usuario.sql` en el repo.
- [ ] `profiles` tiene índice único sobre `lower(username)`, `CHECK` `^[A-Za-z0-9_]{3,16}$`, política
      de `SELECT` pública y de `UPDATE` solo para `auth.uid() = id`; no hay política de `INSERT` ni
      `DELETE` para usuarios.
- [ ] Dar de alta un usuario nuevo crea automáticamente su fila en `profiles` con un `username`
      válido (el elegido en el alta, o uno derivado del email en OAuth).
- [ ] Dos altas que piden el mismo username no colisionan: la segunda obtiene un sufijo numérico o
      es rechazada por el Server Action antes de llamar a Supabase.
- [ ] `app/lib/supabase/database.types.ts` incluye la tabla `profiles`.
- [ ] Alta con email + contraseña + username muestra el estado "revisa tu correo" y **no** inicia
      sesión hasta confirmar.
- [ ] El correo de confirmación apunta a `/auth/confirm?token_hash=…&type=email`; abrir ese enlace
      inicia la sesión y redirige a `/biblioteca` (o a `next`), sin dejar los parámetros secretos en
      la URL final.
- [ ] Un enlace de confirmación inválido o caducado lleva a `/auth/error` con un mensaje legible, no
      a un stack trace.
- [ ] Login por email correcto redirige a `next` (o `/biblioteca`); con credenciales incorrectas
      muestra un mensaje de error en la tarjeta y no redirige.
- [ ] El botón "Google" completa el login por OAuth y vuelve por `/auth/callback` con sesión
      iniciada.
- [ ] El botón "GitHub" hace lo mismo con GitHub.
- [ ] `/auth/callback` sin `code`, o con un `code` inválido, redirige a `/auth/error`.
- [ ] "JUGAR COMO INVITADO" navega a `/biblioteca` sin crear sesión; jugar una partida y guardar una
      puntuación sigue funcionando sin cuenta.
- [ ] Con sesión activa, `/entrar` redirige a `next` (o `/biblioteca`) en vez de mostrar la tarjeta.
- [ ] `/perfil` sin sesión redirige a `/entrar?next=/perfil`.
- [ ] `/perfil` con sesión muestra el email y el username actuales.
- [ ] Cambiar el username en `/perfil` a uno libre persiste tras recargar; a uno ya usado (en
      cualquier combinación de mayúsculas) muestra un error y no cambia nada.
- [ ] Tras cambiar el username, el nav muestra el nuevo valor (sin recargar tras `onAuthStateChange`,
      o tras la primera navegación).
- [ ] El botón "CERRAR SESIÓN" de `/perfil` cierra la sesión y lleva a `/`.
- [ ] El nav muestra el username (enlazando a `/perfil`) y un botón "Salir" cuando hay sesión, y
      "Iniciar Sesión" cuando no la hay; el cambio ocurre sin recargar al iniciar o cerrar sesión.
- [ ] El nav y el panel móvil ya **no** muestran "CRÉDITOS · 03"; `globals.css` ya no necesita las
      reglas `.av-nav .coin-counter*` (o quedan sin uso y se eliminan).
- [ ] `npm run build` sigue reportando `/`, `/biblioteca` y `/salon` como estáticas / ISR (no
      dinámicas); `app/layout.tsx` no es `async` ni llama a `cookies()`.
- [ ] `proxy.ts` no cambia: ninguna ruta distinta de `/perfil` redirige por falta de sesión.
- [ ] `app/lib/scores*.ts`, la tabla `scores` y `app/salon/**` no se han modificado.
- [ ] `getSessionUser()` devuelve `null` sin sesión y `{ id, email, username }` con ella.
- [ ] Los mensajes de error mostrados al usuario están en español y no exponen texto crudo de
      Supabase.
- [ ] `supabase/README.md` documenta la configuración del dashboard (confirmación, plantilla, URLs,
      proveedores OAuth); `CLAUDE.md` "Stack notes" menciona la auth real.
- [ ] Hay screenshots en `.playwright-screenshots/` de `/entrar`, el estado "revisa tu correo",
      `/perfil`, `/auth/error` y el nav con/sin sesión a ~390 px y 1280 px.

---

## Decisions

- **Sí:** tabla `public.profiles` con `username` único + trigger `security definer`. Es el patrón
  oficial de Supabase para datos de perfil; el trigger garantiza que toda cuenta (incluida OAuth)
  tenga fila y username sin depender del cliente. **No:** guardar solo `display_name` en
  `user_metadata` — sin unicidad ni tabla consultable para joins futuros (leaderboard por usuario).
- **Sí:** confirmación de correo activada con ruta `/auth/confirm` (flujo `token_hash` / `verifyOtp`,
  patrón SSR de Supabase). Evita altas con emails ajenos. **No:** desactivarla — más cómodo pero deja
  la puerta a cuentas basura y a suplantación de email.
- **Sí:** login por **email**. Es el flujo nativo de `signInWithPassword`, sin lookups. El username
  es solo el nombre público. **No:** login por username — obliga a resolver username→email antes de
  autenticar, con un caso de error extra.
- **Sí:** OAuth de Google y GitHub iniciado desde el **cliente de navegador** con `redirectTo` a
  `/auth/callback`, y `exchangeCodeForSession` en el route handler. Es el flujo PKCE que
  `@supabase/ssr` ya trae por defecto. **No:** iniciar OAuth desde un Server Action — añade un salto
  extra sin ventaja aquí.
- **Sí:** el nav lee la sesión **en cliente** (`onAuthStateChange`). Mantiene `/`, `/biblioteca` y
  `/salon` estáticas / ISR, que es justo lo que SPEC 04 montó con el cliente sin cookies. **No:**
  layout `async` con `cookies()` — un `getUser()` en el layout opta toda la app a render dinámico.
- **Sí:** `proxy.ts` sin protección de rutas; jugar sin cuenta sigue abierto. La plataforma es de
  juego libre, la cuenta solo añade identidad. **No:** proteger `/juego/[id]/jugar` — cambiaría el
  modelo de producto actual.
- **Sí:** `/perfil` se auto-protege a nivel de página (redirect en el Server Component). Una sola
  ruta protegida no justifica meter lógica de redirect en el `proxy.ts`. **No:** allowlist de rutas
  en el proxy — se añade cuando haya varias rutas privadas.
- **Sí:** username autogenerado para OAuth, editable en `/perfil`. No bloquea el primer acceso.
  **No:** forzar la elección de username antes de seguir navegando — añade un estado "perfil
  incompleto" y redirecciones para un caso menor.
- **Sí:** duplicar el username en `user_metadata` además de `profiles`. El nav en cliente lo lee sin
  una consulta extra a `profiles`; `updateUsername` actualiza ambos. **No:** que el nav consulte
  `profiles` en cada carga — una query más por render para un dato que cabe en el token.
- **Sí:** quitar el `coin-counter` falso ("CRÉDITOS · 03"). Es una maqueta sin backend y confunde
  junto a una sesión real. **No:** convertirlo en un contador real de créditos — no existe ese
  concepto en el producto.
- **No:** recuperar contraseña, `scores.user_id`, "TU MEJOR MARCA", cambio de email, borrado de
  cuenta, avatar, MFA. Cada uno, si se hace, en su propia spec. Esta ya cubre alta + confirmación +
  login + OAuth + logout + perfil.
- **No:** variable de entorno nueva. OAuth usa `window.location.origin`; la confirmación usa el Site
  URL del dashboard.

---

## Risks

| Riesgo                                                                                    | Mitigación                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El nav en cliente parpadea "Iniciar Sesión" → usuario en la primera carga                 | Aceptado y acotado: el estado inicial es "sin sesión" y `onAuthStateChange` lo corrige al hidratar. Alternativa (SSR del nav) se descartó por romper el estático.                        |
| Añadir `cookies()` en algún Server Component nuevo opta páginas existentes a dinámicas    | Solo `/entrar`, `/perfil` y las rutas `/auth/*` usan sesión de servidor, y todas deben ser dinámicas. Criterio de aceptación verifica que `/`, `/biblioteca`, `/salon` siguen estáticas. |
| El trigger `handle_new_user` falla y aborta el alta entera                                | `security definer` + `search_path = ''` + lógica de sufijo probada en el paso 1 con `get_advisors`; el `CHECK` de username se satisface por construcción (relleno y recorte a 16).       |
| Carrera entre la comprobación de username del Server Action y el `INSERT` del trigger     | El trigger vuelve a deduplicar con sufijo numérico; en el peor caso el usuario recibe `kai2` en vez de `kai`. Documentado.                                                               |
| Redirect abierto vía el parámetro `next`                                                  | `next` solo se acepta si empieza por `/` y no por `//`; en cualquier otro caso se fuerza `/biblioteca`. Aplica en `signIn`, `/auth/confirm`, `/auth/callback` y `/entrar`.               |
| Plantilla de email sin actualizar → el enlace usa el flujo implícito y no crea sesión SSR | Paso 2 la cambia a `token_hash`; el paso 5 lo verifica de punta a punta con un alta real.                                                                                                |
| Proveedores OAuth mal configurados (redirect URI) → error al volver                       | `supabase/README.md` lista la Callback URL exacta a registrar en Google y GitHub; el fallo cae en `/auth/error`, no en un 500.                                                           |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`                    | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                                                                                                                |

---

## Lo que **no** entra en esta spec

- Recuperar / cambiar contraseña, cambio de email, borrado de cuenta, MFA.
- `scores.user_id`, "TU MEJOR MARCA EN…", vincular partidas guardadas a la cuenta.
- Protección de rutas en `proxy.ts` (más allá de la auto-protección de `/perfil`).
- Invitado anónimo de Supabase y enlace de cuenta anónima con email.
- Avatar / foto de perfil, bio u otros campos de `profiles`; página pública de perfil ajeno.
- Forzar elección de username tras el primer login OAuth.
- Roles, permisos o panel de administración.
- Rediseño del `auth-card` o del `site-nav` más allá de cablear la sesión y quitar el `coin-counter`.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
