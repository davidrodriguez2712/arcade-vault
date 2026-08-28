import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
// Cliente de Supabase para código que corre solo en el servidor:
// Server Components, Server Actions y Route Handlers.
// Hay que crear uno nuevo por request porque necesita las cookies de esa request.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` se llamó desde un Server Component, que no puede escribir
            // cookies. Se ignora sin problema: el `proxy.ts` refresca la sesión
            // en cada request.
          }
        },
      },
    },
  );
}
