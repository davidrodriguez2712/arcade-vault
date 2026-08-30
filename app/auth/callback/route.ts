import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { sanitizeNext } from "@/app/lib/auth-shared";
// GET /auth/callback — retorno de OAuth (Google / GitHub). Canjea el `code` por
// una sesión y redirige a `next`. Si falla, a /auth/error.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));
  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirectTo.pathname = next;
      return NextResponse.redirect(redirectTo);
    }
  }
  redirectTo.pathname = "/auth/error";
  return NextResponse.redirect(redirectTo);
}
