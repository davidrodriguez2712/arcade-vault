import type { Metadata } from "next";
import AuthCard from "@/app/components/auth-card";

export const metadata: Metadata = {
  title: "Acceso al sistema · Arcade Vault",
};

export default function EntrarPage() {
  return (
    <div className="av-auth-wrap fade-in">
      <AuthCard />
    </div>
  );
}
