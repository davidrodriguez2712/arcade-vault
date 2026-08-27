import type { Metadata } from "next";
import AboutContent from "@/app/components/about-content";

export const metadata: Metadata = {
  title: "Arcade Vault · Acerca de",
};

export default function AcercaPage() {
  return <AboutContent />;
}
