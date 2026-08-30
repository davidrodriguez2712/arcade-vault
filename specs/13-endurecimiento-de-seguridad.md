# SPEC 13 — Endurecimiento de seguridad

> **Estado:** Aprobado
> **Depende de:** SPEC 06, SPEC 12
> **Fecha:** 2026-08-30
> **Objetivo:** Cerrar el checklist de seguridad básico (`references/security/security-checklist.md`): headers de seguridad en Next.js, migración que revoca la RPC `rls_auto_enable()` y reafirma RLS en `games` / `scores`, y documentar en `supabase/README.md` los ajustes de dashboard (contraseña mínima 8, leaked password protection, rate limits de alta).

---

## Por qué existe esta spec

El checklist `references/security/security-checklist.md` reúne cinco medidas mínimas. El estado
real hoy es:

- **RLS en `games` y `scores`:** ya habilitada (SPEC 06). Solo falta reafirmarla de forma explícita
  e idempotente y verificarla como criterio.
- **Contraseña mínima 8:** el Server Action `signUp` (SPEC 12) ya valida `≥ 8`, pero el dashboard de
  Supabase sigue en su valor por defecto (6). Hay que subirlo a 8 para que coincida.
- **Leaked password protection:** desactivada. `mcp__supabase__get_advisors` la reporta como
  `auth_leaked_password_protection` (WARN).
- **Max signup rate:** sin tocar; se usan los rate limits por defecto de Supabase Auth.
- **Headers de seguridad en Next.js:** `next.config.ts` no define `headers()`.

Además, `mcp__supabase__get_advisors` (security) reporta dos avisos sobre `public.rls_auto_enable()`
(`0028` / `0029`): es una función `SECURITY DEFINER` de event trigger (auto-activa RLS en tablas
nuevas de `public`) que Supabase deja ejecutable por `anon` / `authenticated` vía
`/rest/v1/rpc/rls_auto_enable`. Llamarla por RPC falla (usa `pg_event_trigger_ddl_commands()`, solo
válido dentro de un event trigger), pero el linter la marca igual.

La configuración de Auth de Supabase **no se puede tocar por el MCP** (mismo caso que SPEC 12): esos
tres ajustes se documentan en `supabase/README.md` y el usuario los aplica a mano en el dashboard.

Decisiones de forma cerradas con el usuario antes de escribir la spec:

- **Headers:** los 3 del checklist (`X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Referrer-Policy`) más `Strict-Transport-Security`, `Permissions-Policy` y `X-DNS-Prefetch-Control`.
  **Sin** `Content-Security-Policy` (va en su propia spec).
- **Anti-bot:** solo documentar la bajada de rate limits de Auth en el dashboard. La integración de
  un CAPTCHA (Turnstile / hCaptcha) queda para otra spec.
- **Política de contraseña:** solo longitud mínima 8. Sin requisitos de clases de caracteres.
- **`rls_auto_enable()`:** nueva migración `12-endurecer-seguridad.sql` que revoca su `EXECUTE` y
  reafirma RLS en `games` y `scores`.

---

## Scope

**In:**

- **`next.config.ts`** — añadir la clave `headers()` (async) que aplica a `source: '/(.*)'` la lista
  de headers de seguridad (ver Data model). Añadir también `poweredByHeader: false` (quita el header
  `X-Powered-By`). No se toca `allowedDevOrigins`. Antes de escribir el código, consultar
  `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md` y
  `.../poweredByHeader.md` (Next 16 tiene cambios respecto al entrenamiento).
- **`supabase/migrations/12-endurecer-seguridad.sql`** (nuevo, aplicado al proyecto remoto
  `itmhyidlxraapcjzprvn` con `mcp__supabase__apply_migration`, nombre `12_endurecer_seguridad`):
  - `revoke execute on function public.rls_auto_enable() from anon, authenticated, public;`
  - `alter table public.games enable row level security;` (idempotente).
  - `alter table public.scores enable row level security;` (idempotente).
  - Comentario de cabecera explicando el porqué de cada línea (patrón de las migraciones 06 y 11).
- **`supabase/README.md`** — nueva sección "Seguridad (SPEC 13)" con los pasos de dashboard:
  1. **Authentication › Sign In / Providers › Email**: _Minimum password length_ = `8`.
  2. **Authentication › Sign In / Providers › Email** (o _Auth › Policies_): activar _Leaked password
     protection_ (comprobación contra HaveIBeenPwned).
  3. _Password Requirements_ = "No required characters" (solo longitud; decisión de esta spec).
  4. **Authentication › Rate Limits**: bajar el límite de _sign-ups / sign-ins_ y el de
     _token verifications_ a valores anti-bot razonables (anotar los valores elegidos). Nota de que
     el CAPTCHA va en otra spec.
  5. Referencia a `references/security/security-checklist.md` y a cómo verificar con
     `mcp__supabase__get_advisors`.
- **`references/security/security-checklist.md`** — marcar `[x]` los ítems cubiertos y anotar junto a
  cada uno cómo se cumplió (migración 12 / dashboard / `next.config.ts`); el ítem "TODO: panel de
  warnings de Supabase" se sustituye por el estado real de `get_advisors` tras esta spec.
- **`CLAUDE.md`** "Stack notes" — una línea: headers de seguridad en `next.config.ts` + migración 12
  (revoke `rls_auto_enable`, RLS reafirmada) + ajustes de Auth documentados en `supabase/README.md`.
- **Verificación:** `npm run build` y `npm run lint` limpios; `curl -I http://localhost:3000/` y
  `curl -I http://localhost:3000/biblioteca` muestran los 6 headers y **no** `X-Powered-By`;
  `mcp__supabase__get_advisors` (security) ya no reporta `anon_security_definer_function_executable`
  / `authenticated_security_definer_function_executable` sobre `rls_auto_enable` ni
  `auth_leaked_password_protection`; `mcp__supabase__list_tables` sigue mostrando `games` y `scores`
  con `rls_enabled: true`; alta de un usuario nuevo sigue funcionando (el event trigger que activa
  RLS y el trigger `handle_new_user` no dependen del `EXECUTE` revocado).
  - Proteccion de rutas con Proxy next.js: informacion sobre proxy aqui: https://nextjs.org/docs/app/getting-started/proxy
  ```import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}
 
// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }
 
export const config = {
  matcher: '/about/:path*',
}

**Fuera de alcance (para futuras specs):**

- `Content-Security-Policy` (nonce / `unsafe-inline`, allowlist de Supabase y Google Fonts, report-only
  primero).
- Integración de CAPTCHA (Cloudflare Turnstile / hCaptcha) en `auth-card.tsx` y su verificación en el
  Server Action `signUp`.
- Requisitos de complejidad de contraseña (clases de caracteres).
- Rate limiting propio en `POST /api/contacto` (hoy solo honeypot `company`).
- Rate limiting a nivel de aplicación o de edge para `submitScore()` u otras rutas.
- `scores.user_id` y cualquier cambio de RLS en `scores` (sigue anónimo por iniciales).
- Rotación de claves, gestión de secretos, auditoría de dependencias (`npm audit`), Dependabot.
- 2FA / MFA, notificaciones de seguridad por correo, borrado de cuenta.
- Tests automatizados (no hay runner).

---

## Data model

Esta spec **no introduce nuevas estructuras de datos**. No crea tablas, columnas ni tipos, y **no
hace falta regenerar** `app/lib/supabase/database.types.ts` (la migración 12 solo hace `REVOKE` y
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` idempotente).

### Headers de seguridad (`next.config.ts`)

Todos sobre `source: '/(.*)'`:

| Header                      | Valor                                          | Motivo                                                      |
| --------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `X-Content-Type-Options`    | `nosniff`                                      | Evita MIME sniffing.                                        |
| `X-Frame-Options`           | `DENY`                                         | Bloquea embedding en iframe (clickjacking). No hay iframes. |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | No filtra path/query a terceros.                            |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Fuerza HTTPS. Solo tiene efecto servido por HTTPS en prod.  |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=()`     | Desactiva APIs del navegador que la app no usa.             |
| `X-DNS-Prefetch-Control`    | `on`                                           | Prefetch DNS controlado explícitamente.                     |

Además, `poweredByHeader: false` elimina `X-Powered-By: Next.js`.

### Migración `12-endurecer-seguridad.sql`

```sql
-- Revoca la RPC accidental (linter 0028 / 0029). El event trigger sigue vivo:
-- no depende del EXECUTE del rol de sesión.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;

-- Reafirma RLS (idempotente; ya estaba activa desde SPEC 06).
alter table public.games  enable row level security;
alter table public.scores enable row level security;
```

---

## Implementation plan

Cada paso deja el árbol compilando y es commitable por separado.

1. **Migración 12.** Escribir `supabase/migrations/12-endurecer-seguridad.sql` con el bloque de
   cabecera comentado y las tres sentencias. Aplicarla con `mcp__supabase__apply_migration`
   (`12_endurecer_seguridad`). Verificación: `mcp__supabase__get_advisors` (security) ya no lista los
   dos avisos de `rls_auto_enable`; `mcp__supabase__list_tables` muestra `games` y `scores` con
   `rls_enabled: true`; `mcp__supabase__execute_sql` con
   `select has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')` devuelve `false`.

2. **Headers en `next.config.ts`.** Leer los docs de Next indicados en el Scope. Añadir `headers()`
   async con la lista de la tabla y `poweredByHeader: false`. Verificación: `npm run build` compila;
   `npm run dev` + `curl -I http://localhost:3000/` y `curl -I http://localhost:3000/biblioteca`
   muestran los 6 headers y ninguna respuesta trae `X-Powered-By`; `curl -I` de un asset estático
   bajo `/_next/...` también trae los headers (o se acepta que el matcher no los cubra — anotarlo).

3. **Ajustes de dashboard + `supabase/README.md`.** Aplicar en el dashboard de Supabase: minimum
   password length = 8, leaked password protection ON, password requirements = solo longitud, bajar
   los rate limits de sign-up / token verification. Documentar los pasos y los valores elegidos en la
   sección "Seguridad (SPEC 13)" de `supabase/README.md`. Verificación:
   `mcp__supabase__get_advisors` (security) ya no reporta `auth_leaked_password_protection`; crear un
   usuario de prueba con contraseña de 6 caracteres desde el dashboard falla; con 8 funciona.

3.1 **Proteccion de rutas con Proxy next.js**

4. **Cerrar el checklist + docs.** Marcar `[x]` en `references/security/security-checklist.md` con la
   nota de cómo se cumplió cada ítem; sustituir el "TODO" de warnings por el estado real de
   `get_advisors`. Añadir la línea a `CLAUDE.md` "Stack notes". Verificación: `npm run lint` y
   `npm run build` sin errores ni warnings; commitear el bloque gestionado de `AGENTS.md` / `CLAUDE.md`
   si `next dev` lo reescribió.

5. **Regresión de auth.** Con `npm run dev`: alta de un usuario nuevo → sigue creando su fila en
   `profiles` (el trigger `handle_new_user` y el event trigger de RLS no se ven afectados por el
   `REVOKE`); login por email y OAuth siguen funcionando; jugar y guardar una puntuación sin cuenta
   sigue funcionando; `/`, `/biblioteca` y `/salon` siguen estáticas / ISR en el output del build.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `npm run lint` sin errores ni warnings.
- [ ] `curl -I` de `/` y de `/biblioteca` (con `npm run dev` o `npm run start`) devuelve
      `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
      `Referrer-Policy: strict-origin-when-cross-origin`,
      `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`,
      `Permissions-Policy: camera=(), microphone=(), geolocation=()` y `X-DNS-Prefetch-Control: on`.
- [ ] Ninguna respuesta del servidor incluye el header `X-Powered-By`.
- [ ] Existe `supabase/migrations/12-endurecer-seguridad.sql` en el repo y está aplicada al proyecto
      remoto (`mcp__supabase__list_migrations` muestra `12_endurecer_seguridad`).
- [ ] `mcp__supabase__get_advisors` (security) **no** reporta
      `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable`
      sobre `public.rls_auto_enable`.
- [ ] `has_function_privilege('anon', 'public.rls_auto_enable()', 'execute')` y el equivalente para
      `authenticated` devuelven `false`.
- [ ] `mcp__supabase__list_tables` muestra `public.games` y `public.scores` con `rls_enabled: true`.
- [ ] `mcp__supabase__get_advisors` (security) **no** reporta `auth_leaked_password_protection`.
- [ ] En el dashboard de Supabase, _Minimum password length_ = `8`; una contraseña de 7 caracteres
      es rechazada en el alta.
- [ ] `supabase/README.md` tiene una sección "Seguridad (SPEC 13)" que documenta: password length 8,
      leaked password protection, password requirements solo-longitud y la bajada de rate limits de
      alta (con los valores elegidos).
- [ ] `references/security/security-checklist.md` tiene marcados `[x]` los cinco ítems del checklist
      básico, cada uno con una nota de cómo se cumplió.
- [ ] `CLAUDE.md` "Stack notes" menciona los headers de seguridad y la migración 12.
- [ ] Alta de un usuario nuevo sigue creando su fila en `public.profiles` con un `username` válido.
- [ ] Login por email y OAuth (Google / GitHub) siguen funcionando.
- [ ] Jugar una partida y guardar una puntuación sin cuenta sigue funcionando.
- [ ] `npm run build` sigue reportando `/`, `/biblioteca` y `/salon` como estáticas / ISR.
- [ ] No se ha modificado `proxy.ts`, `app/lib/**`, ninguna tabla salvo el `REVOKE` / `ALTER` de la
      migración 12, ni se ha regenerado `database.types.ts`.

---

## Decisions

- **Sí:** headers de seguridad en `next.config.ts` con `headers()` sobre `/(.*)`. Es el mecanismo
  nativo de Next y el que sugiere el propio checklist. **No:** ponerlos en `proxy.ts` — el `proxy`
  solo debe refrescar el token de Supabase; mezclar headers ahí lo acopla y no cubre respuestas que
  no pasan por el matcher del proxy.
- **Sí:** los 3 del checklist + `Strict-Transport-Security` + `Permissions-Policy` +
  `X-DNS-Prefetch-Control`. Son headers estáticos, sin riesgo de romper la app y con ganancia clara.
  **No:** `Content-Security-Policy` ahora — necesita afinado con los inline scripts de Next, la
  allowlist de `*.supabase.co` y Google Fonts, y conviene desplegarla primero en `report-only`. Va en
  su propia spec.
- **Sí:** `poweredByHeader: false`. Quita `X-Powered-By: Next.js` (fingerprinting) con una línea.
  **No:** dejarlo — no aporta nada y expone la versión del framework.
- **Sí:** `X-Frame-Options: DENY`. La plataforma no se embebe en iframes en ningún sitio. **No:**
  `SAMEORIGIN` — más permisivo sin necesidad; si algún día se embebe el reproductor se relaja
  entonces.
- **Sí:** migración 12 con `REVOKE EXECUTE` sobre `rls_auto_enable()` **y** `ALTER TABLE ... ENABLE
ROW LEVEL SECURITY` idempotente en `games` / `scores`. Cierra el advisor y deja la RLS afirmada en
  el repo (hoy solo estaba en la 06). **No:** solo el `REVOKE` — reafirmar RLS es una línea y hace la
  migración autoexplicativa como "endurecimiento".
- **Sí:** documentar los ajustes de Auth (password length, leaked password, rate limits) en
  `supabase/README.md` y que el usuario los aplique a mano. El MCP de Supabase no expone la config de
  Auth (mismo caso que SPEC 12). **No:** intentar un script contra la Management API — fuera del
  patrón del repo y añade un secreto nuevo.
- **Sí:** política de contraseña = solo longitud ≥ 8. El Server Action ya lo valida; se alinea el
  dashboard. **No:** exigir clases de caracteres — más fricción en el alta para una plataforma de
  juego casual; las reglas de complejidad rígidas empujan a patrones predecibles. Leaked password
  protection cubre el caso real (contraseñas ya comprometidas).
- **No:** CAPTCHA / Turnstile en esta spec. Requiere widget en `auth-card.tsx`, dos env vars nuevas,
  verificación del token en `signUp` y activar el provider en Supabase. Es una feature con su propia
  superficie de UI y de test.
- **No:** rate limiting propio de `/api/contacto` o de `submitScore()`. El honeypot cubre el bot
  básico del formulario; un rate limiter real (edge / KV) es otra spec.

---

## Risks

| Riesgo                                                                                            | Mitigación                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Strict-Transport-Security` con `preload` es un compromiso difícil de revertir                    | Solo surte efecto servido por HTTPS (en `localhost` http el navegador lo ignora). El hosting sirve todo el dominio por HTTPS. Se documenta que `preload` implica ese compromiso.               |
| El `REVOKE` sobre `rls_auto_enable()` rompe el event trigger que auto-activa RLS en tablas nuevas | Los event triggers se ejecutan con los privilegios del owner del trigger, no con el `EXECUTE` del rol de sesión. El paso 5 verifica que un alta nueva (que crea filas) sigue OK.               |
| `X-Frame-Options: DENY` rompe un embedding futuro del reproductor                                 | No hay iframes hoy. Si se necesita, se cambia a `SAMEORIGIN` o se acota por ruta en ese momento.                                                                                               |
| El matcher `/(.*)` de `headers()` no cubre algún tipo de respuesta (assets `_next`)               | El paso 2 lo comprueba con `curl -I`; si algún asset queda fuera se añade un `source` extra. Los headers de páginas y API, que es lo que importa, sí quedan cubiertos.                         |
| Los ajustes de dashboard se revierten en un reset del proyecto o no se aplican                    | Quedan documentados en `supabase/README.md` con los valores exactos; `get_advisors` los verifica y es criterio de aceptación.                                                                  |
| Subir el minimum password length a 8 invalida sesiones o cuentas con contraseñas más cortas       | Solo afecta a altas y cambios de contraseña futuros; las contraseñas ya establecidas siguen sirviendo para login. El Server Action ya exigía 8, así que no hay cuentas < 8 creadas por la app. |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`                            | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                                                                                                                      |

---

## Lo que **no** entra en esta spec

- `Content-Security-Policy` (en su propia spec: report-only primero, allowlist de Supabase y fuentes).
- CAPTCHA / Turnstile en el alta y su verificación en `signUp`.
- Requisitos de complejidad de contraseña (clases de caracteres).
- Rate limiting propio de `/api/contacto`, `submitScore()` u otras rutas.
- `scores.user_id` y cualquier cambio de RLS en `scores`.
- `npm audit` / Dependabot, rotación de claves, gestión de secretos.
- 2FA / MFA, notificaciones de seguridad por correo, borrado de cuenta.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
