import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { sanitizeNext } from "@/app/lib/auth-shared";
// GET /auth/confirm — canjea el `token_hash` del correo de confirmación por una
// sesión (flujo server-side con `verifyOtp`) y redirige a `next` sin arrastrar
// los parámetros secretos. Si algo falla, a /auth/error.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNext(searchParams.get("next"));
  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      redirectTo.pathname = next;
      return NextResponse.redirect(redirectTo);
    }
  }
  redirectTo.pathname = "/auth/error";
  return NextResponse.redirect(redirectTo);
}
