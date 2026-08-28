import type { Metadata } from "next";
import HallOfFame from "@/app/components/hall-of-fame";
import { getGames } from "@/app/lib/games";
import { getTopScores, type ScoreRow } from "@/app/lib/scores";
export const metadata: Metadata = {
  title: "Salón de la Fama · Arcade Vault",
};
// Marcas reales refrescadas por ISR además de por `revalidatePath` al guardar.
export const revalidate = 60;
export default async function SalonPage() {
  const games = await getGames();
  const leaderboardGames = games.filter((g) => g.hasLeaderboard);
  const realScores: Record<string, ScoreRow[]> = Object.fromEntries(
    await Promise.all(
      leaderboardGames.map(
        async (g) => [g.id, await getTopScores(g.id, 12)] as const,
      ),
    ),
  );
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>
      <HallOfFame games={games} realScores={realScores} />
    </div>
  );
}
