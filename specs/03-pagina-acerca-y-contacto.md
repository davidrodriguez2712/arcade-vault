# SPEC 03 — Página "Acerca de" y envío de correo de contacto

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-08-27
> **Objetivo:** Portar `references/templates/home-about/about.jsx` a la ruta `/acerca` del App Router y hacer que su formulario de contacto envíe un correo real vía Resend a través de un Route Handler `POST /api/contacto`.

---

## Por qué existe esta spec

SPEC 02 portó la landing (`home.jsx`) pero **dejó fuera explícitamente** la página "Acerca de": su enlace en el Nav, sus estilos (`.about-*`, `.highlight-*`, `.contact-*`, `.term-*`) y el formulario de contacto. Esta spec cierra ese hueco.

A diferencia del formulario de `auth.jsx` (SPEC 01), que solo simula, aquí el formulario **sí hace algo real**: manda un correo. Es la primera integración con un servicio externo del proyecto (Resend) y la primera env var / Route Handler.

El `about.jsx` del template solo valida campos vacíos (animación `shake`) y luego pinta un terminal de éxito sin enviar nada. Esta spec conserva ese aspecto **exacto** y le añade: envío real, estado "ENVIANDO…", estado de error cuando Resend falla, y un honeypot anti-bots.

---

## Scope

**In:**

- Nueva ruta `/acerca` (server component `app/acerca/page.tsx`) con `metadata.title` "Arcade Vault · Acerca de", que monta el componente cliente `<AboutContent />`.
- `app/components/about-content.tsx` (`"use client"`) — portado literal de `about.jsx`:
  - Sección `.about-hero`: kicker `▸ ACERCA DE`, `.about-title` "ACERCA DE ARCADE VAULT", `.about-mission` y `.highlight-row` con 3 `.highlight` (HEART/BROWSER/PLANT) y `transitionDelay` por índice.
  - `.about-divider` decorativo (24 `<span>` con `animationDelay`).
  - Sección `.about-contact` con `.contact-grid`: columna intro (kicker `▸ CONTACTO`, `.contact-title` "CONTÁCTANOS", `.contact-sub`, 3 `.contact-tips`) y el `<form className="contact-form">`.
  - IntersectionObserver inline (igual que el template: `threshold: 0.12`, `unobserve` al entrar) que añade `.in` a los `.reveal`.
  - Estado del formulario: `form {name,email,msg}`, `sent`, `shake` (igual que el template) **más** `sending` y `error` (nuevos).
- `app/components/about-highlight-icon.tsx` (server) — `HighlightIcon` con prop `kind` (HEART/BROWSER/PLANT), markup SVG literal del template.
- Comportamiento del formulario:
  - Validación cliente de campos vacíos → `shake` 400 ms, no envía (igual que el template).
  - Campo honeypot oculto (`name="company"`, `tabIndex={-1}`, `aria-hidden`, fuera de pantalla vía estilo inline): si viene relleno, el cliente finge éxito y **no** llama a la API.
  - `onSubmit` válido → `sending = true`, botón muestra `▶  ENVIANDO…` y queda `disabled`; `fetch("/api/contacto", { method: "POST", body: JSON })`.
  - Respuesta `ok` → `setSent(nombre)`, se pinta el `.terminal-success` **idéntico al template** (con `{sent.toUpperCase()}` y botón "ENVIAR OTRO MENSAJE" que resetea).
  - Respuesta no-`ok` o fallo de red → `sending = false`, `error` con mensaje, `shake`, línea de error inline (`.contact-error`, texto pixel magenta) encima del botón. Reintentar reenvía.
- `app/api/contacto/route.ts` — Route Handler:
  - Solo `POST`. Lee JSON `{ name, email, msg, company }`.
  - Si `company` (honeypot) no está vacío → responde `200 { ok: true }` sin enviar nada.
  - Valida server-side: `name`, `email`, `msg` no vacíos tras `trim()`; `email` cumple un regex básico; `msg` ≤ 5000 chars. Si falla → `400 { ok: false, error: "..." }`.
  - Si falta `process.env.RESEND_API_KEY` → `500 { ok: false, error: "..." }` y `console.error`.
  - Llama a Resend (`resend.emails.send`) con:
    - `from: "Arcade Vault <onboarding@resend.dev>"`
    - `to: "rodriguezdavid2712@gmail.com"`
    - `replyTo: <email del formulario>`
    - `subject: "[Arcade Vault] Mensaje de <name>"`
    - `text`: cuerpo en **texto plano** con nombre, correo y mensaje (sin `html`).
  - Éxito → `200 { ok: true }`. Error de Resend → `502 { ok: false, error: "..." }` + `console.error`.
- `app/lib/contact.ts` (nuevo) — tipo `ContactPayload` y función `validateContact(payload): string | null` (devuelve el primer error o `null`), compartida por el Route Handler. El cliente puede reusar el tipo.
- `app/components/site-nav.tsx` — añadir el enlace "Acerca de" → `/acerca` en la barra desktop (`.links`) y en el panel móvil, con `isActive("acerca") = pathname === "/acerca"`. Orden: Inicio · Biblioteca · Salón de la Fama · Acerca de.
- `app/globals.css` — anexar los bloques de `references/templates/home-about/styles.css` que **aún no existen**: `.about`, `.about-hero` (+ `.kicker`), `.about-title`, `.about-mission`, `.highlight-row` (+ `@media 820px`), `.highlight` (+ `.cyan/.magenta/.green`, `:hover`, `.hl-icon`, `.hl-text`), `.about-divider`, `.div-bar`, `.div-pixels` (+ `span` y `:nth-child`), `@keyframes pxblink`, `.about-contact`, `.contact-grid` (+ `@media 900px`), `.contact-intro .kicker`, `.contact-title`, `.contact-sub`, `.contact-tips` (+ `.tip`, `.tip-led`, `.y`, `.m`), `.contact-form` (+ `::before`, `.shake`), `@keyframes shake`, `.contact-form textarea` (+ `:focus`, `::placeholder`), `.btn.press:active`, `.terminal-success`, `.term-bar` (+ `.dot`, `.r/.y/.g`, `.term-title`), `.term-body` (+ `.line`, `.prompt`, `.dim`, `.success`, `.caret`). **Más** una clase nueva `.contact-error` (pixel, `var(--magenta)`, `margin-bottom` para separar del botón). **No** re-portar: `.field`, `.reveal`, `.fade-in`, `@keyframes blink` (ya en `globals.css` desde SPEC 01/02). **No** portar `.gp*`/`.dp*`/`.ab*` (mando decorativo). **No** redefinir `:root`, `body`, `.av-nav`, `.btn`.
- `.env.example` (nuevo) con `RESEND_API_KEY=` y un comentario. `.env.local` (git-ignorado por `.gitignore` → `.env*`) con la clave real, creado localmente, **no** commiteado.
- Revisión visual con Playwright MCP: screenshots de `/acerca` (hero, highlights, divider, formulario, estado éxito, estado error) en `.playwright-screenshots/`, contrastados con `references/templates/home-about/arcade-vault-standalone.html`. Desktop y móvil (~390 px).

**Out of scope (para futuras specs):**

- Dominio propio verificado en Resend. Se usa `onboarding@resend.dev`, que en el plan gratuito solo entrega a la dirección de la cuenta Resend (`rodriguezdavid2712@gmail.com`). Migrar a `contacto@<dominio>` va en otra spec.
- Correo de confirmación automático al remitente ("gracias por escribirnos"). Solo se envía al equipo.
- Rate limiting / captcha / verificación por token. La protección anti-spam es solo el honeypot.
- Persistencia de los mensajes (base de datos, cola, panel de admin). El correo es el único destino.
- Portar el resto de `about.jsx` que no existe: no hay más — el template es solo hero + highlights + divider + contacto.
- El mando arcade decorativo (`.gp`/`.dp`/`.ab`) del `arcade-vault-standalone.html`.
- Internacionalización: los textos siguen en el español del template.
- Tests automatizados (no hay runner).
- `metadata` OpenGraph / social para `/acerca` más allá del `title`.
- Extraer `useReveal` de `home-landing.tsx` a un hook compartido: `about-content.tsx` replica el observer inline como hace el propio template.

---

## Data model

No hay base de datos ni persistencia. Se introduce un único tipo y una función de validación.

`app/lib/contact.ts` (nuevo):

```ts
export interface ContactPayload {
  name: string;
  email: string;
  msg: string;
  company?: string; // honeypot; si viene relleno es un bot
}

// Devuelve el primer mensaje de error, o null si el payload es válido.
// Reglas: name/email/msg no vacíos tras trim; email pasa un regex básico
// (/^[^\s@]+@[^\s@]+\.[^\s@]+$/); msg.length <= 5000.
export function validateContact(payload: ContactPayload): string | null;
```

Forma de la respuesta del Route Handler (siempre JSON):

| Caso                                   | HTTP | Body                               |
| -------------------------------------- | ---- | ---------------------------------- |
| Éxito (o honeypot relleno)             | 200  | `{ ok: true }`                     |
| Validación fallida                     | 400  | `{ ok: false, error: string }`    |
| Falta `RESEND_API_KEY`                 | 500  | `{ ok: false, error: string }`    |
| Resend devuelve error                  | 502  | `{ ok: false, error: string }`    |

Variables de entorno:

| Var               | Dónde                         | Commiteada | Valor                          |
| ----------------- | ----------------------------- | ---------- | ------------------------------ |
| `RESEND_API_KEY`  | `.env.local`                  | No         | clave real de Resend           |
| `RESEND_API_KEY=` | `.env.example`                | Sí         | vacío, con comentario          |

Mapa de rutas tras esta spec (solo lo que cambia o se añade):

| Ruta            | Archivo                       | Tipo   | Componente cliente | Cambio     |
| --------------- | ----------------------------- | ------ | ------------------ | ---------- |
| `/acerca`       | `app/acerca/page.tsx`         | server | `AboutContent`     | nuevo      |
| `/api/contacto` | `app/api/contacto/route.ts`   | route  | —                  | nuevo      |
| (layout)        | `app/components/site-nav.tsx` | client | —                  | 1 enlace   |

Componentes nuevos bajo `app/components/`:

- `about-content.tsx` (client) — hero + highlights + divider + formulario + observer + lógica de envío.
- `about-highlight-icon.tsx` (server) — 3 SVG de `HighlightIcon`.

Dependencia nueva en `package.json`: `resend` (última versión estable).

---

## Implementation plan

1. **Dependencia y entorno.** `npm install resend`. Crear `.env.example` con `RESEND_API_KEY=` + comentario. Crear `.env.local` con la clave real (aportada por el usuario). Verificar que `git status` no lista `.env.local`. `npm run build` pasa.

2. **CSS de la página.** Anexar al final de `app/globals.css` los bloques listados en Scope (todos los `.about-*`, `.highlight*`, `.about-divider`/`.div-*`, `@keyframes pxblink`, `.contact-*`, `@keyframes shake`, `.btn.press:active`, `.terminal-success`/`.term-*`) y la clase nueva `.contact-error`. No re-portar `.field`, `.reveal`, `.fade-in`, `@keyframes blink`. No redefinir `:root`, `body`, `.av-nav`, `.btn`. `npm run build` pasa; sin cambios visuales todavía (nadie usa esas clases aún).

3. **Validación compartida.** Crear `app/lib/contact.ts` con `ContactPayload` y `validateContact`. Sin UI. `npm run build` compila.

4. **Route Handler.** Crear `app/api/contacto/route.ts`: `export async function POST(request: Request)`. Parsear JSON con `try/catch` (JSON inválido → `400`). Honeypot `company` no vacío → `200 { ok: true }`. `validateContact` → `400` si falla. `RESEND_API_KEY` ausente → `console.error` + `500`. `new Resend(process.env.RESEND_API_KEY)`; `resend.emails.send({ from, to, replyTo, subject, text })` con los valores de Scope. Error de Resend → `console.error` + `502`. Éxito → `200 { ok: true }`. Verificación: `curl -X POST localhost:3000/api/contacto -H 'content-type: application/json' -d '{"name":"Test","email":"t@t.com","msg":"hola"}'` devuelve `{"ok":true}` y llega el correo a `rodriguezdavid2712@gmail.com`; `-d '{"name":"","email":"x","msg":""}'` devuelve `400`; con honeypot `"company":"x"` devuelve `{"ok":true}` y **no** llega correo.

5. **Iconos.** Crear `app/components/about-highlight-icon.tsx` (server) con `HighlightIcon` y los 3 SVG (`HEART`, `BROWSER`, `PLANT`) copiados literalmente del template. `npm run build` pasa.

6. **Página y componente cliente.** Crear `app/acerca/page.tsx` (server, `metadata.title` "Arcade Vault · Acerca de") que renderiza `<AboutContent />`. Crear `app/components/about-content.tsx` (`"use client"`) portando `about.jsx`: el `useEffect` con el IntersectionObserver, el estado `form/sent/shake`, la sección `.about-hero` con `<HighlightIcon>`, el `.about-divider`, la sección `.about-contact` con el `<form>` y el bloque `.terminal-success`. En este paso el `onSubmit` aún puede ser el del template (validación + `setSent`) — sin envío real todavía. Verificación: `/acerca` coincide visualmente con `about.jsx`; scroll revela las secciones `.reveal`; enviar con campos vacíos hace `shake`.

7. **Envío real.** En `about-content.tsx`: añadir estado `sending` y `error`. Añadir el `<input>` honeypot oculto (`name="company"`). Reescribir `onSubmit`: validación de vacíos (igual), honeypot relleno → `setSent` sin fetch, si no → `setSending(true)`, `fetch("/api/contacto", …)`, `ok` → `setSent(nombre)`, error → `setSending(false)` + `setError(...)` + `shake`. Botón: `disabled={sending}`, texto `▶  ENVIANDO…` cuando `sending`. Renderizar `.contact-error` con `error` encima del botón cuando exista. El bloque `.terminal-success` y "ENVIAR OTRO MENSAJE" quedan idénticos (reset añade `setError(null)`). Verificación: enviar un mensaje válido desde `/acerca` → aparece el terminal de éxito y llega el correo; con la red cortada (DevTools offline) → línea de error magenta + `shake`, sin terminal.

8. **Nav.** Editar `site-nav.tsx`: `isActive` acepta `"acerca"` (`pathname === "/acerca"`); añadir `<Link href="/acerca">Acerca de</Link>` en `.links` y en `.av-mobile-panel`, después de "Salón de la Fama". Verificación: en `/acerca` se marca "Acerca de"; en las otras rutas no; el panel móvil muestra los 5 enlaces (Inicio, Biblioteca, Salón, Acerca de, Iniciar Sesión).

9. **Revisión visual con Playwright.** `npm run dev`; navegar a `http://localhost:3000/acerca`; screenshots de hero, highlights, divider y formulario (estado inicial) en `.playwright-screenshots/`; forzar el estado de éxito y el de error y capturarlos; contrastar con la sección equivalente de `arcade-vault-standalone.html`. Repetir a ~390 px. Consola del navegador: 0 errores, 0 warnings de hydration.

10. **Limpieza.** `npm run lint` y `npm run build` sin errores ni warnings. Quitar `console.log` temporales e imports sin usar. Confirmar que `.env.local` sigue sin trackear y que `.env.example` sí está. Commitear el bloque gestionado de `AGENTS.md`/`CLAUDE.md` si `next dev` lo reescribió.

---

## Acceptance criteria

- [ ] `npm run build` termina sin errores; `/acerca` se prerenderiza y `/api/contacto` aparece como Route Handler dinámico.
- [ ] `npm run lint` no reporta errores ni warnings.
- [ ] `/acerca` no emite errores ni warnings en consola (incluido hydration mismatch).
- [ ] `/acerca` muestra, en orden: `.about-hero` (kicker "▸ ACERCA DE", título "ACERCA DE ARCADE VAULT", misión, 3 `.highlight` con icono), `.about-divider`, `.about-contact` (intro + formulario).
- [ ] Los 3 `.highlight` muestran los textos del template (HECHO CON ❤️…, JUEGOS EN HTML…, PROYECTO EN CONSTANTE CRECIMIENTO) con sus colores (magenta/cyan/green).
- [ ] Al hacer scroll, `.about-divider` y `.about-contact` reciben `.in` y pasan a opacidad total.
- [ ] Enviar el formulario con algún campo vacío dispara la animación `shake` y no llama a `/api/contacto`.
- [ ] Enviar el formulario con nombre, correo y mensaje válidos: el botón pasa a "▶  ENVIANDO…" y queda deshabilitado; al resolverse `ok` aparece el `.terminal-success` con "GRACIAS, <NOMBRE EN MAYÚSCULAS>."
- [ ] Tras un envío correcto llega un correo a `rodriguezdavid2712@gmail.com` con asunto `[Arcade Vault] Mensaje de <nombre>`, cuerpo en texto plano con nombre/correo/mensaje, y `Reply-To` = el correo del formulario.
- [ ] "ENVIAR OTRO MENSAJE" en el terminal de éxito limpia el formulario y vuelve al estado inicial.
- [ ] Si `/api/contacto` responde error o falla la red, aparece una línea `.contact-error` en magenta encima del botón y `shake`; **no** se muestra el terminal de éxito; se puede reintentar.
- [ ] `POST /api/contacto` con `company` (honeypot) no vacío responde `{ ok: true }` y no envía correo.
- [ ] `POST /api/contacto` con `name`/`email`/`msg` inválidos responde `400 { ok: false, error }` y no envía correo.
- [ ] `POST /api/contacto` sin `RESEND_API_KEY` en el entorno responde `500` y registra el error en consola de servidor.
- [ ] Métodos distintos de `POST` en `/api/contacto` responden `405`.
- [ ] El Nav (desktop y móvil) muestra "Acerca de" enlazando a `/acerca`, activo solo en esa ruta.
- [ ] `/acerca` tiene `<title>` "Arcade Vault · Acerca de", distinto del resto.
- [ ] `.env.local` no está trackeado por git; `.env.example` sí, con `RESEND_API_KEY=` vacío.
- [ ] `app/globals.css` no redefine `:root`, `body`, `.av-nav` ni `.btn`; solo añade las clases de la página "Acerca de" + `.contact-error`.
- [ ] Existen screenshots de `/acerca` (hero, highlights, formulario, éxito, error) en `.playwright-screenshots/` y coinciden con `arcade-vault-standalone.html`.
- [ ] No hay acceso a `localStorage` / IndexedDB en el código de la página; la única llamada de red del cliente es el `fetch` a `/api/contacto` al enviar.

---

## Decisions

- **Sí:** ruta `/acerca` (español), coherente con `/juego`, `/entrar`, `/salon`, `/biblioteca`. **No:** `/about` — mezclaría idiomas.
- **Sí:** Route Handler `POST /api/contacto` + `fetch` desde el cliente. Mantiene el control del estado y la animación de terminal en el componente, tal cual el template. **No:** Server Action con `useActionState` — obligaría a reestructurar el manejo de estado/animación del template.
- **Sí:** `onboarding@resend.dev` como `from`, sin dominio propio. Funciona de inmediato para desarrollo. **No:** verificar un dominio ahora — es setup de DNS que va en su propia spec; en el plan gratuito solo se entrega a la dirección de la cuenta, suficiente para este MVP.
- **Sí:** `to` fijo a `rodriguezdavid2712@gmail.com` (dirección de la cuenta Resend, único destino permitido con `onboarding@resend.dev`).
- **Sí:** correo en **texto plano** (`text`, sin `html`). Más simple, sin plantilla que mantener.
- **Sí:** `replyTo` = correo del formulario, para responder directo desde Gmail.
- **Sí:** añadir estado `sending` y `error` + honeypot, aunque el template no los tenga. Sin ellos, un fallo de Resend mostraría un "éxito" falso. **No:** captcha ni rate limiting — desproporcionado para el tráfico esperado; el honeypot cubre los bots triviales.
- **Sí:** validación duplicada cliente (vacíos, como el template) y servidor (`validateContact` en `app/lib/contact.ts`). El cliente nunca es de fiar; la función compartida evita divergencias.
- **Sí:** honeypot procesado tanto en cliente (finge éxito, no llama) como en servidor (responde `ok` sin enviar). Doble red.
- **Sí:** `about-content.tsx` replica el IntersectionObserver inline como el template. **No:** extraer `useReveal` de `home-landing.tsx` a un hook compartido — refactor extra fuera del objetivo de esta spec.
- **Sí:** añadir "Acerca de" al Nav ahora (SPEC 02 lo difirió a esta spec).
- **Sí:** `.env.example` commiteado como plantilla; `.env.local` local y git-ignorado (`.gitignore` ya cubre `.env*`).
- **Sí:** revisión visual con Playwright MCP y screenshots por estado, como criterio de aceptación (igual que SPEC 01 y 02).

---

## Risks

| Riesgo                                                                       | Mitigación                                                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `onboarding@resend.dev` no entrega a direcciones distintas de la cuenta      | `to` fijo a la dirección de la cuenta; documentado en Decisions y Out of scope.                    |
| `RESEND_API_KEY` no configurada en algún entorno → 500 silencioso            | El Route Handler hace `console.error` explícito y responde `500`; criterio de aceptación dedicado. |
| Clave de Resend commiteada por error                                         | `.gitignore` ya ignora `.env*`; paso 1 y paso 10 verifican `git status`; solo `.env.example` (vacío) se commitea. |
| Colisión de nombres de clase entre el CSS portado y `app/globals.css`        | El paso 2 lista las clases exactas y prohíbe re-portar `.field`/`.reveal`/`.fade-in` y redefinir `:root`/`body`/`.av-nav`/`.btn`. |
| Hydration mismatch en `about-content.tsx`                                     | El observer y todo el estado viven en `useEffect`/eventos; el render inicial es estático.          |
| Spam através del formulario si se despliega público                          | Honeypot en cliente y servidor; rate limiting/captcha quedan anotados para otra spec.              |
| `next dev` reescribe el bloque gestionado de `AGENTS.md` / `CLAUDE.md`       | Ya documentado en `CLAUDE.md`; commitear el bloque junto con los cambios.                          |
| Divergencia visual con el prototipo por Preflight de Tailwind                | Paso 9: contrastar cada estado contra `arcade-vault-standalone.html` con Playwright, desktop y móvil. |

---

## Lo que **no** entra en esta spec

- Dominio propio verificado en Resend y `from` con ese dominio.
- Correo de confirmación al remitente.
- Rate limiting, captcha o verificación por token.
- Persistencia de los mensajes (base de datos, panel de admin).
- Internacionalización de los textos.
- Metadata social / OpenGraph de `/acerca`.
- Tests automatizados.

Cada uno, si se hace, va en su propia spec.
