import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ProfilePanel from "@/app/components/profile-panel";
import { getSessionUser } from "@/app/lib/auth";
export const metadata: Metadata = {
  title: "Tu perfil · Arcade Vault",
  robots: { index: false },
};
export default async function PerfilPage() {
  // Auto-protección a nivel de página: el proxy.ts no protege rutas.
  const user = await getSessionUser();
  if (!user) redirect("/entrar?next=/perfil");
  return (
    <div className="av-auth-wrap fade-in">
      <ProfilePanel email={user.email} username={user.username} />
    </div>
  );
}
