import type { Metadata } from "next";
import HomeLanding from "@/app/components/home-landing";
import { getGames } from "@/app/lib/games";
import { homeStats, tickerRows, topPlayers } from "@/app/lib/home";
export const metadata: Metadata = {
  title: "Arcade Vault · Inicio",
};
export default async function Home() {
  const [games, stats, ticker] = await Promise.all([
    getGames(),
    homeStats(),
    tickerRows(),
  ]);
  return (
    <HomeLanding
      previewGames={games.slice(0, 6)}
      stats={stats}
      ticker={ticker}
      top={topPlayers()}
    />
  );
}
