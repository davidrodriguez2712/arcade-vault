import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AuthCard from "@/app/components/auth-card";
import { getSessionUser } from "@/app/lib/auth";
import { sanitizeNext } from "@/app/lib/auth-shared";
export const metadata: Metadata = {
  title: "Acceso al sistema · Arcade Vault",
};
export default async function EntrarPage({
  searchParams,
}: PageProps<"/entrar">) {
  const params = await searchParams;
  const raw = params.next;
  const next = sanitizeNext(typeof raw === "string" ? raw : null);
  // Si ya hay sesión, no tiene sentido mostrar la tarjeta.
  const user = await getSessionUser();
  if (user) redirect(next);
  return (
    <div className="av-auth-wrap fade-in">
      <AuthCard next={next} />
    </div>
  );
}
