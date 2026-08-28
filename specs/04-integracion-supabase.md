# SPEC 04 — Cimientos de Supabase en el App Router

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-28
> **Objetivo:** Cablear Supabase en la app de Next (clientes browser/server con `@supabase/ssr`, `proxy.ts` de refresco de sesión, variables de entorno y una ruta de diagnóstico) sin tocar la UI ni crear tablas.

---

## Por qué existe esta spec

El proyecto tiene el MCP de Supabase conectado (`.mcp.json`, proyecto `itmhyidlxraapcjzprvn`) pero **cero código de Supabase**: no está `@supabase/supabase-js`, no hay clientes, no hay `proxy.ts`, no hay env vars y el proyecto remoto no tiene ninguna tabla ni migración.

Las specs siguientes (Auth real con email/contraseña, tabla `profiles`, tabla `scores` con RLS, salón desde base de datos) necesitan todas la misma base: dos clientes de Supabase (uno para el navegador, otro para Server Components / Server Actions / Route Handlers) y un `proxy.ts` que refresque el token de auth en cada request. Esta spec monta **solo esa base** y la deja verificada.

Punto de Next 16 relevante: el convention `middleware.ts` está **deprecado y renombrado a `proxy.ts`** (ver `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`). Esta spec usa `proxy.ts` desde el principio.

---

## Scope

**In:**

- Dependencias nuevas en `package.json`: `@supabase/supabase-js` y `@supabase/ssr` (últimas estables).
- `app/lib/supabase/client.ts` (nuevo) — `createClient()` para el navegador, sobre `createBrowserClient` de `@supabase/ssr`, tipado con `<Database>`.
- `app/lib/supabase/server.ts` (nuevo) — `createClient()` `async` para código de servidor (Server Components, Server Actions, Route Handlers), sobre `createServerClient` + `await cookies()` de `next/headers`; `setAll` envuelto en `try/catch` (se ignora el fallo cuando lo llama un Server Component, porque el `proxy.ts` ya refresca la sesión).
- `app/lib/supabase/proxy.ts` (nuevo) — helper `updateSession(request: NextRequest): Promise<NextResponse>`: crea un `createServerClient` por request (sin cliente global), llama a `supabase.auth.getClaims()` para refrescar el token, y devuelve el `NextResponse` con las cookies propagadas. **No** redirige ni protege rutas en esta spec.
- `proxy.ts` (nuevo, raíz del proyecto, al nivel de `app/`) — exporta `proxy` que delega en `updateSession`, y un `config.matcher` que excluye `_next/static`, `_next/image`, `favicon.ico` y archivos de imagen (`svg|png|jpg|jpeg|gif|webp`).
- `app/lib/supabase/database.types.ts` (nuevo) — tipos generados con `mcp__supabase__generate_typescript_types` (hoy prácticamente vacío; se regenerará cuando lleguen tablas).
- `app/diagnostico/supabase/page.tsx` (nuevo) — Server Component. `metadata` con `title` "Arcade Vault · Diagnóstico Supabase" y `robots: { index: false }`. Crea el cliente de servidor, llama a `supabase.auth.getClaims()` y pinta un panel simple: URL configurada (enmascarada), si la clave publishable está presente, y el resultado (`sin sesión` cuando no hay login, o el `sub` del claim si lo hubiera). Si faltan las env vars o Supabase responde error, muestra un mensaje legible en vez de reventar. Sin CSS nuevo: markup mínimo reutilizando clases de `globals.css` o estilo inline.
- `.env.example` — anexar `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` vacíos, con comentario.
- `.env.local` (git-ignorado por `.env*`) — crear/añadir los valores reales (ver Data model). No commiteado.
- `supabase/migrations/.gitkeep` y `supabase/README.md` (nuevos) — dejan la carpeta de migraciones versionada en git. El README documenta: los `.sql` de aquí se aplican al proyecto remoto `itmhyidlxraapcjzprvn` con `apply_migration` del MCP.
- `CLAUDE.md` — una línea en "Stack notes" sobre Supabase (`@supabase/ssr`, env vars en `.env.local`, `proxy.ts`).
- Verificación: `npm run build` y `npm run lint` limpios; `/diagnostico/supabase` funciona; navegación por las rutas existentes intacta con el `proxy.ts` activo.

**Out of scope (para futuras specs):**

- Auth real: `signUp` / `signInWithPassword` / `signOut`, conectar `auth-card.tsx`, sesión en el Nav, `/entrar` funcional. Spec de Auth.
- Tabla `public.profiles` (alias público), trigger `on auth.users`, y su RLS.
- Tabla `public.scores` (una fila por partida), su RLS, y que "GUARDAR PUNTUACIÓN" del reproductor escriba de verdad.
- Salón: fila "▸ TU MEJOR MARCA EN …" y bloque de puntuaciones reales de la DB.
- Protección de rutas en el `proxy.ts` (redirect a `/entrar` sin sesión). Aquí el proxy solo refresca el token.
- Proveedores OAuth (Google / GitHub), invitado anónimo de Supabase, confirmación de correo y plantillas de email.
- Clave `sb_secret_...` / `service_role` y operaciones privilegiadas de servidor.
- `supabase/config.toml`, `supabase init` y el stack local de la CLI.
- Realtime, Storage, Edge Functions.
- Tests automatizados (no hay runner).

---

## Data model

**No se crean tablas.** `list_tables` sobre el esquema `public` sigue vacío tras esta spec. El único artefacto de datos es la configuración de entorno.

Variables de entorno:

| Var                                    | Dónde          | Commiteada | Valor                                            |
| -------------------------------------- | -------------- | ---------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | `.env.example` | Sí         | vacío, con comentario                            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.example` | Sí         | vacío, con comentario                            |
| `NEXT_PUBLIC_SUPABASE_URL`             | `.env.local`   | No         | `https://itmhyidlxraapcjzprvn.supabase.co`       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local`   | No         | `sb_publishable_6_u9xwFqALEIoujmrplitQ_6oS7qat2` |

La clave publishable (`sb_publishable_...`) no es secreta (va en `NEXT_PUBLIC_*`), pero se mantiene el patrón de SPEC 03: `.env.example` vacío, valor real solo en `.env.local`.

Firmas de los helpers nuevos (`app/lib/supabase/`):

```ts
// client.ts  — navegador
export function createClient(): SupabaseClient<Database>;

// server.ts  — Server Components / Actions / Route Handlers
export async function createClient(): Promise<SupabaseClient<Database>>;

// proxy.ts   — usado solo por el proxy de la raíz
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse>;
```

`proxy.ts` (raíz):

```ts
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

Mapa de archivos tras esta spec:

| Archivo                              | Tipo             | Cambio   |
| ------------------------------------ | ---------------- | -------- |
| `proxy.ts`                           | proxy (raíz)     | nuevo    |
| `app/lib/supabase/client.ts`         | módulo browser   | nuevo    |
| `app/lib/supabase/server.ts`         | módulo server    | nuevo    |
| `app/lib/supabase/proxy.ts`          | módulo server    | nuevo    |
| `app/lib/supabase/database.types.ts` | tipos generados  | nuevo    |
| `app/diagnostico/supabase/page.tsx`  | server component | nuevo    |
| `.env.example`                       | plantilla        | +2 vars  |
| `supabase/migrations/.gitkeep`       | —                | nuevo    |
| `supabase/README.md`                 | doc              | nuevo    |
| `package.json` / `package-lock.json` | deps             | +2 deps  |
| `CLAUDE.md`                          | doc              | +1 línea |

Ninguna ruta ni componente existente (`auth-card.tsx`, `hall-of-fame.tsx`, `player-screen.tsx`, `site-nav.tsx`, páginas de `/`, `/biblioteca`, `/entrar`, `/salon`, `/acerca`, `/juego/**`) se modifica.

---

## Implementation plan

1. **Dependencias y entorno.** `npm install @supabase/supabase-js @supabase/ssr`. Anexar a `.env.example` las dos vars vacías con comentario. Añadir a `.env.local` los valores reales de Data model. Verificar que `git status` no lista `.env.local`. `npm run build` pasa.

2. **Tipos generados.** Generar `app/lib/supabase/database.types.ts` con `mcp__supabase__generate_typescript_types` (exporta `Database`, hoy casi vacío). `npm run build` compila.

3. **Cliente de navegador.** Crear `app/lib/supabase/client.ts` con `createClient()` sobre `createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!)`. Sin uso todavía. `npm run build` pasa.

4. **Cliente de servidor.** Crear `app/lib/supabase/server.ts`: `async function createClient()` con `await cookies()` de `next/headers`, `createServerClient<Database>(...)` con `cookies: { getAll, setAll }`; `setAll` en `try/catch` que ignora el error (lo documenta con el comentario del patrón oficial). `npm run build` pasa.

5. **Helper del proxy.** Crear `app/lib/supabase/proxy.ts` con `updateSession(request)`: `NextResponse.next({ request })`, `createServerClient<Database>` nuevo por request (sin global; comentario "Fluid compute"), cookies leídas de `request.cookies` y escritas en `request` + `supabaseResponse` + headers; `const { data } = await supabase.auth.getClaims()` **sin código entre la creación del cliente y `getClaims()`**; devolver `supabaseResponse` tal cual. Sin redirects. `npm run build` pasa.

6. **proxy.ts de la raíz.** Crear `proxy.ts` al nivel de `app/`: `export async function proxy(request)` que devuelve `updateSession(request)`, y el `config.matcher` de Data model. Verificación: `npm run dev`; navegar por `/`, `/biblioteca`, `/entrar`, `/salon`, `/acerca`, `/juego/caida`, `/juego/caida/jugar`; todo carga igual, CSS e imágenes intactos, 0 errores nuevos en consola.

7. **Ruta de diagnóstico.** Crear `app/diagnostico/supabase/page.tsx` (Server Component): `metadata` con `title` "Arcade Vault · Diagnóstico Supabase" y `robots: { index: false }`. Comprobar `process.env` de las dos vars; si faltan, pintar aviso. Si están: `const supabase = await createClient(); const { data, error } = await supabase.auth.getClaims();` y pintar panel con URL enmascarada, clave presente (sí/no), y `error?.message` o "sin sesión" / `sub` del claim. Markup mínimo. Verificación: `/diagnostico/supabase` responde 200, muestra "sin sesión" y la URL enmascarada, 0 errores de consola; renombrar temporalmente una var en `.env.local` hace que muestre el aviso en vez de un stack trace.

8. **Docs y limpieza.** Crear `supabase/migrations/.gitkeep` y `supabase/README.md` (workflow: `.sql` aquí → `apply_migration` MCP → proyecto `itmhyidlxraapcjzprvn`). Añadir la línea de Supabase a "Stack notes" de `CLAUDE.md`. `npm run lint` y `npm run build` sin errores ni warnings. Quitar imports/console sin usar. Commitear el bloque gestionado de `AGENTS.md`/`CLAUDE.md` si `next dev` lo reescribió. Confirmar con `mcp__supabase__list_tables` que `public` sigue vacío.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `/diagnostico/supabase` aparece en el output del build.
- [ ] `npm run lint` no reporta errores ni warnings.
- [ ] Existen `proxy.ts` (raíz), `app/lib/supabase/client.ts`, `app/lib/supabase/server.ts`, `app/lib/supabase/proxy.ts` y `app/lib/supabase/database.types.ts`.
- [ ] No existe ningún archivo `middleware.ts` en el proyecto.
- [ ] `proxy.ts` exporta `proxy` y un `config.matcher` que excluye `_next/static`, `_next/image`, `favicon.ico` y `svg|png|jpg|jpeg|gif|webp`.
- [ ] `app/lib/supabase/server.ts` usa `await cookies()` y envuelve `setAll` en `try/catch`.
- [ ] `app/lib/supabase/proxy.ts` llama a `supabase.auth.getClaims()` (no `getSession()`) y no hay código entre la creación del cliente y esa llamada.
- [ ] Los tres clientes están tipados con `<Database>` importado de `database.types.ts`.
- [ ] `.env.example` contiene `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` vacíos, con comentario; `.env.local` (no trackeado por git) tiene los valores reales.
- [ ] `git status` no lista `.env.local`.
- [ ] `/diagnostico/supabase` carga sin errores de consola, tiene `<title>` "Arcade Vault · Diagnóstico Supabase" y muestra: URL enmascarada, clave presente, y "sin sesión".
- [ ] Con una env var de Supabase ausente, `/diagnostico/supabase` muestra un aviso legible en vez de un error 500 / stack trace.
- [ ] Con el `proxy.ts` activo, `/`, `/biblioteca`, `/entrar`, `/salon`, `/acerca`, `/juego/caida` y `/juego/caida/jugar` cargan igual que antes: CSS, fuentes e imágenes sin romper.
- [ ] No se han modificado `auth-card.tsx`, `hall-of-fame.tsx`, `player-screen.tsx` ni `site-nav.tsx`.
- [ ] `mcp__supabase__list_tables` sobre `public` devuelve lista vacía; `list_migrations` sigue vacío.
- [ ] `supabase/migrations/.gitkeep` y `supabase/README.md` están en el repo.
- [ ] `CLAUDE.md` menciona Supabase en "Stack notes".
- [ ] `package.json` lista `@supabase/supabase-js` y `@supabase/ssr`.

---

## Decisions

- **Sí:** `proxy.ts`, no `middleware.ts`. Next 16 deprecó `middleware` y lo renombró a `proxy` (doc: `01-app/03-api-reference/03-file-conventions/proxy.md`). Los ejemplos actuales de Supabase para Next ya usan `proxy.ts`.
- **Sí:** `@supabase/ssr` con clientes separados browser/server + helper `updateSession` en el proxy. Es el patrón oficial para App Router; los Server Components no pueden escribir cookies, así que el proxy refresca el token.
- **Sí:** claves nuevas `sb_publishable_...` vía `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Supabase recomienda migrar; la `anon` legacy (JWT) expira a finales de 2026.
- **No:** clave `sb_secret_...` / `service_role`. Esta spec no hace operaciones privilegiadas; todo el acceso a datos futuro irá por RLS con la sesión del usuario.
- **Sí:** `getClaims()` (no `getSession()`) en el proxy y en servidor. `getSession()` no revalida la firma del JWT en servidor; `getClaims()` sí.
- **Sí:** ruta `/diagnostico/supabase` como prueba de humo, con `robots: noindex` y sin enlace en el Nav. Da una verificación reproducible de "conexión + claves OK" sin crear tablas. Se mantiene para depurar en specs futuras.
- **No:** verificar la conexión con una tabla `ping` de humo. Añadir y luego migrar una tabla temporal es más trabajo que llamar a `auth.getClaims()`, que ya prueba URL + clave + red.
- **Sí:** `.env.example` con las vars vacías + comentario y valores reales solo en `.env.local`, igual que SPEC 03 (Resend). La publishable key no es secreta, pero se mantiene el patrón del repo por coherencia.
- **Sí:** `supabase/migrations/` versionada en git desde ya (con `.gitkeep`), aunque esta spec no cree migraciones. Las tablas de las specs siguientes se aplican con `apply_migration` (MCP) sobre `itmhyidlxraapcjzprvn` y su `.sql` se commitea aquí.
- **No:** `supabase init` / `config.toml` / stack local de la CLI. No se usa entorno local de Supabase; el MCP aplica los cambios al proyecto remoto.
- **Sí:** generar `database.types.ts` (hoy casi vacío) y tipar los tres clientes con `<Database>`. Coste cero ahora; evita reintroducir el tipado más tarde.
- **No:** tocar `auth-card.tsx` ni la sesión en el Nav. El proxy de esta spec solo refresca el token; login, logout y rutas protegidas van en la spec de Auth.

---

## Risks

| Riesgo                                                                     | Mitigación                                                                                                                                                                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `matcher` del proxy demasiado amplio bloquea CSS / JS / imágenes           | Se usa el `matcher` del ejemplo oficial de Supabase (excluye `_next/static`, `_next/image`, favicon e imágenes); criterio de aceptación de navegación intacta en el paso 6. |
| Env vars ausentes en algún entorno → 500 al renderizar                     | `/diagnostico/supabase` comprueba `process.env` antes de crear el cliente y degrada con aviso legible; criterio de aceptación dedicado.                                     |
| Escribir `middleware.ts` por costumbre en vez de `proxy.ts`                | Next 16 no lo ejecutaría como antes; decisión y doc citada; criterio de aceptación exige `proxy.ts` y prohíbe `middleware.ts`.                                              |
| Código entre `createServerClient` y `getClaims()` → logout aleatorios      | Comentado explícitamente en `proxy.ts` (patrón oficial); criterio de aceptación lo verifica.                                                                                |
| Cliente de Supabase en variable global (Fluid compute) → sesiones cruzadas | El helper crea un cliente nuevo por request; comentario en el código.                                                                                                       |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`     | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                                                                                                   |
| Clave real filtrada al repo                                                | `.gitignore` ya ignora `.env*` salvo `.env.example`; pasos 1 y 8 verifican `git status`.                                                                                    |

---

## Lo que **no** entra en esta spec

- Auth real: registro, login, logout, sesión en el Nav, `/entrar` funcional.
- Tabla `profiles` y su trigger; tabla `scores` y su RLS; guardar puntuaciones de verdad.
- Fila "TU MEJOR MARCA" y puntuaciones reales en el salón y en el detalle.
- Protección de rutas en el `proxy.ts` (redirect a `/entrar`).
- OAuth (Google / GitHub), invitado anónimo, confirmación de correo.
- Clave secreta / `service_role`, Realtime, Storage, Edge Functions.
- Stack local de la CLI de Supabase.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
