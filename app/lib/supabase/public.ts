import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
// Cliente de Supabase de solo lectura para datos públicos (catálogo de juegos,
// marcas del leaderboard). No usa cookies ni sesión, así que las páginas que lo
// consumen pueden seguir generándose de forma estática / ISR.
// No sustituye a `client.ts` (navegador) ni a `server.ts` (Server Actions).
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
