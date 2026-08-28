import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
// Cliente de Supabase para código que corre en el navegador (Client Components).
// `createBrowserClient` ya es un singleton interno: llamar a esto varias veces
// no crea instancias nuevas.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
