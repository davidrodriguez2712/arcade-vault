// Tipos y constantes compartidos entre los Server Actions de auth
// (`auth-actions.ts`, que por ser "use server" solo puede exportar funciones) y
// los componentes de cliente que los consumen con `useActionState`.
export interface AuthActionState {
  ok: boolean;
  error?: string;
  needsConfirmation?: boolean;
  // Correo al que se envió el enlace de confirmación (para el aviso de la tarjeta).
  email?: string;
}
export const AUTH_INITIAL_STATE: AuthActionState = { ok: false };
export const DEFAULT_NEXT = "/biblioteca";
// Solo se aceptan rutas internas ("/algo"). Cualquier otra cosa (URL absoluta,
// "//host", vacío) cae a DEFAULT_NEXT. Evita redirects abiertos tras el login,
// la confirmación de correo y el retorno de OAuth.
export function sanitizeNext(value: string | null | undefined): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : DEFAULT_NEXT;
}
