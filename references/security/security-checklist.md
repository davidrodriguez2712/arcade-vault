## Checklist de seguridad básico

Estado tras **SPEC 13 — Endurecimiento de seguridad**.

- [x] **RLS: Row Level Security habilitado en `games` y `scores`**
      Activa desde la migración 06 y reafirmada de forma idempotente en la
      migración `12-endurecer-seguridad.sql` (`alter table ... enable row level
    security`). `mcp__supabase__list_tables` muestra ambas con
      `rls_enabled: true`.
- [x] **Minimum password length — mínimo 8 caracteres**
      El Server Action `signUp` (`app/lib/auth-actions.ts`, SPEC 12) ya valida
      `≥ 8`. El dashboard se alinea a `8`: **Authentication › Sign In / Providers ›
      Email › Minimum password length = 8**. Pasos en `supabase/README.md`
      §"Seguridad (SPEC 13)".
- [x] **Leaked password protection**
      Activada en **Authentication › Sign In / Providers › Email › Leaked password
      protection** (comprobación contra HaveIBeenPwned). Pasos en
      `supabase/README.md` §"Seguridad (SPEC 13)". Cierra el aviso
      `auth_leaked_password_protection` de `get_advisors`.
- [x] **Max signup rate — limitar signups (anti-bot)**
      **Authentication › Rate Limits**: sign-ups/sign-ins y token verifications
      bajados a 30/hora por IP. Valores en `supabase/README.md` §"Seguridad
      (SPEC 13)". El CAPTCHA (Turnstile / hCaptcha) queda para otra spec.
- [x] **Headers de seguridad en Next.js**
      `next.config.ts` → `headers()` sobre `source: '/(.*)'` con
      `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
      `Referrer-Policy: strict-origin-when-cross-origin`,
      `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`,
      `Permissions-Policy: camera=(), microphone=(), geolocation=()`,
      `X-DNS-Prefetch-Control: on`. Además `poweredByHeader: false` quita
      `X-Powered-By`. Verificado con `curl -I` sobre `/` y `/biblioteca`.
      `Content-Security-Policy` va en su propia spec.

## Estado de `mcp__supabase__get_advisors` (security) tras SPEC 13

La migración 12 cierra los dos avisos sobre `public.rls_auto_enable()`
(`0028_anon_security_definer_function_executable` /
`0029_authenticated_security_definer_function_executable`): `has_function_privilege`
para `anon` y `authenticated` sobre `public.rls_auto_enable()` devuelve `false`.

`auth_leaked_password_protection` desaparece del linter una vez activada la opción
en el dashboard (paso 3 de `supabase/README.md`). Comprobar con:

```
mcp__supabase__get_advisors  type: security
```
