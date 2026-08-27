import type { Metadata } from "next";
import HallOfFame from "@/app/components/hall-of-fame";

export const metadata: Metadata = {
  title: "Salón de la Fama · Arcade Vault",
};

export default function SalonPage() {
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <HallOfFame />
    </div>
  );
}
