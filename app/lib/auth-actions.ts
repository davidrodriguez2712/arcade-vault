"use server";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { sanitizeNext, type AuthActionState } from "./auth-shared";
// Un módulo "use server" solo puede exportar funciones async. El tipo, el estado
// inicial y `sanitizeNext` viven en ./auth-shared para poder importarlos también
// desde los componentes y las rutas /auth/*.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const MIN_PASSWORD = 8;
// Alta con email + contraseña + nombre de jugador. Con "Confirm email" activo no
// crea sesión: devuelve `needsConfirmation` para que la tarjeta muestre el aviso.
export async function signUp(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error:
        "El nombre de jugador admite de 3 a 16 letras, números o guion bajo.",
    };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "El correo no tiene un formato válido." };
  }
  if (password.length < MIN_PASSWORD) {
    return {
      ok: false,
      error: `La contraseña necesita al menos ${MIN_PASSWORD} caracteres.`,
    };
  }
  const supabase = await createClient();
  // Aviso temprano si el nombre ya está cogido. El índice único sobre
  // lower(username) y el trigger `handle_new_user` son la red de seguridad.
  const { data: available } = await supabase.rpc("username_available", {
    name: username,
  });
  if (available === false) {
    return { ok: false, error: "Ese nombre de jugador ya está en uso." };
  }
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  });
  if (error) {
    console.error("signUp:", error.message);
    return {
      ok: false,
      error:
        "No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.",
    };
  }
  return { ok: true, needsConfirmation: true, email };
}
// Login por email. En éxito redirige a `next` (saneado); en fallo devuelve error.
export async function signIn(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rawNext = formData.get("next");
  const next = sanitizeNext(typeof rawNext === "string" ? rawNext : null);
  if (!EMAIL_RE.test(email) || !password) {
    return { ok: false, error: "Introduce tu correo y tu contraseña." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { ok: false, error: "Correo o contraseña incorrectos." };
  }
  redirect(next);
}
// Cierre de sesión. Lo usan `/perfil` y el nav (este último también cierra en
// cliente para refrescarse sin recargar).
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
// Cambio del nombre de jugador desde `/perfil`. Valida formato + unicidad y
// actualiza tanto `profiles` como el `user_metadata` (para que el nav lo vea).
export async function updateUsername(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const username = String(formData.get("username") ?? "").trim();
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error:
        "El nombre de jugador admite de 3 a 16 letras, números o guion bajo.",
    };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error: "Tu sesión ha caducado. Vuelve a iniciar sesión.",
    };
  }
  const { data: current } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  // Sin cambios (ni siquiera de mayúsculas): nada que hacer.
  if (current?.username === username) {
    return { ok: true };
  }
  // Solo comprobamos disponibilidad si no es una variación de mayúsculas del
  // nombre propio (ese caso lo permite el índice, es la misma fila).
  const onlyCaseChange =
    current?.username?.toLowerCase() === username.toLowerCase();
  if (!onlyCaseChange) {
    const { data: available } = await supabase.rpc("username_available", {
      name: username,
    });
    if (available === false) {
      return { ok: false, error: "Ese nombre de jugador ya está en uso." };
    }
  }
  const { error } = await supabase
    .from("profiles")
    .update({ username, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) {
    console.error("updateUsername:", error.message);
    return {
      ok: false,
      error: "No se pudo cambiar el nombre. Prueba con otro.",
    };
  }
  await supabase.auth.updateUser({ data: { username } });
  return { ok: true };
}
