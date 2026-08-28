import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
// Refresca el token de auth de Supabase en cada request y propaga las cookies
// resultantes tanto a la request (para los Server Components) como a la response
// (para el navegador).
//
// Esta versión NO protege rutas ni redirige: solo mantiene la sesión viva.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Sin variables de entorno no hay nada que refrescar: se sirve la request tal
  // cual en vez de reventar toda la app. La ruta /diagnostico/supabase avisa.
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }
  // Con Fluid compute, no guardes este cliente en una variable global:
  // hay que crear uno nuevo en cada request.
  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });
  // No metas código entre `createServerClient` y `supabase.auth.getClaims()`.
  // Un fallo aquí es muy difícil de depurar: provoca logouts aleatorios.
  //
  // IMPORTANTE: si quitas `getClaims()` y usas SSR con el cliente de Supabase,
  // los usuarios pueden quedar deslogueados de forma aleatoria.
  await supabase.auth.getClaims();
  // IMPORTANTE: hay que devolver el objeto `supabaseResponse` tal cual. Si creas
  // una response nueva con `NextResponse.next()`, acuérdate de:
  // 1. Pasarle la request: `NextResponse.next({ request })`
  // 2. Copiar las cookies: `nueva.cookies.setAll(supabaseResponse.cookies.getAll())`
  // 3. Ajustar la nueva response sin tocar las cookies
  // 4. Devolver la nueva response
  // Si no, el navegador y el servidor se desincronizan y la sesión se corta antes de tiempo.
  return supabaseResponse;
}
