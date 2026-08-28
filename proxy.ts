import { type NextRequest } from "next/server";
import { updateSession } from "@/app/lib/supabase/proxy";
// Next 16: el convention `middleware.ts` está deprecado y renombrado a `proxy.ts`.
// Aquí solo refrescamos el token de auth de Supabase en cada request; no se
// protege ninguna ruta (eso va en la spec de Auth).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}
export const config = {
  matcher: [
    /*
     * Todas las rutas menos:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico
     * - archivos de imagen (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
