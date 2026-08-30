import { createClient } from "./supabase/server";
export interface SessionUser {
  id: string;
  email: string | null;
  username: string;
}
// Usuario autenticado + su username de `profiles`, o `null` si no hay sesión (o
// si algo falla). Usa `getUser()` — valida el JWT contra el servidor de auth —,
// no `getSession()`. Pensado para Server Components (`/entrar`, `/perfil`).
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  const metaName =
    typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username
      : null;
  return {
    id: user.id,
    email: user.email ?? null,
    username: profile?.username ?? metaName ?? "jugador",
  };
}
